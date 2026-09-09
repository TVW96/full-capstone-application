import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function repositoryEnvironmentFile(
  workingDirectory = process.cwd(),
): string {
  const candidates = [
    resolve(workingDirectory, ".env"),
    resolve(workingDirectory, "../.env"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function loadRepositoryEnvironment(): void {
  const environmentFile = repositoryEnvironmentFile();
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
}
