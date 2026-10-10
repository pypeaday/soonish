import { AppHeader } from '../components/AppHeader';

export function GuidePage() {
  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="card p-6">
          <h2 className="text-xl font-semibold text-white">What is the Eisenhower Matrix?</h2>
          <p className="text-surface-400 mt-2 leading-relaxed">
            The Eisenhower Matrix is a simple 2x2 way to decide what to do next. You sort tasks using two questions:
            Is it urgent? Is it important?
          </p>
          <p className="text-surface-400 mt-2 leading-relaxed">
            The goal isn’t to track everything forever — it’s to get clarity and spend time on the work that matters.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">The four quadrants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 border-l-4 border-q1-500">
              <div className="font-semibold text-white">Quadrant 1: Urgent + Important (Do First)</div>
              <div className="text-surface-400 mt-2">Tasks that need attention now and materially affect your goals.</div>
              <div className="text-surface-500 mt-1 text-sm">Example: deadlines, crises, time-sensitive commitments.</div>
            </div>
            <div className="card p-5 border-l-4 border-q2-500">
              <div className="font-semibold text-white">Quadrant 2: Not urgent + Important (Schedule)</div>
              <div className="text-surface-400 mt-2">High-value tasks that improve your life/work over time.</div>
              <div className="text-surface-500 mt-1 text-sm">Example: planning, exercise, learning, relationship time.</div>
            </div>
            <div className="card p-5 border-l-4 border-q3-500">
              <div className="font-semibold text-white">Quadrant 3: Urgent + Not important (Delegate)</div>
              <div className="text-surface-400 mt-2">Noise that feels urgent but doesn’t move your goals forward.</div>
              <div className="text-surface-500 mt-1 text-sm">Example: many emails, interruptions, some meetings.</div>
            </div>
            <div className="card p-5 border-l-4 border-q4-500">
              <div className="font-semibold text-white">Quadrant 4: Not urgent + Not important (Eliminate)</div>
              <div className="text-surface-400 mt-2">Low-value tasks that consume time without benefit.</div>
              <div className="text-surface-500 mt-1 text-sm">Example: doom-scrolling, busywork, unnecessary chores.</div>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-semibold text-white">Prioritization vs tracking</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="card p-5">
              <div className="font-semibold text-white">Prioritization</div>
              <p className="text-surface-400 mt-2">
                Helps you choose what to work on and what to ignore, based on urgency and importance.
              </p>
            </div>
            <div className="card p-5">
              <div className="font-semibold text-white">Tracking</div>
              <p className="text-surface-400 mt-2">
                Helps you monitor progress and ensure tasks get done. Tracking can be useful, but it’s not the same as prioritizing.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-semibold text-white">How to use it (quick steps)</h2>
          <ol className="list-decimal list-inside mt-3 space-y-2 text-surface-400">
            <li>List everything you’re carrying (brain dump).</li>
            <li>Drag each task into a quadrant based on urgency and importance.</li>
            <li>Start with Quadrant 1, then protect time for Quadrant 2.</li>
            <li>Delegate Quadrant 3 when possible.</li>
            <li>Delete or avoid Quadrant 4.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
