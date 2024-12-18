# Project Implementation Plan

## Overview

This document outlines the implementation plan for this project's Minimum Viable Features (MVF).

Here's the reformatted version in markdown, structured for easy check-off:  

---

### **Phase 1: Backend Setup (FastAPI + SQLite)**  
**Goal:** Create a basic backend structure with support for CRUD operations on events.  

- [ ] **Environment Setup:**  
  - [ ] Set up a Python virtual environment using `uv`
  - [ ] Install FastAPI and Uvicorn.  
  - [ ] Create a Dockerfile and docker-compose file so that the app can be run in a container.

- [ ] **Project Structure:**  
  - [ ] Create a modular project structure (e.g., `main.py`, `routes/`, `models/`, `schemas/`).  
  - [ ] Add configuration handling for development and production environments.  

- [ ] **Database Integration:**  
  - [ ] Install SQLite and an ORM (SQLAlchemy or Tortoise ORM).  
  - [ ] Set up the database connection and initialize tables.  
  - [ ] Create a migration strategy (e.g., Alembic or Tortoise migrations).  

- [ ] **Event Model and API:**  
  - [ ] Define the `Event` database model with fields like `id`, `name`, `date`, `description`.  
  - [ ] Create Pydantic schemas for input validation and output serialization.  
  - [ ] Implement basic CRUD endpoints for events:  
    - [ ] **Create**: Add a new event.  
    - [ ] **Read**: Fetch events (single and list).  
    - [ ] **Update**: Edit an event.  
    - [ ] **Delete**: Remove an event.  

---

### **Phase 2: Frontend Setup (TailwindCSS + Basic UI)**  
**Goal:** Build a simple frontend that interacts with the backend to manage events.  

- [ ] **Environment Setup:**  
  - [ ] Setup templates and static files for FastAPI to serve up to the frontend
  - [ ] Install TailwindCSS via a CDN

- [ ] **UI Basics:**  
  - [ ] Set up a responsive base layout with a header and main content area.  
  - [ ] Add a simple page to list events with placeholders.  

- [ ] **API Integration:**  
  - [ ] Use HTMX for dynamic UI updates.
  - [ ] Display the list of events fetched from the backend.  

- [ ] **Event Management UI:**  
  - [ ] Create a form for adding new events.  
  - [ ] Add buttons and modals for editing and deleting events.  

- [ ] **Styling:**  
  - [ ] Apply TailwindCSS to style the event list, forms, and buttons.  


---

### **Phase 3: User Authentication**  
**Goal:** Enable user accounts with OAuth for sign-in and event management.  

- [ ] **Backend Authentication:**  
  - [ ] Install and configure `fastapi-users` or a similar library.  
  - [ ] Set up user models and database tables for users.  
  - [ ] Implement OAuth flows for Google and GitHub sign-in.  
  - [ ] Protect event endpoints to associate them with the logged-in user.  

- [ ] **Frontend Authentication:**  
  - [ ] Add login and sign-up forms.  
  - [ ] Configure OAuth buttons (e.g., “Sign in with Google”).  
  - [ ] Show user-specific dashboards after login.  

- [ ] **Testing and Deployment:**  
  - [ ] Test OAuth integration locally.  
  - [ ] Add environment variables for OAuth keys in Fly.io.  

---

### **Phase 4: Event Sharing**  
**Goal:** Allow users to share events with others and manage shared access.  

- [ ] **Backend:**  
  - [ ] Update the `Event` model to include sharing options (`is_public`, `shared_with`).  
  - [ ] Create APIs for generating and retrieving public links.  
  - [ ] Add endpoints for managing collaborators.  

- [ ] **Frontend:**  
  - [ ] Add a “Share” button to event cards.  
  - [ ] Generate and display public/shareable links.  
  - [ ] Build a public-facing view for shared events.  

- [ ] **Notifications:**  
  - [ ] Add a service for email notifications when events are shared.  

---

### **Phase 5: Notifications and Recurring Events**  
**Goal:** Provide reminders and support for repeating events.  

- [ ] **Backend:**  
  - [ ] Add fields for reminders (`reminder_time`) and recurrence rules (`frequency`, `interval`).  
  - [ ] Create a job scheduler for sending reminders (e.g., Celery, APScheduler).  

- [ ] **Frontend:**  
  - [ ] Update event forms to allow setting reminders and recurrence.  
  - [ ] Show recurring events on the dashboard.  

- [ ] **Testing:**  
  - [ ] Write tests to ensure reminders are sent correctly.  
  - [ ] Test recurring event logic.  

---

### **Phase 6: Scaling and Optimization**  
**Goal:** Prepare the app for growth and improve performance.  

- [ ] **Database Optimization:**  
  - [ ] Migrate to PostgreSQL if needed for scaling.  
  - [ ] Add indexes for frequently queried fields.  

- [ ] **Caching:**  
  - [ ] Implement caching for event data with Redis.  
  - [ ] Cache public event pages for faster loading.  

- [ ] **Frontend Performance:**  
  - [ ] Minimize TailwindCSS bundle size.  
  - [ ] Add lazy loading for larger datasets.  

- [ ] **Monitoring and Logs:**  
  - [ ] Add logging for errors and API usage.  
  - [ ] Set up performance monitoring (e.g., Prometheus, Grafana).  

---  
