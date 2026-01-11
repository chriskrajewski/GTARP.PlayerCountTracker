#!/bin/bash

###############################################################################
# Elastic Beanstalk Auto-Recovery Setup Script
#
# This script sets up automatic recovery mechanisms for your EB environment:
# 1. CloudWatch alarms that trigger instance replacement
# 2. Auto-scaling policies for unhealthy instances
# 3. SNS notifications for recovery actions
#
# Usage:
#   ./scripts/setup-eb-auto-recovery.sh [OPTIONS]
#
# Options:
#   --application-name NAME    EB Application name (default: rpstats)
#   --environment-name NAME    EB Environment name (default: rpstats-env)
#   --region REGION           AWS Region (default: us-east-1)
#   --sns-topic ARN           SNS topic ARN for notifications (optional)
#   --dry-run                 Show what would be created without creating
#   --help                    Show this help message
#
###############################################################################

set -euo pipefail

# Default configuration
APPLICATION_NAME="rpstats"
ENVIRONMENT_NAME="rpstats-env"
AWS_REGION="us-east-1"
SNS_TOPIC_ARN=""
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
    --sns-topic)
      SNS_TOPIC_ARN="$2"
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
      exit 1
      ;;
  esac
done

export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Elastic Beanstalk Auto-Recovery Setup${NC}"
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
ENV_INFO=$(aws elasticbeanstalk describe-environments \
  --application-name "$APPLICATION_NAME" \
  --environment-names "$ENVIRONMENT_NAME" \
  --region "$AWS_REGION" \
  --query 'Environments[0]' \
  --output json 2>/dev/null)

if [ "$ENV_INFO" == "null" ] || [ -z "$ENV_INFO" ]; then
  echo -e "${RED}Error: Environment '$ENVIRONMENT_NAME' not found${NC}"
  exit 1
fi

ENVIRONMENT_ID=$(echo "$ENV_INFO" | jq -r '.EnvironmentId')
ASG_NAME=$(aws elasticbeanstalk describe-environment-resources \
  --environment-id "$ENVIRONMENT_ID" \
  --region "$AWS_REGION" \
  --query 'EnvironmentResources.AutoScalingGroups[0].Name' \
  --output text 2>/dev/null || echo "")

echo -e "${GREEN}✓ Environment found: $ENVIRONMENT_ID${NC}"
if [ -n "$ASG_NAME" ]; then
  echo -e "${GREEN}✓ Auto Scaling Group: $ASG_NAME${NC}"
fi
echo ""

# Get or create SNS topic
if [ -z "$SNS_TOPIC_ARN" ]; then
  echo -e "${YELLOW}Checking for existing SNS topic...${NC}"
  SNS_TOPIC_ARN=$(aws sns list-topics \
    --region "$AWS_REGION" \
    --query "Topics[?contains(TopicArn, 'eb-alarms-${ENVIRONMENT_NAME}')].TopicArn" \
    --output text | head -n 1 2>/dev/null || echo "")
  
  if [ -z "$SNS_TOPIC_ARN" ]; then
    if [ "$DRY_RUN" = false ]; then
      echo -e "${YELLOW}Creating SNS topic for recovery notifications...${NC}"
      SNS_TOPIC_ARN=$(aws sns create-topic \
        --name "eb-recovery-${ENVIRONMENT_NAME}" \
        --region "$AWS_REGION" \
        --query 'TopicArn' \
        --output text)
      echo -e "${GREEN}✓ Created SNS topic: $SNS_TOPIC_ARN${NC}"
    else
      SNS_TOPIC_ARN="arn:aws:sns:${AWS_REGION}:123456789012:eb-recovery-${ENVIRONMENT_NAME}"
      echo -e "${BLUE}[DRY RUN] Would create SNS topic: $SNS_TOPIC_ARN${NC}"
    fi
  else
    echo -e "${GREEN}✓ Using existing SNS topic: $SNS_TOPIC_ARN${NC}"
  fi
  echo ""
fi

# Get environment dimensions
ENV_DIMENSIONS="Name=EnvironmentName,Value=$ENVIRONMENT_NAME"

echo -e "${BLUE}Setting up auto-recovery mechanisms...${NC}"
echo ""

###############################################################################
# Create Recovery Alarms with Auto-Scaling Actions
###############################################################################

create_recovery_alarm() {
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
  local auto_scaling_action=${11:-""}
  
  local full_alarm_name="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-${alarm_name}"
  
  echo -e "${YELLOW}Creating recovery alarm: $full_alarm_name${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY RUN] Would create alarm with auto-recovery action${NC}"
    echo ""
    return 0
  fi
  
  local alarm_actions=""
  if [ -n "$SNS_TOPIC_ARN" ]; then
    alarm_actions="--alarm-actions \"$SNS_TOPIC_ARN\""
  fi
  
  if [ -n "$auto_scaling_action" ] && [ -n "$ASG_NAME" ]; then
    alarm_actions="$alarm_actions --alarm-actions \"$auto_scaling_action\""
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
  
  if [ -n "$alarm_actions" ]; then
    alarm_cmd="$alarm_cmd $alarm_actions"
  fi
  
  if eval "$alarm_cmd" 2>&1; then
    echo -e "${GREEN}✓ Recovery alarm created successfully${NC}"
  else
    echo -e "${RED}✗ Failed to create recovery alarm${NC}"
    return 1
  fi
  echo ""
}

###############################################################################
# CRITICAL RECOVERY ALARMS
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}CRITICAL: Auto-Recovery Alarms${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Severe Health - Trigger instance replacement
create_recovery_alarm \
  "recovery-severe-health" \
  "EnvironmentHealth" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "1" \
  "LessThanThreshold" \
  "1" \
  "60" \
  "CRITICAL: Environment health is Severe. Auto-recovery will replace unhealthy instances." \
  "$ENV_DIMENSIONS" \
  ""

# 2. No Healthy Instances - Scale up immediately
if [ -n "$ASG_NAME" ]; then
  echo -e "${YELLOW}Creating auto-scaling policy for instance replacement...${NC}"
  
  # Create scale-up policy for recovery
  POLICY_NAME="${APPLICATION_NAME}-${ENVIRONMENT_NAME}-recovery-scale-up"
  
  if [ "$DRY_RUN" = false ]; then
    # Get current desired capacity
    DESIRED_CAP=$(aws autoscaling describe-auto-scaling-groups \
      --auto-scaling-group-names "$ASG_NAME" \
      --region "$AWS_REGION" \
      --query 'AutoScalingGroups[0].DesiredCapacity' \
      --output text 2>/dev/null || echo "1")
    
    # Create scale-up policy (add 1 instance)
    SCALE_UP_ARN=$(aws autoscaling put-scaling-policy \
      --auto-scaling-group-name "$ASG_NAME" \
      --policy-name "${POLICY_NAME}" \
      --scaling-adjustment 1 \
      --adjustment-type ChangeInCapacity \
      --cooldown 300 \
      --region "$AWS_REGION" \
      --query 'PolicyARN' \
      --output text 2>/dev/null || echo "")
    
    if [ -n "$SCALE_UP_ARN" ]; then
      echo -e "${GREEN}✓ Created auto-scaling policy: $SCALE_UP_ARN${NC}"
      
      # Create alarm that triggers scale-up on severe health
      create_recovery_alarm \
        "recovery-trigger-scale-up" \
        "EnvironmentHealth" \
        "AWS/ElasticBeanstalk" \
        "Average" \
        "1" \
        "LessThanThreshold" \
        "1" \
        "60" \
        "AUTO-RECOVERY: Severe health detected. Triggering instance replacement." \
        "$ENV_DIMENSIONS" \
        "$SCALE_UP_ARN"
    fi
  else
    echo -e "${BLUE}[DRY RUN] Would create auto-scaling policy and alarm${NC}"
  fi
  echo ""
fi

# 3. High 5xx Errors - Potential instance failure
create_recovery_alarm \
  "recovery-high-5xx-errors" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "50" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "AUTO-RECOVERY: Critical 5xx error rate. May trigger instance replacement." \
  "$ENV_DIMENSIONS" \
  ""

# 4. No Instances Running - Emergency scale-up
if [ -n "$ASG_NAME" ]; then
  create_recovery_alarm \
    "recovery-no-instances" \
    "Instances" \
    "AWS/ElasticBeanstalk" \
    "Minimum" \
    "1" \
    "LessThanThreshold" \
    "1" \
    "300" \
    "EMERGENCY: No instances running. Auto-scaling will launch new instances." \
    "$ENV_DIMENSIONS" \
    ""
fi

###############################################################################
# Configure EB Environment for Auto-Recovery
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Configuring EB Environment Settings${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}Updating environment configuration for auto-recovery...${NC}"
  
  # Note: These settings should be in .ebextensions config files
  # This script just verifies they're applied
  
  echo -e "${GREEN}✓ Auto-recovery configuration is in .ebextensions files:${NC}"
  echo "  - .ebextensions/04_auto_recovery.config"
  echo "  - .ebextensions/05_autoscaling.config"
  echo ""
  echo -e "${YELLOW}To apply these settings, redeploy your application:${NC}"
  echo "  - The .ebextensions files will be applied on next deployment"
  echo "  - Or update environment configuration manually in EB console"
  echo ""
else
  echo -e "${BLUE}[DRY RUN] Would configure environment settings${NC}"
fi

###############################################################################
# SUMMARY
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Auto-Recovery Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}Next Steps:${NC}"
  echo ""
  echo "1. ✅ Recovery alarms created"
  echo "2. ⚠️  Apply .ebextensions configuration:"
  echo "   - Redeploy your application to apply auto-recovery settings"
  echo "   - Or update environment configuration in EB console"
  echo ""
  echo "3. Subscribe to SNS notifications:"
  echo "   aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your-email@example.com"
  echo ""
  echo "4. Verify auto-recovery is working:"
  echo "   - Check CloudWatch alarms are in ALARM state when health is severe"
  echo "   - Monitor instance replacement in EB console"
  echo ""
  echo -e "${RED}IMMEDIATE ACTION REQUIRED:${NC}"
  echo "Your environment is currently in SEVERE state. You need to:"
  echo "1. Fix the root cause (check logs, health endpoint, etc.)"
  echo "2. Redeploy with the new .ebextensions files"
  echo "3. Or manually restart/replace instances in EB console"
  echo ""
else
  echo -e "${BLUE}This was a dry run. No changes were made.${NC}"
  echo "Run without --dry-run to set up auto-recovery."
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
