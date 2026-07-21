# Urban Knowledge Engine

Aplicação web em duas fases para legislação urbanística:

- **Fase 1 — Knowledge Pipeline**: transforma documentos brutos (PDF, DOCX,
  HTML, TXT, Markdown e texto colado) em uma Base de Conhecimento
  estruturada, enriquecida e indexada.
- **Fase 2 — Motor RAG**: consulta essa Base de Conhecimento com perguntas em
  linguagem natural, cruza diferentes legislações e produz respostas
  fundamentadas, sempre citando a origem — sem reprocessar documentos.

## Fase 1 — Knowledge Pipeline

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

**OCR e figuras (PDF):** no Step 1, páginas de PDF sem camada de texto
(digitalizadas) são transcritas via Vision API, e figuras não textuais
(mapas, plantas, diagramas) são detectadas, recortadas e descritas
automaticamente — armazenadas em `DocumentFigure`. No Step 6, cada figura é
vinculada ao artigo/chunk da mesma página; o Visualizador Jurídico (Fase 2)
exibe essas figuras junto ao texto do artigo. Configurável em
Configurações → OCR / Visão (requer `OPENAI_API_KEY`).

## Fase 2 — Motor RAG para Legislação Urbanística

Fluxo de cada pergunta, com rastreabilidade completa persistida em banco:

```
Pergunta → Classificação → Extração de Entidades → Busca Vetorial (Top 30)
        → Busca por Metadados (Top 15) → Busca por Referências Cruzadas
        → Reranking (Top Final) → Construção do Contexto → LLM
        → Validação → Resposta
```

- **Classificação** — categoriza a pergunta (Zoneamento, Recuos, Altura,
  Licenciamento, Alvarás...) para melhorar a recuperação.
- **Extração de Entidades** — identifica cidade, lei, artigo, zona, medidas,
  altura, área, coeficiente, taxa, recuo, documentos, órgãos e normas citados.
- **Busca Vetorial + Metadados** — combina similaridade de embedding com
  correspondência de lei/capítulo/seção/artigo/tema/categoria/palavras-chave.
- **Referências Cruzadas** — se um artigo cita outra lei/decreto/norma, o
  documento referenciado é recuperado automaticamente, mesmo fora do Top 30.
- **Reranking** — reordena os candidatos por relevância real à pergunta
  (LLM); pode ser desativado nas Configurações.
- **Validação** — nunca responde sem evidência, sempre cita artigos
  existentes no contexto recuperado e nunca oculta divergências entre normas.
- **Explicabilidade** — cada resposta guarda o trace completo (consulta →
  chunks recuperados em cada etapa → reranking → prompt final → resposta
  bruta), exposto pelo botão "Como essa resposta foi construída?".

Sem `OPENAI_API_KEY`, o Motor RAG falha graciosamente ao classificar a
pergunta (primeira etapa que depende de IA) — nenhuma pergunta é persistida.

## Stack

| Camada     | Tecnologia                                  |
| ---------- | ------------------------------------------- |
| Frontend   | Next.js 15, React 19, TypeScript, Tailwind 4 (componentes estilo shadcn/ui) |
| Backend    | Node.js + TypeScript (route handlers do Next) |
| Banco      | PostgreSQL + pgvector                       |
| ORM        | Prisma                                      |
| IA         | OpenAI (`gpt-4o-mini` por padrão, configurável nas duas fases) |
| Embeddings | `text-embedding-3-small` (configurável)     |

## Como rodar

```bash
# 1. Banco (PostgreSQL 16 + pgvector)
docker compose up -d

# 2. Variáveis de ambiente
cp .env.example .env
# preencha OPENAI_API_KEY — necessária para o Enriquecimento/Embeddings (Fase 1)
# e para todo o Motor RAG (Fase 2): classificação, extração, reranking, geração

# 3. Dependências + migrações
npm install
npm run db:migrate

# 4. Desenvolvimento
npm run dev            # http://localhost:3000 — tela inicial é o Chat (Fase 2)
```

A Fase 1 (upload e pipeline de documentos) fica em `/pipeline`. Sem
`OPENAI_API_KEY`, os Steps 1–6 da Fase 1 funcionam normalmente; os Steps 7–9
e todo o Motor RAG da Fase 2 falham com mensagem amigável.

## Testes

```bash
npm test                             # testes unitários dos módulos (vitest)
npx tsx scripts/smoke-test.ts        # pipeline Fase 1 contra o banco real (Steps 1–6)
npx tsx scripts/smoke-test-rag.ts    # Motor RAG Fase 2 contra o banco real (requer OPENAI_API_KEY para o fluxo completo)
```

## Estrutura de código

```
src/
  modules/                # cada módulo expõe interface pública e é independente
    ingestion/             # Fase 1 — Tela 1 — upload / texto colado
    extraction/             # Fase 1 — Step 1 — pdfjs-dist (+ OCR/Vision), mammoth, html-to-text
    cleaning/                # Fase 1 — Step 2 — normalização
    tokenizer/                # Fase 1 — Step 3 — lexer de tokens estruturais
    parser/                    # Fase 1 — Step 4 — árvore hierárquica por pilha
    tree/                        # Fase 1 — Step 5 — JSON definitivo da lei
    chunking/                     # Fase 1 — Step 6 — 1 artigo = 1 chunk
    enrichment/                    # Fase 1 — Step 7 — resumo/palavras-chave/tema (JSON)
    embeddings/                     # Fase 1 — Step 8 — vetores em lote com hash
    vector-index/                    # Fase 1 — Step 9 — pgvector + busca por similaridade
    pipeline/                         # Fase 1 — engine: jobs, logs, invalidação incremental
    classification/         # Fase 2 — classificador de perguntas
    entity-extraction/       # Fase 2 — extração de entidades
    retrieval/                # Fase 2 — busca vetorial (embeda a pergunta + pgvector)
    metadata-search/           # Fase 2 — filtro/reordenação por metadados
    reference-search/           # Fase 2 — referências cruzadas entre leis
    reranker/                     # Fase 2 — reranking via LLM
    prompt-builder/                # Fase 2 — construção do contexto e prompt final
    generation/                     # Fase 2 — geração da resposta estruturada
    validation/                      # Fase 2 — nunca sem evidência, nunca oculta conflitos
    citations/                        # Fase 2 — evidências e trace de explicabilidade
    history/                           # Fase 2 — conversas, perguntas, respostas
    feedback/                           # Fase 2 — feedback e favoritos
    rag-engine/                          # Fase 2 — orquestração do fluxo completo
  shared/                  # tipos, configuração padrão, contagem de tokens, utils
  database/                # cliente Prisma
  components/              # UI (dashboard/steps da Fase 1, chat/painéis da Fase 2)
  app/                     # páginas e API routes
    pipeline/               # Fase 1 — dashboard de documentos
    upload/                  # Fase 1 — tela de upload
    settings/                 # Fase 1 — configurações do pipeline
    page.tsx                # Fase 2 — Chat (tela inicial)
    rag/                     # Fase 2 — busca manual, favoritos, comparador, navegação, configurações
    api/rag/                  # Fase 2 — question, chat, article, law, history, references, settings, feedback, favorites, search
prisma/                  # schema + migrações (inclui extensão vector, índice HNSW e tabelas da Fase 2)
tests/                   # testes unitários + fixture de lei de exemplo
```

## Banco de dados

**Fase 1**: `documents`, `tokens`, `chapters`, `sections`, `articles`,
`paragraphs`, `incisos`, `alineas`, `chunks`, `embeddings`, `pipeline_logs`,
`processing_jobs`.

**Fase 2**: `conversation_history`, `questions`, `retrievals`, `answers`,
`prompt_history`, `feedback`, `favorites`.

`app_settings` guarda as configurações editáveis das duas fases (regex,
chunking e IA da Fase 1; modelo, temperatura, Top K/Top Final, reranking e
prompt da Fase 2).

A coluna `embeddings.vector` é `vector(1536)` com índice HNSW (cosseno),
usada tanto para indexar (Fase 1) quanto para a Busca Vetorial da Fase 2.

## Telas

**Fase 1**
- **Base de Conhecimento** (`/pipeline`) — tabela de documentos com ações
  Continuar Pipeline, Reprocessar e Excluir.
- **Novo Documento** (`/upload`) — drag & drop, seletor de arquivo e área de
  colar texto.
- **Documento** (`/documents/:id`) — navegação pelos 9 steps, execução
  individual ou "Executar até o fim", artefatos de cada etapa e Logs.
- **Config. Pipeline** (`/settings`) — regex, parâmetros de chunk, prompt/
  modelo de enriquecimento e modelo de embedding.

**Fase 2**
- **Chat** (`/`, tela inicial) — três colunas: Histórico de conversas à
  esquerda, conversa ao centro (com exemplos de pergunta, classificação,
  resumo executivo, fundamentação, artigos utilizados clicáveis, referências
  cruzadas, alerta de divergência entre normas, nível de confiança, feedback
  e explicabilidade), Painel Jurídico (evidências) à direita.
- **Visualizador Jurídico** (modal) — lei, capítulo, seção, texto integral,
  resumo, palavras-chave, referências e situação do dispositivo.
- **Busca Manual** (`/rag/search`) — por lei, capítulo, seção, artigo,
  palavra ou tema.
- **Navegação Jurídica + Linha do Tempo** (`/rag/law/:id`) — árvore
  lei → capítulo → seção → artigo e eventos de nova redação/revogação
  detectados automaticamente.
- **Comparador** (`/rag/compare`) — diferenças entre dois artigos.
- **Favoritos** (`/rag/favorites`) — perguntas, leis, artigos e respostas
  salvos.
- **Config. IA** (`/rag/settings`) — modelo, temperatura, Top K (vetorial e
  metadados), Top Final, reranking (ativar/desativar), máximo de tokens e
  prompt de geração.

## API — Fase 2

- `POST /api/rag/question`, `POST /api/rag/chat` — pergunta em linguagem
  natural (a segunda continua uma conversa existente).
- `GET /api/rag/article/:id` — Visualizador Jurídico de um artigo.
- `GET /api/rag/law/:id` — Navegação Jurídica + Linha do Tempo de uma lei.
- `GET /api/rag/references/:id` — referências cruzadas de um artigo.
- `GET /api/rag/history`, `GET /api/rag/history/:id` — histórico de
  conversas.
- `GET/PUT /api/rag/settings` — configurações do Motor RAG.
- `POST /api/rag/feedback` — avaliação (👍/👎) de uma resposta.
- `GET/POST /api/rag/favorites`, `DELETE /api/rag/favorites/:id`.
- `GET /api/rag/search?q=` — Busca Manual.

## Exportações (Fase 1)

`GET /api/documents/:id/export?format=` — `json` (estrutura da lei), `tree`
(árvore do parser), `chunks`, `embeddings` (metadados) e `logs`.
