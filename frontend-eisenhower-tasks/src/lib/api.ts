import axios, { type AxiosInstance } from 'axios';
import { 
  parseEisenhowerContent,
  createEisenhowerContent,
  updateQuadrantInContent,
  completeTask,
  archiveTask,
  type TaskCreateRequest
} from './eisenhower';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  tier: string;
  is_admin: boolean;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  timezone: string;
  content?: string;
  is_public: boolean;
  notify_on_completion: boolean;
  source?: string;
  tags?: string;
  series_id?: string;
  series_position?: number;
  recurrence_rule?: string;
  created_at: string;
  updated_at: string;
}

export interface EventCreateRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  timezone: string;
  is_public?: boolean;
  notify_on_completion?: boolean;
  tags?: string;
  recurrence_rule?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  duration_seconds: number;
  category: 'focus' | 'break' | 'task' | 'custom';
  is_builtin: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Channel {
  id: number;
  name: string;
  tag: string;
  channel_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelCreateRequest {
  channel_type: 'gotify' | 'email' | 'webhook' | 'slack' | 'discord' | 'ntfy';
  name: string;
  config: Record<string, string>;
  tag: string;
}

export interface ChannelUpdateRequest {
  name?: string;
  tag?: string;
  config?: Record<string, string>;
  is_active?: boolean;
}

const SOURCE = 'notifiq-eisenhower';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Auth
  async login(data: LoginRequest): Promise<TokenResponse & { user: User }> {
    const formData = new URLSearchParams();
    formData.append('email', data.email);
    formData.append('password', data.password);
    const response = await this.client.post<TokenResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('auth_token', response.data.access_token);
    
    // Fetch user after login
    const user = await this.getCurrentUser();
    return { ...response.data, user };
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
    }
  }

  clearAuth(): void {
    localStorage.removeItem('auth_token');
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/users/me');
    return response.data;
  }

  // Events (Tasks)
  async listMyEvents(): Promise<Event[]> {
    const response = await this.client.get<{ owned: Event[]; subscribed: Event[] }>('/users/me/events', {
      params: { source: SOURCE },
    });
    // Combine and dedupe
    const combined = [...response.data.owned, ...response.data.subscribed];
    const deduped = Array.from(new Map(combined.map((event) => [event.id, event])).values());
    return deduped;
  }

  async createEvent(data: EventCreateRequest): Promise<Event> {
    const response = await this.client.post<Event>('/events', {
      ...data,
      source: SOURCE,
    });
    return response.data;
  }

  async updateEvent(id: number, data: Partial<EventCreateRequest>): Promise<Event> {
    const response = await this.client.put<Event>(`/events/${id}`, data);
    return response.data;
  }

  async deleteEvent(id: number): Promise<void> {
    await this.client.delete(`/events/${id}`);
  }

  // Channels
  async listChannels(): Promise<Channel[]> {
    const response = await this.client.get<Channel[]>('/channels');
    return response.data;
  }

  async createChannel(data: ChannelCreateRequest): Promise<Channel> {
    const response = await this.client.post<Channel>('/channels', data);
    return response.data;
  }

  async updateChannel(id: number, data: ChannelUpdateRequest): Promise<Channel> {
    const response = await this.client.patch<Channel>(`/channels/${id}`, data);
    return response.data;
  }

  async deleteChannel(id: number): Promise<void> {
    await this.client.delete(`/channels/${id}`);
  }

  async testChannel(id: number): Promise<void> {
    await this.client.post(`/channels/${id}/test`);
  }

  // Eisenhower-specific methods
  async getEisenhowerTasks(): Promise<Event[]> {
    const response = await this.client.get<Event[]>('/events', {
      params: { 
        source: SOURCE,
        limit: 1000 
      }
    });
    
    // Filter only events with Eisenhower content
    return response.data.filter(event => 
      parseEisenhowerContent(event.content) !== null
    );
  }

  async createTask(data: TaskCreateRequest): Promise<Event> {
    const content = createEisenhowerContent(
      data.eisenhower.quadrant,
      data.eisenhower.urgency,
      data.eisenhower.importance,
      data.eisenhower.metadata?.source
    );
    
    const response = await this.client.post<Event>('/events', {
      name: data.name,
      description: data.description,
      end_date: data.end_date,
      start_date: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      source: SOURCE,
      content: JSON.stringify(content)
    });

    return response.data;
  }

  async updateTaskQuadrant(eventId: number, quadrant: 1 | 2 | 3 | 4): Promise<Event> {
    const eventResponse = await this.client.get<Event>(`/events/${eventId}`);
    const eisenhowerData = parseEisenhowerContent(eventResponse.data.content);
    
    if (!eisenhowerData) throw new Error('Not an Eisenhower task');
    
    const updatedContent = updateQuadrantInContent(eisenhowerData, quadrant);

    const response = await this.client.put<Event>(`/events/${eventId}`, {
      content: JSON.stringify(updatedContent)
    });

    return response.data;
  }

  async completeTask(eventId: number): Promise<Event> {
    const eventResponse = await this.client.get<Event>(`/events/${eventId}`);
    const eisenhowerData = parseEisenhowerContent(eventResponse.data.content);
    
    if (!eisenhowerData) throw new Error('Not an Eisenhower task');
    
    const updatedContent = completeTask(eisenhowerData);

    const response = await this.client.put<Event>(`/events/${eventId}`, {
      content: JSON.stringify(updatedContent)
    });

    return response.data;
  }

  async archiveTask(eventId: number): Promise<Event> {
    const eventResponse = await this.client.get<Event>(`/events/${eventId}`);
    const eisenhowerData = parseEisenhowerContent(eventResponse.data.content);
    
    if (!eisenhowerData) throw new Error('Not an Eisenhower task');
    
    const updatedContent = archiveTask(eisenhowerData);

    const response = await this.client.put<Event>(`/events/${eventId}`, {
      content: JSON.stringify(updatedContent)
    });

    return response.data;
  }
}

export const apiClient = new ApiClient();
