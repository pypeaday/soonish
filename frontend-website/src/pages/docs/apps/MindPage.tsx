import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function MindPage() {
  return (
    <DocsLayout
      title="Mindful"
      description="Quick reminders designed for ADHD brains."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        <strong className="text-white">Mindful</strong> is a distraction-free reminder app designed for 
        ADHD brains. Capture thoughts before they disappear with one-click templates and quick-add reminders.
      </p>

      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Access:</strong> <code className="text-[#00d4ff]">/mindful</code> on your Notifiq instance
        </p>
      </div>

      <p className="text-slate-400 italic mb-6">
        Inspired by <a href="https://github.com/Casvt/MIND" className="text-[#00d4ff] hover:underline">MIND by Casvt</a>
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Why Mindful?</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Your mind is full. Traditional reminder apps require too many steps:
      </p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-red-500/30 rounded-xl p-4">
          <h3 className="text-red-400 font-medium mb-2">❌ Traditional Apps</h3>
          <ol className="text-slate-400 text-sm space-y-1">
            <li>1. Open app</li>
            <li>2. Tap "New Reminder"</li>
            <li>3. Type title</li>
            <li>4. Set date</li>
            <li>5. Set time</li>
            <li>6. Save</li>
            <li className="text-red-400">→ Forgot what you wanted to remember</li>
          </ol>
        </div>
        <div className="bg-[#111827] border border-green-500/30 rounded-xl p-4">
          <h3 className="text-green-400 font-medium mb-2">✓ Mindful</h3>
          <ol className="text-slate-400 text-sm space-y-1">
            <li>1. Tap template</li>
            <li>2. Done</li>
            <li className="text-green-400 mt-2">→ Reminder set in 2 seconds</li>
          </ol>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">One-Click Templates</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Pre-built templates for common scenarios—just tap to create:
      </p>
      
      <h3 className="text-xl font-semibold text-white mt-6 mb-3">⏱️ Focus Timers</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Pomodoro</p>
          <p className="text-slate-400 text-sm">25 min</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Deep Focus</p>
          <p className="text-slate-400 text-sm">60 min</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Flow State</p>
          <p className="text-slate-400 text-sm">90 min</p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">☕ Breaks</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Short Break</p>
          <p className="text-slate-400 text-sm">5 min</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Long Break</p>
          <p className="text-slate-400 text-sm">15 min</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">Stretch</p>
          <p className="text-slate-400 text-sm">10 min</p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mt-6 mb-3">✅ Quick Tasks</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">💊 Medication</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">💧 Water</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">🧺 Laundry</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3 text-center">
          <p className="text-white font-medium">🗑️ Trash</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Recurring Reminders</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Set reminders that repeat automatically:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Pattern</th>
              <th className="text-left py-3 px-4 text-slate-300">Use Case</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Once</td>
              <td className="py-3 px-4">Single reminder, then done</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Daily</td>
              <td className="py-3 px-4">Medication, water, daily habits</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Weekdays</td>
              <td className="py-3 px-4">Work-related reminders</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Weekly</td>
              <td className="py-3 px-4">Trash day, weekly review</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Monthly</td>
              <td className="py-3 px-4">Bills, monthly tasks</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Custom Reminders</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Need something specific? Create a custom reminder:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Tap the <strong className="text-white">+</strong> button</li>
        <li>Type your reminder text</li>
        <li>Pick a time (quick presets or custom)</li>
        <li>Optional: Set recurrence</li>
        <li>Save</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Design Philosophy</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Dark theme</strong> — Optimized for focus, easy on eyes</li>
        <li><strong className="text-white">Large touch targets</strong> — Easy to tap, even when distracted</li>
        <li><strong className="text-white">Minimal UI</strong> — No clutter, no distractions</li>
        <li><strong className="text-white">Instant feedback</strong> — Smooth animations confirm actions</li>
        <li><strong className="text-white">Mobile-first</strong> — Works great on phones</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Notification Channels</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Set up channels in Settings to receive reminders via:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Push notifications</strong> — ntfy, Pushover, Gotify</li>
        <li><strong className="text-white">SMS</strong> — For critical reminders</li>
        <li><strong className="text-white">Discord/Slack</strong> — If you live in chat</li>
        <li><strong className="text-white">Email</strong> — For less urgent items</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Tips for ADHD</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Use templates</strong> — Don't think, just tap</li>
        <li><strong className="text-white">Set multiple reminders</strong> — Redundancy is your friend</li>
        <li><strong className="text-white">Use different channels</strong> — SMS for critical, push for routine</li>
        <li><strong className="text-white">Recurring for habits</strong> — Build routines with daily reminders</li>
        <li><strong className="text-white">Capture immediately</strong> — If you think of it, add it now</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Source Filtering</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Mindful uses <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">source: 'notifiq-mind'</code> to 
        filter reminders. This means:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Only shows reminders created in Mindful</li>
        <li>Won't clutter other apps with your reminders</li>
        <li>Each app has its own isolated view</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels
          </Link>
          <span className="text-slate-400"> — Set up push notifications</span>
        </li>
        <li>
          <Link to="/guide/events" className="text-[#00d4ff] hover:underline">
            Events
          </Link>
          <span className="text-slate-400"> — How reminders work under the hood</span>
        </li>
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — Customize notification preferences</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
