import crypto from "crypto";

const TOKEN_TTL_MS = 45 * 60 * 1000; // 45 minutes

function getSecret(): string {
  return process.env.RSVP_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "troque-esta-senha-rsvp";
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Issues a short-lived opaque token binding a client to a single invite,
 * created only after the guest has confirmed "sim, sou eu".
 */
export function createInviteToken(inviteId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${inviteId}.${expiresAt}`;
  const encodedPayload = base64url(payload);
  const signature = sign(payload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies signature + expiry and returns the invite id, or null if invalid/expired.
 */
export function verifyInviteToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  let payload: string;
  try {
    payload = fromBase64url(encodedPayload);
  } catch {
    return null;
  }

  const expectedSignature = sign(payload);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  const [inviteId, expiresAtRaw] = payload.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!inviteId || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  return inviteId;
}
