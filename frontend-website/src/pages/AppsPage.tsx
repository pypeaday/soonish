import { Layout } from '@/components/Layout';
import { 
  AlertTriangle, 
  Code, 
  Calendar, 
  Users, 
  User, 
  Brain, 
  Sparkles,
  BarChart3,
  Film
} from 'lucide-react';

interface AppCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  category: string;
}

const apps: AppCard[] = [
  // IT & DevOps
  {
    id: 'duty-pager',
    name: 'Duty Pager',
    description: 'PagerDuty-style incident management. Track incidents, attach runbooks, manage on-call rotations.',
    icon: <AlertTriangle className="w-6 h-6" />,
    path: '/duty-pager',
    color: '#ef4444',
    category: 'IT & DevOps',
  },
  {
    id: 'developer-user',
    name: 'Developer Dashboard',
    description: 'Single-user incident tracking with API tokens. Perfect for solo developers and side projects.',
    icon: <Code className="w-6 h-6" />,
    path: '/developer-user',
    color: '#7c3aed',
    category: 'IT & DevOps',
  },
  {
    id: 'mission-control',
    name: 'Mission Control',
    description: 'System administration dashboard. Manage users, view metrics, configure the platform.',
    icon: <BarChart3 className="w-6 h-6" />,
    path: '/mission-control',
    color: '#00d4ff',
    category: 'IT & DevOps',
  },
  // Events & Community
  {
    id: 'event-planner',
    name: 'Event Planner',
    description: 'Facebook Events-style planning. Create public events, manage RSVPs, send updates to attendees.',
    icon: <Calendar className="w-6 h-6" />,
    path: '/event-planner',
    color: '#10b981',
    category: 'Events & Community',
  },
  {
    id: 'volunteer-coordinator',
    name: 'Volunteer Coordinator',
    description: 'Role-based volunteer scheduling for churches, nonprofits, and community organizations.',
    icon: <Users className="w-6 h-6" />,
    path: '/volunteer-coordinator',
    color: '#f59e0b',
    category: 'Events & Community',
  },
  {
    id: 'stage-manager',
    name: 'Stage Manager',
    description: 'Theater production coordination. Parents auto-subscribe to rehearsals, setup calls, and performances.',
    icon: <Film className="w-6 h-6" />,
    path: '/stage-manager',
    color: '#ec4899',
    category: 'Events & Community',
  },
  // Personal & Productivity
  {
    id: 'my-events',
    name: 'Personal Tracker',
    description: 'Recurring reminders for daily life. Appointments, medications, habits, and personal events.',
    icon: <User className="w-6 h-6" />,
    path: '/my-events',
    color: '#00d4ff',
    category: 'Personal & Productivity',
  },
  {
    id: 'adhd-reminders',
    name: 'ADHD Reminders',
    description: 'Quick-add notes with time presets. Capture thoughts before they disappear.',
    icon: <Brain className="w-6 h-6" />,
    path: '/adhd-reminders',
    color: '#a78bfa',
    category: 'Personal & Productivity',
  },
  {
    id: 'mindful',
    name: 'Mindful',
    description: 'Visual timers for focus sessions. Pomodoro, meditation, and deep work templates.',
    icon: <Sparkles className="w-6 h-6" />,
    path: '/mindful',
    color: '#10b981',
    category: 'Personal & Productivity',
  },
];

const categories = ['IT & DevOps', 'Events & Community', 'Personal & Productivity'];

export function AppsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 px-4 hero-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Apps built on <span className="text-[#00d4ff] text-glow">Notifiq</span>
          </h1>
          <p className="text-xl text-slate-400 mb-6">
            Different interfaces for different needs. Same powerful notification backend.
          </p>
          <p className="text-slate-500">
            <a href="/login" className="text-[#00d4ff] hover:underline">Log in</a> to access your apps, or explore what's available below.
          </p>
        </div>
      </section>

      {/* Apps Grid */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          {categories.map((category) => (
            <div key={category} className="mb-12">
              <h2 className="text-sm uppercase tracking-widest text-[#a78bfa] mb-6">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {apps
                  .filter((app) => app.category === category)
                  .map((app) => (
                    <a
                      key={app.id}
                      href={app.path}
                      className="group block rounded-xl border border-[#1e3a5f] bg-[#111827] p-6 card-hover"
                      style={{ '--hover-border-color': `${app.color}50` } as React.CSSProperties}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${app.color}15`, color: app.color }}
                      >
                        {app.icon}
                      </div>
                      <h3
                        className="text-lg font-semibold text-white mb-2 transition-colors group-hover:text-[var(--app-color)]"
                        style={{ '--app-color': app.color } as React.CSSProperties}
                      >
                        {app.name}
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed">{app.description}</p>
                    </a>
                  ))}
              </div>
            </div>
          ))}

          {/* CTA */}
          <div className="text-center py-12 border-t border-[#1e3a5f]">
            <h3 className="text-2xl font-semibold text-white mb-4">Ready to get started?</h3>
            <p className="text-slate-400 mb-6">Create an account and start using any of these apps in minutes.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/login"
                className="px-8 py-3 bg-gradient-to-r from-[#7c3aed] to-[#00d4ff] hover:from-[#8b5cf6] hover:to-[#22d3ee] text-white font-medium rounded-lg transition-all"
              >
                Get Started Free
              </a>
              <a
                href="/guide"
                className="px-8 py-3 border border-[#1e3a5f] text-slate-300 hover:bg-[#1e3a5f]/30 hover:border-[#00d4ff]/50 rounded-lg transition-all"
              >
                Read the Docs
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
