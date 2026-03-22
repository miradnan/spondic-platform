# RFP Response Assistant — Recommended Tools

Based on **RFP Response Assistant Product Brief.docx**, **Spondic Pitch Deck.pptx**, and **Project.md** (Next.js website, React app, Golang backend), here are concrete tool recommendations to build the product.

---

## Summary of What You’re Building

- **Website** (domain.com): marketing/landing — **Next.js**
- **App** (app.domain.com): RFP drafting UI — **React**
- **Backend**: APIs, auth, document processing, RAG, AI — **Golang**
- **Core flow**: Upload past RFPs/docs → index into knowledge base → paste new RFP → AI drafts answers with citations → review & submit

---

## 1. Website (domain.com) — Next.js

| Need | Recommendation | Why |
|------|----------------|----------------|
| Framework | **Next.js 14+** (App Router) | Matches Project.md; great SEO, fast landing/marketing pages |
| Hosting | **Vercel** | Zero-config Next.js, previews, custom domain |
| Styling | **Tailwind CSS** | Fast UI, consistent with app if you use it there too |
| Forms / waitlist | **React Hook Form** + **Resend** or **SendGrid** | Lightweight forms and email for “early customers” / waitlist |

**Alternatives:** Netlify, Cloudflare Pages (if you prefer).

---

## 2. App (app.domain.com) — React

| Need | Recommendation | Why |
|------|----------------|----------------|
| Framework | **React 18+** with **Vite** | Matches Project.md; Vite = fast dev and build |
| Routing | **React Router v6** | SPA routing for dashboard, RFP editor, settings |
| State | **TanStack Query (React Query)** + **Zustand** | Server state (RFPs, docs, answers) + minimal client state |
| Styling | **Tailwind CSS** | Same as website; quick, consistent UI |
| Rich text / RFP editor | **TipTap** or **Lexical** | Headless editors; good for structured Q&A and citations |
| File upload (past RFPs, PDFs, Word) | **react-dropzone** + your backend | Simple, reliable uploads to backend |
| Tables / RFP question list | **TanStack Table** | Sorting, filtering, pagination for 200–500 questions |
| Hosting | **Vercel** or **Cloudflare Pages** | Same as website; separate project for app subdomain |

**Alternatives:** Next.js for app too (single framework); then app.domain.com = Next.js app with React.

---

## 3. Backend — Golang

| Need | Recommendation | Why |
|------|----------------|----------------|
| API framework | **Fiber** or **Echo** or **Gin** | Fast, simple HTTP APIs; good middleware (auth, CORS, logging) |
| OpenAPI | **oapi-codegen** or **go-swagger** | Contract-first APIs; clear for frontend and future integrations |
| Auth | **Clerk** | SSO, JWT, “Enterprise” SSO later; great DX, no custom auth code |
| Database (metadata, users, RFP projects) | **PostgreSQL** + **sqlc** or **GORM** | Relational data; sqlc = type-safe SQL, GORM = quick iteration |
| Document storage (PDFs, Word, past RFPs) | **AWS S3** or **MinIO** (self-hosted) | Matches Product Brief; cheap, scalable object storage |
| Vector DB (RAG knowledge base) | **Weaviate** | Dedicated vector store for RAG; scales well, good for retrieval from day one |
| Embeddings | **OpenAI Embeddings API** or **Cohere** | Good quality; same provider as LLM keeps pipeline simple |
| LLM (answer generation) | **OpenAI GPT-4o** or **Anthropic Claude** | Product Brief; use for “AI drafts answers” and citations |
| RAG / orchestration | **Custom Go services** or **LangChain Go** / **LlamaIndex** (if available) | Chunk docs → embed → retrieve → prompt LLM; Go can call Python microservice if you prefer |
| Background jobs (indexing, long runs) | **Asynq** (Redis) or **Temporal** | Index new documents and run batch “draft all answers” without blocking API |
| Hosting | **Fly.io** or **Railway** or **AWS (ECS/Lambda)** | Fly/Railway = simple deploy; AWS = full control and S3 in same cloud |

**Alternatives:**  
- **Pgvector** if you prefer a single Postgres instance for both relational and vector data.  
- **Python/FastAPI** microservice for “AI pipeline” (RAG + LLM) is recommended; Go backend does auth (Clerk), storage, and API gateway.

---

## 4. AI / RAG Pipeline (aligned with Product Brief)

| Step | Tools |
|------|--------|
| Ingest | Backend receives uploads → store in S3 → queue job |
| Parse | **Unstructured.io** (API or self-host) or **Apache Tika** or **pdfplumber** (Python) | PDF + Word; if Go-only, use Tika or call a small Python/Unstructured service |
| Chunk | Custom logic (e.g. by section + token limit) or **LangChain text splitters** (in Python service) |
| Embed | OpenAI Embeddings (or Cohere) from Go or Python |
| Store | **Weaviate** |
| Retrieve | Vector similarity search in Weaviate + optional keyword (hybrid) |
| Generate | Groq (or OpenAI/Claude) with “answer from context + cite source” prompt |
| Citations | Return source doc + snippet with each answer; show in app (e.g. TipTap/Lexical) |

**Recommendation:**  
- Go for API/auth/storage (validate **Clerk** JWT); **Python/FastAPI** microservice for parse → chunk → embed → **Weaviate** → retrieve → Groq. Use **Unstructured** for parsing.

---

## 5. Auth: **Clerk**

**Clerk** is the chosen auth provider. Use Clerk for sign-up, sign-in, JWT issuance; validate JWTs in the Go backend. Supports SSO and orgs for the Enterprise tier later. Avoid building auth from scratch.

---

## 6. DevOps & Delivery

| Need | Recommendation |
|------|----------------|
| Repos | **GitHub** or **GitLab** (monorepo or website / app / backend split) |
| CI/CD | **GitHub Actions** (or GitLab CI): build, test, deploy website + app + backend |
| Secrets | **Infrastructure:** Vercel env, Fly/Railway env; **App:** backend-only API keys (OpenAI, S3, etc.) |
| Monitoring | **Uptime:** Better Stack or UptimeRobot; **Errors:** Sentry (frontend + backend); **Logs:** Axiom or Grafana Cloud |

---

## 7. Aligning Doc vs Project.md

- **Product Brief:** React + Python/FastAPI + Pinecone/Weaviate + Auth0/Firebase.  
- **Project.md:** Next.js (website) + React (app) + **Golang** (backend).  
- **Decisions:** **Clerk** for auth; **Weaviate** for RAG.

Recommended stack that satisfies **Project.md** and the **product vision**:

- **Website:** Next.js (Vercel).  
- **App:** React (Vite) (Vercel/Cloudflare).  
- **Backend:** **Golang** (Fiber/Echo/Gin), PostgreSQL, S3, **Weaviate** for RAG, Groq for LLM, **Clerk** for auth.  
- **Optional:** **Python/FastAPI** microservice for document parsing + RAG (Unstructured, Weaviate, Groq); Go stays the main API and validates Clerk JWTs.

---

## 8. MVP Build Order (Rough)

1. **Backend (Go):** Auth (Clerk JWT validation), project/RFP CRUD, S3 upload, health APIs.  
2. **App (React):** Login, dashboard, “new RFP” (paste/questions list), file upload, list of projects.  
3. **RAG pipeline:** Ingest → parse → chunk → embed → Weaviate; API “index this doc set”.  
4. **Drafting API:** “Draft answers for this RFP” (retrieve + LLM) with citations.  
5. **App:** Show draft answers and citations, edit, approve, export (e.g. Word/PDF).  
6. **Website (Next.js):** Landing, pricing, waitlist, “early customers” CTA.  
7. **Billing:** Stripe for Starter/Growth/Enterprise (optional for first 10 customers).

---

## 9. Cost Snapshot (MVP)

- **Website + App:** Vercel free/hobby.  
- **Backend:** Fly.io/Railway ~$10–30/mo.  
- **Postgres:** Neon / Supabase / Railway free tier or ~$20/mo.  
- **Vector DB:** Weaviate Cloud free tier or ~$25/mo.  
- **OpenAI:** ~$50–200/mo depending on usage (embeddings + GPT-4o).  
- **S3:** ~$5–20/mo.  
- **Auth:** Clerk free tier for early users.  

**Total MVP:** ~$100–300/mo plus one-time build (aligns with “$5K–$15K MVP” in Product Brief if you use freelancer or technical co-founder).

---

You can treat this as the master list and drop in specific library names (e.g. Echo + sqlc + Weaviate client) when you start implementing each slice.
