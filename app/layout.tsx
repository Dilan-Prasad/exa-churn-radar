import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Churn Radar — See account risk before renewal",
  description:
    "An Exa-powered outside-in churn signal radar for Customer Success teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
