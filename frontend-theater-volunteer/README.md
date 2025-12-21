# Stage Manager - Theater Volunteer Coordinator

A frontend app for coordinating theater production volunteers using the Notifiq auto-subscription system.

## Key Features

### For Parents/Volunteers
- **Auto-Notification Setup**: Create notification channels with tags like `autosub:setup`, `autosub:rehearsal`, `autosub:all`
- **Automatic Subscriptions**: When events are created/updated with matching tags, you're automatically subscribed
- **Multiple Delivery Methods**: SMS, Email, Discord, Slack, ntfy push notifications
- **My Schedule**: View all events you've signed up for

### For Organizers
- **Event Management**: Create events with tags to target specific volunteer groups
- **Tag-Based Notifications**: Add/remove tags to control who gets notified
- **Real-time Updates**: When you update event tags, subscriptions are automatically reconciled

## How Auto-Subscriptions Work

1. **Parents set up channels** with tags like:
   - `autosub:all` - Get notified about everything
   - `autosub:setup` - Setup crew calls
   - `autosub:rehearsal` - Rehearsal notifications
   - `autosub:costumes` - Costume-related events
   - `autosub:emma` - Events tagged with their child's name

2. **Organizers create events** with relevant tags:
   - A "Tech Rehearsal" might have tags: `rehearsal`, `lighting`, `sound`
   - A "Set Build Day" might have tags: `setup`, `all`

3. **System automatically**:
   - Subscribes parents whose channel tags match event tags
   - Sends notifications when events are created/updated
   - Removes subscriptions when tags no longer match

## Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173/theater-volunteer/` during development.

## Building for Production

```bash
npm run build
```

Built files go to `dist/` and are served by FastAPI at `/theater-volunteer/`.

## Tech Stack

- React 19 + TypeScript
- Vite
- TailwindCSS
- React Query
- React Router
- Lucide Icons
