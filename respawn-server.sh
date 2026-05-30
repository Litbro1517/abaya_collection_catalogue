#!/bin/bash
cd /home/z/my-project
while true; do
    PORT=3000 node .next/standalone/server.js
    sleep 1
done
