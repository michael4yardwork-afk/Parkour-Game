import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Lock, AlertTriangle, CreditCard, RefreshCw } from 'lucide-react';
import { synths } from '../audio';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
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
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-neutral-100 text-neutral-800 rounded-lg">
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900 tracking-tight">Privacy Policy</h2>
                  <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">Data &amp; Security</p>
                </div>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-neutral-600 leading-relaxed">
              <div className="p-3.5 bg-amber-50 border border-amber-200/60 rounded-2xl flex gap-3 text-[11px] text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer:</strong> This policy is for informational and structural purposes only, does not constitute legal advice, and should be reviewed by an attorney before use in a commercial setting.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  Account Information
                </h3>
                <p className="text-neutral-500">
                  We value your anonymity. Creating an account requires only a username and password. We do not ask for, collect, or store real names, email addresses, or other personally identifiable credentials.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  Technical Logging &amp; Cookies
                </h3>
                <p className="text-neutral-500">
                  To secure the simulation and analyze performance, we gather basic technical details automatically. This includes IP addresses, browser agents, login timestamps, and functional cookies essential for keeping you logged in.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  Payment Processing
                </h3>
                <p className="text-neutral-500">
                  Transactions and billing are handled securely by Stripe. No payment credentials or credit card histories are saved or processed directly on our servers.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-indigo-600" />
                  Account Deletion
                </h3>
                <p className="text-neutral-500">
                  Because accounts are fully anonymous and are not associated with personal identity or verification records, we cannot guarantee requested account deletion or password retrievals.
                </p>
              </div>
            </div>

            {/* Accept Action Button */}
            <div className="mt-5 pt-4 border-t border-neutral-100 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-400">Effective: June 2026</span>
              <button
                onClick={() => {
                  synths.playTick();
                  onClose();
                }}
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
