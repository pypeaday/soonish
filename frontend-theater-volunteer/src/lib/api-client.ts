import axios from 'axios'

import type {
  ChannelCreateRequest,
  ChannelResponse,
  ChannelTestResponse,
  ChannelUpdateRequest,
  EventCreateRequest,
  EventResponse,
  EventUpdateRequest,
  LoginRequest,
  MemberProfile,
  MyEventsResponse,
  OrganizationInvitationResponse,
  OrganizationWithRoleResponse,
  EventSubscriberResponse,
  RoleDefinitionResponse,
  RoleDefinitionCreateRequest,
  SubscribeRequest,
  SubscriptionListItem,
  SubscriptionResponse,
  SubscriptionUpdateRequest,
  TokenResponse,
  UserResponse,
} from '../types/api'

export const SOURCE = 'notifiq-theater-volunteer'
const TOKEN_KEY = 'notifiq_theater_volunteer_access_token'

const deriveBaseUrl = () => {
  const env = import.meta.env.VITE_API_BASE_URL?.trim()
  if (env) return env.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.origin)
    if (url.port === '5173') url.port = '8000'
    return url.toString().replace(/\/$/, '')
  }

  return 'http://localhost:8000'
}

export const client = axios.create({
  baseURL: deriveBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const setAuthHeader = (token: string | null) => {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete client.defaults.headers.common.Authorization
  }
}

const bootstrapToken = () => {
  if (typeof window === 'undefined') return
  const existing = window.localStorage.getItem(TOKEN_KEY)
  if (existing) {
    setAuthHeader(existing)
  }
}

bootstrapToken()

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      auth.clear()
    }
    return Promise.reject(error)
  }
)

export const auth = {
  set(token: string) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token)
    }
    setAuthHeader(token)
  },
  clear() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY)
    }
    setAuthHeader(null)
  },
  get() {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(TOKEN_KEY)
  },
}

const buildQuery = (params: Record<string, string | number | boolean | undefined> = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

const serializeContent = (content: EventCreateRequest['content'] | EventUpdateRequest['content']) => {
  if (content === undefined) return undefined
  if (content === null) return null
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content)
  } catch (err) {
    console.warn('Unable to stringify content payload', err)
    return content as string
  }
}

export const api = {
  async login(body: LoginRequest) {
    const { data } = await client.post<TokenResponse>('/api/v1/auth/login', body)
    auth.set(data.access_token)
    return data
  },
  async logout() {
    await client.post('/api/v1/auth/logout')
    auth.clear()
  },
  async getCurrentUser() {
    const { data } = await client.get<UserResponse>('/api/v1/users/me')
    return data
  },
  async listMyOrganizations() {
    const { data } = await client.get<OrganizationWithRoleResponse[]>('/api/v1/users/me/organizations')
    return data
  },
  async listOrganizationMembers(orgId: number) {
    const { data } = await client.get<MemberProfile[]>(`/api/v1/organizations/${orgId}/members`)
    return data
  },
  async listOrganizationEvents(orgId: number) {
    const query = buildQuery({ source: SOURCE })
    const { data } = await client.get<EventResponse[]>(`/api/v1/organizations/${orgId}/events${query}`)
    return data
  },
  async listMyEvents() {
    const { data } = await client.get<MyEventsResponse>(`/api/v1/users/me/events${buildQuery({ source: SOURCE })}`)
    return data
  },
  async listMySubscriptions() {
    const { data } = await client.get<SubscriptionListItem[]>('/api/v1/subscriptions')
    return data
  },
  async getEvent(eventId: number) {
    const { data } = await client.get<EventResponse>(`/api/v1/events/${eventId}`)
    return data
  },
  async createEvent(body: EventCreateRequest) {
    const payload = { ...body, source: SOURCE, content: serializeContent(body.content) }
    const { data } = await client.post<EventResponse>('/api/v1/events', payload)
    return data
  },
  async updateEvent(eventId: number, body: EventUpdateRequest) {
    const payload = { ...body, content: serializeContent(body.content) }
    const { data } = await client.put<EventResponse>(`/api/v1/events/${eventId}`, payload)
    return data
  },
  async deleteEvent(eventId: number) {
    await client.delete(`/api/v1/events/${eventId}`)
  },
  async listEventSubscribers(eventId: number) {
    const { data } = await client.get<EventSubscriberResponse[]>(`/api/v1/events/${eventId}/subscribers`)
    return data
  },
  async listEventSubscriptions(eventId: number) {
    const { data } = await client.get<SubscriptionResponse[]>(`/api/v1/events/${eventId}/subscriptions`)
    return data
  },
  async subscribe(body: SubscribeRequest) {
    const { data } = await client.post<SubscriptionResponse>('/api/v1/subscriptions', { ...body, source: SOURCE })
    return data
  },
  async updateSubscription(subscriptionId: number, body: SubscriptionUpdateRequest) {
    const { data } = await client.patch(`/api/v1/subscriptions/${subscriptionId}`, body)
    return data
  },
  async deleteSubscription(subscriptionId: number) {
    await client.delete(`/api/v1/subscriptions/${subscriptionId}`)
  },
  async inviteOrganizationMember(orgId: number, email: string, role: string = 'member') {
    await client.post(`/api/v1/organizations/${orgId}/invitations`, { email, role })
  },
  async listMyInvitations() {
    const { data } = await client.get<OrganizationInvitationResponse[]>('/api/v1/organizations/user/invitations')
    return data
  },
  async acceptInvitation(token: string) {
    window.location.href = `${deriveBaseUrl()}/api/v1/invites/organizations/accept/${token}`
  },
  async listRoleDefinitions(organizationId: number) {
    const query = buildQuery({ organization_id: organizationId })
    const { data } = await client.get<RoleDefinitionResponse[]>(`/api/v1/roles/definitions${query}`)
    return data
  },
  async createRoleDefinition(body: RoleDefinitionCreateRequest) {
    const { data } = await client.post<RoleDefinitionResponse>('/api/v1/roles/definitions', body)
    return data
  },
  async listChannels() {
    const { data } = await client.get<ChannelResponse[]>('/api/v1/channels')
    return data
  },
  async createChannel(body: ChannelCreateRequest) {
    const { data } = await client.post<ChannelResponse>('/api/v1/channels', body)
    return data
  },
  async updateChannel(channelId: number, body: ChannelUpdateRequest) {
    const { data } = await client.patch<ChannelResponse>(`/api/v1/channels/${channelId}`, body)
    return data
  },
  async deleteChannel(channelId: number) {
    await client.delete(`/api/v1/channels/${channelId}`)
  },
  async testChannel(channelId: number, payload?: { title?: string; body?: string }) {
    const params = buildQuery(payload ?? {})
    const { data } = await client.post<ChannelTestResponse>(`/api/v1/channels/${channelId}/test${params}`)
    return data
  },
}
