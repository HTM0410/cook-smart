# =============================================================================
# Module: service_discovery
# Tao Cloud Map namespace + service discovery cho YOLO service.
# Sau khi apply, backend co the truy cap YOLO qua DNS:
#   cooksmart-prod-v2-yolo.cooksmart.local:8000
# =============================================================================

variable "name" {
  description = "Ten prefix"
  type        = string
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
}

variable "namespace_name" {
  description = "Ten namespace Cloud Map (DNS suffix)"
  type        = string
  default     = "cooksmart.local"
}

variable "yolo_service_name" {
  description = "Ten service trong namespace"
  type        = string
  default     = "cooksmart-prod-v2-yolo"
}

resource "aws_service_discovery_private_dns_namespace" "ns" {
  name        = var.namespace_name
  description = "Private DNS namespace cho cooksmart-prod-v2 services"
  vpc         = var.vpc_id
}

resource "aws_service_discovery_service" "yolo" {
  name = var.yolo_service_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.ns.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

output "namespace_id" {
  value = aws_service_discovery_private_dns_namespace.ns.id
}

output "namespace_name" {
  value = aws_service_discovery_private_dns_namespace.ns.name
}

output "yolo_service_id" {
  value = aws_service_discovery_service.yolo.id
}

output "yolo_service_arn" {
  value = aws_service_discovery_service.yolo.arn
}

output "yolo_dns_name" {
  value = "${var.yolo_service_name}.${var.namespace_name}"
}
