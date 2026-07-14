import { describe, expect, it } from "vitest";
import { cleanText } from "@/modules/cleaning";

describe("Step 2 — Limpeza", () => {
  it("remove espaços extras", () => {
    const { cleaned } = cleanText("Art.  1º   Texto    com espaços");
    expect(cleaned).toBe("Art. 1º Texto com espaços");
  });

  it("normaliza quebras de linha CRLF/CR", () => {
    const { cleaned } = cleanText("linha 1\r\nlinha 2\rlinha 3");
    expect(cleaned).toBe("linha 1\nlinha 2\nlinha 3");
  });

  it("remove linhas vazias consecutivas", () => {
    const { cleaned } = cleanText("a\n\n\n\n\nb");
    expect(cleaned).toBe("a\n\nb");
  });

  it("normaliza aspas tipográficas", () => {
    const { cleaned } = cleanText("“texto” e ‘outro’");
    expect(cleaned).toBe(`"texto" e 'outro'`);
  });

  it("normaliza hífens unicode", () => {
    const { cleaned } = cleanText("não‐fumante e não‑fumante");
    expect(cleaned).toBe("não-fumante e não-fumante");
  });

  it("junta palavras hifenizadas por quebra de linha", () => {
    const { cleaned } = cleanText("parcela-\nmento do solo");
    expect(cleaned).toBe("parcelamento do solo");
  });

  it("remove caracteres de controle preservando \\n e \\t", () => {
    const { cleaned } = cleanText(`a${String.fromCharCode(7)}bc\nd`);
    expect(cleaned).toBe("abc\nd");
  });

  it("normaliza espaços não separáveis", () => {
    const { cleaned } = cleanText("Art.\u00A01\u00BA");
    expect(cleaned).toBe("Art. 1\u00BA");
  });

  it("remove espaços no início e fim das linhas", () => {
    const { cleaned } = cleanText("  Art. 1º Teste  \n   outra linha ");
    expect(cleaned).toBe("Art. 1º Teste\noutra linha");
  });

  it("reporta estatísticas de antes/depois", () => {
    const input = "a  b\n\n\n\nc";
    const { stats } = cleanText(input);
    expect(stats.charsBefore).toBe(input.length);
    expect(stats.charsAfter).toBeLessThan(input.length);
    expect(stats.operations["remover_espacos_extras"]).toBe(1);
  });
});
