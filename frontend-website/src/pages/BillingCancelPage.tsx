import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export function BillingCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center stars">
      <div className="text-center max-w-md mx-auto px-4">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Payment Cancelled</h1>
        <p className="text-slate-400 mb-8">
          Your payment was cancelled. No charges were made. If you have any questions, please contact support.
        </p>
        <div className="space-x-4">
          <Link
            to="/dashboard"
            className="inline-block bg-[#1e3a5f] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2a4a6f] transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-block text-[#00d4ff] hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
