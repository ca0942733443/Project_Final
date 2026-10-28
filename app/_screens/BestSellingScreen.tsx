"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type Period = "day" | "week" | "month" | "year";
type BestSeller = {
  productId: number;
  productName: string;
  categoryName: string;
  quantitySold: number;
  unit: string;
  revenue: number;
};
type DashboardData = {
  summary: { totalRevenue: number };
  bestSellers: BestSeller[];
};

const periodLabels: Record<Period, string> = {
  day: "รายวัน",
  week: "รายสัปดาห์",
  month: "รายเดือน",
  year: "รายปี",
};

function formatMoney(value: number) {
  return `฿${(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export default function BestSellingScreen() {
  const [period, setPeriod] = useState<Period>("week");
  const [rows, setRows] = useState<BestSeller[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadData = useCallback(async (selectedPeriod: Period) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<DashboardData>(`/dashboard?period=${selectedPeriod}`);
      setRows([...(data.bestSellers ?? [])].sort((a, b) => Number(b.revenue) - Number(a.revenue)));
      setTotalRevenue(Number(data.summary?.totalRevenue) || 0);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestedPeriod = new URLSearchParams(window.location.search).get("period");
    const initialPeriod = requestedPeriod && requestedPeriod in periodLabels ? requestedPeriod as Period : "week";
    setPeriod(initialPeriod);
    void loadData(initialPeriod);
  }, [loadData]);

  const selectPeriod = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    window.history.replaceState(null, "", `/best-sellers?period=${nextPeriod}`);
    void loadData(nextPeriod);
  };

  return (
    <AdminShell active="dashboard">
      <div className="subpage-heading">
        <div className="best-sellers-heading-copy">
          <button
            type="button"
            onClick={() => router.back()}
            className="sup-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>สินค้าขายดีทั้งหมด</h1>
            <p>สินค้าทุกรายการที่ขายได้ในช่วง{periodLabels[period]} เรียงตามรายได้</p>
          </div>
        </div>
        <div className="periods">
          {(Object.keys(periodLabels) as Period[]).map((item) => (
            <button className={period === item ? "selected" : ""} onClick={() => selectPeriod(item)} key={item}>
              {periodLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="api-message">กำลังโหลดสินค้าขายดี...</div>}
      {error && <div className="api-message error">{error}</div>}

      <section className="panel table-panel dashboard-table best-sellers-panel">
        <div className="panel-title">
          <h2>รายการสินค้าขายดี</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "จำนวนที่ขายแล้ว", "รายได้", "% ยอดขาย"].map((label) => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {!loading && !error && rows.map((row, index) => (
                <tr key={row.productId}>
                  <td>{index + 1}</td>
                  <td>{row.productName}</td>
                  <td>{row.categoryName}</td>
                  <td>{Number(row.quantitySold).toLocaleString("th-TH", { maximumFractionDigits: 1 })} {row.unit ?? ""}</td>
                  <td>{formatMoney(Number(row.revenue) || 0)}</td>
                  <td>{totalRevenue > 0 && Number(row.revenue) > 0
                    ? ((Number(row.revenue) / totalRevenue) * 100 < 0.5
                      ? "<1%"
                      : `${Math.round((Number(row.revenue) / totalRevenue) * 100)}%`)
                    : "—"}</td>
                </tr>
              ))}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={6}>ยังไม่มีข้อมูลสินค้าที่ขายในช่วงเวลานี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
