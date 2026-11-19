import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function RolesPage() {
  return (
    <DocsLayout
      title="Roles & Assignments"
      description="Define custom roles for your organization and require them on events."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        The <strong className="text-white">Roles</strong> system lets organizations define custom roles, 
        assign them to members, and require specific roles for events. This is powerful for scenarios like:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">IT Incident Management</strong> — Only certified on-call engineers can be assigned to critical incidents</li>
        <li><strong className="text-white">Theater Productions</strong> — Track who's assigned as Stage Manager, Lighting Tech, etc.</li>
        <li><strong className="text-white">Volunteer Events</strong> — Need 3 parking attendants and 2 greeters for an event</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Core Components</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Component</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4 text-white">Role Definition</td>
              <td className="py-3 px-4">A role type defined by an organization (e.g., "On-Call Engineer")</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4 text-white">User Role</td>
              <td className="py-3 px-4">Assignment of a role to a user, with approval status</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4 text-white">Role Requirement</td>
              <td className="py-3 px-4">An event's need for a specific role (e.g., "Need 2 Lighting Techs")</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4 text-white">Role Assignment</td>
              <td className="py-3 px-4">A user filling a role requirement for a specific event</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How It Works</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`Organization
    │
    └── Role Definitions
            │   "On-Call Engineer"
            │   "Stage Manager"
            │
            ├── User Roles
            │       Alice → On-Call Engineer (approved)
            │       Bob → On-Call Engineer (pending)
            │
            └── Events
                    │
                    └── Role Requirements
                            │   Need 2 On-Call Engineers
                            │
                            └── Role Assignments
                                    Alice → assigned`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Role Definitions</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Role definitions are created at the organization level. Only org admins can create, update, or delete them.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`POST /api/v1/roles/definitions
{
  "organization_id": 1,
  "name": "On-Call Engineer",
  "attributes": {
    "certification_required": true,
    "max_hours_per_week": 40
  }
}`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">User Role Status</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Status</th>
              <th className="text-left py-3 px-4 text-slate-300">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">pending</code></td>
              <td className="py-3 px-4">User requested the role, awaiting admin approval</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">approved</code></td>
              <td className="py-3 px-4">User has the role and can be assigned to events</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">denied</code></td>
              <td className="py-3 px-4">Admin denied the role request</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Two Ways to Get a Role</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Admin Assignment</h3>
          <p className="text-slate-400 text-sm mb-3">Admins directly assign with approved status:</p>
          <div className="font-mono text-xs text-slate-300 bg-[#0a0f1a] p-2 rounded">
            POST /api/v1/roles/user-roles<br/>
            {`{ "user_id": 42, "role_id": 1, "status": "approved" }`}
          </div>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">User Request</h3>
          <p className="text-slate-400 text-sm mb-3">Users request roles (creates pending status):</p>
          <div className="font-mono text-xs text-slate-300 bg-[#0a0f1a] p-2 rounded">
            POST /api/v1/roles/my-roles/request<br/>
            {`{ "role_id": 1, "organization_id": 1 }`}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Role Requirements on Events</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Events can specify what roles they need. For example, a tech rehearsal might need:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-1 mb-4">
        <li>1 Stage Manager</li>
        <li>2 Lighting Technicians</li>
        <li>1 Sound Engineer</li>
      </ul>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`POST /api/v1/events
{
  "name": "Tech Rehearsal",
  "start_date": "2025-01-20T14:00:00Z",
  "organization_id": 1,
  "role_requirements": [
    { "role_id": 1, "needed_count": 1 },
    { "role_id": 2, "needed_count": 2 },
    { "role_id": 3, "needed_count": 1 }
  ]
}`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Role Assignments</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When a user is assigned to a role requirement:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Validation</strong> — Checks if user has the required role (if enforcement is enabled)</li>
        <li><strong className="text-white">Assignment created</strong> — User is linked to the role requirement</li>
        <li><strong className="text-white">Auto-subscribe</strong> — User is automatically subscribed to the event</li>
        <li><strong className="text-white">Notification</strong> — User receives a notification about the assignment</li>
        <li><strong className="text-white">Count updated</strong> — <code className="text-[#00d4ff]">filled_count</code> is incremented</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Enforcement Modes</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Organizations can choose whether to enforce role requirements:
      </p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Strict Enforcement</h3>
          <p className="text-slate-400 text-sm mb-2">For IT/Incident Management:</p>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Users <strong className="text-white">must</strong> have approved role</li>
            <li>• Prevents unqualified assignments</li>
            <li>• Ideal for on-call rotations</li>
          </ul>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Open Signup</h3>
          <p className="text-slate-400 text-sm mb-2">For Volunteer/Theater:</p>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Anyone can self-assign</li>
            <li>• Great for volunteer signups</li>
            <li>• Users still get notified</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example: IT Incident Response</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-3 mb-6">
        <li>
          <strong className="text-white">Define roles:</strong> "On-Call Engineer", "Senior Engineer", "Incident Commander"
        </li>
        <li>
          <strong className="text-white">Assign to team:</strong> Alice → On-Call + Senior, Bob → On-Call, Carol → Commander
        </li>
        <li>
          <strong className="text-white">Create incident:</strong> Database Outage needs 2 On-Call + 1 Commander
        </li>
        <li>
          <strong className="text-white">Assign responders:</strong> Only users with approved roles can be assigned
        </li>
        <li>
          <strong className="text-white">Everyone notified:</strong> Assigned users auto-subscribed and receive updates
        </li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example: Volunteer Signup</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-3 mb-6">
        <li>
          <strong className="text-white">Define roles:</strong> "Usher", "Concessions", "Parking Attendant"
        </li>
        <li>
          <strong className="text-white">Create event:</strong> Opening Night needs 6 Ushers, 4 Concessions, 3 Parking
        </li>
        <li>
          <strong className="text-white">Volunteers self-assign:</strong> Any member can sign up for open slots
        </li>
        <li>
          <strong className="text-white">Track progress:</strong> Dashboard shows Ushers: 2/6, Parking: 1/3, etc.
        </li>
        <li>
          <strong className="text-white">Reminders sent:</strong> All assigned volunteers get reminders before event
        </li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">API Endpoints</h2>
      <div className="space-y-4 mb-6">
        <div>
          <h3 className="text-white font-medium mb-2">Role Definitions</h3>
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 font-mono text-xs text-slate-300">
            POST /api/v1/roles/definitions — Create role<br/>
            GET /api/v1/roles/definitions?organization_id=1 — List roles<br/>
            PUT /api/v1/roles/definitions/:id — Update role<br/>
            DELETE /api/v1/roles/definitions/:id — Delete role
          </div>
        </div>
        <div>
          <h3 className="text-white font-medium mb-2">User Roles</h3>
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 font-mono text-xs text-slate-300">
            POST /api/v1/roles/user-roles — Assign role (admin)<br/>
            POST /api/v1/roles/my-roles/request — Request role (user)<br/>
            POST /api/v1/roles/user-roles/:id/approve — Approve request<br/>
            POST /api/v1/roles/user-roles/:id/deny — Deny request
          </div>
        </div>
        <div>
          <h3 className="text-white font-medium mb-2">Role Requirements & Assignments</h3>
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 font-mono text-xs text-slate-300">
            POST /api/v1/roles/requirements — Add requirement to event<br/>
            GET /api/v1/roles/requirements?event_id=42 — List requirements<br/>
            POST /api/v1/roles/assignments — Assign user to requirement<br/>
            GET /api/v1/roles/assignments?event_id=42 — List assignments
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/events" className="text-[#00d4ff] hover:underline">
            Events
          </Link>
          <span className="text-slate-400"> — Creating events with role requirements</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Setting up enforcement mode</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — How auto-subscribe works with assignments</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
