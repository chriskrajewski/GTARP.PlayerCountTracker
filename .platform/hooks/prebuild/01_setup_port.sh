#!/bin/bash

# Pre-build hook to ensure PORT is set for Next.js
# Elastic Beanstalk sets PORT automatically, but we ensure it's available

set -e

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Pre-build hook: Setting up PORT environment variable"

# Elastic Beanstalk automatically sets PORT, but we log it for debugging
if [ -z "$PORT" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: PORT not set, using default 8080"
    export PORT=8080
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] PORT is set to: $PORT"
fi
