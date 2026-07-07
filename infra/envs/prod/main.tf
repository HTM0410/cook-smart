# =============================================================================
# Production entry point - compose cac modules thanh hoan chinh
# Thứ tự áp dụng: secrets -> ecr -> alb -> ecs_blue_green -> pipeline -> monitoring
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
# Compute: ECS Fargate Blue/Green
# -----------------------------------------------------------------------------

module "ecs_blue_green" {
  source = "../../modules/ecs_blue_green"
  name   = var.name

  vpc_id          = var.vpc_id
  private_subnets = var.private_subnets

  # Lay ALB SG de mo ingress tu ALB vao task
  alb_security_group_id = module.alb.alb_security_group_id

  # Lay target group info tu module alb
  blue_tg_arn   = module.alb.blue_tg_arn
  blue_tg_name  = module.alb.blue_tg_name
  green_tg_arn  = module.alb.green_tg_arn
  green_tg_name = module.alb.green_tg_name

  prod_listener_arn = module.alb.prod_listener_arn
  test_listener_arn = module.alb.test_listener_arn

  yolo_image = "${module.ecr.yolo_repo_url}:${var.yolo_image_tag}"

  secrets_arn = {
    wandb_api_key         = module.secrets.secret_arns.wandb_api_key
    database_url          = module.secrets.secret_arns.database_url
    metrics_token         = module.secrets.secret_arns.metrics_token
    prometheus_push_token = module.secrets.secret_arns.prometheus_push_token
  }

  region = var.region
  tags   = var.tags
}

# -----------------------------------------------------------------------------
# CI/CD: CodePipeline + CodeBuild
# -----------------------------------------------------------------------------

module "pipeline" {
  source = "../../modules/pipeline"
  name   = var.name

  github_repo             = var.github_repo
  github_branch           = var.github_branch
  codestar_connection_arn = var.codestar_connection_arn

  ecr_backend_arn = module.ecr.backend_repo_arn
  ecr_yolo_arn    = module.ecr.yolo_repo_arn
  ecr_drift_arn   = module.ecr.drift_repo_arn

  code_deploy_app_name              = module.ecs_blue_green.code_deploy_app_name
  code_deploy_deployment_group_name = module.ecs_blue_green.code_deploy_deployment_group_name

  approval_sns_topic_arn = var.approval_sns_topic_arn

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Monitoring: CloudWatch alarms
# -----------------------------------------------------------------------------

module "monitoring" {
  source = "../../modules/monitoring"
  name   = var.name

  alb_arn_suffix               = module.alb.alb_arn
  yolo_target_group_arn_suffix = module.alb.blue_tg_arn
  ecs_cluster_name             = module.ecs_blue_green.cluster_name
  yolo_service_name            = module.ecs_blue_green.service_name

  sns_topic_arn = var.approval_sns_topic_arn
  tags          = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Public DNS cua ALB production"
  value       = module.alb.alb_dns_name
}

output "pipeline_name" {
  description = "Ten CodePipeline - trigger khi promote model"
  value       = module.pipeline.pipeline_name
}

output "pipeline_arn" {
  value = module.pipeline.pipeline_arn
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
  value = module.ecs_blue_green.cluster_name
}

output "ecs_service_name" {
  value = module.ecs_blue_green.service_name
}

output "code_deploy_app_name" {
  value = module.ecs_blue_green.code_deploy_app_name
}

output "code_deploy_deployment_group_name" {
  value = module.ecs_blue_green.code_deploy_deployment_group_name
}

output "log_group_name" {
  value = module.ecs_blue_green.log_group_name
}

output "sns_topic_arn" {
  description = "ARN SNS topic de notify (co the la approval hoac alert)"
  value       = var.approval_sns_topic_arn
}
