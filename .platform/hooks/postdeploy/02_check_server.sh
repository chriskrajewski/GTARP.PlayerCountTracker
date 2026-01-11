#!/bin/bash

# Check if the server process is running after deployment

set +e  # Don't exit on error for this diagnostic script

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Checking server status..."

# Wait a few seconds for the server to start
sleep 5

# Check if node process is running
if pgrep -f "node.*server.js" > /dev/null; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Node.js server process is running"
    ps aux | grep -E "node.*server.js" | grep -v grep
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✗ Node.js server process is NOT running"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Checking for node processes:"
    ps aux | grep node | grep -v grep || echo "No node processes found"
fi

# Check if port is being listened on
if [ ! -z "$PORT" ]; then
    if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Port $PORT is being listened on"
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✗ Port $PORT is NOT being listened on"
    fi
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: PORT environment variable is not set"
fi

# Check recent logs for errors
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Recent application logs (last 20 lines):"
tail -20 /var/log/eb-engine.log 2>/dev/null || echo "Could not read eb-engine.log"
