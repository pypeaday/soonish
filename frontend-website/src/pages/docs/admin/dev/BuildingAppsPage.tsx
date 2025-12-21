import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function BuildingAppsPage() {
  return (
    <DocsLayout
      title="Building Apps"
      description="How to build custom applications on top of Notifiq."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq is designed as a platform. You can build custom applications that use 
        Notifiq for event management and notifications while providing domain-specific UIs.
      </p>
      <p className="text-slate-300 leading-relaxed mb-4">
        There are two main approaches to building apps on Notifiq:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">Standalone Frontend</strong> — Run your frontend on its own server, call the API over HTTP (recommended for most users)</li>
        <li><strong className="text-white">Mounted SPA</strong> — Build and mount to the FastAPI backend (only for developers with backend access)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Example Apps</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        The Notifiq repository includes several example applications:
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li><strong className="text-white">IT Team Alerts</strong> — On-call incident management</li>
        <li><strong className="text-white">Theater Volunteer</strong> — Show scheduling and volunteer coordination</li>
        <li><strong className="text-white">Event Planner</strong> — Personal event management</li>
        <li><strong className="text-white">Mind (ADHD)</strong> — Reminder-focused task management</li>
        <li><strong className="text-white">Volunteer Coordinator</strong> — Organization volunteer scheduling</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Architecture</h2>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`┌─────────────────────────────────────┐
│         Your Custom App             │
│    (React, Vue, Mobile, CLI)        │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Notifiq API                 │
│   /api/v1/events, channels, etc.   │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│    Temporal + Apprise               │
│   (Workflows + Notifications)       │
└─────────────────────────────────────┘`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Getting Started</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">1. Use the Source Field</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Set a unique <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">source</code> for 
        your app's events. This allows filtering and identification.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`{
  "name": "Server Alert",
  "source": "my-monitoring-app",
  "tags": ["infrastructure"],
  ...
}`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">2. Use Tags for Routing</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Tags enable automatic subscription and channel routing. Design a tag taxonomy for your app.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`# Example tag taxonomy for IT alerts
- "critical" → PagerDuty, phone calls
- "warning" → Slack, email
- "info" → Email only

# Example for theater app
- "tech-crew" → Tech volunteers
- "front-of-house" → FOH volunteers
- "all-hands" → Everyone`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">3. Use the Python Client</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        The <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">notifiq</code> Python 
        package provides a clean API for your scripts and services.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`from notifiq import NotifiqClient
from datetime import datetime, timedelta

client = NotifiqClient(
    base_url="http://localhost:8000",
    token="your-token"
)

# Create an event from your app
event = client.create_event(
    name="Deployment Started",
    start_date=datetime.now(),
    end_date=datetime.now() + timedelta(hours=1),
    tags=["deployment", "production"],
    source="my-ci-cd",
    content="Deploying v2.1.0 to production"
)

# Send a direct notification
client.notify("ops-channel", "Deploy Complete", body="v2.1.0 is live")`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">4. Build a Standalone Frontend</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        Create a React/Vue/etc. frontend that runs on its own dev server and calls the Notifiq API over HTTP.
        This is the recommended approach for most users.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`# 1. Create your frontend
npm create vite@latest my-notifiq-app -- --template react-ts

# 2. Configure API URL (.env)
VITE_API_BASE_URL=http://localhost:8000

# 3. Call the API with fetch
const response = await fetch(\`\${API_BASE_URL}/api/v1/events\`, {
  headers: {
    'Authorization': \`Bearer \${token}\`,
  },
})

# 4. Run independently
npm run dev  # Runs on port 5173`}</pre>
      </div>
      <p className="text-slate-300 leading-relaxed mb-4">
        <strong className="text-white">Key benefits:</strong>
      </p>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>No backend code changes required</li>
        <li>Faster development (no rebuild/mount cycle)</li>
        <li>Deploy anywhere (Netlify, Vercel, etc.)</li>
        <li>Works with hosted Notifiq instances</li>
      </ul>
      <p className="text-slate-300 leading-relaxed mb-4">
        See <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">frontend-standalone-example/</code> in 
        the repo for a complete working example.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">Alternative: Mounted SPA (Advanced)</h3>
      <p className="text-slate-300 leading-relaxed mb-4">
        If you have direct access to the backend code (forked repo), you can mount your built frontend 
        to the FastAPI server. This is only recommended for contributors or self-hosters modifying the backend.
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <pre>{`# Directory structure
frontend-my-app/
├── src/
│   ├── App.tsx
│   └── ...
├── package.json
└── vite.config.ts  # base: "/my-app"

# Build the frontend
npm run build

# Mount in backend/src/api/main.py
from src.api.utils import mount_spa
my_app_dir = project_root / "frontend-my-app" / "dist"
mount_spa(app, "/my-app", str(my_app_dir))`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Best Practices</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2 mb-6">
        <li>Use consistent <code className="text-[#00d4ff]">source</code> values for your app</li>
        <li>Design a clear tag taxonomy before building</li>
        <li>Use <code className="text-[#00d4ff]">notify_on_completion</code> for alarm-style events</li>
        <li>Store API tokens securely (environment variables)</li>
        <li>Handle rate limits gracefully (60 req/min default)</li>
      </ul>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/api/events" className="text-[#00d4ff] hover:underline">
            Events API
          </Link>
          <span className="text-slate-400"> — Full API reference</span>
        </li>
        <li>
          <Link to="/guide/api/auth" className="text-[#00d4ff] hover:underline">
            Authentication API
          </Link>
          <span className="text-slate-400"> — JWT authentication guide</span>
        </li>
        <li>
          <Link to="/guide/admin/dev/contributing" className="text-[#00d4ff] hover:underline">
            Contributing
          </Link>
          <span className="text-slate-400"> — Contribute to Notifiq</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
