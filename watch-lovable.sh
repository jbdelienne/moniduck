echo "👀 Watching Lovable commits on main..."

while true; do
  git fetch origin main --quiet
  
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)

  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "🆕 Lovable pushed changes — pulling..."
    git pull origin main --no-rebase
    
    # Si Lovable a ajouté des dépendances
    if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
      echo "📦 package.json changed — running bun install..."
      bun install
    fi
    
    echo "✅ Up to date at $(date '+%H:%M:%S')"
  fi

  sleep 15
done