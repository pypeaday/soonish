variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the domain"
  type        = string
}

variable "tunnel_name" {
  description = "Name for the Cloudflare tunnel"
  type        = string
}

variable "subdomain" {
  description = "Subdomain to create (e.g., 'app' for app.example.com)"
  type        = string
}

variable "ingress_rules" {
  description = "List of ingress rules for the tunnel"
  type = list(object({
    hostname = string
    service  = string
  }))
  default = []
}

variable "catch_all_service" {
  description = "Service for the catch-all rule (e.g., 'http_status:404')"
  type        = string
  default     = "http_status:404"
}
