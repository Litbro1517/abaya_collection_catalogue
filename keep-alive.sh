#!/bin/bash
cd /home/z/my-project
echo $$ > /tmp/next-server-pid
while true; do
    PORT=3000 node .next/standalone/server.js
    echo "Server died at $(date), restarting in 2s..." >> /tmp/next-server.log
    sleep 2
done
