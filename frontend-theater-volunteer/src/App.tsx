import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from './context/AuthContext'
import { AppShell } from './layouts/AppShell'
import { FullScreenLoader } from './components/FullScreenLoader'

import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import CreateEventPage from './pages/CreateEventPage'
import MySchedulePage from './pages/MySchedulePage'
import VolunteersPage from './pages/VolunteersPage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <FullScreenLoader message="Signing you in" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AppShell>{children}</AppShell>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <CreateEventPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId/edit"
        element={
          <ProtectedRoute>
            <CreateEventPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-schedule"
        element={
          <ProtectedRoute>
            <MySchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/volunteers"
        element={
          <ProtectedRoute>
            <VolunteersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
