# Spondic — Project Scope Document

**Document Ref:** RFP-SCOPE-2025-001
**Version:** 1.0
**Date:** 20 March 2026
**Classification:** Internal — Engineering & Product
**Prepared by:** Project Management

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Objectives](#3-product-vision--objectives)
4. [Target Users & ICP](#4-target-users--icp)
5. [Competitive Landscape](#5-competitive-landscape)
6. [System Architecture](#6-system-architecture)
7. [Technology Stack](#7-technology-stack)
8. [Feature Scope — MVP (Phase 1)](#8-feature-scope--mvp-phase-1)
9. [Feature Scope — Phase 2](#9-feature-scope--phase-2)
10. [Feature Scope — Phase 3](#10-feature-scope--phase-3)
11. [Database Design](#11-database-design)
12. [API Specification](#12-api-specification)
13. [AI/RAG Pipeline](#13-airag-pipeline)
14. [Security & Compliance Requirements](#14-security--compliance-requirements)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Current Implementation Status](#16-current-implementation-status)
17. [MVP Build Plan & Task Breakdown](#17-mvp-build-plan--task-breakdown)
18. [Pricing Model](#18-pricing-model)
19. [Success Metrics](#19-success-metrics)
20. [Risks & Mitigations](#20-risks--mitigations)
21. [Out of Scope](#21-out-of-scope)
22. [Appendix](#22-appendix)

---

## 1. Executive Summary

**Spondic** is an AI-powered RFP response platform for enterprise sales teams. It auto-drafts accurate, source-cited answers to RFP questions by learning from an organization's past wins, product documentation, compliance certificates, and case studies.

The platform uses a Retrieval-Augmented Generation (RAG) architecture: documents are parsed, chunked, and embedded into a vector store. When a new RFP is uploaded, questions are extracted automatically, relevant knowledge is retrieved via semantic search, and a large language model generates tailored responses — each with source citations for human review.

**Core value proposition:** Respond to RFPs in minutes instead of weeks. 3x faster response time, higher win rates, consistent messaging, and a proprietary knowledge base that improves with every submission.

---

## 2. Problem Statement

Responding to enterprise RFPs is one of the most time-consuming, high-stakes activities in B2B sales:

| Pain Point | Impact |
|------------|--------|
| RFPs contain 200–500 questions | 20–40 hours per response |
| Answers exist but are buried in old documents and email threads | Duplicate effort on every RFP |
| Inconsistent answers across submissions | Damaged credibility with buyers |
| Presales and BD teams become bottlenecks | Slower deal velocity |
| Smaller companies can't compete on bandwidth | Lost revenue opportunities |

Sales teams today use generic AI tools (ChatGPT, Copilot) or manual copy-paste from old responses. Neither approach provides source citations, structured workflows, or knowledge base management purpose-built for the RFP response cycle.

---

## 3. Product Vision & Objectives

### Vision
Be the AI-first, affordable, fast-deploy RFP response platform for mid-market and enterprise companies — the alternative to $20–30K/year tools like Loopio and RFPIO.

### Objectives

| # | Objective | Measure |
|---|-----------|---------|
| O1 | Reduce RFP response time by 80%+ | Time-to-draft < 5 minutes for a 50-question RFP (vs. 15–20 hours manually) |
| O2 | Improve answer quality and consistency | Source citation on every AI-generated answer; approval workflow before submission |
| O3 | Build a growing knowledge base | Every approved response feeds back into the KB for future RFPs |
| O4 | Enterprise-grade security and compliance | ISO 27001, SOC 2 Type II, DPDP Act, GDPR — multi-tenant isolation from day one |
| O5 | Fast time-to-value for new customers | < 30 minutes from signup to first AI-drafted RFP |

---

## 4. Target Users & ICP

### Ideal Customer Profile (ICP)

- **Primary:** Enterprise sales and presales teams in regulated industries (Manufacturing, BFSI, Healthcare, Logistics, Infrastructure)
- **Secondary:** IT and procurement consulting firms with high RFP volume
- **Tertiary:** Mid-size SaaS companies, government contractors, professional services firms

### User Personas

| Persona | Role | Primary Need |
|---------|------|--------------|
| **Presales Manager** | Owns RFP pipeline | Faster turnaround, higher win rate, team coordination |
| **Sales Rep / BD** | Drafts responses | Quick first draft, access to past winning answers |
| **Subject Matter Expert** | Reviews technical sections | Side-by-side review, source verification, approval workflow |
| **Sales Operations** | Manages knowledge base | Document upload, tagging, analytics, compliance tracking |
| **CTO / IT Security** | Evaluates vendor security | Compliance certifications, data residency, audit trails |

---

## 5. Competitive Landscape

| Competitor | Price | Target | Our Advantage |
|-----------|-------|--------|---------------|
| **Loopio** | $30K+/year | Enterprise | Too expensive for mid-market; slow to deploy |
| **Responsive (RFPIO)** | $20K+/year | Enterprise | Complex, heavy onboarding |
| **Ombud** | $15K+/year | Mid-Enterprise | Still pricey, less AI-native |
| **Generic AI (ChatGPT)** | $20–240/year | Individual | No citations, no KB, no workflow, no compliance |
| **Spondic** | $60–$2K+/month | Mid-Market to Enterprise | AI-first, affordable, fast setup, source-cited, compliant |

**Our unfair advantage:**
- Purpose-built for the RFP workflow (not a generic AI tool)
- Source citations on every answer (audit trail for regulated industries)
- Knowledge base improves with every submission (network effect per customer)
- Affordable entry point with enterprise-grade security
- India data residency and DPDP Act compliance (underserved market)

---

## 6. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  Website (Next.js)   │    │  App (React + Vite)          │   │
│  │  domain.com          │    │  app.domain.com              │   │
│  │  Port: 3000          │    │  Port: 5173                  │   │
│  │  Netlify             │    │  Netlify                     │   │
│  └──────────────────────┘    └──────────┬───────────────────┘   │
│                                         │ Clerk JWT             │
└─────────────────────────────────────────┼───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND LAYER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Service (Go / Echo)                                 │   │
│  │  Port: 8080 — AWS ECS Fargate                            │   │
│  │                                                          │   │
│  │  Auth (Clerk JWT) · Projects · RFPs · Documents          │   │
│  │  File Upload (S3) · Job Queue · Audit Logs               │   │
│  └───────────┬──────────────────────────┬───────────────────┘   │
│              │                          │                       │
│              ▼                          ▼                       │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │  PostgreSQL 16       │  │  AI Service (Python / FastAPI)  │   │
│  │  AWS RDS             │  │  Port: 8000 — AWS ECS Fargate   │   │
│  │                      │  │                                 │   │
│  │  Multi-tenant data   │  │  Parse · Chunk · Embed · RAG    │   │
│  │  org_id isolation    │  │  Groq LLM · OpenAI Embeddings   │   │
│  └─────────────────────┘  └──────────────┬──────────────────┘   │
│                                          │                       │
│                                          ▼                       │
│                           ┌──────────────────────────┐          │
│                           │  Weaviate (Vector DB)     │          │
│                           │  Semantic search / RAG     │          │
│                           └──────────────────────────┘          │
│                                                                 │
│                           ┌──────────────────────────┐          │
│                           │  AWS S3                   │          │
│                           │  Document file storage     │          │
│                           └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Service Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| App | API | HTTPS + Clerk JWT | All user operations |
| API | PostgreSQL | TCP/5432 | Data persistence |
| API | S3 | AWS SDK | File storage |
| API | AI Service | HTTP/8000 | Index documents, draft answers |
| AI Service | Weaviate | HTTP/8080 | Vector CRUD, semantic search |
| AI Service | Groq API | HTTPS | LLM answer generation |
| AI Service | OpenAI API | HTTPS | Text embeddings |
| AI Service | S3 | AWS SDK | Retrieve uploaded files for parsing |

### Multi-Tenancy Model

All data is scoped by `organization_id` (Clerk org ID). Every database query, vector search, and file operation must include the organization scope. No data leaks across tenants.

---

## 7. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Website** | Next.js 14 (App Router), Tailwind CSS | SEO, static export, marketing pages |
| **App** | React 18, Vite, TanStack Query, Tailwind CSS | Fast SPA, server state management |
| **Rich Text Editor** | TipTap or Lexical | Headless, structured Q&A editing with citations |
| **Authentication** | Clerk | JWT, SSO (Google/Microsoft), SAML on Enterprise, org-based multi-tenancy |
| **API** | Go 1.23, Echo framework | High-performance, type-safe, low memory footprint |
| **Database ORM** | sqlc (preferred) or GORM | Type-safe SQL queries from Go |
| **Database** | PostgreSQL 16 | Relational data, JSONB for metadata, full audit trail |
| **Migrations** | golang-migrate | Versioned, reversible schema changes |
| **Vector DB** | Weaviate | Dedicated vector store for RAG, hybrid search |
| **LLM** | Groq (Llama/Mixtral) | Fast inference, cost-effective |
| **Embeddings** | OpenAI text-embedding-3-small (or Cohere) | High-quality semantic embeddings |
| **Document Parsing** | Unstructured (Python) | PDF, DOCX, XLSX parsing with OCR support |
| **AI Service** | Python 3.12, FastAPI | Async, ecosystem for ML/NLP libraries |
| **File Storage** | AWS S3 | Scalable, encrypted object storage |
| **Background Jobs** | Asynq (Redis) or Celery | Async document processing without blocking API |
| **Icons** | Heroicons | Consistent icon set |
| **Containerization** | Docker, Docker Compose | Local dev orchestration |
| **CI/CD** | GitHub Actions | Build, test, deploy pipeline |
| **Hosting (Frontend)** | Netlify | Static exports, preview deploys |
| **Hosting (Backend)** | AWS ECS Fargate | Serverless containers, auto-scaling |
| **Monitoring** | Sentry (errors), Better Stack (uptime) | Observability |

### Design System

| Element | Value |
|---------|-------|
| **Primary Background** | Cream `#ede8df` |
| **Primary Text / Nav** | Navy `#1a2740` |
| **Brand Blue** | `#2d5fa0` |
| **Brand Gold** | `#c49a3c` |
| **Heading Font** | Playfair Display |
| **Body Font** | Inter |
| **Logo Font** | Anton |

---

## 8. Feature Scope — MVP (Phase 1)

MVP delivers the core upload-to-draft-to-export loop with authentication, knowledge base, and basic analytics.

### 8.1 Authentication & Authorization

| Feature | Details |
|---------|---------|
| User signup/login | Email + password, Google SSO, Microsoft SSO via Clerk |
| Organization management | Create org, invite members, manage roles (Admin / Member) |
| JWT-protected API | All endpoints (except health) validate Clerk JWT |
| Role-based access | Admin: full access. Member: own projects, read-only KB management |
| Session management | Clerk handles session tokens, refresh, and revocation |

### 8.2 RFP Upload & Parsing

| Feature | Details |
|---------|---------|
| File upload | Drag-and-drop or file picker. Supports PDF, DOCX, XLSX, TXT. Max 50MB per file |
| Text paste | Paste RFP questions directly into a text area |
| RFP project creation | Name, description, deadline, assigned team |
| Automated question extraction | AI parses uploaded document to extract individual questions/requirements |
| Section detection | Identifies section headers, question numbering, mandatory vs. optional items |
| Format detection | Detects tabular (Excel) vs. prose (Word/PDF) format and adapts parsing |
| Processing status | Shows upload progress → parsing → ready states |

### 8.3 AI Knowledge Base

| Feature | Details |
|---------|---------|
| Document upload | Upload past RFP responses, product docs, compliance certs, case studies to the KB |
| Supported formats | PDF, DOCX, XLSX, TXT (max 50MB per file) |
| Document metadata | Title, description, source type, upload date, uploaded by |
| Tagging | Organize documents with custom tags per organization |
| Indexing pipeline | Parse → chunk → embed (OpenAI) → store in Weaviate |
| Semantic search | Search the knowledge base by meaning, not just keywords |
| Document status | Processing → Indexed → Failed states with error messages |
| Document management | List, search, filter, delete documents |
| Version tracking | Track document versions and re-index on update |

### 8.4 AI Draft Generation

| Feature | Details |
|---------|---------|
| Auto-draft | For each extracted RFP question, generate an AI-drafted answer |
| RAG retrieval | Retrieve top 3–5 most semantically relevant KB passages per question |
| Source citations | Every AI answer includes the source document name and relevant passage |
| Confidence scoring | Flag low-confidence answers for priority human review |
| Tone adaptation | Adapt response tone based on question type (technical, commercial, narrative) |
| Batch processing | Draft all questions in a single operation (< 3 minutes for 50 questions) |
| Re-generate | Allow user to regenerate a specific answer with additional context |

### 8.5 Review & Edit Interface

| Feature | Details |
|---------|---------|
| Question list view | All extracted RFP questions in a navigable list with status indicators |
| Side-by-side view | RFP question (left) · AI draft (center) · Source citations (right) |
| Rich text editing | Inline editing with formatting (bold, italic, lists, headings) |
| Word count | Live word count per answer (for RFPs with word limits) |
| Section-level status | Draft → In Review → Approved workflow per question |
| Comments | Inline comments and annotations for team collaboration |
| Change history | Track edits with version comparison (diff view) |

### 8.6 Export & Submission

| Feature | Details |
|---------|---------|
| Word export | Clean .docx output with proper headings and formatting |
| PDF export | Formatted PDF for final submission |
| Excel export | For tabular Q&A format RFPs |
| Executive summary | Auto-generated executive summary from approved answers |
| Template matching | Export in the original RFP template format when possible |

### 8.7 Chat / Knowledge Assistant

| Feature | Details |
|---------|---------|
| KB chat | Chat interface to ask questions against the knowledge base |
| Cited responses | Every chat response includes source citations |
| Chat history | Persistent chat sessions per user |
| Suggested prompts | Pre-built prompts for common queries |

### 8.8 Analytics (Basic)

| Feature | Details |
|---------|---------|
| RFP count | Total RFPs processed per organization |
| Time saved | Estimated hours saved vs. manual drafting |
| KB usage | Most-cited documents, search frequency |
| Team activity | RFPs per user, review activity |

### 8.9 Audit Trail

| Feature | Details |
|---------|---------|
| Action logging | Every user action logged to `audit_logs` table |
| Logged events | Document upload/delete, RFP create/submit, answer edit/approve, KB changes |
| Log fields | User ID, action, entity type/ID, metadata (JSONB), IP address, user agent, timestamp |
| Retention | Minimum 12 months |

---

## 9. Feature Scope — Phase 2

| Feature | Details |
|---------|---------|
| **Multi-user team collaboration** | Assign RFP sections to team members, real-time co-editing |
| **CRM integrations** | Salesforce, HubSpot — sync RFP projects with deals/opportunities |
| **Slack/Teams notifications** | Alert team members on assignment, review requests, approvals |
| **Version control & approval workflows** | Multi-stage approval (Draft → Review → Legal → Final) |
| **Compliance scoring** | Score each RFP response for compliance completeness |
| **Custom branding / white-label** | Customer logo, colors, custom domain |
| **SSO enterprise (SAML/Okta)** | Enterprise SSO via Clerk SAML integration |
| **API access** | REST API for third-party integrations (Business & Enterprise tiers) |
| **Advanced analytics** | Win rate tracking, response quality trends, team productivity metrics |
| **Hindi language support** | Full Hindi UI and AI drafting (Beta) |

---

## 10. Feature Scope — Phase 3

| Feature | Details |
|---------|---------|
| **Mobile app** | iOS and Android for review and approval on the go |
| **AI learning from feedback** | Use approved/rejected answers to improve future drafting quality |
| **Competitor intelligence** | Track competitor mentions across RFPs |
| **Template library** | Pre-built answer templates for common RFP sections |
| **Bulk import** | Import entire document libraries from SharePoint, Google Drive, Dropbox |
| **Multi-language expansion** | Additional language support beyond English and Hindi |
| **On-premise deployment** | Self-hosted option for highly regulated enterprises |
| **Billing (Stripe)** | Self-serve subscription management with Starter/Growth/Business/Enterprise tiers |

---

## 11. Database Design

### Core Tables

All tables enforce multi-tenant isolation via `organization_id` (Clerk org ID).

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **organizations** | Tenant registry | `id` (clerk_org_id), `name`, `created_at` |
| **teams** | Teams within an org | `id`, `organization_id`, `name`, soft delete |
| **team_members** | User-team membership | `team_id`, `user_id` (clerk_user_id) |
| **documents** | Uploaded documents (KB + RFP) | `id` (UUID), `organization_id`, `uploaded_by_user_id`, `title`, `source_type`, `file_name`, `file_size_bytes`, `content_hash`, `version`, `status`, `weaviate_object_id` |
| **document_chunks** | Chunked content for RAG | `id` (UUID), `document_id`, `organization_id`, `chunk_index`, `token_count`, `embedding_model`, `weaviate_object_id` |
| **document_tags** | Document-tag associations | `organization_id`, `document_id`, `tag_id` |
| **tags** | Custom tags per org | `id`, `organization_id`, `name` |
| **chats** | Chat sessions | `id` (UUID), `organization_id`, `user_id`, `title` |
| **chat_messages** | Messages in chat | `chat_id`, `role`, `message`, `created_at` |
| **audit_logs** | Full audit trail | `id`, `organization_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata` (JSONB), `ip_address` |
| **document_metrics** | Search/access analytics | `document_id`, `organization_id`, `search_count`, `last_accessed_at` |
| **document_versions** | Version history | `document_id`, `organization_id`, `version`, `previous_embedding_snapshot` |

### Tables to Add (MVP)

The following tables are needed but not yet in the schema:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **projects** | RFP projects | `id` (UUID), `organization_id`, `name`, `description`, `deadline`, `status` (draft/in_progress/completed/submitted), `created_by`, `created_at` |
| **project_documents** | Link RFP files to projects | `project_id`, `document_id` |
| **rfp_questions** | Extracted RFP questions | `id` (UUID), `project_id`, `organization_id`, `question_text`, `section`, `question_number`, `is_mandatory`, `word_limit`, `status` (draft/in_review/approved) |
| **rfp_answers** | AI-drafted + edited answers | `id` (UUID), `question_id`, `organization_id`, `draft_text`, `edited_text`, `final_text`, `confidence_score`, `status`, `approved_by`, `approved_at` |
| **rfp_answer_citations** | Source citations per answer | `id`, `answer_id`, `document_id`, `chunk_id`, `citation_text`, `relevance_score` |
| **rfp_answer_comments** | Review comments | `id`, `answer_id`, `user_id`, `comment_text`, `created_at` |
| **rfp_answer_history** | Edit history | `id`, `answer_id`, `previous_text`, `new_text`, `edited_by`, `edited_at` |

### Default Data

Default teams per organization: Procurement, Technical, Finance, Legal Protection, Business, Risk Management.

---

## 12. API Specification

### API Service (Go — Port 8080)

#### Authentication
All endpoints (except `/health`) require `Authorization: Bearer {clerk_jwt}` header. The middleware validates the JWT against Clerk JWKS and extracts `user_id` and `organization_id`.

#### Endpoints

**Health & Status**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health check |

**Projects (RFP Projects)**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/projects` | Yes | Create a new RFP project |
| GET | `/api/projects` | Yes | List projects for the org (paginated, filterable) |
| GET | `/api/projects/:id` | Yes | Get project details with questions and status |
| PUT | `/api/projects/:id` | Yes | Update project metadata |
| DELETE | `/api/projects/:id` | Yes | Soft-delete a project |

**RFP Upload & Processing**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/rfp` | Yes | Upload RFP document(s) to a project |
| POST | `/api/rfp/:id/parse` | Yes | Trigger AI parsing of uploaded RFP |
| GET | `/api/rfp/:id/questions` | Yes | List extracted questions |
| PUT | `/api/rfp/:id/questions/:qid` | Yes | Update a question (edit text, set mandatory flag) |

**AI Drafting**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/rfp/:id/draft` | Yes | Trigger AI draft generation for all questions |
| POST | `/api/rfp/:id/questions/:qid/redraft` | Yes | Re-generate answer for a specific question |
| GET | `/api/rfp/:id/answers` | Yes | Get all answers with citations |
| PUT | `/api/rfp/:id/answers/:aid` | Yes | Edit an answer |
| POST | `/api/rfp/:id/answers/:aid/approve` | Yes | Approve an answer |
| POST | `/api/rfp/:id/answers/:aid/comment` | Yes | Add a review comment |

**Knowledge Base**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/documents` | Yes | Upload document(s) to KB |
| GET | `/api/documents` | Yes | List KB documents (paginated, filterable by tag) |
| GET | `/api/documents/:id` | Yes | Get document details |
| DELETE | `/api/documents/:id` | Yes | Soft-delete a document |
| POST | `/api/documents/:id/reindex` | Yes | Re-index a document in the vector store |
| GET | `/api/documents/search` | Yes | Semantic search across KB |
| POST | `/api/tags` | Yes | Create a tag |
| GET | `/api/tags` | Yes | List tags for the org |

**Chat**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chats` | Yes | Start a new chat session |
| GET | `/api/chats` | Yes | List chat sessions |
| POST | `/api/chats/:id/messages` | Yes | Send a message (triggers AI response) |
| GET | `/api/chats/:id/messages` | Yes | Get chat history |

**Export**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/rfp/:id/export/docx` | Yes | Export RFP answers as Word document |
| POST | `/api/rfp/:id/export/pdf` | Yes | Export RFP answers as PDF |
| POST | `/api/rfp/:id/export/xlsx` | Yes | Export RFP answers as Excel |

**Analytics**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/overview` | Yes | RFP counts, time saved, KB stats |
| GET | `/api/analytics/team` | Yes | Per-user activity metrics |

**Audit**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/audit-logs` | Yes (Admin) | Query audit logs (paginated, filterable) |

### AI Service (Python — Port 8000)

Internal service called by the Go API. No direct external access.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/parse` | Parse an uploaded document and extract questions/sections |
| POST | `/index` | Parse, chunk, embed, and store document in Weaviate |
| POST | `/draft` | Retrieve relevant KB passages and generate answers via Groq |
| POST | `/chat` | RAG-based chat: retrieve context and generate response |
| POST | `/search` | Semantic search across the KB for a given query |
| DELETE | `/documents/{id}` | Remove document vectors from Weaviate |

---

## 13. AI/RAG Pipeline

### Document Indexing Pipeline

```
Upload (S3) → Retrieve File → Parse (Unstructured) → Chunk → Embed (OpenAI) → Store (Weaviate)
```

| Step | Tool | Details |
|------|------|---------|
| **1. Upload** | AWS S3 | File stored at `{org_id}/documents/{uuid}.{ext}` |
| **2. Parse** | Unstructured (Python) | Extract text from PDF (with OCR), DOCX, XLSX, TXT |
| **3. Chunk** | Custom logic / LangChain splitters | Split into ~500-token chunks with overlap. Preserve section headers as metadata |
| **4. Embed** | OpenAI `text-embedding-3-small` | Generate vector embeddings for each chunk |
| **5. Store** | Weaviate | Store chunks with metadata: `organization_id`, `document_id`, `chunk_index`, `section`, `content` |

### RFP Question Extraction Pipeline

```
Upload RFP → Parse → LLM Extraction → Structured Questions
```

| Step | Details |
|------|---------|
| **1. Parse** | Extract raw text from RFP document using Unstructured |
| **2. Section Detection** | Identify section headers, numbering patterns, table structure |
| **3. Question Extraction** | Use LLM (Groq) to extract individual questions with metadata: section, number, mandatory/optional, word limit |
| **4. Store** | Save extracted questions to `rfp_questions` table |

### Answer Drafting Pipeline

```
Question → Vector Search (Weaviate) → Context Assembly → LLM Generation (Groq) → Citation Mapping
```

| Step | Details |
|------|---------|
| **1. Retrieve** | For each question, vector search Weaviate for top 3–5 matching chunks (scoped by `organization_id`) |
| **2. Context** | Assemble retrieved passages into a structured context block with source metadata |
| **3. Prompt** | Construct prompt: system instructions + question + context + output format (answer + citations) |
| **4. Generate** | Call Groq API to generate a tailored, coherent response |
| **5. Citations** | Map each claim in the response to its source document and passage |
| **6. Confidence** | Score confidence based on retrieval relevance scores. Flag low-confidence (< threshold) for human review |
| **7. Store** | Save draft answer, citations, and confidence to database |

### Chat Pipeline

```
User Message → Vector Search → Context Assembly → LLM Response → Citations
```

Same as drafting pipeline but conversational: includes chat history in the prompt for context continuity.

---

## 14. Security & Compliance Requirements

Security is a **gate feature** — the ICP is enterprise sales teams in regulated industries.

### Certifications & Standards

| Standard | Status | Details |
|----------|--------|---------|
| **ISO/IEC 27001:2022** | Certified (Active) | Bureau Veritas, cert #BV-IS27K-2024-IN-00412, expires March 2026 |
| **SOC 2 Type II** | Compliant | KPMG audit (Oct 2023–Sep 2024), no exceptions. Report available under NDA |
| **India DPDP Act 2023** | Fully compliant | Consent mechanisms, data principal rights, designated DPO |
| **GDPR** | Ready | SCCs, DPAs, right to erasure, 72-hour breach notification |

### Security Requirements (All Code Changes Must Maintain)

| Requirement | Implementation |
|-------------|----------------|
| **Multi-tenant isolation** | All DB queries scoped by `organization_id`. All Weaviate searches filtered by org. S3 paths prefixed by org. Never leak data across tenants |
| **AES-256 encryption at rest** | AWS KMS managed keys. Customer-managed keys on Enterprise tier |
| **TLS 1.2+ in transit** | TLS 1.3 preferred. No plaintext HTTP in production |
| **No AI training on user data** | Documents never sent to LLM training pipelines. AI runs exclusively on customer's KB via RAG |
| **Clerk JWT auth** | All API endpoints (except health) validate Clerk JWTs against JWKS. No unauthenticated access |
| **RBAC** | Permissions enforced via Clerk org roles. Admin-only actions guarded |
| **Full audit trail** | Every data-modifying action logged to `audit_logs` with user, action, entity, metadata, IP |
| **No secrets in code** | API keys, tokens, credentials in environment variables only. Never commit `.env` files |
| **MFA** | Enforced for all platform users via Clerk |
| **Access log retention** | Minimum 12 months |
| **Vulnerability management** | Continuous scanning (Snyk, AWS Inspector). Critical patches within 24 hours |
| **Annual penetration testing** | Third-party pentest. No critical findings |

### Business Continuity & Disaster Recovery

| Parameter | Target |
|-----------|--------|
| **RTO** | < 4 hours |
| **RPO** | < 1 hour |
| **Backup frequency** | Continuous replication + full backup every 24 hours |
| **Backup retention** | 30 days (standard), 1 year (Enterprise) |
| **DR test frequency** | Quarterly |
| **Uptime SLA** | 99.9% monthly |

### Data Residency

| Region | Infrastructure |
|--------|---------------|
| **India (Primary)** | AWS ap-south-1 (Mumbai) |
| **India (Backup)** | AWS ap-southeast-1 (Singapore) |
| **EU** | Available on request (Enterprise) |
| **US** | Available on request (Enterprise) |

---

## 15. Infrastructure & Deployment

### Production Environment

| Component | Service | Details |
|-----------|---------|---------|
| **Website** | Netlify | Static export from Next.js. Custom domain: `Spondic.io` (or `spondic.com`) |
| **App** | Netlify | Static export from Vite/React. Custom domain: `app.Spondic.io` |
| **API** | AWS ECS Fargate | Docker container. Auto-scaling. ALB with TLS termination |
| **AI** | AWS ECS Fargate | Docker container. Auto-scaling. Internal service (no public endpoint) |
| **Database** | AWS RDS PostgreSQL 16 | Multi-AZ, encrypted, automated backups |
| **Vector DB** | Weaviate (ECS or Weaviate Cloud) | Persistent storage, backup-enabled |
| **File Storage** | AWS S3 | Encrypted (SSE-KMS), lifecycle policies |
| **Secrets** | AWS Secrets Manager | API keys, database credentials |
| **CDN** | Netlify (frontend), CloudFront (API if needed) | Edge caching |
| **Monitoring** | Sentry (errors), Better Stack (uptime), CloudWatch (infra) | Alerting |
| **CI/CD** | GitHub Actions | Build → Test → Push to ECR → Deploy to ECS |

### Local Development

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| App | http://localhost:5173 |
| API | http://localhost:8080 |
| AI | http://localhost:8000 |
| PostgreSQL | localhost:5432 |
| Weaviate | http://localhost:8081 |

### Environment Variables

| Service | Key Variables |
|---------|--------------|
| **App** | `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`, `VITE_BUSINESS_NAME` |
| **Website** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DOMAIN`, `NEXT_PUBLIC_BUSINESS_NAME` |
| **API** | `DATABASE_URL`, `CLERK_JWKS_URL`, `AWS_S3_BUCKET`, `AWS_REGION`, `AI_SERVICE_URL`, `CORS_ORIGINS` |
| **AI** | `GROQ_API_KEY`, `OPENAI_API_KEY`, `WEAVIATE_URL`, `AWS_BUCKET_NAME`, `AWS_REGION` |

---

## 16. Current Implementation Status

### Build Progress by Service

| Service | Status | Completion | Details |
|---------|--------|------------|---------|
| **Website** | Partially built | ~70% | Homepage, pricing, product, contact, privacy, terms pages. Functional pricing toggle, FAQ, animations. Branding inconsistency ("Spondic" vs "Spondic" in production env) |
| **App** | Partially built | ~60% | Auth (Clerk), routing, layout/sidebar, file upload (wired to API), chat UI (stubbed API). Knowledge base and RFP view are shells |
| **API** | Scaffolded | ~25% | Echo server, health check, project create/list stubs, S3 file upload works. No database queries, no real JWT verification, no AI service calls |
| **AI** | Scaffolded | ~10% | FastAPI skeleton, health check, `/index` and `/draft` return 501 Not Implemented |
| **Database** | Designed | ~80% | Full schema in `db/schema.sql`, migration files exist. Missing: projects, rfp_questions, rfp_answers tables |
| **Infrastructure** | Docker Compose ready | ~60% | Postgres + Weaviate + API + AI in compose. Website/App commented out (run via npm) |

### What Works End-to-End

1. User can sign up / log in via Clerk (App)
2. User can navigate dashboard, sidebar, pages (App)
3. User can upload files via drag-and-drop → files stored in S3 (App → API → S3)
4. Website marketing pages render correctly

### What's Stubbed (UI exists, backend not wired)

1. Chat interface — messages don't reach AI service
2. Project list — returns empty array
3. RFP view — shows placeholder

### What's Not Built

1. All AI/RAG logic (parsing, chunking, embedding, retrieval, generation)
2. RFP question extraction
3. Answer drafting with citations
4. Review & edit interface
5. Export (Word/PDF/Excel)
6. Knowledge base management UI
7. Analytics dashboard
8. Audit log queries
9. Real JWT verification (Clerk JWKS)
10. All database CRUD operations

---

## 17. MVP Build Plan & Task Breakdown

### Phase 1A — Backend Foundation (Weeks 1–2)

| # | Task | Service | Priority |
|---|------|---------|----------|
| 1 | Implement Clerk JWT verification with JWKS | API | P0 |
| 2 | Set up sqlc or GORM for type-safe DB queries | API | P0 |
| 3 | Implement organization CRUD (sync from Clerk webhook) | API | P0 |
| 4 | Implement projects CRUD (create, list, get, update, delete) | API | P0 |
| 5 | Implement documents CRUD (upload to S3 + save metadata to DB) | API | P0 |
| 6 | Implement tags CRUD | API | P1 |
| 7 | Implement audit log writes on all mutations | API | P0 |
| 8 | Add database migration for projects, rfp_questions, rfp_answers tables | API | P0 |
| 9 | Set up background job queue (Asynq/Redis) for async document processing | API | P1 |

### Phase 1B — AI Pipeline (Weeks 2–4)

| # | Task | Service | Priority |
|---|------|---------|----------|
| 10 | Implement document parsing with Unstructured (PDF, DOCX, XLSX, TXT) | AI | P0 |
| 11 | Implement text chunking with overlap and metadata preservation | AI | P0 |
| 12 | Implement embedding generation via OpenAI API | AI | P0 |
| 13 | Implement Weaviate schema creation and vector storage | AI | P0 |
| 14 | Implement `/index` endpoint (parse → chunk → embed → store) | AI | P0 |
| 15 | Implement RFP question extraction via LLM (Groq) | AI | P0 |
| 16 | Implement `/parse` endpoint for question extraction | AI | P0 |
| 17 | Implement semantic search across org's KB in Weaviate | AI | P0 |
| 18 | Implement answer generation with Groq + citation mapping | AI | P0 |
| 19 | Implement `/draft` endpoint (retrieve → generate → cite) | AI | P0 |
| 20 | Implement `/chat` endpoint (RAG-based conversational) | AI | P1 |
| 21 | Implement `/search` endpoint | AI | P1 |
| 22 | Implement document deletion from Weaviate | AI | P1 |

### Phase 1C — App Frontend (Weeks 3–5)

| # | Task | Service | Priority |
|---|------|---------|----------|
| 23 | Wire dashboard to real projects API (list, create, status) | App | P0 |
| 24 | Build knowledge base page — document list, upload, tag, delete | App | P0 |
| 25 | Build RFP view — question list with status indicators | App | P0 |
| 26 | Build side-by-side review interface (question / AI draft / citations) | App | P0 |
| 27 | Integrate rich text editor (TipTap) for answer editing | App | P0 |
| 28 | Implement section-level approval workflow (Draft / In Review / Approved) | App | P0 |
| 29 | Implement answer re-generation (per question) | App | P1 |
| 30 | Wire chat page to real AI chat endpoint | App | P1 |
| 31 | Build comments/annotations on answers | App | P1 |
| 32 | Implement Word/PDF export (trigger API, download file) | App | P0 |
| 33 | Build basic analytics dashboard | App | P2 |
| 34 | Build audit log viewer (Admin only) | App | P2 |

### Phase 1D — Integration & Polish (Week 5–6)

| # | Task | Service | Priority |
|---|------|---------|----------|
| 35 | End-to-end test: upload RFP → parse → draft → review → export | All | P0 |
| 36 | Fix branding inconsistency (Spondic vs Spondic) | Website | P1 |
| 37 | Error handling and loading states across all pages | App | P1 |
| 38 | Pagination on all list views (projects, documents, questions, audit logs) | API + App | P1 |
| 39 | Rate limiting on API endpoints | API | P1 |
| 40 | Set up CI/CD pipeline (GitHub Actions → ECR → ECS) | DevOps | P1 |
| 41 | Configure production environment (RDS, ECS, S3, secrets) | DevOps | P1 |
| 42 | Deploy to staging and run penetration testing | DevOps | P1 |
| 43 | Performance testing — draft generation under load | AI | P2 |
| 44 | Documentation — API docs, deployment runbook | All | P2 |

---

## 18. Pricing Model

### Tiers

| Feature | Starter | Growth | Business | Enterprise |
|---------|---------|--------|----------|-----------|
| **Price (INR)** | ₹4,999/mo | ₹14,999/mo | ₹34,999/mo | Custom |
| **Price (USD approx)** | ~$60/mo | ~$180/mo | ~$420/mo | Custom |
| **Users** | 3 | 10 | Unlimited | Unlimited |
| **RFPs/month** | 20 | 100 | Unlimited | Unlimited |
| **KB documents** | 100 | 1,000 | 10,000 | Custom |
| **Auth** | Email + Google SSO | + Microsoft SSO | + SAML | + Custom |
| **Support** | Email | Priority email | Dedicated CSM | Dedicated + SLA |
| **API access** | No | No | Yes | Yes |
| **Data residency** | India | India | India + EU | Custom |
| **Customer-managed keys** | No | No | No | Yes |
| **Backup retention** | 30 days | 30 days | 30 days | 1 year |

### Revenue Target

At 10 customers on Growth plan = ~$1,800 MRR from Day 1.
At 50 customers (mixed tiers) = ~$10,000+ MRR within 6 months.

---

## 19. Success Metrics

### Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time-to-first-draft | < 5 minutes (50 questions) | Timer from upload to draft ready |
| AI answer acceptance rate | > 60% of answers used without major edits | Track edited vs. unedited answers |
| Knowledge base utilization | > 80% of answers cite at least one KB source | Citation coverage per RFP |
| User activation | < 30 minutes from signup to first drafted RFP | Onboarding funnel tracking |
| NPS | > 40 | Quarterly survey |

### Business Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Paying customers | 50+ |
| MRR | $10,000+ |
| Churn rate | < 5% monthly |
| RFPs processed | 1,000+ |
| KB documents indexed | 10,000+ |

### Technical Metrics

| Metric | Target |
|--------|--------|
| Uptime | 99.9% monthly |
| API response time (p95) | < 500ms (CRUD), < 180s (draft generation) |
| RTO | < 4 hours |
| RPO | < 1 hour |
| Security incidents | 0 critical/high |

---

## 20. Risks & Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | LLM generates inaccurate or hallucinated answers | High | Medium | Source citations on every answer. Confidence scoring. Mandatory human review before submission |
| R2 | Document parsing fails on complex/scanned PDFs | Medium | Medium | Fallback to OCR (Unstructured). Allow manual question entry. Show parsing confidence |
| R3 | Groq API rate limits or downtime | High | Low | Implement retry with backoff. Consider fallback LLM provider (OpenAI, Claude) |
| R4 | Vector search returns irrelevant results | Medium | Medium | Hybrid search (vector + keyword). Tunable relevance thresholds. Allow user to select KB sources per RFP |
| R5 | Multi-tenant data leak | Critical | Low | Organization scoping on every query. Automated tests for tenant isolation. Penetration testing |
| R6 | Slow draft generation for large RFPs (200+ questions) | Medium | Medium | Parallel question processing. Progress indicator. Async generation with polling |
| R7 | Customer onboarding friction (empty KB) | Medium | High | Provide sample KB documents. Quick-start templates. Guided onboarding flow |
| R8 | Compliance requirements change (DPDP Act regulations) | Medium | Low | Designated DPO. Regular compliance audits. Modular consent/data handling |

---

## 21. Out of Scope

The following are explicitly **not** included in MVP and will be evaluated for future phases:

- Mobile applications (iOS/Android)
- CRM integrations (Salesforce, HubSpot)
- Custom branding / white-label
- Compliance scoring / grading engine
- SSO enterprise (SAML/Okta) — Clerk supports this but not configured in MVP
- Version control / multi-stage approval workflows
- API access for third parties
- Stripe billing integration (manual billing in MVP)
- On-premise deployment option
- Multi-language support beyond English
- Real-time co-editing (collaborative editing)
- Competitor intelligence tracking
- AI model fine-tuning on customer data

---

## 22. Appendix

### A. Reference Documents

| Document | Ref | Description |
|----------|-----|-------------|
| Product Datasheet | RFP-PD-2025-001 | Feature reference and pricing (v2.1, Jan 2025) |
| Compliance Certificate | RFP-COMP-2025-007 | ISO 27001, SOC 2, DPDP Act, GDPR compliance (Jan 2025) |
| Technical Overview | — | 10-slide deck: architecture, process flow, tech stack, MVP scope |
| Product Brief | — | Problem, solution, ICP, competitive landscape, pricing model |
| Recommended Stack | — | Architecture decision: Go API + Python AI, Weaviate, Groq, Clerk |
| Tools Recommendation | — | Detailed tool evaluation and build order |

### B. Key Contacts

| Role | Name | Contact |
|------|------|---------|
| CTO | Aditya Rajan | cto@Spondic.ai |
| Data Protection Officer | Meera Krishnan | dpo@Spondic.ai |
| General | — | hello@Spondic.ai |
| Compliance | — | compliance@Spondic.ai |

### C. Repository Structure

```
rfp/
├── website/          # Next.js 14 marketing site (Port 3000)
├── app/              # React 18 + Vite product app (Port 5173)
├── api/              # Go (Echo) API service (Port 8080)
│   └── migrations/   # PostgreSQL migrations (golang-migrate)
├── ai/               # Python (FastAPI) AI service (Port 8000)
├── db/               # Database schema (schema.sql)
├── docs/             # Product docs, datasheets, compliance certs
├── docker-compose.yml
├── CLAUDE.md         # Developer reference
├── README.md
└── Scope.md          # This document
```

### D. Estimated MVP Cost (Monthly)

| Item | Estimate |
|------|----------|
| Website + App hosting (Netlify) | Free–$19/mo |
| API + AI (ECS Fargate, 2 services) | $50–100/mo |
| PostgreSQL (RDS) | $20–50/mo |
| Weaviate (Weaviate Cloud or ECS) | $25–50/mo |
| S3 storage | $5–20/mo |
| Groq API | $20–100/mo |
| OpenAI Embeddings | $30–100/mo |
| Clerk (Auth) | Free tier–$25/mo |
| Monitoring (Sentry + Better Stack) | Free tier |
| **Total** | **~$150–$450/mo** |

---

*End of Scope Document*
