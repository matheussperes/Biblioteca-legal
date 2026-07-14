# Knowledge Pipeline — Base de Conhecimento para RAG (Fase 1)

Aplicação web que transforma documentos brutos (PDF, DOCX, HTML, TXT, Markdown e
texto colado) em uma **Base de Conhecimento estruturada, enriquecida e indexada**,
pronta para utilização por qualquer mecanismo de RAG.

> Esta fase não possui chatbot nem geração de respostas — o objetivo é produzir
> conhecimento estruturado de alta qualidade.

## Pipeline

Cada documento atravessa uma linha de produção com artefatos persistidos em
todas as etapas:

```
Documento → Extração → Limpeza → Tokenização → Parser → Árvore Estrutural
          → Chunkização → Enriquecimento IA → Embeddings → Banco Vetorial
```

Status persistidos: `UPLOADED → EXTRACTED → CLEANED → TOKENIZED → PARSED →
TREE_CREATED → CHUNKED → ENRICHED → EMBEDDED → INDEXED`.

Qualquer etapa pode ser reexecutada isoladamente (ex.: alterou um regex →
refaça a Tokenização); os artefatos posteriores são invalidados automaticamente
e o status retrocede, sem repetir o upload.

## Stack

| Camada     | Tecnologia                                  |
| ---------- | ------------------------------------------- |
| Frontend   | Next.js 15, React 19, TypeScript, Tailwind 4 (componentes estilo shadcn/ui) |
| Backend    | Node.js + TypeScript (route handlers do Next) |
| Banco      | PostgreSQL + pgvector                       |
| ORM        | Prisma                                      |
| IA         | OpenAI (`gpt-4o-mini` por padrão, configurável) |
| Embeddings | `text-embedding-3-small` (configurável)     |

## Como rodar

```bash
# 1. Banco (PostgreSQL 16 + pgvector)
docker compose up -d

# 2. Variáveis de ambiente
cp .env.example .env
# preencha OPENAI_API_KEY para usar os Steps 7 (Enriquecimento) e 8 (Embeddings)

# 3. Dependências + migrações
npm install
npm run db:migrate

# 4. Desenvolvimento
npm run dev            # http://localhost:3000
```

Sem `OPENAI_API_KEY`, os Steps 1–6 funcionam normalmente; os Steps 7–9 falham
com mensagem amigável no log do pipeline.

## Testes

```bash
npm test                        # testes unitários dos módulos (vitest)
npx tsx scripts/smoke-test.ts   # pipeline completo contra o banco real (Steps 1–6)
```

## Estrutura de código

```
src/
  modules/            # cada módulo expõe interface pública e é independente
    ingestion/        # Tela 1 — upload / texto colado
    extraction/       # Step 1 — pdf-parse, mammoth, html-to-text
    cleaning/         # Step 2 — normalização (espaços, quebras, encoding, aspas, hífens)
    tokenizer/        # Step 3 — lexer de tokens estruturais (regex configurável)
    parser/           # Step 4 — árvore hierárquica por pilha
    tree/             # Step 5 — JSON definitivo da lei + achatamento de artigos
    chunking/         # Step 6 — 1 artigo = 1 chunk; divisão apenas entre unidades inteiras
    enrichment/       # Step 7 — resumo, palavras-chave, tema, entidades... (JSON)
    embeddings/       # Step 8 — vetores em lote com hash de conteúdo
    vector-index/     # Step 9 — gravação pgvector + metadados + busca por similaridade
    pipeline/         # engine: jobs, logs, status, invalidação incremental
  shared/             # tipos, configuração padrão, contagem de tokens, utils
  database/           # cliente Prisma
  components/         # UI (dashboard, painéis dos steps)
  app/                # páginas e API routes
prisma/               # schema + migrações (inclui extensão vector e índice HNSW)
tests/                # testes unitários + fixture de lei de exemplo
```

## Banco de dados

Tabelas: `documents`, `tokens`, `chapters`, `sections`, `articles`,
`paragraphs`, `incisos`, `alineas`, `chunks`, `embeddings`, `pipeline_logs`,
`processing_jobs` (+ `app_settings` para as configurações editáveis).

A coluna `embeddings.vector` é `vector(1536)` com índice HNSW (cosseno) para a
busca por similaridade da Fase 2.

## Telas

- **Dashboard** — tabela de documentos (nome, tipo, data, status, nº de artigos,
  chunks, embeddings, indexados) com ações Continuar Pipeline, Reprocessar e Excluir.
- **Upload** — drag & drop, seletor de arquivo e área de colar texto.
- **Documento** — navegação pelos 9 steps com execução/reexecução individual,
  "Executar até o fim", visualização dos artefatos de cada etapa
  (texto extraído, diff da limpeza, tabela de tokens com filtros, árvore clicável,
  JSON da lei, lista de chunks, prompt/resposta/custo do enriquecimento,
  tabela de embeddings, painel de indexação) e aba de Logs/Histórico.
- **Configurações** — editor de regex por tipo de token, parâmetros de chunk
  (size, overlap, máximo de tokens, estratégia), prompt/modelo/temperatura da IA
  e modelo de embedding.

## Exportações

`GET /api/documents/:id/export?format=` — `json` (estrutura da lei), `tree`
(árvore do parser), `chunks`, `embeddings` (metadados) e `logs`.
