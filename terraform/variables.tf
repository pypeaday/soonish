variable "cloudflare_api_token" {
  description = "Cloudflare API token with tunnel and DNS permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the domain"
  type        = string
}

variable "domain" {
  description = "Base domain (e.g., 'example.com')"
  type        = string
}

variable "subdomain" {
  description = "Subdomain to create (e.g., 'app' for app.example.com)"
  type        = string
  default     = "app"
}

variable "tunnel_name" {
  description = "Name for the Cloudflare tunnel"
  type        = string
  default     = "soonish-tunnel"
}

variable "origin_service" {
  description = "Origin service URL (e.g., 'http://localhost:8000')"
  type        = string
  default     = "http://localhost:8000"
}
