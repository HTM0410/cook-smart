terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Tao Cloud Map namespace va YOLO service discovery
module "service_discovery" {
  source = "../../modules/service_discovery"
  name   = "cooksmart-prod-v2"
  vpc_id = "REPLACE_WITH_VPC_ID"
}

# Neu can: gan service discovery ARN vao YOLO ECS service
# Trong AWS Console: ECS service "cooksmart-prod-v2-yolo-svc" >
#   Service discovery > Edit > Enable service discovery >
#   Service registry ARN: <yolo_service_arn output>

output "yolo_dns_name" {
  value = module.service_discovery.yolo_dns_name
}
