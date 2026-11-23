
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Tea Supply Chain Management System..."

# Check prerequisites
for cmd in node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: $cmd is not installed."
        exit 1
    fi
done

# Check backend configuration
if [[ ! -f "$ROOT_DIR/server/.env" ]]; then
    echo "Error: server/.env not found."
    echo "Copy server/.env.example to server/.env"
    echo "and add your authorized Neon credentials."
    exit 1
fi

# Configure frontend if needed
if [[ ! -f "$ROOT_DIR/client/.env" ]]; then
    cp "$ROOT_DIR/client/.env.example" \
       "$ROOT_DIR/client/.env"
fi

# Install dependencies if missing
if [[ ! -d "$ROOT_DIR/server/node_modules" ]]; then
    (cd "$ROOT_DIR/server" && npm ci)
fi

if [[ ! -d "$ROOT_DIR/client/node_modules" ]]; then
    (cd "$ROOT_DIR/client" && npm ci)
fi

echo "Starting backend..."
(
    cd "$ROOT_DIR/server"
    npm run dev
) &
BACKEND_PID=$!

echo "Starting frontend..."
(
    cd "$ROOT_DIR/client"
    npm run dev
) &
FRONTEND_PID=$!

cleanup() {
    echo "Stopping development services..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"

wait -n "$BACKEND_PID" "$FRONTEND_PID"
