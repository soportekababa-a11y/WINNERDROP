import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/query-client";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Momentum — Productos Ganadores",
  description: "Dashboard de productos ganadores para dropshipping",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className={`${inter.className} min-h-full bg-[#020209] text-white antialiased`}>
        {/* Atmospheric background glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-violet-600/[0.06] rounded-full blur-[130px]" />
          <div className="absolute top-1/2 -left-60 w-[500px] h-[500px] bg-purple-700/[0.04] rounded-full blur-[110px]" />
          <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-violet-500/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10">
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </div>
      </body>
    </html>
  );
}
