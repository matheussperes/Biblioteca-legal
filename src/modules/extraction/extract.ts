import { convert as htmlToText } from "html-to-text";
import type { ExtractionResult } from "@/shared/types";

export interface ExtractionInput {
  type: "PDF" | "DOCX" | "TXT" | "HTML" | "MARKDOWN" | "PASTED";
  /** conteúdo binário do arquivo original (PDF/DOCX/...) */
  buffer?: Buffer;
  /** texto colado diretamente */
  pastedText?: string;
}

/**
 * Step 1 — Extração de Texto.
 * Converte qualquer documento suportado em texto puro.
 */
export async function extractText(
  input: ExtractionInput
): Promise<ExtractionResult> {
  const start = Date.now();
  const warnings: string[] = [];

  switch (input.type) {
    case "PASTED": {
      return {
        text: input.pastedText ?? "",
        meta: { engine: "pasted-text", warnings, durationMs: Date.now() - start },
      };
    }
    case "TXT":
    case "MARKDOWN": {
      const text = requireBuffer(input).toString("utf8");
      return {
        text,
        meta: {
          engine: input.type === "TXT" ? "utf8" : "markdown-passthrough",
          warnings,
          durationMs: Date.now() - start,
        },
      };
    }
    case "HTML": {
      const html = requireBuffer(input).toString("utf8");
      const text = htmlToText(html, {
        wordwrap: false,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
          { selector: "nav", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" },
        ],
      });
      return {
        text,
        meta: { engine: "html-to-text", warnings, durationMs: Date.now() - start },
      };
    }
    case "PDF": {
      // import interno para evitar o modo debug do pdf-parse quando carregado no bundle
      const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(requireBuffer(input));
      if (!result.text.trim()) {
        warnings.push(
          "Nenhum texto extraído — o PDF pode ser digitalizado (imagem). OCR não é suportado nesta fase."
        );
      }
      return {
        text: result.text,
        meta: {
          engine: "pdf-parse",
          pages: result.numpages,
          warnings,
          durationMs: Date.now() - start,
        },
      };
    }
    case "DOCX": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: requireBuffer(input),
      });
      for (const m of result.messages) warnings.push(m.message);
      return {
        text: result.value,
        meta: { engine: "mammoth", warnings, durationMs: Date.now() - start },
      };
    }
    default:
      throw new Error(`Tipo de documento não suportado: ${input.type}`);
  }
}

function requireBuffer(input: ExtractionInput): Buffer {
  if (!input.buffer) {
    throw new Error(
      `Documento do tipo ${input.type} não possui conteúdo binário armazenado.`
    );
  }
  return input.buffer;
}
