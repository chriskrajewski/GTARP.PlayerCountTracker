#!/bin/bash

###############################################################################
# Elastic Beanstalk CloudWatch Alarms Setup Script
#
# This script creates recommended CloudWatch alarms for your Elastic Beanstalk
# application to monitor health, performance, and availability.
#
# Usage:
#   ./scripts/setup-eb-alarms.sh [OPTIONS]
#
# Options:
#   --application-name NAME    EB Application name (default: rpstats)
#   --environment-name NAME    EB Environment name (default: rpstats-env)
#   --region REGION           AWS Region (default: us-east-1)
#   --sns-topic ARN           SNS topic ARN for alarm notifications (optional)
#   --dry-run                 Show what would be created without creating alarms
#   --help                    Show this help message
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - Appropriate IAM permissions to create CloudWatch alarms and SNS topics
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
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Export AWS region
export AWS_DEFAULT_REGION=$AWS_REGION

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Elastic Beanstalk Alarms Setup${NC}"
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

# Get load balancer ARN if available (for ALB metrics)
LOAD_BALANCER_ARN=$(aws elasticbeanstalk describe-environment-resources \
  --environment-id "$ENVIRONMENT_ID" \
  --region "$AWS_REGION" \
  --query 'EnvironmentResources.LoadBalancers[0].Name' \
  --output text 2>/dev/null || echo "")

# Create SNS topic if not provided
if [ -z "$SNS_TOPIC_ARN" ]; then
  echo -e "${YELLOW}No SNS topic provided. Creating default topic...${NC}"
  if [ "$DRY_RUN" = false ]; then
    TOPIC_NAME="eb-alarms-${ENVIRONMENT_NAME}"
    SNS_TOPIC_ARN=$(aws sns create-topic \
      --name "$TOPIC_NAME" \
      --region "$AWS_REGION" \
      --query 'TopicArn' \
      --output text 2>/dev/null || \
      aws sns list-topics \
        --region "$AWS_REGION" \
        --query "Topics[?contains(TopicArn, '$TOPIC_NAME')].TopicArn" \
        --output text | head -n 1)
    
    echo -e "${GREEN}✓ Using SNS topic: $SNS_TOPIC_ARN${NC}"
    echo -e "${YELLOW}Note: You should subscribe your email/phone to this topic:${NC}"
    echo "  aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your-email@example.com"
  else
    SNS_TOPIC_ARN="arn:aws:sns:${AWS_REGION}:123456789012:eb-alarms-${ENVIRONMENT_NAME}"
    echo -e "${BLUE}[DRY RUN] Would create/use SNS topic: $SNS_TOPIC_ARN${NC}"
  fi
  echo ""
fi

# Function to create an alarm
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
  
  echo -e "${YELLOW}Creating alarm: $full_alarm_name${NC}"
  echo "  Metric: $metric_name"
  echo "  Threshold: $threshold"
  echo "  Comparison: $comparison"
  echo "  Evaluation Periods: $evaluation_periods"
  echo "  Period: ${period}s"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY RUN] Would create alarm with:${NC}"
    echo "  Name: $full_alarm_name"
    echo "  Metric: $metric_name"
    echo "  Namespace: $namespace"
    echo ""
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
  
  # Try to create the alarm and capture any errors
  if eval "$alarm_cmd" 2>&1; then
    echo -e "${GREEN}✓ Alarm created successfully${NC}"
  else
    local exit_code=$?
    # Check if alarm already exists
    if aws cloudwatch describe-alarms \
      --alarm-names "$full_alarm_name" \
      --region "$AWS_REGION" \
      --query 'MetricAlarms[0].AlarmName' \
      --output text &>/dev/null; then
      echo -e "${YELLOW}⚠ Alarm already exists, updating...${NC}"
      # For update, we need to use put-metric-alarm with the same name
      if eval "$alarm_cmd" 2>&1; then
        echo -e "${GREEN}✓ Alarm updated successfully${NC}"
      else
        echo -e "${RED}✗ Failed to update alarm${NC}"
        echo -e "${RED}Error code: $?${NC}"
        return 1
      fi
    else
      echo -e "${RED}✗ Failed to create alarm${NC}"
      echo -e "${RED}Error code: $exit_code${NC}"
      echo -e "${YELLOW}Command that failed:${NC}"
      echo "$alarm_cmd"
      return 1
    fi
  fi
  echo ""
}

# Get environment dimensions
ENV_DIMENSIONS="Name=EnvironmentName,Value=$ENVIRONMENT_NAME"

echo -e "${BLUE}Creating CloudWatch alarms...${NC}"
echo ""

###############################################################################
# CRITICAL ALARMS - Environment Health
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}CRITICAL: Environment Health${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Environment Health Status (Critical)
# Triggers when environment health is not "Ok"
create_alarm \
  "environment-health-critical" \
  "EnvironmentHealth" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "1" \
  "LessThanThreshold" \
  "1" \
  "60" \
  "Critical: Environment health is not OK. Immediate attention required." \
  "$ENV_DIMENSIONS"

# 2. Severe Environment Health
create_alarm \
  "environment-health-severe" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "10" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "Warning: High rate of 5xx errors detected. Application may be experiencing issues." \
  "$ENV_DIMENSIONS"

###############################################################################
# PERFORMANCE ALARMS - CPU and Memory
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PERFORMANCE: CPU and Memory${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 3. High CPU Utilization
create_alarm \
  "cpu-utilization-high" \
  "CPUUtilization" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "80" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "Warning: CPU utilization is above 80%. Consider scaling up or optimizing." \
  "$ENV_DIMENSIONS"

# 4. Critical CPU Utilization
create_alarm \
  "cpu-utilization-critical" \
  "CPUUtilization" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "90" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "Critical: CPU utilization is above 90%. Immediate scaling may be required." \
  "$ENV_DIMENSIONS"

# 5. High Memory Utilization
create_alarm \
  "memory-utilization-high" \
  "ApplicationRequestsTotal" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "0" \
  "GreaterThanThreshold" \
  "1" \
  "60" \
  "Note: Memory metrics are monitored via application logs. Check CloudWatch Logs for memory issues." \
  "$ENV_DIMENSIONS"

###############################################################################
# AVAILABILITY ALARMS - HTTP Errors
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}AVAILABILITY: HTTP Errors${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 6. High 5xx Error Rate
create_alarm \
  "http-5xx-errors-high" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "20" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "Warning: High rate of 5xx server errors. Check application logs and database connections." \
  "$ENV_DIMENSIONS"

# 7. Critical 5xx Error Rate
create_alarm \
  "http-5xx-errors-critical" \
  "ApplicationRequests5xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "50" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "Critical: Very high rate of 5xx errors. Application may be down or severely degraded." \
  "$ENV_DIMENSIONS"

# 8. High 4xx Error Rate (Client Errors)
create_alarm \
  "http-4xx-errors-high" \
  "ApplicationRequests4xx" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "100" \
  "GreaterThanThreshold" \
  "3" \
  "300" \
  "Info: High rate of 4xx client errors. May indicate broken links, API misuse, or authentication issues." \
  "$ENV_DIMENSIONS"

###############################################################################
# PERFORMANCE ALARMS - Response Time
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PERFORMANCE: Response Time${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 9. High Response Time
create_alarm \
  "response-time-high" \
  "ApplicationLatencyP99" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "2000" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "Warning: P99 response time is above 2 seconds. Application may be slow." \
  "$ENV_DIMENSIONS"

# 10. Critical Response Time
create_alarm \
  "response-time-critical" \
  "ApplicationLatencyP99" \
  "AWS/ElasticBeanstalk" \
  "Average" \
  "5000" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "Critical: P99 response time is above 5 seconds. Application is very slow." \
  "$ENV_DIMENSIONS"

###############################################################################
# TRAFFIC ALARMS - Request Volume
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TRAFFIC: Request Volume${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 11. Low Request Volume (Potential Downtime)
create_alarm \
  "request-volume-low" \
  "ApplicationRequestsTotal" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "10" \
  "LessThanThreshold" \
  "3" \
  "300" \
  "Warning: Request volume is unusually low. May indicate application is down or unreachable." \
  "$ENV_DIMENSIONS"

# 12. High Request Volume (Potential Overload)
create_alarm \
  "request-volume-high" \
  "ApplicationRequestsTotal" \
  "AWS/ElasticBeanstalk" \
  "Sum" \
  "10000" \
  "GreaterThanThreshold" \
  "2" \
  "300" \
  "Info: High request volume detected. Monitor for performance degradation." \
  "$ENV_DIMENSIONS"

###############################################################################
# SCALING ALARMS - Instance Count
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SCALING: Instance Count${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 13. Instance Count (if auto-scaling enabled)
create_alarm \
  "instance-count-max" \
  "Instances" \
  "AWS/ElasticBeanstalk" \
  "Maximum" \
  "4" \
  "GreaterThanThreshold" \
  "1" \
  "300" \
  "Info: Instance count has reached maximum. Consider reviewing auto-scaling configuration." \
  "$ENV_DIMENSIONS"

# 14. Instance Count Minimum
create_alarm \
  "instance-count-min" \
  "Instances" \
  "AWS/ElasticBeanstalk" \
  "Minimum" \
  "1" \
  "LessThanThreshold" \
  "1" \
  "300" \
  "Critical: No instances running. Application is completely down." \
  "$ENV_DIMENSIONS"

###############################################################################
# SUMMARY
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Alarm setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}Next Steps:${NC}"
  echo ""
  echo "1. Subscribe to SNS topic for notifications:"
  echo "   aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your-email@example.com"
  echo ""
  echo "2. View alarms in CloudWatch Console:"
  echo "   https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#alarmsV2:"
  echo ""
  echo "3. Review alarm configurations and adjust thresholds as needed:"
  echo "   https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#alarmsV2:alarm/${APPLICATION_NAME}-${ENVIRONMENT_NAME}-*"
  echo ""
  echo "4. Set up CloudWatch Dashboard for visual monitoring:"
  echo "   See scripts/setup-eb-dashboard.sh (if available)"
  echo ""
else
  echo -e "${BLUE}This was a dry run. No alarms were created.${NC}"
  echo "Run without --dry-run to create the alarms."
  echo ""
fi

echo -e "${GREEN}Done!${NC}"
