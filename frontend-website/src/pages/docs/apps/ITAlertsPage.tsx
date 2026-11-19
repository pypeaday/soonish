import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function ITAlertsPage() {
  return (
    <DocsLayout
      title="IT Team Alerts"
      description="PagerDuty-style incident management for DevOps teams."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">IT Team Alerts</strong> is a PagerDuty-style incident management 
        application. Create incidents, notify on-call engineers, and track resolution—all powered by Notifiq.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Access:</strong> <code className="text-[#00d4ff]">/it-alerts</code> on your Notifiq instance
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Features</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🚨 Incident Dashboard</h3>
          <p className="text-slate-400 text-sm">Real-time view of all incidents with severity filtering</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">📊 Severity Levels</h3>
          <p className="text-slate-400 text-sm">Critical, Warning, and Info classifications</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">👥 Team Management</h3>
          <p className="text-slate-400 text-sm">Organize users into teams for coordinated response</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🔔 Multi-Channel Alerts</h3>
          <p className="text-slate-400 text-sm">SMS, Slack, Discord, email, push notifications</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How It Maps to Notifiq</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">IT Alerts Concept</th>
              <th className="text-left py-3 px-4 text-slate-300">Notifiq Concept</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Incidents</td>
              <td className="py-3 px-4">Events</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Notification Methods</td>
              <td className="py-3 px-4">Channels</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Teams</td>
              <td className="py-3 px-4">Organizations</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">On-Call Schedules</td>
              <td className="py-3 px-4">Recurring Events</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Creating Incidents</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-3 mb-6">
        <li>Click <strong className="text-white">"Create Incident"</strong> on the dashboard</li>
        <li>Fill in incident details:
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-400">
            <li><strong className="text-white">Title</strong> — Brief description</li>
            <li><strong className="text-white">Severity</strong> — Critical, Warning, or Info</li>
            <li><strong className="text-white">Team</strong> — Optional, notifies all team members</li>
            <li><strong className="text-white">Affected Service</strong> — Which system is impacted</li>
            <li><strong className="text-white">Logs</strong> — Error messages or stack traces</li>
            <li><strong className="text-white">Runbook URL</strong> — Link to documentation</li>
          </ul>
        </li>
        <li>Submit to create and notify</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Auto-Subscription & Tagging</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Every incident is automatically tagged with <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">incident</code> plus 
        its severity level. This enables powerful auto-subscription:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`// Incident created with tags
["incident", "critical"]

// Your channel with autosub tag
{ "name": "PagerDuty Slack", "tag": "autosub:incident" }

// Result: You're automatically subscribed!`}</pre>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">Severity-Specific Channels</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Create channels with specific severity tags for filtered notifications:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><code className="text-[#00d4ff]">autosub:critical</code> — Only critical incidents (SMS)</li>
        <li><code className="text-[#00d4ff]">autosub:warning</code> — Warning and above (Slack)</li>
        <li><code className="text-[#00d4ff]">autosub:incident</code> — All incidents (Email digest)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Team Incidents</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When you create an incident for a team:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Set the <strong className="text-white">Team</strong> field to your organization</li>
        <li>All team members are <strong className="text-white">automatically subscribed</strong></li>
        <li>Each member receives alerts through their <code className="text-[#00d4ff]">autosub:incident</code> channels</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Structured Incident Data</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The app stores rich metadata in the event's <code className="text-[#00d4ff]">content</code> field:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`{
  "affected_service": "payment-api",
  "logs": "Error: Connection timeout at...",
  "runbook_url": "https://docs.example.com/runbooks/payment",
  "created_via": "it-alerts-app"
}`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Resolving Incidents</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Click <strong className="text-white">"Resolve"</strong> on any active incident</li>
        <li>The incident is marked resolved (sets <code className="text-[#00d4ff]">end_date</code>)</li>
        <li>Resolved incidents show a "Resolved" badge</li>
        <li>Filter by "Active" or "Resolved" to view different states</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Best Practices</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Use severity wisely</strong> — Reserve Critical for true emergencies</li>
        <li><strong className="text-white">Include runbook links</strong> — Help responders resolve faster</li>
        <li><strong className="text-white">Tag affected services</strong> — Enable service-specific channels</li>
        <li><strong className="text-white">Set up escalation</strong> — Use different channels for different severities</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Set up notification methods</span>
        </li>
        <li>
          <Link to="/guide/roles" className="text-[#00d4ff] hover:underline">
            Roles & Assignments
          </Link>
          <span className="text-slate-400"> — Require on-call certification</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Set up your team</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
