terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "tunnel" {
  source = "./modules/cloudflare-tunnel"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  tunnel_name           = var.tunnel_name
  subdomain             = var.subdomain

  ingress_rules = [
    {
      hostname = "${var.subdomain}.${var.domain}"
      service  = var.origin_service
    }
  ]

  catch_all_service = "http_status:404"
}
