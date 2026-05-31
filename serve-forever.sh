#!/bin/bash
cd /home/z/my-project
echo "[$(date)] Starting forever server..." >> /home/z/my-project/forever.log
while true; do
  PORT=3000 NODE_OPTIONS="--max-old-space-size=256" node .next/standalone/server.js >> /home/z/my-project/forever.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 1s..." >> /home/z/my-project/forever.log
  sleep 1
done
