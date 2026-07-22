import path from "node:path";
import type { OcrConfig } from "@/shared/config";
import type { FigureDraft, PageOffset } from "@/shared/types";
import {
  getDefaultVisionClient,
  hasVisionApiKey,
  type VisionClient,
} from "./vision-client";

// ---------------------------------------------------------------------------
// Step 1 — Motor de PDF: extração de texto por página (pdfjs-dist) + OCR via
// Vision API para páginas digitalizadas + detecção/recorte de figuras.
//
// O texto de páginas com camada de texto é montado com o mesmo algoritmo do
// pdf-parse (junta itens da mesma linha de base Y, quebra linha quando muda),
// preservando a estrutura que o Tokenizador (Step 3) espera. Páginas sem
// texto (digitalizadas) são transcritas via Vision API.
// ---------------------------------------------------------------------------

export interface PdfExtractionResult {
  text: string;
  pages: number;
  warnings: string[];
  pageOffsets: PageOffset[];
  ocrPages: number[];
  figures: FigureDraft[];
}

interface VisionFigure {
  descricao: string;
  bbox: [number, number, number, number];
  texto_na_figura: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai o tempo de espera sugerido pela OpenAI ("...try again in 302ms."). */
function parseRetryAfterMs(message: string): number | null {
  const match = message.match(/try again in\s+([\d.]+)\s*(ms|s)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2].toLowerCase() === "s" ? value * 1000 : value;
}

function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number } | null | undefined)?.status;
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|rate limit/i.test(message);
}

/** Espaço mínimo entre chamadas à Vision API — reduz a chance de estourar o TPM. */
const VISION_MIN_GAP_MS = 350;
/** Tentativas extras específicas para 429 (rate limit) — outros erros não são retentados. */
const VISION_MAX_RETRIES = 3;

let globalsPolyfilled = false;

async function loadPdfjs() {
  const canvas = await import("@napi-rs/canvas");
  if (!globalsPolyfilled) {
    // pdfjs-dist referencia estas classes como globais (comportamento de browser)
    (globalThis as Record<string, unknown>).Path2D = canvas.Path2D;
    (globalThis as Record<string, unknown>).ImageData = canvas.ImageData;
    (globalThis as Record<string, unknown>).DOMMatrix = canvas.DOMMatrix;
    globalsPolyfilled = true;
  }
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return { pdfjsLib, canvas };
}

/** Reproduz o algoritmo de junção de linhas do pdf-parse (mesma qualidade de texto). */
function joinTextContentLines(items: unknown[]): string {
  let lastY: number | undefined;
  let text = "";
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as { str: string; transform: number[] };
    if (lastY === item.transform[5] || lastY === undefined) {
      text += item.str;
    } else {
      text += "\n" + item.str;
    }
    lastY = item.transform[5];
  }
  return text;
}

function clampBbox(bbox: unknown): [number, number, number, number] | null {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const [x0, y0, x1, y1] = bbox.map((v) => Number(v));
  if ([x0, y0, x1, y1].some((v) => !Number.isFinite(v))) return null;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const cx0 = clamp(Math.min(x0, x1));
  const cy0 = clamp(Math.min(y0, y1));
  const cx1 = clamp(Math.max(x0, x1));
  const cy1 = clamp(Math.max(y0, y1));
  if (cx1 - cx0 < 1 || cy1 - cy0 < 1) return null;
  return [cx0, cy0, cx1, cy1];
}

function parseVisionJson(raw: string): { texto?: string; figuras: VisionFigure[] } {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { figuras: [] };
  }
  const figurasRaw = Array.isArray(parsed.figuras) ? parsed.figuras : [];
  const figuras: VisionFigure[] = [];
  for (const f of figurasRaw) {
    if (typeof f !== "object" || f === null) continue;
    const obj = f as Record<string, unknown>;
    const bbox = clampBbox(obj.bbox);
    if (!bbox) continue;
    figuras.push({
      descricao: typeof obj.descricao === "string" ? obj.descricao : "",
      bbox,
      texto_na_figura:
        typeof obj.texto_na_figura === "string" ? obj.texto_na_figura : "",
    });
  }
  return {
    texto: typeof parsed.texto === "string" ? parsed.texto : undefined,
    figuras,
  };
}

async function callVision(
  client: VisionClient,
  model: string,
  temperature: number,
  prompt: string,
  pngDataUrl: string
): Promise<{ texto?: string; figuras: VisionFigure[] }> {
  const response = await client.chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: pngDataUrl } },
        ],
      },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  return parseVisionJson(raw);
}

/**
 * Chama a Vision API com retentativa específica para erro 429 (rate limit).
 * Em documentos com muitas páginas escaneadas em sequência é comum estourar
 * o limite de tokens por minuto (TPM) da conta — sem retry, a página falha
 * e perde texto/figuras definitivamente. Respeita o tempo sugerido pela
 * própria OpenAI ("...try again in Xms.") quando presente.
 */
async function callVisionWithRetry(
  client: VisionClient,
  model: string,
  temperature: number,
  prompt: string,
  pngDataUrl: string
): Promise<{ texto?: string; figuras: VisionFigure[] }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callVision(client, model, temperature, prompt, pngDataUrl);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= VISION_MAX_RETRIES) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const suggested = parseRetryAfterMs(message);
      const backoff = suggested ?? Math.min(2_000 * 2 ** attempt, 20_000);
      await sleep(backoff + 250); // pequena margem de segurança
    }
  }
}

export async function extractPdf(
  buffer: Buffer,
  config: OcrConfig,
  visionClient?: VisionClient
): Promise<PdfExtractionResult> {
  const warnings: string[] = [];

  let pdfjsLib: Awaited<ReturnType<typeof loadPdfjs>>["pdfjsLib"];
  let canvas: Awaited<ReturnType<typeof loadPdfjs>>["canvas"];
  let pkgDir: string;
  try {
    ({ pdfjsLib, canvas } = await loadPdfjs());
    // Não usar require.resolve() aqui: dentro de código empacotado pelo
    // webpack (rota do Next.js), require.resolve() de um pacote externalizado
    // (serverExternalPackages) pode ser reescrito para devolver o ID interno
    // do módulo (um número) em vez do caminho real em disco — daí o erro
    // "The 'path' argument must be of type string. Received type number".
    // pdfjs-dist está em node_modules por ser um external package de verdade.
    pkgDir = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[setup] Falha ao carregar pdfjs-dist/@napi-rs/canvas: ${message}`);
  }

  let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
  try {
    doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      standardFontDataUrl: path.join(pkgDir, "standard_fonts") + "/",
      cMapUrl: path.join(pkgDir, "cmaps") + "/",
      cMapPacked: true,
    }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[getDocument] Falha ao carregar o PDF (${buffer.length} bytes): ${message}`);
  }

  const totalPages = doc.numPages;
  const pagesToProcess = Math.min(totalPages, Math.max(1, config.maxPages));
  if (totalPages > pagesToProcess) {
    warnings.push(
      `Documento com ${totalPages} páginas — processamento limitado às ${pagesToProcess} primeiras (limite configurável em Configurações → OCR).`
    );
  }

  const ocrEnabled = config.enabled && (visionClient != null || hasVisionApiKey());
  if (config.enabled && !visionClient && !hasVisionApiKey()) {
    warnings.push(
      "OCR/Vision desabilitado: OPENAI_API_KEY não configurada. Páginas escaneadas podem ficar sem texto e figuras não serão descritas."
    );
  }
  const client = ocrEnabled ? (visionClient ?? getDefaultVisionClient()) : undefined;

  const pageTexts: string[] = [];
  const pageOffsets: PageOffset[] = [];
  const ocrPages: number[] = [];
  const figures: FigureDraft[] = [];
  let cursor = 0;
  let lastVisionCallAt = 0;

  // Rede de segurança: com retentativas de 429, um documento com rate limit
  // persistente em várias páginas poderia se aproximar do limite de execução
  // da função serverless (route com maxDuration=300s) — perdendo TUDO num
  // timeout, já que o resultado só é persistido no final do step. Ao atingir
  // o orçamento, para de chamar a Vision API para as páginas restantes (que
  // ficam com o texto puro do pdfjs, sem OCR) em vez de arriscar o timeout.
  const ocrDeadline = Date.now() + 220_000;
  let ocrBudgetExhausted = false;

  for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber++) {
    let pageText = "";
    try {
      const page = await doc.getPage(pageNumber);

      const textContent = await page.getTextContent();
      pageText = joinTextContentLines(textContent.items);
      const isScanned = pageText.trim().length < 20;

      let hasEmbeddedImage = false;
      if (client && figures.length < config.maxFigures) {
        const opList = await page.getOperatorList();
        hasEmbeddedImage = opList.fnArray.includes(pdfjsLib.OPS.paintImageXObject);
      }

      if (client && !ocrBudgetExhausted && Date.now() > ocrDeadline) {
        ocrBudgetExhausted = true;
        warnings.push(
          `Orçamento de tempo do OCR/Vision atingido na página ${pageNumber} — páginas restantes ficam sem OCR/figuras nesta execução (reexecute a Extração para tentar novamente).`
        );
      }

      const needsRender =
        client &&
        !ocrBudgetExhausted &&
        (isScanned || (hasEmbeddedImage && figures.length < config.maxFigures));

      if (needsRender && client) {
        try {
          const viewport = page.getViewport({ scale: config.renderScale });
          const renderCanvas = canvas.createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height)
          );
          const ctx = renderCanvas.getContext("2d");
          await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;
          const pageBuffer = renderCanvas.toBuffer("image/png");
          const pageDataUrl = `data:image/png;base64,${pageBuffer.toString("base64")}`;

          const prompt = isScanned ? config.ocrPrompt : config.figuresPrompt;
          const model = config.model;

          const gap = VISION_MIN_GAP_MS - (Date.now() - lastVisionCallAt);
          if (gap > 0) await sleep(gap);
          lastVisionCallAt = Date.now();

          const result = await callVisionWithRetry(
            client,
            model,
            config.temperature,
            prompt,
            pageDataUrl
          );

          if (isScanned) {
            pageText = result.texto ?? pageText;
            ocrPages.push(pageNumber);
          }

          let figureIndex = 0;
          for (const f of result.figuras) {
            if (figures.length >= config.maxFigures) break;
            const [x0, y0, x1, y1] = f.bbox;
            const sx = Math.round((x0 / 100) * renderCanvas.width);
            const sy = Math.round((y0 / 100) * renderCanvas.height);
            const sw = Math.round(((x1 - x0) / 100) * renderCanvas.width);
            const sh = Math.round(((y1 - y0) / 100) * renderCanvas.height);
            if (sw < config.minFigureWidth || sh < config.minFigureHeight) continue;

            const cropCanvas = canvas.createCanvas(sw, sh);
            const cropCtx = cropCanvas.getContext("2d");
            const sourceImage = await canvas.loadImage(pageBuffer);
            cropCtx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, sw, sh);
            const cropBuffer = cropCanvas.toBuffer("image/png");

            figures.push({
              page: pageNumber,
              index: figureIndex++,
              imageBase64: `data:image/png;base64,${cropBuffer.toString("base64")}`,
              width: sw,
              height: sh,
              description: f.descricao,
              ocrText: f.texto_na_figura,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`Página ${pageNumber}: falha ao chamar Vision API (${message}).`);
        }
      }

      if (isScanned && pageText.trim().length === 0) {
        warnings.push(
          `Página ${pageNumber} parece digitalizada e não foi possível extrair texto via OCR.`
        );
      }
    } catch (error) {
      // Falha ao interpretar a página em si (ex.: recurso de fonte/cmap do
      // pdfjs) não pode derrubar a extração do documento inteiro — pula a
      // página com um aviso em vez de abortar tudo.
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Página ${pageNumber}: falha ao processar a página (${message}).`);
    }

    pageTexts.push(pageText);
    const start = cursor;
    cursor += pageText.length;
    pageOffsets.push({ page: pageNumber, start, end: cursor });
    cursor += 2; // separador "\n\n" entre páginas
  }

  return {
    text: pageTexts.join("\n\n"),
    pages: totalPages,
    warnings,
    pageOffsets,
    ocrPages,
    figures,
  };
}
