import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  FileUp,
  GitCompare,
  MessageSquare,
  Scale,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urban Knowledge Engine",
  description:
    "Motor RAG especializado em legislação urbanística — interpreta perguntas, localiza artigos relevantes e produz respostas fundamentadas com citação de origem.",
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
              <Scale className="h-5 w-5 text-indigo-600" />
              Urban Knowledge Engine
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/" className="flex items-center gap-1.5 hover:text-zinc-900">
                <MessageSquare className="h-4 w-4" /> Chat
              </Link>
              <Link href="/rag/search" className="flex items-center gap-1.5 hover:text-zinc-900">
                <Search className="h-4 w-4" /> Busca Manual
              </Link>
              <Link href="/rag/favorites" className="flex items-center gap-1.5 hover:text-zinc-900">
                <Star className="h-4 w-4" /> Favoritos
              </Link>
              <Link href="/rag/compare" className="flex items-center gap-1.5 hover:text-zinc-900">
                <GitCompare className="h-4 w-4" /> Comparador
              </Link>
              <Link href="/pipeline" className="flex items-center gap-1.5 hover:text-zinc-900">
                <Database className="h-4 w-4" /> Base de Conhecimento
              </Link>
              <Link href="/upload" className="flex items-center gap-1.5 hover:text-zinc-900">
                <FileUp className="h-4 w-4" /> Novo Documento
              </Link>
              <Link href="/rag/settings" className="flex items-center gap-1.5 hover:text-zinc-900">
                <SlidersHorizontal className="h-4 w-4" /> Config. IA
              </Link>
              <Link href="/settings" className="flex items-center gap-1.5 hover:text-zinc-900">
                <Settings className="h-4 w-4" /> Config. Pipeline
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
