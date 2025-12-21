import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname.startsWith(path);

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col stars">
      {/* Header */}
      <header className="border-b border-[#1e3a5f] bg-[#0a0e17]/90 backdrop-blur-md py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-semibold text-[#00d4ff] flex items-center gap-2 text-glow">
            <Bell className="w-7 h-7" />
            Notifiq
          </Link>
          
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              to="/guide/quickstart" 
              className={`text-sm font-medium transition-colors ${isActive('/guide/quickstart') ? 'text-[#00d4ff]' : 'text-slate-400 hover:text-[#00d4ff]'}`}
            >
              Getting Started
            </Link>
            <Link 
              to="/guide" 
              className={`text-sm transition-colors ${isActive('/guide') ? 'text-[#00d4ff]' : 'text-slate-400 hover:text-[#00d4ff]'}`}
            >
              Docs
            </Link>
            <Link 
              to="/apps" 
              className={`text-sm transition-colors ${isActive('/apps') ? 'text-[#00d4ff]' : 'text-slate-400 hover:text-[#00d4ff]'}`}
            >
              Apps
            </Link>
            <a href="#self-host" className="text-sm text-slate-400 hover:text-[#00d4ff] transition-colors">
              Self-Host
            </a>
            <Link 
              to="/login" 
              className="text-sm border border-[#7c3aed] text-[#a78bfa] hover:bg-[#7c3aed]/20 px-4 py-2 rounded-lg transition-colors"
            >
              Log in
            </Link>
          </nav>
          
          {/* Mobile menu button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden text-slate-400 hover:text-[#00d4ff]"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#1e3a5f] mt-4 pt-4 px-4 pb-2 space-y-3">
            <Link to="/guide/quickstart" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400 hover:text-[#00d4ff]">
              Getting Started
            </Link>
            <Link to="/guide" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400 hover:text-[#00d4ff]">
              Docs
            </Link>
            <Link to="/apps" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400 hover:text-[#00d4ff]">
              Apps
            </Link>
            <a href="#self-host" onClick={() => setMobileMenuOpen(false)} className="block text-slate-400 hover:text-[#00d4ff]">
              Self-Host
            </a>
            <Link to="/login" className="block text-[#a78bfa]">
              Log in →
            </Link>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e3a5f] py-10">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Bell className="w-5 h-5 text-[#00d4ff]" />
            <span className="text-sm">
              A <a href="https://mydigitalharbor.com" className="text-[#00d4ff] hover:underline">Digital Harbor</a> project
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="https://github.com/pypeaday/notifiq" className="hover:text-[#00d4ff] transition-colors">GitHub</a>
            <Link to="/guide" className="hover:text-[#00d4ff] transition-colors">Docs</Link>
            <a href="/api/docs" className="hover:text-[#00d4ff] transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
