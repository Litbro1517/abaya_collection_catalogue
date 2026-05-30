#!/bin/bash
cd /home/z/my-project

# Close all file descriptors to fully detach
exec 0</dev/null
exec 1>/home/z/my-project/server.log
exec 2>/home/z/my-project/server.log

# Start the server with auto-restart
while true; do
    echo "[$(date)] Starting Next.js server..." >> /home/z/my-project/server.log
    setsid node .next/standalone/server.js &
    SERVER_PID=$!
    
    # Wait for the server to die
    wait $SERVER_PID 2>/dev/null
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/server.log
    sleep 3
done
