import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function ChannelsApiPage() {
  return (
    <DocsLayout
      title="Channels API"
      description="API endpoints for managing notification channels."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Channels are notification endpoints powered by <a href="https://github.com/caronc/apprise" className="text-[#00d4ff] hover:underline">Apprise</a>. 
        Notifiq supports 70+ notification services including Discord, Slack, Telegram, email, and more.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Endpoints</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">GET /api/v1/channels</h3>
      <p className="text-slate-300 mb-4">List all channels for the current user.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
GET /api/v1/channels
Authorization: Bearer <token>

# Response 200
[
  {
    "id": 1,
    "name": "My Phone",
    "tag": "personal",
    "channel_type": "ntfy",
    "is_active": true,
    "user_id": 1,
    "organization_id": null
  }
]`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/channels</h3>
      <p className="text-slate-300 mb-4">Create a new notification channel.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Phone",
  "apprise_url": "ntfy://my-topic",
  "tag": "personal"
}

# Response 201
{
  "id": 1,
  "name": "My Phone",
  "tag": "personal",
  "channel_type": "ntfy",
  "is_active": true
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
              <td className="py-2 px-3">Display name</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>apprise_url</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Yes</td>
              <td className="py-2 px-3">Apprise URL (encrypted at rest)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>tag</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Tag for routing (auto-lowercased)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>organization_id</code></td>
              <td className="py-2 px-3">int</td>
              <td className="py-2 px-3">No</td>
              <td className="py-2 px-3">Org ID for shared channels</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/channels/message</h3>
      <p className="text-slate-300 mb-4">Send a notification directly to a channel (no event required).</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/channels/message?channel_name=My%20Phone
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Hello!",
  "body": "This is a test notification"
}

# Response 200
{
  "status": "sent",
  "channel": "My Phone"
}`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">DELETE /api/v1/channels/{'{id}'}</h3>
      <p className="text-slate-300 mb-4">Delete a channel.</p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Supported Services</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq uses Apprise URLs. Here are common examples:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Service</th>
              <th className="text-left py-2 px-3 text-slate-300">URL Format</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">ntfy</td>
              <td className="py-2 px-3"><code>ntfy://topic</code> or <code>ntfy://user:pass@host/topic</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Gotify</td>
              <td className="py-2 px-3"><code>gotify://host/token</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Discord</td>
              <td className="py-2 px-3"><code>discord://webhook_id/webhook_token</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Slack</td>
              <td className="py-2 px-3"><code>slack://token_a/token_b/token_c</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Telegram</td>
              <td className="py-2 px-3"><code>tgram://bot_token/chat_id</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Email</td>
              <td className="py-2 px-3"><code>mailto://user:pass@smtp.example.com</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3">Pushover</td>
              <td className="py-2 px-3"><code>pover://user_key@api_token</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-slate-400 text-sm">
        See <a href="https://github.com/caronc/apprise/wiki" className="text-[#00d4ff] hover:underline">Apprise documentation</a> for all supported services.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Security</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Channel URLs are <strong className="text-white">encrypted at rest</strong> using Fernet</li>
        <li>URLs are never returned in API responses</li>
        <li>Only the channel owner can send to their channels</li>
        <li>Organization channels can be used by all org members</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/api/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions API
          </Link>
          <span className="text-slate-400"> — Route notifications to channels</span>
        </li>
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels Guide
          </Link>
          <span className="text-slate-400"> — User-facing channel documentation</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
