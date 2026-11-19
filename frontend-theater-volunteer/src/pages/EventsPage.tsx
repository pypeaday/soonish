import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Loader2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api-client'
import { formatDateTime, parseTags } from '../lib/utils'
import { PageHeading } from '../components/PageHeading'
import { TagBadge } from '../components/TagBadge'
import type { TheaterEventContent } from '../types/api'

const EVENT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  rehearsal: { label: 'Rehearsal', emoji: '🎬' },
  performance: { label: 'Performance', emoji: '🎭' },
  setup: { label: 'Setup', emoji: '🔨' },
  strike: { label: 'Strike', emoji: '📦' },
  meeting: { label: 'Meeting', emoji: '📋' },
  workshop: { label: 'Workshop', emoji: '🎓' },
}

const EventsPage = () => {
  const { activeOrganization } = useAuth()

  const eventsQuery = useQuery({
    queryKey: ['events', 'org', activeOrganization?.id],
    queryFn: () => api.listOrganizationEvents(activeOrganization!.id),
    enabled: Boolean(activeOrganization),
  })

  const events = eventsQuery.data ?? []

  // Group events by date
  const now = new Date()
  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

  const pastEvents = events
    .filter(e => new Date(e.start_date) < now)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  const parseContent = (content: string | TheaterEventContent | null | undefined): TheaterEventContent | null => {
    if (!content) return null
    if (typeof content === 'string') {
      try {
        return JSON.parse(content)
      } catch {
        return null
      }
    }
    return content
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title="Events"
        description="All scheduled events for this production"
        actions={
          <Link
            to="/events/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Link>
        }
      />

      {eventsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-lg shadow-amber-900/5">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-800">No events yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Create your first event to get started.
          </p>
          <Link
            to="/events/new"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">
                Upcoming ({upcomingEvents.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => {
                  const tags = parseTags(event.tags)
                  const content = parseContent(event.content)
                  const eventType = content?.event_type
                  const typeInfo = eventType ? EVENT_TYPE_LABELS[eventType] : null

                  return (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="group rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5 transition hover:shadow-xl hover:shadow-amber-900/10"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          {typeInfo && (
                            <span className="text-2xl">{typeInfo.emoji}</span>
                          )}
                          <h3 className="mt-2 font-semibold text-slate-800 group-hover:text-amber-700">
                            {event.name}
                          </h3>
                          {typeInfo && (
                            <p className="text-xs font-medium uppercase text-amber-600">
                              {typeInfo.label}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="h-4 w-4" />
                        {formatDateTime(event.start_date)}
                      </p>

                      {event.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                          {event.description}
                        </p>
                      )}

                      {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">
                Past ({pastEvents.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastEvents.slice(0, 6).map((event) => {
                  const tags = parseTags(event.tags)

                  return (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="group rounded-3xl bg-white/60 p-6 shadow-sm transition hover:bg-white hover:shadow-lg"
                    >
                      <h3 className="font-semibold text-slate-600 group-hover:text-slate-800">
                        {event.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDateTime(event.start_date)}
                      </p>
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
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default EventsPage
