output "tunnel_id" {
  description = "The ID of the created tunnel"
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.id
}

output "tunnel_token" {
  description = "Token for running cloudflared (use with 'cloudflared tunnel run --token <token>')"
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.tunnel_token
  sensitive   = true
}

output "tunnel_cname" {
  description = "CNAME target for the tunnel"
  value       = "${cloudflare_zero_trust_tunnel_cloudflared.this.id}.cfargotunnel.com"
}

output "dns_record_hostname" {
  description = "The full hostname of the created DNS record"
  value       = cloudflare_record.tunnel.hostname
}
