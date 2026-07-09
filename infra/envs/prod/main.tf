# =============================================================================
# Production entry point - LAMBDA VERSION (parallel stack with ECS)
# Day vao state rieng (key=prod-v2-lambda/terraform.tfstate) de khong pha
# prod ECS dang chay o key=prod-v2/terraform.tfstate.
# Su dung: copy file nay thanh main.tf, doi backend key sang prod-v2-lambda,
# roi terraform init + apply.
# =============================================================================

# -----------------------------------------------------------------------------
# Security foundations (Secrets Manager - 4 secrets)
# -----------------------------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"
  name   = var.name
  region = var.region
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Container registry (ECR - 3 repos)
# -----------------------------------------------------------------------------

module "ecr" {
  source = "../../modules/ecr"
  name   = var.name
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Model registry (S3 + DynamoDB)
# -----------------------------------------------------------------------------

module "model_registry" {
  source = "../../modules/model_registry"
  name   = var.name
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Compute: AWS Lambda + API Gateway (thay the ECS Fargate)
# -----------------------------------------------------------------------------

module "lambda" {
  source = "../../modules/lambda"
  name   = var.name

  vpc_id          = var.vpc_id
  private_subnets = var.private_subnets

  secrets_arn = {
    wandb_api_key         = module.secrets.secret_arns.wandb_api_key
    database_url          = module.secrets.secret_arns.database_url
    metrics_token         = module.secrets.secret_arns.metrics_token
    prometheus_push_token = module.secrets.secret_arns.prometheus_push_token
  }

  ecr_images = {
    backend = module.ecr.backend_repo_url
    yolo    = module.ecr.yolo_repo_url
    drift   = module.ecr.drift_repo_url
  }

  s3_model_bucket        = module.model_registry.bucket_name
  s3_model_prefix        = "ingredient-detector/"
  model_versions_table   = module.model_registry.table_name

  yolo_provisioned_concurrency = 1
  yolo_memory                  = 10240
  yolo_timeout                 = 60
  backend_memory               = 512
  backend_timeout              = 30
  drift_memory                 = 512
  drift_timeout                = 300

  cors_allow_origins = ["*"]
  sns_topic_arn      = var.approval_sns_topic_arn
  tags               = var.tags
}

# -----------------------------------------------------------------------------
# Monitoring: CloudWatch alarms (Lambda metrics)
# -----------------------------------------------------------------------------

module "monitoring" {
  source = "../../modules/monitoring"
  name   = var.name

  yolo_function_name     = module.lambda.yolo_function_name
  backend_function_name  = module.lambda.backend_function_name
  drift_function_name    = module.lambda.drift_function_name
  api_id                 = module.lambda.api_id  # placeholder, su dung cho 5xx alarm
  sns_topic_arn          = var.approval_sns_topic_arn
  tags                   = var.tags
}

# -----------------------------------------------------------------------------
# CI/CD: GitHub Actions IAM Role
# Quyen update Lambda function code, publish version, update alias
# -----------------------------------------------------------------------------

module "github_actions" {
  source = "../../modules/github_actions"
  name   = var.name
  tags   = var.tags

  # Khong can ECS role nua (Lambda khong can task role rieng - dung Lambda exec role)
  ecs_task_execution_role_arn = module.lambda.lambda_exec_role_arn
  ecs_task_role_arn           = module.lambda.lambda_exec_role_arn

  database_url_secret_arn          = module.secrets.secret_arns.database_url
  wandb_api_key_secret_arn         = module.secrets.secret_arns.wandb_api_key
  metrics_token_secret_arn         = module.secrets.secret_arns.metrics_token
  prometheus_push_token_secret_arn = module.secrets.secret_arns.prometheus_push_token

  # Them quyen Lambda + S3 + DynamoDB cho GHA (mo rong policy o module)
  s3_model_bucket_arn   = module.model_registry.bucket_arn
  model_versions_table  = module.model_registry.table_name
  yolo_function_name    = module.lambda.yolo_function_name
  backend_function_name = module.lambda.backend_function_name
  drift_function_name   = module.lambda.drift_function_name

  github_repo = var.github_repo
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Public URL cua API Gateway"
  value       = module.lambda.api_endpoint
}

output "ecr_backend_url" {
  value = module.ecr.backend_repo_url
}

output "ecr_yolo_url" {
  value = module.ecr.yolo_repo_url
}

output "ecr_drift_url" {
  value = module.ecr.drift_repo_url
}

output "model_bucket" {
  value = module.model_registry.bucket_name
}

output "model_versions_table" {
  value = module.model_registry.table_name
}

output "yolo_function_name" {
  value = module.lambda.yolo_function_name
}

output "backend_function_name" {
  value = module.lambda.backend_function_name
}

output "drift_function_name" {
  value = module.lambda.drift_function_name
}

output "log_group_backend" {
  value = module.lambda.log_group_backend
}

output "log_group_yolo" {
  value = module.lambda.log_group_yolo
}

output "log_group_drift" {
  value = module.lambda.log_group_drift
}

output "sns_topic_arn" {
  value = var.approval_sns_topic_arn
}
