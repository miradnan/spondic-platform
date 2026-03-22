# Database migrations use golang-migrate.
# Install: go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
# Or with Homebrew: brew install migrate

# Load .env if present (export $(cat .env | xargs) or use direnv)
MIGRATIONS_PATH = migrations
DB_URL ?= $(shell grep -E '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2-)

.PHONY: migrate-up migrate-down migrate-create migrate-version

migrate-up:
	@if [ -z "$(DB_URL)" ]; then echo "Set DATABASE_URL or add it to .env"; exit 1; fi
	migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" -verbose up

migrate-down:
	@if [ -z "$(DB_URL)" ]; then echo "Set DATABASE_URL or add it to .env"; exit 1; fi
	migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" -verbose down 1

migrate-force:
	@if [ -z "$(DB_URL)" ] || [ -z "$(V)" ]; then echo "Usage: make migrate-force V=version (e.g. V=1)"; exit 1; fi
	migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" -verbose force $(V)

migrate-version:
	@if [ -z "$(DB_URL)" ]; then echo "Set DATABASE_URL or add it to .env"; exit 1; fi
	migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" version

# Create a new migration: make migrate-create NAME=add_user_preferences
migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-create NAME=description"; exit 1; fi
	@mkdir -p $(MIGRATIONS_PATH)
	migrate create -ext sql -dir $(MIGRATIONS_PATH) -seq $(NAME)
