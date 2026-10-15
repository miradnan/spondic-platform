#!/bin/bash
# Spondic — Deploy to Railway (project smooth-harbor, services spondic-api / spondic-ai)
# Usage: ./deploy.sh
# Usage: ./deploy.sh "commit message"
#
# Requires: railway CLI (logged in), psql, python3.

set -e

PROJECT="smooth-harbor"
ENVIRONMENT="production"
API_SERVICE="spondic-api"
AI_SERVICE="spondic-ai"
PUBLIC_URL="https://api.spondic.com"
FALLBACK_URL="https://spondic-api-production.up.railway.app"

cd "$(dirname "$0")"

echo "🚀 Deploying Spondic to Railway ($PROJECT)..."
railway link -p "$PROJECT" -e "$ENVIRONMENT" >/dev/null

# 1. Commit and push (if there are changes)
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-deploy: $(date +%Y-%m-%d_%H:%M)}"
  echo "📝 Committing: $MSG"
  git add -A
  git commit -m "$MSG"
  git push
else
  echo "📝 No uncommitted changes"
  # Push any unpushed commits
  if [ -n "$(git log @{u}..HEAD 2>/dev/null)" ]; then
    echo "📤 Pushing unpushed commits..."
    git push
  fi
fi

# 2. Run pending migrations
# Postgres is only reachable from outside Railway through PgBouncer's TCP proxy,
# which pools per transaction, so golang-migrate's session advisory lock can't be
# used. Each pending file is applied in one transaction together with the
# schema_migrations update, keeping golang-migrate's bookkeeping in sync.
echo "🗃️  Running migrations..."
eval "$(railway variable list -s PgBouncer --json | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("export PGHOST=%s PGPORT=%s" % (d["RAILWAY_TCP_PROXY_DOMAIN"], d["RAILWAY_TCP_PROXY_PORT"]))')"
eval "$(railway variable list -s "$API_SERVICE" --json | python3 -c '
import json, shlex, sys
from urllib.parse import urlparse
u = urlparse(json.load(sys.stdin)["DATABASE_URL"])
print("export PGUSER=%s PGPASSWORD=%s PGDATABASE=%s" % (shlex.quote(u.username), shlex.quote(u.password), shlex.quote(u.path.lstrip("/"))))')"
export PGCONNECT_TIMEOUT=10

CURRENT=$(psql -Atc "SELECT COALESCE(MAX(version), 0) FROM schema_migrations WHERE NOT dirty")
APPLIED=0
for f in api/migrations/*.up.sql; do
  VERSION=$((10#$(basename "$f" | cut -d_ -f1)))
  if [ "$VERSION" -gt "$CURRENT" ]; then
    echo "   applying $(basename "$f")"
    { cat "$f"; echo; echo "DELETE FROM schema_migrations; INSERT INTO schema_migrations (version, dirty) VALUES ($VERSION, false);"; } \
      | psql -v ON_ERROR_STOP=1 -q --single-transaction >/dev/null
    APPLIED=$((APPLIED + 1))
  fi
done
echo "   $APPLIED applied (schema version $(psql -Atc 'SELECT version FROM schema_migrations'))"
unset PGPASSWORD

# 3. Build and deploy services (waits for each build)
echo "🤖 Deploying $AI_SERVICE..."
railway up ai --path-as-root -s "$AI_SERVICE" --ci
echo "🔨 Deploying $API_SERVICE..."
railway up api --path-as-root -s "$API_SERVICE" --ci

# 4. Health checks
echo "🏥 Checking health..."
sleep 15
for URL in "$PUBLIC_URL" "$FALLBACK_URL"; do
  if curl -sf -m 10 "$URL/health" >/dev/null; then
    echo " ✅ API OK ($URL)"
    break
  fi
  echo " ❌ API not healthy at $URL"
done
railway ssh -s "$API_SERVICE" -- wget -qO- -T 10 "http://$AI_SERVICE.railway.internal:8000/health" 2>/dev/null \
  | grep -q ok && echo " ✅ AI OK (via private network)" || echo " ❌ AI FAILED"

# 5. Show status
echo ""
echo "📊 Service status:"
railway service list

echo ""
echo "✅ Deploy complete! API: $PUBLIC_URL"
