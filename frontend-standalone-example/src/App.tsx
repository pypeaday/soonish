import { useState, useEffect } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface Event {
  id: number
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  tags: string
  created_at: string
}

interface UserStats {
  id: number
  email: string
  name: string
  owned_count: number
  subscribed_count: number
}

function App() {
  const [events, setEvents] = useState<Event[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('test1@example.com')
  const [password, setPassword] = useState('password123')
  const [token, setToken] = useState<string | null>(null)

  const login = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const data = await response.json()
      setToken(data.access_token)
      localStorage.setItem('token', data.access_token)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const fetchEvents = async () => {
    const authToken = token || localStorage.getItem('token')
    if (!authToken) {
      setError('Please login first')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/me/events`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }

      const data = await response.json()
      // API returns { owned: [...], subscribed: [...] }
      const allEvents = [...(data.owned || []), ...(data.subscribed || [])]
      setEvents(allEvents)
      setUserStats({
        id: 0,
        email: email,
        name: 'User',
        owned_count: data.owned?.length || 0,
        subscribed_count: data.subscribed?.length || 0,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchEvents()
    }
  }, [token])

  const logout = () => {
    setToken(null)
    localStorage.removeItem('token')
    setEvents([])
  }

  if (!token) {
    return (
      <div className="app">
        <h1>Notifiq Standalone Example</h1>
        <div className="login-form">
          <h2>Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={login}>Login</button>
          {error && <p className="error">{error}</p>}
          <p className="hint">
            Default credentials: test1@example.com / password123
          </p>
        </div>
        <div className="info">
          <h3>About This Example</h3>
          <p>
            This is a standalone frontend that communicates with the Notifiq API over HTTP.
            It runs independently on its own dev server (port 5173) and calls the backend
            API (port 8000) over the network.
          </p>
          <p>
            <strong>API Base URL:</strong> {API_BASE_URL}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Notifiq Standalone Example</h1>
        <button onClick={logout}>Logout</button>
      </header>

      <div className="info">
        <p>
          <strong>API Base URL:</strong> {API_BASE_URL}
        </p>
        <p>This frontend runs independently and calls the Notifiq API over HTTP.</p>
        {userStats && (
          <div className="user-stats">
            <strong>📊 Your Events:</strong> {userStats.owned_count} owned, {userStats.subscribed_count} subscribed
          </div>
        )}
      </div>

      {loading && <p>Loading events...</p>}
      {error && <p className="error">{error}</p>}

      <div className="events">
        <h2>My Events ({events.length})</h2>
        <button onClick={fetchEvents}>Refresh</button>
        
        {events.length === 0 && !loading && (
          <p className="empty">No events found. Create some events in the Notifiq backend!</p>
        )}

        {events.map((event) => (
          <div key={event.id} className="event-card">
            <h3>{event.name}</h3>
            {event.description && <p>{event.description}</p>}
            <div className="event-meta">
              <span>📅 {new Date(event.start_date).toLocaleString()}</span>
              {event.end_date && (
                <span> → {new Date(event.end_date).toLocaleString()}</span>
              )}
            </div>
            {event.tags && (
              <div className="tags">
                {event.tags.split(',').map((tag: string, i: number) => (
                  <span key={i} className="tag">{tag.trim()}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
