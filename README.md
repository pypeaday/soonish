# Soonish - Event Countdown Dashboard

A modern event countdown dashboard built with FastAPI, TailwindCSS, and HTMX.

## Features

### Event Management
- Create, edit, and delete events
- Set target dates and times
- Add descriptions and recurrence patterns
- View countdown timers
- Responsive dashboard layout

### Search and Organization
- Real-time search by title and description
- Sort by date or title
- Filter by event status (upcoming, past, today, etc.)
- Mobile-friendly interface
- Instant updates with Alpine.js

### Authentication
- OAuth integration with GitHub and Google
- User accounts and profiles
- Protected event access
- Secure session management with JWT
- Cookie-based authentication

## Tech Stack

### Backend
- FastAPI for API and server-side rendering
- SQLite with async support via SQLAlchemy
- JWT for session management
- OAuth for authentication
- HTMX for dynamic updates

### Frontend
- TailwindCSS for styling
- Alpine.js for reactivity
- Responsive design
- Client-side countdown calculation

### Development
- Docker development environment
- Hot-reload for code changes
- Environment variable configuration

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and configure:
   - `SECRET_KEY`: For JWT encryption
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: For GitHub OAuth
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: For Google OAuth
3. Run with Docker Compose:
   ```bash
   docker-compose up
   ```
4. Visit http://localhost:8000

## Coming Soon
- Calendar view with week/month layouts
- Event sharing with public links
- Email notifications
- Drag-and-drop date selection
