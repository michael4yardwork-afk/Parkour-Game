import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code,
  Gamepad2,
  Layers,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { synths } from '../audio';

interface SpotlightTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  targetId?: string;
  bullets: string[];
}

const steps: TutorialStep[] = [
  {
    eyebrow: 'Welcome to Delta Rush',
    title: 'Run fast. Learn the route. Beat your best.',
    description:
      'Delta Rush is a time-trial parkour game. Pick a course, reach the finish as quickly as possible, and repeat the run to improve your route and rhythm.',
    icon: <Zap className="w-6 h-6" />,
    accent: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    bullets: [
      'Your timer starts when you leave the start pad.',
      'Touch the finish block to submit a completed time.',
      'If you hit a hazard, you respawn at the last checkpoint.',
    ],
  },
  {
    eyebrow: 'Move with momentum',
    title: 'Master the basics before chasing milliseconds.',
    description:
      'Use the controls that match your device. Running builds speed, and good jumps preserve that momentum through the whole course.',
    icon: <Gamepad2 className="w-6 h-6" />,
    accent: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    bullets: [
      'Computer: W/A/S/D or arrow keys to move, Space to jump, R to restart.',
      'Mouse movement looks around after you click the game canvas; Escape releases the cursor.',
      'Phone and tablet: drag on the left side to move, swipe on the right to look, and tap Jump.',
    ],
  },
  {
    eyebrow: 'Read the course',
    title: 'Every block tells you what to do next.',
    description:
      'Courses are built from colored blocks with different behaviors. Learn the visual language and plan your next landing before you jump.',
    icon: <Layers className="w-6 h-6" />,
    accent: 'text-amber-600 bg-amber-50 border-amber-100',
    bullets: [
      'Start / Finish: where a run begins and ends. Normal blocks are solid platforms.',
      'Jump Pad / Speed Boost: launch upward or surge forward while keeping your flow.',
      'Wall Run / Climb: use Space near a wall-run panel or climbable scaffolding to gain height.',
      'Checkpoint / Hazard / Glass: save a respawn point, avoid the reset hazards, and treat slippery glass carefully.',
    ],
  },
  {
    eyebrow: 'Find your way around',
    title: 'Your tabs are your training room.',
    description:
      'The top navigation keeps every part of the game close by. You can leave a course and return without losing your progress.',
    icon: <BookOpen className="w-6 h-6" />,
    accent: 'text-sky-600 bg-sky-50 border-sky-100',
    bullets: [
      'Dashboard: your home base, progress, recent activity, and quick actions.',
      'Rush!: the official courses. Saved Courses stores your custom and bookmarked courses.',
      'Community: browse and run courses made by other players. Races: compete live in matchmaking.',
      'Course Builder: create, test, save, and publish your own courses. Upgrade opens Platinum options.',
    ],
    targetId: 'dashboard-tab-trigger',
  },
  {
    eyebrow: 'Improve your time',
    title: 'Your best run is always waiting for a rematch.',
    description:
      'Each completed run can improve your personal best and your standing against other runners.',
    icon: <Trophy className="w-6 h-6" />,
    accent: 'text-rose-600 bg-rose-50 border-rose-100',
    bullets: [
      'Leaderboards show course rankings, times, and percentile standing.',
      'Your personal-best ghost replays your fastest route so you can compare lines in real time.',
      'Live Races use matchmaking and ELO-style ratings to track competitive results.',
    ],
  },
  {
    eyebrow: 'Build the community',
    title: 'Create a course worth racing.',
    description:
      'Use the Course Builder to design a route, test it yourself, and share it when it is ready. Community feedback helps great courses get discovered.',
    icon: <Code className="w-6 h-6" />,
    accent: 'text-violet-600 bg-violet-50 border-violet-100',
    bullets: [
      'Snap blocks into place, combine movement challenges, and always include a clear start and finish.',
      'Test your course before publishing so other runners can complete it.',
      'Save courses you want to revisit and use likes, runs, and rankings to find the best community routes.',
    ],
    targetId: 'course-builder-tab-trigger',
  },
];

function getTargetRect(targetId?: string): DOMRect | null {
  if (!targetId) return null;
  return document.getElementById(targetId)?.getBoundingClientRect() ?? null;
}

export default function SpotlightTutorial({ isOpen, onClose }: SpotlightTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];

  const updateTarget = useCallback(() => {
    setTargetRect(getTargetRect(step.targetId));
  }, [step.targetId]);

  useEffect(() => {
    if (!isOpen) return;
    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [isOpen, updateTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setStepIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) updateTarget();
  }, [isOpen, stepIndex, updateTarget]);

  const finish = () => {
    synths.playFinish();
    onClose();
  };

  const next = () => {
    synths.playTick();
    if (stepIndex === steps.length - 1) finish();
    else setStepIndex((index) => index + 1);
  };

  const previous = () => {
    synths.playTick();
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Delta Rush spotlight tutorial">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/75 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {targetRect && (
            <motion.div
              key={`${stepIndex}-${targetRect.left}-${targetRect.top}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-none fixed rounded-2xl border-2 border-indigo-300 ring-4 ring-indigo-400/30"
              style={{
                left: Math.max(8, targetRect.left - 6),
                top: Math.max(8, targetRect.top - 6),
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow: '0 0 0 9999px rgba(10, 15, 30, 0.42), 0 0 26px rgba(129, 140, 248, 0.8)',
              }}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.45 }}
            className="relative z-10 w-full max-w-xl max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${step.accent}`}>
                  {step.icon}
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-indigo-600">
                    {step.eyebrow}
                  </p>
                  <p className="mt-1 text-xs font-mono text-neutral-400">
                    Step {stepIndex + 1} of {steps.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close tutorial"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-7">
              <h2 className="text-2xl font-black tracking-tight text-neutral-900">{step.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">{step.description}</p>
            </div>

            <div className="mt-6 space-y-2.5">
              {step.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-50 p-3.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  <p className="text-xs font-medium leading-relaxed text-neutral-600">{bullet}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
              <button
                type="button"
                onClick={previous}
                disabled={stepIndex === 0}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:invisible"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-1.5" aria-label={`Tutorial progress: ${stepIndex + 1} of ${steps.length}`}>
                {steps.map((item, index) => (
                  <span
                    key={item.eyebrow}
                    className={`h-1.5 rounded-full transition-all ${index === stepIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-neutral-200'}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                {stepIndex === steps.length - 1 ? 'Start Running' : 'Next'}
                {stepIndex === steps.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}