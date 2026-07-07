# =============================================================================
# Module: monitoring
# Tao CloudWatch alarms co ban cho ALB, YOLO service, ECS task.
# =============================================================================

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix cua ALB (lay tu aws_lb.this.arn)"
  type        = string
}

variable "yolo_target_group_arn_suffix" {
  description = "ARN suffix cua YOLO target group (cho alarm healthy host)"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Ten ECS cluster de query service-level metric"
  type        = string
}

variable "yolo_service_name" {
  description = "Ten ECS service"
  type        = string
}

variable "sns_topic_arn" {
  description = "ARN cua SNS topic de notify (neu co)"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm: 5xx rate cao (ALB)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name}-alb-5xx-high"
  alarm_description   = "ALB 5xx responses rate > 5% trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0.05

  metric_query {
    id          = "e1"
    expression  = "(m1 / m2) * 100"
    label       = "5xx rate"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "HTTPCode_ELB_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  treat_missing_data = "notBreaching"

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm: YOLO target group unhealthy
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "yolo_unhealthy_hosts" {
  alarm_name          = "${var.name}-yolo-unhealthy"
  alarm_description   = "Co it nhat 1 host unhealthy trong YOLO target group"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = var.yolo_target_group_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm: ECS task CPU cao
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "yolo_cpu_high" {
  alarm_name          = "${var.name}-yolo-cpu-high"
  alarm_description   = "YOLO service CPU > 85% trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.yolo_service_name
  }

  alarm_actions = var.sns_topic_arn != null ? [var.sns_topic_arn] : []
  ok_actions    = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm: ECS task memory cao
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "yolo_memory_high" {
  alarm_name          = "${var.name}-yolo-memory-high"
  alarm_description   = "YOLO service memory > 85% trong 5 phut"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.yolo_service_name
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
    alb_5xx          = aws_cloudwatch_metric_alarm.alb_5xx.arn
    yolo_unhealthy   = aws_cloudwatch_metric_alarm.yolo_unhealthy_hosts.arn
    yolo_cpu_high    = aws_cloudwatch_metric_alarm.yolo_cpu_high.arn
    yolo_memory_high = aws_cloudwatch_metric_alarm.yolo_memory_high.arn
  }
}
