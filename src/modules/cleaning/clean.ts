import type { CleaningResult } from "@/shared/types";

/**
 * Step 2 — Limpeza.
 * Normaliza o texto extraído: espaços, quebras, encoding, aspas, hífens
 * e linhas vazias consecutivas.
 */
export function cleanText(input: string): CleaningResult {
  const operations: Record<string, number> = {};
  const linesBefore = input.split("\n").length;
  let text = input;

  const apply = (name: string, pattern: RegExp, replacement: string) => {
    const matches = text.match(pattern);
    operations[name] = matches ? matches.length : 0;
    text = text.replace(pattern, replacement);
  };

  // Corrigir encoding: normalização unicode + artefatos comuns de mojibake
  const beforeEncoding = text;
  text = text.normalize("NFC");
  const mojibake: Array<[RegExp, string]> = [
    [/Ã¡/g, "á"],
    [/Ã¢/g, "â"],
    [/Ã£/g, "ã"],
    [/Ã©/g, "é"],
    [/Ãª/g, "ê"],
    [/Ã­/g, "í"],
    [/Ã³/g, "ó"],
    [/Ã´/g, "ô"],
    [/Ãµ/g, "õ"],
    [/Ãº/g, "ú"],
    [/Ã§/g, "ç"],
    [/\u00C3\u2021/g, "\u00C7"],
    [/\u00C3\u2030/g, "\u00C9"],
  ];
  for (const [pattern, replacement] of mojibake) {
    text = text.replace(pattern, replacement);
  }
  operations["corrigir_encoding"] = beforeEncoding === text ? 0 : 1;

  // Normalizar quebras de linha (CRLF/CR -> LF)
  apply("normalizar_quebras", /\r\n?/g, "\n");

  // Remover caracteres inválidos/de controle (mantém \n e \t)
  // eslint-disable-next-line no-control-regex
  apply(
    "remover_caracteres_invalidos",
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/g,
    ""
  );

  // Normalizar aspas tipográficas -> aspas retas
  apply("normalizar_aspas_duplas", /[“”«»„]/g, '"');
  apply("normalizar_aspas_simples", /[‘’‚]/g, "'");

  // Normalizar hífens unicode -> hífen simples
  apply("normalizar_hifens", /[‐‑‒]/g, "-");
  // Remover hifenização de fim de linha (palavra quebrada pelo PDF)
  apply("remover_hifenizacao_quebra", /(\p{L})-\n(\p{Ll})/gu, "$1$2");

  // Normalizar espaços especiais (nbsp, en/em space, zero-width, ideográfico)
  apply(
    "normalizar_espacos_especiais",
    /[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g,
    " "
  );

  // Remover espaços extras (múltiplos espaços/tabs -> um espaço)
  apply("remover_espacos_extras", /[ \t]{2,}/g, " ");

  // Remover espaços no fim/início de linha
  apply("trim_fim_linhas", /[ \t]+$/gm, "");
  apply("trim_inicio_linhas", /^[ \t]+/gm, "");

  // Remover linhas vazias consecutivas (3+ quebras -> 2)
  apply("remover_linhas_vazias_consecutivas", /\n{3,}/g, "\n\n");

  // Trim geral
  text = text.trim();

  return {
    cleaned: text,
    stats: {
      charsBefore: input.length,
      charsAfter: text.length,
      linesBefore,
      linesAfter: text.split("\n").length,
      operations,
    },
  };
}
