import axios, { type AxiosInstance } from 'axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  preferred_app?: string;
  tier?: string;
  total_notifications_this_month?: number;
  billable_credits_used_this_month?: number;
}

export interface ChannelResponse {
  id: number;
  name: string;
  tag: string | null;
  channel_type: string | null;
  is_active: boolean;
}

export interface EventResponse {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  source: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async login(data: LoginRequest): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>('/auth/login', data);
    localStorage.setItem('auth_token', response.data.access_token);
    return response.data;
  }

  async register(data: RegisterRequest): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>('/auth/register', data);
    localStorage.setItem('auth_token', response.data.access_token);
    return response.data;
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

  async getCurrentUser(): Promise<UserResponse> {
    const response = await this.client.get<UserResponse>('/users/me');
    return response.data;
  }

  async updatePreferredApp(app: string): Promise<void> {
    await this.client.patch('/users/me', { preferred_app: app });
    localStorage.setItem('preferred_app', app);
  }

  getPreferredApp(): string | null {
    return localStorage.getItem('preferred_app');
  }

  setPreferredApp(app: string): void {
    localStorage.setItem('preferred_app', app);
  }

  async getChannels(): Promise<ChannelResponse[]> {
    const response = await this.client.get<ChannelResponse[]>('/channels');
    return response.data;
  }

  async getUpcomingEvents(limit = 5): Promise<EventResponse[]> {
    const response = await this.client.get<EventResponse[]>('/events', {
      params: { upcoming: true, limit }
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
