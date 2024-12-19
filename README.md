# Soonish

A modern countdown dashboard for tracking your upcoming events.

## Overview
Soonish is a web application that helps you create and manage countdowns to your important events. Built with FastAPI and TailwindCSS, it provides a clean, responsive interface for tracking dates that matter to you.

## Features
- [x] **Event Management**
  - Create, edit, and delete events
  - Set event dates with optional time (defaults to noon)
  - View countdown timers for all events
- [ ] **Authentication** (Coming Soon)
  - Sign in with Google or GitHub
  - Secure event access
- [ ] **Event Sharing** (Coming Soon)
  - Generate public event links
  - Collaborative event dashboards
- [ ] **Notifications** (Coming Soon)
  - Get reminders for upcoming events
  - Email notifications
  - Recurring event support

## Tech Stack
### Backend
- **Framework**: FastAPI
- **Database**: SQLite with async support
- **ORM**: SQLAlchemy

### Frontend
- **Styling**: TailwindCSS
- **Interactivity**: Vanilla JavaScript
- **UI Components**: Custom responsive design

### Development
- **Container**: Docker
- **Environment**: Python 3.12
- **Package Manager**: uv

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Python 3.12+ (for local development)
- uv (for dependency management)

### Running with Docker
1. Clone the repository
2. Start the application:
   ```bash
   docker compose up
   ```
3. Visit http://localhost:8000

### Local Development
1. Create a virtual environment:
   ```bash
   uv venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   uv pip install -r requirements.txt
   ```
3. Run the application:
   ```bash
   python soonish/main.py
   ```

## Project Structure
```
soonish/
├── database.py    # Database configuration
├── main.py        # Application entry point
├── models.py      # SQLAlchemy models
├── schemas.py     # Pydantic schemas
├── config.py      # Configuration management
├── routers/       # API routes
└── templates/     # HTML templates
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.
