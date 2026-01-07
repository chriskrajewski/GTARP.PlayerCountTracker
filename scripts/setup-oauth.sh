#!/bin/bash

# OAuth Configuration Setup Script
# This script helps you configure OAuth providers for the admin panel

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     OAuth Providers Configuration Setup                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local first with your Supabase configuration."
    exit 1
fi

echo "📝 Current .env.local configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -E "NEXT_PUBLIC_SUPABASE|SUPABASE_|ENABLED_OAUTH" .env.local || echo "No OAuth configuration found"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if ENABLED_OAUTH_PROVIDERS is set
if grep -q "ENABLED_OAUTH_PROVIDERS" .env.local; then
    echo "✅ ENABLED_OAUTH_PROVIDERS is already configured"
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping configuration..."
        exit 0
    fi
fi

echo ""
echo "🔐 Available OAuth Providers:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  • discord      - Discord OAuth"
echo "  • google       - Google OAuth"
echo "  • github       - GitHub OAuth"
echo "  • microsoft    - Microsoft OAuth"
echo "  • apple        - Apple OAuth"
echo "  • twitch       - Twitch OAuth"
echo "  • spotify      - Spotify OAuth"
echo "  • gitlab       - GitLab OAuth"
echo "  • bitbucket    - Bitbucket OAuth"
echo "  • linkedin     - LinkedIn OAuth"
echo "  • slack        - Slack OAuth"
echo "  • figma        - Figma OAuth"
echo "  • notion       - Notion OAuth"
echo "  • workos       - WorkOS OAuth"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Enter the providers you want to enable (comma-separated):"
echo "   Example: discord,google,github"
echo ""
read -p "Providers: " providers

# Validate input
if [ -z "$providers" ]; then
    echo "❌ No providers specified. Using default: discord"
    providers="discord"
fi

# Remove spaces
providers=$(echo "$providers" | tr -d ' ')

echo ""
echo "🔄 Updating .env.local..."

# Remove existing ENABLED_OAUTH_PROVIDERS line if it exists
if grep -q "ENABLED_OAUTH_PROVIDERS" .env.local; then
    sed -i '' "/ENABLED_OAUTH_PROVIDERS/d" .env.local
fi

# Add new configuration
echo "ENABLED_OAUTH_PROVIDERS=$providers" >> .env.local

echo "✅ Configuration updated!"
echo ""
echo "📝 Updated configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep "ENABLED_OAUTH_PROVIDERS" .env.local
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🚀 Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Ensure providers are enabled in Supabase Dashboard"
echo "   → Authentication → Providers"
echo ""
echo "2. Add OAuth credentials for each provider"
echo ""
echo "3. Configure redirect URLs in both Supabase and OAuth providers:"
echo "   → http://localhost:3000/admin/auth/callback (development)"
echo "   → https://yourdomain.com/admin/auth/callback (production)"
echo ""
echo "4. Restart your dev server:"
echo "   → npm run dev"
echo ""
echo "5. Test the login page:"
echo "   → http://localhost:3000/admin/login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 For more information, see:"
echo "   → docs/OAUTH_CONFIGURATION.md"
echo "   → docs/DYNAMIC_OAUTH_AUTH.md"
echo ""



