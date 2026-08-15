"use client";

import {
  Bell,
  Boxes,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Search,
  Settings,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type AdminSection =
  | "dashboard"
  | "pos"
  | "inventory"
  | "recommendations"
  | "customers"
  | "employees"
  | "settings"
  | "history"
  | "notifications";

const navigation = [
  ["dashboard", "แดชบอร์ดสรุปรายได้", LayoutDashboard, "/"],
  ["pos", "หน้าจอขายหน้าร้าน", Store, "/pos"],
  ["inventory", "คลังสินค้า & สต็อกสินค้า", Boxes, "/inventory"],
  ["recommendations", "ระบบแนะนำการสั่งซื้อ", Lightbulb, "/recommendations"],
  ["customers", "บัญชีขายเชื่อ & ลูกค้าประจำ", WalletCards, "/customers"],
  ["employees", "จัดการบัญชีพนักงาน", Users, "/employees"],
] as const;

export default function AdminShell({
  active,
  children,
  contentClassName = "",
}: {
  active: AdminSection;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ fullName: string; role: "owner" | "cashier" | "stock" } | null>(null);
  const terminalTitle = "POS Terminal";
  const roleLabel = user?.role === "cashier" ? "แคชเชียร์" : user?.role === "stock" ? "พนักงานคลัง" : "เจ้าของร้าน";

  useEffect(() => {
    const storedUser = window.sessionStorage.getItem("authUser");
    if (!storedUser) return;
    try { setUser(JSON.parse(storedUser)); } catch { window.sessionStorage.removeItem("authUser"); }
  }, []);

  const logout = () => {
    window.sessionStorage.removeItem("authToken");
    window.sessionStorage.removeItem("authUser");
    window.location.assign("/login");
  };

  const profileButton = <button className="profile" onClick={logout} title="ออกจากระบบ" type="button"><div className="avatar">{user?.fullName.charAt(0) ?? "ก"}</div><div><strong>{user?.fullName ?? "กัปตันอูด้ง"}</strong><span>{roleLabel}</span></div><ChevronDown size={14} /></button>;

  return (
    <div className="app-shell">
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู" />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <strong>CAPTAIN GAI SOD</strong>
          <span>Main Branch</span>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={20} /></button>
        </div>
        <nav>
          {navigation.map(([id, label, Icon, href]) => (
            <Link className={active === id ? "active" : ""} href={href} key={id} onClick={() => setMenuOpen(false)}>
              <Icon size={19} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className={`settings ${active === "settings" ? "active-setting" : ""}`} href="/settings"><Settings size={18} /><span>ตั้งค่า</span></Link>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu /></button>
          <strong className="terminal">{terminalTitle}</strong>
          <label className="search"><Search size={15} /><input aria-label="ค้นหา" placeholder={active === "customers" ? "ค้นหารายชื่อลูกค้า..." : "ค้นหา..."} /></label>
          <Link className={`icon-button ${active === "notifications" ? "header-active" : ""}`} aria-label="การแจ้งเตือน" href="/notifications"><Bell size={17} /></Link>
          <Link className={`icon-button ${active === "history" ? "header-active" : ""}`} aria-label="ประวัติ" href="/history"><Clock3 size={17} /></Link>
          {profileButton}
        </header>
        <main className={`content subpage-content section-${active} ${contentClassName}`}>{children}</main>
      </div>
    </div>
  );
}
