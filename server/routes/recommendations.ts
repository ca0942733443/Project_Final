import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

interface SalesRecommendationRow extends RowDataPacket {
  productId: number;
  productName: string;
  categoryName: string;
  unit: string;
  weeklySalesQuantity: number;
  weeklyRevenue: number;
  currentStock: number;
  reorderPoint: number;
}

interface CustomerSummaryRow extends RowDataPacket {
  customerId: number;
  fullName: string;
  phone: string | null;
  carPlate: string | null;
  orderCount: number;
  totalSpent: number;
  lastPurchaseAt: Date | string;
  daysSinceLastPurchase: number;
}

interface CustomerProductRow extends RowDataPacket {
  customerId: number;
  productId: number;
  productName: string;
  unit: string;
  quantityPurchased: number;
  lastPurchasedAt: Date | string;
}

export const recommendationsRouter = Router();

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(400, `ค่าต้องเป็นจำนวนเต็มระหว่าง ${minimum} ถึง ${maximum}`);
  }
  return parsed;
}

function isoDate(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

recommendationsRouter.get("/", asyncHandler(async (request, response) => {
  const inactivityDays = boundedInteger(request.query.inactivityDays, 3, 2, 365);
  const productLimit = boundedInteger(request.query.productLimit, 50, 1, 200);
  const customerLimit = boundedInteger(request.query.customerLimit, 100, 1, 500);

  const [salesRows] = await pool.query<SalesRecommendationRow[]>(`
    SELECT
      p.product_id AS productId,
      p.product_name AS productName,
      c.category_name AS categoryName,
      p.base_unit AS unit,
      COALESCE(SUM(CASE WHEN s.sale_id IS NOT NULL THEN si.quantity_base ELSE 0 END), 0) AS weeklySalesQuantity,
      COALESCE(SUM(CASE WHEN s.sale_id IS NOT NULL THEN si.line_total ELSE 0 END), 0) AS weeklyRevenue,
      COALESCE(stock.stockQuantity, 0) AS currentStock,
      p.reorder_point AS reorderPoint
    FROM products p
    INNER JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN product_units pu ON pu.product_id = p.product_id
    LEFT JOIN sale_items si ON si.product_unit_id = pu.product_unit_id
    LEFT JOIN sales s ON s.sale_id = si.sale_id
      AND s.sale_status <> 'CANCELLED'
      AND s.sold_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    LEFT JOIN (
      SELECT product_id, SUM(quantity_remaining_base) AS stockQuantity
      FROM product_batches
      WHERE status IN ('ACTIVE', 'NEAR_EXPIRY')
      GROUP BY product_id
    ) stock ON stock.product_id = p.product_id
    WHERE p.is_active = 1
    GROUP BY
      p.product_id, p.product_name, c.category_name, p.base_unit,
      stock.stockQuantity, p.reorder_point
    HAVING weeklySalesQuantity > 0 OR currentStock < reorderPoint
    ORDER BY weeklySalesQuantity DESC, weeklyRevenue DESC, p.product_name ASC
    LIMIT ?
  `, [productLimit]);

  const [customerRows] = await pool.query<CustomerSummaryRow[]>(`
    SELECT
      c.customer_id AS customerId,
      c.full_name AS fullName,
      c.phone,
      c.car_plate AS carPlate,
      COUNT(DISTINCT s.sale_id) AS orderCount,
      COALESCE(SUM(s.total_amount), 0) AS totalSpent,
      MAX(s.sold_at) AS lastPurchaseAt,
      TIMESTAMPDIFF(DAY, MAX(s.sold_at), NOW()) AS daysSinceLastPurchase
    FROM customers c
    INNER JOIN sales s ON s.customer_id = c.customer_id
      AND s.sale_status <> 'CANCELLED'
    WHERE c.is_active = 1
    GROUP BY c.customer_id, c.full_name, c.phone, c.car_plate
    HAVING MAX(s.sold_at) < DATE_SUB(NOW(), INTERVAL ${inactivityDays} DAY)
    ORDER BY lastPurchaseAt ASC, c.full_name ASC
    LIMIT ?
  `, [customerLimit]);

  const customerIds = customerRows.map((customer) => customer.customerId);
  let customerProductRows: CustomerProductRow[] = [];
  if (customerIds.length > 0) {
    const placeholders = customerIds.map(() => "?").join(",");
    const [rows] = await pool.query<CustomerProductRow[]>(`
      SELECT
        s.customer_id AS customerId,
        p.product_id AS productId,
        p.product_name AS productName,
        p.base_unit AS unit,
        SUM(si.quantity_base) AS quantityPurchased,
        MAX(s.sold_at) AS lastPurchasedAt
      FROM sales s
      INNER JOIN sale_items si ON si.sale_id = s.sale_id
      INNER JOIN product_units pu ON pu.product_unit_id = si.product_unit_id
      INNER JOIN products p ON p.product_id = pu.product_id
      WHERE s.customer_id IN (${placeholders})
        AND s.sale_status <> 'CANCELLED'
      GROUP BY s.customer_id, p.product_id, p.product_name, p.base_unit
      ORDER BY s.customer_id ASC, quantityPurchased DESC, lastPurchasedAt DESC
    `, customerIds);
    customerProductRows = rows;
  }

  const productByCustomer = new Map<number, CustomerProductRow[]>();
  for (const row of customerProductRows) {
    const products = productByCustomer.get(row.customerId) ?? [];
    if (products.length < 5) products.push(row);
    productByCustomer.set(row.customerId, products);
  }

  const sales = salesRows.map((row) => {
    const weeklySalesQuantity = Number(row.weeklySalesQuantity) || 0;
    const currentStock = Number(row.currentStock) || 0;
    const reorderPoint = Number(row.reorderPoint) || 0;
    const targetStock = Math.ceil(weeklySalesQuantity + reorderPoint);
    return {
      productId: row.productId,
      productName: row.productName,
      categoryName: row.categoryName,
      unit: row.unit,
      weeklySalesQuantity,
      weeklyRevenue: Number(row.weeklyRevenue) || 0,
      currentStock,
      reorderPoint,
      targetStock,
      suggestedQuantity: Math.max(0, targetStock - currentStock),
    };
  });

  const customers = customerRows.map((row) => ({
    customerId: row.customerId,
    fullName: row.fullName,
    phone: row.phone,
    carPlate: row.carPlate,
    orderCount: Number(row.orderCount) || 0,
    totalSpent: Number(row.totalSpent) || 0,
    lastPurchaseAt: isoDate(row.lastPurchaseAt),
    daysSinceLastPurchase: Number(row.daysSinceLastPurchase) || 0,
    products: (productByCustomer.get(row.customerId) ?? []).map((product) => ({
      productId: product.productId,
      productName: product.productName,
      unit: product.unit,
      quantityPurchased: Number(product.quantityPurchased) || 0,
      lastPurchasedAt: isoDate(product.lastPurchasedAt),
    })),
  }));

  response.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      salesWindowDays: 7,
      inactivityDays,
      sales,
      customers,
    },
  });
}));
