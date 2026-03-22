#!/bin/bash
# Spondic — Deploy to production EC2
# Usage: ./deploy.sh

set -e

SERVER="ubuntu@54.226.205.254"
KEY="$HOME/Downloads/spondic.pem"
REMOTE_DIR="~/spondic"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Deploying Spondic to production..."

# 1. Sync files (excludes frontend, node_modules, etc.)
echo "📦 Syncing files..."
rsync -avz --delete \
  --exclude-from=".rsync-exclude" \
  -e "ssh -i $KEY" \
  . "$SERVER:$REMOTE_DIR/"

# 2. Build and restart services
echo "🔨 Building and restarting services..."
ssh -i "$KEY" "$SERVER" "cd $REMOTE_DIR && sudo docker compose -f $COMPOSE_FILE build && sudo docker compose -f $COMPOSE_FILE up -d"

# 3. Health check
echo "🏥 Checking health..."
sleep 5
ssh -i "$KEY" "$SERVER" "curl -sf http://localhost:8080/health && echo ' ✅ API OK' || echo ' ❌ API FAILED'"
ssh -i "$KEY" "$SERVER" "curl -sf http://localhost:8000/health && echo ' ✅ AI OK' || echo ' ❌ AI FAILED'"

# 4. Show status
echo ""
echo "📊 Service status:"
ssh -i "$KEY" "$SERVER" "sudo docker compose -f $REMOTE_DIR/$COMPOSE_FILE ps"

echo ""
echo "✅ Deploy complete! API: http://54.226.205.254:8080"
