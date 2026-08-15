import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { categoriesRouter } from "./routes/categories";
import { customersRouter } from "./routes/customers";
import { dashboardRouter } from "./routes/dashboard";
import { employeesRouter } from "./routes/employees";
import { inventoryRouter } from "./routes/inventory";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";
import { ApiError } from "./utils/api-error";
import { authRouter } from "./routes/auth";
import { requireAuthentication } from "./middleware/auth";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(403, "Origin นี้ไม่ได้รับอนุญาต"));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", requireAuthentication);
app.use("/api/categories", categoriesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
