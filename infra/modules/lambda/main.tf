terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

# =============================================================================
# Module: lambda
# Tao 3 Lambda function (backend-api, yolo-infer, drift-job) + API Gateway HTTP API
# + Provisioned Concurrency cho yolo-infer + EventBridge rule cho drift-job.
# Thay the ECS Fargate + ALB stack.
# =============================================================================

variable "name" {
  description = "Ten prefix cho Lambda resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC id (de tao VPC endpoints cho Secrets Manager + S3 gateway)"
  type        = string
}

variable "private_subnets" {
  description = "Private subnets cho Lambda VPC config (can cho Secrets Manager access)"
  type        = list(string)
}

variable "secrets_arn" {
  description = "ARN cac Secrets Manager secret (wandb_api_key, database_url, metrics_token, prometheus_push_token)"
  type = object({
    wandb_api_key         = string
    database_url          = string
    metrics_token         = string
    prometheus_push_token = string
  })
}

variable "ecr_images" {
  description = "Map URL ECR image theo ten function"
  type = object({
    backend = string
    yolo    = string
    drift   = string
  })
}

variable "s3_model_bucket" {
  description = "Ten S3 bucket chua model weights (cooksmart-models)"
  type        = string
}

variable "s3_model_prefix" {
  description = "Prefix mac dinh trong bucket (vd: ingredient-detector/)"
  type        = string
  default     = "ingredient-detector/"
}

variable "model_versions_table" {
  description = "Ten DynamoDB table luu model versions"
  type        = string
  default     = "cooksmart-model-versions"
}

variable "yolo_provisioned_concurrency" {
  description = "So instance provisioned concurrency cho yolo-infer (0 = off)"
  type        = number
  default     = 1
}

variable "yolo_memory" {
  description = "Memory (MB) cho yolo-infer Lambda (set 10240 = unlock 6 vCPU)"
  type        = number
  default     = 10240
}

variable "yolo_timeout" {
  description = "Timeout (giay) cho yolo-infer Lambda (max 900)"
  type        = number
  default     = 60
}

variable "backend_memory" {
  description = "Memory (MB) cho backend-api Lambda"
  type        = number
  default     = 512
}

variable "backend_timeout" {
  description = "Timeout (giay) cho backend-api Lambda"
  type        = number
  default     = 30
}

variable "drift_memory" {
  description = "Memory (MB) cho drift-job Lambda"
  type        = number
  default     = 512
}

variable "drift_timeout" {
  description = "Timeout (giay) cho drift-job Lambda (max 900)"
  type        = number
  default     = 300
}

variable "cors_allow_origins" {
  description = "Allowed origins cho API Gateway CORS"
  type        = list(string)
  default     = ["*"]
}

variable "sns_topic_arn" {
  description = "SNS topic cho alarm notification (optional)"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# Data sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# VPC endpoints: Secrets Manager + S3 gateway (fix ResourceInit error cua ECS)
# -----------------------------------------------------------------------------

resource "aws_security_group" "vpce" {
  name        = "${var.name}-vpce-sg"
  description = "Allow HTTPS tu Lambda SG den VPC endpoints"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS tu Lambda"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-vpce-sg" })
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnets
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name}-secretsmanager-vpce" })
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.private.ids

  tags = merge(var.tags, { Name = "${var.name}-s3-gateway-vpce" })
}

data "aws_route_tables" "private" {
  vpc_id = var.vpc_id

  filter {
    name   = "tag:Type"
    values = ["private"]
  }
}

# -----------------------------------------------------------------------------
# Lambda security group (can VPC config de truy cap Secrets Manager, S3)
# -----------------------------------------------------------------------------

resource "aws_security_group" "lambda" {
  name        = "${var.name}-lambda-sg"
  description = "Lambda ENI security group"
  vpc_id      = var.vpc_id

  egress {
    description = "All outbound (can cho Secrets Manager, S3, W&B)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-lambda-sg" })
}

# -----------------------------------------------------------------------------
# IAM role: Lambda execution role (co the goi ecr, logs, secrets, s3, dynamodb)
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${var.name}-lambda-exec-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_basic_exec" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy: secrets + S3 model bucket + DynamoDB
data "aws_iam_policy_document" "lambda_inline" {
  statement {
    sid    = "AllowReadSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = [
      var.secrets_arn.wandb_api_key,
      var.secrets_arn.database_url,
      var.secrets_arn.metrics_token,
      var.secrets_arn.prometheus_push_token,
    ]
  }

  statement {
    sid    = "AllowReadModelBucket"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::${var.s3_model_bucket}",
      "arn:aws:s3:::${var.s3_model_bucket}/*",
    ]
  }

  statement {
    sid    = "AllowReadModelManifestTable"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.model_versions_table}",
    ]
  }

  statement {
    sid    = "AllowECRPull"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "lambda_inline" {
  name   = "${var.name}-lambda-inline"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_inline.json
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups (30 ngay retention, giong ECS stack cu)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/aws/lambda/${var.name}-backend-api"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "yolo" {
  name              = "/aws/lambda/${var.name}-yolo-infer"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "drift" {
  name              = "/aws/lambda/${var.name}-drift-job"
  retention_in_days = 30
  tags              = var.tags
}

# -----------------------------------------------------------------------------
# Lambda functions
# -----------------------------------------------------------------------------

# Common env vars cho yolo-infer.
# Secret ARNs duoc set nhu env vars; Lambda runtime tu resolve ARN thanh value.
locals {
  yolo_env = merge(
    {
      MLOPS_ENABLED        = "true"
      MLOPS_REGISTRY       = "s3"
      S3_MODEL_BUCKET      = var.s3_model_bucket
      S3_MODEL_PREFIX      = var.s3_model_prefix
      DYNAMODB_MODEL_TABLE = var.model_versions_table
      CONF_INFERENCE_FLOOR = "0.25"
      EMBEDDING_ENABLED    = "true"
      EMBEDDING_MODEL      = "BAAI/bge-m3"
      OMP_NUM_THREADS      = "6"
      MKL_NUM_THREADS      = "6"
      CUDA_VISIBLE_DEVICES = ""
      PORT                 = "8000"
    },
    {
      WANDB_API_KEY         = var.secrets_arn.wandb_api_key
      DATABASE_URL          = var.secrets_arn.database_url
      METRICS_TOKEN         = var.secrets_arn.metrics_token
      PROMETHEUS_PUSH_TOKEN = var.secrets_arn.prometheus_push_token
    },
  )

  backend_env = merge(
    {
      NODE_ENV      = "production"
      YOLO_BASE_URL = "" # set via API Gateway private integration neu can
      CORS_ORIGIN   = join(",", var.cors_allow_origins)
    },
    {
      DATABASE_URL = var.secrets_arn.database_url
      JWT_SECRET   = "" # them secret neu can
    },
  )

  drift_env = merge(
    {
      YOLO_METRICS_URL      = "" # set tu API Gateway URL cua yolo
      BASELINE_DATA_PATH    = "/var/task/baselines/data_baseline.npz"
      BASELINE_PRED_PATH    = "/var/task/baselines/pred_baseline.json"
      BASELINE_CONCEPT_PATH = "/var/task/baselines/concept_baseline.npz"
    },
    {
      METRICS_TOKEN         = var.secrets_arn.metrics_token
      PROMETHEUS_PUSH_TOKEN = var.secrets_arn.prometheus_push_token
    },
  )
}

# ---- Backend API ----
resource "aws_lambda_function" "backend" {
  function_name = "${var.name}-backend-api"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = var.ecr_images.backend
  architectures = ["arm64"]

  memory_size = var.backend_memory
  timeout     = var.backend_timeout

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = local.backend_env
  }

  depends_on = [
    aws_cloudwatch_log_group.backend,
    aws_iam_role_policy_attachment.lambda_basic_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy.lambda_inline,
  ]


  tags = var.tags
}

# ---- YOLO inference ----
resource "aws_lambda_function" "yolo" {
  function_name = "${var.name}-yolo-infer"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = var.ecr_images.yolo
  architectures = ["arm64"]

  memory_size = var.yolo_memory
  timeout     = var.yolo_timeout

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = local.yolo_env
  }

  depends_on = [
    aws_cloudwatch_log_group.yolo,
    aws_iam_role_policy_attachment.lambda_basic_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy.lambda_inline,
  ]

  tags = var.tags
}

# Provisioned Concurrency cho yolo (giup cold start <100ms)
resource "aws_lambda_provisioned_concurrency_config" "yolo" {
  count = var.yolo_provisioned_concurrency > 0 ? 1 : 0

  function_name                     = aws_lambda_function.yolo.function_name
  provisioned_concurrent_executions = var.yolo_provisioned_concurrency
  qualifier                         = aws_lambda_function.yolo.version
}

# ---- Drift job ----
resource "aws_lambda_function" "drift" {
  function_name = "${var.name}-drift-job"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = var.ecr_images.drift
  architectures = ["arm64"]

  memory_size = var.drift_memory
  timeout     = var.drift_timeout

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = local.drift_env
  }

  depends_on = [
    aws_cloudwatch_log_group.drift,
    aws_iam_role_policy_attachment.lambda_basic_exec,
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy.lambda_inline,
  ]

  tags = var.tags
}

# -----------------------------------------------------------------------------
# API Gateway HTTP API
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.name}-http-api"
  protocol_type = "HTTP"
  description   = "API Gateway HTTP API cho CookSmart backend + yolo"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  tags = var.tags
}

# ---- Backend integration (route tat ca /api/* va /health) ----
resource "aws_apigatewayv2_integration" "backend" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "backend_default" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_route" "backend_health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_route" "backend_metrics" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /metrics"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

# ---- YOLO integration (route /yolo/* - FastAPI service) ----
resource "aws_apigatewayv2_integration" "yolo" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.yolo.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "yolo_proxy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /yolo/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.yolo.id}"
}

resource "aws_apigatewayv2_route" "yolo_health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /yolo/health"
  target    = "integrations/${aws_apigatewayv2_integration.yolo.id}"
}

# ---- Lambda permission cho API Gateway ----
resource "aws_lambda_permission" "apigw_backend" {
  statement_id  = "AllowAPIGatewayInvokeBackend"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_yolo" {
  statement_id  = "AllowAPIGatewayInvokeYolo"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.yolo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# -----------------------------------------------------------------------------
# EventBridge rule cho drift-job (rate(6 hours))
# -----------------------------------------------------------------------------

resource "aws_scheduler_schedule_group" "drift" {
  name = "${var.name}-drift-schedules"
  tags = var.tags
}

resource "aws_scheduler_schedule" "drift" {
  name                = "${var.name}-drift-every-6h"
  group_name          = aws_scheduler_schedule_group.drift.name
  schedule_expression = "rate(6 hours)"
  flexible_time_window {
    mode = "OFF"
  }
  target {
    arn      = aws_lambda_function.drift.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ "action" : "run" })
  }

  state = "ENABLED"
}

# IAM role cho EventBridge Scheduler goi Lambda
data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "${var.name}-scheduler-invoke-drift"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.drift.arn
    }]
  })
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "api_endpoint" {
  description = "Public URL cua API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_id" {
  description = "API Gateway ID (cho alarms 5xx)"
  value       = aws_apigatewayv2_api.main.id
}

output "backend_function_name" {
  value = aws_lambda_function.backend.function_name
}

output "backend_function_arn" {
  value = aws_lambda_function.backend.arn
}

output "yolo_function_name" {
  value = aws_lambda_function.yolo.function_name
}

output "yolo_function_arn" {
  value = aws_lambda_function.yolo.arn
}

output "drift_function_name" {
  value = aws_lambda_function.drift.function_name
}

output "drift_function_arn" {
  value = aws_lambda_function.drift.arn
}

output "log_group_backend" {
  value = aws_cloudwatch_log_group.backend.name
}

output "log_group_yolo" {
  value = aws_cloudwatch_log_group.yolo.name
}

output "log_group_drift" {
  value = aws_cloudwatch_log_group.drift.name
}

output "lambda_exec_role_arn" {
  value = aws_iam_role.lambda_exec.arn
}

output "vpce_security_group_id" {
  value = aws_security_group.vpce.id
}
