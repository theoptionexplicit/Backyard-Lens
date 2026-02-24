import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Mosaic",
  description: "Generate QR codes filled with image fragments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
