import { Link, NavLink } from 'react-router-dom';
import { LogOut, Target , Home} from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

const links = [
  { to: '/', label: 'Matrix' },
  { to: '/guide', label: 'Guide' },
  { to: '/settings', label: 'Settings' },
];

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-q2-500 to-q2-700 flex items-center justify-center shadow-glow-q2 shrink-0">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white leading-tight">Eisenhower Tasks</h1>
              <p className="text-xs text-surface-500 truncate flex items-center gap-1.5">
                {user?.name || user?.email}
                {user?.is_admin && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-400">
                    Admin
                  </span>
                )}
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'btn-ghost px-3 py-2 rounded-lg text-sm hidden sm:inline-block',
                    isActive && 'bg-surface-800 text-white'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            {children}
            <a
              href="/"
              className="btn-ghost p-2 rounded-lg text-surface-400 hover:text-surface-200"
              title="Back to Notifiq"
            >
              <Home className="w-5 h-5" />
            </a>
            <button
              onClick={logout}
              className="btn-ghost p-2 rounded-lg text-surface-400 hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
