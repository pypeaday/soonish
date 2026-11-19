import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function ArchitecturePage() {
  return (
    <DocsLayout
      title="System Architecture"
      description="Deep dive into Notifiq's technical design and components."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq is built on a modern async Python stack; durable scheduling is
        a <code className="text-[#00d4ff]">scheduled_jobs</code> table polled by a worker —
        no external scheduler.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 my-6 font-mono text-sm">
        <pre className="text-slate-300 overflow-x-auto">{`┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│            (React SPAs, Mobile Apps, API Consumers)             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   REST API  │  │   Auth      │  │   Static Files          │  │
│  │   /api/v1   │  │   JWT/OAuth │  │   (React SPAs)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                                        ▲
         ▼                                        │ polls
┌─────────────────────┐              ┌─────────────────────────────┐
│   SQLite/Postgres   │◄─────────────│          Worker             │
│   ┌─────────────┐   │   claims     │   ┌─────────────────────┐   │
│   │ Users       │   │   due jobs   │   │ poll scheduled_jobs │   │
│   │ Events      │   │              │   │ reminder / event_end│   │
│   │ Channels    │   │              │   │ notify_* handlers   │   │
│   │ Subs        │   │              │   └─────────────────────┘   │
│   │ sched_jobs  │   │              └─────────────────────────────┘
│   └─────────────┘   │                            │
└─────────────────────┘                            ▼
                                    ┌─────────────────────────────┐
                                    │         Apprise             │
                                    │   (70+ notification svcs)   │
                                    └─────────────────────────────┘`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Components</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">FastAPI Backend</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        The main application server handles:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>REST API endpoints for all CRUD operations</li>
        <li>JWT authentication and authorization</li>
        <li>Serving static frontend files (React SPAs)</li>
        <li>Writing scheduled jobs when events are created/updated (same DB commit)</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Scheduled Jobs</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        The <code className="text-[#00d4ff]">scheduled_jobs</code> table is the durable timer queue:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Rows survive restarts — the database is the only state</li>
        <li>One reminder job per subscriber offset; one event_end job per event</li>
        <li>Retries with exponential backoff; dead jobs surface in /health</li>
        <li>dedupe_key makes (re)scheduling idempotent</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Worker</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Same image as the API, worker entrypoint — a once-a-second poll loop:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">reminder</strong> — formats and sends one subscriber's reminder</li>
        <li><strong className="text-white">event_end</strong> — wind-down + recurring next occurrence</li>
        <li><strong className="text-white">notify_*</strong> — delivers broadcasts via Apprise</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Database</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        SQLite for development, PostgreSQL for production:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Users, authentication, and tiers</li>
        <li>Events with metadata and tags</li>
        <li>Encrypted channel credentials</li>
        <li>Subscriptions with selectors</li>
        <li>Organizations and memberships</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Notification Patterns</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq supports two notification patterns:
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">1. Event-Driven Broadcasts</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Triggered by organizer actions (create, update, cancel):
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`Event Created → Find Subscribers → Notify All
Event Updated → Find Subscribers → Notify All
Event Cancelled → Find Subscribers → Notify All`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">2. Subscriber-Driven Reminders</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Personal reminders based on subscription preferences:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`Subscribe → Insert reminder jobs (start_date − offset)
due_at passes → worker claims job → Notify User
Event Ends → event_end job cancels remaining reminders`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/scheduler" className="text-[#00d4ff] hover:underline">
            The Scheduler
          </Link>
          <span className="text-slate-400"> — Deep dive into the job queue</span>
        </li>
        <li>
          <Link to="/guide/admin/database" className="text-[#00d4ff] hover:underline">
            Database Schema
          </Link>
          <span className="text-slate-400"> — Data model reference</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
