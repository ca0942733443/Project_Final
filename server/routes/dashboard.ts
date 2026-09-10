import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface SummaryRow extends RowDataPacket {
  totalRevenue: number;
  totalExpense: number;
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
  unit: string;
  revenue: number;
}

interface InventoryAnalysisRow extends RowDataPacket {
  productId: number;
  productName: string;
  salesRevenue: number;
}

export const dashboardRouter = Router();

const weekdayLabels = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];

function completeSalesSeries(period: string, rows: SeriesRow[]) {
  const totals = new Map(rows.map((row) => [row.label, Number(row.total) || 0]));
  const labels = period === "day"
    ? Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`)
    : period === "week"
      ? weekdayLabels
      : Array.from({ length: 5 }, (_, index) => `อาทิตย์ที่ ${index + 1}`);

  return labels.map((label) => ({ label, total: totals.get(label) ?? 0 }));
}

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
    : period === "week"
      ? "ELT(WEEKDAY(s.sold_at) + 1, 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์')"
      : "CONCAT('อาทิตย์ที่ ', CEIL(DAYOFMONTH(s.sold_at) / 7))";
  const salesPeriodCondition = `s.sale_status <> 'CANCELLED' AND s.sold_at >= ${startExpression}`;

  const [summaryResult, seriesResult, hourlyResult, categoryResult, paymentResult, sellersResult, inventoryResult] = await Promise.all([
    pool.query<SummaryRow[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN ${salesPeriodCondition} THEN s.total_amount ELSE 0 END), 0) AS totalRevenue,
        COALESCE((
          SELECT SUM(gri.quantity_base * gri.unit_cost)
          FROM goods_receipt_items gri
          INNER JOIN goods_receipts gr ON gr.receipt_id = gri.receipt_id
          WHERE gr.status = 'CONFIRMED' AND gr.received_at >= ${startExpression}
        ), 0) AS totalExpense,
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
    pool.query<SeriesRow[]>(`
      SELECT DATE_FORMAT(s.sold_at, '%H:00') AS label, SUM(s.total_amount) AS total
      FROM sales s
      WHERE ${salesPeriodCondition}
      GROUP BY HOUR(s.sold_at), label
      ORDER BY HOUR(s.sold_at) ASC
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
        SUM(si.quantity_base) AS quantitySold,
        p.base_unit AS unit,
        SUM(si.line_total) AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.sale_id = si.sale_id
      INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
      INNER JOIN products p ON p.product_id = pu.product_id
      INNER JOIN categories c ON c.category_id = p.category_id
      WHERE ${salesPeriodCondition}
      GROUP BY p.product_id, p.product_name, c.category_name, p.base_unit
      ORDER BY revenue DESC
      LIMIT 5
    `),
    pool.query<InventoryAnalysisRow[]>(`
      SELECT
        p.product_id AS productId,
        p.product_name AS productName,
        COALESCE(period_sales.salesRevenue, 0) AS salesRevenue
      FROM products p
      LEFT JOIN (
        SELECT pu.product_id, SUM(si.line_total) AS salesRevenue
        FROM sale_items si
        INNER JOIN sales s ON s.sale_id = si.sale_id
        INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
        WHERE ${salesPeriodCondition}
        GROUP BY pu.product_id
      ) period_sales ON period_sales.product_id = p.product_id
      WHERE p.is_active = 1
      ORDER BY salesRevenue DESC, p.product_name ASC
      LIMIT 3
    `),
  ]);

  const summary = summaryResult[0][0];
  const inventoryAnalysis = inventoryResult[0].map((row, index, rows) => {
    const status = index === 0 ? "fast" : index === rows.length - 1 && rows.length > 1 ? "slow" : "normal";
    return {
      ...row,
      status,
      action: status === "fast" ? "รักษาระดับสต็อกให้สูง" : status === "slow" ? "ทำโปรโมชั่น ลดล้างสต็อก" : "-",
    };
  });

  response.json({
    success: true,
    data: {
      period,
      summary: { ...summary, netIncome: summary.totalRevenue - summary.totalExpense },
      salesSeries: completeSalesSeries(period, seriesResult[0]),
      hourlySeries: hourlyResult[0],
      categoryShares: categoryResult[0],
      paymentBreakdown: paymentResult[0],
      bestSellers: sellersResult[0],
      inventoryAnalysis,
    },
  });
}));
