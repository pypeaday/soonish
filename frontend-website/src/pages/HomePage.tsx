import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import {
  Calendar,
  Bell,
  Users,
  Server,
  Lock,
  Layers,
  Check,
} from "lucide-react";

export function HomePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-24 px-4 hero-gradient">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm uppercase tracking-widest text-[#a78bfa] mb-4 animate-fade-in-up">
            Designed for you • Whoever you are
          </p>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in-up">
            Notifications on{" "}
            <span className="text-[#00d4ff] text-glow">your</span>{" "}
            infrastructure
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto animate-fade-in-up">
            A self-hostable notification platform with workflow orchestration.
            Run it anywhere—your homelab, your cloud, your rules.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-fade-in-up">
            <Link
              to="/guide/quickstart"
              className="px-8 py-3.5 bg-gradient-to-r from-[#7c3aed] to-[#00d4ff] hover:from-[#8b5cf6] hover:to-[#22d3ee] text-white font-medium rounded-lg btn-glow transition-all"
            >
              Getting Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-3.5 border border-[#1e3a5f] text-slate-300 hover:bg-[#1e3a5f]/30 hover:border-[#00d4ff]/50 rounded-lg transition-all"
            >
              Log In
            </Link>
            <Link
              to="/guide"
              className="px-8 py-3.5 border border-[#1e3a5f] text-slate-300 hover:bg-[#1e3a5f]/30 hover:border-[#00d4ff]/50 rounded-lg transition-all"
            >
              The Docs
            </Link>
            {/* <a */}
            {/*   href="/guide" */}
            {/*   className="px-8 py-3.5 border border-[#1e3a5f] text-slate-300 hover:bg-[#1e3a5f]/30 hover:border-[#00d4ff]/50 rounded-lg inline-flex items-center justify-center gap-2 transition-all" */}
            {/* > */}
            {/*   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"> */}
            {/*     <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /> */}
            {/*   </svg> */}
            {/*   The Docs */}
            {/* </a> */}
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500 animate-fade-in-up">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#00d4ff]" />
              Docker Compose ready
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#7c3aed]" />
              Temporal workflows
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10b981]" />
              Multi-channel delivery
            </span>
          </div>
        </div>
      </section>

      {/* Self-Host Section */}
      <section
        id="self-host"
        className="bg-[#0a0e17]/80 border-y border-[#1e3a5f] py-20 px-4"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-white">
              Run it yourself
            </h2>
            <p className="text-slate-400 mt-3">
              Full control. No vendor lock-in. Your data stays yours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 card-hover hover:border-[#00d4ff]/30">
              <div className="w-12 h-12 bg-[#00d4ff]/10 rounded-xl flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-[#00d4ff]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Homelab Ready
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Single docker-compose for everything. Runs on a Raspberry Pi or
                a full rack.
              </p>
            </div>

            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 card-hover hover:border-[#7c3aed]/30">
              <div className="w-12 h-12 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-[#7c3aed]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Your Data</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                SQLite for simplicity and performance. Channel credentials
                encrypted at rest. No user tracking.
              </p>
            </div>

            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 card-hover hover:border-[#10b981]/30">
              <div className="w-12 h-12 bg-[#10b981]/10 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-[#10b981]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Modular Apps
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Build your own on the developer API.
              </p>
            </div>
          </div>

          {/*           <div className="mt-10 bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 card-hover hover:border-[#00d4ff]/30"> */}
          {/*             <p className="text-xs uppercase tracking-widest text-[#a78bfa] mb-3"> */}
          {/*               Quick Start */}
          {/*             </p> */}
          {/*             <pre className="text-sm text-[#00d4ff] overflow-x-auto"> */}
          {/*               <code>{`git clone https://github.com/pypeaday/notifiq */}
          {/* cd notifiq */}
          {/* docker compose up -d`}</code> */}
          {/*             </pre> */}
          {/*           </div> */}
        </div>
      </section>

      {/* Concepts Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-[#a78bfa] mb-2">
              How It Works
            </p>
            <h2 className="text-3xl font-semibold text-white">Core Concepts</h2>
            <p className="text-slate-400 mt-3">
              Three building blocks. That's all you need to know.
            </p>
          </div>

          <div className="space-y-6">
            {/* Events */}
            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 flex gap-6 card-hover hover:border-[#00d4ff]/30">
              <div className="flex-shrink-0 w-14 h-14 bg-[#00d4ff]/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-7 h-7 text-[#00d4ff]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Events</h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Something that happens at a time. A meeting, a deploy, a
                  reminder, an incident. Events have a start time, optional end
                  time, and metadata you define.
                </p>
              </div>
            </div>

            {/* Subscriptions */}
            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 flex gap-6 card-hover hover:border-[#7c3aed]/30">
              <div className="flex-shrink-0 w-14 h-14 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center">
                <Bell className="w-7 h-7 text-[#7c3aed]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Subscriptions
                </h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Who gets notified about what. Subscribe to specific events and
                  choose which channels receive notifications. Auto-subscribe to
                  future events by tagging your channels.
                </p>
              </div>
            </div>

            {/* Channels */}
            <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 flex gap-6 card-hover hover:border-[#10b981]/30">
              <div className="flex-shrink-0 w-14 h-14 bg-[#10b981]/10 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-[#10b981]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Channels</h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Where notifications go. Slack, Discord, email, Gotify, ntfy,
                  Pushover—anything Apprise supports. Tag channels to
                  auto-subscribe to matching events.
                </p>
              </div>
            </div>
          </div>

          {/* Flow diagram */}
          <div className="mt-12 bg-[#111827] border border-[#1e3a5f] rounded-xl p-6 card-hover hover:border-[#00d4ff]/30">
            <p className="text-xs uppercase tracking-widest text-[#a78bfa] mb-4">
              Typical Flow
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="bg-[#00d4ff]/20 text-[#00d4ff] px-4 py-2 rounded-lg font-medium">
                Create Event
              </span>
              <span className="text-[#1e3a5f]">→</span>
              <span className="bg-[#1e3a5f]/50 text-slate-300 px-4 py-2 rounded-lg">
                Subscribers Matched
              </span>
              <span className="text-[#1e3a5f]">→</span>
              <span className="bg-[#1e3a5f]/50 text-slate-300 px-4 py-2 rounded-lg">
                Reminders Scheduled
              </span>
              <span className="text-[#1e3a5f]">→</span>
              <span className="bg-[#7c3aed]/20 text-[#a78bfa] px-4 py-2 rounded-lg font-medium">
                Notifications Sent
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-10">
            Tag your channels once, get notified about matching events
            automatically.
          </p>
        </div>
      </section>

      {/* Apps Preview */}
      <section className="bg-[#0a0e17]/80 border-y border-[#1e3a5f] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-[#a78bfa] mb-2">
              Showcase
            </p>
            <h2 className="text-3xl font-semibold text-white">
              Apps built on Notifiq
            </h2>
            <p className="text-slate-400 mt-3">
              Different interfaces, same powerful backend.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/apps"
              className="group block rounded-xl border border-[#1e3a5f] bg-[#111827] p-5 card-hover hover:border-[#ef4444]/50"
            >
              <p className="text-xs tracking-widest text-[#ef4444] mb-1">
                IT OPS
              </p>
              <h3 className="text-lg font-medium text-white group-hover:text-[#ef4444] transition-colors">
                Duty Pager
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Incident feed with runbooks and on-call roles.
              </p>
            </Link>

            <Link
              to="/apps"
              className="group block rounded-xl border border-[#1e3a5f] bg-[#111827] p-5 card-hover hover:border-[#f59e0b]/50"
            >
              <p className="text-xs tracking-widest text-[#f59e0b] mb-1">
                COMMUNITY
              </p>
              <h3 className="text-lg font-medium text-white group-hover:text-[#f59e0b] transition-colors">
                Volunteer Coordinator
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Role-based scheduling for community events.
              </p>
            </Link>

            <Link
              to="/apps"
              className="group block rounded-xl border border-[#1e3a5f] bg-[#111827] p-5 card-hover hover:border-[#a78bfa]/50"
            >
              <p className="text-xs tracking-widest text-[#a78bfa] mb-1">
                PRODUCTIVITY
              </p>
              <h3 className="text-lg font-medium text-white group-hover:text-[#a78bfa] transition-colors">
                Mindful
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                ADHD-friendly reminders and focus timers.
              </p>
            </Link>
          </div>

          <p className="text-center text-sm text-slate-500 mt-10">
            <Link to="/apps" className="text-[#00d4ff] hover:underline">
              View all apps →
            </Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
