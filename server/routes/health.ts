import { Router } from "express";
import { checkDatabaseConnection } from "../db/pool";
import { asyncHandler } from "../utils/async-handler";

export const healthRouter = Router();

healthRouter.get("/", asyncHandler(async (_request, response) => {
  await checkDatabaseConnection();
  response.json({
    success: true,
    service: "captain-gai-sod-api",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
}));
