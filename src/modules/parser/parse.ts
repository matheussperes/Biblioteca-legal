import type { StructuralToken, TreeNode, TreeNodeType } from "@/shared/types";
import type { RegexConfig } from "@/shared/config";
import { DEFAULT_CONFIG } from "@/shared/config";

/**
 * Step 4 — Parser.
 * Constrói a árvore hierárquica a partir dos Tokens Estruturais:
 *
 *   DOCUMENT > CAPITULO > SECAO > SUBSECAO > ARTIGO > CAPUT/PARAGRAFO >
 *   INCISO > ALINEA > ITEM
 *
 * Implementação por pilha: cada tipo tem uma "profundidade"; ao encontrar
 * um token, a pilha é desempilhada até o pai válido mais próximo.
 */

const DEPTH: Partial<Record<TreeNodeType, number>> = {
  DOCUMENT: 0,
  CAPITULO: 1,
  SECAO: 2,
  SUBSECAO: 3,
  ARTIGO: 4,
  PARAGRAFO: 5,
  INCISO: 6,
  ALINEA: 7,
  ITEM: 8,
};

let nodeSeq = 0;
function makeNode(
  type: TreeNodeType,
  label: string,
  token?: StructuralToken
): TreeNode {
  nodeSeq += 1;
  return {
    id: `node_${nodeSeq}`,
    type,
    label,
    text: token?.text,
    startLine: token?.startLine,
    endLine: token?.endLine,
    children: [],
  };
}

export function buildTree(
  tokens: StructuralToken[],
  regexConfig: RegexConfig = DEFAULT_CONFIG.regex
): TreeNode {
  nodeSeq = 0;
  const rxArtigo = new RegExp(regexConfig.artigo);
  const rxParagrafo = new RegExp(regexConfig.paragrafo, "i");
  const rxInciso = new RegExp(regexConfig.inciso);
  const rxAlinea = new RegExp(regexConfig.alinea);
  const rxItem = new RegExp(regexConfig.item);
  const rxCapitulo = new RegExp(regexConfig.capitulo, "i");
  const rxSecao = new RegExp(regexConfig.secao, "i");
  const rxSubsecao = new RegExp(regexConfig.subsecao, "i");

  const docToken = tokens.find((t) => t.type === "DOCUMENT");
  const root = makeNode("DOCUMENT", docToken?.text || "Documento", docToken);
  root.title = docToken?.text;

  const stack: TreeNode[] = [root];
  const top = () => stack[stack.length - 1];

  /** desempilha até que o topo tenha profundidade menor que `depth` */
  const popTo = (depth: number) => {
    while (
      stack.length > 1 &&
      (DEPTH[top().type] ?? 99) >= depth
    ) {
      stack.pop();
    }
  };

  const openNode = (node: TreeNode, depth: number) => {
    popTo(depth);
    top().children.push(node);
    stack.push(node);
  };

  for (const token of tokens) {
    switch (token.type) {
      case "DOCUMENT":
        break;

      case "CAPITULO": {
        const m = token.text.match(rxCapitulo);
        const node = makeNode("CAPITULO", `CAPÍTULO ${m?.[1] ?? ""}`.trim(), token);
        node.number = m?.[1];
        if (m?.[2]) node.title = m[2].trim();
        openNode(node, DEPTH.CAPITULO!);
        break;
      }

      case "TITULO_CAPITULO": {
        const chapter = findOpen(stack, "CAPITULO");
        if (chapter) {
          chapter.title = chapter.title
            ? `${chapter.title} ${token.text}`.trim()
            : token.text;
        }
        break;
      }

      case "SECAO":
      case "SUBSECAO": {
        const isSub = token.type === "SUBSECAO";
        const m = token.text.match(isSub ? rxSubsecao : rxSecao);
        const node = makeNode(
          token.type,
          `${isSub ? "Subseção" : "Seção"} ${m?.[1] ?? ""}`.trim(),
          token
        );
        node.number = m?.[1];
        if (m?.[2]) node.title = m[2].trim();
        openNode(node, isSub ? DEPTH.SUBSECAO! : DEPTH.SECAO!);
        break;
      }

      case "TITULO_SECAO": {
        const section =
          findOpen(stack, "SUBSECAO") ?? findOpen(stack, "SECAO");
        if (section) {
          section.title = section.title
            ? `${section.title} ${token.text}`.trim()
            : token.text;
        }
        break;
      }

      case "ARTIGO": {
        const m = token.text.match(rxArtigo);
        const number = m?.[1] ?? String(token.index);
        const node = makeNode("ARTIGO", `Art. ${number}`, token);
        node.number = number;
        openNode(node, DEPTH.ARTIGO!);

        // caput inicial (texto na mesma linha do "Art. N")
        const caputText = m?.[2]?.trim();
        const caput = makeNode("CAPUT", "Caput");
        caput.text = caputText || "";
        caput.startLine = token.startLine;
        caput.endLine = token.endLine;
        node.children.push(caput);
        break;
      }

      case "CAPUT": {
        // continuação do caput em linhas seguintes
        const article = findOpen(stack, "ARTIGO");
        const caput = article?.children.find((c) => c.type === "CAPUT");
        if (caput) {
          caput.text = caput.text
            ? `${caput.text} ${token.text}`.trim()
            : token.text;
          caput.endLine = token.endLine;
        }
        break;
      }

      case "PARAGRAFO": {
        const m = token.text.match(rxParagrafo);
        const label = m?.[1] ? `§ ${m[1]}º` : "Parágrafo único";
        const node = makeNode("PARAGRAFO", label, token);
        node.number = m?.[1] ?? "único";
        node.text = m?.[2]?.trim() || token.text;
        openNode(node, DEPTH.PARAGRAFO!);
        break;
      }

      case "INCISO": {
        const m = token.text.match(rxInciso);
        const node = makeNode("INCISO", m?.[1] ?? token.text, token);
        node.number = m?.[1];
        node.text = m?.[2]?.trim() || token.text;
        openNode(node, DEPTH.INCISO!);
        break;
      }

      case "ALINEA": {
        const m = token.text.match(rxAlinea);
        const node = makeNode("ALINEA", m?.[1] ? `${m[1]})` : token.text, token);
        node.number = m?.[1];
        node.text = m?.[2]?.trim() || token.text;
        openNode(node, DEPTH.ALINEA!);
        break;
      }

      case "ITEM": {
        const m = token.text.match(rxItem);
        const node = makeNode("ITEM", m?.[1] ? `${m[1]}.` : token.text, token);
        node.number = m?.[1];
        node.text = m?.[2]?.trim() || token.text;
        openNode(node, DEPTH.ITEM!);
        // itens não aninham entre si
        stack.pop();
        break;
      }

      case "OBSERVACAO":
      case "NOVA_REDACAO":
      case "REFERENCIA_LEGAL": {
        const node = makeNode(token.type, token.type, token);
        node.text = token.text;
        top().children.push(node);
        break;
      }

      case "TEXTO": {
        // texto solto: anexa ao nó estrutural aberto mais próximo que aceite texto
        const target = top();
        if (target.type === "DOCUMENT") {
          const node = makeNode("TEXTO", "Texto", token);
          node.text = token.text;
          target.children.push(node);
        } else {
          target.text = target.text
            ? `${target.text} ${token.text}`.trim()
            : token.text;
          target.endLine = token.endLine;
        }
        break;
      }
    }
  }

  return root;
}

function findOpen(stack: TreeNode[], type: TreeNodeType): TreeNode | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === type) return stack[i];
  }
  return undefined;
}
