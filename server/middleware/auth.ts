import type { RequestHandler } from "express";
import { type AuthTokenPayload, verifyAuthToken } from "../utils/auth-token";

export const requireAuthentication: RequestHandler = (request, response, next) => {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    response.status(401).json({ success: false, error: "กรุณาเข้าสู่ระบบใหม่" });
    return;
  }
  response.locals.auth = payload;
  next();
};

export function requireRoles(...allowedRoles: AuthTokenPayload["role"][]): RequestHandler {
  return (_request, response, next) => {
    const payload = response.locals.auth as AuthTokenPayload | undefined;
    if (!payload || !allowedRoles.includes(payload.role)) {
      response.status(403).json({ success: false, error: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ" });
      return;
    }
    next();
  };
}
