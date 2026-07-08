# =============================================================================
# IAM Role cho GitHub Actions
# Cho phep GitHub Actions deploy len ECS va truy cap ECR
# =============================================================================

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "tags" {
  description = "Tags chung"
  type        = map(string)
  default     = {}
}

variable "ecs_task_execution_role_arn" {
  description = "ARN cua ECS task execution role"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ARN cua ECS task role"
  type        = string
}

variable "database_url_secret_arn" {
  description = "ARN cua database URL secret"
  type        = string
}

variable "wandb_api_key_secret_arn" {
  description = "ARN cua W&B API key secret"
  type        = string
}

variable "metrics_token_secret_arn" {
  description = "ARN cua metrics token secret"
  type        = string
}

variable "prometheus_push_token_secret_arn" {
  description = "ARN cua Prometheus push token secret"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo name (vd: htm0410/food-suggest)"
  type        = string
  default     = "htm0410/food-suggest"
}

data "aws_caller_identity" "current" {}

# IAM Role cho GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "${var.name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Policy cho GitHub Actions
resource "aws_iam_role_policy" "github_actions" {
  name = "${var.name}-github-actions-policy"
  role = aws_iam_role.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR permissions
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      # ECS permissions
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:RunTask"
        ]
        Resource = "*"
      },
      # IAM PassRole for ECS task execution
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          var.ecs_task_execution_role_arn,
          var.ecs_task_role_arn
        ]
      },
      # Secrets Manager
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          var.database_url_secret_arn,
          var.wandb_api_key_secret_arn,
          var.metrics_token_secret_arn,
          var.prometheus_push_token_secret_arn
        ]
      },
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# IAM OIDC provider for GitHub Actions
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
