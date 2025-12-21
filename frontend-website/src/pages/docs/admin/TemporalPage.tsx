import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function TemporalPage() {
  return (
    <DocsLayout
      title="Temporal Workflows"
      description="Deep dive into Notifiq's durable workflow orchestration."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq uses <a href="https://temporal.io" className="text-[#00d4ff] hover:underline">Temporal</a> for 
        durable workflow orchestration. Temporal ensures notifications are delivered reliably, 
        even if the server restarts or network issues occur.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Why Temporal?</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Durability</strong> — Workflows survive server restarts</li>
        <li><strong className="text-white">Reliability</strong> — Automatic retries with backoff</li>
        <li><strong className="text-white">Scheduling</strong> — Native support for reminder schedules</li>
        <li><strong className="text-white">Visibility</strong> — Built-in UI for monitoring workflows</li>
        <li><strong className="text-white">Signals</strong> — Real-time updates to running workflows</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Workflows</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">EventWorkflow</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Manages the complete lifecycle of an event from creation to completion.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`Event Created
    │
    ├─► Validate event exists
    ├─► Send creation notification to subscribers
    ├─► Create reminder schedules (Temporal Schedules)
    │
    ▼
Wait until end_date or cancellation
    │
    ├─► [Signal: event_updated] → Reschedule reminders, notify
    ├─► [Signal: cancel_event] → Notify subscribers, cleanup
    ├─► [Signal: participant_added] → Create personal reminders
    │
    ▼
Cleanup
    │
    ├─► Delete reminder schedules
    ├─► Generate next occurrence (if recurring)
    └─► Send completion notification (if requested)`}</pre>
      </div>

      <h4 className="text-lg font-medium text-white mt-4 mb-2">Signals</h4>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Signal</th>
              <th className="text-left py-3 px-4 text-slate-300">Purpose</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">cancel_event</code></td>
              <td className="py-3 px-4">Cancels event, notifies all subscribers</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">event_updated</code></td>
              <td className="py-3 px-4">Updates event data, reschedules reminders if start_date changed</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">participant_added</code></td>
              <td className="py-3 px-4">Creates personal reminder schedules for new subscriber</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">participant_removed_signal</code></td>
              <td className="py-3 px-4">Confirms unsubscribe/mute action to user</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">role_assignment_notification</code></td>
              <td className="py-3 px-4">Notifies user of role assignment changes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">ReminderWorkflow</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Short-lived workflow that sends a personal reminder to a single subscriber. 
        Triggered by Temporal Schedules at the subscriber's chosen reminder times.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`Schedule Fires (e.g., 1 hour before event)
    │
    ├─► Fetch current event details
    ├─► Format reminder message based on offset
    └─► Send notification to specific subscription only`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Activities</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Activities are the building blocks that workflows execute. They handle external I/O.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Activity</th>
              <th className="text-left py-3 px-4 text-slate-300">Purpose</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">validate_event_exists</code></td>
              <td className="py-3 px-4">Check if event exists in database</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">get_event_details</code></td>
              <td className="py-3 px-4">Fetch event data from database</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">send_notification</code></td>
              <td className="py-3 px-4">Send notification to a user's channels</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">send_notification_to_subscribers</code></td>
              <td className="py-3 px-4">Broadcast to all event subscribers</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">create_reminder_schedules</code></td>
              <td className="py-3 px-4">Create Temporal Schedules for reminders</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">delete_reminder_schedules</code></td>
              <td className="py-3 px-4">Cleanup schedules when event ends</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">create_next_occurrence</code></td>
              <td className="py-3 px-4">Generate next event in recurring series</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Workflow IDs</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq uses human-readable workflow IDs for easy debugging:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`# Event workflows
{source}/{event_id}-{slug}
Examples:
  notifiq-theater-volunteer/42-tech-rehearsal
  notifiq-adhd-reminders/7-morning-routine
  notifiq-web/15-team-meeting

# Reminder schedules
event-{event_id}-sub-{subscription_id}-reminder-{offset}s
Example:
  event-42-sub-15-reminder-3600s`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Temporal UI</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Access the Temporal UI at <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">http://localhost:8080</code> to:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>View running and completed workflows</li>
        <li>Inspect workflow history and state</li>
        <li>Send signals to workflows manually</li>
        <li>View and manage schedules</li>
        <li>Debug failed activities</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/database" className="text-[#00d4ff] hover:underline">
            Database Schema
          </Link>
          <span className="text-slate-400"> — Data model reference</span>
        </li>
        <li>
          <Link to="/guide/admin/api/events" className="text-[#00d4ff] hover:underline">
            Events API
          </Link>
          <span className="text-slate-400"> — API endpoints for events</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
