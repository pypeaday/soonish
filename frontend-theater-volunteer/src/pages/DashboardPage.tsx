import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Loader2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api-client'
import { formatDateTime, parseTags } from '../lib/utils'
import { PageHeading } from '../components/PageHeading'
import { TagBadge } from '../components/TagBadge'

const DashboardPage = () => {
  const { activeOrganization } = useAuth()

  const eventsQuery = useQuery({
    queryKey: ['events', 'org', activeOrganization?.id],
    queryFn: () => api.listOrganizationEvents(activeOrganization!.id),
    enabled: Boolean(activeOrganization),
  })

  const myEventsQuery = useQuery({
    queryKey: ['me', 'events'],
    queryFn: api.listMyEvents,
  })

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: api.listChannels,
  })

  // Get upcoming events (next 7 days)
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingEvents = (eventsQuery.data ?? [])
    .filter(e => new Date(e.start_date) >= now && new Date(e.start_date) <= weekFromNow)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5)

  // Get my subscribed events
  const mySubscribedEvents = myEventsQuery.data?.subscribed ?? []

  // Get autosub channels
  const autosubChannels = (channelsQuery.data ?? []).filter(c => c.tag.startsWith('autosub:'))

  const isLoading = eventsQuery.isLoading || myEventsQuery.isLoading

  return (
    <div className="space-y-8">
      <PageHeading
        title="Dashboard"
        description={`Welcome to ${activeOrganization?.name ?? 'your production'}`}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Events */}
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Calendar className="h-5 w-5 text-amber-600" />
                Upcoming This Week
              </h2>
              <Link to="/events" className="text-sm font-medium text-amber-600 hover:underline">
                View all
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No events scheduled this week.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingEvents.map((event) => {
                  const tags = parseTags(event.tags)
                  return (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="block rounded-2xl border border-slate-100 p-4 transition hover:border-amber-200 hover:bg-amber-50/50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{event.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateTime(event.start_date)}
                          </p>
                        </div>
                      </div>
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* My Subscriptions */}
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Users className="h-5 w-5 text-amber-600" />
                My Commitments
              </h2>
              <Link to="/my-schedule" className="text-sm font-medium text-amber-600 hover:underline">
                View all
              </Link>
            </div>

            {mySubscribedEvents.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-slate-500">You haven't signed up for any events yet.</p>
                <Link
                  to="/events"
                  className="mt-3 inline-block text-sm font-medium text-amber-600 hover:underline"
                >
                  Browse events →
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {mySubscribedEvents.slice(0, 5).map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="block rounded-2xl border border-slate-100 p-4 transition hover:border-amber-200 hover:bg-amber-50/50"
                  >
                    <p className="font-semibold text-slate-800">{event.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(event.start_date)}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Auto-Subscription Status */}
          <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-6 shadow-lg shadow-amber-900/5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800">
              ⚡ Your Auto-Notification Tags
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              You'll automatically get notified when events are created or updated with these tags.
            </p>

            {autosubChannels.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-slate-500">
                  No auto-subscription tags configured yet.
                </p>
                <Link
                  to="/notifications"
                  className="mt-3 inline-block rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
                >
                  Set up notifications →
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {autosubChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="rounded-2xl border border-amber-200 bg-white px-4 py-2"
                    >
                      <p className="text-sm font-medium text-slate-800">{channel.name}</p>
                      <p className="text-xs text-amber-600">{channel.tag}</p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/notifications"
                  className="mt-4 inline-block text-sm font-medium text-amber-600 hover:underline"
                >
                  Manage notification settings →
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
