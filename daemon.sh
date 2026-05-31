#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting server..." >> /home/z/my-project/dev-daemon.log
  PORT=3000 NODE_OPTIONS="--max-old-space-size=512" node .next/standalone/server.js >> /home/z/my-project/server.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 3s..." >> /home/z/my-project/dev-daemon.log
  sleep 3
done
