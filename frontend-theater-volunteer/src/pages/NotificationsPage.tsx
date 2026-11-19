import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Edit2,
  Info,
  Loader2,
  Plus,
  TestTube,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

import { PageHeading } from '../components/PageHeading'
import { SUGGESTED_TAGS, TagBadge } from '../components/TagBadge'
import { api } from '../lib/api-client'

const CHANNEL_TYPES = [
  { value: 'sms', label: 'Text message (SMS)' },
  { value: 'email', label: 'Email' },
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'ntfy', label: 'ntfy (push notifications)' },
] as const

const SMS_CARRIERS = [
  { value: 'verizon', label: 'Verizon' },
  { value: 'att', label: 'AT&T' },
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'googlefi', label: 'Google Fi' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'cricket', label: 'Cricket Wireless' },
  { value: 'metropcs', label: 'MetroPCS' },
] as const

type ChannelType = (typeof CHANNEL_TYPES)[number]['value']

type ChannelConfigState = {
  sms: { phone_number: string; carrier: string }
  email: { to_email: string }
  discord: { webhook_url: string }
  slack: { webhook_url: string }
  ntfy: { server_url: string; topic: string }
}

const createDefaultConfigState = (): ChannelConfigState => ({
  sms: { phone_number: '', carrier: 'verizon' },
  email: { to_email: '' },
  discord: { webhook_url: '' },
  slack: { webhook_url: '' },
  ntfy: { server_url: 'https://ntfy.sh', topic: '' },
})

const NotificationsPage = () => {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingChannel, setEditingChannel] = useState<number | null>(null)
  const [modalForm, setModalForm] = useState({
    name: '',
    selectedTags: [] as string[],
    channel_type: 'sms' as ChannelType,
  })
  const [customTagInput, setCustomTagInput] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [channelConfig, setChannelConfig] = useState<ChannelConfigState>(createDefaultConfigState)
  const [testStatus, setTestStatus] = useState<Record<number, 'idle' | 'pending' | 'success' | 'error'>>({})

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: api.listChannels,
  })

  const channels = channelsQuery.data ?? []
  const autosubChannels = channels.filter(c => c.tag.startsWith('autosub:'))
  const regularChannels = channels.filter(c => !c.tag.startsWith('autosub:'))

  const createChannelMutation = useMutation({
    mutationFn: (payload: { name: string; tag: string; channel_type: string; config: Record<string, unknown> }) =>
      api.createChannel(payload),
    onSuccess: () => {
      setShowModal(false)
      setModalForm({ name: '', selectedTags: [], channel_type: 'sms' })
      setChannelConfig(createDefaultConfigState())
      setModalError(null)
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (error) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setModalError(detail ?? 'Unable to create channel right now.')
    },
  })

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: number) => api.deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })

  const updateChannelMutation = useMutation({
    mutationFn: ({ channelId, payload }: { channelId: number; payload: { name?: string; tag?: string; config?: Record<string, unknown> } }) =>
      api.updateChannel(channelId, payload),
    onSuccess: () => {
      setShowModal(false)
      setEditingChannel(null)
      setModalForm({ name: '', selectedTags: [], channel_type: 'sms' })
      setChannelConfig(createDefaultConfigState())
      setModalError(null)
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (error) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setModalError(detail ?? 'Unable to update channel right now.')
    },
  })

  const updateConfigValue = <T extends ChannelType>(type: T, value: Partial<ChannelConfigState[T]>) => {
    setChannelConfig((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...value },
    }))
  }

  const toggleTag = (tag: string) => {
    setModalForm((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }))
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase()
    if (tag && !modalForm.selectedTags.includes(tag)) {
      setModalForm((prev) => ({
        ...prev,
        selectedTags: [...prev.selectedTags, tag],
      }))
    }
    setCustomTagInput('')
  }

  const removeTag = (tag: string) => {
    setModalForm((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.filter((t) => t !== tag),
    }))
  }

  const validateConfig = () => {
    switch (modalForm.channel_type) {
      case 'sms': {
        const config = channelConfig.sms
        const digits = config.phone_number.replace(/[^0-9]/g, '')
        if (!digits) return 'Phone number is required.'
        if (digits.length !== 10) return 'Enter a 10-digit US phone number.'
        break
      }
      case 'email':
        if (!channelConfig.email.to_email.trim()) return 'Email address is required.'
        break
      case 'discord':
      case 'slack':
        if (!channelConfig[modalForm.channel_type].webhook_url.trim()) return 'Webhook URL is required.'
        break
      case 'ntfy':
        if (!channelConfig.ntfy.topic.trim()) return 'Topic is required.'
        break
    }
    return null
  }

  const buildConfigPayload = () => {
    switch (modalForm.channel_type) {
      case 'sms':
        return {
          phone_number: channelConfig.sms.phone_number.replace(/[^0-9]/g, ''),
          carrier: channelConfig.sms.carrier,
        }
      case 'email':
        return { to_email: channelConfig.email.to_email.trim() }
      case 'discord':
      case 'slack':
        return { webhook_url: channelConfig[modalForm.channel_type].webhook_url.trim() }
      case 'ntfy':
        return {
          server_url: channelConfig.ntfy.server_url.trim() || 'https://ntfy.sh',
          topic: channelConfig.ntfy.topic.trim(),
        }
      default:
        return {}
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    if (!modalForm.name.trim()) {
      setModalError('Please enter a name for this notification channel.')
      return
    }
    if (modalForm.selectedTags.length === 0) {
      setModalError('Please select at least one tag to subscribe to.')
      return
    }

    const configError = validateConfig()
    if (configError) {
      setModalError(configError)
      return
    }

    // Create tag string with autosub: prefix
    const tagString = modalForm.selectedTags.map((t) => `autosub:${t}`).join(',')

    createChannelMutation.mutate({
      name: modalForm.name.trim(),
      tag: tagString,
      channel_type: modalForm.channel_type,
      config: buildConfigPayload(),
    })
  }

  const handleTestChannel = async (channelId: number) => {
    setTestStatus((prev) => ({ ...prev, [channelId]: 'pending' }))
    try {
      await api.testChannel(channelId)
      setTestStatus((prev) => ({ ...prev, [channelId]: 'success' }))
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [channelId]: 'idle' })), 2500)
    } catch {
      setTestStatus((prev) => ({ ...prev, [channelId]: 'error' }))
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [channelId]: 'idle' })), 2500)
    }
  }

  const openModal = () => {
    setEditingChannel(null)
    setModalForm({ name: '', selectedTags: [], channel_type: 'sms' })
    setChannelConfig(createDefaultConfigState())
    setCustomTagInput('')
    setModalError(null)
    setShowModal(true)
  }

  const openEditModal = (channel: typeof channels[0]) => {
    setEditingChannel(channel.id)
    // Parse tags - remove autosub: prefix for display
    const tags = channel.tag.split(',').map(t => t.trim().replace(/^autosub:/, ''))
    setModalForm({
      name: channel.name,
      selectedTags: tags,
      channel_type: channel.channel_type as ChannelType,
    })
    // Parse config from channel
    const config = createDefaultConfigState()
    if (channel.config) {
      const parsed = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config
      if (channel.channel_type === 'sms') {
        config.sms = { phone_number: parsed.phone_number || '', carrier: parsed.carrier || 'verizon' }
      } else if (channel.channel_type === 'email') {
        config.email = { to_email: parsed.to_email || '' }
      } else if (channel.channel_type === 'discord' || channel.channel_type === 'slack') {
        config[channel.channel_type] = { webhook_url: parsed.webhook_url || '' }
      } else if (channel.channel_type === 'ntfy') {
        config.ntfy = { server_url: parsed.server_url || 'https://ntfy.sh', topic: parsed.topic || '' }
      }
    }
    setChannelConfig(config)
    setCustomTagInput('')
    setModalError(null)
    setShowModal(true)
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    if (!editingChannel) return

    if (!modalForm.name.trim()) {
      setModalError('Please enter a name for this notification channel.')
      return
    }
    if (modalForm.selectedTags.length === 0) {
      setModalError('Please select at least one tag to subscribe to.')
      return
    }

    const configError = validateConfig()
    if (configError) {
      setModalError(configError)
      return
    }

    const tagString = modalForm.selectedTags.map((t) => `autosub:${t}`).join(',')

    updateChannelMutation.mutate({
      channelId: editingChannel,
      payload: {
        name: modalForm.name.trim(),
        tag: tagString,
        config: buildConfigPayload(),
      },
    })
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title="Notifications"
        description="Set up how you want to be notified about events"
      />

      {/* Explanation Card */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-100 to-rose-100 p-6 shadow-lg shadow-amber-900/5">
        <div className="flex gap-4">
          <div className="rounded-full bg-white p-3">
            <Zap className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">How Auto-Notifications Work</h3>
            <p className="mt-1 text-sm text-slate-600">
              When you create a notification channel with tags like <code className="rounded bg-white/50 px-1">autosub:setup</code> or{' '}
              <code className="rounded bg-white/50 px-1">autosub:rehearsal</code>, you'll automatically be subscribed to any events
              that have those tags. When the event organizer updates an event's tags, your subscriptions adjust automatically!
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                📱 Get texts for setup calls
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                📧 Email for all rehearsals
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                🔔 Push for your kid's events
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Subscription Channels */}
      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Bell className="h-5 w-5 text-amber-600" />
              Your Notification Channels
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Each channel defines how and when you get notified.
            </p>
          </div>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Add Channel
          </button>
        </div>

        {channelsQuery.isLoading ? (
          <div className="mt-6 flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : autosubChannels.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-3 font-medium text-slate-700">No notification channels yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add a channel to start receiving automatic notifications for events.
            </p>
            <button
              onClick={openModal}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create your first channel
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {autosubChannels.map((channel) => {
              const tags = channel.tag.split(',').map((t) => t.trim())
              return (
                <div
                  key={channel.id}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:border-amber-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{channel.name}</p>
                      <p className="text-xs uppercase text-slate-500">{channel.channel_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(channel)}
                        className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                        title="Edit channel"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleTestChannel(channel.id)}
                        disabled={testStatus[channel.id] === 'pending'}
                        className="rounded-full border border-amber-200 p-2 text-amber-600 transition hover:bg-amber-50"
                        title="Send test notification"
                      >
                        {testStatus[channel.id] === 'pending' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${channel.name}"?`)) {
                            deleteChannelMutation.mutate(channel.id)
                          }
                        }}
                        className="rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                        title="Delete channel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {testStatus[channel.id] === 'success' && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Test sent!
                    </p>
                  )}
                  {testStatus[channel.id] === 'error' && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" /> Test failed
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} variant="autosub" />
                    ))}
                  </div>

                  <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                    <Info className="h-3 w-3" />
                    {channel.is_active ? 'Active' : 'Paused'}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Regular Channels (non-autosub) */}
      {regularChannels.length > 0 && (
        <section className="rounded-3xl bg-white/60 p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            Other Channels ({regularChannels.length})
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {regularChannels.map((channel) => (
              <div key={channel.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-700">{channel.name}</p>
                <p className="text-xs text-slate-500">{channel.channel_type} • {channel.tag || 'no tag'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create Channel Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {editingChannel ? 'Edit Notification Channel' : 'Add Notification Channel'}
                </h3>
                <p className="text-sm text-slate-500">Choose what events to get notified about</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingChannel ? handleUpdate : handleSubmit} className="mt-6 space-y-5">
              {modalError && (
                <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
              )}

              {/* Channel Name */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Channel Name</span>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., My Phone for Setup Calls"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none"
                />
              </label>

              {/* Tag Selection */}
              <div>
                <span className="text-sm font-medium text-slate-700">Subscribe to events tagged with:</span>
                <p className="text-xs text-slate-500">Select event types or add custom tags (like your child's name)</p>
                
                {/* Selected tags display */}
                {modalForm.selectedTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modalForm.selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
                      >
                        {SUGGESTED_TAGS.find(t => t.value === tag)?.label || tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-amber-600 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested tags */}
                <p className="mt-3 text-xs font-medium text-slate-500">Quick select:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTED_TAGS.filter(tag => !modalForm.selectedTags.includes(tag.value)).map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
                    >
                      + {tag.label}
                    </button>
                  ))}
                </div>

                {/* Custom tag input */}
                <div className="mt-3 flex gap-2">
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
                    placeholder="Add custom tag (e.g., emma, jake)"
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    disabled={!customTagInput.trim()}
                    className="rounded-2xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Delivery Method */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Delivery Method</span>
                <select
                  value={modalForm.channel_type}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, channel_type: e.target.value as ChannelType }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  {CHANNEL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Channel-specific config */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase text-amber-600">
                  {CHANNEL_TYPES.find((t) => t.value === modalForm.channel_type)?.label} Setup
                </p>
                <div className="mt-3 space-y-3">
                  {modalForm.channel_type === 'sms' && (
                    <>
                      <label className="block">
                        <span className="text-sm text-slate-700">Phone Number</span>
                        <input
                          type="tel"
                          value={channelConfig.sms.phone_number}
                          onChange={(e) => updateConfigValue('sms', { phone_number: e.target.value })}
                          placeholder="555-867-5309"
                          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-slate-700">Carrier</span>
                        <select
                          value={channelConfig.sms.carrier}
                          onChange={(e) => updateConfigValue('sms', { carrier: e.target.value })}
                          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                        >
                          {SMS_CARRIERS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {modalForm.channel_type === 'email' && (
                    <label className="block">
                      <span className="text-sm text-slate-700">Email Address</span>
                      <input
                        type="email"
                        value={channelConfig.email.to_email}
                        onChange={(e) => updateConfigValue('email', { to_email: e.target.value })}
                        placeholder="you@example.com"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                      />
                    </label>
                  )}
                  {(modalForm.channel_type === 'discord' || modalForm.channel_type === 'slack') && (
                    <label className="block">
                      <span className="text-sm text-slate-700">Webhook URL</span>
                      <input
                        type="url"
                        value={channelConfig[modalForm.channel_type].webhook_url}
                        onChange={(e) => updateConfigValue(modalForm.channel_type, { webhook_url: e.target.value })}
                        placeholder={`https://${modalForm.channel_type === 'discord' ? 'discord.com' : 'hooks.slack.com'}/...`}
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                      />
                    </label>
                  )}
                  {modalForm.channel_type === 'ntfy' && (
                    <>
                      <label className="block">
                        <span className="text-sm text-slate-700">Server URL</span>
                        <input
                          type="url"
                          value={channelConfig.ntfy.server_url}
                          onChange={(e) => updateConfigValue('ntfy', { server_url: e.target.value })}
                          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-slate-700">Topic</span>
                        <input
                          type="text"
                          value={channelConfig.ntfy.topic}
                          onChange={(e) => updateConfigValue('ntfy', { topic: e.target.value })}
                          placeholder="my-theater-notifications"
                          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createChannelMutation.isPending || updateChannelMutation.isPending}
                  className="flex-1 rounded-2xl bg-amber-600 px-4 py-3 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {(createChannelMutation.isPending || updateChannelMutation.isPending) ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  ) : editingChannel ? (
                    'Save Changes'
                  ) : (
                    'Create Channel'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
