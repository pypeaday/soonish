import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function QuickStartPage() {
  return (
    <DocsLayout
      title="Quick Start"
      description="Get started with Notifiq in under 5 minutes."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">1. Create Your Account</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Sign up for free and start receiving notifications immediately.
      </p>
      <div className="flex gap-4 mb-6">
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90 transition-colors"
        >
          Sign Up Free →
        </Link>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">2. Choose Your Plan</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq offers flexible tiers based on your notification needs:
      </p>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-2">Free</h3>
          <p className="text-2xl font-bold text-[#00d4ff] mb-3">$0<span className="text-sm text-slate-400">/mo</span></p>
          <ul className="text-slate-400 text-sm space-y-2">
            <li>✓ 100 notifications/month</li>
            <li>✓ 3 notification channels</li>
            <li>✓ Free channel types only</li>
            <li>✓ Personal use</li>
          </ul>
        </div>
        <div className="bg-[#111827] border-2 border-[#00d4ff] rounded-xl p-5 relative">
          <span className="absolute -top-3 left-4 bg-[#00d4ff] text-[#0a0f1a] text-xs font-bold px-2 py-1 rounded">POPULAR</span>
          <h3 className="text-lg font-semibold text-white mb-2">Pro</h3>
          <p className="text-2xl font-bold text-[#00d4ff] mb-3">$9<span className="text-sm text-slate-400">/mo</span></p>
          <ul className="text-slate-400 text-sm space-y-2">
            <li>✓ 1,000 notifications/month</li>
            <li>✓ 10 notification channels</li>
            <li>✓ All channel types</li>
            <li>✓ Organization support</li>
          </ul>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-2">Unlimited</h3>
          <p className="text-2xl font-bold text-[#00d4ff] mb-3">$29<span className="text-sm text-slate-400">/mo</span></p>
          <ul className="text-slate-400 text-sm space-y-2">
            <li>✓ Unlimited notifications</li>
            <li>✓ Unlimited channels</li>
            <li>✓ All channel types</li>
            <li>✓ Priority support</li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">3. Add a Notification Channel</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Channels are where your notifications get delivered. Connect your favorite services:
      </p>

      <h3 className="text-lg font-medium text-white mt-6 mb-3">Free Channels</h3>
      <p className="text-slate-400 text-sm mb-3">Available on all plans — no additional cost.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { name: 'ntfy', desc: 'Self-hosted or ntfy.sh' },
          { name: 'Discord', desc: 'Webhook notifications' },
          { name: 'Slack', desc: 'Webhook notifications' },
          { name: 'Telegram', desc: 'Bot messages' },
          { name: 'Gotify', desc: 'Self-hosted server' },
          { name: 'Pushover', desc: 'Mobile push' },
          { name: 'Matrix', desc: 'Decentralized chat' },
          { name: 'MS Teams', desc: 'Webhook notifications' },
        ].map((ch) => (
          <div key={ch.name} className="bg-[#111827] border border-[#1e3a5f] rounded-lg p-3">
            <p className="text-white font-medium text-sm">{ch.name}</p>
            <p className="text-slate-500 text-xs">{ch.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-medium text-white mt-6 mb-3">Billable Channels</h3>
      <p className="text-slate-400 text-sm mb-3">Require Pro or Unlimited plan — these use Notifiq infrastructure.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { name: 'Email', desc: 'Via Notifiq SMTP' },
          { name: 'SMS', desc: 'Carrier gateways' },
          { name: 'Twilio', desc: 'Your Twilio account' },
        ].map((ch) => (
          <div key={ch.name} className="bg-[#111827] border border-yellow-600/30 rounded-lg p-3">
            <p className="text-white font-medium text-sm">{ch.name}</p>
            <p className="text-slate-500 text-xs">{ch.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-xl p-4 my-6">
        <p className="text-[#00d4ff]">
          <strong>Tip:</strong> Start with <a href="https://ntfy.sh" className="underline">ntfy.sh</a> — 
          it's free, works on all devices, and takes 30 seconds to set up!
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">4. Create Your First Event</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Events are things you want to be notified about. Create one from any Notifiq app:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Open an app like <strong className="text-white">Mindful</strong> or <strong className="text-white">Event Planner</strong></li>
        <li>Create an event with a name and time</li>
        <li>You're automatically subscribed with default reminders</li>
        <li>Get notified on your channels when it's time!</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">5. Customize Your Reminders</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Each subscription can have personalized reminder times:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>1 week before</li>
        <li>1 day before</li>
        <li>1 hour before</li>
        <li>15 minutes before</li>
        <li>...or any custom time you need</li>
      </ul>

      <div className="bg-gradient-to-r from-[#00d4ff]/20 to-[#7c3aed]/20 border border-[#00d4ff]/30 rounded-xl p-6 my-8 text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Ready to get started?</h3>
        <p className="text-slate-300 mb-4">Join thousands of users who never miss important moments.</p>
        <Link
          to="/login"
          className="inline-flex items-center px-8 py-3 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90 transition-colors"
        >
          Create Free Account
        </Link>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/concepts" className="text-[#00d4ff] hover:underline">
            Core Concepts
          </Link>
          <span className="text-slate-400"> — Understand events, channels, and subscriptions</span>
        </li>
        <li>
          <Link to="/guide/channels" className="text-[#00d4ff] hover:underline">
            Channels Guide
          </Link>
          <span className="text-slate-400"> — Set up your notification services</span>
        </li>
        <li>
          <Link to="/apps" className="text-[#00d4ff] hover:underline">
            Browse Apps
          </Link>
          <span className="text-slate-400"> — Explore all available applications</span>
        </li>
        <li>
          <Link to="/guide/admin/installation" className="text-[#00d4ff] hover:underline">
            Self-Hosting
          </Link>
          <span className="text-slate-400"> — Run Notifiq on your own infrastructure</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
