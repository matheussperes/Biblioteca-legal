"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";
import { Search } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@/components/ui";

interface SearchArticle {
  id: string;
  label: string;
  trecho: string;
  documentName: string;
}
interface ArticleDetail {
  id: string;
  label: string;
  lei: string;
  fullText: string;
}

function PickerColumn({
  title,
  selected,
  onSelect,
}: {
  title: string;
  selected: ArticleDetail | null;
  onSelect: (a: ArticleDetail) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchArticle[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.articles ?? []);
    setLoading(false);
  };

  const pick = async (id: string) => {
    const res = await fetch(`/api/rag/article/${id}`);
    const article = await res.json();
    onSelect({ id: article.id, label: article.label, lei: article.lei, fullText: article.fullText });
    setResults([]);
    setQuery("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <form onSubmit={search} className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar artigo..." />
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </form>
        {results.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => pick(r.id)}
                className="block w-full rounded border border-zinc-100 p-1.5 text-left text-xs hover:border-indigo-200"
              >
                {r.documentName} — {r.label}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="rounded bg-indigo-50 p-2 text-xs text-indigo-800">
            {selected.lei} — {selected.label}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const [a, setA] = useState<ArticleDetail | null>(null);
  const [b, setB] = useState<ArticleDetail | null>(null);

  const diff = useMemo(() => {
    if (!a || !b) return null;
    return diffLines(a.fullText, b.fullText);
  }, [a, b]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Comparador de Artigos</h1>
      <p className="text-sm text-zinc-500">Selecione dois artigos para visualizar as diferenças.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <PickerColumn title="Artigo A" selected={a} onSelect={setA} />
        <PickerColumn title="Artigo B" selected={b} onSelect={setB} />
      </div>

      {diff && (
        <Card>
          <CardHeader>
            <CardTitle>Diferenças</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto text-xs leading-5">
              {diff.map((part, i) => (
                <span
                  key={i}
                  className={
                    part.added
                      ? "bg-emerald-50 text-emerald-800"
                      : part.removed
                        ? "bg-red-50 text-red-700 line-through"
                        : "text-zinc-600"
                  }
                >
                  {part.value}
                </span>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
