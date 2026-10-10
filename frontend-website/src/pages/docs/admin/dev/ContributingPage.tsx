import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function ContributingPage() {
  return (
    <DocsLayout
      title="Contributing"
      description="How to contribute to Notifiq development."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Getting Started</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq is open source under the O'Saasy license. Contributions are welcome!
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Clone the Repository</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">git clone https://github.com/pypeaday/notifiq</code>
        <br />
        <code className="text-[#00d4ff]">cd notifiq</code>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Backend Setup</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">cd backend</code>
        <br />
        <code className="text-[#00d4ff]">uv venv && source .venv/bin/activate</code>
        <br />
        <code className="text-[#00d4ff]">uv pip install -e ".[dev]"</code>
        <br />
        <code className="text-[#00d4ff]">uv run ruff check --fix</code>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Frontend Setup</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">cd frontend-website</code>
        <br />
        <code className="text-[#00d4ff]">npm install</code>
        <br />
        <code className="text-[#00d4ff]">npm run dev</code>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Start Temporal</h3>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-[#00d4ff]">docker compose up -d temporal</code>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Project Structure</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`notifiq/
├── backend/
│   └── src/
│       ├── api/           # FastAPI routes
│       ├── db/            # SQLAlchemy models
│       ├── workflows/     # Temporal workflows
│       ├── activities/    # Temporal activities
│       └── worker/        # Temporal worker
├── frontend-website/      # Main website + docs
├── frontend-*/            # App frontends
├── notifiq-cli/           # Python CLI/client
└── docker-compose.yml`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Development Guidelines</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Code Style</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Python: Use <code className="text-[#00d4ff]">ruff</code> for linting</li>
        <li>TypeScript: Use ESLint + Prettier</li>
        <li>Keep changes small (&lt;50 lines when possible)</li>
        <li>Async everything in Python</li>
        <li>Use environment variables for configuration</li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Database</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>SQLite for development, PostgreSQL for production</li>
        <li>No migrations during development (DB is recreated)</li>
        <li>Use SQLAlchemy async with <code className="text-[#00d4ff]">AsyncSession</code></li>
      </ul>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Temporal</h3>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Workflows in <code className="text-[#00d4ff]">src/workflows/</code></li>
        <li>Activities in <code className="text-[#00d4ff]">src/activities/</code></li>
        <li>Use <code className="text-[#00d4ff]">workflow.unsafe.imports_passed_through()</code> for activity imports</li>
        <li>Keep activities idempotent</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Running Tests</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm">
        <code className="text-slate-400"># Backend tests</code>
        <br />
        <code className="text-[#00d4ff]">cd backend && pytest</code>
        <br /><br />
        <code className="text-slate-400"># Frontend tests</code>
        <br />
        <code className="text-[#00d4ff]">cd frontend-website && npm test</code>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Submitting Changes</h2>
      <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-6">
        <li>Fork the repository</li>
        <li>Create a feature branch</li>
        <li>Make your changes</li>
        <li>Run linting: <code className="text-[#00d4ff]">uv run ruff check --fix</code></li>
        <li>Run tests</li>
        <li>Submit a pull request</li>
      </ol>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">License</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq is licensed under the <strong className="text-white">O'Saasy License</strong> — 
        essentially MIT but with SaaS competition rights reserved. You can self-host, modify, 
        and build apps on top, but you can't offer it as a competing hosted service.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/architecture" className="text-[#00d4ff] hover:underline">
            Architecture
          </Link>
          <span className="text-slate-400"> — Understand the system design</span>
        </li>
        <li>
          <Link to="/guide/admin/dev/apps" className="text-[#00d4ff] hover:underline">
            Building Apps
          </Link>
          <span className="text-slate-400"> — Build on top of Notifiq</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
