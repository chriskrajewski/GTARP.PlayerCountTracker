#!/bin/bash

# Azure App Service Startup Script for Next.js Standalone Application
#
# This script starts the Next.js application on Azure App Services.
# The application must be built with 'output: standalone' in next.config.js
# which creates a self-contained server that doesn't require node_modules.

# Set working directory to the deployed application
cd /home/site/wwwroot

# Log startup information
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Next.js application on Azure App Services"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Working directory: $(pwd)"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Node version: $(node --version)"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] NPM version: $(npm --version)"

# Verify the standalone server exists
if [ ! -f "server.js" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: server.js not found in $(pwd)"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] The application may not have been built with 'output: standalone'"
    exit 1
fi

# Start the standalone Next.js server
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting server with: node server.js"
exec node server.js
