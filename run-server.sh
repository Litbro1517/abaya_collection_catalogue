#!/bin/bash
cd /home/z/my-project
while true; do
  PORT=3000 node .next/standalone/server.js 2>&1
  echo "[$(date)] Server exited with $?, restarting in 3s..." >&2
  sleep 3
done
