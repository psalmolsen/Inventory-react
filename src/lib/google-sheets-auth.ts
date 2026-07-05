import fs from "fs";
import path from "path";
import { google } from "googleapis";

export function resolveCredentialsPath(preferredEnvVar: string, fallbackEnvVar?: string) {
  const rawPath =
    process.env[preferredEnvVar] ||
    (fallbackEnvVar ? process.env[fallbackEnvVar] : undefined) ||
    "./service-account.json";

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export function createSheetsClient(credentialsPath: string) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Google credentials file not found at "${credentialsPath}". Set GOOGLE_APPLICATION_CREDENTIALS or CNF_GOOGLE_APPLICATION_CREDENTIALS to a valid JSON key file.`
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
