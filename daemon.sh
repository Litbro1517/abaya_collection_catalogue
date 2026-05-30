#!/bin/bash
cd /home/z/my-project
# Start the server in background
while true; do
    PORT=3000 node .next/standalone/server.js >> /home/z/my-project/daemon.log 2>&1
    echo "Server exited at $(date), restarting in 3s..." >> /home/z/my-project/daemon.log
    sleep 3
done
