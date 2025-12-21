import { DocsLayout } from '../../DocsLayout';
import { Link } from 'react-router-dom';

export function AuthApiPage() {
  return (
    <DocsLayout
      title="Authentication API"
      description="API endpoints for authentication and authorization."
    >
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4">Overview</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Notifiq uses JWT tokens for API authentication. Tokens are obtained via login 
        and included in the <code className="bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-1 rounded">Authorization</code> header.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Endpoints</h2>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/auth/register</h3>
      <p className="text-slate-300 mb-4">Create a new user account.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}

# Response 201
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "tier": "free",
  "is_verified": false
}`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/auth/login</h3>
      <p className="text-slate-300 mb-4">Authenticate and get an access token.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request (form data)
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=securepassword

# Request (JSON)
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

# Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}`}</pre>
      </div>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">GET /api/v1/users/me</h3>
      <p className="text-slate-300 mb-4">Get the current authenticated user.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
GET /api/v1/users/me
Authorization: Bearer <token>

# Response 200
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "tier": "free",
  "is_verified": true
}`}</pre>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Using Tokens</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        Include the token in the Authorization header for all authenticated requests:
      </p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300">
        <code>Authorization: Bearer eyJhbGciOiJIUzI1NiIs...</code>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">API Tokens</h2>
      <p className="text-slate-300 leading-relaxed mb-4">
        For scripts and automation, create long-lived API tokens instead of using login credentials.
      </p>

      <h3 className="text-xl font-medium text-white mt-6 mb-3">POST /api/v1/tokens</h3>
      <p className="text-slate-300 mb-4">Create an API token.</p>
      <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 my-4 font-mono text-sm text-slate-300 overflow-x-auto">
        <pre>{`# Request
POST /api/v1/tokens
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Script Token",
  "expires_in_days": 365
}

# Response 201
{
  "id": 1,
  "name": "My Script Token",
  "token": "ntfq_abc123...",  // Only shown once!
  "expires_at": "2025-12-20T00:00:00Z"
}`}</pre>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 my-6">
        <p className="text-yellow-200">
          <strong>Important:</strong> API tokens are only shown once when created. 
          Store them securely. They cannot be retrieved later.
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Error Responses</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-slate-300">Status</th>
              <th className="text-left py-3 px-4 text-slate-300">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">401</td>
              <td className="py-3 px-4">Invalid credentials or expired token</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">403</td>
              <td className="py-3 px-4">Insufficient permissions</td>
            </tr>
            <tr className="border-b border-[#1e3a5f]/50">
              <td className="py-3 px-4">422</td>
              <td className="py-3 px-4">Validation error (check request body)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold text-white mt-10 mb-4">Next Steps</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/guide/admin/api/events" className="text-[#00d4ff] hover:underline">
            Events API
          </Link>
          <span className="text-slate-400"> — Create and manage events</span>
        </li>
        <li>
          <Link to="/guide/admin/api/channels" className="text-[#00d4ff] hover:underline">
            Channels API
          </Link>
          <span className="text-slate-400"> — Configure notification channels</span>
        </li>
      </ul>
    </DocsLayout>
  );
}
