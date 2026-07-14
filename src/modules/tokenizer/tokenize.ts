import type { StructuralToken, TokenType } from "@/shared/types";
import type { RegexConfig } from "@/shared/config";
import { DEFAULT_CONFIG } from "@/shared/config";

interface CompiledRegexes {
  capitulo: RegExp;
  secao: RegExp;
  subsecao: RegExp;
  artigo: RegExp;
  paragrafo: RegExp;
  inciso: RegExp;
  alinea: RegExp;
  item: RegExp;
  observacao: RegExp;
  novaRedacao: RegExp;
  referenciaLegal: RegExp;
}

function compile(config: RegexConfig): CompiledRegexes {
  return {
    capitulo: new RegExp(config.capitulo, "i"),
    secao: new RegExp(config.secao, "i"),
    subsecao: new RegExp(config.subsecao, "i"),
    artigo: new RegExp(config.artigo),
    paragrafo: new RegExp(config.paragrafo, "i"),
    inciso: new RegExp(config.inciso),
    alinea: new RegExp(config.alinea),
    item: new RegExp(config.item),
    observacao: new RegExp(config.observacao, "i"),
    novaRedacao: new RegExp(config.novaRedacao, "i"),
    referenciaLegal: new RegExp(config.referenciaLegal, "i"),
  };
}

/**
 * Step 3 — Tokenização.
 * Transforma texto limpo em uma sequência de Tokens Estruturais.
 *
 * O lexer é orientado a linhas: cada linha é classificada pelos regexes
 * configuráveis (Configurações → Editor de Regex). Linhas de texto que
 * seguem imediatamente um ARTIGO são classificadas como CAPUT; linhas
 * imediatamente após CAPITULO/SECAO/SUBSECAO em caixa alta viram títulos.
 */
export function tokenize(
  text: string,
  regexConfig: RegexConfig = DEFAULT_CONFIG.regex
): StructuralToken[] {
  const rx = compile(regexConfig);
  const lines = text.split("\n");
  const tokens: StructuralToken[] = [];

  let position = 0;
  let index = 0;

  // contexto do lexer
  let lastStructural: TokenType | null = null;

  const push = (
    type: TokenType,
    lineText: string,
    startLine: number,
    pos: number,
    endLine?: number
  ) => {
    tokens.push({
      id: `tok_${index}`,
      index,
      type,
      text: lineText,
      position: pos,
      startLine,
      endLine: endLine ?? startLine,
    });
    index += 1;
  };

  // Token raiz do documento
  push("DOCUMENT", firstNonEmptyLine(lines) ?? "", 1, 0);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNumber = i + 1;
    const pos = position;
    position += raw.length + 1; // +1 pela quebra de linha

    if (!line) continue;

    let type: TokenType;

    if (rx.capitulo.test(line)) {
      type = "CAPITULO";
    } else if (rx.subsecao.test(line)) {
      // SUBSECAO antes de SECAO: "Subseção" também casa com o regex de seção
      type = "SUBSECAO";
    } else if (rx.secao.test(line)) {
      type = "SECAO";
    } else if (rx.artigo.test(line)) {
      type = "ARTIGO";
    } else if (rx.paragrafo.test(line)) {
      type = "PARAGRAFO";
    } else if (rx.inciso.test(line)) {
      type = "INCISO";
    } else if (rx.alinea.test(line)) {
      type = "ALINEA";
    } else if (rx.item.test(line) && isItemContext(lastStructural)) {
      type = "ITEM";
    } else if (rx.observacao.test(line)) {
      type = "OBSERVACAO";
    } else if (
      lastStructural === "CAPITULO" &&
      looksLikeTitle(line)
    ) {
      type = "TITULO_CAPITULO";
    } else if (
      (lastStructural === "SECAO" || lastStructural === "SUBSECAO") &&
      looksLikeTitle(line)
    ) {
      type = "TITULO_SECAO";
    } else if (isCaputContext(lastStructural)) {
      // texto imediatamente após um artigo (continuação do caput)
      type = "CAPUT";
    } else {
      type = "TEXTO";
    }

    push(type, line, lineNumber, pos);

    // Tokens derivados (inline): nova redação e referências legais
    if (rx.novaRedacao.test(line)) {
      const m = line.match(rx.novaRedacao);
      push("NOVA_REDACAO", m?.[0] ?? line, lineNumber, pos);
    }
    const refMatches = line.match(new RegExp(rx.referenciaLegal.source, "gi"));
    if (refMatches) {
      for (const ref of refMatches) {
        push("REFERENCIA_LEGAL", ref, lineNumber, pos);
      }
    }

    // Atualiza contexto — tokens inline não alteram o contexto estrutural
    if (
      type !== "OBSERVACAO" &&
      type !== "TEXTO"
    ) {
      lastStructural = type;
    } else if (type === "TEXTO") {
      // TEXTO encerra o contexto de caput/título
      if (
        lastStructural === "CAPITULO" ||
        lastStructural === "SECAO" ||
        lastStructural === "SUBSECAO"
      ) {
        lastStructural = "TEXTO";
      }
    }
  }

  return tokens;
}

function firstNonEmptyLine(lines: string[]): string | undefined {
  return lines.map((l) => l.trim()).find((l) => l.length > 0);
}

/** Após ARTIGO ou CAPUT, texto livre continua sendo caput. */
function isCaputContext(last: TokenType | null): boolean {
  return last === "ARTIGO" || last === "CAPUT";
}

/**
 * ITEM ("1.", "2)") só é reconhecido dentro de alíneas/incisos —
 * fora desse contexto, uma linha iniciada por número é texto comum.
 */
function isItemContext(last: TokenType | null): boolean {
  return last === "ALINEA" || last === "ITEM" || last === "INCISO";
}

/** Título de capítulo/seção: linha curta, sem pontuação final de sentença. */
function looksLikeTitle(line: string): boolean {
  return line.length <= 120 && !/[.;:]$/.test(line);
}
