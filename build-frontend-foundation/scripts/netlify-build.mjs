import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sharedEnvFile = resolve("..", ".env");
if (existsSync(sharedEnvFile)) process.loadEnvFile(sharedEnvFile);
process.env.NODE_ENV = "production";

function requiredOrigin(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it to the public HTTPS origin of the unified Docker application.`,
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must contain only an origin, without a path.`);
  }

  const netlifyUrl = process.env.URL?.trim();
  if (netlifyUrl && new URL(netlifyUrl).origin === url.origin) {
    throw new Error(`${name} cannot point back to the Netlify site.`);
  }

  return url.origin;
}

const unifiedAppOrigin = requiredOrigin("UNIFIED_APP_URL");
const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const outputDirectory = resolve("out");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "_redirects"),
  `/api/*  ${unifiedAppOrigin}/api/:splat  200\n`,
  "utf8",
);
