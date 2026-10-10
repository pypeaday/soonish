import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function InstallationPage() {
  return (
    <DocsLayout
      title="Installation"
      description="Step-by-step guide to deploying Notifiq on your infrastructure."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Docker Compose (Recommended)</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The easiest way to run Notifiq is with Docker Compose.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">1. Clone the Repository</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">git clone https://github.com/pypeaday/notifiq</code>
        <br />
        <code className="text-[#00d4ff]">cd notifiq</code>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">2. Configure Environment</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Copy the example environment file and customize:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">cp .env.example .env</code>
        <br />
        <code className="text-slate-400"># Edit .env with your settings</code>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">3. Start Services</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">docker compose up -d</code>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        This starts all services: API, Temporal server, and worker.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">4. Verify Installation</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">curl http://localhost:8000/api/v1/health</code>
      </div>
      <p className="text-slate-300 leading-relaxed">
        You should see <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">{`{"status": "healthy"}`}</code>
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Services</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Service</th>
              <th className="text-left py-3 px-4 text-slate-300">Port</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">API</td>
              <td className="py-3 px-4">8000</td>
              <td className="py-3 px-4">FastAPI backend + frontend</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Temporal</td>
              <td className="py-3 px-4">7233</td>
              <td className="py-3 px-4">Workflow orchestration</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">Temporal UI</td>
              <td className="py-3 px-4">8080</td>
              <td className="py-3 px-4">Workflow monitoring dashboard</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Production Deployment</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        For production, you should:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Use a reverse proxy (Traefik, Nginx, Caddy) with HTTPS</li>
        <li>Set strong <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">SECRET_KEY</code> and <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">ENCRYPTION_KEY</code></li>
        <li>Use PostgreSQL instead of SQLite for better concurrency</li>
        <li>Configure proper backup for your database</li>
        <li>Set up monitoring and alerting</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/configuration" className="text-[#00d4ff] hover:underline">
            Configuration
          </Link>
          <span className="text-slate-400"> — Environment variables reference</span>
        </li>
        <li>
          <Link to="/guide/admin/upgrading" className="text-[#00d4ff] hover:underline">
            Upgrading
          </Link>
          <span className="text-slate-400"> — How to update to new versions</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
