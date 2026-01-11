#!/bin/bash

###############################################################################
# Emergency Elastic Beanstalk Recovery Script
#
# This script performs immediate recovery actions for a severely unhealthy
# EB environment by replacing unhealthy instances.
#
# Usage:
#   ./scripts/emergency-recover-eb.sh [OPTIONS]
#
# Options:
#   --application-name NAME    EB Application name (default: rpstats)
#   --environment-name NAME    EB Environment name (default: rpstats-env)
#   --region REGION           AWS Region (default: us-east-1)
#   --force                   Skip confirmation prompts
#   --help                    Show this help message
#
# WARNING: This will terminate and replace instances. Use with caution.
#
###############################################################################

set -euo pipefail

# Default configuration
APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"
FORCE=false

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
    --force)
      FORCE=true
      shift
      ;;
    --help)
      head -n 25 "$0" | tail -n +3
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${RED}========================================${NC}"
echo -e "${RED}EMERGENCY EB ENVIRONMENT RECOVERY${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo "Application: $APPLICATION_NAME"
echo "Environment: $ENVIRONMENT_NAME"
echo "Region: $AWS_REGION"
echo ""

# Verify AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: AWS CLI is not installed${NC}"
  exit 1
fi

# Get environment info
echo -e "${YELLOW}Checking environment status...${NC}"
ENV_INFO=$(aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0]' \
  --output json)

if [ "$ENV_INFO" == "null" ] || [ -z "$ENV_INFO" ]; then
  echo -e "${RED}Error: Environment not found${NC}"
  exit 1
fi

ENVIRONMENT_ID=$(echo "$ENV_INFO" | jq -r '.EnvironmentId')
CURRENT_HEALTH=$(echo "$ENV_INFO" | jq -r '.Health')
CURRENT_STATUS=$(echo "$ENV_INFO" | jq -r '.Status')

echo -e "Environment ID: $ENVIRONMENT_ID"
echo -e "Current Health: ${RED}$CURRENT_HEALTH${NC}"
echo -e "Current Status: $CURRENT_STATUS"
echo ""

# Get unhealthy instances
echo -e "${YELLOW}Checking instance health...${NC}"
UNHEALTHY_INSTANCES=$(aws elasticbeanstalk describe-environment-health \
  --environment-id "$ENVIRONMENT_ID" \
  --attribute-names All \
  --region "$AWS_REGION" \
  --query 'InstancesHealth[?Status==`Severe` || Status==`Warning`].Id' \
  --output text 2>/dev/null || echo "")

if [ -z "$UNHEALTHY_INSTANCES" ]; then
  echo -e "${YELLOW}No unhealthy instances found. Checking all instances...${NC}"
  ALL_INSTANCES=$(aws elasticbeanstalk describe-instances-health \
    --environment-id "$ENVIRONMENT_ID" \
    --region "$AWS_REGION" \
    --query 'InstanceHealthList[?HealthStatus==`Severe` || HealthStatus==`Warning`].InstanceId' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$ALL_INSTANCES" ]; then
    echo -e "${GREEN}No severely unhealthy instances detected.${NC}"
    echo "Environment may be recovering or issue is at application level."
    echo ""
    echo "Recommended actions:"
    echo "1. Check application logs: aws elasticbeanstalk request-environment-info --environment-id $ENVIRONMENT_ID --info-type tail"
    echo "2. Check health endpoint: curl https://rpstats.us-east-1.elasticbeanstalk.com/health"
    echo "3. Review recent events in EB console"
    exit 0
  fi
  UNHEALTHY_INSTANCES="$ALL_INSTANCES"
fi

INSTANCE_COUNT=$(echo "$UNHEALTHY_INSTANCES" | wc -w | tr -d ' ')
echo -e "${RED}Found $INSTANCE_COUNT unhealthy instance(s):${NC}"
for instance in $UNHEALTHY_INSTANCES; do
  echo "  - $instance"
done
echo ""

# Get Auto Scaling Group
ASG_NAME=$(aws elasticbeanstalk describe-environment-resources \
  --environment-id "$ENVIRONMENT_ID" \
  --region "$AWS_REGION" \
  --query 'EnvironmentResources.AutoScalingGroups[0].Name' \
  --output text 2>/dev/null || echo "")

if [ -z "$ASG_NAME" ]; then
  echo -e "${YELLOW}⚠ No Auto Scaling Group found. Will use EB restart instead.${NC}"
fi

# Confirmation
if [ "$FORCE" != true ]; then
  echo -e "${RED}WARNING: This will terminate and replace unhealthy instances!${NC}"
  echo ""
  read -p "Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""
echo -e "${YELLOW}Starting recovery process...${NC}"
echo ""

###############################################################################
# Recovery Method 1: Restart App Server (Least Disruptive)
###############################################################################

echo -e "${BLUE}Method 1: Restarting application server...${NC}"
if aws elasticbeanstalk restart-app-server \
  --environment-id "$ENVIRONMENT_ID" \
  --region "$AWS_REGION" 2>&1; then
  echo -e "${GREEN}✓ Application server restart initiated${NC}"
  echo -e "${YELLOW}Waiting 30 seconds for restart to begin...${NC}"
  sleep 30
else
  echo -e "${YELLOW}⚠ App server restart not available, trying instance replacement...${NC}"
fi
echo ""

###############################################################################
# Recovery Method 2: Replace Unhealthy Instances
###############################################################################

if [ -n "$ASG_NAME" ] && [ "$INSTANCE_COUNT" -gt 0 ]; then
  echo -e "${BLUE}Method 2: Replacing unhealthy instances via Auto Scaling...${NC}"
  
  for instance_id in $UNHEALTHY_INSTANCES; do
    echo -e "${YELLOW}Terminating unhealthy instance: $instance_id${NC}"
    
    # Set instance to unhealthy to trigger replacement
    if aws autoscaling set-instance-health \
      --instance-id "$instance_id" \
      --health-status Unhealthy \
      --region "$AWS_REGION" 2>/dev/null; then
      echo -e "${GREEN}✓ Marked instance as unhealthy (will be replaced)${NC}"
    else
      # Alternative: Terminate instance directly (ASG will replace it)
      echo -e "${YELLOW}Attempting direct termination...${NC}"
      if aws ec2 terminate-instances \
        --instance-ids "$instance_id" \
        --region "$AWS_REGION" 2>&1; then
        echo -e "${GREEN}✓ Instance termination initiated (ASG will launch replacement)${NC}"
      else
        echo -e "${RED}✗ Failed to terminate instance${NC}"
      fi
    fi
  done
  echo ""
fi

###############################################################################
# Recovery Method 3: EB Environment Restart (Most Disruptive)
###############################################################################

if [ "$CURRENT_HEALTH" == "Severe" ] || [ "$CURRENT_HEALTH" == "Red" ]; then
  echo -e "${BLUE}Method 3: Environment is severely unhealthy.${NC}"
  echo -e "${YELLOW}Consider full environment restart if above methods don't work:${NC}"
  echo ""
  echo "  aws elasticbeanstalk restart-environment \\"
  echo "    --environment-id $ENVIRONMENT_ID \\"
  echo "    --region $AWS_REGION"
  echo ""
  echo -e "${RED}WARNING: This will restart ALL instances and cause downtime!${NC}"
  echo ""
  
  if [ "$FORCE" != true ]; then
    read -p "Perform full environment restart now? (yes/no): " restart_confirm
    if [ "$restart_confirm" == "yes" ]; then
      echo -e "${YELLOW}Restarting environment...${NC}"
      if aws elasticbeanstalk restart-environment \
        --environment-id "$ENVIRONMENT_ID" \
        --region "$AWS_REGION" 2>&1; then
        echo -e "${GREEN}✓ Environment restart initiated${NC}"
      else
        echo -e "${RED}✗ Failed to restart environment${NC}"
      fi
    fi
  fi
fi

###############################################################################
# Monitor Recovery
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Monitoring Recovery${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}Waiting 60 seconds, then checking status...${NC}"
sleep 60

# Check status again
NEW_ENV_INFO=$(aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0]' \
  --output json)

NEW_HEALTH=$(echo "$NEW_ENV_INFO" | jq -r '.Health')
NEW_STATUS=$(echo "$NEW_ENV_INFO" | jq -r '.Status')

echo ""
echo -e "Updated Health: ${GREEN}$NEW_HEALTH${NC}"
echo -e "Updated Status: $NEW_STATUS"
echo ""

if [ "$NEW_HEALTH" == "Ok" ] || [ "$NEW_HEALTH" == "Green" ]; then
  echo -e "${GREEN}✓ Environment is recovering!${NC}"
elif [ "$NEW_HEALTH" == "Warning" ] || [ "$NEW_HEALTH" == "Yellow" ]; then
  echo -e "${YELLOW}⚠ Environment is in warning state. Continue monitoring...${NC}"
else
  echo -e "${RED}✗ Environment is still unhealthy.${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Check application logs for errors"
  echo "2. Verify health endpoint is responding: curl https://rpstats.us-east-1.elasticbeanstalk.com/health"
  echo "3. Review EB events: aws elasticbeanstalk describe-events --environment-id $ENVIRONMENT_ID --max-items 20"
  echo "4. Check instance logs in CloudWatch"
  echo "5. Consider rolling back to previous application version"
fi

echo ""
echo -e "${BLUE}View environment status:${NC}"
echo "https://console.aws.amazon.com/elasticbeanstalk/home?region=${AWS_REGION}#/environment/dashboard?applicationName=${APPLICATION_NAME}&environmentId=${ENVIRONMENT_ID}"
echo ""

echo -e "${GREEN}Recovery actions completed!${NC}"
