import { DocsLayout } from './DocsLayout';
import { Link } from 'react-router-dom';

export function ChannelsPage() {
  return (
    <DocsLayout
      title="Channels"
      description="Configure where your notifications get delivered."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        A <strong className="text-white">Channel</strong> is a notification endpoint—where notifications 
        get delivered. Notifiq supports 70+ services through Apprise.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Supported Services</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Email</h3>
          <p className="text-slate-400 text-sm">Gmail, Outlook, any SMTP server</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">SMS</h3>
          <p className="text-slate-400 text-sm">Twilio, Vonage, and more</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Chat</h3>
          <p className="text-slate-400 text-sm">Discord, Slack, Telegram, Matrix, Mattermost</p>
        </div>
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Push</h3>
          <p className="text-slate-400 text-sm">Gotify, ntfy, Pushover, Pushbullet</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Channel URL Format</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Channels use Apprise URL format:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Service</th>
              <th className="text-left py-3 px-4 text-slate-300">URL Format</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">ntfy</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">ntfy://topic</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Discord</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">discord://WebhookID/WebhookToken</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Slack</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">slack://TokenA/TokenB/TokenC/#channel</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Gotify</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">gotify://hostname/token</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Email</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">mailto://user:pass@gmail.com</code></td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Telegram</td>
              <td className="py-3 px-4"><code className="text-[#00d4ff]">tgram://BotToken/ChatID</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Channel Tags</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Tags organize your channels and enable smart routing:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        {`// Regular tags for manual selection
{ "name": "Work Slack", "tag": "work" }
{ "name": "Personal Email", "tag": "personal" }
{ "name": "Urgent SMS", "tag": "urgent" }

// Auto-subscription tags
{ "name": "All Incidents", "tag": "autosub:incident" }
{ "name": "Critical Only", "tag": "autosub:critical" }`}
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Auto-Subscription</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Tags prefixed with <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:</code> 
        automatically subscribe you to matching events:
      </p>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Create a channel with tag <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">autosub:deploy</code></li>
        <li>When any event is created with the <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">deploy</code> tag...</li>
        <li>You're automatically subscribed and will receive notifications!</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Security</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Channel credentials (Apprise URLs) are:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Encrypted at rest</strong> using Fernet encryption</li>
        <li><strong className="text-white">Never exposed</strong> in API responses</li>
        <li><strong className="text-white">Only decrypted</strong> when sending notifications</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/subscriptions" className="text-[#00d4ff] hover:underline">
            Subscriptions
          </Link>
          <span className="text-slate-400"> — Connect channels to events</span>
        </li>
        <li>
          <Link to="/guide/organizations" className="text-[#00d4ff] hover:underline">
            Organizations
          </Link>
          <span className="text-slate-400"> — Shared team channels</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
