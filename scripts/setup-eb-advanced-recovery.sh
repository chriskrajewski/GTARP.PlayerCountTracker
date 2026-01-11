#!/bin/bash

###############################################################################
# Advanced Elastic Beanstalk Recovery Setup
#
# This script creates additional alarms and recovery mechanisms for:
# - "No data received from instances" warnings
# - "ELB health is failing" warnings  
# - Degraded → Severe transitions
# - HTTP 5xx error patterns
#
# Usage:
#   ./scripts/setup-eb-advanced-recovery.sh [OPTIONS]
#
###############################################################################

set -euo pipefail

# Default configuration
APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"
SNS_TOPIC_ARN=""
DRY_RUN=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --application-name) APPLICATION_NAME="$2"; shift 2 ;;
    --environment-name) ENVIRONMENT_NAME="$2"; shift 2 ;;
    --region) AWS_REGION="$2"; shift 2 ;;
    --sns-topic) SNS_TOPIC_ARN="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) head -n 20 "$0" | tail -n +3; exit 0 ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Advanced EB Recovery Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verify environment
ENV_INFO=$(aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0]' \
  --output json 2>/dev/null)

if [ "$ENV_INFO" == "null" ] || [ -z "$ENV_INFO" ]; then
  echo -e "${RED}Error: Environment not found${NC}"
  exit 1
fi

ENVIRONMENT_ID=$(echo "$ENV_INFO" | jq -r '.EnvironmentId')
ENV_DIMENSIONS="Name=EnvironmentName,Value=$ENVIRONMENT_NAME"

# Get SNS topic
if [ -z "$SNS_TOPIC_ARN" ]; then
  SNS_TOPIC_ARN=$(aws sns list-topics \
    --region "$AWS_REGION" \
    --query "Topics[?contains(TopicArn, 'eb-alarms-${ENVIRONMENT_NAME}') || contains(TopicArn, 'eb-recovery-${ENVIRONMENT_NAME}')].TopicArn" \
    --output text | head -n 1 2>/dev/null || echo "")
  
  if [ -z "$SNS_TOPIC_ARN" ] && [ "$DRY_RUN" = false ]; then
    SNS_TOPIC_ARN=$(aws sns create-topic \
      --name "eb-advanced-recovery-${ENVIRONMENT_NAME}" \
      --region "$AWS_REGION" \
      --query 'TopicArn' \
      --output text)
  fi
fi

echo -e "${BLUE}Creating advanced recovery alarms...${NC}"
echo ""

# Function to create alarm
create_alarm() {
  local alarm_name=$1
  local metric_name=$2
  local namespace=$3
  local statistic=$4
  local threshold=$5
  local comparison=$6
  local evaluation_periods=$7
  local period=$8
  local description=$9
  local dimensions=${10:-""}
  
  local full_alarm_name="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-${alarm_name}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY RUN] Would create: $full_alarm_name${NC}"
    return 0
  fi
  
  local alarm_cmd="aws cloudwatch put-metric-alarm \
    --alarm-name \"$full_alarm_name\" \
    --alarm-description \"$description\" \
    --metric-name \"$metric_name\" \
    --namespace \"$namespace\" \
    --statistic \"$statistic\" \
    --period $period \
    --evaluation-periods $evaluation_periods \
    --threshold $threshold \
    --comparison-operator \"$comparison\" \
    --region \"$AWS_REGION\""
  
  if [ -n "$dimensions" ]; then
    alarm_cmd="$alarm_cmd --dimensions $dimensions"
  fi
  
  if [ -n "$SNS_TOPIC_ARN" ]; then
    alarm_cmd="$alarm_cmd --alarm-actions \"$SNS_TOPIC_ARN\""
  fi
  
  if eval "$alarm_cmd" 2>&1; then
    echo -e "${GREEN}✓ Created: $full_alarm_name${NC}"
  else
    echo -e "${RED}✗ Failed: $full_alarm_name${NC}"
  fi
}

###############################################################################
# ALARMS FOR SPECIFIC WARNING PATTERNS
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pattern 1: No Data Received from Instances${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Monitor request volume - if it drops to zero, instances aren't sending data
create_alarm \
  "recovery-no-data-warning" \
  "ApplicationRequestsTotal" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "5" \
  "LessThanThreshold" \
  "2" \
  "300" \
  "WARNING: Very low request volume. Instances may not be sending data. Check application health." \
  "$ENV_DIMENSIONS"

# Monitor instance count vs request ratio
create_alarm \
  "recovery-instance-silence" \
  "ApplicationRequestsTotal" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "1" \
  "LessThanThreshold" \
  "3" \
  "300" \
  "WARNING: No data received from instances. Application may have crashed or hung." \
  "$ENV_DIMENSIONS"

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pattern 2: ELB Health Failing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# High 5xx rate indicates ELB health issues
create_alarm \
  "recovery-elb-health-degraded" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "10" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "WARNING: High 5xx errors. ELB health may be failing. Degraded state likely." \
  "$ENV_DIMENSIONS"

# Monitor 5xx percentage (more accurate than count)
create_alarm \
  "recovery-5xx-percentage-high" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "5" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "WARNING: 5xx errors detected. May indicate ELB health check failures or application errors." \
  "$ENV_DIMENSIONS"

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pattern 3: Degraded State Detection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Environment health = 2 (Warning/Degraded)
create_alarm \
  "recovery-degraded-state" \
  "EnvironmentHealth" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "2" \
  "LessThanOrEqualToThreshold" \
  "1" \
  "60" \
  "WARNING: Environment health is Degraded. Some instances may be unhealthy. Monitor for escalation to Severe." \
  "$ENV_DIMENSIONS"

# Warning state (health = 3)
create_alarm \
  "recovery-warning-state" \
  "EnvironmentHealth" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "3" \
  "LessThanOrEqualToThreshold" \
  "1" \
  "60" \
  "INFO: Environment health is Warning. Early detection before Degraded/Severe." \
  "$ENV_DIMENSIONS"

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pattern 4: Instance Health Patterns${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Monitor when instances are being replaced frequently
create_alarm \
  "recovery-instance-churn" \
  "Instances" \
  "AWS/ElasticBeanstalk" \
  "SampleCount" \
  "3" \
  "GreaterThanThreshold" \
  "1" \
  "600" \
  "INFO: Multiple instance changes detected. May indicate recurring health issues requiring investigation." \
  "$ENV_DIMENSIONS"

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pattern 5: Response Time Degradation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Slow response times can indicate issues before they become severe
create_alarm \
  "recovery-slow-responses" \
  "ApplicationLatencyP99" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "10000" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "WARNING: Very slow response times (P99 > 10s). May indicate application issues leading to health problems." \
  "$ENV_DIMENSIONS"

echo ""

###############################################################################
# SUMMARY
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Advanced Recovery Alarms Created!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}These alarms will detect:${NC}"
  echo "  ✓ No data received from instances"
  echo "  ✓ ELB health failures"
  echo "  ✓ Degraded/Warning state transitions"
  echo "  ✓ High 5xx error rates"
  echo "  ✓ Slow response times"
  echo "  ✓ Instance churn patterns"
  echo ""
  echo -e "${YELLOW}Important Notes:${NC}"
  echo ""
  echo "1. These alarms DETECT issues but don't fix root causes"
  echo "2. Your pattern shows recurring issues - investigate root cause:"
  echo "   - Application crashes/hangs"
  echo "   - Memory leaks"
  echo "   - Database connection issues"
  echo "   - Port/process configuration problems"
  echo ""
  echo "3. Auto-recovery replaces instances, but if the app keeps crashing,"
  echo "   the cycle will repeat. Fix the underlying application issue."
  echo ""
  echo "4. Check application logs to find why instances stop sending data:"
  echo "   aws elasticbeanstalk request-environment-info \\"
  echo "     --environment-id $ENVIRONMENT_ID \\"
  echo "     --info-type tail"
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
