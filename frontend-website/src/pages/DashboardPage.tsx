import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  LogOut,
  Radio,
  Calendar,
  CreditCard,
  BarChart3,
  Settings,
  ExternalLink,
  Plus,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, type ChannelResponse, type EventResponse } from '@/lib/api';

const TIER_LIMITS: Record<string, { notifications: number; channels: number }> = {
  free: { notifications: 100, channels: 3 },
  pro: { notifications: 1000, channels: 10 },
  unlimited: { notifications: Infinity, channels: Infinity },
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.getChannels().catch(() => []),
      apiClient.getUpcomingEvents(5).catch(() => []),
    ]).then(([channelsData, eventsData]) => {
      setChannels(channelsData);
      setUpcomingEvents(eventsData);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const tier = user?.tier || 'free';
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const notificationsUsed = user?.total_notifications_this_month || 0;
  const notificationPercent = limits.notifications === Infinity 
    ? 0 
    : Math.min(100, (notificationsUsed / limits.notifications) * 100);

  return (
    <div className="min-h-screen stars">
      {/* Header */}
      <header className="border-b border-[#1e3a5f] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#00d4ff] flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Notifiq</h1>
              <p className="text-xs text-[#64748b]">Dashboard</p>
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h2>
          <p className="text-[#94a3b8]">Here's an overview of your Notifiq account.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Plan */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#7c3aed]/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#7c3aed]" />
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Current Plan</p>
                <p className="text-lg font-semibold text-white capitalize">{tier}</p>
              </div>
            </div>
            {tier === 'free' && (
              <Link 
                to="/billing" 
                className="text-xs text-[#00d4ff] hover:underline"
              >
                Upgrade to Pro →
              </Link>
            )}
          </div>

          {/* Notifications */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Notifications This Month</p>
                <p className="text-lg font-semibold text-white">
                  {notificationsUsed.toLocaleString()}
                  {limits.notifications !== Infinity && (
                    <span className="text-[#64748b] text-sm font-normal"> / {limits.notifications.toLocaleString()}</span>
                  )}
                </p>
              </div>
            </div>
            {limits.notifications !== Infinity && (
              <div className="w-full h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00d4ff] rounded-full transition-all"
                  style={{ width: `${notificationPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#10b981]" />
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Channels</p>
                <p className="text-lg font-semibold text-white">
                  {channels.length}
                  {limits.channels !== Infinity && (
                    <span className="text-[#64748b] text-sm font-normal"> / {limits.channels}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#64748b]">
              {channels.filter(c => c.is_active).length} active
            </p>
          </div>

          {/* Upcoming Events */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#f59e0b]" />
              </div>
              <div>
                <p className="text-xs text-[#64748b]">Upcoming Events</p>
                <p className="text-lg font-semibold text-white">{upcomingEvents.length}</p>
              </div>
            </div>
            <p className="text-xs text-[#64748b]">Next 7 days</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Channels */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#10b981]" />
                Your Channels
              </h3>
              <button className="text-xs text-[#00d4ff] hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Channel
              </button>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00d4ff] mx-auto" />
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-8">
                  <Radio className="w-8 h-8 text-[#64748b] mx-auto mb-2" />
                  <p className="text-[#94a3b8] text-sm">No channels configured</p>
                  <p className="text-[#64748b] text-xs mt-1">Add a channel to receive notifications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.slice(0, 5).map((channel) => (
                    <div 
                      key={channel.id}
                      className="flex items-center justify-between p-3 bg-[#0a0e17] rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{channel.name}</p>
                        <p className="text-xs text-[#64748b]">
                          {channel.channel_type || 'custom'} 
                          {channel.tag && <span className="ml-2">• {channel.tag}</span>}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        channel.is_active 
                          ? 'bg-[#10b981]/20 text-[#10b981]' 
                          : 'bg-[#64748b]/20 text-[#64748b]'
                      }`}>
                        {channel.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                  {channels.length > 5 && (
                    <p className="text-xs text-[#64748b] text-center pt-2">
                      +{channels.length - 5} more channels
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Apps */}
          <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#7c3aed]" />
                Quick Actions
              </h3>
            </div>
            <div className="p-5 space-y-2">
              <Link 
                to="/dashboard/apps"
                className="flex items-center justify-between p-3 bg-[#0a0e17] rounded-lg hover:bg-[#1e3a5f]/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                    <ExternalLink className="w-4 h-4 text-[#00d4ff]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Open Apps</p>
                    <p className="text-xs text-[#64748b]">Launch a Notifiq app</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#00d4ff] transition-colors" />
              </Link>

              <Link 
                to="/guide"
                className="flex items-center justify-between p-3 bg-[#0a0e17] rounded-lg hover:bg-[#1e3a5f]/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#7c3aed]/20 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-[#7c3aed]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Documentation</p>
                    <p className="text-xs text-[#64748b]">Learn how to use Notifiq</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#00d4ff] transition-colors" />
              </Link>

              <Link 
                to="/guide/channels"
                className="flex items-center justify-between p-3 bg-[#0a0e17] rounded-lg hover:bg-[#1e3a5f]/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-[#10b981]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Channel Setup Guide</p>
                    <p className="text-xs text-[#64748b]">Configure notification channels</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#00d4ff] transition-colors" />
              </Link>

              {tier === 'free' && (
                <Link 
                  to="/billing"
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-[#7c3aed]/20 to-[#00d4ff]/20 rounded-lg hover:from-[#7c3aed]/30 hover:to-[#00d4ff]/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-[#00d4ff]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Upgrade to Pro</p>
                      <p className="text-xs text-[#64748b]">Unlock more channels & notifications</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-[#00d4ff] transition-colors" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mt-6 bg-[#111827] border border-[#1e3a5f] rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#f59e0b]" />
                Upcoming Events
              </h3>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-[#0a0e17] rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{event.name}</p>
                      <p className="text-xs text-[#64748b]">
                        {new Date(event.start_date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e3a5f] text-[#94a3b8]">
                      {event.source}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
