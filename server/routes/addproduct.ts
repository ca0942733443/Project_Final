import { Router, Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { asyncHandler } from "../utils/async-handler";

export const productsRouter = Router();

// 🟢 PUT /api/products/:id (แก้ปัญหา 404 ของ PUT /api/products/55)
productsRouter.put(
  "/:id",
  asyncHandler(async (request: Request, response: Response) => {
    const { id } = request.params;
    const body = request.body;

    const productName = body.product_name || body.name;
    const categoryId = body.category_id || body.categoryId;
    const subCategoryId = body.sub_category_id || body.subCategoryId || null;
    const sku = body.sku;
    const barcode = body.barcode;
    const description = body.description || null;
    const imageUrl = body.image_url || body.imageUrl || null;
    const costPrice = body.cost_price ?? body.costPrice ?? 0;
    const price = body.price ?? 0;
    const baseUnit = body.base_unit || body.unit || "ชิ้น";
    const stockQuantity = body.stockQuantity ?? body.stock ?? 0;
    const reorderPoint = body.reorder_point ?? body.lowStockThreshold ?? 5;

    await pool.query(
      `UPDATE products 
       SET 
        product_name = ?, 
        category_id = ?, 
        sub_category_id = ?, 
        sku = ?, 
        barcode = ?, 
        description = ?, 
        image_url = ?, 
        cost_price = ?, 
        price = ?, 
        base_unit = ?, 
        stockQuantity = ?, 
        reorder_point = ?
       WHERE product_id = ?`,
      [
        productName,
        categoryId,
        subCategoryId,
        sku,
        barcode,
        description,
        imageUrl,
        costPrice,
        price,
        baseUnit,
        stockQuantity,
        reorderPoint,
        id,
      ]
    );

    response.json({
      success: true,
      message: "อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว",
    });
  })
);