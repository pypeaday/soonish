import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function ConfigurationPage() {
  return (
    <DocsLayout
      title="Configuration"
      description="Environment variables and settings for your Notifiq deployment."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Environment Variables</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Configure Notifiq using environment variables. All settings can be overridden via <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">.env</code> file or container environment.
      </p>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Security</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Variable</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
              <th className="text-left py-3 px-4 text-slate-300">Default</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">SECRET_KEY</code></td>
              <td className="py-3 px-4">JWT signing key (generate with <code>openssl rand -hex 32</code>)</td>
              <td className="py-3 px-4">Random</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">ENCRYPTION_KEY</code></td>
              <td className="py-3 px-4">Fernet key for channel credentials (generate with <code>python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"</code>)</td>
              <td className="py-3 px-4">Random</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">ACCESS_TOKEN_EXPIRE_MINUTES</code></td>
              <td className="py-3 px-4">JWT token expiration</td>
              <td className="py-3 px-4">10080 (7 days)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Database</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Variable</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
              <th className="text-left py-3 px-4 text-slate-300">Default</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">DATABASE_URL</code></td>
              <td className="py-3 px-4">SQLite or PostgreSQL connection string</td>
              <td className="py-3 px-4">sqlite:///./notifiq.db</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Temporal</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Variable</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
              <th className="text-left py-3 px-4 text-slate-300">Default</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">TEMPORAL_URL</code></td>
              <td className="py-3 px-4">Temporal server address</td>
              <td className="py-3 px-4">localhost:7233</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">TEMPORAL_NAMESPACE</code></td>
              <td className="py-3 px-4">Temporal namespace</td>
              <td className="py-3 px-4">default</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">TEMPORAL_TASK_QUEUE</code></td>
              <td className="py-3 px-4">Task queue name</td>
              <td className="py-3 px-4">notifiq-tasks</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-medium text-white mt-8 mb-3">Features</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Variable</th>
              <th className="text-left py-3 px-4 text-slate-300">Description</th>
              <th className="text-left py-3 px-4 text-slate-300">Default</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">REGISTRATION_ENABLED</code></td>
              <td className="py-3 px-4">Allow new user registration</td>
              <td className="py-3 px-4">true</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4"><code className="text-[#00d4ff]">DEFAULT_USER_TIER</code></td>
              <td className="py-3 px-4">Tier for new users (free, pro, unlimited)</td>
              <td className="py-3 px-4">free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example .env</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Security
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-fernet-key-here

# Database
DATABASE_URL=postgresql://user:pass@localhost/notifiq

# Temporal
TEMPORAL_URL=temporal:7233

# Features
REGISTRATION_ENABLED=true
DEFAULT_USER_TIER=free`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/upgrading" className="text-[#00d4ff] hover:underline">
            Upgrading
          </Link>
          <span className="text-slate-400"> — Update to new versions</span>
        </li>
        <li>
          <Link to="/guide/admin/architecture" className="text-[#00d4ff] hover:underline">
            Architecture
          </Link>
          <span className="text-slate-400"> — Understand the system design</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
