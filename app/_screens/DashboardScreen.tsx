"use client";

import { Banknote, ClipboardList, ExternalLink, WalletCards } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { apiFetch, errorMessage } from "../_lib/api";

type Period = "day" | "week" | "month" | "year";
type SeriesRow = { label: string; total: number; orderCount?: number };
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
};

const periodLabels: Record<Period, string> = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน", year: "รายปี" };
const paymentLabels = { cash: "เงินสด", qr: "Thai QR / โอน", credit: "ขายเชื่อ" } as const;
const chartColors = ["#10b981", "#39b8fd", "#ff7e2d", "#8b5cf6", "#ec4899"];

const monthsList = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatMoney(value: number | null | undefined) {
  return `฿${(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function formatSalesSharePercent(revenue: number, total: number) {
  if (revenue <= 0 || total <= 0) return "—";
  const percent = (revenue / total) * 100;
  return percent < 0.5 ? "<1%" : `${Math.round(percent)}%`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(0))}k`;
  return value.toLocaleString("th-TH");
}

function getChartStep(period: Period) {
  return period === "day" ? 1_000 : period === "week" ? 3_000 : period === "month" ? 10_000 : 50_000;
}

function KpiCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note?: string; icon: typeof Banknote; tone: string }) {
  return (
    <article className="kpi-card db-kpi-card">
      <div className="kpi-label db-kpi-label">
        <span>{label}</span>
        <span className={`kpi-icon ${tone}`}><Icon size={20} /></span>
      </div>
      {note && <small className="db-kpi-note">{note}</small>}
      <strong className="db-kpi-value">{value}</strong>
    </article>
  );
}

function BarChart({ rows, period, isYear, isDay }: { rows: SeriesRow[]; period: Period; isYear?: boolean; isDay?: boolean }) {
  let displayRows = rows;
  if (isYear) {
    const totalsByMonth = new Map<number, number>();
    for (const row of rows) {
      const monthMatch = row.label.match(/(?:^|[-/])(\d{1,2})$/);
      const month = monthMatch ? Number(monthMatch[1]) : monthsList.indexOf(row.label) + 1;
      if (month >= 1 && month <= 12) totalsByMonth.set(month, row.total);
    }
    displayRows = monthsList.map((mLabel) => {
      const month = monthsList.indexOf(mLabel) + 1;
      return { label: mLabel, total: totalsByMonth.get(month) ?? 0 };
    });
  }

  const maxVal = Math.max(...displayRows.map((row) => row.total), 0);
  const step = getChartStep(period);
  const maximum = Math.max(step * 4, Math.ceil(maxVal / step) * step);
  const ticks = Array.from({ length: maximum / step + 1 }, (_, index) => maximum - index * step);
  const stepCount = ticks.length - 1;

  return (
    <div className="sales-chart">
      <div className="chart-y-axis">
        {ticks.map((tick, index) => (
          <span key={index}>{formatCompact(tick)}</span>
        ))}
      </div>
      <div className="chart-plot">
        {ticks.slice(0, -1).map((_, index) => (
          <span
            className="chart-gridline"
            key={`grid-${index}`}
            style={{ top: `${(index / stepCount) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {displayRows.map((row) => (
          <div className="bar-column" key={row.label}>
            <div className="bar" style={{ height: `${Math.max(0, (row.total / maximum) * 100)}%` }} title={`${row.label} ${formatMoney(row.total)}`} />
          </div>
        ))}
      </div>
      <div className={`chart-x-axis${isDay ? " chart-x-axis-daily" : ""}`}>
        {displayRows.map((row) => (
          <span className="db-bar-label" key={row.label}>{row.label}</span>
        ))}
      </div>
    </div>
  );
}

function CompactBarChart({ rows }: { rows: SeriesRow[] }) {
  const rowsByHour = new Map(rows.map((row) => [row.label.slice(0, 2), row]));
  const hourlyRows = Array.from({ length: 24 }, (_, hour) => {
    const label = `${String(hour).padStart(2, "0")}:00`;
    return { label, orderCount: Number(rowsByHour.get(String(hour).padStart(2, "0"))?.orderCount) || 0 };
  });
  const maximum = Math.max(...hourlyRows.map((row) => row.orderCount), 1);
  return (
    <div className="hourly-chart">
      {hourlyRows.map((row) => {
        const billCount = row.orderCount;
        const ratio = billCount / maximum;
        const shadeClass = ratio >= 0.75 ? "shade-3" : ratio >= 0.4 ? "shade-2" : ratio >= 0.15 ? "shade-1" : "shade-0";
        const barHeight = billCount ? `${Math.max(8, ratio * 160)}px` : "0px";
        return (
          <div className="hour-column" key={row.label} style={{ "--bar-height": barHeight } as CSSProperties}>
            {billCount > 0 && <small className="hour-count-label">{billCount}</small>}
            <div className={`hour-bar ${shadeClass}`} style={{ height: barHeight }} title={`${row.label}: ${billCount} บิล`} />
            <span className="db-hour-label">{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function ViewAll({ href }: { href: string }) {
  return <a className="view-all" href={href}>ดูทั้งหมด <ExternalLink size={13} /></a>;
}

function DensityLegend() {
  return (
    <div className="density-legend">
      <span>น้อย</span>
      {[0, 1, 2, 3].map((shade) => <i className={`shade-${shade}`} key={shade} />)}
      <span>มาก</span>
    </div>
  );
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
  const shares = data?.categoryShares ?? [];
  const categoryTotal = shares.reduce((sum, row) => sum + row.total, 0);
  const paymentTotal = data?.paymentBreakdown.reduce((sum, row) => sum + row.total, 0) ?? 0;

  let shareOffset = 0;
  const donutBackground = shares.length
    ? `conic-gradient(${shares.map((row, index) => {
        const start = shareOffset;
        const pct = categoryTotal ? (row.total / categoryTotal) * 100 : 0;
        shareOffset += pct;
        const color = chartColors[index % chartColors.length];
        return `${color} ${start}\%${shareOffset}%`;
      }).join(", ")})`
    : "#e8eefb";

  return (
    <AdminShell active="dashboard" contentClassName="dashboard-content">
      <div className="page-heading dashboard-heading">
        <div>
          <h1>แดชบอร์ด</h1>
          <p>สรุปข้อมูลภาพรวมประจำวันที่ {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}</p>
        </div>
        <div className="periods">
          {(Object.keys(periodLabels) as Period[]).map((item) => (
            <button className={period === item ? "selected" : ""} onClick={() => setPeriod(item)} key={item}>
              {periodLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="api-message">กำลังคำนวณข้อมูล Dashboard...</div>}
      {error && <div className="api-message error">{error}</div>}

      <div className="kpi-grid">
        <KpiCard label="รายได้รวมทั้งหมด" value={formatMoney(totalRevenue)} note={`จำนวนบิล: ${(summary?.orderCount ?? 0).toLocaleString("th-TH")} ใบ`} icon={Banknote} tone="mint" />
        <KpiCard label="รายจ่าย" value={formatMoney(totalExpense)} icon={WalletCards} tone="red" />
        <KpiCard label="รายได้สุทธิ" value={formatMoney(netIncome)} icon={ClipboardList} tone="blue" />
      </div>

      <div className="dashboard-grid">
        <Panel title="ผลการดำเนินยอดขาย" className="sales-panel">
          <BarChart rows={data?.salesSeries ?? []} period={period} isYear={period === "year"} isDay={period === "day"} />
        </Panel>

        <Panel title="สัดส่วนยอดขาย" className="share-panel">
          <div className="donut" style={{ "--donut-background": donutBackground } as CSSProperties}>
            <div><span>ยอดขายรวม</span><strong>{formatMoney(categoryTotal)}</strong></div>
          </div>
          <div className="legend">
            {shares.map((row, index) => {
              const pct = categoryTotal ? Math.round((row.total / categoryTotal) * 100) : 0;
              return (
                <div key={row.categoryName} className="db-share-legend-item">
                  <div className="db-share-legend-left">
                    <i style={{ background: chartColors[index % chartColors.length] }} />
                    <span>{row.categoryName}</span>
                  </div>
                  <div className="db-share-legend-right">
                    <span className="db-share-green-text">{pct}%</span>
                    <span className="db-share-green-text">{formatMoney(row.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="ความหนาแน่นรายชั่วโมง" action={<DensityLegend />} className="hour-panel">
          {data?.hourlySeries?.length ? <CompactBarChart rows={data.hourlySeries} /> : <div className="api-message">ยังไม่มีข้อมูลรายชั่วโมง</div>}
        </Panel>

        <Panel title="วิธีการชำระเงิน" className="payment-panel">
          {data?.paymentBreakdown.map((row) => (
            <div className="payment" key={row.method}>
              <span>{paymentLabels[row.method]} <b>{formatMoney(row.total)}</b></span>
              <div><i style={{ width: `${paymentTotal ? (row.total / paymentTotal) * 100 : 0}%` }} /></div>
            </div>
          ))}
          {!data?.paymentBreakdown.length && <div className="api-message">ยังไม่มีข้อมูลการชำระเงิน</div>}
        </Panel>
      </div>

      <Panel title="สินค้าขายดี" action={<ViewAll href="/best-sellers?period=month" />} className="table-panel dashboard-table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "จำนวนที่ขายแล้ว", "รายได้", "% ยอดขาย"].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.bestSellers.slice(0, 5).map((row, index) => (
                <tr key={row.productId}>
                  <td>{index + 1}</td>
                  <td>{row.productName}</td>
                  <td><span className={`tag tag-${index % 3}`}>{row.categoryName}</span></td>
                  <td>{row.quantitySold.toLocaleString("th-TH", { maximumFractionDigits: 1 })} {row.unit ?? ""}</td>
                  <td>{formatMoney(row.revenue)}</td>
                  <td>{formatSalesSharePercent(row.revenue, totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}
