#!/bin/bash

# Post-deployment verification script for AWS Elastic Beanstalk
# This script runs after the application is deployed to verify the deployment

set -e

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting post-deployment verification..."

# Check if server.js exists
if [ ! -f "/var/app/current/server.js" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: server.js not found in /var/app/current"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] The application may not have been built with 'output: standalone'"
    exit 1
fi

# Verify Node.js version
NODE_VERSION=$(node --version)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Node.js version: $NODE_VERSION"

# Check if .next directory exists
if [ ! -d "/var/app/current/.next" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: .next directory not found"
fi

# Verify environment variables (non-sensitive check)
if [ -z "$NODE_ENV" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: NODE_ENV is not set"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Post-deployment verification completed successfully"
