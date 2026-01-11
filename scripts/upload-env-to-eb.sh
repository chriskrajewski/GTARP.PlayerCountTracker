#!/bin/bash

# Script to upload environment variables from .env.local to AWS Elastic Beanstalk
# 
# Usage: ./scripts/upload-env-to-eb.sh [--dry-run]
#
# Prerequisites:
# - AWS CLI installed and configured
# - .env.local file exists in project root
# - AWS credentials configured (aws configure or environment variables)

set -e

# Configuration - update these if needed
EB_APPLICATION_NAME="${EB_APPLICATION_NAME:-rpstats}"
EB_ENVIRONMENT_NAME="${EB_ENVIRONMENT_NAME:-rpstats-env}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENV_FILE="${ENV_FILE:-.env.local}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for dry-run flag
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}\n"
fi

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found${NC}"
    echo "Please create $ENV_FILE or specify a different file with ENV_FILE=path/to/file"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it with: pip install awscli"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo -e "${BLUE}Uploading environment variables to Elastic Beanstalk${NC}"
echo -e "Application: ${GREEN}$EB_APPLICATION_NAME${NC}"
echo -e "Environment: ${GREEN}$EB_ENVIRONMENT_NAME${NC}"
echo -e "Region: ${GREEN}$AWS_REGION${NC}"
echo -e "Source file: ${GREEN}$ENV_FILE${NC}"
echo ""

# Verify environment exists
echo -e "${BLUE}Verifying environment exists...${NC}"
if ! aws elasticbeanstalk describe-environments \
    --application-name "$EB_APPLICATION_NAME" \
    --environment-names "$EB_ENVIRONMENT_NAME" \
    --region "$AWS_REGION" \
    --query 'Environments[0].Status' \
    --output text &> /dev/null; then
    echo -e "${RED}Error: Environment $EB_ENVIRONMENT_NAME not found${NC}"
    exit 1
fi

# Parse .env.local file and build option settings JSON
echo -e "${BLUE}Reading environment variables from $ENV_FILE...${NC}"

# Create temporary file for JSON array
OPTION_SETTINGS_FILE=$(mktemp)
echo "[" > "$OPTION_SETTINGS_FILE"

VARIABLE_COUNT=0
SKIPPED_COUNT=0
FIRST_ITEM=true

while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Remove leading/trailing whitespace
    line=$(echo "$line" | xargs)
    
    # Skip if still empty after trimming
    if [[ -z "$line" ]]; then
        continue
    fi
    
    # Check if line contains =
    if [[ ! "$line" =~ = ]]; then
        echo -e "${YELLOW}Warning: Skipping invalid line: $line${NC}"
        ((SKIPPED_COUNT++))
        continue
    fi
    
    # Split on first = (to handle values with = in them)
    KEY="${line%%=*}"
    VALUE="${line#*=}"
    
    # Remove quotes from value if present
    VALUE=$(echo "$VALUE" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    # Skip if key or value is empty
    if [[ -z "$KEY" ]] || [[ -z "$VALUE" ]]; then
        echo -e "${YELLOW}Warning: Skipping line with empty key or value: $line${NC}"
        ((SKIPPED_COUNT++))
        continue
    fi
    
    # Escape JSON special characters in value
    # Try using jq first (most reliable), fallback to manual escaping
    if command -v jq &> /dev/null; then
        VALUE_ESCAPED=$(printf '%s' "$VALUE" | jq -Rs .)
    else
        # Manual JSON escaping: escape backslashes, quotes, newlines, tabs, etc.
        VALUE_ESCAPED=$(printf '%s' "$VALUE" | \
            sed 's/\\/\\\\/g' | \
            sed 's/"/\\"/g' | \
            sed 's/\t/\\t/g' | \
            sed 's/\r/\\r/g' | \
            sed ':a;N;$!ba;s/\n/\\n/g')
        VALUE_ESCAPED="\"$VALUE_ESCAPED\""
    fi
    
    # Add comma if not first item
    if [ "$FIRST_ITEM" = false ]; then
        echo "," >> "$OPTION_SETTINGS_FILE"
    fi
    FIRST_ITEM=false
    
    # Build JSON object for option setting
    cat >> "$OPTION_SETTINGS_FILE" <<EOF
  {
    "Namespace": "aws:elasticbeanstalk:application:environment",
    "OptionName": "$KEY",
    "Value": $VALUE_ESCAPED
  }
EOF
    
    # Mask sensitive values in output
    if [[ "$KEY" =~ (SECRET|TOKEN|KEY|PASSWORD) ]]; then
        MASKED_VALUE="***masked***"
    else
        MASKED_VALUE="$VALUE"
    fi
    
    echo -e "  ${GREEN}✓${NC} $KEY = $MASKED_VALUE"
    ((VARIABLE_COUNT++))
    
done < "$ENV_FILE"

echo "]" >> "$OPTION_SETTINGS_FILE"

echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  Variables found: ${GREEN}$VARIABLE_COUNT${NC}"
echo -e "  Skipped: ${YELLOW}$SKIPPED_COUNT${NC}"
echo ""

if [ $VARIABLE_COUNT -eq 0 ]; then
    echo -e "${RED}Error: No valid environment variables found in $ENV_FILE${NC}"
    exit 1
fi

# Update Elastic Beanstalk environment
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN: Would update environment with the following option settings:${NC}"
    cat "$OPTION_SETTINGS_FILE" | jq '.' 2>/dev/null || cat "$OPTION_SETTINGS_FILE"
    echo ""
    echo -e "${YELLOW}To actually update, run without --dry-run flag${NC}"
    rm -f "$OPTION_SETTINGS_FILE"
else
    echo -e "${BLUE}Updating Elastic Beanstalk environment...${NC}"
    
    # Update environment using JSON file
    aws elasticbeanstalk update-environment \
        --application-name "$EB_APPLICATION_NAME" \
        --environment-name "$EB_ENVIRONMENT_NAME" \
        --region "$AWS_REGION" \
        --option-settings file://"$OPTION_SETTINGS_FILE" \
        --output json > /tmp/eb-update-result.json
    
    # Clean up temp file
    rm -f "$OPTION_SETTINGS_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Environment update initiated successfully${NC}"
        echo ""
        echo -e "${BLUE}Environment Status:${NC}"
        STATUS=$(cat /tmp/eb-update-result.json | jq -r '.Status' 2>/dev/null || echo "Updating")
        HEALTH=$(cat /tmp/eb-update-result.json | jq -r '.Health' 2>/dev/null || echo "Unknown")
        echo -e "  Status: ${GREEN}$STATUS${NC}"
        echo -e "  Health: ${GREEN}$HEALTH${NC}"
        echo ""
        echo -e "${YELLOW}Note: It may take a few minutes for the environment to update${NC}"
        echo -e "Monitor progress with: ${BLUE}aws elasticbeanstalk describe-environments --application-name $EB_APPLICATION_NAME --environment-names $EB_ENVIRONMENT_NAME --region $AWS_REGION${NC}"
    else
        echo -e "${RED}Error: Failed to update environment${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
