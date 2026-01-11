#!/bin/bash

###############################################################################
# Verify Elastic Beanstalk CloudWatch Alarms
#
# This script verifies that CloudWatch alarms were created successfully
# and shows where to find them.
#
# Usage:
#   ./scripts/verify-eb-alarms.sh [OPTIONS]
#
# Options:
#   --application-name NAME    EB Application name (default: rpstats)
#   --environment-name NAME    EB Environment name (default: rpstats-env)
#   --region REGION           AWS Region (default: us-east-1)
#
###############################################################################

set -euo pipefail

# Default configuration
APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --application-name)
      APPLICATION_NAME="$2"
      shift 2
      ;;
    --environment-name)
      ENVIRONMENT_NAME="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --help)
      head -n 20 "$0" | tail -n +3
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verifying CloudWatch Alarms${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Application: $APPLICATION_NAME"
echo "Environment: $ENVIRONMENT_NAME"
echo "Region: $AWS_REGION"
echo ""

# Expected alarm names
ALARM_PREFIX="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-"
EXPECTED_ALARMS=(
  "environment-health-critical"
  "environment-health-severe"
  "cpu-utilization-high"
  "cpu-utilization-critical"
  "memory-utilization-high"
  "http-5xx-errors-high"
  "http-5xx-errors-critical"
  "http-4xx-errors-high"
  "response-time-high"
  "response-time-critical"
  "request-volume-low"
  "request-volume-high"
  "instance-count-max"
  "instance-count-min"
)

echo -e "${YELLOW}Checking for alarms with prefix: ${ALARM_PREFIX}${NC}"
echo ""

# List all alarms with the prefix
ALARMS=$(aws cloudwatch describe-alarms \
  --alarm-name-prefix "$ALARM_PREFIX" \
  --region "$AWS_REGION" \
  --query 'MetricAlarms[*].AlarmName' \
  --output text 2>/dev/null || echo "")

if [ -z "$ALARMS" ]; then
  echo -e "${RED}✗ No alarms found with prefix: ${ALARM_PREFIX}${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo "1. Did you run the setup script? Run: ./scripts/setup-eb-alarms.sh"
  echo "2. Check for errors in the setup script output"
  echo "3. Verify AWS credentials and permissions"
  echo "4. Check the correct region: $AWS_REGION"
  echo ""
  exit 1
fi

# Count found alarms
FOUND_COUNT=$(echo "$ALARMS" | wc -w | tr -d ' ')
EXPECTED_COUNT=${#EXPECTED_ALARMS[@]}

echo -e "${GREEN}Found $FOUND_COUNT alarm(s)${NC}"
echo ""

# Check each expected alarm
FOUND_ALARMS_ARRAY=($ALARMS)
MISSING_ALARMS=()

for expected in "${EXPECTED_ALARMS[@]}"; do
  full_name="${ALARM_PREFIX}${expected}"
  found=false
  
  for found_alarm in "${FOUND_ALARMS_ARRAY[@]}"; do
    if [ "$found_alarm" == "$full_name" ]; then
      found=true
      break
    fi
  done
  
  if [ "$found" = true ]; then
    echo -e "${GREEN}✓${NC} $full_name"
  else
    echo -e "${RED}✗${NC} $full_name ${YELLOW}(missing)${NC}"
    MISSING_ALARMS+=("$expected")
  fi
done

echo ""

# Show alarm details
if [ $FOUND_COUNT -gt 0 ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Alarm Details${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Show first few alarms with details
  aws cloudwatch describe-alarms \
    --alarm-name-prefix "$ALARM_PREFIX" \
    --region "$AWS_REGION" \
    --query 'MetricAlarms[*].[AlarmName,StateValue,MetricName,Threshold]' \
    --output table \
    | head -n 20
  
  echo ""
  echo -e "${YELLOW}Note: Showing first 20 alarms. Use CloudWatch Console for full details.${NC}"
  echo ""
fi

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Expected alarms: $EXPECTED_COUNT"
echo "Found alarms: $FOUND_COUNT"

if [ ${#MISSING_ALARMS[@]} -gt 0 ]; then
  echo -e "${YELLOW}Missing alarms: ${#MISSING_ALARMS[@]}${NC}"
  echo ""
  echo "Missing alarm names:"
  for missing in "${MISSING_ALARMS[@]}"; do
    echo "  - ${ALARM_PREFIX}${missing}"
  done
  echo ""
  echo "Run the setup script again to create missing alarms:"
  echo "  ./scripts/setup-eb-alarms.sh"
else
  echo -e "${GREEN}✓ All expected alarms are present!${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Where to View Alarms${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Important:${NC} CloudWatch alarms are NOT visible in the Elastic Beanstalk"
echo "console's 'Alarms' tab. They are in the CloudWatch console."
echo ""
echo -e "${GREEN}CloudWatch Alarms Console:${NC}"
echo "https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#alarmsV2:"
echo ""
echo -e "${GREEN}Filter by prefix:${NC} ${ALARM_PREFIX}"
echo ""
echo -e "${YELLOW}To view in EB console:${NC}"
echo "The EB console 'Alarms' tab only shows alarms created through the EB"
echo "interface. CloudWatch alarms created via CLI/API appear in CloudWatch."
echo ""
echo -e "${BLUE}Elastic Beanstalk Console:${NC}"
echo "https://console.aws.amazon.com/elasticbeanstalk/home?region=${AWS_REGION}#/environments"
echo ""

if [ $FOUND_COUNT -gt 0 ]; then
  echo -e "${GREEN}✓ Alarms are configured and active!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. View alarms in CloudWatch Console (link above)"
  echo "2. Subscribe to SNS topic for notifications"
  echo "3. Set up CloudWatch Dashboard: ./scripts/setup-eb-dashboard.sh"
fi

echo ""
