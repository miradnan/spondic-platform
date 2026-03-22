# Spondic

AI-powered RFP response assistant for enterprise sales teams. Win more RFPs in hours, not weeks.

## Repo structure (microservices)

- **`website/`** — Marketing site (Next.js 14, Tailwind). Deploy to Netlify at `domain.com`.
- **`app/`** — Product app (React 18, Vite, Clerk, TanStack Query). Deploy to Netlify at `app.domain.com`.
- **`api/`** — Go API (Echo): auth, projects, RFPs, S3, calls AI service. Deploy to AWS ECS Fargate.
- **`ai/`** — Python AI (FastAPI): parsing, Weaviate, Groq, RAG. Deploy to AWS ECS Fargate.

## Prerequisites

- Node 20+, npm
- Go 1.22+
- Python 3.12+
- Docker (optional, for running API/AI in containers)

## Quick start

### 1. Website

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. App

```bash
cd app
cp .env.example .env   # set VITE_CLERK_PUBLISHABLE_KEY and VITE_API_URL
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign-in/sign-up require a Clerk application.

### 3. API (Go)

```bash
cd api
go run main.go
```

Runs on [http://localhost:8080](http://localhost:8080). `GET /health` returns `{"status":"ok"}`.

### 4. AI (Python)

```bash
cd ai
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs on [http://localhost:8000](http://localhost:8000). `GET /health` returns `{"status":"ok"}`.

## Run with Docker Compose

Run all services (website, app, api, Postgres, Weaviate, ai) in one go:

```bash
docker compose up --build
```

| Service  | URL                      |
|----------|--------------------------|
| Website  | http://localhost:3000     |
| App      | http://localhost:5173     |
| API      | http://localhost:8080     |
| Postgres | localhost:5432 (user `spondic`, db `spondic`) |
| Weaviate | http://localhost:8081     |
| AI       | http://localhost:8000     |

Optional: create a `.env` in the repo root with `GROQ_API_KEY`, `OPENAI_API_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` so the app and AI service have keys. `api/.env` and `ai/.env` are loaded when present (e.g. copy from `.env.example`).

## Environment

- **website** — None required for static/marketing.
- **app** — See `app/.env.example`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`.
- **api** — See `api/.env.example`: `PORT`, `CORS_ORIGINS`, `CLERK_JWKS_URL` (for JWT verification).
- **ai** — See `ai/.env.example`: `PORT`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `WEAVIATE_URL`, `CORS_ORIGINS`.

## Docs

- [RECOMMENDED_STACK.md](docs/RECOMMENDED_STACK.md) — Chosen stack (Clerk, Weaviate, Groq, etc.).
- [TOOLS_RECOMMENDATION.md](docs/TOOLS_RECOMMENDATION.md) — Full tools and alternatives.

## Deployment

- **Website & App:** Netlify (connect repo, set build command and publish directory per app).
- **API & AI:** Build Docker images, push to ECR, run on ECS Fargate (e.g. via AWS Copilot or Terraform).
