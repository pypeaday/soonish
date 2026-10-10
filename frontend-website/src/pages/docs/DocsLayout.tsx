import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface DocsLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

const customerSidebar = [
  {
    label: 'Getting Started',
    items: [
      { label: 'Introduction', path: '/guide' },
      { label: 'Quick Start', path: '/guide/quickstart' },
      { label: 'Core Concepts', path: '/guide/concepts' },
    ],
  },
  {
    label: 'Using Notifiq',
    items: [
      { label: 'Events', path: '/guide/events' },
      { label: 'Channels', path: '/guide/channels' },
      { label: 'Subscriptions', path: '/guide/subscriptions' },
      { label: 'Roles & Assignments', path: '/guide/roles' },
      { label: 'Organizations', path: '/guide/organizations' },
    ],
  },
  {
    label: 'App Guides',
    items: [
      { label: 'IT Team Alerts', path: '/guide/apps/it-alerts' },
      { label: 'Theater Volunteer', path: '/guide/apps/theater' },
      { label: 'Volunteer Coordinator', path: '/guide/apps/volunteer' },
      { label: 'Event Planner', path: '/guide/apps/events' },
      { label: 'Mind (ADHD)', path: '/guide/apps/mind' },
    ],
  },
  {
    label: 'For Developers',
    items: [
      { label: 'Authentication', path: '/guide/api/auth' },
      { label: 'Events API', path: '/guide/api/events' },
      { label: 'Channels API', path: '/guide/api/channels' },
      { label: 'Subscriptions API', path: '/guide/api/subscriptions' },
      { label: 'Building Apps', path: '/guide/dev/apps' },
    ],
  },
];

const adminSidebar = [
  {
    label: 'Self-Hosting',
    items: [
      { label: 'Overview', path: '/guide/admin' },
      { label: 'Installation', path: '/guide/admin/installation' },
      { label: 'Configuration', path: '/guide/admin/configuration' },
      { label: 'Upgrading', path: '/guide/admin/upgrading' },
    ],
  },
  {
    label: 'Architecture',
    items: [
      { label: 'System Overview', path: '/guide/admin/architecture' },
      { label: 'Temporal Workflows', path: '/guide/admin/temporal' },
      { label: 'Database Schema', path: '/guide/admin/database' },
    ],
  },
  {
    label: 'Contributing',
    items: [
      { label: 'Contributing Guide', path: '/guide/admin/contributing' },
    ],
  },
];

interface SidebarSection {
  label: string;
  items: { label: string; path: string }[];
}

export function DocsLayout({ children, title, description }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  
  // Determine which sidebar to show based on current path
  const isAdminDocs = location.pathname.startsWith('/guide/admin');
  const sidebar: SidebarSection[] = isAdminDocs ? adminSidebar : customerSidebar;

  return (
    <div className="min-h-screen flex flex-col stars">
      {/* Header */}
      <header className="border-b border-[#1e3a5f] bg-[#0a0e17]/90 backdrop-blur-md py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-400 hover:text-[#00d4ff]"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to="/" className="text-xl font-semibold text-[#00d4ff] flex items-center gap-2 text-glow">
              <Bell className="w-6 h-6" />
              Notifiq
            </Link>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 text-sm">Docs</span>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/guide/quickstart" className="text-sm font-medium text-[#00d4ff] transition-colors">
              Getting Started
            </Link>
            <Link to="/" className="text-sm text-slate-400 hover:text-[#00d4ff] transition-colors">
              Home
            </Link>
            <Link to="/apps" className="text-sm text-slate-400 hover:text-[#00d4ff] transition-colors">
              Apps
            </Link>
            <a href="#self-host" className="text-sm text-slate-400 hover:text-[#00d4ff] transition-colors">
              Self-Host
            </a>
            <a
              href="https://github.com/pypeaday/notifiq"
              className="text-sm text-slate-400 hover:text-[#00d4ff] transition-colors"
            >
              GitHub
            </a>
            <Link
              to="/login"
              className="text-sm border border-[#7c3aed] text-[#a78bfa] hover:bg-[#7c3aed]/20 px-4 py-2 rounded-lg transition-colors"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-grow flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0a0e17] border-r border-[#1e3a5f]
            transform transition-transform lg:transform-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            pt-20 lg:pt-6 overflow-y-auto
          `}
        >
          <nav className="px-4 pb-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-[#a78bfa] hover:text-[#00d4ff] text-sm mb-4 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Notifiq
            </Link>

            {/* Docs section toggle */}
            <div className="flex rounded-lg bg-[#111827] border border-[#1e3a5f] p-1 mb-6">
              <Link
                to="/guide"
                className={`flex-1 text-center text-xs py-2 px-3 rounded-md transition-colors ${
                  !isAdminDocs
                    ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                User Guide
              </Link>
              <Link
                to="/guide/admin"
                className={`flex-1 text-center text-xs py-2 px-3 rounded-md transition-colors ${
                  isAdminDocs
                    ? 'bg-[#7c3aed]/20 text-[#a78bfa]'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Self-Host
              </Link>
            </div>

            {sidebar.map((section) => (
              <div key={section.label} className="mb-6">
                <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">{section.label}</h3>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          block px-3 py-2 rounded-lg text-sm transition-colors
                          ${location.pathname === item.path
                            ? 'bg-[#00d4ff]/10 text-[#00d4ff] border-l-2 border-[#00d4ff]'
                            : 'text-slate-400 hover:text-[#00d4ff] hover:bg-[#1e3a5f]/30'
                          }
                        `}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-grow px-4 py-8 lg:px-8 max-w-4xl">
          <article className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
            {description && <p className="text-lg text-slate-400 mb-8">{description}</p>}
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
