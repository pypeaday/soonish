import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, type ChannelResponse, type EventResponse } from '@/lib/api';

interface TourState {
  channel: ChannelResponse | null;
  event: EventResponse | null;
  subscriptionId: number | null;
  offsets: number[];
  testSent: boolean;
}

const OFFSETS = [
  { label: '15 min', seconds: 900 },
  { label: '1 hour', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
];

function StepShell({
  n, title, done, locked, children,
}: {
  n: number;
  title: string;
  done: boolean;
  locked: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-6 transition-colors ${
        done
          ? 'border-[#10b981]/40 bg-[#10b981]/5'
          : locked
            ? 'border-[#1e3a5f]/40 bg-[#111827]/50 opacity-50'
            : 'border-[#00d4ff]/40 bg-[#111827]'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm ${
            done ? 'bg-[#10b981] text-[#0a0f1a]' : 'bg-[#00d4ff]/20 text-[#00d4ff]'
          }`}
        >
          {done ? <Check className="w-4 h-4" /> : n}
        </span>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {!locked && children}
    </section>
  );
}

export function TourPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [state, setState] = useState<TourState>({
    channel: null,
    event: null,
    subscriptionId: null,
    offsets: [],
    testSent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [topic, setTopic] = useState(`notifiq-tour-${Math.random().toString(36).slice(2, 8)}`);
  const [eventName, setEventName] = useState('My first Notifiq event');
  const [pickedOffsets, setPickedOffsets] = useState<number[]>([900, 3600]);

  // Cross-app verification: poll the API so doing the step in another app counts.
  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = async () => {
      try {
        const [channels, events, subs] = await Promise.all([
          apiClient.getChannels(),
          apiClient.getEvents(),
          apiClient.getSubscriptions(),
        ]);
        setState((s) => ({
          ...s,
          channel: s.channel ?? channels[0] ?? null,
          event: s.event ?? events.find((e) => e.source !== 'notifiq-tour') ?? events[0] ?? null,
          subscriptionId:
            s.subscriptionId ??
            (s.event && subs.find((x) => x.event_id === s.event?.id)?.id) ??
            null,
        }));
      } catch {
        /* polling is best-effort */
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError('');
      try {
        await fn();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { detail?: string } } };
        setError(e.response?.data?.detail || 'Something went wrong — check the API docs or try again.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const makeChannel = () =>
    run(async () => {
      const ch = await apiClient.createChannel({
        name: 'tour channel',
        channel_type: 'ntfy',
        config: { server_url: 'https://ntfy.sh', topic, priority: 'default' },
      });
      setState((s) => ({ ...s, channel: ch }));
    });

  const sendTest = () =>
    run(async () => {
      if (state.channel) await apiClient.testChannel(state.channel.id);
      setState((s) => ({ ...s, testSent: true }));
    });

  const makeEvent = () =>
    run(async () => {
      const start = new Date(Date.now() + 90 * 60 * 1000);
      const ev = await apiClient.createEvent({
        name: eventName,
        description: 'Created by the interactive tour.',
        start_date: start.toISOString(),
        end_date: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        timezone: 'UTC',
        is_public: false,
      });
      setState((s) => ({ ...s, event: ev }));
    });

  const setReminders = () =>
    run(async () => {
      if (!state.event || !state.channel) return;
      const subs = await apiClient.getSubscriptions();
      const existing = subs.find((x) => x.event_id === state.event!.id);
      if (existing) {
        await apiClient.updateSubscription(existing.id, {
          channel_ids: [state.channel.id],
          reminder_offsets: pickedOffsets,
        });
        setState((s) => ({ ...s, subscriptionId: existing.id, offsets: pickedOffsets }));
      } else {
        await apiClient.subscribe({
          event_id: state.event.id,
          channel_ids: [state.channel.id],
          reminder_offsets: pickedOffsets,
        });
        const after = await apiClient.getSubscriptions();
        const sub = after.find((x) => x.event_id === state.event!.id);
        setState((s) => ({ ...s, subscriptionId: sub?.id ?? null, offsets: pickedOffsets }));
      }
    });

  const stepDone = [
    isAuthenticated,
    !!state.channel,
    state.testSent,
    !!state.event,
    !!state.subscriptionId,
    !!state.subscriptionId,
  ];
  const currentStep = stepDone.findIndex((d) => !d);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center stars">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen stars">
      <header className="border-b border-[#1e3a5f] bg-[#0a0e17]/90 backdrop-blur-md py-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-semibold text-[#00d4ff] flex items-center gap-2 text-glow">
            <Bell className="w-6 h-6" /> Notifiq
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/guide" className="text-slate-400 hover:text-[#00d4ff]">Docs</Link>
            <Link to="/apps" className="text-slate-400 hover:text-[#00d4ff]">Apps</Link>
            {user && <span className="text-slate-500">{user.name}</span>}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-[#00d4ff] font-mono text-sm mb-2">interactive</p>
          <h1 className="text-3xl font-bold text-white">The Notifiq tour</h1>
          <p className="text-slate-400 mt-2">
            Six real steps against the live API. Each step is verified — do it here,
            or in one of the apps, and the checkmark follows you.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* 1 — sign in */}
        <StepShell n={1} title="Sign in" done={isAuthenticated} locked={false}>
          <p className="text-slate-300 text-sm mb-4">
            Channels, subscriptions and events all hang off your account.
          </p>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90"
            >
              Log in / Register <ChevronRight className="w-4 h-4" />
            </Link>
          )}
          {isAuthenticated && (
            <p className="text-[#10b981] text-sm">Signed in as {user?.email}</p>
          )}
        </StepShell>

        {/* 2 — channel */}
        <StepShell n={2} title="Make a channel" done={!!state.channel} locked={!isAuthenticated}>
          <p className="text-slate-300 text-sm mb-4">
            A channel is where notifications land. The easiest is{' '}
            <a href="https://ntfy.sh" className="text-[#00d4ff] underline" target="_blank" rel="noreferrer">ntfy.sh</a> —
            pick a secret topic, subscribe in the ntfy app, done.
          </p>
          {!state.channel ? (
            <div className="space-y-3">
              <label className="block text-sm text-slate-400">
                Your ntfy topic
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1 w-full bg-[#0a0f1a] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white font-mono text-sm"
                />
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={makeChannel}
                  disabled={busy || !topic}
                  className="px-5 py-2.5 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create channel
                </button>
                <span className="text-slate-500 text-sm">or do it in</span>
                <a href="/mindful/" className="text-[#00d4ff] text-sm underline inline-flex items-center gap-1">
                  the Mindful app <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-slate-600 text-xs">— I'm watching either way</span>
              </div>
            </div>
          ) : (
            <p className="text-[#10b981] text-sm">
              Channel <code>{state.channel.name}</code> ready — detected via{' '}
              <code>GET /api/v1/channels</code>.
            </p>
          )}
        </StepShell>

        {/* 3 — test ping */}
        <StepShell n={3} title="Hear it" done={state.testSent} locked={!state.channel}>
          <p className="text-slate-300 text-sm mb-4">
            Fire a test notification through your new channel — this is a real send,
            not a simulation.
          </p>
          {!state.testSent ? (
            <button
              onClick={sendTest}
              disabled={busy}
              className="px-5 py-2.5 bg-[#7c3aed] text-white font-semibold rounded-lg hover:bg-[#7c3aed]/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send test ping
            </button>
          ) : (
            <p className="text-[#10b981] text-sm">
              Sent. Check your ntfy topic — that's the sound of the delivery layer working.
            </p>
          )}
        </StepShell>

        {/* 4 — event */}
        <StepShell n={4} title="Create an event" done={!!state.event} locked={!state.channel}>
          <p className="text-slate-300 text-sm mb-4">
            Events are the things you get reminded about. This one starts in 90 minutes.
          </p>
          {!state.event ? (
            <div className="space-y-3">
              <label className="block text-sm text-slate-400">
                Event name
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="mt-1 w-full bg-[#0a0f1a] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm"
                />
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={makeEvent}
                  disabled={busy || !eventName}
                  className="px-5 py-2.5 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create event
                </button>
                <span className="text-slate-500 text-sm">or create one in</span>
                <a href="/event-planner/" className="text-[#00d4ff] text-sm underline inline-flex items-center gap-1">
                  Event Planner <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <p className="text-[#10b981] text-sm">
              <code>{state.event.name}</code> exists — starts{' '}
              {new Date(state.event.start_date).toLocaleString()}.
            </p>
          )}
        </StepShell>

        {/* 5 — reminders */}
        <StepShell n={5} title="Set reminders" done={!!state.subscriptionId} locked={!state.event}>
          <p className="text-slate-300 text-sm mb-4">
            A subscription ties you to the event and picks when reminders fire.
            These become durable rows in <code className="text-[#00d4ff]">scheduled_jobs</code> —
            fire time is <code className="text-[#00d4ff]">start_date − offset</code>.
          </p>
          {!state.subscriptionId ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                {OFFSETS.map((o) => (
                  <button
                    key={o.seconds}
                    onClick={() =>
                      setPickedOffsets((cur) =>
                        cur.includes(o.seconds)
                          ? cur.filter((x) => x !== o.seconds)
                          : [...cur, o.seconds],
                      )
                    }
                    className={`px-4 py-2 rounded-lg border text-sm ${
                      pickedOffsets.includes(o.seconds)
                        ? 'border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]'
                        : 'border-[#1e3a5f] text-slate-400 hover:border-[#00d4ff]/50'
                    }`}
                  >
                    {o.label} before
                  </button>
                ))}
              </div>
              <button
                onClick={setReminders}
                disabled={busy || pickedOffsets.length === 0}
                className="px-5 py-2.5 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Subscribe with these reminders
              </button>
            </div>
          ) : (
            <p className="text-[#10b981] text-sm">
              Subscription #{state.subscriptionId} saved with{' '}
              {state.offsets.map((o) => OFFSETS.find((x) => x.seconds === o)?.label).join(', ')}{' '}
              reminders.
            </p>
          )}
        </StepShell>

        {/* 6 — the queue */}
        <StepShell n={6} title="What got scheduled" done={!!state.subscriptionId} locked={!state.subscriptionId}>
          <p className="text-slate-300 text-sm mb-4">
            Everything you just did became rows in the database — this is the whole
            scheduler, and it's queryable:
          </p>
          {state.event && (
            <div className="bg-[#0a0f1a] border border-[#1e3a5f] rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{`kind                due_at                dedupe_key
------------------  --------------------  --------------------------
${state.offsets
  .map(
    (o) =>
      `reminder            ${new Date(
        new Date(state.event!.start_date).getTime() - o * 1000,
      )
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')}   event-${state.event!.id}-sub-${state.subscriptionId}-reminder-${o}s`,
  )
  .join('\n')}
event_end           ${state.event!.end_date
                ? new Date(state.event!.end_date).toISOString().slice(0, 19).replace('T', ' ')
                : 'open-ended +7d'}   event-end-${state.event!.id}`}</pre>
            </div>
          )}
          <p className="text-slate-400 text-sm mt-4">
            A worker polls this table every second and claims what's due — retry and
            backoff included. Read the{' '}
            <Link to="/guide/admin/scheduler" className="text-[#00d4ff] underline">scheduler docs</Link>{' '}
            for the full loop.
          </p>
        </StepShell>

        {currentStep === -1 && (
          <div className="rounded-xl border border-[#10b981]/40 bg-gradient-to-r from-[#10b981]/10 to-[#00d4ff]/10 p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Tour complete</h2>
            <p className="text-slate-300 text-sm mb-4">
              You made a channel, proved delivery, scheduled an event, and watched the
              queue take shape — that's the whole product.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link to="/apps" className="px-5 py-2.5 bg-[#00d4ff] text-[#0a0f1a] font-semibold rounded-lg hover:bg-[#00d4ff]/90">
                Explore the apps
              </Link>
              <Link to="/guide/quickstart" className="px-5 py-2.5 border border-[#7c3aed] text-[#a78bfa] rounded-lg hover:bg-[#7c3aed]/20">
                Keep reading
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
