# =============================================================================
# Production environment configuration
# Bien can thiet cho production deploy - KHONG commit secret value, chi ten+ARN.
# =============================================================================

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "name" {
  description = "Ten prefix cho toan bo resource"
  type        = string
  default     = "cooksmart-prod-v2"
}

variable "vpc_id" {
  description = "VPC id cho production"
  type        = string
}

variable "public_subnets" {
  description = "Public subnets cho ALB"
  type        = list(string)
}

variable "private_subnets" {
  description = "Private subnets cho ECS Fargate"
  type        = list(string)
}

variable "acm_arn" {
  description = "ARN cua ACM certificate (HTTPS neu co)"
  type        = string
  default     = null
}

variable "github_repo" {
  description = "GitHub repo full name (owner/repo)"
  type        = string
  default     = "HTM0410/cook-smart"
}

variable "github_branch" {
  description = "Branch trigger build"
  type        = string
  default     = "main"
}

variable "codestar_connection_arn" {
  description = "ARN cua CodeStar connection toi GitHub. Tao qua console truoc."
  type        = string
}

variable "approval_sns_topic_arn" {
  description = "SNS topic de notify approval"
  type        = string
  default     = null
}

variable "yolo_image_tag" {
  description = "Image tag mac dinh cua YOLO service luc initial deploy"
  type        = string
  default     = "latest"
}

variable "tags" {
  description = "Common tags cho toan bo resources"
  type        = map(string)
  default = {
    Project     = "cooksmart"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
