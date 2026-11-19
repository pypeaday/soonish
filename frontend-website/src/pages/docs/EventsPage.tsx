import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function EventsPage() {
  return (
    <DocsLayout
      title="Events"
      description="The central entity in Notifiq that drives all notifications."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        An <strong className="text-white">Event</strong> represents something that happens at a specific time 
        and needs notifications. Events are flexible—they can be calendar events, incidents, reminders, 
        volunteer opportunities, or anything else.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Event Properties</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Property</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">name</code></td>
              <td className="py-3 px-4">Event title</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">description</code></td>
              <td className="py-3 px-4">Detailed description</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">start_date</code></td>
              <td className="py-3 px-4">When the event starts (UTC)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">end_date</code></td>
              <td className="py-3 px-4">When the event ends (UTC)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">tags</code></td>
              <td className="py-3 px-4">Array of strings for categorization and auto-subscription</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">content</code></td>
              <td className="py-3 px-4">JSON field for app-specific metadata</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">source</code></td>
              <td className="py-3 px-4">Which app created the event</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Event Lifecycle</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When an event is created:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Subscribers are matched based on tags</li>
        <li>Reminder schedules are created for each subscriber</li>
        <li>The event waits for its start/end time</li>
        <li>Updates broadcast to all subscribers immediately</li>
        <li>Reminders fire at scheduled times</li>
        <li>Event completes when end_date passes</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tags</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Tags enable automatic subscription matching. When an event has tags that match a user's 
        channel <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:</code> tags, 
        they're automatically subscribed.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Event with tags
{
  "name": "Production Deploy",
  "tags": ["deploy", "production"]
}

// User's channel with autosub tag
{
  "name": "Deploy Alerts",
  "tag": "autosub:deploy"
}

// → User is automatically subscribed!`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">The content Field</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">content</code> field 
        stores app-specific JSON data:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Incident (IT Console)
{
  "affected_service": "payment-api",
  "severity": "critical",
  "runbook_url": "https://..."
}

// Volunteer Event
{
  "roles": [
    { "name": "Setup Crew", "count_needed": 3 }
  ],
  "what_to_bring": ["Gloves", "Water bottle"]
}`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Configure notification delivery</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — Connect users to events</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
