import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sourcing Database",
  description: "Indian Chemical Manufacturer Sourcing Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
