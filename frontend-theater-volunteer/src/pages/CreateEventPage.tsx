import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api-client'
import { parseTags } from '../lib/utils'
import { PageHeading } from '../components/PageHeading'
import { SUGGESTED_TAGS } from '../components/TagBadge'
import type { TheaterEventContent } from '../types/api'

const EVENT_TYPES = [
  { value: 'rehearsal', label: 'Rehearsal', emoji: '🎬' },
  { value: 'performance', label: 'Performance', emoji: '🎭' },
  { value: 'setup', label: 'Setup', emoji: '🔨' },
  { value: 'strike', label: 'Strike', emoji: '📦' },
  { value: 'meeting', label: 'Meeting', emoji: '📋' },
  { value: 'workshop', label: 'Workshop', emoji: '🎓' },
]

const CreateEventPage = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeOrganization } = useAuth()
  const isEditing = Boolean(eventId)

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    event_type: 'rehearsal',
    location_label: '',
    tags: [] as string[],
    notes: '',
  })
  const [customTagInput, setCustomTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch existing event if editing
  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(Number(eventId)),
    enabled: isEditing,
  })

  // Populate form when editing
  useEffect(() => {
    if (eventQuery.data) {
      const event = eventQuery.data
      const startDate = new Date(event.start_date)
      const endDate = event.end_date ? new Date(event.end_date) : null

      let content: TheaterEventContent | null = null
      if (event.content) {
        if (typeof event.content === 'string') {
          try {
            content = JSON.parse(event.content)
          } catch {
            // ignore
          }
        } else {
          content = event.content
        }
      }

      setForm({
        name: event.name,
        description: event.description || '',
        start_date: startDate.toISOString().split('T')[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_date: endDate ? endDate.toISOString().split('T')[0] : '',
        end_time: endDate ? endDate.toTimeString().slice(0, 5) : '',
        event_type: content?.event_type || 'rehearsal',
        location_label: content?.location_label || '',
        tags: parseTags(event.tags),
        notes: content?.notes || '',
      })
    }
  }, [eventQuery.data])

  const createMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      navigate(`/events/${data.id}`)
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Failed to create event')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof api.updateEvent>[1] }) =>
      api.updateEvent(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      navigate(`/events/${eventId}`)
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Failed to update event')
    },
  })

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase()
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
    }
    setCustomTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('Event name is required')
      return
    }
    if (!form.start_date || !form.start_time) {
      setError('Start date and time are required')
      return
    }

    const startDateTime = new Date(`${form.start_date}T${form.start_time}`)
    const endDateTime = form.end_date && form.end_time
      ? new Date(`${form.end_date}T${form.end_time}`)
      : null

    const content: TheaterEventContent = {
      theater_schema: 'notifiq.theater_volunteer.v1',
      event_type: form.event_type as TheaterEventContent['event_type'],
      location_label: form.location_label || undefined,
      notes: form.notes || undefined,
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime?.toISOString() || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      organization_id: activeOrganization?.id,
      is_public: false,
      tags: form.tags.length > 0 ? form.tags : undefined,
      content,
    }

    if (isEditing) {
      updateMutation.mutate({ id: Number(eventId), body: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEditing && eventQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title={isEditing ? 'Edit Event' : 'Create Event'}
        description={isEditing ? 'Update event details and tags' : 'Schedule a new event for your production'}
        actions={
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Event Details</h3>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Event Name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Tech Rehearsal"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Event Type</span>
              <select
                value={form.event_type}
                onChange={(e) => setForm((prev) => ({ ...prev, event_type: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.emoji} {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What's happening at this event?"
                rows={3}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Location</span>
              <input
                type="text"
                value={form.location_label}
                onChange={(e) => setForm((prev) => ({ ...prev, location_label: e.target.value }))}
                placeholder="e.g., Main Stage, Green Room"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Date/Time */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Date & Time</h3>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Start Date *</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Start Time *</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">End Date</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">End Time</span>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes for volunteers..."
                rows={3}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {/* Tags Section - This is the key part for auto-subscriptions! */}
        <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6">
          <h3 className="font-semibold text-slate-800">
            🏷️ Event Tags
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Tags determine who gets automatically notified. Parents who have set up notifications for these tags
            will be subscribed when you save this event.
          </p>

          {/* Selected tags display */}
          {form.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {SUGGESTED_TAGS.find(t => t.value === tag)?.label || tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-amber-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Suggested tags */}
          <p className="mt-4 text-xs font-medium text-slate-500">Quick select:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_TAGS.filter(tag => !form.tags.includes(tag.value)).map((tag) => (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
              >
                + {tag.label}
              </button>
            ))}
          </div>

          {/* Custom tag input */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomTag()
                }
              }}
              placeholder="Add custom tag (e.g., emma, jake, leads)"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addCustomTag}
              disabled={!customTagInput.trim()}
              className="rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {form.tags.length > 0 && (
            <p className="mt-4 text-sm text-amber-700">
              ⚡ People subscribed to <strong>{form.tags.join(', ')}</strong> will be notified.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {isEditing ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateEventPage
