import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    success: false,
    error: `ไม่พบ API ${request.method} ${request.originalUrl}`,
  });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const databaseCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const databaseStatus = databaseCode === "ER_DUP_ENTRY"
    ? 409
    : databaseCode === "ER_NO_REFERENCED_ROW_2"
      ? 400
      : ["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ER_BAD_DB_ERROR"].includes(databaseCode)
        ? 503
        : undefined;
  const statusCode = error instanceof ApiError ? error.statusCode : databaseStatus ?? 500;
  const fallbackMessage = statusCode === 409
    ? "ข้อมูลนี้มีอยู่ในระบบแล้ว"
    : statusCode === 400
      ? "ข้อมูลอ้างอิงไม่ถูกต้อง"
      : statusCode === 503
        ? "ไม่สามารถเชื่อมต่อฐานข้อมูลได้"
        : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
  const message = error instanceof ApiError
    ? error.message
    : databaseStatus
      ? fallbackMessage
      : error instanceof Error
        ? error.message
        : fallbackMessage;

  response.status(statusCode).json({
    success: false,
    error: statusCode === 500 && env.nodeEnv === "production" ? "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" : message,
    ...(error instanceof ApiError && error.details !== undefined ? { details: error.details } : {}),
  });
};
