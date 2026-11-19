# Auth Gateway

A lightweight authentication gateway for Notifiq that handles:

1. **Login/Register** - Single auth page with toggle
2. **App Picker** - After auth, users choose which app to use
3. **Preferred App** - Remembers user's last choice for auto-redirect

## Routes

- `/start` - Entry point (redirects to login if not authenticated)
- `/start/login` - Login/Register page

## Flow

```
Landing Page "Get Started"
        ↓
    /start/login
        ↓
   Login or Register
        ↓
    App Picker
        ↓
  Choose an app (e.g., /adhd-reminders)
        ↓
  Preferred app saved
        ↓
  Next visit → auto-redirect to preferred app
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/` which is served by the FastAPI backend at `/start`.
