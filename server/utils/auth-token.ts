import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export type AuthTokenPayload = {
  sub: number;
  role: "owner" | "cashier" | "stock";
  exp: number;
};

function sign(encodedPayload: string) {
  return createHmac("sha256", env.authSecret).update(encodedPayload).digest("base64url");
}

export function createAuthToken(userId: number, role: AuthTokenPayload["role"]) {
  const payload: AuthTokenPayload = {
    sub: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = sign(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AuthTokenPayload;
    if (!Number.isInteger(payload.sub) || payload.sub <= 0 || !["owner", "cashier", "stock"].includes(payload.role) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
