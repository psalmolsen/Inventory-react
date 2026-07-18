import fs from "fs";
import path from "path";
import { google } from "googleapis";

export function resolveCredentialsPath(preferredEnvVar: string, fallbackEnvVar?: string) {
  const rawPath =
    process.env[preferredEnvVar] ||
    (fallbackEnvVar ? process.env[fallbackEnvVar] : undefined);

  if (!rawPath) {
    throw new Error(
      `Missing Google credentials path. Set ${preferredEnvVar}${fallbackEnvVar ? ` or ${fallbackEnvVar}` : ""} to a JSON key file stored outside the repository.`
    );
  }

  const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  const repoRoot = path.resolve(process.cwd());
  const relativeToRepo = path.relative(repoRoot, resolvedPath);
  const isInsideRepo =
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith("..") && !path.isAbsolute(relativeToRepo));

  if (isInsideRepo) {
    throw new Error(
      `Google credentials must live outside the repository to avoid secret scanning leaks. Move the JSON key to a path like C:\\Users\\USER\\secrets\\ccb-service-account.json and update ${preferredEnvVar}${fallbackEnvVar ? ` or ${fallbackEnvVar}` : ""}.`
    );
  }

  return resolvedPath;
}

export function createSheetsClient(credentialsPath: string) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Google credentials file not found at "${credentialsPath}". Set the relevant *_GOOGLE_APPLICATION_CREDENTIALS env var to a valid JSON key file stored outside the repository.`
    );
  }

  return new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function formatSheetsAuthError(error: unknown, credentialsPath: string, label: string) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("invalid_grant") || lower.includes("invalid jwt signature")) {
    return new Error(
      `${label} Google Sheets auth failed for "${credentialsPath}". The key file is invalid, revoked, or no longer matches the service account. Replace it with a current JSON key, or point the env var to the correct file.`
    );
  }

  return new Error(`${label} Google Sheets request failed for "${credentialsPath}": ${message}`);
}
