# Notifiq Standalone Frontend Example

This is a **standalone frontend** that demonstrates how to build a frontend application that communicates with the Notifiq API over HTTP, running independently on its own web server.

## Key Differences from Mounted Frontends

| Aspect | Mounted Frontend | Standalone Frontend |
|--------|------------------|---------------------|
| **Location** | Same repo as backend | Separate repo/location |
| **Deployment** | Built and mounted to FastAPI | Runs on own web server |
| **Communication** | Direct (same origin) | HTTP API calls (CORS) |
| **Development** | Build → mount → restart backend | Run independently with `npm run dev` |
| **Use Case** | Integrated apps | External integrations, mobile apps |

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Standalone Frontend    │         │   Notifiq Backend       │
│  (Port 5173)            │         │   (Port 8000)           │
│                         │         │                         │
│  - React + TypeScript   │  HTTP   │  - FastAPI              │
│  - Vite Dev Server      │ ◄─────► │  - CORS enabled         │
│  - Calls API over HTTP  │         │  - JWT auth             │
└─────────────────────────┘         └─────────────────────────┘
```

## Setup

1. **Configure API URL**
   ```bash
   cp .env.example .env
   # Edit .env and set VITE_API_BASE_URL to your Notifiq backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000 (must be running)

## How It Works

### 1. Authentication
```typescript
// Login to get JWT token
const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const data = await response.json()
const token = data.access_token
```

### 2. API Calls with Auth
```typescript
// Use token in Authorization header
const response = await fetch(`${API_BASE_URL}/api/events/my`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
```

### 3. CORS Configuration
The backend already has CORS configured in `backend/src/api/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative port
        # Add your production domains here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Features Demonstrated

- ✅ **JWT Authentication** — Login and store token
- ✅ **API Calls** — Fetch events from Notifiq API
- ✅ **CORS Handling** — Cross-origin requests work
- ✅ **Error Handling** — Display API errors
- ✅ **Token Persistence** — Store token in localStorage

## Building for Production

```bash
npm run build
```

The built files in `dist/` can be:
- Served by any static web server (nginx, Apache, etc.)
- Deployed to Netlify, Vercel, Cloudflare Pages, etc.
- Hosted separately from the Notifiq backend

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Notifiq backend URL | `http://localhost:8000` |

## Use Cases

This pattern is ideal for:

- **External integrations** — Third-party apps calling your Notifiq instance
- **Mobile apps** — React Native, Flutter apps calling the API
- **Separate deployments** — Frontend and backend on different servers
- **Multi-tenant** — One backend, multiple frontend deployments
- **Development** — Faster iteration without rebuilding/mounting

## API Endpoints Used

- `POST /api/v1/auth/login` — Authenticate and get JWT token
- `GET /api/v1/users/me/events` — Fetch user's events

See the [API documentation](http://localhost:8000/docs) for all available endpoints.

## Next Steps

To build your own standalone frontend:

1. **Copy this example** as a starting point
2. **Add more API calls** — channels, subscriptions, organizations, etc.
3. **Implement your UI** — Use any framework (React, Vue, Svelte, etc.)
4. **Deploy independently** — Host anywhere that serves static files
5. **Configure CORS** — Add your production domain to backend CORS config

## Comparison with Mounted Frontends

The other frontends in this repo (IT Alerts, Mind, etc.) are **mounted** to the FastAPI backend:
- Built with `npm run build`
- Mounted in `backend/src/api/main.py` with `mount_spa()`
- Served at paths like `/it-alerts`, `/mindful`, etc.
- Same origin as API (no CORS needed)

This standalone example shows the **alternative approach** for external integrations.
