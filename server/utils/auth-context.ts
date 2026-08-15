import type { Response } from "express";
import type { AuthTokenPayload } from "./auth-token";
import { ApiError } from "./api-error";

export function authenticatedUserId(response: Response) {
  const payload = response.locals.auth as AuthTokenPayload | undefined;
  if (!payload || !Number.isInteger(payload.sub) || payload.sub <= 0) {
    throw new ApiError(401, "กรุณาเข้าสู่ระบบใหม่");
  }
  return payload.sub;
}
