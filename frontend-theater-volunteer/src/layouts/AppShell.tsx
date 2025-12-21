import { Fragment, type ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Bell,
  BellRing,
  Calendar,
  Clapperboard,
  Home,
  LogOut,
  Mail,
  Menu,
  PlusCircle,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../context/AuthContext'
import { friendlyGreeting } from '../lib/utils'
import { api } from '../lib/api-client'

type NavItem = {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: Home },
  { label: 'Events', to: '/events', icon: Calendar },
  { label: 'Volunteers', to: '/volunteers', icon: Users },
  { label: 'My Schedule', to: '/my-schedule', icon: Clapperboard },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, organizations, activeOrganization, setActiveOrganization, logout } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [dismissedInvites, setDismissedInvites] = useState<number[]>([])

  const invitationsQuery = useQuery({
    queryKey: ['invitations', 'pending'],
    queryFn: api.listMyInvitations,
    enabled: Boolean(user),
  })

  const pendingInvitations = (invitationsQuery.data ?? [])
    .filter(inv => inv.status === 'pending' && !dismissedInvites.includes(inv.id))

  const handleOrgChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = Number(event.target.value)
    setActiveOrganization(orgId)
  }

  const greeting = friendlyGreeting()

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 to-rose-50 text-slate-800">
      {/* Desktop Sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-white/90 px-6 pb-8 pt-10 shadow-2xl shadow-amber-900/10 md:flex">
        <div className="flex items-center gap-2 text-2xl font-semibold">
          <span className="rounded-full bg-amber-100 p-2">🎭</span>
          <span className="text-amber-900">Stage Manager</span>
        </div>
        <div className="mt-8 space-y-2">
          <label className="text-xs uppercase text-slate-500">Production</label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold">
            <select
              value={activeOrganization?.id ?? ''}
              onChange={handleOrgChange}
              className="w-full bg-transparent outline-none"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="text-slate-800">
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav className="mt-10 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-600 hover:bg-amber-100'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <Link
            to="/events/new"
            className="flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600"
          >
            <PlusCircle className="h-4 w-4" />
            New Event
          </Link>
          <button
            onClick={() => logout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex w-full flex-col md:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-gradient-to-br from-amber-50/90 to-rose-50/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl border bg-white p-2 shadow-sm md:hidden"
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                <Menu className="h-5 w-5 text-amber-600" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{greeting}</p>
                <p className="text-lg font-semibold">{user?.name ?? 'Director'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium">
              <Link to="/events/new" className="btn-primary hidden sm:inline-flex">
                <PlusCircle className="mr-2 h-4 w-4" /> New Event
              </Link>
              <Link to="/notifications" className="rounded-full border border-white/80 bg-white/70 p-2 shadow-sm" aria-label="Notifications">
                <BellRing className="h-5 w-5 text-amber-600" />
              </Link>
              {activeOrganization ? (
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {activeOrganization.name}
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileNavOpen ? (
            <div className="md:hidden">
              <div className="px-4 pb-4">
                <label className="text-xs uppercase text-slate-500">Production</label>
                <div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold">
                  <select
                    value={activeOrganization?.id ?? ''}
                    onChange={(event) => {
                      handleOrgChange(event)
                      setMobileNavOpen(false)
                    }}
                    className="w-full bg-transparent outline-none"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id} className="text-slate-800">
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <nav className="space-y-2 px-4 pb-4">
                {navItems.map((item) => (
                  <Fragment key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600'
                        }`
                      }
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  </Fragment>
                ))}
              </nav>
            </div>
          ) : null}
        </header>

        <main className="px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-3xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-amber-100 p-2">
                        <Mail className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          Invitation to {invitation.organization_name || 'a production'}
                        </p>
                        <p className="text-sm text-slate-600">
                          {invitation.invited_by_name} invited you to join as {invitation.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => invitation.token && api.acceptInvitation(invitation.token)}
                        className="btn-primary text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => setDismissedInvites(prev => [...prev, invitation.id])}
                        className="rounded-full p-1 hover:bg-slate-100"
                        aria-label="Dismiss"
                      >
                        <X className="h-5 w-5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
