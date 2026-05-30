#!/bin/bash
cd /home/z/my-project
echo "Starting dev server via .zscripts/dev.sh..."

# Ensure dependencies are installed
bun install --frozen-lockfile 2>/dev/null || bun install 2>/dev/null

# Push database schema
bun run db:push 2>/dev/null

# Build first for production
bun run build 2>/dev/null

# Start production server (more stable than dev)
PORT=3000 node .next/standalone/server.js
