# Vintrix — Technical Architecture Document

## 1. System Overview

Vintrix adalah platform knowledge eksplorasi codebase multi-repository/multi-workspace. Arsitektur sistem berpusat pada integrasi efisien antara runtime **Bun + ElysiaJS**, indexing engine performa tinggi **XERJ**, dan visualisasi knowledge graph interaktif berbasis **React Flow** (mengadopsi arsitektur visual *Understand-Anything*).

```
┌────────────────────────────────────────────────────────────────────────┐
│                                CLIENT                                  │
│   React / Vite SPA + Tailwind CSS + React Flow (Graph Visualizer)      │
│   (75% Canvas Graph + 360px Sidebar Info/Files + Sliding Code Viewer)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / WebSocket (SSE for Chat)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Bun + ElysiaJS)                        │
│                                                                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Auth & RBAC  │  │ Workspaces &     │  │ AI Context & RAG Service │  │
│  │ (Roles Table)│  │ Remote Syncers   │  │ (Custom OpenAI Client)   │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────────┬─────────────┘  │
│         │                   │                         │                │
└─────────┼───────────────────┼─────────────────────────┼────────────────┘
          │                   │                         │
          ▼                   ▼                         ▼
   ┌──────────────┐    ┌──────────────┐          ┌──────────────┐
   │  PostgreSQL  │    │  Git / SSH   │          │     XERJ     │
   │  (Metadata,  │    │ Remote Syncer│          │(Search/Index │
   │  Workspaces) │    │(SFTP/node-ssh│          │ BM25+Vector) │
   └──────────────┘    └──────┬───────┘          └──────┬───────┘
                              │                         │
                              ▼                         │
                       ┌──────────────┐                 │
                       │ Local Clone  │─────────────────┘
                       │ / Cache Dir  │ (autoindex run per dataset)
                       └──────────────┘
```

---

## 2. Tech Stack Detail

| Layer | Komponen / Pilihan | Justifikasi |
|---|---|---|
| **Frontend UI & Graph** | **React / Vite** + **React Flow** + **Zustand** + **Tailwind CSS** | Mengadopsi arsitektur visual **Understand-Anything**: canvas interactive node-graph (React Flow), 75% graph canvas + 360px sidebar info/files + bottom sliding code viewer via `prism-react-renderer`. |
| **Runtime & Backend** | **Bun** + **ElysiaJS** (TypeScript) | Super cepat (I/O & startup), TypeScript end-to-end, native support WebSocket & streaming SSE, Eden Treaty untuk client type-safety. |
| **Indexing & Search** | **XERJ** (Standalone Binary) | Zero-dependency binary, hybrid BM25 + Vector kNN, AST-aware (symbol & line precision), Elasticsearch-compatible REST API. |
| **Database & ORM** | **PostgreSQL** + **Drizzle ORM** | Relational integrity untuk workspace/permissions/models, Drizzle sangat ringan, cepat, dan type-safe di Bun. |
| **Cache & Job Queue** | **Redis** (atau Bun SQLite/In-Memory for Dev) | Mengelola status background job indexing (clone, pull, index, sync). |
| **SSH/Git Sync** | `@ssh2/sftp-client` / `isomorphic-git` | Menghubungkan remote server / repo, mengunduh file yang dipilih ke storage cache lokal untuk di-index XERJ. |
| **LLM Gateway** | Custom OpenAI Client (`fetch` based) | Mendukung endpoint kustom (OpenAI, OpenRouter, vLLM, Ollama, Groq) dengan streaming SSE langsung ke frontend. |

---

## 3. Database Schema (PostgreSQL)

### 3.1 Roles & Users (RBAC)
```sql
-- 1. Roles (Tabel Role Terpisah untuk RBAC Fleksibel)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- 'owner', 'admin', 'editor', 'viewer'
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]', -- ['workspace:manage', 'source:sync', 'chat:query', 'member:invite']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Workspace Members (Relasi Workspace, User, dan Role)
CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);
```

### 3.2 Code Sources & Specialized Detail Tables
```sql
-- 5. Code Source Types
CREATE TYPE source_type_enum AS ENUM ('git', 'ssh');

-- 6. Code Sources (Metadata Induk & Status Indexing)
CREATE TABLE code_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type source_type_enum NOT NULL,
    local_cache_path VARCHAR(255),
    index_status VARCHAR(20) DEFAULT 'idle', -- 'idle', 'syncing', 'indexing', 'ready', 'failed'
    last_indexed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SSH Source Details (Spesifik Koneksi SSH)
CREATE TABLE ssh_source_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID UNIQUE NOT NULL REFERENCES code_sources(id) ON DELETE CASCADE,
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 22 NOT NULL,
    username VARCHAR(100) NOT NULL,
    auth_type VARCHAR(20) NOT NULL, -- 'password', 'private_key', 'passphrase_key'
    
    -- ISO/IEC 27001 Cryptographic Storage:
    encrypted_credential_payload TEXT NOT NULL, -- AES-256-GCM cipher text
    iv VARCHAR(32) NOT NULL,                    -- 12-byte initialization vector (hex)
    auth_tag VARCHAR(32) NOT NULL,              -- 16-byte authentication tag (hex)
    key_salt VARCHAR(64) NOT NULL,              -- Salt derivation for envelope key
    
    remote_paths JSONB NOT NULL DEFAULT '[]',   -- Multi-select remote directory paths (e.g. ["/var/www/app", "/opt/service"])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Git Source Details (Spesifik Koneksi Git Repository)
CREATE TABLE git_source_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID UNIQUE NOT NULL REFERENCES code_sources(id) ON DELETE CASCADE,
    repository_url VARCHAR(500) NOT NULL,
    branch VARCHAR(100) DEFAULT 'main' NOT NULL,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'none', -- 'none', 'pat', 'ssh_key'
    
    -- ISO/IEC 27001 Cryptographic Storage (Opsional jika repo private):
    encrypted_credential_payload TEXT,
    iv VARCHAR(32),
    auth_tag VARCHAR(32),
    key_salt VARCHAR(64),
    
    subpaths JSONB NOT NULL DEFAULT '[]', -- Monorepo selector (e.g. ["apps/web", "packages/core"])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.3 AI Config, Chat, & Citations
```sql
-- 9. AI Endpoints & Models
CREATE TABLE ai_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255) NOT NULL, -- e.g. https://api.openai.com/v1 or custom vLLM/Ollama
    
    encrypted_api_key TEXT,
    iv VARCHAR(32),
    auth_tag VARCHAR(32),
    key_salt VARCHAR(64),
    
    is_default BOOLEAN DEFAULT false,
    models JSONB NOT NULL DEFAULT '[]', -- ["gpt-4o", "claude-3-5-sonnet", "deepseek-coder"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Chat Sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    selected_model VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Chat Messages & Citations
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]', -- [ { "source": "repo1", "file": "src/auth.ts", "lines": "12-40", "symbol": "verifyToken" } ]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. Dashboard Visual Knowledge Graph (Understand-Anything Architecture)

Mengadopsi pola dari **Understand-Anything**:

```
┌────────────────────────────────────────────────────────┬──────────────────────┐
│  VINTRIX GRAPH VIEW (React Flow Canvas)                │  SIDEBAR (360px)     │
│                                                        │  [Info] [Files]      │
│   ┌──────────────┐         ┌──────────────┐            │                      │
│   │ API Layer    │────────▶│ Service      │            │  Selected Node:      │
│   │ (auth.ts)    │         │ (auth.srv.ts)│            │  authService.ts      │
│   └──────────────┘         └──────┬───────┘            │                      │
│                                   │                    │  • Type: Class       │
│                                   ▼                    │  • Lines: 24-118     │
│                            ┌──────────────┐            │  • Dependencies: 4   │
│                            │ Database     │            │  • Calls: 7          │
│                            │ (user.repo)  │            │                      │
│                            └──────────────┘            │                      │
├────────────────────────────────────────────────────────┴──────────────────────┤
│  BOTTOM DRAWER: Code Viewer (prism-react-renderer)                            │
│  [Expand Modal] src/services/auth.service.ts (Lines 24-118)                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Graph-First Viewport**: 75% layar didedikasikan untuk canvas interaktif React Flow (pan, zoom, hierarchical grouping by layer: API, Service, Data, UI, Utility).
- **Interactive Nodes**: Node merepresentasikan File, Class, atau Function. Memiliki relasi edge (calls, imports, inherits).
- **Sidebar Tabs**:
  - `Info`: Menampilkan summary, AST metrics, dependencies, dan callers dari node yang diklik.
  - `Files`: File explorer tree yang tersinkronisasi langsung dengan graph node.
- **Sliding Code Viewer**: Code viewer berbasis syntax highlighter yang slide-up saat node diklik dengan tombol expand ke full modal.

---

## 5. Security & ISO/IEC 27001 Cryptographic Standards

Untuk memenuhi compliance keamanan dan audit ISO/IEC 27001 (khususnya kontrol A.10 Cryptography dan A.9 Access Control):

1. **Envelope Encryption & Algorithm**:
   - Seluruh rahasia (SSH Private Key, SSH Password, API Key) dienkripsi menggunakan **AES-256-GCM** (Galois/Counter Mode).
   - AES-GCM menyediakan *Authenticated Encryption with Associated Data (AEAD)* untuk mencegah tampering dan replay attacks.
   - Setiap payload enkripsi wajib memiliki:
     - `iv` (12-byte initialization vector acak per encrypt).
     - `auth_tag` (16-byte cryptographic verification tag).
     - `key_salt` (salt unik untuk key derivation via Argon2id / PBKDF2 dari Master Encryption Key).
2. **Key Management & Rotation**:
   - Master Encryption Key (`VINTRIX_MASTER_KEY`) disimpan di environment variable / KMS (AWS KMS, HashiCorp Vault, atau GCP KMS), tidak pernah ditulis ke database.
3. **Workspace Data Isolation**:
   - Isolasi level database diperkuat dengan tenant check (`workspace_id`) di setiap query.
   - Isolasi index XERJ menggunakan prefixed index dataset (`ws_{workspace_id}_{source_id}`).
4. **Zero Code Telemetry**:
   - Code yang disinkronkan hanya dianalisis secara lokal di server Vintrix host dan XERJ indexer. Tidak ada source code mentah yang dikirim ke external cloud selain cuplikan snippet relevan yang dikirim ke LLM yang dipilih sendiri oleh user.
