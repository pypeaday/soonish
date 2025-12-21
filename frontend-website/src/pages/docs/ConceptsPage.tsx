import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function ConceptsPage() {
  return (
    <DocsLayout
      title="Core Concepts"
      description="Understand the fundamental building blocks of Notifiq."
    >
      <p className="text-slate-300 leading-relaxed mb-8">
        Notifiq is built around three key concepts: <strong className="text-white">Events</strong>, 
        <strong className="text-white"> Channels</strong>, and <strong className="text-white">Subscriptions</strong>.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Events</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        An <strong className="text-white">Event</strong> is the central entity in Notifiq. Events can represent:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Calendar events</strong> — Parties, meetings, concerts</li>
        <li><strong className="text-white">Incidents</strong> — Server outages, security alerts</li>
        <li><strong className="text-white">Reminders</strong> — Take medication, check laundry</li>
        <li><strong className="text-white">Volunteer opportunities</strong> — Church cleanup, food bank shifts</li>
        <li><strong className="text-white">Anything else</strong> that needs notifications</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-4">
        When you subscribe to an event, you'll be notified of:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Updates</strong> — Time, location, or details changed</li>
        <li><strong className="text-white">Cancellations</strong> — Event was cancelled</li>
        <li><strong className="text-white">Reminders</strong> — At times you choose before the event</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Channels</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        A <strong className="text-white">Channel</strong> is where your notifications get delivered. 
        Notifiq supports 70+ services:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Type</th>
              <th className="text-left py-3 px-4 text-slate-300">Examples</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Email</td>
              <td className="py-3 px-4">Gmail, Outlook, any SMTP</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">SMS</td>
              <td className="py-3 px-4">Twilio, various providers</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Chat</td>
              <td className="py-3 px-4">Discord, Slack, Telegram, Matrix</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Push</td>
              <td className="py-3 px-4">Gotify, ntfy, Pushover</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">And more...</td>
              <td className="py-3 px-4">70+ services supported</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Channel Tags</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        You can tag your channels to organize them:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        "Work Email" → tag: work<br />
        "Personal Discord" → tag: personal<br />
        "Urgent SMS" → tag: urgent
      </div>
      <p className="text-slate-300 leading-relaxed">
        When subscribing to events, choose which tags to use—notifications go to matching channels.
      </p>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Auto-Subscription</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Tags starting with <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:</code> enable automatic subscriptions:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        Channel: "All Incidents" → tag: autosub:incident
      </div>
      <p className="text-slate-300 leading-relaxed">
        When an event is created with the <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">incident</code> tag, 
        you're automatically subscribed!
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Subscriptions</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        A <strong className="text-white">Subscription</strong> connects you to an event. When you subscribe, you choose:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Which channels</strong> to use (by tag or specific channel)</li>
        <li><strong className="text-white">When to get reminders</strong> (1 day before, 1 hour before, etc.)</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Reminders</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Set reminders for times that work for you:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>1 week before</li>
        <li>1 day before</li>
        <li>1 hour before</li>
        <li>15 minutes before</li>
        <li>Any custom time</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Organizations</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        <strong className="text-white">Organizations</strong> let teams work together:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Shared events visible to all members</li>
        <li>Team notification channels</li>
        <li>Role-based permissions (owner, admin, member)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/events" className="text-[#00d4ff] hover:underline">
            Events
          </Link>
          <span className="text-slate-400"> — Learn more about events</span>
        </li>
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Set up your notification channels</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — Customize your notifications</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
