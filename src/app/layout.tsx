import type { Metadata } from "next";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Interviewer",
  description: "Mock coding interviews with optional interviewer persona tailoring.",
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
