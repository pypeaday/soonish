import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function SchedulerPage() {
  return (
    <DocsLayout
      title="The Scheduler"
      description="How Notifiq runs future work — a durable job table and a polling worker, no external scheduler."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Everything Notifiq does later — reminders, event wind-down, retries — is a row
        in <code className="text-[#00d4ff]">scheduled_jobs</code>, a table in the same SQLite/PostgreSQL
        database as the rest of the app. A worker process (same image as the API,
        different entrypoint) polls the table once a second and executes what's due.
        There is no separate scheduler service to install or operate.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">The model</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`scheduled_jobs
  id, kind, dedupe_key, event_id, subscription_id,
  payload, due_at, status, attempts, max_attempts,
  last_error, created_at, updated_at

status: pending → running → done
                   └→ pending (retry) └→ dead (max_attempts)`}</pre>
      </div>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">dedupe_key</strong> — makes (re)scheduling idempotent; enqueueing an existing pending key updates it in place</li>
        <li><strong className="text-white">due_at</strong> — the only clock; fire time for a reminder is <code className="text-[#00d4ff]">start_date − offset</code></li>
        <li><strong className="text-white">attempts / max_attempts</strong> — retry budget, same envelope as the old retry policy (~2s initial, 2× backoff, 30s cap, 3 tries)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Job kinds</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Kind</th>
              <th className="text-left py-3 px-4 text-slate-300">What it does</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">reminder</code></td>
              <td className="py-3 px-4">One subscriber's reminder — formats and sends to that subscription's channels</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">event_end</code></td>
              <td className="py-3 px-4">Event wind-down: cancel reminders, spawn next occurrence, completion notify</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">notify_subscribers</code></td>
              <td className="py-3 px-4">Broadcast to all of an event's subscribers (created/updated/cancelled)</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">notify_user</code></td>
              <td className="py-3 px-4">Direct notification to one user (role changes, confirmations)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">The loop</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`every second:
  1. sweep running jobs older than 10min → pending  (worker-crash recovery)
  2. SELECT … WHERE status='pending' AND due_at <= now LIMIT 20
  3. per row: UPDATE … SET status='running' WHERE id=? AND status='pending'
     (rowcount 0 → another worker claimed it; safe under postgres too)
  4. run handler in its own session
     success → done │ failure → retry/backoff │ attempts=max → dead`}</pre>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        Dead jobs surface in <code className="text-[#00d4ff]">/api/v1/health</code> — the
        <code className="text-[#00d4ff]"> scheduler</code> field goes unhealthy when dead rows exist.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">What the API writes</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Routes never talk to a scheduler — they enqueue rows inside the same DB
        commit as the change itself, so a committed event always has its jobs:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Create event</strong> → event_end + per-subscriber reminder jobs + creation broadcast</li>
        <li><strong className="text-white">Update event</strong> → reminder/event_end jobs rescheduled via dedupe keys + update broadcast</li>
        <li><strong className="text-white">Delete event</strong> → pending jobs deleted (FK cascade also covers it) + cancellation broadcast</li>
        <li><strong className="text-white">Subscribe</strong> → that subscription's reminder jobs + confirmation</li>
        <li><strong className="text-white">Assign role</strong> → notify_user job</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Inspecting the queue</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The whole scheduler is queryable state — no special UI needed:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`SELECT kind, status, due_at, dedupe_key FROM scheduled_jobs ORDER BY due_at;`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Trade-offs</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>~1s fire latency (poll interval) — fine for reminders, not a realtime primitive</li>
        <li>At-least-once delivery — dedupe_key covers scheduling; send idempotency lives in the delivery layer</li>
        <li>No workflow UI/history — but <code className="text-[#00d4ff]">SELECT</code> beats scanning a schedule namespace</li>
        <li>Single worker is typical; the conditional claim keeps a second worker safe if you add one on postgres</li>
      </ul>

      <p className="text-slate-400 text-sm mt-8">
        See the <Link to="/guide/walkthrough" className="text-[#00d4ff] hover:underline">walkthrough</Link> for
        the user-facing version of this lifecycle, and
        the <Link to="/guide/admin/architecture" className="text-[#00d4ff] hover:underline">architecture overview</Link> for
        where the worker sits.
      </p>
    </DocsLayout>
  );
}
