# =============================================================================
# S3 + DynamoDB state backend
# Tao bang AWS CLI truoc khi terraform init:
#   aws s3api create-bucket --bucket cooksmart-tfstate --region us-east-1 \
#     --create-bucket-configuration LocationConstraint=us-east-1
#   aws dynamodb create-table --table-name cooksmart-tflock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST
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

# Stub providers - thuc te terraform set region tu backend hoac CLI
provider "aws" {
  region = var.region

  default_tags {
    tags = var.tags
  }
}
