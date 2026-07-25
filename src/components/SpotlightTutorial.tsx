import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { synths } from '../audio';

interface SpotlightTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Block visual chip ─────────────────────────────────────────────────────────
// Rendered inline inside .map() to keep the `key` on a native div (React 19 TS compat).

const BLOCKS = [
  { label: 'Start',       color: '#10b981', dark: '#059669' },
  { label: 'Finish',      color: '#2563eb', dark: '#1d4ed8' },
  { label: 'Normal',      color: '#64748b', dark: '#334155' },
  { label: 'Jump Pad',    color: '#f59e0b', dark: '#d97706' },
  { label: 'Wall Run',    color: '#7c3aed', dark: '#5b21b6' },
  { label: 'Hazard',      color: '#ef4444', dark: '#b91c1c' },
  { label: 'Checkpoint',  color: '#84cc16', dark: '#4d7c0f' },
  { label: 'Speed Boost', color: '#ec4899', dark: '#be185d' },
];

// ── Key badge ────────────────────────────────────────────────────────────────

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md bg-neutral-700 border border-neutral-600 text-[10px] font-mono text-neutral-200 shadow-[0_2px_0_0_#1a1a2e]">
      {label}
    </kbd>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  title: string;
  content: React.ReactNode;
  targetIds?: string[];
}

const steps: Step[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    title: 'Run fast. Beat your time.',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-neutral-300 leading-relaxed">
          Delta Rush is a 3D parkour time-trial. Pick a course, reach the finish as fast as you can, and keep shaving off milliseconds.
        </p>
        <div className="flex flex-wrap gap-2">
          {['Timer starts on the green pad', 'Touch the blue finish block to submit', 'Hit a hazard → respawn at last checkpoint'].map(t => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-neutral-400 bg-neutral-800/70 rounded-lg px-2.5 py-1.5 font-mono">
              <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'controls',
    label: 'Controls',
    title: 'How to move.',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-300">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5"><Key label="W"/><Key label="A"/><Key label="S"/><Key label="D"/></div>
            <span className="text-neutral-400">Move</span>
          </div>
          <div className="flex items-center gap-2">
            <Key label="Space"/>
            <span className="text-neutral-400">Jump</span>
          </div>
          <div className="flex items-center gap-2">
            <Key label="R"/>
            <span className="text-neutral-400">Restart</span>
          </div>
          <div className="flex items-center gap-2">
            <Key label="Mouse"/>
            <span className="text-neutral-400">Look around</span>
          </div>
        </div>
        <p className="text-[10px] text-neutral-500 font-mono bg-neutral-800/50 rounded-lg px-3 py-2">
          📱 <span className="text-neutral-400">Phone / Tablet —</span> use the on-screen joystick to move and the Jump button to jump
        </p>
      </div>
    ),
  },
  {
    id: 'blocks',
    label: 'Blocks',
    title: 'Every color has a purpose.',
    content: (
      <div className="space-y-3">
        <p className="text-xs text-neutral-400">Learn the block language before you race.</p>
        <div className="grid grid-cols-4 gap-x-3 gap-y-4">
          {BLOCKS.map(b => (
            <div key={b.label} className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-lg"
                style={{
                  background: `linear-gradient(145deg, ${b.color} 0%, ${b.dark} 100%)`,
                  boxShadow: `0 4px 0 0 ${b.dark}, inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 16px rgba(0,0,0,0.55)`,
                }}
              />
              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide text-center leading-tight max-w-[52px]">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'nav',
    label: 'Navigate',
    title: 'Everything you need, up top.',
    content: (
      <div className="space-y-2">
        {[
          { name: 'Rush!',         desc: 'Official courses & world leaderboards' },
          { name: 'Community',     desc: 'Play courses built by other players' },
          { name: 'Races',         desc: 'Live head-to-head matchmaking' },
          { name: 'Course Builder',desc: 'Create, test, and publish your own courses' },
        ].map(({ name, desc }) => (
          <div key={name} className="flex items-center gap-3 text-xs">
            <span className="text-indigo-400 font-bold font-mono min-w-[90px]">{name}</span>
            <span className="text-neutral-400">{desc}</span>
          </div>
        ))}
      </div>
    ),
    targetIds: ['rush-tab-trigger', 'community-workshop-tab-trigger', 'races-tab-trigger', 'course-builder-tab-trigger'],
  },
];

// ── Spotlight rect helper ─────────────────────────────────────────────────────

function getTargetRects(ids?: string[]): DOMRect[] {
  if (!ids || ids.length === 0) return [];
  return ids
    .map(id => document.getElementById(id)?.getBoundingClientRect() ?? null)
    .filter((r): r is DOMRect => r !== null);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SpotlightTutorial({ isOpen, onClose }: SpotlightTutorialProps) {
  const [idx, setIdx] = useState(0);
  const [targetRects, setTargetRects] = useState<DOMRect[]>([]);
  const step = steps[idx];

  const updateRect = useCallback(() => {
    setTargetRects(getTargetRects(step.targetIds));
  }, [step.targetIds]);

  useEffect(() => {
    if (!isOpen) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, updateRect]);

  useEffect(() => {
    if (isOpen) { setIdx(0); updateRect(); }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => { updateRect(); }, [idx, updateRect]);

  const next = () => {
    synths.playTick();
    if (idx === steps.length - 1) { synths.playFinish(); onClose(); }
    else setIdx(i => i + 1);
  };
  const prev = () => { synths.playTick(); setIdx(i => Math.max(i - 1, 0)); };

  // Padding around the spotlight ring
  const PAD = 8;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delta Rush tutorial"
        >
          {/* ── Backdrop — semi-transparent so dashboard is visible ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-neutral-950/65"
            onClick={onClose}
          />

          {/* ── Spotlight rings around target elements ── */}
          <AnimatePresence>
            {targetRects.map((rect, i) => (
              <motion.div
                key={`${idx}-${i}-${rect.left}-${rect.top}`}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="pointer-events-none fixed rounded-2xl"
                style={{
                  left:   rect.left   - PAD,
                  top:    rect.top    - PAD,
                  width:  rect.width  + PAD * 2,
                  height: rect.height + PAD * 2,
                  boxShadow: [
                    '0 0 0 2px #6366f1',
                    '0 0 0 4px rgba(99,102,241,0.35)',
                    '0 0 28px 4px rgba(99,102,241,0.70)',
                  ].join(', '),
                }}
              />
            ))}
          </AnimatePresence>

          {/* ── Tutorial card ── */}
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="relative z-10 w-full max-w-sm rounded-2xl border border-neutral-700/70 bg-neutral-900/95 p-5 shadow-2xl backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => { synths.playTick(); setIdx(i); }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      i === idx ? 'w-5 bg-indigo-500' : 'w-1.5 bg-neutral-700 hover:bg-neutral-500'
                    }`}
                    aria-label={s.label}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                  {idx + 1}/{steps.length}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
                  aria-label="Close tutorial"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Step label + title */}
            <div className="mb-4">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-indigo-500 mb-1">
                {step.label}
              </p>
              <h2 className="text-base font-black tracking-tight text-neutral-100 leading-snug">
                {step.title}
              </h2>
            </div>

            {/* Body */}
            <div className="mb-5">
              {step.content}
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={prev}
                disabled={idx === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:invisible transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {idx === steps.length - 1 ? 'Start Running' : 'Next'}
                {idx === steps.length - 1
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <ArrowRight className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
