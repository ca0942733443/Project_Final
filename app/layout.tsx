import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAPTAIN GAI SOD | Executive Dashboard",
  description: "ระบบบริหารจัดการร้าน CAPTAIN GAI SOD",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
