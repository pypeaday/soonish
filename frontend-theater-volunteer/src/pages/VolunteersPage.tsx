import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Loader2, Mail, MailPlus, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api-client'
import { PageHeading } from '../components/PageHeading'

const VolunteersPage = () => {
  const { activeOrganization } = useAuth()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteError, setInviteError] = useState('')

  const isAdmin = activeOrganization?.role === 'admin'

  const membersQuery = useQuery({
    queryKey: ['org', activeOrganization?.id, 'members'],
    queryFn: () => api.listOrganizationMembers(activeOrganization!.id),
    enabled: Boolean(activeOrganization),
  })

  const invitationsQuery = useQuery({
    queryKey: ['org', activeOrganization?.id, 'invitations'],
    queryFn: () => api.listOrganizationInvitations(activeOrganization!.id),
    enabled: Boolean(activeOrganization && isAdmin),
  })

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteOrganizationMember(activeOrganization!.id, inviteEmail, inviteRole),
    onSuccess: () => {
      setInviteEmail('')
      setInviteError('')
      queryClient.invalidateQueries({ queryKey: ['org', activeOrganization?.id] })
    },
    onError: (err: any) => {
      setInviteError(err?.response?.data?.detail ?? 'Could not send invitation')
    },
  })

  const members = membersQuery.data ?? []
  const pendingInvites = (invitationsQuery.data ?? []).filter(i => i.status === 'pending')

  return (
    <div className="space-y-8">
      <PageHeading
        title="Volunteers"
        description={`${members.length} members in ${activeOrganization?.name ?? 'your production'}`}
      />

      {isAdmin && (
        <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MailPlus className="h-5 w-5 text-amber-600" />
            Invite a volunteer
          </h2>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (inviteEmail.trim()) inviteMutation.mutate()
            }}
          >
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="parent@example.com"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-amber-400"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
            >
              <option value="member">Member</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="btn-primary"
            >
              {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}

          {pendingInvites.length > 0 && (
            <div className="mt-4 space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span>{inv.email}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{inv.role}</span>
                  <span className="text-xs">pending</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {membersQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-lg shadow-amber-900/5">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-800">No volunteers yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Invite parents and volunteers to join your production.
          </p>
        </div>
      ) : (
        <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-amber-200"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-semibold">
                    {member.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{member.user_name}</p>
                    <p className="text-xs text-slate-500 truncate">{member.user_email}</p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                      {member.role}
                    </span>
                  </div>
                </div>

                {member.preferred_roles && member.preferred_roles.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Preferred roles:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {member.preferred_roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={`mailto:${member.user_email}`}
                    className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default VolunteersPage
