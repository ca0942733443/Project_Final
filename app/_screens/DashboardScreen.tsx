"use client";

import { Banknote, ClipboardList, ExternalLink, WalletCards } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type Period = "day" | "week" | "month";
type SeriesRow = { label: string; total: number };
type DashboardData = {
  period: Period;
  summary: {
    totalRevenue: number;
    totalExpense: number;
    netIncome: number;
    orderCount: number;
    averageOrderValue: number;
    outstandingCredit: number;
  };
  salesSeries: SeriesRow[];
  hourlySeries: SeriesRow[];
  categoryShares: Array<{ categoryName: string; total: number }>;
  paymentBreakdown: Array<{ method: "cash" | "qr" | "credit"; total: number }>;
  bestSellers: Array<{ productId: number; productName: string; categoryName: string; quantitySold: number; unit: string; revenue: number }>;
  inventoryAnalysis: Array<{
    productId: number;
    productName: string;
    salesRevenue: number;
    status: "fast" | "normal" | "slow";
    action: string;
  }>;
};

const periodLabels: Record<Period, string> = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน" };
const paymentLabels = { cash: "เงินสด", qr: "Thai QR / โอน", credit: "ขายเชื่อ" } as const;
const chartColors = ["#10b981", "#39b8fd", "#ff7e2d"];

function formatMoney(value: number | null | undefined) {
  return `฿${(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return value.toLocaleString("th-TH");
}

function getChartMaximum(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function KpiCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note?: string; icon: typeof Banknote; tone: string }) {
  return <article className="kpi-card">
    <div className="kpi-label"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={20} /></span></div>
    {note && <small>{note}</small>}
    <strong>{value}</strong>
  </article>;
}

function BarChart({ rows }: { rows: SeriesRow[] }) {
  const maximum = getChartMaximum(Math.max(...rows.map((row) => row.total), 0));
  const ticks = Array.from({ length: 5 }, (_, index) => maximum - (maximum / 4) * index);

  return <div className="sales-chart">
    <div className="chart-y-axis">{ticks.map((tick) => <span key={tick}>{formatCompact(tick)}</span>)}</div>
    <div className="chart-plot">
      {rows.map((row) => <div className="bar-column" key={row.label}>
        <div className="bar" style={{ height: `${Math.max(3, row.total / maximum * 100)}%` }} title={`${row.label} ${formatMoney(row.total)}`} />
        <span>{row.label}</span>
      </div>)}
    </div>
  </div>;
}

function CompactBarChart({ rows }: { rows: SeriesRow[] }) {
  const maximum = Math.max(...rows.map((row) => row.total), 1);
  return <div className="hourly-chart">{rows.map((row, index) => <div className="hour-column" key={row.label}>
    <div className={`hour-bar shade-${index % 4}`} style={{ height: `${Math.max(8, row.total / maximum * 100)}%` }} title={formatMoney(row.total)} />
    <span>{row.label}</span>
  </div>)}</div>;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    <div className="panel-title"><h2>{title}</h2>{action}</div>
    {children}
  </section>;
}

function ViewAll({ href }: { href: string }) {
  return <a className="view-all" href={href}>ดูทั้งหมด <ExternalLink size={13} /></a>;
}

function DensityLegend() {
  return <div className="density-legend"><span>น้อย</span>{[0, 1, 2, 3].map((shade) => <i className={`shade-${shade}`} key={shade} />)}<span>มาก</span></div>;
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
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const netIncome = summary?.netIncome ?? totalRevenue - totalExpense;
  const shares = data?.categoryShares.slice(0, 3) ?? [];
  const categoryTotal = shares.reduce((sum, row) => sum + row.total, 0);
  const paymentTotal = data?.paymentBreakdown.reduce((sum, row) => sum + row.total, 0) ?? 0;
  let shareOffset = 0;
  const donutBackground = shares.length
    ? `conic-gradient(${shares.map((row, index) => {
      const start = shareOffset;
      shareOffset += categoryTotal ? row.total / categoryTotal * 100 : 0;
      return `${chartColors[index]} ${start}% ${shareOffset}%`;
    }).join(", ")})`
    : "#e8eefb";

  return <AdminShell active="dashboard" contentClassName="dashboard-content">
    <div className="page-heading dashboard-heading">
      <div><h1>แดชบอร์ด (Dashboard)</h1><p>สรุปข้อมูลภาพรวมประจำวันที่ {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}</p></div>
      <div className="periods">{(Object.keys(periodLabels) as Period[]).map((item) => <button className={period === item ? "selected" : ""} onClick={() => setPeriod(item)} key={item}>{periodLabels[item]}</button>)}</div>
    </div>
    {loading && <div className="api-message">กำลังคำนวณข้อมูล Dashboard...</div>}
    {error && <div className="api-message error">{error}</div>}
    <div className="kpi-grid">
      <KpiCard label="รายได้รวมทั้งหมด" value={formatMoney(totalRevenue)} note={`จำนวนบิล: ${(summary?.orderCount ?? 0).toLocaleString("th-TH")} ใบ`} icon={Banknote} tone="mint" />
      <KpiCard label="รายจ่าย" value={formatMoney(totalExpense)} icon={WalletCards} tone="red" />
      <KpiCard label="รายได้สุทธิ" value={formatMoney(netIncome)} icon={ClipboardList} tone="blue" />
    </div>
    <div className="dashboard-grid">
      <Panel title="ผลการดำเนินยอดขาย" className="sales-panel">{data?.salesSeries.length ? <BarChart rows={data.salesSeries} /> : <div className="api-message">ยังไม่มียอดขายในช่วงนี้</div>}</Panel>
      <Panel title="สัดส่วนยอดขาย" className="share-panel">
        <div className="donut" style={{ "--donut-background": donutBackground } as CSSProperties}><div><span>ยอดขายรวม</span><strong>{formatMoney(categoryTotal)}</strong></div></div>
        <div className="legend">{shares.map((row, index) => <span key={row.categoryName}><i style={{ background: chartColors[index] }} />{row.categoryName} <b>{categoryTotal ? Math.round(row.total / categoryTotal * 100) : 0}%</b></span>)}</div>
      </Panel>
      <Panel title="ความหนาแน่นรายชั่วโมง" action={<DensityLegend />} className="hour-panel">{data?.hourlySeries?.length ? <CompactBarChart rows={data.hourlySeries} /> : <div className="api-message">ยังไม่มีข้อมูลรายชั่วโมง</div>}</Panel>
      <Panel title="วิธีการชำระเงิน" className="payment-panel">{data?.paymentBreakdown.map((row) => <div className="payment" key={row.method}><span>{paymentLabels[row.method]} <b>{formatMoney(row.total)}</b></span><div><i style={{ width: `${paymentTotal ? row.total / paymentTotal * 100 : 0}%` }} /></div></div>)}{!data?.paymentBreakdown.length && <div className="api-message">ยังไม่มีข้อมูลการชำระเงิน</div>}</Panel>
    </div>
    <Panel title="สินค้าขายดี" action={<ViewAll href="/products" />} className="table-panel dashboard-table">
      <div className="table-wrap"><table><thead><tr>{["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "น้ำหนักที่ขายแล้ว", "รายได้", "% ยอดขาย"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{data?.bestSellers.slice(0, 3).map((row, index) => <tr key={row.productId}><td>{index + 1}</td><td>{row.productName}</td><td><span className={`tag tag-${index % 3}`}>{row.categoryName}</span></td><td>{row.quantitySold.toLocaleString("th-TH", { maximumFractionDigits: 1 })} {row.unit ?? ""}</td><td>{formatMoney(row.revenue)}</td><td>{totalRevenue ? Math.round(row.revenue / totalRevenue * 100) : 0} %</td></tr>)}</tbody></table></div>
    </Panel>
    <Panel title="วิเคราะห์สินค้าคงคลัง" action={<ViewAll href="/inventory" />} className="table-panel dashboard-table inventory-analysis-table">
      <div className="table-wrap"><table><thead><tr>{["ชื่อสินค้า", "ยอดขาย", "สถานะ", "แนะนำการดำเนินการ"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{data?.inventoryAnalysis.slice(0, 3).map((row) => <tr key={row.productId}><td>{row.productName}</td><td>{formatMoney(row.salesRevenue)}</td><td className={row.status === "fast" ? "success-text" : row.status === "slow" ? "danger-text" : ""}>{row.status === "fast" ? "ขายดีมาก" : row.status === "slow" ? "ขายช้า" : "ขายดี"}</td><td className={row.status === "slow" ? "danger-text" : ""}>{row.action ?? "-"}</td></tr>)}</tbody></table></div>
    </Panel>
  </AdminShell>;
}
