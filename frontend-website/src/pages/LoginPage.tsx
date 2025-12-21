import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { login, register, isAuthenticated, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isDev = import.meta.env.DEV;

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login('test1@example.com', 'password123');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center stars">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center stars p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#00d4ff] mb-4">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Notifiq
          </h1>
          <p className="text-[#94a3b8] mt-2">Self-hosted notifications</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-8 cosmic-glow">
          <h2 className="text-xl font-semibold text-center text-white mb-6">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Your name"
                  className="w-full px-4 py-3 bg-[#0a0e17] border border-[#1e3a5f] rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-colors"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-[#0a0e17] border border-[#1e3a5f] rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#0a0e17] border border-[#1e3a5f] rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00d4ff] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#7c3aed] to-[#00d4ff] hover:from-[#8b5cf6] hover:to-[#22d3ee] text-white font-medium rounded-lg btn-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {isRegister ? 'Creating...' : 'Signing in...'}
                </span>
              ) : (
                isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-sm text-[#94a3b8] hover:text-[#00d4ff] transition-colors"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          {isDev && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1e3a5f]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#111827] text-[#64748b]">dev mode</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-3 bg-[#1e3a5f] hover:bg-[#2d4a6f] text-[#94a3b8] font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Demo Login (test1@example.com)
              </button>
            </>
          )}
        </div>

        {/* Navigation links */}
        <div className="flex justify-center gap-6 text-sm text-[#64748b] mt-6">
          <a href="/" className="hover:text-[#00d4ff] transition-colors">
            Home
          </a>
          <a href="/apps" className="hover:text-[#00d4ff] transition-colors">
            Apps
          </a>
          <a href="/guide" className="hover:text-[#00d4ff] transition-colors">
            Docs
          </a>
        </div>
      </div>
    </div>
  );
}
