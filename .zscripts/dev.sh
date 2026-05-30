#!/bin/bash
cd /home/z/my-project
echo "[DEV] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install 2>/dev/null
echo "[DEV] Setting up database..."
bun run db:push 2>/dev/null
echo "[DEV] Building production server..."
bun run build 2>/dev/null

echo "[DEV] Copying static files..."
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo "[DEV] Starting production server on port 3000 with auto-restart..."

# Fully detach from terminal
exec 0</dev/null
exec 1>/home/z/my-project/server.log
exec 2>/home/z/my-project/server.log

while true; do
    echo "[$(date)] Starting Next.js server..." >> /home/z/my-project/server.log
    PORT=3000 node .next/standalone/server.js
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/server.log
    sleep 3
done
