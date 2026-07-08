# =============================================================================
# S3 + DynamoDB state backend
# Tao bang AWS CLI truoc khi terraform init:
#   aws s3api create-bucket --bucket cooksmart-tfstate --region us-east-1 \
#     --create-bucket-configuration LocationConstraint=us-east-1
#   aws dynamodb create-table --table-name cooksmart-tflock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST
#
# Stack key: prod-v2 = ECS (legacy), prod-v2-lambda = Lambda (new, parallel)
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  backend "s3" {
    bucket         = "cooksmart-tfstate"
    key            = "prod-v2/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "cooksmart-tflock"
    encrypt        = true
  }
}

# Stack Lambda (main.tf.lambda) su dung key rieng. Khi switch:
# 1. cp main.tf main.tf.ecs && cp main.tf.lambda main.tf
# 2. doi key = "prod-v2-lambda/terraform.tfstate" trong backend block
# 3. terraform init -migrate-state (hoac -reconfigure neu state moi)

# Stub providers - thuc te terraform set region tu backend hoac CLI
provider "aws" {
  region = var.region

  default_tags {
    tags = var.tags
  }
}
