# Vintrix — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** 2026-10-23  
**Status:** Draft

---

## 1. Ringkasan Eksekutif

**Vintrix** adalah platform knowledge berbasis AI yang mengubah codebase dari berbagai repository menjadi knowledge graph interaktif yang bisa dieksplorasi, dicari, dan ditanyakan. Platform ini mengindeks source code dari SSH remote servers atau git repos, membangun graph dari setiap file, fungsi, class, dan dependency — lalu menyediakan chatbox AI yang context-aware per workspace.

**Masalah yang diselesaikan:**  
Kamu baru bergabung ke tim engineering. Codebase-nya 200.000 baris kode, tersebar di belasan repo. Dari mana kamu mulai? Tanpa panduan sistematis, engineer menghabiskan berminggu-minggu membaca code secara buta — tanpa pernah benar-benar melihat big picture.

**Solusi:**  
Vintrix menghentikan cara membaca code secara buta. Workspace terhubung ke repo/SSH, mengindeks code dengan pendekatan hybrid (tree-sitter + LLM), dan memungkinkan siapa pun langsung bertanya kepada AI yang benar-benar memahami codebase tersebut — lengkap dengan referensi `file:line` untuk setiap jawaban.

> **Tujuannya bukan graph yang membuat kamu kagum dengan betapa kompleksnya codebase — melainkan graph yang diam-diam mengajarkan bagaimana setiap bagian saling terhubung.**

---

## 2. Tujuan Produk

| Tujuan | Metric Sukses |
|--------|---------------|
| Stop membaca code secara buta | Engineer langsung melihat big picture arsitektur, bukan baca file satu per satu |
| Kurangi cognitive overhead | Siapa pun bisa langsung query "bagaimana auth flow bekerja?" dan dapat jawaban dengan referensi `file:line` |
| Self-serve knowledge | Zero ketergantungan pada senior untuk pertanyaan arsitektural |
| Multi-repo konteks | Satu chat session bisa cross-reference antar repo dalam satu workspace |

---

## 3. Target Pengguna

| Persona | Kebutuhan |
|---------|-----------|
| **Engineer (semua level)** | Memahami codebase yang tidak familiar tanpa harus membaca ribuan file satu per satu |
| **Engineering Manager** | Setup knowledge workspace untuk tim, invite kolaborator, pantau progress |
| **Senior Engineer** | Share knowledge workspace agar seluruh tim bisa self-serve tanpa terus bertanya |
| **DevOps/Platform** | Connect SSH ke private servers & pilih path mana yang diindeks |

---

## 4. Fitur Inti

### 4.1 Autentikasi & User Management

- Register/login dengan email + password (JWT-based)
- Setiap user yang register otomatis mendapat **default personal workspace** sebagai owner
- Profile management (nama, avatar, API key management)

### 4.2 Workspace Management

**Workspace** adalah unit isolasi knowledge. Satu workspace = satu konteks knowledge.

| Fitur | Keterangan |
|-------|------------|
| Create workspace | Nama, deskripsi, visibility (private/team) |
| Default workspace | Dibuat otomatis saat user register |
| Multi-workspace | Setiap user bisa punya banyak workspace |
| Invite collaborator | Invite by email, role: Owner / Editor / Viewer |
| Workspace settings | Rename, delete, transfer ownership |
| Member management | Lihat member, ubah role, revoke akses |

**Roles:**
- **Owner** — full control, delete workspace, manage billing
- **Editor** — connect repo/SSH, manage index, chat
- **Viewer** — hanya bisa chat, tidak bisa ubah konfigurasi

### 4.3 Code Source Connection (SSH & Git)

Pemisahan data source yang terstruktur dan aman:

#### 4.3.1 Git Repository Connection
- Public / Private repo URL (HTTPS / SSH)
- Branch selection untuk diindeks
- Subpaths selection untuk monorepo
- Kredensial (PAT / SSH Key) tersimpan terenkripsi standar ISO 27001 (AES-256-GCM)
- Auto-reindex on push via webhook (opsional)

#### 4.3.2 SSH Server Connection
- Input: host, port, username, autentikasi (password / private key)
- Kredensial SSH tersimpan terenkripsi dengan envelope encryption AES-256-GCM (ISO 27001 compliant)
- Setelah koneksi berhasil → **file browser interaktif** untuk pilih path
- **Multi-path selection**: user bisa pilih beberapa direktori untuk diindeks
- Koneksi bisa ditest sebelum disimpan
- SSH key management per workspace

#### 4.3.3 Index Management
- Trigger manual reindex
- Lihat status index (pending / running / completed / failed)
- Index log per source
- Selective path exclusion (`.gitignore`-style pattern)
- Index stats: total files, tokens, last updated

### 4.4 Dashboard Visual Knowledge Graph (Understand-Anything Paradigm)

Dashboard Vintrix mengusung layout visual graf interaktif seperti Understand-Anything:
- **Canvas Graph View (React Flow)**: 75% layar menampilkan diagram arsitektur interaktif berjenjang (API, Service, Database, UI, Utility) dengan node (File, Class, Function) dan edge (Calls, Imports, Inherits).
- **Sidebar (360px)**:
  - Tab `Info`: Rincian node terpilih (summary, AST metrics, dependencies, callers).
  - Tab `Files`: Tree struktur file workspace yang tersinkron langsung ke node graph.
- **Sliding Code Viewer**: Code viewer (`prism-react-renderer`) yang slide-up dari bawah saat node diklik, dengan opsi ekspansi ke modal layar penuh.

### 4.5 Knowledge Indexing Engine

Menggunakan **XERJ** sebagai indexing dan search engine tunggal — satu binary statis, tanpa runtime dependency, Elasticsearch-compatible.

#### Pipeline Indexing

```
Source (Git/SSH)
  → xerj autoindex <path>
      ├── File Scanner (detect language, sniff format, filter junk)
      ├── Tree-sitter Parser (code: symbols, functions, classes, imports — dengan file:line)
      ├── BM25 Index (lexical search, exact symbol lookup)
      └── Vector kNN Index (semantic search, embedding lokal)
  → Index tersimpan per dataset, siap di-query
  → LLM Semantic Annotator (query-time: summaries, architectural layer via AI model terpilih)
```

#### Kemampuan Indexing

| Kemampuan | Detail |
|-----------|--------|
| **Autoindex** | `xerj autoindex <folder>` — sniff setiap file, buat index per dataset otomatis, tanpa schema |
| **Multi-language** | TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, dan lainnya via tree-sitter |
| **Symbol-level precision** | Code diindex dengan simbol dan `file:line`, bukan flat text |
| **BM25 + Vector hybrid** | Lexical dan semantic search dikombinasikan, 40x lebih efisien dari grep |
| **Incremental update** | Re-index hanya file yang berubah (fingerprint-based) |
| **Universal format** | Code, markdown, PDF, CSV, JSON, YAML, SQLite dalam satu pipeline |

#### Search Engine (XERJ)

- **Hybrid search**: BM25 lexical + vector kNN, hasil dengan `file:line`
- **Symbol lookup**: go-to-definition style — cari definisi fungsi/class langsung ke baris
- **Cross-repo search**: satu query menjangkau semua source yang diindeks dalam workspace
- **40x lebih efisien** dari raw grep dalam token consumption — agent tidak perlu baca seluruh file
- **Elasticsearch-compatible API**: client existing langsung jalan tanpa perubahan

### 4.5 Custom AI Model Configuration

- **Custom OpenAI-compatible endpoint**: tambah base URL, API Key, model list
- **Built-in providers**: OpenAI, Anthropic, Google Gemini (via compatible endpoint)
- **Model management per user/workspace**:
  - Add model dengan nama custom
  - Set default model per workspace
  - Test connectivity sebelum save

```
Model Config:
- Provider name (label)
- Base URL (e.g. https://api.openai.com/v1)
- API Key (encrypted at rest)
- Model ID (e.g. gpt-4o, claude-3-5-sonnet, deepseek-coder)
- Max context tokens
- Default temperature
```

### 4.6 Chatbox & AI Assistant

Halaman chat utama dengan full AI context awareness:

#### Chat Interface

| Elemen | Keterangan |
|--------|------------|
| **Workspace selector** | Pilih workspace yang jadi kontext, bisa multi-workspace |
| **Model selector** | Pilih model dari daftar yang dikonfigurasi |
| **Chat history** | Persistent per session, bisa rename/delete |
| **Streaming response** | Token-by-token streaming |
| **Code blocks** | Syntax highlighting, copy button, file:line reference clickable |
| **Source citation** | Setiap jawaban menyertakan referensi file:line dari codebase |

#### Kemampuan AI

- **Codebase Q&A**: "Bagaimana auth flow bekerja di repo X?"
- **Architecture explanation**: "Jelaskan layer service dan dependency-nya"
- **Cross-repo context**: Bisa query di lebih dari satu repo dalam satu sesi
- **Guided tour**: Auto-generate walkthrough arsitektur, diurutkan berdasarkan dependency — belajar codebase dalam urutan yang benar
- **Impact analysis**: "Kalau saya ubah fungsi ini, apa yang terdampak?"
- **Code explanation**: Explain specific file/function dengan konteks penuh

#### Prompt Enhancement

- System prompt per workspace (bisa dikustomisasi owner)
- Automatic context injection dari knowledge graph
- Conversation memory dalam satu session

---

## 5. Arsitektur Teknis

### 5.1 Keputusan Backend: ElysiaJS (Bun)

**Dipilih: ElysiaJS dengan Bun runtime**

| Faktor | ElysiaJS/Bun | Rust (Axum/Actix) |
|--------|-------------|-------------------|
| **Performance** | Bun: ~10x lebih cepat dari Node.js | Tertinggi, tapi over-engineered untuk web API |
| **Developer Experience** | TypeScript-native, end-to-end type safety | Learning curve tinggi, kompilasi lambat |
| **Iterasi kecepatan** | Hot reload, minimal boilerplate | Recompile setiap perubahan |
| **Stack konsistensi** | JS/TS di frontend + backend | Dua bahasa berbeda |
| **Library ecosystem** | npm/bun ecosystem (mature) | Crates ecosystem (lebih kecil untuk web) |
| **Produksi readiness** | Discord, Figma, dll sudah pakai Bun | Solid, tapi kompleksitas tinggi |

**Verdict:** ElysiaJS adalah "sweet spot" — performa mendekati Rust untuk I/O-bound workload (web API), tapi dengan DX TypeScript yang jauh superior dan iterasi lebih cepat.

### 5.2 Tech Stack

```
Frontend:
  - Next.js 15 (App Router)
  - TailwindCSS + shadcn/ui
  - TanStack Query (data fetching)
  - Zustand (state management)
  
Backend API:
  - ElysiaJS (Bun runtime)
  - Eden Treaty (type-safe client dari Elysia)
  - JWT (autentikasi)
  - Zod (schema validation)
  
Indexing Engine:
  - XERJ (binary statis, autoindex, BM25 + vector kNN, Elasticsearch-compatible)
  - tree-sitter (built-in di XERJ, parsing multi-bahasa dengan symbol:line)
  - LLM calls untuk semantic annotation (query-time, via model yang dikonfigurasi user)
  
Database:
  - PostgreSQL (users, workspaces, config)
  - pgvector (vector embeddings)
  - Redis (caching, session, job queue)
  
SSH & File Access:
  - node-ssh / @ssh2/sftp-client (koneksi SSH)
  - Queue-based indexing jobs (BullMQ / Bun-native)
  
Infrastructure (target):
  - Docker Compose (development)
  - Kubernetes-ready (production)
```

### 5.3 Referensi Implementation dari Open Source

| Fitur Vintrix | Referensi Implementasi |
|---------------|------------------------|
| Knowledge graph builder | Understand-Anything (tree-sitter + LLM pipeline) |
| Code Indexing & Search | XERJ (autoindex, tree-sitter, BM25 + vector kNN, Elasticsearch API) |
| Hybrid search index | XERJ (BM25 + vector, 40x lebih efisien dari grep) |
| Persistent planning state | Planning-with-files (file-based state management) |

---

## 6. User Flow

### 6.1 Register Flow

```
Register → Auto-create default workspace → Dashboard workspace
```

### 6.2 Setup Workspace Flow

```
Create/Open workspace
  → Connect source (Git repo atau SSH)
  → Test connection
  → Browse & select paths
  → Trigger indexing
  → Monitor progress
  → Workspace ready
```

### 6.3 Chat Flow

```
Open Chat page
  → Select workspace(s) sebagai context
  → Select model
  → Type question
  → AI responds with source citations (file:line)
  → Follow-up questions dalam satu thread
```

### 6.4 Collaboration Flow

```
Workspace owner
  → Invite by email
  → Assign role (Editor/Viewer)
  → Invitee menerima email
  → Invitee accept → akses workspace
```

---

## 7. Halaman & Navigation

| Page | URL | Deskripsi |
|------|-----|-----------|
| Landing | `/` | Marketing, login/register CTA |
| Auth | `/login`, `/register` | Autentikasi |
| Dashboard | `/dashboard` | List semua workspace user |
| Workspace | `/workspace/[id]` | Overview workspace, stats index |
| Sources | `/workspace/[id]/sources` | Manage Git/SSH connections |
| Index | `/workspace/[id]/index` | Monitor & manage index |
| Members | `/workspace/[id]/members` | Invite & manage kolaborator |
| Chat | `/chat` | Chatbox dengan workspace + model picker |
| Chat Thread | `/chat/[threadId]` | Thread spesifik |
| Settings | `/settings` | Profile, API keys, model config |
| Model Config | `/settings/models` | Custom endpoint & model management |

---

## 8. API Design (ElysiaJS)

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Workspace
```
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id
GET    /api/workspaces/:id/members
POST   /api/workspaces/:id/invite
PATCH  /api/workspaces/:id/members/:userId
DELETE /api/workspaces/:id/members/:userId
```

### Sources (Git/SSH)
```
GET    /api/workspaces/:id/sources
POST   /api/workspaces/:id/sources
POST   /api/workspaces/:id/sources/test  (test connection)
DELETE /api/workspaces/:id/sources/:sourceId
POST   /api/workspaces/:id/sources/:sourceId/index  (trigger reindex)
GET    /api/workspaces/:id/sources/:sourceId/status
GET    /api/workspaces/:id/sources/:sourceId/browse (SSH file browser)
```

### Models
```
GET    /api/models
POST   /api/models
PATCH  /api/models/:id
DELETE /api/models/:id
POST   /api/models/:id/test  (test konektivitas)
```

### Chat
```
GET    /api/chats
POST   /api/chats
GET    /api/chats/:id/messages
POST   /api/chats/:id/messages  (streaming via SSE)
DELETE /api/chats/:id
```

### Search
```
POST   /api/workspaces/:id/search
```

---

## 9. Security & Privacy

| Concern | Mitigasi |
|---------|----------|
| SSH credentials | Encrypted at rest (AES-256), tidak pernah di-log |
| API Keys (AI models) | Encrypted, hanya hash yang ditampilkan |
| Workspace isolation | Row-level security di PostgreSQL |
| SSH key injection | Validasi format, sandbox execution |
| Rate limiting | Per-user, per-endpoint |
| CORS | Whitelist origin, JWT rotation |

---

## 10. Non-Functional Requirements

| NFR | Target |
|-----|--------|
| **Indexing throughput** | >= 1000 files/menit per workspace |
| **Chat latency (TTFB)** | < 500ms untuk mulai streaming |
| **Search latency** | < 200ms untuk query hasil |
| **Availability** | 99.5% uptime |
| **Concurrent users** | 100 concurrent chat sessions per instance |

---

## 11. Milestones

### Phase 1 — MVP (Foundation)
- [ ] Auth (register/login, JWT)
- [ ] Workspace CRUD + default workspace on register
- [ ] Git repo connection + basic indexing (file list)
- [ ] Basic chat dengan OpenAI-compatible endpoint
- [ ] Single model configuration

### Phase 2 — Core Knowledge Engine
- [ ] SSH connection + file browser + path selection
- [ ] Full indexing pipeline (tree-sitter + vector)
- [ ] Hybrid search (BM25 + semantic)
- [ ] Knowledge graph per workspace
- [ ] Source citations dalam chat response
- [ ] Multi-model support

### Phase 3 — Collaboration & Polish
- [ ] Workspace member invite + roles
- [ ] Multi-workspace context dalam satu chat
- [ ] Incremental reindex (webhook / schedule)
- [ ] Guided tour generation (walkthrough arsitektur per workspace)
- [ ] Impact analysis query
- [ ] Audit log per workspace

### Phase 4 — Advanced
- [ ] Multimodal indexing (PDF, markdown docs)
- [ ] Knowledge graph visualization (terinspirasi Understand-Anything dashboard)
- [ ] Self-hosted deployment guide
- [ ] API access untuk integrasi eksternal

---

## 12. Open Questions

1. **Self-hosted vs SaaS**: Apakah target awal self-hosted atau SaaS?
2. **Embedding model**: Pakai OpenAI ada/text-embedding-3 atau self-hosted (nomic-embed)?
3. **XERJ Execution**: XERJ binary dijalankan as subprocess oleh ElysiaJS backend, atau via daemon HTTP server XERJ? (XERJ punya REST API Elasticsearch-compatible bawaan)
4. **Storage limit**: Berapa max ukuran workspace yang diindex per plan?
5. **Enterprise SSO**: SAML/OIDC perlu di-scope ke phase mana?

---

## 13. Referensi & Inspirasi

| Proyek | Kontribusi ke Vintrix |
|--------|-----------------------|
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | Tree-sitter + LLM hybrid parsing, knowledge graph model, incremental graph updates |
| [XERJ](https://github.com/xerj-org/xerj) | Core indexing & search engine (autoindex, BM25 + vector kNN, file:line precision, ES-compatible) |
| [Planning-with-files](https://github.com/othmanadi/planning-with-files) | Persistent file-based task & session planning |
