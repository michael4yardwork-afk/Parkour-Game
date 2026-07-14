import React, { useState } from 'react';
import { Crown, Check, FolderKanban, Users, LineChart, GitCompareArrows, Ghost, Blocks, BarChart3, Sparkles } from 'lucide-react';
import { synths } from '../audio';

type BillingCycle = 'monthly' | 'yearly';

const FEATURES: { icon: React.ReactNode; title: string; free: string; platinum: string }[] = [
  {
    icon: <FolderKanban className="w-4 h-4" />,
    title: 'Published courses',
    free: '1 course',
    platinum: 'Unlimited courses',
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: 'Followers',
    free: 'Cannot follow or be followed',
    platinum: 'Follow and be followed by anyone',
  },
  {
    icon: <LineChart className="w-4 h-4" />,
    title: 'Leaderboard graphs',
    free: 'Not available',
    platinum: 'Full access on every leaderboard',
  },
  {
    icon: <GitCompareArrows className="w-4 h-4" />,
    title: 'Compare feature',
    free: 'Not available',
    platinum: 'Compare runs on any leaderboard',
  },
  {
    icon: <Ghost className="w-4 h-4" />,
    title: 'Ghost racing',
    free: 'Not available',
    platinum: 'Race ghosts from any leaderboard',
  },
  {
    icon: <Blocks className="w-4 h-4" />,
    title: 'Course builder elements',
    free: 'Up to 50 elements',
    platinum: 'Up to 200 elements',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Statistics',
    free: 'Hidden on Dashboard & Races',
    platinum: 'Full stats on Dashboard & Races',
  },
  {
    icon: <Sparkles className="w-4 h-4" />,
    title: 'Special icons & backgrounds',
    free: 'Standard set only',
    platinum: 'Every ⭐ special icon & background',
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

        {/* Feature comparison detail */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/40 shadow-lg overflow-hidden max-w-3xl mx-auto">
          <div className="px-6 py-4 border-b border-neutral-150">
            <h2 className="text-sm font-bold text-neutral-800">What changes with Platinum</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {FEATURES.map((f) => (
              <li key={f.title} className="px-6 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-neutral-800">{f.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{f.free}</div>
                </div>
                <div className="text-xs font-bold text-emerald-600 text-right shrink-0 max-w-[45%]">
                  {f.platinum}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-white/70 text-xs font-medium mt-10">
          Subscriptions renew automatically until cancelled. Payments securely processed by Stripe.
        </p>
      </div>
    </div>
  );
}
