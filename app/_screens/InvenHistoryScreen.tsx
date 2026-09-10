"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { PageTitle } from "../_components/PageElements";
import { apiFetch, errorMessage } from "../_lib/api";

type InventoryMovement = {
  id: number;
  productName: string;
  movementType: "opening" | "purchase" | "adjustment" | "return" | "sale";
  quantity: number;
  note: string | null;
  createdAt: string;
};

export default function InvenHistoryScreen() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<InventoryMovement[]>("/inventory/movements");
      setMovements(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  // คำนวณ Pagination
  const totalPages = Math.ceil(movements.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovements = movements.slice(startIndex, startIndex + itemsPerPage);

  return (
    <AdminShell active="inventory">
      <PageTitle
        title="ประวัติการเคลื่อนย้ายสินค้าทั้งหมด"
        subtitle="รายการประวัติการรับเข้า ขายออก และปรับปรุงสต็อกทั้งหมด"
        action={
          <Link 
            href="/inventory" 
            className="secondary-button" 
            style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
          >
            <ArrowLeft size={18} /> ย้อนกลับ
          </Link>
        }
      />

      <section className="data-card inventory-stock-card" style={{ padding: "0", overflow: "hidden" }}>
        {loading && <div className="api-message" style={{ padding: "16px" }}>กำลังโหลดประวัติ...</div>}
        {error && <div className="api-message error" style={{ padding: "16px" }}>{error}</div>}

        {!loading && (
          <>
            {/* รายการประวัติ */}
            <div className="movement-list" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {paginatedMovements.map((movement, index) => (
                <article className={`movement-item movement-${index % 2}`} key={movement.id}>
                  <span className="movement-icon">⇥</span>
                  <div>
                    <strong>
                      {movement.movementType === "purchase"
                        ? "รับเข้าคลัง"
                        : movement.movementType === "sale"
                        ? "ขายออกหน้าร้าน"
                        : "ย้ายไปหน้าร้าน"}
                      : {movement.productName}
                    </strong>
                    <small>{movement.note ?? `อัปเดตเมื่อ ${new Date(movement.createdAt).toLocaleString("th-TH")}`}</small>
                  </div>
                  <b className={movement.quantity < 0 ? "danger-text" : ""}>
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity.toLocaleString("th-TH")} หน่วย
                  </b>
                </article>
              ))}
            </div>

            <div 
              className="pagination" 
              style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "12px 16px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0"
              }}
            >
              <span style={{ fontSize: "14px", color: "#64748b" }}>
                แสดง {movements.length ? startIndex + 1 : 0} ถึง {Math.min(startIndex + itemsPerPage, movements.length)} จาก {movements.length} รายการ
              </span>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                  type="button"
                  aria-label="หน้าก่อนหน้า"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  style={{
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: currentPage === 1 ? "#cbd5e1" : "#475569",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "18px",
                    fontWeight: "bold"
                  }}
                >
                  ‹
                </button>

                <span 
                  style={{ 
                    fontSize: "14px", 
                    fontWeight: "700", 
                    color: "#064e3b", 
                    padding: "0 4px",
                    userSelect: "none"
                  }}
                >
                  {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  aria-label="หน้าถัดไป"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  style={{
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: currentPage >= totalPages ? "#cbd5e1" : "#475569",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                    fontSize: "18px",
                    fontWeight: "bold"
                  }}
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}