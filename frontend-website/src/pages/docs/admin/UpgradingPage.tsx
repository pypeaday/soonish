import { DocsLayout } from '../DocsLayout';
import { Link } from 'react-router-dom';

export function UpgradingPage() {
  return (
    <DocsLayout
      title="Upgrading"
      description="How to update your Notifiq installation to new versions."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Before Upgrading</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Check the <a href="https://github.com/pypeaday/notifiq/releases" className="text-[#00d4ff] hover:underline">release notes</a> for breaking changes</li>
        <li>Backup your database</li>
        <li>Test in a staging environment if possible</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Docker Compose</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-slate-400"># Pull latest images</code>
        <br />
        <code className="text-[#00d4ff]">docker compose pull</code>
        <br /><br />
        <code className="text-slate-400"># Restart with new images</code>
        <br />
        <code className="text-[#00d4ff]">docker compose up -d</code>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Database Migrations</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq currently uses SQLite with automatic schema creation. During development, 
        the database is recreated on startup. For production PostgreSQL deployments, 
        migrations will be handled automatically in future versions.
      </p>

      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 my-6">
        <p className="text-yellow-200">
          <strong>Note:</strong> During the beta period, database schema may change between versions. 
          Always backup your data before upgrading.
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Temporal Workflows</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Running workflows will continue executing during upgrades. Temporal handles workflow 
        versioning automatically. New workflow definitions will apply to new workflows only.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Rollback</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        To rollback to a previous version:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-slate-400"># Stop current version</code>
        <br />
        <code className="text-[#00d4ff]">docker compose down</code>
        <br /><br />
        <code className="text-slate-400"># Restore database backup</code>
        <br />
        <code className="text-[#00d4ff]">cp backup/notifiq.db ./notifiq.db</code>
        <br /><br />
        <code className="text-slate-400"># Start previous version</code>
        <br />
        <code className="text-[#00d4ff]">docker compose up -d</code>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/configuration" className="text-[#00d4ff] hover:underline">
            Configuration
          </Link>
          <span className="text-slate-400"> — Review configuration options</span>
        </li>
        <li>
          <Link to="/guide/admin/architecture" className="text-[#00d4ff] hover:underline">
            Architecture
          </Link>
          <span className="text-slate-400"> — Understand system components</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
