"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Spinner } from "@/components/ui";
import { ArticleViewerModal } from "@/components/chat/ArticleViewerModal";

interface FavoriteRow {
  id: string;
  type: string;
  refId: string;
  title: string;
  note: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  QUESTION: "Pergunta",
  LAW: "Lei",
  ARTICLE: "Artigo",
  ANSWER: "Resposta",
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRow[] | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/rag/favorites");
    setFavorites(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    await fetch(`/api/rag/favorites/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Favoritos</h1>
      <p className="text-sm text-zinc-500">Perguntas, leis, artigos e respostas salvos.</p>

      <Card>
        <CardContent className="p-0">
          {favorites === null ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
              <Spinner /> Carregando...
            </div>
          ) : favorites.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">Nenhum favorito ainda.</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {favorites.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => f.type === "ARTICLE" && setSelectedArticleId(f.refId)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{TYPE_LABEL[f.type] ?? f.type}</Badge>
                      <span className="truncate font-medium">{f.title}</span>
                    </div>
                    {f.note && <p className="mt-1 text-xs text-zinc-500">{f.note}</p>}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ArticleViewerModal articleId={selectedArticleId} onClose={() => setSelectedArticleId(null)} />
    </div>
  );
}
