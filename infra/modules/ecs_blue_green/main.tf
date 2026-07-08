# =============================================================================
# Module: ecs_blue_green
# Tao ECS Fargate cluster + YOLO service voi Blue/Green deployment (CODE_DEPLOY).
# 2 task definition: blue (active production) va green (candidate).
# CodeDeploy quan ly viec switch traffic giua 2 target group.
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

variable "yolo_image" {
  description = "Image URL YOLO service (lay tu ECR)"
  type        = string
}

variable "container_port" {
  description = "Port YOLO service expose"
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

variable "blue_tg_arn" {
  description = "ARN cua blue target group"
  type        = string
}

variable "green_tg_arn" {
  description = "ARN cua green target group"
  type        = string
}

variable "blue_tg_name" {
  description = "Ten target group blue (cho CodeDeploy)"
  type        = string
}

variable "green_tg_name" {
  description = "Ten target group green (cho CodeDeploy)"
  type        = string
}

variable "prod_listener_arn" {
  description = "ARN cua production listener"
  type        = string
}

variable "test_listener_arn" {
  description = "ARN cua test listener"
  type        = string
}

variable "secrets_arn" {
  description = "Map ARN cac secrets de task role lay valueFrom"
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
# CloudWatch log group cho YOLO task
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "yolo" {
  name              = "/ecs/${var.name}/yolo"
  retention_in_days = 30

  tags = var.tags
}

# -----------------------------------------------------------------------------
# IAM roles: task execution role (pull image + lay secret) va task role (app run)
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

# Task role (dung boi app de goi AWS APIs nhu pushgateway metric)
# IAM policy lien quan den secret doc gan ben ngoai o envs/prod/iam.tf
# de tranh circular dependency giua secrets va ecs_blue_green modules.
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

variable "alb_security_group_id" {
  description = "Security group ID cua ALB de mo ingress tu ALB"
  type        = string
}

# -----------------------------------------------------------------------------
# Task Definition: cung ten family de Blue/Green co the thay the nhau
# Image co tag "blue" hoac "green" tuy theo stage.
# CodeDeploy qua appspec.yml/x-deployment.json se set tags tuong ung.
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
      image     = var.yolo_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = local.common_env
      secrets     = local.common_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.yolo.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "yolo"
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
      user                   = "1000:1000"
    }
  ])

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Service voi deployment_controller = CODE_DEPLOY (Blue/Green)
# CodeDeploy se thay the task definition, them/sub target group giua 2 stage.
# lifecycle.ignore_changes de Terraform khong conflict voi CodeDeploy.
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "yolo" {
  name             = "${var.name}-yolo-svc"
  cluster          = aws_ecs_cluster.this.id
  task_definition  = aws_ecs_task_definition.yolo.arn
  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  # Circuit breaker: khi deploy fail, CodeDeploy tu rollback
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
    target_group_arn = var.blue_tg_arn
    container_name   = "yolo"
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [
      task_definition,
      load_balancer,
      deployment_circuit_breaker,
    ]
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CodeDeploy: application + deployment group de quan ly Blue/Green
# -----------------------------------------------------------------------------

resource "aws_codedeploy_app" "yolo" {
  name             = "${var.name}-yolo"
  compute_platform = "ECS"
}

# IAM role cho CodeDeploy (service role)
data "aws_iam_policy_document" "codedeploy_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codedeploy" {
  name               = "${var.name}-codedeploy-role"
  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume.json
  tags               = var.tags
}

# Inline policy thay vi managed policy (tranh subscription issue)
resource "aws_iam_role_policy" "codedeploy" {
  name = "${var.name}-codedeploy-policy"
  role = aws_iam_role.codedeploy.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:UpdateService",
          "ecs:DeregisterTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "iam:PassRole"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:*",
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# Deployment Group
resource "aws_codedeploy_deployment_group" "yolo" {
  app_name               = aws_codedeploy_app.yolo.name
  deployment_group_name  = "${var.name}-yolo-dg"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnce"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM", "DEPLOYMENT_STOP_ON_REQUEST"]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout    = "CONTINUE_DEPLOYMENT"
      wait_time_in_minutes = 0
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [var.prod_listener_arn]
      }
      test_traffic_route {
        listener_arns = [var.test_listener_arn]
      }
      target_group {
        name = var.blue_tg_name
      }
      target_group {
        name = var.green_tg_name
      }
    }
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

output "task_definition_arn" {
  value = aws_ecs_task_definition.yolo.arn
}

output "task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "task_security_group_id" {
  value = aws_security_group.task.id
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.yolo.name
}

output "code_deploy_app_name" {
  value = aws_codedeploy_app.yolo.name
}

output "code_deploy_deployment_group_name" {
  value = aws_codedeploy_deployment_group.yolo.deployment_group_name
}
