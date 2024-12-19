# Soonish - Event Countdown Dashboard

A modern event countdown dashboard built with FastAPI, TailwindCSS, and HTMX.

## Features

### Core Features ✓
- Event creation, editing, and deletion
- Recurring events support
- Event filtering and sorting
- Search functionality
- Dark theme support
- Modal dialogs for event details
- Enhanced event cards with visual feedback

### Authentication ✓
- OAuth authentication system
- GitHub OAuth integration
- Google OAuth integration
- User profiles and settings
- Secure session management
- HTTPOnly cookie handling

### Search and Organization
- Real-time search by title and description
- Sort by date or title
- Filter by event status (upcoming, past, today, etc.)
- Mobile-friendly interface
- Instant updates with Alpine.js

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
- Dark mode with system preference support
- Responsive design
- Client-side countdown calculation
- Modal dialogs and transitions

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
- Notification system with browser support
- Event categories with color coding
- Mobile-optimized interface
- List/grid view toggle
- Drag-and-drop reordering
