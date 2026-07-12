import crypto from "crypto";

export const ADMIN_COOKIE = "admin_session";

function getSecret(): string {
  // Falls back to a default only for local/dev convenience.
  // In production, always set ADMIN_PASSWORD in your Vercel project settings.
  return process.env.ADMIN_PASSWORD || "troque-esta-senha";
}

export function makeSessionToken(): string {
  return crypto.createHmac("sha256", getSecret()).update("admin-session").digest("hex");
}

export function isValidPassword(password: string): boolean {
  return password === getSecret();
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return token === makeSessionToken();
}
