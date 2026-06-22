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
      <body className={`${inter.className} min-h-full text-white antialiased`}
        style={{ background: '#04000d' }}>

        {/* Grid pattern */}
        <div className="fixed inset-0 pointer-events-none z-0 bg-grid-neon opacity-100" />

        {/* Animated orbs */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full animate-orb-drift"
            style={{ background: 'radial-gradient(circle, rgba(192,38,211,0.18) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(109,40,217,0.06) 50%, transparent 70%)', filter: 'blur(80px)', animation: 'orb-drift 24s ease-in-out infinite reverse' }} />
          <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)', filter: 'blur(70px)', animation: 'orb-drift 20s ease-in-out infinite 6s' }} />
          <div className="absolute top-2/3 right-1/3 w-[250px] h-[250px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(217,70,239,0.08) 0%, transparent 70%)', filter: 'blur(50px)', animation: 'orb-drift 15s ease-in-out infinite 3s' }} />
        </div>

        <div className="relative z-10">
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </div>
      </body>
    </html>
  );
}
