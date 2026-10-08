import { Router, Request, Response } from "express";
import { pool } from "../db/pool";

const productsRouter = Router();

// GET /api/suppliers
productsRouter.get("/suppliers", async (req: Request, res: Response) => {
  try {
    // ดึง id, ชื่อบริษัท, และสินค้าที่จำหน่าย (products)
    const [rows]: any = await pool.query(
      "SELECT id, supplier_name AS name, products FROM suppliers ORDER BY id DESC"
    );

    const formattedSuppliers = rows.map((supplier: any) => {
      let productList: string[] = [];

      // รองรับทั้งกรณี DB เก็บเป็น JSON String หรือ TEXT คั่นด้วยจุลภาค (Comma)
      if (typeof supplier.products === "string") {
        try {
          const parsed = JSON.parse(supplier.products);
          productList = Array.isArray(parsed) ? parsed : [supplier.products];
        } catch {
          productList = supplier.products.split(",").map((p: string) => p.trim());
        }
      } else if (Array.isArray(supplier.products)) {
        productList = supplier.products;
      }

      return {
        id: supplier.id,
        name: supplier.name,
        products: productList.filter(Boolean), // กรองค่าว่างออก
      };
    });

    res.json(formattedSuppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default productsRouter;