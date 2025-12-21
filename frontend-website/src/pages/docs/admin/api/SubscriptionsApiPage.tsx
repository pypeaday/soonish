import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function SubscriptionsApiPage() {
  return (
    <DocsLayout
      title="Subscriptions API"
      description="API endpoints for subscribing to events and managing reminders."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Subscriptions connect users to events. When subscribed, users receive notifications 
        for event updates, cancellations, and personal reminders at their chosen times.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Endpoints</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">GET /api/v1/subscriptions</h3>
      <p className="text-slate-300 mb-4">List all subscriptions for the current user.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
GET /api/v1/subscriptions
Authorization: Bearer <token>

# Response 200
[
  {
    "id": 1,
    "event_id": 42,
    "user_id": 1,
    "is_auto_subscribed": false,
    "reminders": [
      {"offset_seconds": 3600},
      {"offset_seconds": 900}
    ],
    "selectors": [
      {"channel_id": 1},
      {"tag": "work"}
    ]
  }
]`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/subscriptions</h3>
      <p className="text-slate-300 mb-4">Subscribe to an event with custom reminder times and channel routing.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/subscriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_id": 42,
  "reminder_offsets": [3600, 900],
  "selectors": [
    {"channel_id": 1},
    {"tag": "work"}
  ]
}

# Response 201
{
  "id": 1,
  "event_id": 42,
  "user_id": 1,
  "is_auto_subscribed": false
}`}</pre>
      </div>

      <h4 className="text-lg font-medium text-white mt-4 mb-2">Request Fields</h4>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Field</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Required</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>event_id</code></td>
              <td className="py-2 px-3">int</td>
              <td className="py-2 px-3">Yes</td>
              <td className="py-2 px-3">Event to subscribe to</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>reminder_offsets</code></td>
              <td className="py-2 px-3">int[]</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Seconds before event to send reminders</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>selectors</code></td>
              <td className="py-2 px-3">object[]</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Channel routing rules</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="text-lg font-medium text-white mt-4 mb-2">Reminder Offsets</h4>
      <p className="text-slate-300 mb-4">
        Common reminder offset values (in seconds):
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Value</th>
              <th className="text-left py-2 px-3 text-slate-300">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>900</code></td>
              <td className="py-2 px-3">15 minutes before</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>3600</code></td>
              <td className="py-2 px-3">1 hour before</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>86400</code></td>
              <td className="py-2 px-3">1 day before</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>604800</code></td>
              <td className="py-2 px-3">1 week before</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="text-lg font-medium text-white mt-4 mb-2">Selectors</h4>
      <p className="text-slate-300 mb-4">
        Selectors determine which channels receive notifications. You can specify:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><code className="text-[#00d4ff]">{"{ channel_id: 1 }"}</code> — Specific channel by ID</li>
        <li><code className="text-[#00d4ff]">{"{ tag: \"work\" }"}</code> — All channels with matching tag</li>
      </ul>
      <p className="text-slate-400 text-sm">
        If no selectors are provided, notifications go to all user channels.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">DELETE /api/v1/subscriptions/{'{id}'}</h3>
      <p className="text-slate-300 mb-4">Unsubscribe from an event.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
DELETE /api/v1/subscriptions/1
Authorization: Bearer <token>

# Response 204 (No Content)`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Auto-Subscription</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Users can be automatically subscribed to events based on tag matching:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>User creates a channel with tag <code className="text-[#00d4ff]">"infrastructure"</code></li>
        <li>Event is created with tags <code className="text-[#00d4ff]">["infrastructure", "urgent"]</code></li>
        <li>User is auto-subscribed with <code className="text-[#00d4ff]">is_auto_subscribed: true</code></li>
        <li>Notifications route to the matching channel</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Notification Flow</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`Event Created/Updated/Cancelled
         │
         ▼
Find all subscriptions for event
         │
         ▼
For each subscription:
  ├─► Get selectors (channel_id or tag)
  ├─► Resolve to actual channels
  └─► Send notification via Apprise`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions Guide
          </Link>
          <span className="text-slate-400"> — User-facing documentation</span>
        </li>
        <li>
          <Link to="/guide/admin/temporal" className="text-[#00d4ff] hover:underline">
            Temporal Workflows
          </Link>
          <span className="text-slate-400"> — How reminders are scheduled</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
