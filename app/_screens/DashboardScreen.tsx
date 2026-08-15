"use client";

import { CircleDollarSign, CreditCard, ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type Period = "day" | "week" | "month";
type DashboardData = {
  period: Period;
  summary: { totalRevenue: number; orderCount: number; averageOrderValue: number; outstandingCredit: number };
  salesSeries: Array<{ label: string; total: number }>;
  categoryShares: Array<{ categoryName: string; total: number }>;
  paymentBreakdown: Array<{ method: "cash" | "qr" | "credit"; total: number }>;
  bestSellers: Array<{ productId: number; productName: string; categoryName: string; quantitySold: number; revenue: number }>;
  inventoryAnalysis: Array<{ productId: number; productName: string; stockQuantity: number; lowStockThreshold: number; unit: string; status: "out" | "low" | "normal" }>;
};

const periodLabels: Record<Period, string> = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน" };
const paymentLabels = { cash: "เงินสด", qr: "Thai QR / โอน", credit: "ขายเชื่อ" } as const;

function KpiCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note?: string; icon: typeof CircleDollarSign; tone: string }) {
  return <article className="kpi-card"><div className="kpi-label"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={19} /></span></div><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function BarChart({ rows }: { rows: DashboardData["salesSeries"] }) {
  const maximum = Math.max(...rows.map((row) => row.total), 1);
  return <div className="bar-chart">{rows.map((row) => <div className="bar-column" key={row.label}><div className="bar" style={{ height: `${Math.max(4, row.total / maximum * 100)}%` }} title={`${row.label} ฿${row.total.toLocaleString("th-TH")}`} /><span>{row.label.slice(5)}</span></div>)}</div>;
}

function CompactBarChart({ rows }: { rows: DashboardData["salesSeries"] }) {
  const maximum = Math.max(...rows.map((row) => row.total), 1);
  return <div className="hourly-chart">{rows.map((row, index) => <div className="hour-column" key={row.label}><div className={`hour-bar shade-${index % 4}`} style={{ height: `${Math.max(8, row.total / maximum * 100)}%` }} title={`฿${row.total.toLocaleString("th-TH")}`} /><span>{row.label.slice(5)}</span></div>)}</div>;
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-title"><h2>{title}</h2></div>{children}</section>;
}

export default function DashboardScreen() {
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch<DashboardData>(`/dashboard?period=${period}`)
      .then(setData)
      .catch((loadError) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [period]);

  const summary = data?.summary;
  const categoryTotal = data?.categoryShares.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const paymentTotal = data?.paymentBreakdown.reduce((sum, row) => sum + row.total, 0) ?? 0;

  return <AdminShell active="dashboard" contentClassName="dashboard-content">
    <div className="page-heading">
      <div><h1>แผงควบคุมผู้บริหาร (Executive Dashboard)</h1><p>สรุปจากข้อมูลการขายจริง ณ {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}</p></div>
      <div className="periods">{(Object.keys(periodLabels) as Period[]).map(item => <button className={period === item ? "selected" : ""} onClick={() => setPeriod(item)} key={item}>{periodLabels[item]}</button>)}</div>
    </div>
    {loading && <div className="api-message">กำลังคำนวณข้อมูล Dashboard...</div>}
    {error && <div className="api-message error">{error}</div>}
    <div className="kpi-grid">
      <KpiCard label="รายได้รวม" value={`฿${(summary?.totalRevenue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} note={`ยอดค้างชำระ ฿${(summary?.outstandingCredit ?? 0).toLocaleString("th-TH")}`} icon={CircleDollarSign} tone="mint" />
      <KpiCard label="จำนวนบิล" value={`${summary?.orderCount ?? 0} ใบ`} icon={CreditCard} tone="red" />
      <KpiCard label="ยอดเฉลี่ยต่อบิล" value={`฿${(summary?.averageOrderValue ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`} icon={ShoppingBasket} tone="blue" />
    </div>
    <div className="dashboard-grid">
      <Panel title="ผลการดำเนินยอดขาย" className="sales-panel">{data?.salesSeries.length ? <BarChart rows={data.salesSeries} /> : <div className="api-message">ยังไม่มียอดขายในช่วงนี้</div>}</Panel>
      <Panel title="สัดส่วนยอดขาย" className="share-panel">
        <div className="donut"><div><span>ยอดขายรวม</span><strong>฿{categoryTotal.toLocaleString("th-TH", { notation: "compact" })}</strong></div></div>
        <div className="legend">{data?.categoryShares.map((row, index) => <span key={row.categoryName}><i className={index % 3 === 0 ? "green" : index % 3 === 1 ? "sky" : "orange"} />{row.categoryName} <b>{categoryTotal ? Math.round(row.total / categoryTotal * 100) : 0}%</b></span>)}</div>
      </Panel>
      <Panel title="แนวโน้มยอดขายตามช่วงเวลา" className="hour-panel">{data?.salesSeries.length ? <CompactBarChart rows={data.salesSeries} /> : <div className="api-message">ยังไม่มีข้อมูลแนวโน้มยอดขาย</div>}</Panel>
      <Panel title="วิธีการชำระเงิน" className="payment-panel">{data?.paymentBreakdown.map((row) => <div className="payment" key={row.method}><span>{paymentLabels[row.method]} <b>฿{row.total.toLocaleString("th-TH", { notation: "compact" })}</b></span><div><i style={{ width: `${paymentTotal ? row.total / paymentTotal * 100 : 0}%` }} /></div></div>)}{!data?.paymentBreakdown.length && <div className="api-message">ยังไม่มีข้อมูลการชำระเงิน</div>}</Panel>
    </div>
    <Panel title="สินค้าขายดี" className="table-panel">
      <div className="table-wrap"><table><thead><tr>{["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "จำนวนที่ขาย", "รายได้", "% ยอดขาย"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data?.bestSellers.map((row, index) => <tr key={row.productId}><td>{index + 1}</td><td>{row.productName}</td><td><span className={`tag tag-${index % 3}`}>{row.categoryName}</span></td><td>{row.quantitySold.toLocaleString("th-TH")}</td><td>฿{row.revenue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td><td>{summary?.totalRevenue ? (row.revenue / summary.totalRevenue * 100).toFixed(1) : "0"}%</td></tr>)}</tbody></table></div>
    </Panel>
    <Panel title="วิเคราะห์สินค้าคงคลัง" className="table-panel">
      <div className="table-wrap"><table><thead><tr>{["ชื่อสินค้า", "คงเหลือ", "จุดแจ้งเตือน", "สถานะ", "แนะนำการดำเนินการ"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data?.inventoryAnalysis.map(row => <tr key={row.productId}><td>{row.productName}</td><td>{row.stockQuantity.toLocaleString("th-TH")} {row.unit}</td><td>{row.lowStockThreshold.toLocaleString("th-TH")} {row.unit}</td><td className={row.status !== "normal" ? "danger-text" : ""}>{row.status === "out" ? "สินค้าหมด" : row.status === "low" ? "สต็อกต่ำ" : "ปกติ"}</td><td className={row.status !== "normal" ? "danger-text" : ""}>{row.status === "out" ? "รับสินค้าเข้าทันที" : row.status === "low" ? "ควรเติมสินค้า" : "รักษาระดับสต็อก"}</td></tr>)}</tbody></table></div>
    </Panel>
  </AdminShell>;
}
