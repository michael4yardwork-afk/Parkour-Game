import React, { useState } from 'react';
import { Crown, Check, FolderKanban, LineChart, GitCompareArrows, Ghost, Blocks, BarChart3, Sparkles, Save, Mail } from 'lucide-react';
import { synths } from '../audio';

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
    image: '/marketing/leaderboard-compare.png',
  },
  {
    icon: <Ghost className="w-4 h-4" />,
    title: 'Race ghosts from the leaderboard',
    description: 'Load any world-ranked run as a live ghost and chase it through the course in real time.',
    image: '/marketing/leaderboard-ghost.png',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Advanced career statistics',
    description: 'Track completions, best world rank, race wins, and courses built from your dashboard.',
    image: '/marketing/activity-stats.png',
  },
  {
    icon: <Blocks className="w-4 h-4" />,
    title: 'Bigger, bolder course builds',
    description: 'Place up to 200 elements per course in the sandbox builder and publish as many as you like.',
    image: '/marketing/course-builder-full.png',
  },
];

interface UpgradeProps {
  onSubscribe?: (cycle: BillingCycle) => void;
}

export default function Upgrade({ onSubscribe }: UpgradeProps) {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');

  const handleSelect = (nextCycle: BillingCycle) => {
    setCycle(nextCycle);
    synths.playTick();
  };

  const handleSubscribeClick = (selectedCycle: BillingCycle) => {
    synths.playTick();
    onSubscribe?.(selectedCycle);
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
          <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-sm tracking-tight">
            Go Platinum. Race without limits.
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/90 max-w-xl mx-auto font-medium">
            Unlock unlimited course publishing, full leaderboard tools, bigger course builds, and every special icon in the game.
          </p>
        </div>

        {/* Billing toggle */}
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
              Current plan
            </button>
          </div>

          {/* Platinum plan */}
          <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-950 rounded-2xl border border-white/40 p-6 flex flex-col shadow-2xl ring-2 ring-yellow-300/60">
            <div className="absolute -top-3 right-6 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow">
              Most Popular
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Platinum
            </span>
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
            <div className="mt-6 h-px bg-white/10" />
            <ul className="mt-5 space-y-3 flex-1">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2.5 text-sm text-white/90">
                  <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <span className="font-medium">{f.platinum}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribeClick(cycle)}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900 hover:brightness-105 active:scale-[0.98] transition shadow-lg cursor-pointer"
            >
              Get Platinum — {cycle === 'monthly' ? '$2.99/mo' : '$24.99/yr'}
            </button>
          </div>
        </div>

        {/* Platinum sneak peek — real in-game screenshots of what unlocks */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-3.5 py-1 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">Sneak peek</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white drop-shadow-sm tracking-tight">
              See Platinum in action
            </h2>
            <p className="mt-2 text-xs md:text-sm text-white/80 max-w-lg mx-auto font-medium">
              Real screens pulled straight from the game — this is exactly what's waiting for you.
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
      </div>
    </div>
  );
}
