import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function OrganizationsPage() {
  return (
    <DocsLayout
      title="Organizations"
      description="Team management, shared resources, and collaborative features."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">Organizations</strong> enable team-based features—shared events, 
        collaborative management, and unified billing.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">What is an Organization?</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        An organization represents a group of users working together:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">IT Team</strong> — Incident responders</li>
        <li><strong className="text-white">Church</strong> — Volunteer coordinators and members</li>
        <li><strong className="text-white">Company</strong> — Employees receiving announcements</li>
        <li><strong className="text-white">Theater Group</strong> — Production staff and volunteers</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Membership Roles</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Role</th>
              <th className="text-left py-3 px-4 text-slate-300">Permissions</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">owner</code></td>
              <td className="py-3 px-4">Full control, billing, delete org</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">admin</code></td>
              <td className="py-3 px-4">Manage members, create events, manage channels</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">member</code></td>
              <td className="py-3 px-4">View events, subscribe, use org channels</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Organization Events</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Events can belong to organizations:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Organization events</strong> are visible to all members</li>
        <li><strong className="text-white">Private org events</strong> require explicit subscription</li>
        <li><strong className="text-white">Public org events</strong> are discoverable by anyone</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Organization Channels</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Shared notification channels for the team:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Team Slack channel
{
  "name": "Team Slack",
  "tag": "team",
  "organization_id": 123,
  "apprise_url": "slack://..."
}`}
      </div>
      <p className="text-slate-300 leading-relaxed">
        Members can select org channels when subscribing to events.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Use Cases</h2>
      
      <h3 className="text-xl font-medium text-white mt-6 mb-3">IT Team (Incident Management)</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Events = Incidents</li>
        <li>Members auto-subscribed based on role</li>
        <li>Shared on-call channels</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Church (Volunteer Coordination)</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Events = Volunteer opportunities</li>
        <li>Members self-subscribe</li>
        <li>Org channels for announcements</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Company (Announcements)</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Events = All-hands, announcements</li>
        <li>All employees auto-subscribed</li>
        <li>Org-wide notification channels</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/apps/it-alerts" className="text-[#00d4ff] hover:underline">
            IT Team Alerts
          </Link>
          <span className="text-slate-400"> — Team-based incident management</span>
        </li>
        <li>
          <Link to="/guide/apps/volunteer" className="text-[#00d4ff] hover:underline">
            Volunteer Coordinator
          </Link>
          <span className="text-slate-400"> — Organization-based volunteer management</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
