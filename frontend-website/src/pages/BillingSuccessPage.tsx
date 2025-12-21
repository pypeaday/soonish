import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export function BillingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center stars">
      <div className="text-center max-w-md mx-auto px-4">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Payment Successful!</h1>
        <p className="text-slate-400 mb-8">
          Thank you for your subscription. Your account has been upgraded and you now have access to all premium features.
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-[#00d4ff] text-[#0a0e17] px-6 py-3 rounded-lg font-semibold hover:bg-[#00b8e6] transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
