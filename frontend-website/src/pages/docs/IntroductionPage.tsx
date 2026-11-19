import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function IntroductionPage() {
  return (
    <DocsLayout
      title="Introduction to Notifiq"
      description="Learn what Notifiq is and how it helps you stay informed through channels you already use."
    >
      <p className="text-slate-300 leading-relaxed">
        <strong className="text-white">Notifiq</strong> is a notification-first event coordination service that delivers 
        updates where users already are—not in a siloed app.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">The Problem</h2>
      <p className="text-slate-300 leading-relaxed mb-4">How many times have you:</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Missed an event because the notification was buried in an app you don't check?</li>
        <li>Had to install yet another app just to get updates about one thing?</li>
        <li>Wished your friends would just check Facebook/Discord/email for event updates?</li>
      </ul>
      <p className="text-slate-300 leading-relaxed">
        Users shouldn't need to install another app or check another platform. They should get notifications 
        through channels they already use.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">The Solution</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq sends notifications through <strong className="text-white">channels users already use</strong>:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Email</li>
        <li>SMS</li>
        <li>Discord</li>
        <li>Slack</li>
        <li>Gotify</li>
        <li>ntfy</li>
        <li>Telegram</li>
        <li>And 70+ more services</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Core Principles</h2>
      
      <h3 className="text-xl font-medium text-white mt-6 mb-3">1. Notification-First</h3>
      <p className="text-slate-300 leading-relaxed">
        Events exist to generate notifications. The notification is the product, not the app.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">2. Channel Agnostic</h3>
      <p className="text-slate-300 leading-relaxed">
        Users choose how they want to be notified. One user might want SMS, another Discord, another email. 
        Notifiq supports them all.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">3. Flexible Event Model</h3>
      <p className="text-slate-300 leading-relaxed mb-4">An "event" in Notifiq can be:</p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>A calendar event (party, meeting, concert)</li>
        <li>An incident (server down, security alert)</li>
        <li>A reminder (take medication, check laundry)</li>
        <li>A volunteer opportunity (church cleanup, food bank shift)</li>
        <li>Anything else that needs notifications</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">4. Always Stay Updated</h3>
      <p className="text-slate-300 leading-relaxed">
        When you subscribe to an event, you'll automatically be notified of any changes—time updates, 
        location changes, cancellations, or status updates. Set reminders for times that work for you.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">How It Works</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 my-6 font-mono text-sm">
        <pre className="text-slate-300 overflow-x-auto">{`┌─────────────────────────────────────────────────────────┐
│                    Notifiq Apps                          │
│    (IT Alerts, Volunteer Coordinator, Reminders...)     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Notifiq Service                       │
│          (Events, Subscriptions, Channels)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Your Preferred Channels                     │
│      (Email, SMS, Discord, Slack, Gotify, etc.)         │
└─────────────────────────────────────────────────────────┘`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/quickstart" className="text-[#00d4ff] hover:underline">
            Quick Start
          </Link>
          <span className="text-slate-400"> — Get started with Notifiq</span>
        </li>
        <li>
          <Link to="/guide/concepts" className="text-[#00d4ff] hover:underline">
            Core Concepts
          </Link>
          <span className="text-slate-400"> — Understand events, channels, and subscriptions</span>
        </li>
        <li>
          <Link to="/apps" className="text-[#00d4ff] hover:underline">
            Browse Apps
          </Link>
          <span className="text-slate-400"> — See all Notifiq applications</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
