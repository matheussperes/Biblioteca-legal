"use client";

import { useState } from "react";
import { AlertTriangle, Info, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatDuration } from "@/shared/utils";
import type { ChatExchange } from "./types";

const CONFIDENCE_VARIANT: Record<string, "success" | "warning" | "error"> = {
  ALTO: "success",
  MEDIO: "warning",
  BAIXO: "error",
};

export function AnswerCard({
  exchange,
  onSelectArticle,
  onExplain,
}: {
  exchange: ChatExchange;
  onSelectArticle: (articleId: string) => void;
  onExplain: () => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<"UP" | "DOWN" | null>(null);
  const { answer } = exchange;

  const sendFeedback = async (rating: "UP" | "DOWN") => {
    setFeedbackGiven(rating);
    await fetch("/api/rag/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerId: exchange.answerId, rating }),
    });
  };

  const favoriteAnswer = async () => {
    await fetch("/api/rag/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ANSWER",
        refId: exchange.answerId,
        title: exchange.questionText.slice(0, 80),
      }),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">
          {exchange.questionText}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-1">
        <Badge variant="outline">{exchange.category}</Badge>
        <span className="text-xs text-zinc-400">
          confiança da classificação: {(exchange.categoryConfidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm border border-zinc-200 bg-white p-4 text-sm shadow-sm">
        {exchange.insufficientEvidence && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Evidência insuficiente na Base de Conhecimento para responder com segurança.</span>
          </div>
        )}

        {answer.hasConflict && (
          <div className="space-y-2 rounded-md bg-red-50 p-2.5 text-red-800">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Divergência entre normas
            </div>
            {answer.conflictDetails.map((c) => (
              <div key={c.tema} className="pl-6 text-xs">
                <strong>{c.tema}:</strong>{" "}
                {c.versoes.map((v) => `${v.lei}${v.artigo ? ` (${v.artigo})` : ""}: ${v.valor}`).join(" — vs — ")}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Resumo Executivo</div>
          <p>{answer.resumoExecutivo}</p>
        </div>

        {answer.fundamentacao && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Fundamentação</div>
            <p className="whitespace-pre-wrap text-zinc-700">{answer.fundamentacao}</p>
          </div>
        )}

        {answer.artigosUtilizados.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Artigos Utilizados
            </div>
            <div className="flex flex-wrap gap-1.5">
              {answer.artigosUtilizados.map((a, i) => (
                <button
                  key={i}
                  disabled={!a.articleId}
                  onClick={() => a.articleId && onSelectArticle(a.articleId)}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100 disabled:cursor-default disabled:opacity-60"
                  title={a.trecho}
                >
                  {a.lei} {a.artigo ?? ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {answer.referenciasCruzadas.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Referências Cruzadas
            </div>
            <ul className="space-y-1 text-xs text-zinc-600">
              {answer.referenciasCruzadas.map((r, i) => (
                <li key={i}>
                  <strong>
                    {r.lei} {r.artigo ?? ""}
                  </strong>{" "}
                  — {r.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer.observacoes && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Observações</div>
            <p className="text-zinc-600">{answer.observacoes}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Nível de confiança:</span>
            <Badge variant={CONFIDENCE_VARIANT[answer.nivelConfianca] ?? "default"}>
              {answer.nivelConfianca}
            </Badge>
            <span className="text-xs text-zinc-400">
              {formatDuration(exchange.durationMs)} · US$ {exchange.costUsd.toFixed(5)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onExplain} title="Como essa resposta foi construída?">
              <Info className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={favoriteAnswer} title="Favoritar">
              <Star className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={feedbackGiven === "UP" ? "secondary" : "ghost"}
              onClick={() => sendFeedback("UP")}
              disabled={!!feedbackGiven}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={feedbackGiven === "DOWN" ? "secondary" : "ghost"}
              onClick={() => sendFeedback("DOWN")}
              disabled={!!feedbackGiven}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {exchange.warnings.length > 0 && (
          <div className="rounded bg-zinc-50 p-2 text-xs text-zinc-500">
            {exchange.warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
