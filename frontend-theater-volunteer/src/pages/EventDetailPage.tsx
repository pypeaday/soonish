import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Edit,
  Loader2,
  MapPin,
  Trash2,
  Users,
} from 'lucide-react'

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

const EventDetailPage = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(Number(eventId)),
    enabled: Boolean(eventId),
  })

  const subscribersQuery = useQuery({
    queryKey: ['event', eventId, 'subscribers'],
    queryFn: () => api.listEventSubscribers(Number(eventId)),
    enabled: Boolean(eventId),
  })

  const mySubscriptionsQuery = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: api.listMySubscriptions,
  })

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscribe({ event_id: Number(eventId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId, 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] })
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: (subscriptionId: number) => api.deleteSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId, 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteEvent(Number(eventId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      navigate('/events')
    },
  })

  const event = eventQuery.data
  const subscribers = subscribersQuery.data ?? []
  const mySubscription = mySubscriptionsQuery.data?.find((s) => s.event_id === Number(eventId))
  const isSubscribed = Boolean(mySubscription)
  const isOwner = event?.organizer_user_id === user?.id

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

  if (eventQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Event not found</p>
      </div>
    )
  }

  const tags = parseTags(event.tags)
  const content = parseContent(event.content)
  const eventType = content?.event_type
  const typeInfo = eventType ? EVENT_TYPE_LABELS[eventType] : null

  return (
    <div className="space-y-8">
      <PageHeading
        title={event.name}
        description={typeInfo ? `${typeInfo.emoji} ${typeInfo.label}` : undefined}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {isOwner && (
              <>
                <button
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this event?')) {
                      deleteMutation.mutate()
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <div className="flex items-center gap-4 text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                <span>{formatDateTime(event.start_date)}</span>
              </div>
              {event.end_date && (
                <>
                  <span>→</span>
                  <span>{formatDateTime(event.end_date)}</span>
                </>
              )}
            </div>

            {content?.location_label && (
              <div className="mt-3 flex items-center gap-2 text-slate-600">
                <MapPin className="h-5 w-5 text-amber-600" />
                <span>{content.location_label}</span>
              </div>
            )}

            {event.description && (
              <p className="mt-4 text-slate-700">{event.description}</p>
            )}

            {content?.notes && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">Notes</p>
                <p className="mt-1 text-sm text-amber-700">{content.notes}</p>
              </div>
            )}

            {tags.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Subscribers */}
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800">
              <Users className="h-5 w-5 text-amber-600" />
              Signed Up ({subscribers.length})
            </h3>

            {subscribersQuery.isLoading ? (
              <div className="mt-4 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              </div>
            ) : subscribers.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No one has signed up yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {subscribers.map((sub) => (
                  <div
                    key={sub.subscription_id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{sub.user_name}</p>
                      <p className="text-xs text-slate-500">{sub.user_email}</p>
                    </div>
                    {sub.role_assignments.length > 0 && (
                      <div className="flex gap-1">
                        {sub.role_assignments.map((role) => (
                          <span
                            key={role.role_id}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          >
                            {role.role_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Sign Up Card */}
          <section className="rounded-3xl bg-gradient-to-br from-amber-100 to-rose-100 p-6 shadow-lg shadow-amber-900/5">
            <h3 className="font-semibold text-slate-800">
              {isSubscribed ? "You're signed up!" : 'Want to help?'}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {isSubscribed
                ? "You'll receive notifications about this event."
                : 'Sign up to get notified about updates.'}
            </p>

            {isSubscribed ? (
              <button
                onClick={() => mySubscription && unsubscribeMutation.mutate(mySubscription.id)}
                disabled={unsubscribeMutation.isPending}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {unsubscribeMutation.isPending ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  'Cancel Sign Up'
                )}
              </button>
            ) : (
              <button
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
              >
                {subscribeMutation.isPending ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  'Sign Up'
                )}
              </button>
            )}
          </section>

          {/* Quick Info */}
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Event Info</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(event.created_at).toLocaleDateString()}
                </dd>
              </div>
              {event.updated_at && (
                <div>
                  <dt className="text-slate-500">Last Updated</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(event.updated_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Visibility</dt>
                <dd className="font-medium text-slate-800">
                  {event.is_public ? 'Public' : 'Organization Only'}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

export default EventDetailPage
