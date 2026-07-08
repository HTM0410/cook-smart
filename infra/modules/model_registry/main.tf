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
# Module: model_registry
# S3 bucket (immutable versioned model artifacts) + DynamoDB table (version metadata + alias pointer).
# Thay the W&B lam primary registry cho runtime serving.
# W&B van la source of truth cho training experiment tracking.
# =============================================================================

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "model_bucket" {
  description = "Ten S3 bucket chua model weights (vd: cooksmart-models)"
  type        = string
  default     = "cooksmart-models"
}

variable "table_name" {
  description = "Ten DynamoDB table (default: cooksmart-model-versions)"
  type        = string
  default     = "cooksmart-model-versions"
}

variable "force_destroy_bucket" {
  description = "Cho phep xoa bucket ngay ca khi co objects (chi dev)"
  type        = bool
  default     = false
}

variable "enable_object_lock" {
  description = "Bat S3 Object Lock de immutable model artifacts"
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# S3 Bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "models" {
  bucket              = var.model_bucket
  force_destroy       = var.force_destroy_bucket
  object_lock_enabled = var.enable_object_lock

  tags = var.tags
}

resource "aws_s3_bucket_versioning" "models" {
  bucket = aws_s3_bucket.models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "models" {
  bucket = aws_s3_bucket.models.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "models" {
  bucket = aws_s3_bucket.models.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle: xoa version cu sau 365 ngay, giu production alias vinh vien
resource "aws_s3_bucket_lifecycle_configuration" "models" {
  bucket = aws_s3_bucket.models.id

  rule {
    id     = "expire-old-nonprod"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# -----------------------------------------------------------------------------
# DynamoDB Table
# Partition key: PK (alias/version), Sort key: SK (META/POINTER)
# -----------------------------------------------------------------------------

resource "aws_dynamodb_table" "model_versions" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "bucket_name" {
  value = aws_s3_bucket.models.id
}

output "bucket_arn" {
  value = aws_s3_bucket.models.arn
}

output "table_name" {
  value = aws_dynamodb_table.model_versions.name
}

output "table_arn" {
  value = aws_dynamodb_table.model_versions.arn
}
