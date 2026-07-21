"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Send } from "lucide-react";
import { Button, Card, CardContent, Spinner, Textarea } from "@/components/ui";
import { AnswerCard } from "@/components/chat/AnswerCard";
import { ArticleViewerModal } from "@/components/chat/ArticleViewerModal";
import { ExplainabilityModal } from "@/components/chat/ExplainabilityModal";
import { evidencesFromTrace, type ChatExchange } from "@/components/chat/types";
import { EMPTY_ENTITIES } from "@/shared/rag-types";
import type { ExplainabilityTrace } from "@/shared/rag-types";

const EXAMPLE_QUESTIONS = [
  "Posso construir um prédio de 12 metros nesta zona?",
  "Qual o recuo obrigatório?",
  "Posso construir piscina sobre o recuo?",
  "Qual o coeficiente máximo?",
  "Preciso de Alvará de Aprovação?",
  "Existe conflito entre o Código de Obras e a LUOS?",
];

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  questionCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function questionToExchange(q: any): ChatExchange | null {
  if (!q.answer) return null;
  const trace = (q.answer.trace as ExplainabilityTrace | null) ?? null;
  return {
    questionId: q.id,
    answerId: q.answer.id,
    questionText: q.text,
    category: q.category ?? "Outros",
    categoryConfidence: q.categoryConfidence ?? 0,
    entities: q.entities ?? EMPTY_ENTITIES,
    answer: {
      resumoExecutivo: q.answer.resumoExecutivo,
      fundamentacao: q.answer.fundamentacao,
      artigosUtilizados: q.answer.artigosUtilizados ?? [],
      referenciasCruzadas: q.answer.referenciasCruzadas ?? [],
      observacoes: q.answer.observacoes ?? "",
      nivelConfianca: q.answer.nivelConfianca,
      hasConflict: q.answer.hasConflict,
      conflictDetails: q.answer.conflictDetails ?? [],
    },
    evidences: evidencesFromTrace(trace),
    warnings: [],
    insufficientEvidence: q.answer.insufficientEvidence,
    trace,
    model: q.answer.model,
    temperature: q.answer.temperature,
    promptTokens: q.answer.promptTokens,
    completionTokens: q.answer.completionTokens,
    costUsd: q.answer.costUsd,
    durationMs: q.answer.durationMs,
  };
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<ChatExchange[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [explainTrace, setExplainTrace] = useState<ExplainabilityTrace | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/rag/history");
    if (res.ok) setConversations(await res.json());
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges]);

  const openConversation = async (id: string) => {
    setActiveConversationId(id);
    setError(null);
    const res = await fetch(`/api/rag/history/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loaded = (data.questions as any[])
      .map(questionToExchange)
      .filter((e): e is ChatExchange => e !== null);
    setExchanges(loaded);
  };

  const newConversation = () => {
    setActiveConversationId(null);
    setExchanges([]);
    setError(null);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question, conversationId: activeConversationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao consultar a Base de Conhecimento.");
        return;
      }
      setActiveConversationId(data.conversationId);
      setExchanges((prev) => [...prev, { ...data, questionText: question }]);
      loadConversations();
    } catch {
      setError("Falha de rede ao consultar a Base de Conhecimento.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[240px_1fr_300px] gap-4">
      {/* Esquerda — Histórico */}
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-zinc-100 p-3">
          <Button size="sm" className="w-full" onClick={newConversation}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="p-2 text-xs text-zinc-400">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`mb-1 block w-full truncate rounded-md px-2.5 py-2 text-left text-xs ${
                  c.id === activeConversationId ? "bg-indigo-50 text-indigo-700" : "hover:bg-zinc-50"
                }`}
                title={c.title}
              >
                {c.title}
                <span className="ml-1 text-zinc-400">({c.questionCount})</span>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Centro — Conversa */}
      <Card className="flex flex-col overflow-hidden">
        <CardContent className="flex-1 space-y-4 overflow-y-auto">
          {exchanges.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-zinc-500">
                Pergunte sobre legislação urbanística — recuos, alturas, coeficientes, licenciamento e mais.
              </p>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {exchanges.map((exchange) => (
            <AnswerCard
              key={exchange.questionId}
              exchange={exchange}
              onSelectArticle={setSelectedArticleId}
              onExplain={() => setExplainTrace(exchange.trace)}
            />
          ))}
          {sending && (
            <div className="flex items-center gap-2 pl-1 text-xs text-zinc-400">
              <Spinner /> Consultando a Base de Conhecimento...
            </div>
          )}
          {error && <div className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <div ref={bottomRef} />
        </CardContent>
        <div className="border-t border-zinc-100 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Digite sua pergunta sobre legislação urbanística..."
              rows={2}
              className="flex-1 resize-none"
            />
            <Button type="submit" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Direita — Painel Jurídico */}
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-zinc-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Painel Jurídico
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {exchanges.length === 0 ? (
            <p className="text-xs text-zinc-400">
              As evidências utilizadas na última resposta (origem, artigo e score de similaridade) aparecem aqui.
            </p>
          ) : (
            <div className="space-y-2">
              {exchanges[exchanges.length - 1].evidences.map((ev) => (
                <button
                  key={ev.chunkId}
                  onClick={() => {
                    const item = exchanges[exchanges.length - 1].answer.artigosUtilizados.find(
                      (a) => a.chunkId === ev.chunkId
                    );
                    if (item?.articleId) setSelectedArticleId(item.articleId);
                  }}
                  className="block w-full rounded-md border border-zinc-100 bg-zinc-50 p-2 text-left text-xs hover:border-indigo-200"
                >
                  <div className="font-medium text-zinc-700">
                    {ev.lei} {ev.artigo ?? ""}
                  </div>
                  <div className="mt-0.5 text-zinc-500">
                    {ev.scoreSimilaridade != null && `distância ${ev.scoreSimilaridade.toFixed(4)}`}
                  </div>
                  <div className="mt-0.5 text-zinc-400">{ev.motivoRecuperacao}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ArticleViewerModal articleId={selectedArticleId} onClose={() => setSelectedArticleId(null)} />
      <ExplainabilityModal trace={explainTrace} onClose={() => setExplainTrace(null)} />
    </div>
  );
}
