#!/bin/bash

# Test script for notification banners API
# This script tests creating, reading, updating, and deleting notification banners

set -e

# Configuration
API_URL="http://localhost:3000/api/notification-banners"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Notification Banners API Test Suite ===${NC}\n"

# Test 1: Create a banner with plain text
echo -e "${YELLOW}Test 1: Create banner with plain text${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Test Banner",
    "message": "This is a test banner",
    "type": "info",
    "priority": 5,
    "is_active": true,
    "is_dismissible": true
  }')

BANNER_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$BANNER_ID" ]; then
  echo -e "${RED}✗ Failed to create banner${NC}"
  echo "$RESPONSE"
  exit 1
fi
echo -e "${GREEN}✓ Banner created with ID: $BANNER_ID${NC}\n"

# Test 2: Create a banner with markdown
echo -e "${YELLOW}Test 2: Create banner with markdown${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Markdown Test",
    "message": "This is a test banner",
    "message_markdown": "# Welcome\n\nThis is **bold** and *italic* text.\n\n- Item 1\n- Item 2\n\n[Learn More](/changelog)",
    "type": "announcement",
    "priority": 8,
    "is_active": true,
    "is_dismissible": true
  }')

MARKDOWN_BANNER_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$MARKDOWN_BANNER_ID" ]; then
  echo -e "${RED}✗ Failed to create markdown banner${NC}"
  echo "$RESPONSE"
  exit 1
fi
echo -e "${GREEN}✓ Markdown banner created with ID: $MARKDOWN_BANNER_ID${NC}\n"

# Test 3: Fetch all banners (admin)
echo -e "${YELLOW}Test 3: Fetch all banners (admin)${NC}"
RESPONSE=$(curl -s -X GET "$API_URL?include_inactive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

BANNER_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
echo -e "${GREEN}✓ Fetched $BANNER_COUNT banners${NC}\n"

# Test 4: Fetch active banners (public)
echo -e "${YELLOW}Test 4: Fetch active banners (public)${NC}"
RESPONSE=$(curl -s -X GET "$API_URL")
echo -e "${GREEN}✓ Fetched public banners${NC}\n"

# Test 5: Update banner
echo -e "${YELLOW}Test 5: Update banner${NC}"
RESPONSE=$(curl -s -X PUT "$API_URL?id=$BANNER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Updated Banner",
    "priority": 9
  }')

if echo "$RESPONSE" | grep -q '"message":"Banner updated successfully"'; then
  echo -e "${GREEN}✓ Banner updated successfully${NC}\n"
else
  echo -e "${RED}✗ Failed to update banner${NC}"
  echo "$RESPONSE"
  exit 1
fi

# Test 6: Toggle active status
echo -e "${YELLOW}Test 6: Toggle active status${NC}"
RESPONSE=$(curl -s -X PUT "$API_URL?id=$BANNER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "is_active": false
  }')

if echo "$RESPONSE" | grep -q '"message":"Banner updated successfully"'; then
  echo -e "${GREEN}✓ Banner status toggled${NC}\n"
else
  echo -e "${RED}✗ Failed to toggle status${NC}"
  exit 1
fi

# Test 7: Delete banner
echo -e "${YELLOW}Test 7: Delete banner${NC}"
RESPONSE=$(curl -s -X DELETE "$API_URL?id=$BANNER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$RESPONSE" | grep -q '"message":"Banner deleted successfully"'; then
  echo -e "${GREEN}✓ Banner deleted successfully${NC}\n"
else
  echo -e "${RED}✗ Failed to delete banner${NC}"
  exit 1
fi

# Test 8: Verify deletion
echo -e "${YELLOW}Test 8: Verify deletion${NC}"
RESPONSE=$(curl -s -X GET "$API_URL?include_inactive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if ! echo "$RESPONSE" | grep -q "\"id\":$BANNER_ID"; then
  echo -e "${GREEN}✓ Banner successfully deleted${NC}\n"
else
  echo -e "${RED}✗ Banner still exists${NC}"
  exit 1
fi

# Test 9: Test markdown banner rendering
echo -e "${YELLOW}Test 9: Verify markdown banner${NC}"
RESPONSE=$(curl -s -X GET "$API_URL?include_inactive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$RESPONSE" | grep -q "\"message_markdown\""; then
  echo -e "${GREEN}✓ Markdown field present in response${NC}\n"
else
  echo -e "${RED}✗ Markdown field missing${NC}"
  exit 1
fi

# Test 10: Test validation
echo -e "${YELLOW}Test 10: Test validation (missing required field)${NC}"
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Test"
  }')

if echo "$RESPONSE" | grep -q "error"; then
  echo -e "${GREEN}✓ Validation working correctly${NC}\n"
else
  echo -e "${RED}✗ Validation not working${NC}"
  exit 1
fi

echo -e "${GREEN}=== All tests passed! ===${NC}"




