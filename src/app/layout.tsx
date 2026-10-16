import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מיון חבילות חדרה",
  description: "כלי אישי למיון חבילות לפי אזור חלוקה",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// System Hebrew fonts: no download, works offline and loads instantly on the phone.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col bg-neutral-50 text-neutral-900"
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
