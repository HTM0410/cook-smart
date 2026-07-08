# =============================================================================
# Module: monitoring
# CloudWatch alarms cho Lambda functions + API Gateway (thay the ALB/ECS).
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "yolo_function_name" {
  description = "Ten Lambda yolo-infer"
  type        = string
}

variable "backend_function_name" {
  description = "Ten Lambda backend-api"
  type        = string
}

variable "drift_function_name" {
  description = "Ten Lambda drift-job"
  type        = string
}

variable "api_id" {
  description = "API Gateway ID (cho 5xx alarm)"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic de notify alarm"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# Backend API: 5xx + Throttles
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "backend_errors" {
  alarm_name          = "${var.name}-backend-errors-high"
  alarm_description   = "Backend Lambda errors > 5 trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.backend_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "backend_throttles" {
  alarm_name          = "${var.name}-backend-throttles"
  alarm_description   = "Backend Lambda throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.backend_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# YOLO: duration p95 + cold start + init failures
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "yolo_duration_p95" {
  alarm_name          = "${var.name}-yolo-duration-p95"
  alarm_description   = "YOLO inference p95 > 3s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 3000

  metric_query {
    id          = "p95"
    expression  = "QUERY_PERCENTILE(m1, 95)"
    label       = "Duration p95"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "Duration"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "p95"
      dimensions  = { FunctionName = var.yolo_function_name }
    }
  }

  treat_missing_data = "notBreaching"

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "yolo_init_duration" {
  alarm_name          = "${var.name}-yolo-init-duration"
  alarm_description   = "YOLO init duration > 5s (cold start bottleneck)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Initializer Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 5000
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.yolo_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "yolo_errors" {
  alarm_name          = "${var.name}-yolo-errors-high"
  alarm_description   = "YOLO Lambda errors > 3 trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.yolo_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Drift job: failures
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "drift_errors" {
  alarm_name          = "${var.name}-drift-errors"
  alarm_description   = "Drift job failed (errors >= 1)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.drift_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Provisioned Concurrency utilization (yolo)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "yolo_concurrent_executions" {
  alarm_name          = "${var.name}-yolo-concurrent-high"
  alarm_description   = "YOLO concurrent execs > provisioned (can throttling)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = 50 # adjust theo provisioned_concurrency
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.yolo_function_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# API Gateway 5xx (neu co api_id)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "apigw_5xx" {
  count = var.api_id != "" ? 1 : 0

  alarm_name          = "${var.name}-apigw-5xx"
  alarm_description   = "API Gateway 5xx > 10 trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "alarm_arns" {
  value = {
    backend_errors       = aws_cloudwatch_metric_alarm.backend_errors.arn
    backend_throttles    = aws_cloudwatch_metric_alarm.backend_throttles.arn
    yolo_duration_p95    = aws_cloudwatch_metric_alarm.yolo_duration_p95.arn
    yolo_init_duration   = aws_cloudwatch_metric_alarm.yolo_init_duration.arn
    yolo_errors          = aws_cloudwatch_metric_alarm.yolo_errors.arn
    yolo_concurrent_high = aws_cloudwatch_metric_alarm.yolo_concurrent_executions.arn
    drift_errors         = aws_cloudwatch_metric_alarm.drift_errors.arn
    apigw_5xx            = var.api_id != "" ? aws_cloudwatch_metric_alarm.apigw_5xx[0].arn : null
  }
}
