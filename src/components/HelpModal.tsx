import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, ChevronDown, ChevronUp, Gamepad2, Zap, Trophy, Play, Edit3, Heart, Users } from 'lucide-react';
import { synths } from '../audio';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [openSection, setOpenSection] = useState<string | null>('lexicon'); // Default to open Lexicon first since we moved it here

  const toggleSection = (id: string) => {
    synths.playTick();
    setOpenSection(openSection === id ? null : id);
  };

  const sections: HelpSection[] = [
    {
      id: 'modes',
      title: 'Game Modes & Interfaces',
      icon: <Gamepad2 className="w-5 h-5 text-indigo-500" />,
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-neutral-600">
          <p className="text-neutral-500">
            Welcome to <strong className="text-neutral-800">Delta Rush</strong>. This high-velocity parkour platformer is split into several interconnected modules:
          </p>
          <div className="grid grid-cols-1 gap-3.5 mt-2">
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 mb-1">
                <Play className="w-3.5 h-3.5 text-red-500 fill-current" />
                <span>RUSH! (Campaign Levels)</span>
              </div>
              <p className="text-neutral-500">
                Play the core set of pre-designed physical test chambers. Dash, sprint, and climb to shave seconds off your personal best and conquer local leaderboards.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 mb-1">
                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Course Builder &amp; Saved Levels</span>
              </div>
              <p className="text-neutral-500">
                An interactive 3D grid-snapping level editor. Drag and build runways, lava hazards, boost triggers, and wall-run panels. Test locally inside the editor instantly.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 mb-1">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
                <span>Community Courses Hub</span>
              </div>
              <p className="text-neutral-500">
                Browse, search, rate, and race through infinite custom levels created and shared online by other Delta Rush runners around the globe.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 mb-1">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Matchmaking Queue (Multiplayer)</span>
              </div>
              <p className="text-neutral-500">
                Join the competitive racing queue on the home screen. Instantly sync with other active online players, competing for 1st-place runs and podium placements!
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'lexicon',
      title: 'The Movement Lexicon',
      icon: <Zap className="w-5 h-5 text-amber-500 fill-current" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Delta Rush is built on high-fidelity momentum conservation physics. Combine these standard kinetic tricks to maintain maximum flow rate:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 text-left">
            {/* Sprint Boost */}
            <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 leading-relaxed">
              <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-mono text-[9px] font-bold uppercase mb-1.5">
                L-SHIFT / C Key
              </span>
              <h4 className="font-bold text-xs text-neutral-800">Sprint Boost</h4>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Holding Sprint amplifies velocity and extends jump height, transferring speed into runs and higher leaps.
              </p>
            </div>

            {/* Wallrunning */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-100 leading-relaxed">
              <span className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-md font-mono text-[9px] font-bold uppercase mb-1.5">
                Forward near wall
              </span>
              <h4 className="font-bold text-xs text-neutral-800">Vertical Wall Run</h4>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Run alongside flat purple panels to snap and wall-run. Vertical gravity drops by 70% during the run.
              </p>
            </div>

            {/* Wall Jumping */}
            <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100 leading-relaxed">
              <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md font-mono text-[9px] font-bold uppercase mb-1.5">
                Space on Wall
              </span>
              <h4 className="font-bold text-xs text-neutral-800">Wall Kickback</h4>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Jumping while wall-running kicks you off with a heavy horizontal boost. Perfect for zig-zag channels.
              </p>
            </div>

            {/* Jump Pads */}
            <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 leading-relaxed">
              <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md font-mono text-[9px] font-bold uppercase mb-1.5">
                Golden Pads
              </span>
              <h4 className="font-bold text-xs text-neutral-800">Jump Pads</h4>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Golden blocks launch you 20 meters straight into the sky, preserving all forward motion for huge shortcuts.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ghosts',
      title: 'Ghost Replays & Rankings',
      icon: <Trophy className="w-5 h-5 text-rose-500" />,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-neutral-600">
          <p className="text-neutral-500">
            Hone your skills and perfect routes by understanding the replay and leaderboard system:
          </p>
          <ul className="list-disc pl-4 space-y-1.5 text-neutral-500 mt-2">
            <li>
              <strong className="text-neutral-700">Personal Best Ghost:</strong> Whenever you run a course, your exact coordinate path is recorded. The next attempt spawns a translucent blueprint runner matching your best run so you can visually spot errors in real-time.
            </li>
            <li>
              <strong className="text-neutral-700">Standing &amp; Percentiles:</strong> The system automatically evaluates your run times relative to all other athletes on the platform, showing your percentile rating. Try to enter the top 1%!
            </li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop blur & overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white border border-neutral-200/95 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl relative z-10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Delta Rush Field Guide &amp; Help</h2>
              </div>
              <button
                onClick={() => {
                  synths.playTick();
                  onClose();
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content (the Accordion) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {sections.map((section) => {
                const isSectionOpen = openSection === section.id;
                return (
                  <div
                    key={section.id}
                    className="border border-neutral-200/80 rounded-2xl overflow-hidden bg-white transition-all"
                  >
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-neutral-50 transition text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {section.icon}
                        <span className="font-bold text-sm text-neutral-800">{section.title}</span>
                      </div>
                      {isSectionOpen ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isSectionOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                        >
                          <div className="px-5 pb-5 pt-1 border-t border-neutral-100/60 bg-neutral-50/20">
                            {section.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Quick Controls Cheat Sheet Footer */}
            <div className="mt-5 pt-3 border-t border-neutral-100 shrink-0 text-[10px] font-mono text-neutral-400 flex items-center justify-between">
              <span>W,A,S,D / ARROWS: Move</span>
              <span>•</span>
              <span>SPACE: Jump</span>
              <span>•</span>
              <span>SHIFT: Sprint</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
