import React from 'react';
import { Crown, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlatinumGateProps {
  /** Short name of the gated feature, e.g. "Velocity Graphs" */
  feature: string;
  /** One-sentence description of what they're missing */
  description?: string;
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Reusable modal that fires when a non-platinum user tries to use a
 * platinum-gated feature. Shows the feature name, a friendly teaser,
 * and a direct "Upgrade to Platinum" CTA.
 */
export default function PlatinumGate({ feature, description, isVisible, onClose, onUpgrade }: PlatinumGateProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.90, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="relative z-10 bg-neutral-950 border border-yellow-300/25 rounded-3xl max-w-[340px] w-full p-7 shadow-2xl shadow-yellow-500/5 text-center"
          >
            {/* Dismiss */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-neutral-600 hover:text-neutral-400 transition cursor-pointer rounded-lg hover:bg-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Crown medallion */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/30 mb-5">
              <Crown className="w-8 h-8 text-neutral-900" />
            </div>

            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-yellow-400 mb-2">
              Platinum Feature
            </p>

            <h3 className="text-lg font-black text-white tracking-tight leading-snug">
              You've discovered a{' '}
              <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                Platinum feature!
              </span>
            </h3>

            <p className="mt-2 text-sm font-bold text-neutral-200">{feature}</p>

            {description && (
              <p className="mt-1.5 text-xs text-neutral-500 leading-relaxed">{description}</p>
            )}

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={() => { onUpgrade(); onClose(); }}
                className="w-full py-3 rounded-xl text-sm font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900 hover:brightness-105 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                Upgrade to Platinum
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-400 transition cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
