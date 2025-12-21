import { useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  Users, 
  User, 
  Brain, 
  Sparkles, 
  Code, 
  AlertTriangle,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

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
  {
    id: 'adhd-reminders',
    name: 'ADHD Reminders',
    description: 'Quick-add notes with time presets. Perfect for capturing thoughts before they disappear.',
    icon: <Brain className="w-6 h-6" />,
    path: '/adhd-reminders',
    color: '#a78bfa',
    category: 'Productivity',
  },
  {
    id: 'my-events',
    name: 'Personal Tracker',
    description: 'Recurring reminders for daily life. Appointments, medications, habits.',
    icon: <User className="w-6 h-6" />,
    path: '/my-events',
    color: '#00d4ff',
    category: 'Personal',
  },
  {
    id: 'event-planner',
    name: 'Event Planner',
    description: 'Corporate events with stakeholder updates. Multi-day conferences, team offsites.',
    icon: <Calendar className="w-6 h-6" />,
    path: '/event-planner',
    color: '#10b981',
    category: 'Events',
  },
  {
    id: 'volunteer-coordinator',
    name: 'Volunteer Coordinator',
    description: 'Role-based scheduling for community events. Churches, nonprofits, clubs.',
    icon: <Users className="w-6 h-6" />,
    path: '/volunteer-coordinator',
    color: '#f59e0b',
    category: 'Community',
  },
  {
    id: 'stage-manager',
    name: 'Stage Manager',
    description: 'Theater production coordination. Auto-subscribe parents to rehearsals, setup calls, and more.',
    icon: <Users className="w-6 h-6" />,
    path: '/stage-manager',
    color: '#ec4899',
    category: 'Theater',
  },
  {
    id: 'duty-pager',
    name: 'Duty Pager',
    description: 'Incident feed with runbooks and on-call roles. For IT and DevOps teams.',
    icon: <AlertTriangle className="w-6 h-6" />,
    path: '/duty-pager',
    color: '#ef4444',
    category: 'IT Ops',
  },
  {
    id: 'developer-user',
    name: 'Developer Dashboard',
    description: 'Single-user incidents with API tokens. For solo developers and side projects.',
    icon: <Code className="w-6 h-6" />,
    path: '/developer-user',
    color: '#7c3aed',
    category: 'Developer',
  },
  {
    id: 'mindful',
    name: 'Mindful',
    description: 'Visual timers for focus sessions. Pomodoro, meditation, deep work.',
    icon: <Sparkles className="w-6 h-6" />,
    path: '/mindful',
    color: '#10b981',
    category: 'Focus',
  },
];

export function AppPickerPage() {
  const { user, logout } = useAuth();

  // Check for preferred app and redirect
  useEffect(() => {
    const preferredApp = apiClient.getPreferredApp();
    if (preferredApp) {
      const app = apps.find(a => a.id === preferredApp);
      if (app) {
        window.location.href = app.path;
      }
    }
  }, []);

  const handleAppSelect = (app: AppCard) => {
    apiClient.setPreferredApp(app.id);
    window.location.href = app.path;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen stars">
      {/* Header */}
      <header className="border-b border-[#1e3a5f] bg-[#0a0e17]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#00d4ff] flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Notifiq</h1>
              <p className="text-xs text-[#64748b]">Choose your app</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-[#64748b]">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-[#94a3b8] hover:text-[#ef4444] transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">
            Welcome, {user?.name?.split(' ')[0] || 'there'}!
          </h2>
          <p className="text-[#94a3b8] text-lg">
            What would you like to use Notifiq for?
          </p>
        </div>

        {/* App Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => handleAppSelect(app)}
              className="group text-left bg-[#111827] border border-[#1e3a5f] rounded-2xl p-6 card-hover hover:border-opacity-50 transition-all"
              style={{ '--hover-color': app.color } as React.CSSProperties}
            >
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${app.color}20`, color: app.color }}
                >
                  {app.icon}
                </div>
                <span 
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: `${app.color}15`, color: app.color }}
                >
                  {app.category}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#00d4ff] transition-colors">
                {app.name}
              </h3>
              <p className="text-sm text-[#94a3b8] mb-4 leading-relaxed">
                {app.description}
              </p>
              
              <div className="flex items-center text-sm font-medium text-[#64748b] group-hover:text-[#00d4ff] transition-colors">
                Open app
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-[#64748b]">
            Your account works across all apps. You can switch anytime.
          </p>
          <a 
            href="/guide" 
            className="inline-block text-sm text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors"
          >
            Read the documentation →
          </a>
        </div>
      </main>
    </div>
  );
}
