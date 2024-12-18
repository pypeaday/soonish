# Overview

Soonish is a simple web application service that allows users to create and manage countdown timers to exciting events. The service is built using FastAPI and TailwindCSS, and it uses a SQLite database to store the timers.

## Features

### 1. Event Management
- **Description**: Users can create, edit, and delete events in their countdown dashboard.
- **Use Cases**:
  - Track upcoming birthdays, anniversaries, or holidays.
  - Organize project deadlines or milestones.
- **Implementation Notes**:
  - CRUD API endpoints for event data.
  - Events are stored with metadata such as title, description, target date, and optionally, a recurring frequency.

### 2. Authentication
- **Description**: OAuth-based authentication to ensure secure user access.
- **Use Cases**:
  - Allow users to log in with Google or GitHub credentials.
  - Ensure events are tied to specific user accounts for privacy.
- **Implementation Notes**:
  - OAuth integration via FastAPI.
  - Secure token management for session handling.

### 3. Event Sharing
- **Description**: Enables users to share their events with others.
- **Use Cases**:
  - Public event links for countdowns to concerts or webinars.
  - Collaborative event dashboards for team projects or family planning.
- **Implementation Notes**:
  - Generate unique URLs for public event views.
  - Permissions management for shared access.

### 4. Reminders and Notifications
- **Description**: Allows users to set reminders and receive notifications for their events.
- **Use Cases**:
  - Get notified a day before a birthday or project deadline.
  - Recurring reminders for weekly or monthly events.
- **Implementation Notes**:
  - Integration with a task scheduler for notification logic.
  - API support for sending email or in-app reminders.

### 5. Responsive UI
- **Description**: A lightweight and intuitive user interface built with HTMX and TailwindCSS.
- **Use Cases**:
  - Easy-to-navigate dashboards accessible across devices.
  - Dynamic page updates without full-page reloads.
- **Implementation Notes**:
  - HTMX for interactive elements.
  - TailwindCSS via CDN for responsive styling.

---

## Use Cases

### Personal Event Tracking
- **Scenario**: A user wants to track personal milestones like birthdays, anniversaries, or travel plans.
- **Solution**: Create an account, add events, and optionally set reminders.

### Team Collaboration
- **Scenario**: A project manager wants to share milestones with the team.
- **Solution**: Create events, generate public links, and share with team members.

### Public Countdown Sharing
- **Scenario**: An organizer wants to share a countdown to an online webinar.
- **Solution**: Create a public event and distribute the generated URL.

### Recurring Reminders
- **Scenario**: A user wants to get weekly reminders for a recurring task.
- **Solution**: Set up a recurring event with notification preferences.

---

## Technical Overview

### Backend
- **Framework**: FastAPI
- **Database**: SQLite for lightweight storage (scalable to PostgreSQL as needed)
- **Endpoints**:
  - `/events`: Manage event CRUD operations.
  - `/auth`: Handle user authentication and OAuth.

### Frontend
- **Framework**: HTMX for dynamic interactions.
- **Styling**: TailwindCSS from CDN for responsive design.

### Hosting
- **Platform**: Fly.io for deploying both backend and frontend components.

---

This document should serve as a blueprint for building and understanding the Soonish platform. For additional details, refer to the main project README or the design specifications.

