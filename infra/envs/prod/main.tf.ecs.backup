# =============================================================================
# Production entry point - SIMPLIFIED VERSION
# Chi dung: secrets, ecr, alb, ecs (rolling), monitoring
# Deploy se duoc thuc hien boi GitHub Actions thay vi CodePipeline
# =============================================================================

# -----------------------------------------------------------------------------
# Security foundations
# -----------------------------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"
  name   = var.name
  region = var.region
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Container registry
# -----------------------------------------------------------------------------

module "ecr" {
  source = "../../modules/ecr"
  name   = var.name
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Networking: Application Load Balancer
# -----------------------------------------------------------------------------

module "alb" {
  source            = "../../modules/alb"
  name              = var.name
  vpc_id            = var.vpc_id
  public_subnets    = var.public_subnets
  acm_arn           = var.acm_arn
  container_port    = 8000
  health_check_path = "/health"
  tags              = var.tags
}

# -----------------------------------------------------------------------------
# Compute: ECS Fargate (Rolling Update - khong dung CodeDeploy)
# -----------------------------------------------------------------------------

module "ecs" {
  source = "../../modules/ecs_simple"
  name   = var.name

  vpc_id          = var.vpc_id
  private_subnets = var.private_subnets

  alb_security_group_id = module.alb.alb_security_group_id
  target_group_arn      = module.alb.blue_tg_arn

  ecr_repo_url = module.ecr.yolo_repo_url

  secrets_arn = {
    wandb_api_key         = module.secrets.secret_arns.wandb_api_key
    database_url         = module.secrets.secret_arns.database_url
    metrics_token        = module.secrets.secret_arns.metrics_token
    prometheus_push_token = module.secrets.secret_arns.prometheus_push_token
  }

  region = var.region
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# Monitoring: CloudWatch alarms
# -----------------------------------------------------------------------------

module "monitoring" {
  source = "../../modules/monitoring"
  name   = var.name

  alb_arn_suffix               = module.alb.alb_arn
  yolo_target_group_arn_suffix = module.alb.blue_tg_arn
  ecs_cluster_name             = module.ecs.cluster_name
  yolo_service_name            = module.ecs.service_name

  sns_topic_arn = var.approval_sns_topic_arn
  tags          = var.tags
}

# -----------------------------------------------------------------------------
# CI/CD: GitHub Actions IAM Role
# -----------------------------------------------------------------------------

module "github_actions" {
  source = "../../modules/github_actions"
  name   = var.name
  tags   = var.tags

  ecs_task_execution_role_arn = module.ecs.task_execution_role_arn
  ecs_task_role_arn           = module.ecs.task_role_arn

  database_url_secret_arn          = module.secrets.secret_arns.database_url
  wandb_api_key_secret_arn         = module.secrets.secret_arns.wandb_api_key
  metrics_token_secret_arn         = module.secrets.secret_arns.metrics_token
  prometheus_push_token_secret_arn = module.secrets.secret_arns.prometheus_push_token

  github_repo = "HTM0410/cook-smart"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Public DNS cua ALB production"
  value       = module.alb.alb_dns_name
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

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "log_group_name" {
  value = module.ecs.log_group_name
}

output "sns_topic_arn" {
  value = var.approval_sns_topic_arn
}
