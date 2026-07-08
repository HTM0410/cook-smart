# =============================================================================
# Module: ecs_simple
# Tao ECS Fargate cluster + service voi Rolling Update deployment.
# Deploy se duoc thuc hien boi GitHub Actions (aws ecs update-service).
# =============================================================================

variable "name" {
  description = "Ten prefix cho ECS resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
}

variable "private_subnets" {
  description = "Private subnet cho ECS task (Fargate)"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID cua ALB"
  type        = string
}

variable "target_group_arn" {
  description = "Target group ARN de register ECS tasks"
  type        = string
}

variable "ecr_repo_url" {
  description = "ECR repository URL cho image"
  type        = string
}

variable "container_port" {
  description = "Port container expose"
  type        = number
  default     = 8000
}

variable "cpu" {
  description = "CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 2048
}

variable "memory" {
  description = "Memory (MiB)"
  type        = number
  default     = 4096
}

variable "desired_count" {
  description = "So task chay song song"
  type        = number
  default     = 2
}

variable "secrets_arn" {
  description = "Map ARN cac secrets"
  type = object({
    wandb_api_key         = string
    database_url          = string
    metrics_token         = string
    prometheus_push_token = string
  })
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# CloudWatch log group
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "yolo" {
  name              = "/ecs/${var.name}/yolo"
  retention_in_days = 30

  tags = var.tags
}

# -----------------------------------------------------------------------------
# IAM roles
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.name}-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = var.tags
}

# -----------------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Security group cho ECS task
# -----------------------------------------------------------------------------

resource "aws_security_group" "task" {
  name        = "${var.name}-task-sg"
  description = "Cho phep task listen port 8000 va goi outbound"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Tu ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-task-sg" })
}

# -----------------------------------------------------------------------------
# Task Definition
# -----------------------------------------------------------------------------

locals {
  common_env = [
    { name = "MLOPS_ENABLED", value = "true" },
    { name = "MLOPS_REGISTRY", value = "wandb" },
    { name = "WANDB_PROJECT", value = "ingredient-detection" },
    { name = "WANDB_MODEL_ARTIFACT", value = "ingredient-detector" },
    { name = "WANDB_MODEL_ALIAS", value = "production" },
    { name = "EMBEDDING_ENABLED", value = "true" },
    { name = "EMBEDDING_MODEL", value = "BAAI/bge-m3" },
    { name = "PORT", value = tostring(var.container_port) },
    { name = "HOST", value = "0.0.0.0" },
    { name = "CUDA_VISIBLE_DEVICES", value = "" },
  ]

  common_secrets = [
    { name = "WANDB_API_KEY", valueFrom = var.secrets_arn.wandb_api_key },
    { name = "DATABASE_URL", valueFrom = var.secrets_arn.database_url },
    { name = "METRICS_TOKEN", valueFrom = var.secrets_arn.metrics_token },
  ]
}

resource "aws_ecs_task_definition" "yolo" {
  family                   = "${var.name}-yolo"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "yolo"
      image     = var.ecr_repo_url
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = local.common_env
      secrets    = local.common_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.yolo.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "yolo"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -fsS http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 120
      }

      readonlyRootFilesystem = false
    }
  ])

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Service (Rolling Update)
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "yolo" {
  name             = "${var.name}-yolo-svc"
  cluster          = aws_ecs_cluster.this.id
  task_definition  = aws_ecs_task_definition.yolo.arn
  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  # Rolling update deployment - mac dinh cua ECS
  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "yolo"
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_name" {
  value = aws_ecs_service.yolo.name
}

output "service_arn" {
  value = aws_ecs_service.yolo.id
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.yolo.arn
}

output "task_definition_family" {
  value = aws_ecs_task_definition.yolo.family
}

output "task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.yolo.name
}
