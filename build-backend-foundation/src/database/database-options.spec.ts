import { createDatabaseOptions, getDatabaseTarget } from "./database-options";

const localEnvironment = {
  DATABASE_TARGET: "local",
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_USERNAME: "postgres",
  DB_PASSWORD: "postgres",
  DB_NAME: "manga_marketplace",
};

const certificate = [
  "-----BEGIN CERTIFICATE-----",
  "test-certificate",
  "-----END CERTIFICATE-----",
].join("\\n");

describe("database options", () => {
  it("uses local connection fields by default", () => {
    const options = createDatabaseOptions(localEnvironment);

    expect(options).toMatchObject({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      database: "manga_marketplace",
      synchronize: false,
    });
    expect(options.ssl).toBeUndefined();
  });

  it("uses separate Supabase runtime and migration URLs with verified TLS", () => {
    const environment = {
      DATABASE_TARGET: "supabase",
      DATABASE_URL:
        "postgresql://runtime:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres",
      MIGRATION_DATABASE_URL:
        "postgresql://postgres:password@db.project.supabase.co:5432/postgres",
      DATABASE_SSL_CA: certificate,
    };

    const runtime = createDatabaseOptions(environment, "runtime");
    const migration = createDatabaseOptions(environment, "migration");

    expect(runtime.url).toBe(environment.DATABASE_URL);
    expect(runtime.poolSize).toBe(5);
    expect(runtime.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((runtime.ssl as { ca: string }).ca).toContain("\n");
    expect(migration.url).toBe(environment.MIGRATION_DATABASE_URL);
    expect(migration.poolSize).toBe(1);
  });

  it("rejects unverified or URL-overridden Supabase TLS", () => {
    expect(() =>
      createDatabaseOptions({
        DATABASE_TARGET: "supabase",
        DATABASE_URL: "postgresql://user:password@example.com/postgres",
        MIGRATION_DATABASE_URL:
          "postgresql://user:password@example.com/postgres",
      }),
    ).toThrow("require DATABASE_SSL_CA");

    expect(() =>
      createDatabaseOptions({
        DATABASE_TARGET: "supabase",
        DATABASE_URL:
          "postgresql://user:password@example.com/postgres?sslmode=require",
        MIGRATION_DATABASE_URL:
          "postgresql://user:password@example.com/postgres",
        DATABASE_SSL_CA: certificate,
      }),
    ).toThrow("must not include sslmode");
  });

  it("rejects unknown targets", () => {
    expect(() => getDatabaseTarget({ DATABASE_TARGET: "production" })).toThrow(
      'must be either "local" or "supabase"',
    );
  });
});
