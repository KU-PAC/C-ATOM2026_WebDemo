terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }

  # Public repository safe: backend settings are injected locally.
  # Example:
  # terraform init -backend-config=backend.hcl
  backend "s3" {}
}