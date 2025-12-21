import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function DatabasePage() {
  return (
    <DocsLayout
      title="Database Schema"
      description="Data model reference for Notifiq."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq uses SQLAlchemy with async support. SQLite for development, PostgreSQL for production.
        All sensitive data (channel credentials) is encrypted at rest using Fernet.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Core Tables</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">users</h3>
      <p className="text-slate-300 mb-4">User accounts with authentication and billing info.</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Column</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>id</code></td>
              <td className="py-2 px-3">int (PK)</td>
              <td className="py-2 px-3">Primary key</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>email</code></td>
              <td className="py-2 px-3">string (unique)</td>
              <td className="py-2 px-3">User email address</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>name</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Display name</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>password_hash</code></td>
              <td className="py-2 px-3">string (nullable)</td>
              <td className="py-2 px-3">Bcrypt hash (null in dev mode)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>tier</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">free, pro, unlimited</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>stripe_customer_id</code></td>
              <td className="py-2 px-3">string (nullable)</td>
              <td className="py-2 px-3">Stripe customer ID</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">events</h3>
      <p className="text-slate-300 mb-4">Events that trigger notifications.</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Column</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>id</code></td>
              <td className="py-2 px-3">int (PK)</td>
              <td className="py-2 px-3">Primary key</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>name</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Event name</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>description</code></td>
              <td className="py-2 px-3">text (nullable)</td>
              <td className="py-2 px-3">Event description</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>start_date</code></td>
              <td className="py-2 px-3">datetime (UTC)</td>
              <td className="py-2 px-3">When event starts</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>end_date</code></td>
              <td className="py-2 px-3">datetime (nullable)</td>
              <td className="py-2 px-3">When event ends</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>tags</code></td>
              <td className="py-2 px-3">text (JSON)</td>
              <td className="py-2 px-3">Comma-separated tags for auto-subscription</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>source</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">App that created event (e.g., notifiq-cli)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>temporal_workflow_id</code></td>
              <td className="py-2 px-3">string (unique)</td>
              <td className="py-2 px-3">Temporal workflow ID</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>organizer_user_id</code></td>
              <td className="py-2 px-3">int (FK)</td>
              <td className="py-2 px-3">User who created event</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>organization_id</code></td>
              <td className="py-2 px-3">int (FK, nullable)</td>
              <td className="py-2 px-3">Organization if org event</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>series_id</code></td>
              <td className="py-2 px-3">string (nullable)</td>
              <td className="py-2 px-3">Recurring series identifier</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>recurrence_rule</code></td>
              <td className="py-2 px-3">text (nullable)</td>
              <td className="py-2 px-3">RRULE for recurring events</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">channels</h3>
      <p className="text-slate-300 mb-4">Notification delivery endpoints (encrypted credentials).</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Column</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>id</code></td>
              <td className="py-2 px-3">int (PK)</td>
              <td className="py-2 px-3">Primary key</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>name</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Display name</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>apprise_url_encrypted</code></td>
              <td className="py-2 px-3">bytes</td>
              <td className="py-2 px-3">Fernet-encrypted Apprise URL</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>tag</code></td>
              <td className="py-2 px-3">string</td>
              <td className="py-2 px-3">Tag for routing (auto-lowercased)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>channel_type</code></td>
              <td className="py-2 px-3">string (nullable)</td>
              <td className="py-2 px-3">gotify, ntfy, email, discord, etc.</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>user_id</code></td>
              <td className="py-2 px-3">int (FK, nullable)</td>
              <td className="py-2 px-3">Owner user</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>organization_id</code></td>
              <td className="py-2 px-3">int (FK, nullable)</td>
              <td className="py-2 px-3">Owner organization</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">subscriptions</h3>
      <p className="text-slate-300 mb-4">User subscriptions to events.</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Column</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>id</code></td>
              <td className="py-2 px-3">int (PK)</td>
              <td className="py-2 px-3">Primary key</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>event_id</code></td>
              <td className="py-2 px-3">int (FK)</td>
              <td className="py-2 px-3">Event subscribed to</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>user_id</code></td>
              <td className="py-2 px-3">int (FK)</td>
              <td className="py-2 px-3">Subscriber</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>is_auto_subscribed</code></td>
              <td className="py-2 px-3">bool</td>
              <td className="py-2 px-3">Created via tag matching</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">subscription_reminders</h3>
      <p className="text-slate-300 mb-4">Personal reminder preferences per subscription.</p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-2 px-3 text-slate-300">Column</th>
              <th className="text-left py-2 px-3 text-slate-300">Type</th>
              <th className="text-left py-2 px-3 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400 text-xs">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>subscription_id</code></td>
              <td className="py-2 px-3">int (FK)</td>
              <td className="py-2 px-3">Parent subscription</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-2 px-3"><code>offset_seconds</code></td>
              <td className="py-2 px-3">int</td>
              <td className="py-2 px-3">Seconds before event to remind</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Organization Tables</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><code className="text-[#00d4ff]">organizations</code> — Team/org accounts</li>
        <li><code className="text-[#00d4ff]">organization_memberships</code> — User-org relationships</li>
        <li><code className="text-[#00d4ff]">organization_invitations</code> — Pending invites</li>
        <li><code className="text-[#00d4ff]">role_definitions</code> — Custom roles per org</li>
        <li><code className="text-[#00d4ff]">user_roles</code> — Role assignments</li>
        <li><code className="text-[#00d4ff]">role_requirements</code> — Event staffing needs</li>
        <li><code className="text-[#00d4ff]">role_assignments</code> — Who's filling roles</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Security</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Passwords</strong> — Bcrypt hashed</li>
        <li><strong className="text-white">Channel URLs</strong> — Fernet encrypted at rest</li>
        <li><strong className="text-white">API Tokens</strong> — SHA-256 hashed (only shown once)</li>
        <li><strong className="text-white">Invite Tokens</strong> — Cryptographically random, time-limited</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/api/events" className="text-[#00d4ff] hover:underline">
            Events API
          </Link>
          <span className="text-slate-400"> — CRUD operations for events</span>
        </li>
        <li>
          <Link to="/guide/admin/temporal" className="text-[#00d4ff] hover:underline">
            Temporal Workflows
          </Link>
          <span className="text-slate-400"> — Workflow orchestration</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
