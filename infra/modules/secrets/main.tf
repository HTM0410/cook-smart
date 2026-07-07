terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

# -----------------------------------------------------------------------------
# Module: secrets
# Tao cac Secrets Manager secret cho production: WANDB_API_KEY, DATABASE_URL,
# METRICS_TOKEN, PROMETHEUS_PUSH_TOKEN. IAM policy cho task role lay duoc.
# -----------------------------------------------------------------------------

variable "name" {
  description = "Ten prefix cho cac secret va IAM role lien quan"
  type        = string
}

variable "region" {
  description = "AWS region (default us-east-1)"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Tag chung cho resources"
  type        = map(string)
  default     = {}
}

# Lay ARN cua IAM task execution role tu ben ngoai de gan policy
variable "task_execution_role_arn" {
  description = "ARN cua IAM role dung cho ECS task execution (optional - neu module env gan ben ngoai)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "wandb_api_key" {
  name                    = "${var.name}/wandb-api-key"
  description             = "Weights & Biases API key cho ingredient detection pipeline"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.name}/database-url"
  description             = "Database connection URL (Supabase Postgres)"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret" "metrics_token" {
  name                    = "${var.name}/metrics-token"
  description             = "Bearer token cho /metrics Prometheus endpoint"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret" "prometheus_push_token" {
  name                    = "${var.name}/prometheus-push-token"
  description             = "Token de push metric len Pushgateway"
  recovery_window_in_days = 7
  tags                    = var.tags
}

# -----------------------------------------------------------------------------
# IAM Policy cho task role doc secret
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "task_secrets_access" {
  statement {
    sid    = "AllowTaskRoleToReadSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    resources = [
      aws_secretsmanager_secret.wandb_api_key.arn,
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.metrics_token.arn,
      aws_secretsmanager_secret.prometheus_push_token.arn,
    ]
  }

  statement {
    sid    = "AllowTaskRoleToReadSecretsInTaskDefReference"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    # Khi su dung valueFrom trong containerDefinitions
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "secretsmanager:ResourceTag/Environment"
      values   = ["prod"]
    }
  }
}

resource "aws_iam_policy" "task_secrets_access" {
  count  = var.task_execution_role_arn != null ? 1 : 0
  name   = "${var.name}-task-secrets-access"
  policy = data.aws_iam_policy_document.task_secrets_access.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "task_secrets_access" {
  count      = var.task_execution_role_arn != null ? 1 : 0
  role       = var.task_execution_role_arn
  policy_arn = aws_iam_policy.task_secrets_access[0].arn
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "secret_arns" {
  description = "Danh sach ARN cua cac secrets da tao"
  value = {
    wandb_api_key         = aws_secretsmanager_secret.wandb_api_key.arn
    database_url          = aws_secretsmanager_secret.database_url.arn
    metrics_token         = aws_secretsmanager_secret.metrics_token.arn
    prometheus_push_token = aws_secretsmanager_secret.prometheus_push_token.arn
  }
}

output "wandb_api_key_arn" {
  value = aws_secretsmanager_secret.wandb_api_key.arn
}
