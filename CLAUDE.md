# CLAUDE.md — Spondic

## What is this?

AI-powered RFP response assistant for enterprise sales teams. Drafts answers from a knowledge base of past responses and documents using RAG.

## Architecture

Four services (monorepo):

| Service | Stack | Port | Dir |
|---------|-------|------|-----|
| **Website** | Next.js 14, Tailwind | 3000 | `website/` |
| **App** | React 18, Vite, TanStack Query, Tailwind | 5173 | `app/` |
| **API** | Go 1.23, Echo, Postgres, S3 | 8080 | `api/` |
| **AI** | Python 3.12, FastAPI, Weaviate, Groq | 8000 | `ai/` |

Auth: Clerk (JWT). Database: PostgreSQL 16. Vector DB: Weaviate. LLM: Groq. Embeddings: OpenAI/Cohere.

All data is multi-tenant via `organization_id` (Clerk org ID).

## Quick Commands

```bash
# App (React)
cd app && npm install && npm run dev     # Dev server on :5173
cd app && npm run build                  # Production build
cd app && npm run lint                   # ESLint

# Website (Next.js)
cd website && npm install && npm run dev # Dev server on :3000
cd website && npm run build              # Static export to out/

# API (Go)
cd api && go run main.go                 # Dev server on :8080

# AI (Python)
cd ai && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000    # Dev server on :8000

# All services via Docker
docker compose up --build
```

### Database Migrations (api/)

```bash
make migrate-create NAME=add_table  # Create migration files
make migrate-up                     # Apply migrations
make migrate-down                   # Rollback one
make migrate-version                # Show current version
```

## Key Files

- `app/src/App.tsx` — Routes and protected route wrapper
- `app/src/pages/` — Dashboard, RfpNew, RfpView, Chat, KnowledgeBase
- `app/src/components/Layout.tsx` — Sidebar nav, header
- `api/main.go` — All Go routes and handlers
- `api/migrations/` — SQL migrations (golang-migrate)
- `ai/main.py` — FastAPI app with /health, /index, /draft endpoints
- `db/schema.sql` — Full PostgreSQL schema
- `docker-compose.yml` — Local dev orchestration

## Code Conventions

- **TypeScript**: Strict mode, functional components, hooks, interface-based props
- **Styling**: Tailwind utility classes. Color palette: cream (#ede8df), navy (#1a2740), brand-blue (#2d5fa0), brand-gold (#c49a3c)
- **Fonts**: Inter (headings + body), Space Grotesk (logo only)
- **API calls**: TanStack Query with Clerk JWT via `useAuth().getToken()` → `Authorization: Bearer {token}`
- **Go handlers**: `func(c echo.Context) error` pattern, JSON errors as `{"error": "..."}`
- **Python**: FastAPI async endpoints, CORS middleware
- **Vite proxy**: `/api/*` → `http://localhost:8080` in dev
- **Icon**: Use heroicons

## Environment Variables

Each service has `.env.example`. Key vars:

- **App**: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`
- **API**: `DATABASE_URL`, `CLERK_JWKS_URL`, `AWS_S3_BUCKET`, `AI_SERVICE_URL`
- **AI**: `GROQ_API_KEY`, `OPENAI_API_KEY`, `WEAVIATE_URL`

## Multi-Tenancy

All data isolation is enforced via `organization_id`. This is the **single most important architectural constraint**.

### How it works

1. **Clerk JWT** includes an `org_id` claim when the user has an active organization selected. The Go auth middleware (`api/internal/middleware/auth.go`) extracts this and sets it in the Echo context.
2. **Fallback for dev**: If no `org_id` is present in the JWT (personal account, no org selected), the middleware falls back to the user's `sub` (user ID) as the organization_id. This lets the app work in dev without requiring org setup.
3. **Every database query** MUST include `WHERE organization_id = $orgID` — no exceptions. This prevents data leaking across tenants.
4. **Every Weaviate vector search** MUST filter by `organization_id`.
5. **Every S3 file path** MUST be prefixed with `{organization_id}/`.

### Rules for new code

- Go handlers: use `getOrgID(c)` from the auth middleware. If it returns empty, return `400 organization_id is required`.
- Python AI service: every request from the Go API includes `organization_id` in the body. Always pass it to Weaviate filters.
- React app: the Clerk JWT automatically includes `org_id` when an org is active. Use `useOrganization()` to check org state.
- **Never** write a query without `organization_id` scoping. Never expose one tenant's data to another.

### Frontend org setup

The app must ensure users have an active organization. Use Clerk's `<OrganizationSwitcher>` or `<CreateOrganization>` components. If `org_id` is missing from the token, prompt the user to create/select an organization.

## Database

Schema in `db/schema.sql`. Core tables: organizations, teams, team_members, documents, document_chunks, projects, rfp_questions, rfp_answers, rfp_answer_citations, rfp_answer_comments, rfp_answer_history, chats, chat_messages, audit_logs. All tables include `organization_id` for tenant isolation.

## Security Requirements

Security is a **gate feature**, not a nice-to-have — our ICP is enterprise sales teams in regulated industries (Manufacturing, BFSI, Healthcare, Logistics, Infrastructure). All code changes must maintain these guarantees:

- **Multi-tenant isolation**: All queries must scope by `organization_id`. Never leak data across tenants.
- **AES-256 encryption**: Data encrypted at rest and in transit. No plaintext storage.
- **No AI training on user data**: User documents are never sent to model training pipelines. AI runs exclusively on the customer's own knowledge base via RAG.
- **GDPR compliance**: Support data residency in India, EU, and US. Respect deletion requests.
- **Full audit trail**: Every user action is logged to the `audit_logs` table. New features that modify data must include audit log entries.
- **Role-based access control**: Enforce permissions via Clerk org roles. Never expose admin-only actions to regular members.
- **Clerk JWT auth**: All API endpoints (except health checks) must validate Clerk JWTs. No unauthenticated access to user data.
- **No secrets in code**: API keys, tokens, and credentials go in environment variables only. Never commit `.env` files.

When building new features, treat security as a first-class requirement — not something to bolt on after.

## Deployment

- **Website & App**: Netlify (static exports)
- **API & AI**: AWS ECS Fargate (Docker containers)
- **Database**: AWS RDS PostgreSQL
