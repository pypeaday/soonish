import { Layout } from '@/components/Layout';
import { APPS } from '@/lib/apps';

const categories = ['IT & DevOps', 'Events & Community', 'Personal & Productivity'];

export function AppsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 px-4 hero-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Apps built on <span className="text-[#00d4ff] text-glow">Notifiq</span>
          </h1>
          <p className="text-xl text-slate-400 mb-6">
            Different interfaces for different needs. Same powerful notification backend.
          </p>
          <p className="text-slate-500">
            <a href="/login" className="text-[#00d4ff] hover:underline">Log in</a> to access your apps, or explore what's available below.
          </p>
        </div>
      </section>

      {/* Apps Grid */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          {categories.map((category) => (
            <div key={category} className="mb-12">
              <h2 className="text-sm uppercase tracking-widest text-[#a78bfa] mb-6">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {APPS
                  .filter((app) => app.category === category)
                  .map((app) => (
                    <div
                      key={app.id}
                      className="group rounded-xl border border-[#1e3a5f] bg-[#111827] p-6 card-hover"
                      style={{ '--hover-border-color': `${app.color}50` } as React.CSSProperties}
                    >
                      <a href={app.path} className="block">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                          style={{ backgroundColor: `${app.color}15`, color: app.color }}
                        >
                          {app.icon}
                        </div>
                        <h3
                          className="text-lg font-semibold text-white mb-2 transition-colors group-hover:text-[var(--app-color)]"
                          style={{ '--app-color': app.color } as React.CSSProperties}
                        >
                          {app.name}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{app.description}</p>
                      </a>
                      {app.guidePath && (
                        <a href={app.guidePath} className="inline-block mt-3 text-xs text-[#00d4ff] hover:underline">
                          How it works →
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* CTA */}
          <div className="text-center py-12 border-t border-[#1e3a5f]">
            <h3 className="text-2xl font-semibold text-white mb-4">Ready to get started?</h3>
            <p className="text-slate-400 mb-6">Create an account and start using any of these apps in minutes.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/login"
                className="px-8 py-3 bg-gradient-to-r from-[#7c3aed] to-[#00d4ff] hover:from-[#8b5cf6] hover:to-[#22d3ee] text-white font-medium rounded-lg transition-all"
              >
                Get Started Free
              </a>
              <a
                href="/guide"
                className="px-8 py-3 border border-[#1e3a5f] text-slate-300 hover:bg-[#1e3a5f]/30 hover:border-[#00d4ff]/50 rounded-lg transition-all"
              >
                Read the Docs
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
