import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function EventPlannerPage() {
  return (
    <DocsLayout
      title="Event Planner"
      description="Discover, create, and manage public and private events."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">Event Planner</strong> is a general-purpose event management app. 
        Create events, share them publicly or within organizations, and let attendees subscribe for notifications.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Access:</strong> <code className="text-[#00d4ff]">/events</code> on your Notifiq instance
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Key Features</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🔍 Discover Events</h3>
          <p className="text-slate-400 text-sm">Browse public events from organizations</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">📅 Create Events</h3>
          <p className="text-slate-400 text-sm">Personal or organization events with rich details</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">📋 My Schedule</h3>
          <p className="text-slate-400 text-sm">View all events you're subscribed to</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🏢 Organizations</h3>
          <p className="text-slate-400 text-sm">Create and manage event-hosting organizations</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Discover Page</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The home page shows public events from organizations. Anyone can browse without logging in:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Filter by organization</li>
        <li>Search by event name</li>
        <li>View event details</li>
        <li>Subscribe to get notifications (requires login)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Creating Events</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Create events with rich details:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4">
        <h3 className="text-white font-medium mb-3">Event Fields</h3>
        <ul className="list-disc list-inside text-slate-300 space-y-2 text-sm">
          <li><strong className="text-white">Name</strong> — Event title</li>
          <li><strong className="text-white">Description</strong> — Full details, markdown supported</li>
          <li><strong className="text-white">Start/End Date</strong> — When the event occurs</li>
          <li><strong className="text-white">Location</strong> — Physical address or virtual link</li>
          <li><strong className="text-white">Tags</strong> — For categorization and auto-subscription</li>
          <li><strong className="text-white">Organization</strong> — Optional, makes event visible to org members</li>
          <li><strong className="text-white">Public</strong> — Whether event appears on Discover page</li>
        </ul>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Personal vs Organization Events</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Personal Events</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Only you can see them</li>
            <li>• Good for personal reminders</li>
            <li>• Can invite others manually</li>
          </ul>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Organization Events</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Visible to org members</li>
            <li>• Can be made public</li>
            <li>• Auto-subscribe via tags</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">My Schedule</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The Schedule page shows all events you're subscribed to:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Upcoming events in chronological order</li>
        <li>Events you created</li>
        <li>Events you subscribed to</li>
        <li>Quick access to event details</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Dashboard</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Your personal dashboard shows:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Events you've created</li>
        <li>Quick stats (upcoming, past, total)</li>
        <li>Recent activity</li>
        <li>Quick actions (create event, manage channels)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Organization Public Pages</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Organizations get a public page at <code className="text-[#00d4ff]">/orgs/[slug]</code> showing:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Organization name and description</li>
        <li>Upcoming public events</li>
        <li>Subscribe buttons for each event</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Subscribing to Events</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When you subscribe to an event:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Choose which channels to notify (or use tag matching)</li>
        <li>Set reminder preferences (1 hour before, 1 day before, etc.)</li>
        <li>Receive notifications when the event is updated</li>
        <li>Get reminders before the event starts</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Use Cases</h2>
      <div className="space-y-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Community Groups</h3>
          <p className="text-slate-400 text-sm">
            Book clubs, hobby groups, neighborhood associations—create an organization, 
            post events, let members subscribe.
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Local Businesses</h3>
          <p className="text-slate-400 text-sm">
            Restaurants, gyms, studios—post classes, special events, and promotions. 
            Customers subscribe for updates.
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Personal Planning</h3>
          <p className="text-slate-400 text-sm">
            Track personal events, set reminders, share with family or friends.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/events" className="text-[#00d4ff] hover:underline">
            Events
          </Link>
          <span className="text-slate-400"> — Deep dive on event properties</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — How notifications work</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Create your own organization</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
