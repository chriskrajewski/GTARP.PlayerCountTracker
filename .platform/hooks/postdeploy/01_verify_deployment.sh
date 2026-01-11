#!/bin/bash

# Post-deployment verification script for AWS Elastic Beanstalk
# This script runs after the application is deployed to verify the deployment

set -e

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting post-deployment verification..."

# Check if server.js exists
if [ ! -f "/var/app/current/server.js" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: server.js not found in /var/app/current"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] The application may not have been built with 'output: standalone'"
    ls -la /var/app/current/ | head -20
    exit 1
fi

# Verify Node.js version
NODE_VERSION=$(node --version)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Node.js version: $NODE_VERSION"

# Check if .next directory exists
if [ ! -d "/var/app/current/.next" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: .next directory not found"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] .next directory exists"
    if [ -d "/var/app/current/.next/static" ]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] .next/static directory exists"
    else
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: .next/static directory not found"
    fi
fi

# Check if public directory exists
if [ ! -d "/var/app/current/public" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: public directory not found"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] public directory exists"
fi

# Verify environment variables (non-sensitive check)
if [ -z "$NODE_ENV" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: NODE_ENV is not set"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] NODE_ENV is set to: $NODE_ENV"
fi

# Check PORT
if [ -z "$PORT" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: PORT is not set"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] PORT is set to: $PORT"
fi

# List key files
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Key files in /var/app/current:"
ls -la /var/app/current/ | grep -E "(server.js|Procfile|package.json|\.next|public)" || true

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Post-deployment verification completed successfully"
