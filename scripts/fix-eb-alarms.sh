#!/bin/bash

###############################################################################
# Fix Elastic Beanstalk CloudWatch Alarms
#
# This script checks alarm status and fixes alarms with INSUFFICIENT_DATA
# by verifying metrics exist and correcting dimensions.
#
# Usage:
#   ./scripts/fix-eb-alarms.sh [OPTIONS]
#
###############################################################################

set -euo pipefail

APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --application-name) APPLICATION_NAME="$2"; shift 2 ;;
    --environment-name) ENVIRONMENT_NAME="$2"; shift 2 ;;
    --region) AWS_REGION="$2"; shift 2 ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}Checking CloudWatch alarms...${NC}"
echo ""

ALARM_PREFIX="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-"

# Get all alarms
ALARMS=$(aws cloudwatch describe-alarms \
  --alarm-name-prefix "$ALARM_PREFIX" \
  --region "$AWS_REGION" \
  --output json)

ALARM_COUNT=$(echo "$ALARMS" | jq '.MetricAlarms | length')
echo -e "Found ${GREEN}$ALARM_COUNT${NC} alarms"
echo ""

# Check each alarm
INSUFFICIENT_COUNT=0
OK_COUNT=0
ALARM_COUNT=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Alarm Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "$ALARMS" | jq -r '.MetricAlarms[] | "\(.AlarmName)|\(.StateValue)|\(.MetricName)|\(.Namespace)"' | while IFS='|' read -r name state metric namespace; do
  echo -n "$name: "
  
  case "$state" in
    "INSUFFICIENT_DATA")
      echo -e "${YELLOW}INSUFFICIENT_DATA${NC}"
      INSUFFICIENT_COUNT=$((INSUFFICIENT_COUNT + 1))
      
      # Check if metric exists
      echo -e "  Checking metric: ${BLUE}$metric${NC} in ${BLUE}$namespace${NC}"
      
      # Try to get metric data
      METRIC_DATA=$(aws cloudwatch get-metric-statistics \
        --namespace "$namespace" \
        --metric-name "$metric" \
        --dimensions Name=EnvironmentName,Value="$ENVIRONMENT_NAME" \
        --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Average \
        --region "$AWS_REGION" \
        --output json 2>/dev/null || echo '{"Datapoints":[]}')
      
      DATAPOINT_COUNT=$(echo "$METRIC_DATA" | jq '.Datapoints | length')
      
      if [ "$DATAPOINT_COUNT" -eq 0 ]; then
        echo -e "  ${RED}✗ No data points found${NC}"
        echo -e "  ${YELLOW}Possible issues:${NC}"
        echo -e "    - Metric not being published yet"
        echo -e "    - Wrong dimensions (EnvironmentName: $ENVIRONMENT_NAME)"
        echo -e "    - Environment is new (wait 5-15 minutes)"
        echo -e "    - Metric name doesn't exist for this environment"
      else
        echo -e "  ${GREEN}✓ Found $DATAPOINT_COUNT data points${NC}"
        echo -e "  ${YELLOW}Alarm should update soon (wait 5-15 minutes)${NC}"
      fi
      ;;
    "OK")
      echo -e "${GREEN}OK${NC}"
      OK_COUNT=$((OK_COUNT + 1))
      ;;
    "ALARM")
      echo -e "${RED}ALARM${NC}"
      ALARM_COUNT=$((ALARM_COUNT + 1))
      ;;
  esac
  echo ""
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Count alarms by state (using jq for accurate count)
INSUFFICIENT=$(echo "$ALARMS" | jq '[.MetricAlarms[] | select(.StateValue == "INSUFFICIENT_DATA")] | length')
OK=$(echo "$ALARMS" | jq '[.MetricAlarms[] | select(.StateValue == "OK")] | length')
ALARM_STATE=$(echo "$ALARMS" | jq '[.MetricAlarms[] | select(.StateValue == "ALARM")] | length')

echo "Total alarms: $(echo "$ALARMS" | jq '.MetricAlarms | length')"
echo -e "OK: ${GREEN}$OK${NC}"
echo -e "ALARM: ${RED}$ALARM_STATE${NC}"
echo -e "INSUFFICIENT_DATA: ${YELLOW}$INSUFFICIENT${NC}"
echo ""

if [ "$INSUFFICIENT" -gt 0 ]; then
  echo -e "${YELLOW}Alarms with INSUFFICIENT_DATA:${NC}"
  echo ""
  echo "$ALARMS" | jq -r '.MetricAlarms[] | select(.StateValue == "INSUFFICIENT_DATA") | "  - \(.AlarmName) (\(.MetricName))"'
  echo ""
  echo -e "${YELLOW}Common causes and fixes:${NC}"
  echo ""
  echo "1. ${BLUE}New Environment${NC}"
  echo "   - Wait 5-15 minutes for metrics to start flowing"
  echo "   - EB needs time to publish metrics to CloudWatch"
  echo ""
  echo "2. ${BLUE}Wrong Metric Name${NC}"
  echo "   - Some metrics only exist with enhanced monitoring"
  echo "   - Check if metric exists: aws cloudwatch list-metrics --namespace AWS/ElasticBeanstalk"
  echo ""
  echo "3. ${BLUE}Wrong Dimensions${NC}"
  echo "   - Verify EnvironmentName matches: $ENVIRONMENT_NAME"
  echo "   - Check: aws elasticbeanstalk describe-environments --environment-names $ENVIRONMENT_NAME"
  echo ""
  echo "4. ${BLUE}Metric Not Available${NC}"
  echo "   - Some metrics require enhanced health reporting (already enabled)"
  echo "   - Some metrics only appear after activity (e.g., requests)"
  echo ""
  echo -e "${YELLOW}To check available metrics:${NC}"
  echo "aws cloudwatch list-metrics \\"
  echo "  --namespace AWS/ElasticBeanstalk \\"
  echo "  --dimensions Name=EnvironmentName,Value=$ENVIRONMENT_NAME \\"
  echo "  --region $AWS_REGION"
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
