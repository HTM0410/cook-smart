variable "name" {
  description = "Ten prefix cho ALB"
  type        = string
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
}

variable "public_subnets" {
  description = "Danh sach public subnet cho ALB"
  type        = list(string)
}

variable "acm_arn" {
  description = "ARN cua ACM certificate cho HTTPS"
  type        = string
  default     = null
}

variable "internal" {
  description = "ALB internal hay internet-facing"
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "container_port" {
  description = "Port container YOLO service expose"
  type        = number
  default     = 8000
}

variable "health_check_path" {
  description = "Path cho ALB healthcheck"
  type        = string
  default     = "/health"
}

# -----------------------------------------------------------------------------
# Security group
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb-sg"
  description = "Allow inbound traffic to ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Test listener port"
    from_port   = 9000
    to_port     = 9000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-alb-sg" })
}

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------

resource "aws_lb" "this" {
  name               = "${var.name}-alb"
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnets

  enable_deletion_protection = true
  drop_invalid_header_fields = true

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Target Groups - 2 cai cho Blue/Green
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "blue" {
  name        = "${var.name}-blue-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = var.health_check_path
    port                = "traffic-port"
    matcher             = "200-399"
  }

  deregistration_delay = 30

  tags = var.tags
}

resource "aws_lb_target_group" "green" {
  name        = "${var.name}-green-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = var.health_check_path
    port                = "traffic-port"
    matcher             = "200-399"
  }

  deregistration_delay = 30

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Listeners: Production (443 -> blue) + Test (9000 -> green) + HTTP fallback
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "prod_https" {
  count = var.acm_arn != null ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }

  tags = var.tags
}

# HTTP redirect to HTTPS (chi khi co ACM cert)
resource "aws_lb_listener" "http_redirect" {
  count = var.acm_arn != null ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = var.tags
}

# Fallback prod listener HTTP neu khong co ACM cert
resource "aws_lb_listener" "prod_http_fallback" {
  count = var.acm_arn == null ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_zone_id" {
  value = aws_lb.this.zone_id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "blue_tg_arn" {
  value = aws_lb_target_group.blue.arn
}

output "blue_tg_name" {
  value = aws_lb_target_group.blue.name
}

output "green_tg_arn" {
  value = aws_lb_target_group.green.arn
}

output "green_tg_name" {
  value = aws_lb_target_group.green.name
}

output "prod_listener_arn" {
  value = coalesce(
    try(aws_lb_listener.prod_https[0].arn, null),
    try(aws_lb_listener.prod_http_fallback[0].arn, null)
  )
}
