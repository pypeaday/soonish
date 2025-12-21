// Theater-specific content schema
export interface TheaterEventContent {
  theater_schema?: 'notifiq.theater_volunteer.v1'
  event_type?: 'rehearsal' | 'performance' | 'setup' | 'strike' | 'meeting' | 'workshop'
  production_name?: string
  roles_needed?: TheaterRole[]
  location_label?: string
  what_to_bring?: string[]
  dress_code?: string
  parking_instructions?: string
  emergency_contact?: { name: string; phone: string }
  notes?: string
}

export interface TheaterRole {
  role_id?: number
  name: string
  count_needed: number
  count_filled?: number
  skills_required?: string[]
}

export interface EventResponse {
  id: number
  name: string
  description?: string | null
  start_date: string
  end_date?: string | null
  timezone: string
  organization_id?: number | null
  organizer_user_id: number
  created_at: string
  updated_at?: string
  is_public: boolean
  tags?: string[] | string | null
  source?: string | null
  content?: TheaterEventContent | string | null
  temporal_workflow_id?: string | null
  series_id?: string | null
  series_position?: number | null
}

export interface EventCreateRequest {
  name: string
  description?: string | null
  start_date: string
  end_date?: string | null
  timezone?: string
  organization_id?: number | null
  is_public?: boolean
  tags?: string[] | null
  source?: string
  content?: TheaterEventContent | Record<string, unknown>
}

export interface EventUpdateRequest extends Partial<EventCreateRequest> {}

export interface SubscriptionResponse {
  subscription_id: number
  event_id: number
  user_id: number
  selectors: unknown
}

export interface SubscriptionListItem {
  id: number
  event_id: number
  created_at: string
  selectors?: Array<{ id: number; channel_id: number | null; tag: string | null }>
  reminders?: Array<{ id: number; offset_seconds: number }>
}

export interface ChannelResponse {
  id: number
  name: string
  tag: string
  channel_type: string | null
  is_active: boolean
  config: Record<string, unknown> | null
  created_at: string
}

export interface ChannelCreateRequest {
  name: string
  tag: string
  channel_type: string
  config: Record<string, unknown>
}

export interface ChannelUpdateRequest {
  name?: string
  tag?: string
  channel_type?: string
  is_active?: boolean
  config?: Record<string, unknown>
}

export interface SubscriptionUpdateRequest {
  channel_ids?: number[]
  tags?: string[]
  reminder_offsets?: number[]
}

export interface ChannelTestResponse {
  success: boolean
  message: string
}

export interface OrganizationInvitationResponse {
  id: number
  organization_id: number
  organization_name?: string | null
  email: string
  role: string
  status: string
  invited_by_user_id: number
  invited_by_email: string
  invited_by_name: string
  expires_at: string
  created_at: string
  accepted_at?: string | null
  token?: string | null
}

export interface EventSubscriberResponse {
  subscription_id: number
  user_id: number
  user_name: string
  user_email: string
  created_at: string
  selectors: Array<{ id: number; channel_id: number | null; tag: string | null }>
  reminder_offsets: number[]
  role_assignments: Array<{ role_id: number; role_name: string }>
}

export interface SubscribeRequest {
  event_id: number
  name?: string
  email?: string
  role?: string
  notes?: string
  reminder_offsets?: number[]
  channel_ids?: number[]
}

export interface OrganizationResponse {
  id: number
  name: string
  slug?: string
  description?: string | null
  organization_type?: string | null
  settings?: Record<string, unknown>
  created_at?: string
}

export interface OrganizationWithRoleResponse extends OrganizationResponse {
  role: 'admin' | 'coordinator' | 'member' | string
}

export interface MemberProfile {
  user_id: number
  user_email: string
  user_name: string
  role: string
  joined_at: string
  skills?: string[]
  availability?: { days?: string[]; times?: string[] }
  total_hours?: number
  events_attended?: number
  preferred_roles?: string[]
  notes?: string | null
}

export interface RoleDefinitionResponse {
  id: number
  organization_id: number
  name: string
  attributes?: string | Record<string, unknown> | null
  created_at: string
}

export interface RoleDefinitionCreateRequest {
  organization_id: number
  name: string
  attributes?: Record<string, unknown> | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
}

export interface UserResponse {
  id: number
  email: string
  name: string
}

export interface MyEventsResponse {
  owned: EventResponse[]
  subscribed: EventResponse[]
}
