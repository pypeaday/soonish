import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function VolunteerCoordinatorPage() {
  return (
    <DocsLayout
      title="Volunteer Coordinator"
      description="Manage volunteer signups with role requirements and assignments."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">Volunteer Coordinator</strong> helps organizations manage 
        volunteer signups for events. Define roles, set requirements, and let volunteers self-assign 
        to open slots.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Access:</strong> <code className="text-[#00d4ff]">/volunteer</code> on your Notifiq instance
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Key Features</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">📋 Role Catalog</h3>
          <p className="text-slate-400 text-sm">Define reusable roles like Usher, Greeter, Parking</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">📊 Slot Tracking</h3>
          <p className="text-slate-400 text-sm">See filled vs needed counts at a glance</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">✋ Self-Signup</h3>
          <p className="text-slate-400 text-sm">Volunteers claim open slots themselves</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🔔 Auto-Notifications</h3>
          <p className="text-slate-400 text-sm">Assigned volunteers get reminders automatically</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How It Works</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-3 mb-6">
        <li>
          <strong className="text-white">Admin defines roles</strong> — Create role definitions for your organization
        </li>
        <li>
          <strong className="text-white">Admin creates events with requirements</strong> — "Opening Night needs 6 Ushers, 4 Concessions"
        </li>
        <li>
          <strong className="text-white">Volunteers browse and sign up</strong> — See open slots, claim the ones you want
        </li>
        <li>
          <strong className="text-white">Everyone gets notified</strong> — Assigned volunteers receive event reminders
        </li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Setting Up Roles</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Navigate to the <strong className="text-white">Roles</strong> page to define your organization's volunteer positions:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`// Example roles for a theater
Usher
Concessions
Parking Attendant
Greeter
Box Office
Backstage Helper`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Creating Events with Requirements</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When creating an event, specify how many volunteers you need for each role:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4">
        <h3 className="text-white font-medium mb-3">Opening Night - March 15</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Ushers</span>
            <span className="text-[#00d4ff]">2/6 filled</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Concessions</span>
            <span className="text-[#00d4ff]">0/4 filled</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Parking</span>
            <span className="text-[#00d4ff]">1/3 filled</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Greeters</span>
            <span className="text-green-400">2/2 filled ✓</span>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Volunteer Self-Signup</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Volunteers can browse events and sign up for open slots:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Browse upcoming events on the dashboard</li>
        <li>Click an event to see role requirements</li>
        <li>Click <strong className="text-white">"Sign Up"</strong> on any open slot</li>
        <li>You're automatically subscribed and will receive reminders</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">My Commitments</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The <strong className="text-white">"My Commitments"</strong> page shows all events you've signed up for:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Upcoming volunteer shifts</li>
        <li>Your assigned role for each event</li>
        <li>Event details and timing</li>
        <li>Option to withdraw if needed</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Notification Flow</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When you sign up for a role:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Assignment notification</strong> — Immediate confirmation</li>
        <li><strong className="text-white">Auto-subscribed</strong> — You're subscribed to the event</li>
        <li><strong className="text-white">Reminders</strong> — Get notified before the event starts</li>
        <li><strong className="text-white">Updates</strong> — Notified if event details change</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example: Community Theater</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4">
        <h3 className="text-white font-medium mb-3">Setup</h3>
        <ol className="list-decimal list-inside text-slate-300 space-y-2 text-sm">
          <li>Theater creates organization: "Community Playhouse"</li>
          <li>Admin defines roles: Usher, Concessions, Parking, Greeter</li>
          <li>Admin creates "Opening Night" with role requirements</li>
          <li>Volunteers join organization and browse events</li>
          <li>Volunteers sign up for open slots</li>
          <li>Everyone receives reminders before the show</li>
        </ol>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tips for Coordinators</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Create roles early</strong> — Define all positions before creating events</li>
        <li><strong className="text-white">Be specific with counts</strong> — Better to have exact needs than guesses</li>
        <li><strong className="text-white">Add event descriptions</strong> — Help volunteers know what to expect</li>
        <li><strong className="text-white">Monitor fill rates</strong> — Reach out if slots aren't filling</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tips for Volunteers</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Set up notification channels</strong> — Ensure you get reminders</li>
        <li><strong className="text-white">Sign up early</strong> — Popular slots fill fast</li>
        <li><strong className="text-white">Check "My Commitments"</strong> — Review your upcoming shifts</li>
        <li><strong className="text-white">Withdraw if needed</strong> — Better to cancel early than no-show</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/roles" className="text-[#00d4ff] hover:underline">
            Roles & Assignments
          </Link>
          <span className="text-slate-400"> — Deep dive on the roles system</span>
        </li>
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Set up your notification preferences</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Create or join a volunteer group</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
