#!/bin/bash
# Spondic — Deploy to production EC2
# Usage: ./deploy.sh
# Usage: ./deploy.sh "commit message"

set -e

SERVER="ubuntu@54.144.103.188"
KEY="./spondic.pem"
REMOTE_DIR="/home/ubuntu/spondic"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Deploying Spondic to production..."

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

# 2. Sync files (excludes frontend, node_modules, etc.)
echo "📦 Syncing files..."
rsync -avz --delete \
  --exclude-from=".rsync-exclude" \
  -e "ssh -i $KEY" \
  . "$SERVER:$REMOTE_DIR/"

# 3. Run database migrations
echo "🗃️  Running migrations..."
ssh -i "$KEY" "$SERVER" "cd $REMOTE_DIR && for f in api/migrations/*.up.sql; do sudo docker compose -f $COMPOSE_FILE exec -T postgres psql -U spondic -d spondic < \"\$f\" 2>&1 | grep -v 'already exists' | grep -E 'CREATE|ALTER|INSERT|ERROR' || true; done"

# 4. Build and restart Docker services (API, Postgres, Weaviate)
echo "🔨 Building and restarting Docker services..."
ssh -i "$KEY" "$SERVER" "cd $REMOTE_DIR && sudo docker compose -f $COMPOSE_FILE build && sudo docker compose -f $COMPOSE_FILE up -d"

# 5. Restart AI service (runs natively via systemd)
echo "🤖 Restarting AI service..."
ssh -i "$KEY" "$SERVER" "cd $REMOTE_DIR/ai && .venv/bin/pip install -q -r requirements.txt 2>&1 | tail -1; sudo systemctl restart spondic-ai.service"

# 6. Health checks
echo "🏥 Checking health..."
sleep 15
ssh -i "$KEY" "$SERVER" "curl -sf http://localhost:8080/health && echo ' ✅ API OK' || echo ' ❌ API FAILED'"
ssh -i "$KEY" "$SERVER" "curl -sf http://localhost:8000/health && echo ' ✅ AI OK' || echo ' ❌ AI FAILED'"

# 7. Show status
echo ""
echo "📊 Service status:"
ssh -i "$KEY" "$SERVER" "sudo docker compose -f $REMOTE_DIR/$COMPOSE_FILE ps && echo '---' && sudo systemctl status spondic-ai.service --no-pager | head -3"

echo ""
echo "✅ Deploy complete! API: https://api.spondic.com"
