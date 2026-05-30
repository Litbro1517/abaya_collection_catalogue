#!/bin/bash
cd /home/z/my-project
while true; do
    echo "Starting dev server at $(date)" >> /home/z/my-project/dev.log
    npx next dev -p 3000 --webpack >> /home/z/my-project/dev.log 2>&1
    EXIT_CODE=$?
    echo "Server exited with code $EXIT_CODE at $(date)" >> /home/z/my-project/dev.log
    sleep 2
done
