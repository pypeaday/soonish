import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function SubscriptionsPage() {
  return (
    <DocsLayout
      title="Subscriptions"
      description="Connect users to events with personalized notification preferences."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        A <strong className="text-white">Subscription</strong> links a user to an event with their 
        notification preferences—which channels to use and when to receive reminders.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How Subscriptions Work</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When you subscribe to an event, you specify:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Selectors</strong> — Which channels receive notifications</li>
        <li><strong className="text-white">Reminder offsets</strong> — When to receive reminders before the event</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Selectors</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Selectors determine which of your channels receive notifications:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// By specific channel ID
{ "channel_id": 123 }

// By tag (matches all your channels with that tag)
{ "tag": "urgent" }

// Multiple selectors
[
  { "tag": "work" },
  { "channel_id": 456 }
]`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Reminder Offsets</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Customize when you receive reminders (in seconds before the event):
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Remind me 1 day, 1 hour, and 15 minutes before
reminder_offsets: [86400, 3600, 900]

// Common values:
// 604800 = 1 week
// 86400  = 1 day
// 3600   = 1 hour
// 1800   = 30 minutes
// 900    = 15 minutes`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Auto-Subscription</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        You can be automatically subscribed to events using channel tags:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Create a channel with an <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:</code> tag</li>
        <li>When an event is created with a matching tag, you're subscribed automatically</li>
        <li>Notifications go to that channel</li>
      </ol>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Your channel
{ "name": "Incident Alerts", "tag": "autosub:incident" }

// Event created with matching tag
{ "name": "Database Outage", "tags": ["incident", "critical"] }

// → You're automatically subscribed!`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">What You Get Notified About</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Once subscribed, you receive notifications for:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Event updates</strong> — Time, location, or details changed</li>
        <li><strong className="text-white">Cancellations</strong> — Event was cancelled</li>
        <li><strong className="text-white">Reminders</strong> — At your chosen times before the event</li>
        <li><strong className="text-white">Announcements</strong> — Messages from the organizer</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Team-based subscriptions</span>
        </li>
        <li>
          <Link to="/apps" className="text-[#00d4ff] hover:underline">
            Browse Apps
          </Link>
          <span className="text-slate-400"> — See subscriptions in action</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
