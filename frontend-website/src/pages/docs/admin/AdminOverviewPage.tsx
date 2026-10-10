import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function AdminOverviewPage() {
  return (
    <DocsLayout
      title="Self-Hosting Notifiq"
      description="Run Notifiq on your own infrastructure with full control over your data."
    >
      <p className="text-slate-300 leading-relaxed mb-6">
        Notifiq is designed to be self-hosted. Run it on your homelab, your cloud, or anywhere 
        Docker runs. This section covers installation, configuration, and administration.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Why Self-Host?</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Data ownership</strong> — Your notification data stays on your infrastructure</li>
        <li><strong className="text-white">No vendor lock-in</strong> — Open source, O'Saasy licensed</li>
        <li><strong className="text-white">Customization</strong> — Build your own apps on the API</li>
        <li><strong className="text-white">Cost control</strong> — No per-notification pricing</li>
        <li><strong className="text-white">Privacy</strong> — Channel credentials never leave your server</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Requirements</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Component</th>
              <th className="text-left py-3 px-4 text-slate-300">Requirement</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Docker</td>
              <td className="py-3 px-4">20.10+ with Compose v2</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Memory</td>
              <td className="py-3 px-4">2GB minimum, 4GB recommended</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Storage</td>
              <td className="py-3 px-4">1GB for application, plus database</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Network</td>
              <td className="py-3 px-4">Outbound access for notifications</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Architecture Overview</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 my-6 font-mono text-sm">
        <pre className="text-slate-300 overflow-x-auto">{`┌─────────────────────────────────────────────────────────┐
│                     Reverse Proxy                        │
│                   (Traefik/Nginx)                        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                       │
│              (API + Static Frontend)                     │
└─────────────────────────────────────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│   SQLite/Postgres   │     │      Temporal Server        │
│     (Database)      │     │   (Workflow Orchestration)  │
└─────────────────────┘     └─────────────────────────────┘
                                          │
                                          ▼
                            ┌─────────────────────────────┐
                            │      Temporal Worker        │
                            │  (Executes Notifications)   │
                            └─────────────────────────────┘`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Quick Start</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">git clone https://github.com/pypeaday/notifiq</code>
        <br />
        <code className="text-[#00d4ff]">cd notifiq</code>
        <br />
        <code className="text-[#00d4ff]">docker compose up -d</code>
      </div>
      <p className="text-slate-300 leading-relaxed">
        That's it! Open <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">http://localhost:8000</code> to get started.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/installation" className="text-[#00d4ff] hover:underline">
            Installation
          </Link>
          <span className="text-slate-400"> — Detailed setup instructions</span>
        </li>
        <li>
          <Link to="/guide/admin/configuration" className="text-[#00d4ff] hover:underline">
            Configuration
          </Link>
          <span className="text-slate-400"> — Environment variables and settings</span>
        </li>
        <li>
          <Link to="/guide/admin/architecture" className="text-[#00d4ff] hover:underline">
            Architecture
          </Link>
          <span className="text-slate-400"> — Deep dive into system design</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
