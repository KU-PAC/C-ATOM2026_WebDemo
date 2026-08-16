variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "tags" {
  description = "Tags applied to resources"
  type        = map(string)
  default     = {}
}

variable "bucket_name" {
  description = "S3 bucket name for static website hosting"
  type        = string
  default     = "kupac-challenge-atom-2026-concept-website"
}

variable "cloudfront_distribution_name" {
  description = "CloudFront distribution name"
  type        = string
  default     = "kupac-challenge-atom-2026-cloudfront"
}

variable "aws_profile" {
  description = "AWS shared config profile name used by Terraform AWS provider"
  type        = string
}

variable "public_domain" {
  description = "Public domain name for CloudFront alias (for example: www.example.com)"
  type        = string
  default     = null
  nullable    = true
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the public domain (must be in us-east-1 for CloudFront)"
  type        = string
  default     = null
  nullable    = true
}