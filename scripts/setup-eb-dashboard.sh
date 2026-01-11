#!/bin/bash

###############################################################################
# Elastic Beanstalk CloudWatch Dashboard Setup Script
#
# This script creates a comprehensive CloudWatch dashboard for monitoring
# your Elastic Beanstalk application with visual graphs and metrics.
#
# Usage:
#   ./scripts/setup-eb-dashboard.sh [OPTIONS]
#
# Options:
#   --application-name NAME    EB Application name (default: rpstats)
#   --environment-name NAME    EB Environment name (default: rpstats-env)
#   --region REGION           AWS Region (default: us-east-1)
#   --dry-run                 Show what would be created without creating
#   --help                    Show this help message
#
###############################################################################

set -euo pipefail

# Default configuration
APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"
DRY_RUN=false

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
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      head -n 30 "$0" | tail -n +3
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Export AWS region
export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Elastic Beanstalk Dashboard Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Application: $APPLICATION_NAME"
echo "Environment: $ENVIRONMENT_NAME"
echo "Region: $AWS_REGION"
echo "Dry Run: $DRY_RUN"
echo ""

# Verify AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: AWS CLI is not installed${NC}"
  exit 1
fi

# Verify environment exists
echo -e "${YELLOW}Verifying Elastic Beanstalk environment...${NC}"
if ! aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0].EnvironmentId' \
  --output text &> /dev/null; then
  echo -e "${RED}Error: Environment '$ENVIRONMENT_NAME' not found in application '$APPLICATION_NAME'${NC}"
  exit 1
fi

ENVIRONMENT_ID=$(aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0].EnvironmentId' \
  --output text)

echo -e "${GREEN}✓ Environment found: $ENVIRONMENT_ID${NC}"
echo ""

DASHBOARD_NAME="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-dashboard"

# Create dashboard JSON with proper dimensions
DASHBOARD_BODY=$(cat <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "EnvironmentHealth", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "Health"}],
          [".", "Instances", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "Instances"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${AWS_REGION}",
        "title": "Environment Health & Instances",
        "yAxis": {
          "left": {"min": 0, "max": 5}
        },
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "CPUUtilization", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "CPU %"}],
          [".", "CPUUtilization", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Maximum", "label": "CPU Max"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${AWS_REGION}",
        "title": "CPU Utilization",
        "yAxis": {
          "left": {"min": 0, "max": 100}
        },
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "ApplicationRequestsTotal", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "Total Requests"}],
          [".", "ApplicationRequests2xx", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "2xx"}],
          [".", "ApplicationRequests4xx", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "4xx"}],
          [".", "ApplicationRequests5xx", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "5xx"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${AWS_REGION}",
        "title": "Request Count by Status",
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "ApplicationLatencyP50", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "P50"}],
          [".", "ApplicationLatencyP90", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "P90"}],
          [".", "ApplicationLatencyP99", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "P99"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${AWS_REGION}",
        "title": "Response Time (Latency)",
        "yAxis": {
          "left": {"label": "Milliseconds"}
        },
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "ApplicationRequests5xx", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "5xx Errors"}],
          [".", "ApplicationRequests4xx", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "4xx Errors"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${AWS_REGION}",
        "title": "HTTP Errors",
        "view": "timeSeries",
        "stacked": false,
        "annotations": {
          "horizontal": [
            {
              "value": 20,
              "label": "Warning Threshold",
              "color": "#ff9900"
            },
            {
              "value": 50,
              "label": "Critical Threshold",
              "color": "#ff0000"
            }
          ]
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "ApplicationRequestsTotal", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Sum", "label": "Requests/min"}]
        ],
        "period": 60,
        "stat": "Sum",
        "region": "${AWS_REGION}",
        "title": "Request Rate (per minute)",
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ElasticBeanstalk", "Instances", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Average", "label": "Avg Instances"}],
          [".", "Instances", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Minimum", "label": "Min Instances"}],
          [".", "Instances", {"EnvironmentName": "${ENVIRONMENT_NAME}"}, {"stat": "Maximum", "label": "Max Instances"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${AWS_REGION}",
        "title": "Instance Count",
        "yAxis": {
          "left": {"min": 0}
        },
        "view": "timeSeries",
        "stacked": false
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '${APPLICATION_NAME}/${ENVIRONMENT_NAME}' | fields @timestamp, @message\n| filter @message like /error/i or @message like /Error/i or @message like /ERROR/i\n| sort @timestamp desc\n| limit 100",
        "region": "${AWS_REGION}",
        "title": "Recent Errors (Last 100)",
        "view": "table"
      }
    }
  ]
}
EOF
)

echo -e "${YELLOW}Creating CloudWatch Dashboard...${NC}"
echo "Dashboard Name: $DASHBOARD_NAME"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${BLUE}[DRY RUN] Would create dashboard with the following widgets:${NC}"
  if command -v jq &> /dev/null; then
    echo "$DASHBOARD_BODY" | jq '.widgets[] | {type: .type, title: .properties.title}'
  else
    echo "  • Environment Health & Instances"
    echo "  • CPU Utilization"
    echo "  • Request Count by Status"
    echo "  • Response Time (Latency)"
    echo "  • HTTP Errors"
    echo "  • Request Rate"
    echo "  • Instance Count"
    echo "  • Recent Error Logs"
  fi
  echo ""
else
  # Create the dashboard
  DASHBOARD_JSON=$(echo "$DASHBOARD_BODY" | jq -c . 2>/dev/null || echo "$DASHBOARD_BODY")
  
  if aws cloudwatch put-dashboard \
    --dashboard-name "$DASHBOARD_NAME" \
    --dashboard-body "$DASHBOARD_JSON" \
    --region "$AWS_REGION" 2>/dev/null; then
    echo -e "${GREEN}✓ Dashboard created successfully${NC}"
  else
    echo -e "${YELLOW}⚠ Dashboard may already exist, updating...${NC}"
    if aws cloudwatch put-dashboard \
      --dashboard-name "$DASHBOARD_NAME" \
      --dashboard-body "$DASHBOARD_JSON" \
      --region "$AWS_REGION"; then
      echo -e "${GREEN}✓ Dashboard updated successfully${NC}"
    else
      echo -e "${RED}✗ Failed to create/update dashboard${NC}"
      echo "Check AWS permissions and try again."
      exit 1
    fi
  fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Dashboard setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}View your dashboard:${NC}"
  echo "https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${DASHBOARD_NAME}"
  echo ""
  echo -e "${YELLOW}Dashboard includes:${NC}"
  echo "  • Environment Health & Instance Count"
  echo "  • CPU Utilization"
  echo "  • Request Count by Status Code"
  echo "  • Response Time (P50, P90, P99)"
  echo "  • HTTP Errors (4xx, 5xx)"
  echo "  • Request Rate"
  echo "  • Instance Count Trends"
  echo "  • Recent Error Logs"
  echo ""
else
  echo -e "${BLUE}This was a dry run. No dashboard was created.${NC}"
  echo "Run without --dry-run to create the dashboard."
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
