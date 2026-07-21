"use client";

import { useState } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@/components/ui";
import { ArticleViewerModal } from "@/components/chat/ArticleViewerModal";

interface DocumentResult {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
}
interface ArticleResult {
  id: string;
  label: string;
  trecho: string;
  documentId: string;
  documentName: string;
  capitulo: string | null;
  secao: string | null;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentResult[]>([]);
  const [articles, setArticles] = useState<ArticleResult[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setDocuments(data.documents ?? []);
    setArticles(data.articles ?? []);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Busca Manual</h1>
      <p className="text-sm text-zinc-500">Pesquise por lei, capítulo, seção, artigo, palavra ou tema.</p>

      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: recuo, LUOS, Art. 35, coeficiente de aproveitamento..."
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />} Buscar
        </Button>
      </form>

      {searched && !loading && documents.length === 0 && articles.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum resultado encontrado.</p>
      )}

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leis ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((d) => (
              <Link
                key={d.id}
                href={`/rag/law/${d.id}`}
                className="block rounded-md border border-zinc-100 p-2.5 text-sm hover:border-indigo-200"
              >
                <div className="font-medium text-indigo-600">{d.name}</div>
                <div className="text-xs text-zinc-400">
                  {d.type} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {articles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Artigos ({articles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {articles.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedArticleId(a.id)}
                className="block w-full rounded-md border border-zinc-100 p-2.5 text-left text-sm hover:border-indigo-200"
              >
                <div className="font-medium text-indigo-600">
                  {a.documentName} — {a.label}
                </div>
                <div className="text-xs text-zinc-400">
                  {[a.capitulo, a.secao].filter(Boolean).join(" — ")}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{a.trecho}...</div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <ArticleViewerModal articleId={selectedArticleId} onClose={() => setSelectedArticleId(null)} />
    </div>
  );
}
