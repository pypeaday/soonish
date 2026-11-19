output "tunnel_id" {
  description = "The ID of the created tunnel"
  value       = module.tunnel.tunnel_id
}

output "tunnel_token" {
  description = "Token for running cloudflared"
  value       = module.tunnel.tunnel_token
  sensitive   = true
}

output "public_url" {
  description = "The public URL for the tunnel"
  value       = "https://${module.tunnel.dns_record_hostname}"
}
