# DocAI — Document Intelligence Assistant

DocAI is a full-stack document-intelligence assistant that lets authenticated users upload PDF and TXT documents, ask questions about their content, and receive concise answers grounded in retrieved source passages. Each answer is accompanied by stored source citations so users can inspect the evidence behind the response instead of relying on an opaque summary.

The project was created to explore a practical question-answering workflow with clear data boundaries: **how can an AI assistant be useful while remaining explicit about what its uploaded documents do—and do not—establish?** DocAI therefore combines document processing, deterministic local retrieval, persistent conversations, and LLM response generation rather than sending an entire document blindly to a model.

## Core workflow

```mermaid
flowchart LR
    A[Authenticated user] --> B[Upload PDF or TXT]
    B --> C[Validate and extract text]
    C --> D[Normalize and chunk document]
    D --> E[Store file and searchable chunks]
    E --> F[Ask a question]
    F --> G[Rank relevant passages]
    G --> H[Generate grounded answer]
    H --> I[Persist answer and citations]
    I --> J[Conversation history]
```

1. An authenticated user uploads a PDF or TXT file.
2. The server validates the extension, MIME type, and file size, then extracts readable text. Scanned image-only PDFs are rejected when no text can be recovered.
3. The text is normalized and divided into overlapping chunks. The current implementation targets approximately 1,100 characters per chunk with a 170-character overlap and caps each document at 360 chunks.
4. The original file is stored through the configured object-storage layer, while document metadata and searchable chunks are persisted in MySQL through Drizzle ORM.
5. When the user asks a question, DocAI ranks relevant chunks using direct term matches, related-term expansion, title matches, and an exact-phrase bonus.
6. Only the selected passages are sent to the language model with instructions to answer from those sources, acknowledge uncertainty, and cite factual claims using bracket labels such as `[1]`.
7. The assistant response, conversation history, and source citations are stored for later review.

## What the project demonstrates

| Capability | Implementation |
| --- | --- |
| Authenticated document workspace | Protected API procedures scope documents, conversations, and messages to the signed-in user. |
| PDF/TXT ingestion | `pdf-parse` handles text-based PDFs; TXT files are decoded directly. Unsupported formats are rejected. |
| Safe upload limits | Files are limited to 7 MB, filenames are normalized, and documents with no readable text are rejected. |
| Explainable retrieval | A deterministic ranking function scores direct terms, related terms, document-title matches, and exact phrases before generation. |
| Grounded answers | The LLM receives only the selected source passages and is instructed not to invent facts or sources. |
| Persistent citations | Each assistant message stores the source document, chunk, filename, and excerpt used for the answer. |
| Conversation history | Users can create conversations tied to a document and retrieve previous messages. |
| Full-stack delivery | React/Vite frontend, tRPC API procedures, Express server, MySQL/Drizzle persistence, object storage, and automated tests. |

## Architecture and data model

The backend is organized around a small set of user-scoped entities:

| Entity | Purpose |
| --- | --- |
| `documents` | Stores ownership, filename, type, size, storage location, processing status, and chunk count. |
| `document_chunks` | Stores normalized searchable passages, order, word counts, and ownership. |
| `conversations` | Stores a user’s question-answering sessions and optional document association. |
| `messages` | Stores user questions and assistant responses in conversation order. |
| `message_citations` | Stores the exact document and excerpt references returned with an assistant response. |

The retrieval implementation is intentionally transparent and dependency-light. It does not claim semantic understanding from a hidden vector score: it tokenizes the question, removes common stop words, expands selected terms with related vocabulary, scores matching chunks, and returns the highest-ranked passages. This makes the retrieval behavior straightforward to test and explain.

## Security and privacy boundaries

DocAI is designed with user ownership and controlled data flow in mind:

- Document, conversation, message, and citation procedures use protected server procedures and verify the current user before reading or modifying records.
- The upload path accepts only PDF and TXT files and enforces the 7 MB limit before processing.
- Files are stored through the configured storage abstraction rather than embedded in database rows.
- The model prompt explicitly limits responses to the supplied source passages and instructs the assistant to state when the sources do not establish an answer.
- The application stores citations as first-class records, making the evidence trail available after the response is generated.
- The system does not claim that a cited answer is automatically correct; users remain responsible for reviewing the original document and the cited excerpts.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Wouter |
| Backend | Node.js, Express, tRPC, TypeScript, Zod |
| Document processing | `pdf-parse`, normalized text extraction, overlapping chunking, deterministic retrieval ranking |
| AI generation | Configured LLM integration through the project’s `invokeLLM` abstraction |
| Persistence | MySQL, Drizzle ORM, Drizzle Kit migrations |
| Storage | Configured object-storage adapter using the project storage layer and S3-compatible support |
| Quality | TypeScript checks, Prettier, Vitest, server-side document-processing and authorization tests |

## Local development

The project uses `pnpm`.

```bash
git clone https://github.com/AYANOKOJI-71/docai-document-intelligence.git
cd docai-document-intelligence
pnpm install
```

Configure the environment required by the project runtime, including the database, authentication, storage, and model-integration settings. Then apply the Drizzle migrations and start the development server:

```bash
pnpm db:push
pnpm dev
```

The available quality commands are:

```bash
pnpm check
pnpm test
pnpm format
pnpm build
```

The exact runtime environment variables are intentionally deployment-specific and should never be committed to source control. Use the project’s environment configuration and deployment platform to provide database credentials, authentication configuration, object-storage settings, and the LLM integration securely.

## Testing focus

The repository includes tests for document processing and authorization behavior. The document-processing tests cover file-type validation, text extraction boundaries, chunking, term ranking, and source citation construction. The authorization tests verify that protected procedures require a signed-in user and that user-scoped data access is enforced by the API layer.

## Limitations and next steps

DocAI currently supports text-based PDF and TXT files; it does not perform OCR on scanned PDFs. Retrieval is deliberately lexical and explainable rather than embedding-based semantic search. The application also depends on the configured model integration for response generation and should be evaluated with representative documents before being used for high-stakes decisions.

Potential future improvements include OCR support, embedding-based retrieval with a hybrid lexical and semantic ranker, streaming responses, document versioning, richer citation highlighting in the UI, background processing for larger files, and additional export formats.

## Project status

DocAI is intended to demonstrate full-stack application development, secure user-scoped data handling, document processing, retrieval-augmented generation, and evidence-aware AI interaction.

## Author

Built by **Sarowar Hossain Rony**.
