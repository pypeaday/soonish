import { useAuth } from '../context/AuthContext'
import { PageHeading } from '../components/PageHeading'

const SettingsPage = () => {
  const { user, activeOrganization } = useAuth()

  return (
    <div className="space-y-8">
      <PageHeading
        title="Settings"
        description="Manage your account and preferences"
      />

      <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
        <h2 className="text-lg font-semibold text-slate-800">Account</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-sm text-slate-500">Name</dt>
            <dd className="font-medium text-slate-800">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Email</dt>
            <dd className="font-medium text-slate-800">{user?.email}</dd>
          </div>
        </dl>
      </section>

      {activeOrganization && (
        <section className="rounded-3xl bg-white p-6 shadow-lg shadow-amber-900/5">
          <h2 className="text-lg font-semibold text-slate-800">Current Production</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm text-slate-500">Name</dt>
              <dd className="font-medium text-slate-800">{activeOrganization.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Your Role</dt>
              <dd className="font-medium text-slate-800 capitalize">{activeOrganization.role}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-3xl bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Need Help?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Contact your production coordinator if you need to update your account information
          or have questions about the app.
        </p>
      </section>
    </div>
  )
}

export default SettingsPage
