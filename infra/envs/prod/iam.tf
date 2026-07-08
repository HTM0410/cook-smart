# =============================================================================
# IAM policies gan truc tiep vao task execution role cua ECS
# Resource gan role policy attachment vao module.ecs_blue_green.task_execution_role_arn
# =============================================================================

# Policy doc cho task execution role (pull image + lay secret)
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

# Attach policy vao task execution role
resource "aws_iam_role_policy_attachment" "task_secrets_access" {
  role       = basename(module.ecs.task_execution_role_arn)
  policy_arn = aws_iam_policy.task_secrets_access.arn
}
