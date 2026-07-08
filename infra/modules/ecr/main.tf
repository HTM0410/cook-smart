variable "name" {
  description = "Ten prefix cho cac ECR repo"
  type        = string
}

variable "tags" {
  description = "Tag chung"
  type        = map(string)
  default     = {}
}

variable "repositories" {
  description = "Danh sach ten repository can tao"
  type        = set(string)
  default     = ["cooksmart-backend", "cooksmart-yolo", "cooksmart-drift"]
}

variable "image_tag_mutability" {
  description = "MUTABLE cho phep overwrite tag (can thiet cho 'production' alias image)"
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Bat vulnerability scan luc push image"
  type        = bool
  default     = true
}

variable "max_image_count" {
  description = "So image toi da giu lai (LIFECYCLE policy)"
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Repositories
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  for_each = var.repositories

  name                 = each.value
  image_tag_mutability = var.image_tag_mutability
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.tags, {
    Service = each.value
  })
}

# -----------------------------------------------------------------------------
# Lifecycle policy: giu lai 10 image moi nhat
# -----------------------------------------------------------------------------

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = var.repositories

  repository = aws_ecr_repository.this[each.key].name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Giu ${var.max_image_count} image moi nhat"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

# -----------------------------------------------------------------------------
# Repository policy: cho phep CodeBuild push image
# DISABLED - chua co CodeBuild account id
# -----------------------------------------------------------------------------

# data "aws_caller_identity" "current" {}

# data "aws_iam_policy_document" "codebuild_push" {
#   for_each = var.repositories

#   statement {
#     sid    = "AllowCodeBuildToPushImage"
#     effect = "Allow"

#     principals {
#       type        = "AWS"
#       identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
#     }

#     actions = [
#       "ecr:GetDownloadUrlForLayer",
#       "ecr:BatchGetImage",
#       "ecr:BatchCheckLayerAvailability",
#       "ecr:PutImage",
#       "ecr:InitiateLayerUpload",
#       "ecr:UploadLayerPart",
#       "ecr:CompleteLayerUpload",
#     ]

#     resources = [aws_ecr_repository.this[each.key].arn]
#   }
# }

# resource "aws_ecr_repository_policy" "this" {
#   for_each = var.repositories

#   repository = aws_ecr_repository.this[each.key].name
#   policy     = data.aws_iam_policy_document.codebuild_push[each.key].json
# }

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "repository_arns" {
  description = "Map ARN theo ten repo"
  value       = { for k, v in aws_ecr_repository.this : k => v.arn }
}

output "repository_urls" {
  description = "Map URL theo ten repo"
  value       = { for k, v in aws_ecr_repository.this : k => v.repository_url }
}

output "backend_repo_arn" {
  value = aws_ecr_repository.this["cooksmart-backend"].arn
}

output "backend_repo_url" {
  value = aws_ecr_repository.this["cooksmart-backend"].repository_url
}

output "yolo_repo_arn" {
  value = aws_ecr_repository.this["cooksmart-yolo"].arn
}

output "yolo_repo_url" {
  value = aws_ecr_repository.this["cooksmart-yolo"].repository_url
}

output "drift_repo_arn" {
  value = aws_ecr_repository.this["cooksmart-drift"].arn
}

output "drift_repo_url" {
  value = aws_ecr_repository.this["cooksmart-drift"].repository_url
}
