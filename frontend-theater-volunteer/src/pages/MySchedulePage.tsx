import { useQuery } from '@tanstack/react-query'
import { Calendar, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api-client'
import { formatDateTime, parseTags } from '../lib/utils'
import { PageHeading } from '../components/PageHeading'
import { TagBadge } from '../components/TagBadge'

const MySchedulePage = () => {
  const myEventsQuery = useQuery({
    queryKey: ['me', 'events'],
    queryFn: api.listMyEvents,
  })

  const subscribedEvents = myEventsQuery.data?.subscribed ?? []
  const ownedEvents = myEventsQuery.data?.owned ?? []

  // Sort by date
  const sortedSubscribed = [...subscribedEvents].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )

  return (
    <div className="space-y-8">
      <PageHeading
        title="My Schedule"
        description="Events you've signed up for"
      />

      {myEventsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : sortedSubscribed.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-lg shadow-amber-900/5">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-800">No events yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sign up for events to see them here, or set up auto-notifications to be subscribed automatically.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/events"
              className="rounded-2xl border border-amber-200 px-4 py-2 font-semibold text-amber-700 transition hover:bg-amber-50"
            >
              Browse Events
            </Link>
            <Link
              to="/notifications"
              className="rounded-2xl bg-amber-600 px-4 py-2 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
            >
              Set Up Notifications
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subscribed Events */}
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <h2 className="text-lg font-semibold text-slate-800">
              Signed Up ({sortedSubscribed.length})
            </h2>
            <div className="mt-4 space-y-3">
              {sortedSubscribed.map((event) => {
                const tags = parseTags(event.tags)
                const isPast = new Date(event.start_date) < new Date()

                return (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className={`block rounded-2xl border p-4 transition ${
                      isPast
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{event.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateTime(event.start_date)}
                        </p>
                      </div>
                      {isPast && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          Past
                        </span>
                      )}
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
          </section>

          {/* Events I Created */}
          {ownedEvents.length > 0 && (
            <section className="rounded-3xl bg-white/60 p-6">
              <h2 className="text-sm font-semibold uppercase text-slate-500">
                Events I Created ({ownedEvents.length})
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ownedEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-200"
                  >
                    <p className="font-medium text-slate-800">{event.name}</p>
                    <p className="text-sm text-slate-500">{formatDateTime(event.start_date)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default MySchedulePage
