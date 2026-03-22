# Database schema

PostgreSQL schema for Spondic.

## Option 1: Versioned migrations (recommended) — Go

We use **[golang-migrate](https://github.com/golang-migrate/migrate)** so the API can run and roll back migrations.

- **Migrations live in:** `api/migrations/`
- **Up:** `000001_initial_schema.up.sql`
- **Down:** `000001_initial_schema.down.sql`

### Install migrate CLI

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
# Or: brew install migrate
```

### Run migrations

From the **api** directory, with `DATABASE_URL` in `.env`:

```bash
cd api
make migrate-up
```

Or directly:

```bash
migrate -path api/migrations -database "postgres://user:pass@localhost:5432/spondic?sslmode=disable" -verbose up
```

### Other commands

```bash
make migrate-down    # Roll back one migration
make migrate-version  # Show current version
make migrate-create NAME=add_user_preferences  # New migration
```

---

## Option 2: One-off schema (no versioning)

The file **`db/schema.sql`** is a single script that creates everything. Use it for a fresh DB or reference only.

```bash
createdb spondic
psql "$DATABASE_URL" -f db/schema.sql
```

---

## Tables

| Table             | Description                    |
|-------------------|--------------------------------|
| organizations     | Clerk org IDs                  |
| teams             | Teams per organization         |
| team_members      | User–team membership           |
| tags              | Tags per organization          |
| documents         | Uploaded documents (multi-tenant) |
| document_chunks   | Chunks for RAG/Weaviate        |
| document_tags     | Document–tag links             |
| audit_logs        | Audit trail                    |
| document_metrics  | Per-document search/access     |
| document_versions | Document versioning/snapshots  |
| chats             | Chat sessions                  |
| chat_messages     | Messages in each chat          |

---

## Using Python instead

If you prefer to run migrations from the **ai** service (Python), you can use **[Alembic](https://alembic.sqlalchemy.org/)** (with SQLAlchemy) or **[yoyo-migrations](https://ollycope.com/software/yoyo/latest/)**. The migration SQL in `api/migrations/` can be reused or mirrored there; the schema is the same.
