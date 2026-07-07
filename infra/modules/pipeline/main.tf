# =============================================================================
# Module: pipeline
# AWS CodePipeline + CodeBuild cho CookSmart.
# Flow: Source (GitHub) -> Build (docker build + push ECR) ->
#       Approval (manual) -> Deploy (CodeDeploy ECS Blue/Green).
# =============================================================================

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo full name (owner/repo)"
  type        = string
}

variable "github_branch" {
  description = "Branch trigger build"
  type        = string
  default     = "main"
}

variable "codestar_connection_arn" {
  description = "ARN cua CodeStar connection toi GitHub. Tao bang console truoc."
  type        = string
}

variable "ecr_backend_arn" {
  description = "ARN ECR repo backend"
  type        = string
}

variable "ecr_yolo_arn" {
  description = "ARN ECR repo yolo"
  type        = string
}

variable "ecr_drift_arn" {
  description = "ARN ECR repo drift"
  type        = string
}

variable "code_deploy_app_name" {
  description = "Ten CodeDeploy app"
  type        = string
}

variable "code_deploy_deployment_group_name" {
  description = "Ten CodeDeploy deployment group"
  type        = string
}

variable "approval_sns_topic_arn" {
  description = "SNS topic de notify khi pipeline can approval"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

# -----------------------------------------------------------------------------
# S3 artifact bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "artifacts" {
  bucket        = "${var.name}-pipeline-artifacts"
  force_destroy = false
  tags          = merge(var.tags, { Name = "${var.name}-pipeline-artifacts" })
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# -----------------------------------------------------------------------------
# IAM CodePipeline
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "codepipeline_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline" {
  name               = "${var.name}-codepipeline"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "codepipeline_inline" {
  statement {
    sid    = "S3Artifacts"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.artifacts.arn}/*"]
  }

  statement {
    sid       = "S3BucketAccess"
    effect    = "Allow"
    actions   = ["s3:GetBucketVersioning"]
    resources = [aws_s3_bucket.artifacts.arn]
  }

  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:DescribeImages",
      "ecr:BatchGetImage",
    ]
    resources = [
      var.ecr_backend_arn,
      var.ecr_yolo_arn,
      var.ecr_drift_arn,
    ]
  }

  statement {
    sid       = "CodeStarGitHubSource"
    effect    = "Allow"
    actions   = ["codestar-connections:UseConnection"]
    resources = [var.codestar_connection_arn]
  }

  statement {
    sid       = "CodeDeployTrigger"
    effect    = "Allow"
    actions   = ["codedeploy:CreateDeployment", "codedeploy:GetDeployment", "codedeploy:GetDeploymentConfig", "codedeploy:RegisterApplicationRevision"]
    resources = ["*"]
  }

  statement {
    sid       = "CodeBuildInvoke"
    effect    = "Allow"
    actions   = ["codebuild:BatchGetBuilds", "codebuild:StartBuild", "codebuild:StopBuild"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "codepipeline" {
  role   = aws_iam_role.codepipeline.id
  policy = data.aws_iam_policy_document.codepipeline_inline.json
}

# -----------------------------------------------------------------------------
# IAM CodeBuild
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${var.name}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "codebuild_inline" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "S3CacheAndSource"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:GetBucketVersioning",
    ]
    resources = [
      aws_s3_bucket.artifacts.arn,
      "${aws_s3_bucket.artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:DescribeImages",
      "ecr:BatchGetImage",
    ]
    resources = [
      var.ecr_backend_arn,
      var.ecr_yolo_arn,
      var.ecr_drift_arn,
    ]
  }

  statement {
    sid       = "ECRGetAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  role   = aws_iam_role.codebuild.id
  policy = data.aws_iam_policy_document.codebuild_inline.json
}

# -----------------------------------------------------------------------------
# CodeBuild project - build 3 image
# Buildspec duoc inject inline vi reference den root project.
# -----------------------------------------------------------------------------

resource "aws_codebuild_project" "build" {
  name         = "${var.name}-build"
  description  = "Build backend + yolo + drift images"
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true # can thiet de chay docker

    environment_variable {
      name  = "AWS_REGION"
      value = "us-east-1"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = file("${path.module}/../../../buildspec.yml")
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CodePipeline: Source -> Build -> Approval -> Deploy
# -----------------------------------------------------------------------------

resource "aws_codepipeline" "this" {
  name     = "${var.name}-pipeline"
  role_arn = aws_iam_role.codepipeline.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.bucket
    type     = "S3"
  }

  # Source: GitHub qua CodeStar connection
  stage {
    name = "Source"

    action {
      name             = "GitHubSource"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["SourceArtifact"]

      configuration = {
        ConnectionArn    = var.codestar_connection_arn
        FullRepositoryId = var.github_repo
        BranchName       = var.github_branch
      }
    }
  }

  # Build: docker build + push ECR
  stage {
    name = "Build"

    action {
      name             = "BuildImages"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceArtifact"]
      output_artifacts = ["BuildArtifact"]

      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }

  # Approval gate - manual
  stage {
    name = "Approval"

    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        CustomData = "Kiem tra W&B alias da switch sang 'production' va metric tren Grafana o muc chuan truoc khi approve."
      }
    }
  }

  # Deploy: CodeDeploy Blue/Green
  stage {
    name = "Deploy"

    action {
      name            = "CodeDeployBlueGreen"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeployToECS"
      version         = "1"
      input_artifacts = ["BuildArtifact"]

      configuration = {
        ApplicationName                = var.code_deploy_app_name
        DeploymentGroupName            = var.code_deploy_deployment_group_name
        TaskDefinitionTemplateArtifact = "BuildArtifact"
        TaskDefinitionTemplatePath     = "imagedefinitions.json"
        AppSpecTemplateArtifact        = "BuildArtifact"
        AppSpecTemplatePath            = "appspec.yml"
      }
    }
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "pipeline_name" {
  value = aws_codepipeline.this.name
}

output "pipeline_arn" {
  value = aws_codepipeline.this.arn
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}
