import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function EventsApiPage() {
  return (
    <DocsLayout
      title="Events API"
      description="API endpoints for creating and managing events."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Events are the core of Notifiq. When you create an event, a Temporal workflow 
        is started to manage its lifecycle and send notifications.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Endpoints</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">GET /api/v1/events</h3>
      <p className="text-slate-300 mb-4">List events for the current user.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
GET /api/v1/events?upcoming=true&source=notifiq-cli&limit=20
Authorization: Bearer <token>

# Response 200
[
  {
    "id": 1,
    "name": "Team Meeting",
    "description": "Weekly sync",
    "start_date": "2024-01-15T10:00:00Z",
    "end_date": "2024-01-15T11:00:00Z",
    "tags": ["meeting", "team"],
    "source": "notifiq-cli",
    "is_public": false,
    "organizer_user_id": 1,
    "organization_id": null
  }
]`}</pre>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        <strong>Query params:</strong> <code>upcoming</code>, <code>source</code>, <code>limit</code>, <code>organization_id</code>
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/events</h3>
      <p className="text-slate-300 mb-4">Create a new event. Starts a Temporal workflow automatically.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Team Meeting",
  "description": "Weekly sync",
  "start_date": "2024-01-15T10:00:00Z",
  "end_date": "2024-01-15T11:00:00Z",
  "tags": ["meeting", "team"],
  "source": "notifiq-cli",
  "is_public": false,
  "notify_on_completion": false
}

# Response 201
{
  "id": 1,
  "name": "Team Meeting",
  "temporal_workflow_id": "notifiq-cli/1-team-meeting",
  ...
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
              <td className="py-2 px-3"><code>name</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Yes</td>
              <td className="py-2 px-3">Event name</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>start_date</code></td>
              <td className="py-2 px-3">ISO datetime</td>
              <td className="py-2 px-3">Yes</td>
              <td className="py-2 px-3">When event starts (UTC)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>end_date</code></td>
              <td className="py-2 px-3">ISO datetime</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">When event ends</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>description</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Event description</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>tags</code></td>
              <td className="py-2 px-3">string[]</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Tags for auto-subscription</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>source</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">App identifier (default: notifiq-web)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>content</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Custom content (max 500 chars)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>notify_on_completion</code></td>
              <td className="py-2 px-3">bool</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Send notification when event ends</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">GET /api/v1/events/{'{id}'}</h3>
      <p className="text-slate-300 mb-4">Get a specific event by ID.</p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">PATCH /api/v1/events/{'{id}'}</h3>
      <p className="text-slate-300 mb-4">Update an event. Sends update signal to the workflow.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
PATCH /api/v1/events/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Meeting",
  "start_date": "2024-01-15T14:00:00Z"
}

# Response 200
{
  "id": 1,
  "name": "Updated Meeting",
  ...
}`}</pre>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        If <code>start_date</code> changes, reminder schedules are automatically recreated.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">DELETE /api/v1/events/{'{id}'}</h3>
      <p className="text-slate-300 mb-4">Cancel and delete an event. Sends cancel signal to workflow.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
DELETE /api/v1/events/1
Authorization: Bearer <token>

# Response 204 (No Content)`}</pre>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        All subscribers are notified of the cancellation.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tags & Auto-Subscription</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When an event is created with tags, users who have channels with matching tags 
        are automatically subscribed. This enables "set and forget" notification routing.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`# Event with tags
{
  "name": "Server Alert",
  "tags": ["infrastructure", "urgent"]
}

# User's channel with matching tag
{
  "name": "PagerDuty",
  "tag": "urgent"
}

# → User is auto-subscribed to the event`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/api/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions API
          </Link>
          <span className="text-slate-400"> — Subscribe to events</span>
        </li>
        <li>
          <Link to="/guide/admin/temporal" className="text-[#00d4ff] hover:underline">
            Temporal Workflows
          </Link>
          <span className="text-slate-400"> — Event workflow details</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
