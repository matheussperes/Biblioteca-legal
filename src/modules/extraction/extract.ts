import { convert as htmlToText } from "html-to-text";
import type { ExtractionResult } from "@/shared/types";
import type { OcrConfig } from "@/shared/config";
import { extractPdf } from "./pdf-engine";

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
 * Para PDFs, `ocrConfig` controla o OCR via Vision API (páginas digitalizadas)
 * e a detecção/recorte de figuras — ver `pdf-engine.ts`.
 */
export async function extractText(
  input: ExtractionInput,
  ocrConfig?: OcrConfig
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
      const { DEFAULT_CONFIG } = await import("@/shared/config");
      const config = ocrConfig ?? DEFAULT_CONFIG.ocr;
      const result = await extractPdf(requireBuffer(input), config);
      warnings.push(...result.warnings);
      if (!result.text.trim()) {
        warnings.push(
          "Nenhum texto extraído do PDF, nem via OCR — verifique a qualidade do arquivo."
        );
      }
      return {
        text: result.text,
        meta: {
          engine: result.ocrPages.length > 0 ? "pdfjs+vision-ocr" : "pdfjs",
          pages: result.pages,
          warnings,
          durationMs: Date.now() - start,
          pageOffsets: result.pageOffsets,
          ocrPages: result.ocrPages,
          figuresDetected: result.figures.length,
        },
        figures: result.figures,
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
