import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface SummaryRow extends RowDataPacket {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  outstandingCredit: number;
}

interface SeriesRow extends RowDataPacket {
  label: string;
  total: number;
}

interface CategoryShareRow extends RowDataPacket {
  categoryName: string;
  total: number;
}

interface PaymentBreakdownRow extends RowDataPacket {
  method: "cash" | "qr" | "credit";
  total: number;
}

interface BestSellerRow extends RowDataPacket {
  productId: number;
  productName: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
}

interface InventoryAnalysisRow extends RowDataPacket {
  productId: number;
  productName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  status: "out" | "low" | "normal";
}

export const dashboardRouter = Router();

dashboardRouter.get("/", asyncHandler(async (request, response) => {
  const period = typeof request.query.period === "string" ? request.query.period : "week";
  if (!["day", "week", "month"].includes(period)) throw new ApiError(400, "ช่วงเวลารายงานไม่ถูกต้อง");

  const startExpression = period === "day"
    ? "CURDATE()"
    : period === "week"
      ? "DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)"
      : "DATE_FORMAT(CURDATE(), '%Y-%m-01')";
  const seriesLabel = period === "day"
    ? "DATE_FORMAT(s.sold_at, '%H:00')"
    : "DATE_FORMAT(s.sold_at, '%Y-%m-%d')";
  const salesPeriodCondition = `s.sale_status <> 'CANCELLED' AND s.sold_at >= ${startExpression}`;

  const [summaryResult, seriesResult, categoryResult, paymentResult, sellersResult, inventoryResult] = await Promise.all([
    pool.query<SummaryRow[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN ${salesPeriodCondition} THEN s.total_amount ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(${salesPeriodCondition}), 0) AS orderCount,
        COALESCE(AVG(CASE WHEN ${salesPeriodCondition} THEN s.total_amount END), 0) AS averageOrderValue,
        COALESCE((
          SELECT SUM(outstanding_amount)
          FROM credit_invoices
          WHERE invoice_status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
        ), 0) AS outstandingCredit
      FROM sales s
    `),
    pool.query<SeriesRow[]>(`
      SELECT ${seriesLabel} AS label, SUM(s.total_amount) AS total
      FROM sales s
      WHERE ${salesPeriodCondition}
      GROUP BY label
      ORDER BY MIN(s.sold_at) ASC
    `),
    pool.query<CategoryShareRow[]>(`
      SELECT c.category_name AS categoryName, SUM(si.line_total) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.sale_id = si.sale_id
      INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
      INNER JOIN products p ON p.product_id = pu.product_id
      INNER JOIN categories c ON c.category_id = p.category_id
      WHERE ${salesPeriodCondition}
      GROUP BY c.category_id, c.category_name
      ORDER BY total DESC
    `),
    pool.query<PaymentBreakdownRow[]>(`
      SELECT method, SUM(total) AS total
      FROM (
        SELECT
          CASE sp.payment_method WHEN 'CASH' THEN 'cash' ELSE 'qr' END AS method,
          sp.paid_amount AS total
        FROM sale_payments sp
        INNER JOIN sales s ON s.sale_id = sp.sale_id
        WHERE ${salesPeriodCondition}
        UNION ALL
        SELECT 'credit' AS method, s.total_amount AS total
        FROM sales s
        WHERE ${salesPeriodCondition} AND s.sale_status = 'CREDIT'
      ) payment_rows
      GROUP BY method
      ORDER BY total DESC
    `),
    pool.query<BestSellerRow[]>(`
      SELECT
        p.product_id AS productId,
        p.product_name AS productName,
        c.category_name AS categoryName,
        SUM(si.quantity) AS quantitySold,
        SUM(si.line_total) AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.sale_id = si.sale_id
      INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
      INNER JOIN products p ON p.product_id = pu.product_id
      INNER JOIN categories c ON c.category_id = p.category_id
      WHERE ${salesPeriodCondition}
      GROUP BY p.product_id, p.product_name, c.category_name
      ORDER BY quantitySold DESC
      LIMIT 5
    `),
    pool.query<InventoryAnalysisRow[]>(`
      SELECT
        p.product_id AS productId,
        p.product_name AS productName,
        COALESCE(stock.stockQuantity, 0) AS stockQuantity,
        p.reorder_point AS lowStockThreshold,
        p.base_unit AS unit,
        CASE
          WHEN COALESCE(stock.stockQuantity, 0) <= 0 THEN 'out'
          WHEN COALESCE(stock.stockQuantity, 0) <= p.reorder_point THEN 'low'
          ELSE 'normal'
        END AS status
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity_remaining_base) AS stockQuantity
        FROM product_batches
        WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
        GROUP BY product_id
      ) stock ON stock.product_id = p.product_id
      WHERE p.is_active = 1
      ORDER BY FIELD(status, 'out', 'low', 'normal'), stockQuantity ASC
      LIMIT 5
    `),
  ]);

  response.json({
    success: true,
    data: {
      period,
      summary: summaryResult[0][0],
      salesSeries: seriesResult[0],
      categoryShares: categoryResult[0],
      paymentBreakdown: paymentResult[0],
      bestSellers: sellersResult[0],
      inventoryAnalysis: inventoryResult[0],
    },
  });
}));
