import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Palette, Info, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { useTheme, THEMES, type ThemeName } from '../contexts/ThemeContext';
import clsx from 'clsx';

export function SettingsPage() {
  const { user } = useAuth();
  const { themeName, setTheme } = useTheme();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('eisenhower_sound_enabled') !== 'false';
  });

  useEffect(() => {
    if ('Notification' in window) {
      const permission = Notification.permission;
      setNotificationPermission(permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const handleToggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('eisenhower_sound_enabled', String(newValue));
  };

  const tierDisplay = user?.tier ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1) : 'Unknown';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <AppHeader />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Account Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="card overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800 bg-surface-800/50">
            <User className="w-5 h-5 text-mind-400" />
            <h2 className="font-medium text-white">Account</h2>
          </div>
          <div className="divide-y divide-surface-800">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-surface-400">Email</span>
              <span className="text-white">{user?.email || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-surface-400">Name</span>
              <span className="text-white">{user?.name || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-surface-400">Tier</span>
              <span className={clsx(
                'px-2 py-0.5 rounded text-sm font-medium',
                user?.is_admin && 'bg-amber-500/20 text-amber-400',
                !user?.is_admin && user?.tier === 'enterprise' && 'bg-mind-500/20 text-mind-400',
                !user?.is_admin && user?.tier === 'pro' && 'bg-blue-500/20 text-blue-400',
                !user?.is_admin && (!user?.tier || user?.tier === 'free') && 'bg-surface-700 text-surface-400'
              )}>
                {user?.is_admin ? 'Admin' : tierDisplay}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800 bg-surface-800/50">
            <Bell className="w-5 h-5 text-mind-400" />
            <h2 className="font-medium text-white">Notifications</h2>
          </div>
          <div className="divide-y divide-surface-800">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-surface-400">Browser notifications</span>
                <p className="text-xs text-surface-600 mt-0.5">
                  Get notified about your tasks
                </p>
              </div>
              {notificationPermission === 'granted' ? (
                <span className="px-2 py-0.5 rounded text-sm bg-green-500/20 text-green-400">
                  Enabled
                </span>
              ) : notificationPermission === 'denied' ? (
                <span className="px-2 py-0.5 rounded text-sm bg-red-500/20 text-red-400">
                  Blocked
                </span>
              ) : (
                <button
                  onClick={handleRequestNotifications}
                  className="btn btn-secondary text-sm py-1.5"
                >
                  Enable
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-surface-400">Sound</span>
                <p className="text-xs text-surface-600 mt-0.5">
                  Play sound with notifications
                </p>
              </div>
              <button
                onClick={handleToggleSound}
                className={clsx(
                  'w-12 h-7 rounded-full transition-colors relative',
                  soundEnabled ? 'bg-mind-500' : 'bg-surface-700'
                )}
              >
                <div className={clsx(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                  soundEnabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Appearance Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800 bg-surface-800/50">
            <Palette className="w-5 h-5 text-mind-400" />
            <h2 className="font-medium text-white">Appearance</h2>
          </div>
          <div className="p-4">
            <label className="block text-sm text-surface-400 mb-3">Color Scheme</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as ThemeName)}
                  className={clsx(
                    'relative p-3 rounded-xl border text-left transition-all',
                    themeName === t.name
                      ? 'border-mind-500 bg-mind-500/10'
                      : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                  )}
                >
                  {/* Color preview */}
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.colors.accent }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.colors.bg }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.colors.bgTertiary }}
                    />
                  </div>
                  <div className={clsx(
                    'text-sm font-medium',
                    themeName === t.name ? 'text-white' : 'text-surface-300'
                  )}>
                    {t.label}
                  </div>
                  {themeName === t.name && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-mind-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800 bg-surface-800/50">
            <Info className="w-5 h-5 text-mind-400" />
            <h2 className="font-medium text-white">About</h2>
          </div>
          <div className="divide-y divide-surface-800">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-surface-400">Version</span>
              <span className="text-white">1.0.0</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-surface-400">Inspired by</span>
              <a 
                href="https://en.wikipedia.org/wiki/Time_management#The_Eisenhower_Method" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-mind-400 hover:underline inline-flex items-center gap-1"
              >
                Eisenhower Method <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-surface-500 text-sm">
            Keep it simple. Do the important work.
          </p>
          <p className="text-surface-600 text-xs mt-2">
            Powered by Notifiq
          </p>
        </div>
      </main>
    </div>
  );
}
