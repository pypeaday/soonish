# Soonish

# Countdown Dashboard
# Countdown Dashboard

## Overview
Countdown Dashboard is a SaaS platform designed to help users create and manage a personalized dashboard of countdowns to their most important events. With features like OAuth-based authentication, event sharing, and reminders, it offers an intuitive way to track upcoming occasions and share them with friends, family, or coworkers.

## Features
- **Event Management**: Create, update, and delete countdowns to events.
- **Authentication**: Secure sign-in with Google and GitHub OAuth.
- **Event Sharing**: Share events via public links or collaborate with others.
- **Reminders and Notifications**: Set reminders and recurring events to stay updated.
- **Responsive UI**: A lightweight and responsive frontend built with HTMX and TailwindCSS.

## Tech Stack
### Backend
- **Framework**: FastAPI
- **Database**: SQLite (initially, with the potential to migrate to PostgreSQL for scaling)
- **Hosting**: Fly.io

### Frontend
- **Framework**: HTMX for dynamic interactions
- **CSS**: TailwindCSS served via CDN

## Project Structure
```
project-root
├── backend
│   ├── main.py
│   ├── models/
│   ├── routes/
│   ├── schemas/
│   └── requirements.txt
├── frontend
│   ├── templates/
│   ├── static/
│   └── README.md
└── README.md
```

## Installation
### Backend Setup
1. Clone the repository.
2. Setup a venv
   ```bash
   uv venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   uv pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup
1. Add TailwindCSS via CDN in your HTML files:
   ```html
   <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
   ```
2. Include HTMX in your HTML files:
   ```html
   <script src="https://unpkg.com/htmx.org"></script>
   ```
3. Create templates and static files under the `frontend/templates` and `frontend/static` directories.

## Deployment
- Backend and frontend will be deployed on Fly.io with containerized environments.

## Contributing
1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message here"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Submit a pull request.

## License
This project is not distributed

## Contact
For questions or feedback, reach out to Nic Payne | soonish@pype.dev
