# Cloudflare Tunnel Terraform

Creates a Cloudflare Tunnel to expose a local service to the internet.

## Prerequisites

1. Cloudflare account with a domain
2. API token with permissions:
   - `Account:Cloudflare Tunnel:Edit`
   - `Zone:DNS:Edit`
3. `cloudflared` installed on the host machine

## Usage

```bash
# Copy example vars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars

# Initialize and apply
terraform init
terraform plan
terraform apply
```

## Running the Tunnel

After applying, get the tunnel token and run:

```bash
# Get the token (sensitive output)
terraform output -raw tunnel_token

# Run cloudflared with the token
cloudflared tunnel run --token <token>
```

Or run as a service:

```bash
sudo cloudflared service install <token>
```

## Module Inputs

| Variable | Description | Required |
|----------|-------------|----------|
| `cloudflare_api_token` | API token | Yes |
| `cloudflare_account_id` | Account ID | Yes |
| `cloudflare_zone_id` | Zone ID | Yes |
| `domain` | Base domain | Yes |
| `subdomain` | Subdomain | No (default: `app`) |
| `tunnel_name` | Tunnel name | No (default: `soonish-tunnel`) |
| `origin_service` | Origin URL | No (default: `http://localhost:8000`) |

## Outputs

- `tunnel_id` - Tunnel UUID
- `tunnel_token` - Token for cloudflared (sensitive)
- `public_url` - Public HTTPS URL
