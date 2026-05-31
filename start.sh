#!/bin/bash
cd /home/z/my-project
while true; do
  PORT=3000 NODE_OPTIONS="--max-old-space-size=1024" node .next/standalone/server.js >> /home/z/my-project/server.log 2>&1
  echo "[$(date)] Restarting..." >> /home/z/my-project/server.log
  sleep 3
done
