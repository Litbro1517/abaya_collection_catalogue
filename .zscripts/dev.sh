#!/bin/bash
cd /home/z/my-project
echo "[DEV] Building production server..."
bun install --frozen-lockfile 2>/dev/null || bun install 2>/dev/null
bun run db:push 2>/dev/null
bun run build 2>/dev/null

echo "[DEV] Starting production server on port 3000..."
exec PORT=3000 node .next/standalone/server.js
