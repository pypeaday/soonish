import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

const steps = [
  { n: '01', label: 'Sign in' },
  { n: '02', label: 'Connect a channel' },
  { n: '03', label: 'Create an event' },
  { n: '04', label: 'What got scheduled' },
  { n: '05', label: 'The reminder fires' },
  { n: '06', label: 'The event ends' },
];

export function WalkthroughPage() {
  return (
    <DocsLayout
      title="Walkthrough"
      description="One event's full journey through Notifiq — from sign-in to the reminder landing on your phone."
    >
      <div className="flex flex-wrap gap-2 mb-10">
        {steps.map((s) => (
          <a
            key={s.n}
            href={`#step-${s.n}`}
            className="bg-[#111827] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-[#00d4ff] hover:border-[#00d4ff]/50 transition-colors"
          >
            <span className="text-[#00d4ff] font-mono mr-2">{s.n}</span>
            {s.label}
          </a>
        ))}
      </div>

      <h2 id="step-01" className="text-2xl font-semibold text-white mt-6 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">01</span>Sign in
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Everything hangs off your account: channels, subscriptions, and every event you
        create or follow. On the hosted service, register and verify your email. On a
        self-hosted install with dev mode, the seeded <code className="text-[#00d4ff]">admin@example.com</code> account
        gets you in instantly.
      </p>

      <h2 id="step-02" className="text-2xl font-semibold text-white mt-10 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">02</span>Connect a channel
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        A channel is a destination — an ntfy topic, a Discord webhook, a Telegram chat,
        an email address. You create it once and every subscription can point at it.
        Notifiq stores the config encrypted and asks each channel to send a test
        notification before you rely on it.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`POST /api/v1/channels
{
  "name": "my phone",
  "channel_type": "ntfy",
  "config": { "url": "https://ntfy.sh/my-secret-topic" }
}`}</pre>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Send a test ping (<code className="text-[#00d4ff]">POST /api/v1/channels/&#123;id&#125;/test</code>) — 
        a "hello" lands on your phone in seconds, or the error tells you why not.
      </p>

      <h2 id="step-03" className="text-2xl font-semibold text-white mt-10 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">03</span>Create an event
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Events are created inside apps — <strong className="text-white">Event Planner</strong> for
        public gatherings, <strong className="text-white">Mind</strong> for personal reminders,
        <strong className="text-white"> IT Alerts</strong> for incidents. Under the hood every app calls
        the same API:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`POST /api/v1/events
{
  "name": "Deploy window",
  "start_date": "2026-10-09T02:00:00Z",
  "end_date": "2026-10-09T04:00:00Z",
  "timezone": "UTC"
}`}</pre>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        You're auto-subscribed as the organizer, with your default reminder offsets.
        Anyone else can subscribe too — each subscriber picks their own channels and
        reminder times.
      </p>

      <h2 id="step-04" className="text-2xl font-semibold text-white mt-10 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">04</span>What got scheduled
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Creating that event wrote durable rows into <code className="text-[#00d4ff]">scheduled_jobs</code> —
        no separate scheduler service, just the database:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`kind                status    due_at                dedupe_key
------------------  --------  --------------------  ---------------------------
event_end           pending   2026-10-09 04:00:00   event-end-1
reminder            pending   2026-10-09 01:45:00   event-1-sub-1-reminder-900s
reminder            pending   2026-10-08 02:00:00   event-1-sub-1-reminder-86400s
notify_subscribers  done      2026-10-08 01:00:00   (creation broadcast — fired)`}</pre>
      </div>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>One <code className="text-[#00d4ff]">reminder</code> job per subscriber offset — fire time is <code className="text-[#00d4ff]">start_date − offset</code>.</li>
        <li>One <code className="text-[#00d4ff]">event_end</code> job at <code className="text-[#00d4ff]">end_date</code> — runs the event's whole wind-down.</li>
        <li>Broadcasts (<code className="text-[#00d4ff]">notify_subscribers</code>, <code className="text-[#00d4ff]">notify_user</code>) are due immediately — the worker picks them up on its next poll.</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-4">
        Update the event's start time and the pending reminder jobs move with it;
        delete the event and its jobs die with it. Job dedupe keys make rescheduling
        idempotent — firing the same update twice can't double-book a reminder.
      </p>

      <h2 id="step-05" className="text-2xl font-semibold text-white mt-10 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">05</span>The reminder fires
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The worker polls <code className="text-[#00d4ff]">scheduled_jobs</code> every second for
        <code className="text-[#00d4ff]"> status='pending' AND due_at &lt;= now</code>, claims the row
        (<code className="text-[#00d4ff]">pending → running</code>), and runs the handler: fetch the event,
        format the reminder ("starts in 15 minutes"), and deliver it to that
        subscription's channels.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`success  → status='done'
failure  → attempts+1, status='pending',
           due_at = now + backoff (2s, ×2, max 30s)
attempts = max → status='dead' (visible in /api/v1/health)`}</pre>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        If the worker dies mid-send, the next poll sweeps stale
        <code className="text-[#00d4ff]"> running</code> rows back to <code className="text-[#00d4ff]">pending</code> —
        the reminder still lands. At-least-once delivery: a channel hiccup retries,
        it never silently drops.
      </p>

      <h2 id="step-06" className="text-2xl font-semibold text-white mt-10 mb-4">
        <span className="text-[#00d4ff] font-mono mr-3">06</span>The event ends
      </h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        When <code className="text-[#00d4ff]">event_end</code> comes due, the worker does the event's
        wind-down in one handler:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`event_end fires
    │
    ├─► cancel any pending reminders for this event
    ├─► if recurring → create the next occurrence
    │   ├─ clone subscriptions + reminder preferences
    │   └─ schedule ITS event_end + reminder jobs
    └─► notify subscribers (if notify_on_completion)`}</pre>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        A recurring weekly event is therefore a self-perpetuating chain: each
        occurrence's end spawns and schedules the next — nothing else needs to run.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Where next</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/tour" className="text-[#00d4ff] hover:underline">Interactive Tour</Link>
          <span className="text-slate-400"> — do it for real, step by step, against the live API</span>
        </li>
        <li>
          <Link to="/guide/quickstart" className="text-[#00d4ff] hover:underline">Quick Start</Link>
          <span className="text-slate-400"> — do it yourself in five minutes</span>
        </li>
        <li>
          <Link to="/guide/concepts" className="text-[#00d4ff] hover:underline">Core Concepts</Link>
          <span className="text-slate-400"> — events, channels, subscriptions, reminders</span>
        </li>
        <li>
          <Link to="/guide/admin/scheduler" className="text-[#00d4ff] hover:underline">The Scheduler</Link>
          <span className="text-slate-400"> — deep dive on the job queue this walkthrough peeked at</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
