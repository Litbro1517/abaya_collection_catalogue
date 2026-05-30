#!/bin/bash
cd /home/z/my-project
while true; do
    PORT=3000 node .next/standalone/server.js
    echo "Server crashed at $(date), restarting in 3s..." >> /home/z/my-project/run-prod.log
    sleep 3
done
