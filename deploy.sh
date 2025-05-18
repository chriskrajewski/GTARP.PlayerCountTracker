#!/bin/bash
set -e

# Security deployment script for FiveM Player Count Tracker
# This script automates the deployment process with built-in security checks

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Required environment variables are missing."
  echo "Please ensure the following are set:"
  echo "  - SUPABASE_URL"
  echo "  - SUPABASE_ANON_KEY"
  echo "  - NEXT_PUBLIC_SUPABASE_URL"
  echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

# Ensure we're running the latest packages
echo "📦 Updating dependencies..."
npm install

# Check for vulnerable packages
echo "🔒 Running security audit..."
npm run security-audit || {
  echo "⚠️ Security vulnerabilities found in dependencies."
  echo "Review the issues and fix them before deploying."
  exit 1
}

# Run type checking
echo "🔍 Checking TypeScript types..."
npm run check-types || {
  echo "❌ TypeScript errors found. Fix the type issues before deploying."
  exit 1
}

# Run linting
echo "💅 Linting code..."
npm run lint || {
  echo "❌ Linting errors found. Fix the code style issues before deploying."
  exit 1
}

# Build the application
echo "🏗️ Building application..."
NODE_ENV=production npm run build || {
  echo "❌ Build failed. Fix the build issues before deploying."
  exit 1
}

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "⚠️ Vercel CLI not found. Installing globally..."
  npm install -g vercel
fi

# Deploy to Vercel
echo "🚀 Deploying to production..."
vercel --prod || {
  echo "❌ Deployment failed."
  exit 1
}

echo "✅ Deployment successful!"
echo "🔗 Your application is now live at https://fivemstats.krtech.io" 