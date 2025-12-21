import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const { user, login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login({ email, password })
    } catch (err) {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="text-6xl">🎭</span>
          <h1 className="mt-4 text-3xl font-bold text-amber-900">Stage Manager</h1>
          <p className="mt-2 text-slate-600">Theater volunteer coordination made easy</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl bg-white p-8 shadow-xl shadow-amber-900/10">
          <h2 className="text-xl font-semibold text-slate-800">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to continue</p>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="••••••••"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account? Contact your production coordinator.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
