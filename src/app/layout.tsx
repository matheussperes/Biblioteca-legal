import type { Metadata } from "next";
import Link from "next/link";
import { Database, FileUp, LayoutDashboard, Settings } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Pipeline",
  description:
    "Base de Conhecimento para RAG — transforma documentos brutos em conhecimento estruturado, enriquecido e indexado.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Database className="h-5 w-5 text-indigo-600" />
              Knowledge Pipeline
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/" className="flex items-center gap-1.5 hover:text-zinc-900">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <Link
                href="/upload"
                className="flex items-center gap-1.5 hover:text-zinc-900"
              >
                <FileUp className="h-4 w-4" /> Novo Documento
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 hover:text-zinc-900"
              >
                <Settings className="h-4 w-4" /> Configurações
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
