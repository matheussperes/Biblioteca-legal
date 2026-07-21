"use client";

import { useState } from "react";
import { Badge, Modal } from "@/components/ui";

export interface FigureRow {
  id: string;
  page: number;
  imageBase64: string;
  width: number | null;
  height: number | null;
  description: string | null;
  ocrText: string | null;
}

/** Etapa 2/3 — grid de figuras extraídas via OCR/Vision, com lightbox ao clicar. */
export function FigureGrid({ figures }: { figures: FigureRow[] }) {
  const [open, setOpen] = useState<FigureRow | null>(null);

  if (figures.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <button
            key={figure.id}
            type="button"
            onClick={() => setOpen(figure)}
            className="group flex flex-col overflow-hidden rounded-md border border-zinc-200 text-left transition-colors hover:border-indigo-300"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={figure.imageBase64}
              alt={figure.description || `Figura da página ${figure.page}`}
              className="h-28 w-full bg-zinc-50 object-contain"
            />
            <div className="space-y-1 p-2">
              <Badge variant="outline">Pág. {figure.page}</Badge>
              {figure.description && (
                <p className="line-clamp-2 text-xs text-zinc-600">
                  {figure.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={open != null}
        onClose={() => setOpen(null)}
        title={open ? `Figura — página ${open.page}` : ""}
        wide
      >
        {open && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.imageBase64}
              alt={open.description || `Figura da página ${open.page}`}
              className="max-h-[60vh] w-full rounded-md border border-zinc-200 object-contain"
            />
            {open.description && (
              <p className="text-sm text-zinc-700">{open.description}</p>
            )}
            {open.ocrText && (
              <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                <strong>Texto na figura:</strong> {open.ocrText}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
