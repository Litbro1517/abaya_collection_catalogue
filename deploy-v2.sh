#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DEPLOY-V2.SH — Deploy V2 (COD Tunnel + SocialStickyTickets) to Vercel
# ═══════════════════════════════════════════════════════════════
#
# PREREQUISITES:
#   1. A valid GitHub Personal Access Token (with repo scope)
#   2. Vercel CLI installed (npm i -g vercel)
#   3. Vercel project linked (vercel link)
#
# USAGE:
#   chmod +x deploy-v2.sh
#   ./deploy-v2.sh <GITHUB_TOKEN>
#
# WHAT THIS SCRIPT DOES:
#   1. Updates the git remote with the new GitHub token
#   2. Pushes the V2 code to GitHub
#   3. Vercel auto-deploys from GitHub
#
# REQUIRED VERCEL ENVIRONMENT VARIABLES:
#   - DATABASE_URL: PostgreSQL connection string (Supabase)
#   - DIRECT_URL: Direct PostgreSQL connection string (Supabase)
#   - NEXT_PUBLIC_BASE_URL: https://abaya-collection-catalogue-9dum.vercel.app (optional)
#   NOTE: NEXT_PUBLIC_GTM_ID removed — migrated to Cloudflare Zaraz
#
# ═══════════════════════════════════════════════════════════════

set -e

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "❌ Usage: ./deploy-v2.sh <GITHUB_TOKEN>"
  echo ""
  echo "To generate a new GitHub token:"
  echo "  1. Go to https://github.com/settings/tokens"
  echo "  2. Click 'Generate new token (classic)'"
  echo "  3. Select 'repo' scope"
  echo "  4. Copy the token and pass it to this script"
  exit 1
fi

echo "🚀 Deploying V2 changes to Vercel..."
echo ""

# Step 1: Update git remote with new token
echo "📦 Step 1: Updating git remote..."
git remote set-url origin "https://x-access-token:${TOKEN}@github.com/Litbro1517/abaya_collection_catalogue.git"

# Step 2: Push to GitHub
echo "📤 Step 2: Pushing code to GitHub..."
git push origin main

echo ""
echo "✅ Code pushed to GitHub!"
echo "🔄 Vercel will auto-deploy from the GitHub integration."
echo ""
echo "📊 Monitor deployment at:"
echo "   https://vercel.com/dashboard"
echo ""
echo "🌐 Production URL:"
echo "   https://abaya-collection-catalogue-9dum.vercel.app"
echo ""
echo "⚠️  IMPORTANT: Make sure these environment variables are set in Vercel:"
echo "   - DATABASE_URL (PostgreSQL/Supabase connection string)"
echo "   - DIRECT_URL (Supabase direct connection string)"
echo "   NOTE: GTM migrated to Cloudflare Zaraz (no NEXT_PUBLIC_GTM_ID needed)"
