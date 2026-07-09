# =============================================================================
# IAM policies gan truc tiep vao Lambda execution role
# Resource gan role policy attachment vao module.lambda.lambda_exec_role_arn
# =============================================================================

# Policy doc cho Lambda execution role (pull image + lay secret)
data "aws_iam_policy_document" "task_secrets_access" {
  statement {
    sid    = "AllowReadAllAppSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    resources = [
      module.secrets.secret_arns.wandb_api_key,
      module.secrets.secret_arns.database_url,
      module.secrets.secret_arns.metrics_token,
      module.secrets.secret_arns.prometheus_push_token,
    ]
  }
}

resource "aws_iam_policy" "task_secrets_access" {
  name   = "${var.name}-task-secrets-access"
  policy = data.aws_iam_policy_document.task_secrets_access.json
  tags   = var.tags
}

# Attach policy vao Lambda execution role
resource "aws_iam_role_policy_attachment" "task_secrets_access" {
  role       = basename(module.lambda.lambda_exec_role_arn)
  policy_arn = aws_iam_policy.task_secrets_access.arn
}
