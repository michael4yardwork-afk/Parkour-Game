import React, { useState } from 'react';
import { Crown, Check, FolderKanban, LineChart, GitCompareArrows, Ghost, Blocks, BarChart3, Sparkles, Save, Mail, Loader2, BadgeCheck } from 'lucide-react';
import { synths } from '../audio';
import { api } from '../api';

type BillingCycle = 'monthly' | 'yearly';

const FEATURES: { icon: React.ReactNode; title: string; free: string; platinum: string }[] = [
  {
    icon: <FolderKanban className="w-4 h-4" />,
    title: 'Course publishing',
    free: 'Publish 1 Course',
    platinum: 'Unlimited Course Publishing',
  },
  {
    icon: <Ghost className="w-4 h-4" />,
    title: 'Ghost racing',
    free: 'No Ghost Racing',
    platinum: 'Race Ghosts from Around the World',
  },
  {
    icon: <LineChart className="w-4 h-4" />,
    title: 'Performance graphs',
    free: 'No Performance Graphs',
    platinum: 'Interactive Performance Graphs',
  },
  {
    icon: <GitCompareArrows className="w-4 h-4" />,
    title: 'Player comparisons',
    free: 'No Player Comparisons',
    platinum: 'Compare Performance with Any Player',
  },
  {
    icon: <Sparkles className="w-4 h-4" />,
    title: 'Icons & backgrounds',
    free: 'Basic Icons & Backgrounds',
    platinum: 'Exclusive Icons & Backgrounds',
  },
  {
    icon: <Save className="w-4 h-4" />,
    title: 'Course saving',
    free: "Can't Save Courses",
    platinum: 'Save Unlimited Courses',
  },
  {
    icon: <Mail className="w-4 h-4" />,
    title: 'Mail & notifications',
    free: 'Standard Mail',
    platinum: 'Premium Mail & Notifications',
  },
  {
    icon: <Blocks className="w-4 h-4" />,
    title: 'Course builder elements',
    free: 'Up to 50 Elements per Course',
    platinum: 'Up to 200 Elements per Course',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Statistics',
    free: 'No Advanced Statistics',
    platinum: 'Advanced Statistics & Insights',
  },
];

const SNEAK_PEEK: { icon: React.ReactNode; title: string; description: string; image: string }[] = [
  {
    icon: <LineChart className="w-4 h-4" />,
    title: 'Interactive performance graphs',
    description: 'Hover any run to inspect exact speed and progress at every second of the course.',
    image: '/marketing/leaderboard-compare.png?v=2',
  },
  {
    icon: <Ghost className="w-4 h-4" />,
    title: 'Race ghosts from the leaderboard',
    description: 'Load any world-ranked run as a live ghost and chase it through the course in real time.',
    image: '/marketing/leaderboard-ghost.png?v=2',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Advanced career statistics',
    description: 'Track completions, best world rank, race wins, and courses built from your dashboard.',
    image: '/marketing/activity-stats.png?v=2',
  },
  {
    icon: <Blocks className="w-4 h-4" />,
    title: 'Bigger, bolder course builds',
    description: 'Place up to 200 elements per course in the sandbox builder and publish as many as you like.',
    image: '/marketing/course-builder-full.png',
  },
];

interface UpgradeProps {
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  isPlatinum?: boolean;
  plan?: string | null;
  currentPeriodEnd?: number | null;
}

function formatRenewalDate(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Upgrade({ isLoggedIn, onRequireLogin, isPlatinum, plan, currentPeriodEnd }: UpgradeProps) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Awaited<ReturnType<typeof api.billing.getHistory>>['history']>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleSelect = (nextCycle: BillingCycle) => {
    setCycle(nextCycle);
    synths.playTick();
  };

  const handleSubscribeClick = async (selectedCycle: BillingCycle) => {
    synths.playTick();
    setError(null);

    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }

    setLoading(true);
    try {
      const { url } = await api.billing.startCheckout(selectedCycle);
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  const renewalDate = formatRenewalDate(currentPeriodEnd);
  const planLabel = plan === 'monthly' ? 'Monthly' : plan === 'yearly' ? 'Yearly' : null;

  React.useEffect(() => {
    if (!isLoggedIn) {
      setPaymentHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    api.billing.getHistory()
      .then(({ history }) => {
        if (!cancelled) setPaymentHistory(history);
      })
      .catch(() => {
        if (!cancelled) setPaymentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, isPlatinum, currentPeriodEnd]);

  const formatEventType = (eventType: string): string => {
    const labels: Record<string, string> = {
      checkout_completed: 'Initial payment',
      subscription_created: 'Subscription started',
      subscription_renewed: 'Renewal payment',
      subscription_updated: 'Subscription updated',
      subscription_cancelled: 'Subscription cancelled',
    };
    return labels[eventType] || eventType.replaceAll('_', ' ');
  };

  const formatAmount = (amountCents: number | null, currency: string | null): string => {
    if (amountCents === null || !currency) return '—';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Flowing rainbow backdrop */}
      <div className="absolute inset-0 bg-rainbow-flow" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-14 md:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 mb-5 shadow-sm">
            <Crown className="w-4 h-4 text-yellow-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Delta Rush Platinum</span>
          </div>
          {isPlatinum ? (
            <>
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-sm tracking-tight">
                You're on{' '}
                <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  Platinum
                </span>{' '}
                ✦
              </h1>
              <p className="mt-4 text-sm md:text-base text-white/90 max-w-xl mx-auto font-medium">
                All Platinum features are active on your account.
                {renewalDate && ` Your ${planLabel ? planLabel.toLowerCase() : ''} plan renews on ${renewalDate}.`}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-sm tracking-tight">
                Go Platinum. Race without limits.
              </h1>
              <p className="mt-4 text-sm md:text-base text-white/90 max-w-xl mx-auto font-medium">
                Unlock unlimited course publishing, full leaderboard tools, bigger course builds, and every special icon in the game.
              </p>
            </>
          )}
        </div>

        {/* Billing toggle — only shown when not yet platinum */}
        {!isPlatinum && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-1 shadow-sm">
              <button
                onClick={() => handleSelect('monthly')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
                  cycle === 'monthly' ? 'bg-white text-neutral-900 shadow' : 'text-white/90 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => handleSelect('yearly')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  cycle === 'yearly' ? 'bg-white text-neutral-900 shadow' : 'text-white/90 hover:text-white'
                }`}
              >
                Yearly
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${cycle === 'yearly' ? 'bg-emerald-500 text-white' : 'bg-white/25 text-white'}`}>
                  SAVE 30%
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-14">
          {/* Free plan (reference) */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/40 p-6 flex flex-col shadow-lg">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Regular</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black text-neutral-900">$0</span>
              <span className="text-sm font-semibold text-neutral-400">/ forever</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500 font-medium">Everything you have today — core racing, courses, and community features.</p>
            <div className="mt-6 h-px bg-neutral-150" />
            <ul className="mt-5 space-y-3 flex-1">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2.5 text-sm text-neutral-500">
                  <span className="mt-0.5 text-neutral-300">{f.icon}</span>
                  <span>{f.free}</span>
                </li>
              ))}
            </ul>
            <button
              disabled
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-bold bg-neutral-100 text-neutral-400 cursor-default"
            >
              {isPlatinum ? 'Free tier' : 'Current plan'}
            </button>
          </div>

          {/* Platinum plan */}
          <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-950 rounded-2xl border border-white/40 p-6 flex flex-col shadow-2xl ring-2 ring-yellow-300/60">
            {!isPlatinum && cycle === 'yearly' && (
              <div className="absolute -top-3 right-6 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow">
                Best Deal
              </div>
            )}
            {isPlatinum && (
              <div className="absolute -top-3 right-6 bg-gradient-to-r from-emerald-400 to-green-400 text-neutral-900 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" /> Active
              </div>
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Platinum
            </span>
            {isPlatinum ? (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    {planLabel ? `${planLabel} plan` : 'Active'}
                  </span>
                </div>
                {renewalDate && (
                  <p className="mt-1 text-sm text-white/60 font-medium">
                    Renews {renewalDate}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">
                    {cycle === 'monthly' ? '$2.99' : '$24.99'}
                  </span>
                  <span className="text-sm font-semibold text-white/50">
                    {cycle === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60 font-medium">
                  {cycle === 'monthly'
                    ? 'Billed monthly. Cancel anytime.'
                    : 'Just $2.08/month, billed annually.'}
                </p>
              </>
            )}
            <div className="mt-6 h-px bg-white/10" />
            <ul className="mt-5 space-y-3 flex-1">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2.5 text-sm text-white/90">
                  <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <span className="font-medium">{f.platinum}</span>
                </li>
              ))}
            </ul>

            {isPlatinum ? (
              <div className="mt-6 w-full py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-400 to-green-400 text-neutral-900 flex items-center justify-center gap-2 shadow-lg">
                <BadgeCheck className="w-4 h-4" />
                Your current plan
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleSubscribeClick(cycle)}
                  disabled={loading}
                  className="mt-6 w-full py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900 hover:brightness-105 active:scale-[0.98] transition shadow-lg cursor-pointer disabled:opacity-70 disabled:cursor-default flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout…
                    </>
                  ) : (
                    <>Get Platinum — {cycle === 'monthly' ? '$2.99/mo' : '$24.99/yr'}</>
                  )}
                </button>
                {error && (
                  <p className="mt-3 text-xs font-semibold text-red-300 text-center">{error}</p>
                )}
                {!isLoggedIn && !error && (
                  <p className="mt-3 text-xs font-medium text-white/60 text-center">
                    Log in or create an account to subscribe.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Platinum sneak peek — real in-game screenshots of what unlocks */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-3.5 py-1 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                {isPlatinum ? 'Your features' : 'Sneak peek'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white drop-shadow-sm tracking-tight">
              {isPlatinum ? 'Everything included in your plan' : 'See Platinum in action'}
            </h2>
            <p className="mt-2 text-xs md:text-sm text-white/80 max-w-lg mx-auto font-medium">
              {isPlatinum
                ? 'All of these features are live on your account right now.'
                : 'Real screens pulled straight from the game — this is exactly what\'s waiting for you.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {SNEAK_PEEK.map((s) => (
              <div key={s.title} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/40 shadow-lg overflow-hidden flex flex-col">
                <div className="bg-neutral-950 h-44 md:h-52 flex items-center justify-center overflow-hidden">
                  <img src={s.image} alt={s.title} className="w-full h-full object-contain" loading="lazy" />
                </div>
                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-neutral-800">{s.title}</div>
                    <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{s.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-white/70 text-xs font-medium mt-10">
          Subscriptions renew automatically until cancelled. Payments securely processed by Stripe.
        </p>

        {isLoggedIn && (
          <section className="max-w-4xl mx-auto mt-12 bg-black/20 backdrop-blur-sm border border-white/20 rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-black text-white">Your payment history</h2>
                <p className="text-xs text-white/65 mt-1">Only payments and subscription events for this account.</p>
              </div>
              <BadgeCheck className="w-5 h-5 text-emerald-300 shrink-0" />
            </div>

            {historyLoading ? (
              <p className="text-xs text-white/65">Loading payment history…</p>
            ) : paymentHistory.length === 0 ? (
              <p className="text-xs text-white/65">No payment history for this account yet.</p>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map(entry => (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/10 border border-white/10 rounded-xl px-3.5 py-3">
                    <div>
                      <div className="text-sm font-bold text-white capitalize">{formatEventType(entry.eventType)}</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        {new Date(entry.recordedAt).toLocaleDateString()} · {entry.plan ? `${entry.plan} plan` : 'Platinum'}
                      </div>
                    </div>
                    <div className="text-sm font-black text-white">{formatAmount(entry.amountCents, entry.currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
