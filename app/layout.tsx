import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Providers from "@/components/Providers";
import ThemeProvider from "@/components/ThemeProvider";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Game-X",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body className="min-h-screen antialiased">
        <Providers>
          <ThemeProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: "#262626", border: "1px solid #404040", color: "#fafafa" },
                classNames: {
                  success: "!border-emerald-500/50 !bg-emerald-500/10",
                  error: "!border-red-500/50 !bg-red-500/10",
                },
              }}
            />
            <div className="flex min-h-screen flex-col">
              <AppHeader />
              <main className="flex-1">{children}</main>
              <AppFooter />
            </div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
