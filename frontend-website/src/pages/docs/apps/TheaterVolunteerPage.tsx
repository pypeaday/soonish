import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function TheaterVolunteerPage() {
  return (
    <DocsLayout
      title="Stage Manager"
      description="Theater production coordination for directors, parents, and volunteers."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">Stage Manager</strong> helps theater productions coordinate 
        volunteers and keep parents informed. Directors create events, parents set up auto-notifications, 
        and everyone stays in sync.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Access:</strong> <code className="text-[#00d4ff]">/stage-manager</code> on your Notifiq instance
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Who It's For</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🎭 Directors</h3>
          <p className="text-slate-400 text-sm">Create events, manage schedules, notify cast & crew</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">👨‍👩‍👧 Parents</h3>
          <p className="text-slate-400 text-sm">Get notified when your child has rehearsal or events</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">🎪 Volunteers</h3>
          <p className="text-slate-400 text-sm">Sign up for setup, costumes, lighting, and more</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How Auto-Subscriptions Work</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The magic of Stage Manager is <strong className="text-white">tag-based auto-subscription</strong>. 
        Parents set up channels once, then automatically get notified about relevant events.
      </p>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">Step 1: Parents Set Up Channels</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Create notification channels with <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:</code> tags:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`// Get all notifications
{ "name": "My Phone", "tag": "autosub:all" }

// Only rehearsals
{ "name": "Rehearsal SMS", "tag": "autosub:rehearsal" }

// Only my child's events
{ "name": "Emma's Schedule", "tag": "autosub:emma" }

// Setup crew calls
{ "name": "Setup Slack", "tag": "autosub:setup" }`}</pre>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">Step 2: Directors Create Events</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        When creating events, directors add relevant tags:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`// Tech Rehearsal
Tags: ["rehearsal", "lighting", "sound", "all"]

// Set Build Day
Tags: ["setup", "all"]

// Emma's Scene Rehearsal
Tags: ["rehearsal", "emma", "act2"]`}</pre>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">Step 3: Automatic Matching</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq automatically:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Subscribes parents whose channel tags match event tags</li>
        <li>Sends notifications when events are created or updated</li>
        <li>Removes subscriptions when tags no longer match</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Common Tag Patterns</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Tag</th>
              <th className="text-left py-3 px-4 text-slate-300">Use Case</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">all</code></td>
              <td className="py-3 px-4">Everything—full cast calls, important announcements</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">rehearsal</code></td>
              <td className="py-3 px-4">All rehearsals</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">setup</code></td>
              <td className="py-3 px-4">Set construction, load-in days</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">costumes</code></td>
              <td className="py-3 px-4">Costume fittings, sewing sessions</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">lighting</code></td>
              <td className="py-3 px-4">Tech crew—lighting focus, cue-to-cue</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">[child-name]</code></td>
              <td className="py-3 px-4">Events involving a specific cast member</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">act1</code>, <code className="text-[#00d4ff]">act2</code></td>
              <td className="py-3 px-4">Scene-specific rehearsals</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example: School Musical</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4">
        <h3 className="text-white font-medium mb-3">Setup</h3>
        <ol className="list-decimal list-inside text-slate-300 space-y-2 text-sm">
          <li>Director creates organization: "Spring Musical 2025"</li>
          <li>Parents join organization and create channels with autosub tags</li>
          <li>Director creates events with appropriate tags</li>
        </ol>
        
        <h3 className="text-white font-medium mt-4 mb-3">Parent: Sarah (Emma's mom)</h3>
        <div className="font-mono text-xs text-slate-400 bg-[#0a0f1a] p-2 rounded mb-3">
          Channel: "My Phone" → autosub:emma<br/>
          Channel: "Family Calendar" → autosub:all
        </div>
        
        <h3 className="text-white font-medium mb-3">Director Creates Event</h3>
        <div className="font-mono text-xs text-slate-400 bg-[#0a0f1a] p-2 rounded mb-3">
          "Act 2 Rehearsal" → Tags: [rehearsal, emma, jacob, act2]
        </div>
        
        <h3 className="text-white font-medium mb-3">Result</h3>
        <p className="text-slate-400 text-sm">
          Sarah automatically subscribed via "emma" tag match → Gets SMS notification
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">My Schedule View</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The "My Schedule" page shows all events you're subscribed to, making it easy to see:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Upcoming rehearsals and calls</li>
        <li>Events you've signed up for</li>
        <li>Your notification preferences per event</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tips for Directors</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Be consistent with tags</strong> — Use the same tags throughout the production</li>
        <li><strong className="text-white">Tag cast members by name</strong> — Parents can subscribe to just their child</li>
        <li><strong className="text-white">Use "all" sparingly</strong> — Reserve for truly important announcements</li>
        <li><strong className="text-white">Update events, don't delete</strong> — Updates notify subscribers automatically</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tips for Parents</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Start with your child's name tag</strong> — Most targeted notifications</li>
        <li><strong className="text-white">Add "all" for important updates</strong> — Don't miss cast-wide announcements</li>
        <li><strong className="text-white">Use different channels for different urgency</strong> — SMS for same-day, email for weekly</li>
        <li><strong className="text-white">Test your channels</strong> — Send a test notification before the show starts</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Set up SMS, email, or push notifications</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — Understand how auto-subscribe works</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Set up your production team</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
