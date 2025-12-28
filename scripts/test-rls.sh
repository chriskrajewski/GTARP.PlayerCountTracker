#!/bin/bash

# RLS Testing Script
# This script tests the RLS implementation with real API calls

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token}"
ANON_KEY="${ANON_KEY:-your-anon-key}"

echo "🔐 RLS Testing Suite"
echo "===================="
echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: Public Read Access (should succeed)
echo -e "${YELLOW}Test 1: Public Read Access${NC}"
echo "Testing: GET /api/live/fivem?serverIds=server1"
if curl -s -X GET "$API_BASE_URL/api/live/fivem?serverIds=server1" \
  -H "Content-Type: application/json" | grep -q "servers"; then
  echo -e "${GREEN}✅ PASS: Public read access works${NC}"
else
  echo -e "${RED}❌ FAIL: Public read access failed${NC}"
fi
echo ""

# Test 2: Admin Write Without Token (should fail)
echo -e "${YELLOW}Test 2: Admin Write Without Token (should fail)${NC}"
echo "Testing: POST /api/admin/servers (no auth)"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/admin/servers" \
  -H "Content-Type: application/json" \
  -d '{"server_name": "Test", "server_id": "test"}')
if echo "$RESPONSE" | grep -q "Admin authentication required"; then
  echo -e "${GREEN}✅ PASS: Admin write correctly rejected without token${NC}"
else
  echo -e "${RED}❌ FAIL: Admin write should require authentication${NC}"
fi
echo ""

# Test 3: Admin Write With Token (should succeed)
echo -e "${YELLOW}Test 3: Admin Write With Token${NC}"
echo "Testing: POST /api/admin/servers (with auth)"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/admin/servers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "RLS Test Server",
    "server_id": "rls-test-'$(date +%s)'",
    "is_active": true,
    "data_collection_enabled": true,
    "display_order": 999
  }')
if echo "$RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✅ PASS: Admin write succeeded with token${NC}"
else
  echo -e "${RED}❌ FAIL: Admin write failed with token${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 4: Notification Banner Dismissal (user-specific)
echo -e "${YELLOW}Test 4: User-Specific Banner Dismissal${NC}"
echo "Testing: POST /api/notification-banners/dismiss"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/notification-banners/dismiss" \
  -H "Content-Type: application/json" \
  -d '{"banner_id": 1}')
if echo "$RESPONSE" | grep -q "dismissed successfully\|Banner not found"; then
  echo -e "${GREEN}✅ PASS: Banner dismissal endpoint works${NC}"
else
  echo -e "${RED}❌ FAIL: Banner dismissal failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Get Notification Banners (public read)
echo -e "${YELLOW}Test 5: Get Notification Banners (public read)${NC}"
echo "Testing: GET /api/notification-banners"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/notification-banners" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "banners"; then
  echo -e "${GREEN}✅ PASS: Public banner read works${NC}"
else
  echo -e "${RED}❌ FAIL: Public banner read failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 6: Admin Dashboard (requires auth)
echo -e "${YELLOW}Test 6: Admin Dashboard (requires auth)${NC}"
echo "Testing: GET /api/admin/dashboard (with auth)"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success\|dashboard"; then
  echo -e "${GREEN}✅ PASS: Admin dashboard accessible with token${NC}"
else
  echo -e "${RED}❌ FAIL: Admin dashboard failed${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 7: Admin Dashboard Without Auth (should fail)
echo -e "${YELLOW}Test 7: Admin Dashboard Without Auth (should fail)${NC}"
echo "Testing: GET /api/admin/dashboard (no auth)"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/dashboard" \
  -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "Admin authentication required"; then
  echo -e "${GREEN}✅ PASS: Admin dashboard correctly rejected without token${NC}"
else
  echo -e "${RED}❌ FAIL: Admin dashboard should require authentication${NC}"
fi
echo ""

echo "🎉 Testing Complete!"
echo "===================="
echo "Note: Some tests may fail if:"
echo "  - API is not running (npm run dev)"
echo "  - ADMIN_TOKEN is not set correctly"
echo "  - Database doesn't have test data"
