import { readFileSync } from "node:fs";

import type { DataSourceOptions } from "typeorm";

export type DatabaseTarget = "local" | "supabase";
export type DatabaseUsage = "runtime" | "migration";
export type PostgresDatabaseOptions = Extract<
  DataSourceOptions,
  { type: "postgres" }
>;

type DatabaseEnvironment = Record<string, string | undefined>;

const SSL_QUERY_PARAMETERS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
] as const;

function required(environment: DatabaseEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function positiveInteger(
  environment: DatabaseEnvironment,
  name: string,
  fallback: number,
): number {
  const rawValue = environment[name]?.trim();
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

export function getDatabaseTarget(
  environment: DatabaseEnvironment = process.env,
): DatabaseTarget {
  const target = environment.DATABASE_TARGET?.trim().toLowerCase() ?? "local";

  if (target !== "local" && target !== "supabase") {
    throw new Error(
      `DATABASE_TARGET must be either "local" or "supabase"; received "${target}".`,
    );
  }

  return target;
}

function validatePostgresUrl(value: string, name: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(
      `${name} must use the postgres:// or postgresql:// scheme.`,
    );
  }

  if (!url.hostname || !url.username || !url.password) {
    throw new Error(`${name} must include a host, username, and password.`);
  }

  if (url.hash) {
    throw new Error(
      `${name} contains an unencoded # character; percent-encode reserved password characters.`,
    );
  }

  for (const parameter of SSL_QUERY_PARAMETERS) {
    if (url.searchParams.has(parameter)) {
      throw new Error(
        `${name} must not include ${parameter}; TLS is configured centrally so its CA cannot be overridden by the pg URL parser.`,
      );
    }
  }

  return value;
}

function readCertificateAuthority(environment: DatabaseEnvironment): string {
  const inlineCertificate = environment.DATABASE_SSL_CA?.trim();
  const certificateFile = environment.DATABASE_SSL_CA_FILE?.trim();

  if (inlineCertificate && certificateFile) {
    throw new Error("Set only one of DATABASE_SSL_CA or DATABASE_SSL_CA_FILE.");
  }

  if (inlineCertificate) {
    return inlineCertificate.replace(/\\n/g, "\n");
  }

  if (certificateFile) {
    return readFileSync(certificateFile, "utf8");
  }

  throw new Error(
    "Supabase connections require DATABASE_SSL_CA or DATABASE_SSL_CA_FILE for verified TLS.",
  );
}

export function createDatabaseOptions(
  environment: DatabaseEnvironment = process.env,
  usage: DatabaseUsage = "runtime",
): PostgresDatabaseOptions {
  const target = getDatabaseTarget(environment);
  const commonOptions = {
    type: "postgres" as const,
    synchronize: false,
    installExtensions: false,
    uuidExtension: "pgcrypto" as const,
    connectTimeoutMS: positiveInteger(
      environment,
      "DB_CONNECT_TIMEOUT_MS",
      10_000,
    ),
    applicationName: `manga-marketplace-${usage}`,
  };

  if (target === "supabase") {
    const urlName =
      usage === "migration" ? "MIGRATION_DATABASE_URL" : "DATABASE_URL";

    return {
      ...commonOptions,
      url: validatePostgresUrl(required(environment, urlName), urlName),
      ssl: {
        ca: readCertificateAuthority(environment),
        rejectUnauthorized: true,
      },
      poolSize:
        usage === "migration"
          ? 1
          : positiveInteger(environment, "DB_POOL_SIZE", 5),
    };
  }

  return {
    ...commonOptions,
    host: required(environment, "DB_HOST"),
    port: positiveInteger(environment, "DB_PORT", 5432),
    username: required(environment, "DB_USERNAME"),
    password: required(environment, "DB_PASSWORD"),
    database: required(environment, "DB_NAME"),
    poolSize:
      usage === "migration"
        ? 1
        : positiveInteger(environment, "DB_POOL_SIZE", 10),
  };
}
