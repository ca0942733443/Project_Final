import type { RequestHandler } from "express";
import { verifyAuthToken } from "../utils/auth-token";

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
