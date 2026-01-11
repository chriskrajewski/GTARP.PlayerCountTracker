#!/bin/bash

###############################################################################
# Check Available Elastic Beanstalk Metrics
#
# This script lists all available CloudWatch metrics for your EB environment
# to help identify which alarms can work and which need fixing.
#
###############################################################################

set -euo pipefail

APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --environment-name) ENVIRONMENT_NAME="$2"; shift 2 ;;
    --region) AWS_REGION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}Checking available metrics for: $ENVIRONMENT_NAME${NC}"
echo ""

# List all metrics for this environment
METRICS=$(aws cloudwatch list-metrics \
  --namespace AWS/ElasticBeanstalk \
  --dimensions Name=EnvironmentName,Value="$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --output json 2>/dev/null || echo '{"Metrics":[]}')

METRIC_COUNT=$(echo "$METRICS" | jq '.Metrics | length')

echo -e "${GREEN}Found $METRIC_COUNT metrics${NC}"
echo ""

if [ "$METRIC_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}No metrics found. Possible reasons:${NC}"
  echo "  1. Environment is very new (wait 5-15 minutes)"
  echo "  2. No activity yet (some metrics only appear after requests)"
  echo "  3. Enhanced health reporting not enabled"
  echo ""
  echo "Available metrics will appear after:"
  echo "  - Environment has been running for a few minutes"
  echo "  - Some requests have been made"
  echo "  - Enhanced health reporting is enabled"
  exit 0
fi

echo -e "${BLUE}Available Metrics:${NC}"
echo ""

# Group by metric name
echo "$METRICS" | jq -r '.Metrics[] | .MetricName' | sort -u | while read -r metric; do
  echo -e "  ${GREEN}✓${NC} $metric"
done

echo ""
echo -e "${BLUE}Expected Metrics for Alarms:${NC}"
echo ""

EXPECTED_METRICS=(
  "EnvironmentHealth"
  "ApplicationRequests5xx"
  "ApplicationRequests4xx"
  "ApplicationRequestsTotal"
  "ApplicationRequests2xx"
  "ApplicationLatencyP50"
  "ApplicationLatencyP90"
  "ApplicationLatencyP99"
  "CPUUtilization"
  "Instances"
)

for metric in "${EXPECTED_METRICS[@]}"; do
  if echo "$METRICS" | jq -e ".Metrics[] | select(.MetricName == \"$metric\")" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $metric (available)"
  else
    echo -e "  ${YELLOW}⚠${NC} $metric (not available yet)"
  fi
done

echo ""
echo -e "${BLUE}To check a specific metric:${NC}"
echo "aws cloudwatch get-metric-statistics \\"
echo "  --namespace AWS/ElasticBeanstalk \\"
echo "  --metric-name <METRIC_NAME> \\"
echo "  --dimensions Name=EnvironmentName,Value=$ENVIRONMENT_NAME \\"
echo "  --start-time \$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \\"
echo "  --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\"
echo "  --period 300 \\"
echo "  --statistics Average \\"
echo "  --region $AWS_REGION"
