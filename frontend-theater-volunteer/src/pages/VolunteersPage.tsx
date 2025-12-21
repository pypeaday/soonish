import { useQuery } from '@tanstack/react-query'
import { Loader2, Mail, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api-client'
import { PageHeading } from '../components/PageHeading'

const VolunteersPage = () => {
  const { activeOrganization } = useAuth()

  const membersQuery = useQuery({
    queryKey: ['org', activeOrganization?.id, 'members'],
    queryFn: () => api.listOrganizationMembers(activeOrganization!.id),
    enabled: Boolean(activeOrganization),
  })

  const members = membersQuery.data ?? []

  return (
    <div className="space-y-8">
      <PageHeading
        title="Volunteers"
        description={`${members.length} members in ${activeOrganization?.name ?? 'your production'}`}
      />

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
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
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
