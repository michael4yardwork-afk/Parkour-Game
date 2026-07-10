// Shared "Icon Theme" swatch catalogue used by the sign-up screen and the
// profile customizer. Centralized here so every picker offers the same set
// and stays in sync — previously each component kept its own hand-copied
// list, which drifted out of sync (different sizes/colors in each place).
//
// `value` is the class string persisted as `avatarBg` and applied directly
// to the user's avatar box everywhere it's rendered (profile, leaderboard,
// dashboard header, etc). `class` is what the small picker swatch itself
// renders — for plain colors this is a muted /20-opacity tint with a border;
// for the special swatches below, the swatch shows the effect at full
// strength so it's recognizable at a glance.
export interface AvatarBg {
  class: string;
  value: string;
  label: string;
  special?: boolean;
}

export const AVATAR_BGS: AvatarBg[] = [
  // ── Base solid colors ────────────────────────────────────────────────
  { class: 'bg-neutral-900 border-neutral-700 text-neutral-300', value: 'bg-neutral-900', label: 'Obsidian' },
  { class: 'bg-white border-neutral-300 text-neutral-400', value: 'bg-white', label: 'Snow' },
  { class: 'bg-neutral-400/20 border-neutral-400/40 text-neutral-300', value: 'bg-neutral-400', label: 'Steel' },
  { class: 'bg-red-500/20 border-red-500/40 text-red-300', value: 'bg-red-500', label: 'Red' },
  { class: 'bg-rose-500/20 border-rose-500/40 text-rose-300', value: 'bg-rose-500', label: 'Crimson' },
  { class: 'bg-pink-500/20 border-pink-500/40 text-pink-300', value: 'bg-pink-500', label: 'Pink' },
  { class: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300', value: 'bg-fuchsia-500', label: 'Fuchsia' },
  { class: 'bg-purple-500/20 border-purple-500/40 text-purple-300', value: 'bg-purple-500', label: 'Neon' },
  { class: 'bg-violet-500/20 border-violet-500/40 text-violet-300', value: 'bg-violet-500', label: 'Violet' },
  { class: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300', value: 'bg-indigo-500', label: 'Indigo' },
  { class: 'bg-blue-500/20 border-blue-500/40 text-blue-300', value: 'bg-blue-500', label: 'Cyber' },
  { class: 'bg-sky-500/20 border-sky-500/40 text-sky-300', value: 'bg-sky-500', label: 'Sky' },
  { class: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300', value: 'bg-cyan-500', label: 'Cyan' },
  { class: 'bg-teal-500/20 border-teal-500/40 text-teal-300', value: 'bg-teal-500', label: 'Teal' },
  { class: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', value: 'bg-emerald-500', label: 'Emerald' },
  { class: 'bg-green-500/20 border-green-500/40 text-green-300', value: 'bg-green-500', label: 'Volt' },
  { class: 'bg-lime-500/20 border-lime-500/40 text-lime-300', value: 'bg-lime-500', label: 'Lime' },
  { class: 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300', value: 'bg-yellow-400', label: 'Yellow' },
  { class: 'bg-amber-500/20 border-amber-500/40 text-amber-300', value: 'bg-amber-500', label: 'Solar' },
  { class: 'bg-orange-500/20 border-orange-500/40 text-orange-300', value: 'bg-orange-500', label: 'Orange' },

  // ── Special: metallics ───────────────────────────────────────────────
  { class: 'bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 border-yellow-300/60 text-white', value: 'bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700', label: 'Gold', special: true },
  { class: 'bg-gradient-to-br from-slate-100 via-slate-400 to-slate-600 border-slate-200/60 text-white', value: 'bg-gradient-to-br from-slate-100 via-slate-400 to-slate-600', label: 'Silver', special: true },
  { class: 'bg-gradient-to-br from-orange-300 via-orange-600 to-amber-900 border-orange-300/60 text-white', value: 'bg-gradient-to-br from-orange-300 via-orange-600 to-amber-900', label: 'Bronze', special: true },
  { class: 'bg-gradient-to-br from-slate-200 via-zinc-400 to-slate-700 border-slate-200/60 text-white', value: 'bg-gradient-to-br from-slate-200 via-zinc-400 to-slate-700', label: 'Chrome', special: true },
  { class: 'bg-gradient-to-br from-rose-200 via-rose-400 to-orange-300 border-rose-200/60 text-white', value: 'bg-gradient-to-br from-rose-200 via-rose-400 to-orange-300', label: 'Rose Gold', special: true },
  { class: 'bg-gradient-to-br from-slate-500 via-slate-700 to-neutral-950 border-slate-400/60 text-white', value: 'bg-gradient-to-br from-slate-500 via-slate-700 to-neutral-950', label: 'Gunmetal', special: true },

  // ── Special: gradients ───────────────────────────────────────────────
  { class: 'bg-gradient-to-br from-amber-400 via-rose-500 to-purple-600 border-rose-300/60 text-white', value: 'bg-gradient-to-br from-amber-400 via-rose-500 to-purple-600', label: 'Sunset', special: true },
  { class: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-700 border-cyan-300/60 text-white', value: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-700', label: 'Ocean', special: true },
  { class: 'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-900 border-fuchsia-300/60 text-white', value: 'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-900', label: 'Galaxy', special: true },
  { class: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 border-orange-300/60 text-white', value: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600', label: 'Fire', special: true },
  { class: 'bg-gradient-to-br from-emerald-400 via-teal-400 to-indigo-500 border-emerald-300/60 text-white', value: 'bg-gradient-to-br from-emerald-400 via-teal-400 to-indigo-500', label: 'Aurora', special: true },
  { class: 'bg-gradient-to-br from-pink-400 via-fuchsia-400 to-sky-400 border-pink-300/60 text-white', value: 'bg-gradient-to-br from-pink-400 via-fuchsia-400 to-sky-400', label: 'Candy', special: true },

  // ── Special: stripes ─────────────────────────────────────────────────
  { class: 'bg-[repeating-linear-gradient(45deg,#0f172a_0px,#0f172a_6px,#6366f1_6px,#6366f1_12px)] border-indigo-300/60 text-white', value: 'bg-[repeating-linear-gradient(45deg,#0f172a_0px,#0f172a_6px,#6366f1_6px,#6366f1_12px)]', label: 'Indigo Stripes', special: true },
  { class: 'bg-[repeating-linear-gradient(45deg,#1a0505_0px,#1a0505_6px,#f43f5e_6px,#f43f5e_12px)] border-rose-300/60 text-white', value: 'bg-[repeating-linear-gradient(45deg,#1a0505_0px,#1a0505_6px,#f43f5e_6px,#f43f5e_12px)]', label: 'Crimson Stripes', special: true },
  { class: 'bg-[repeating-linear-gradient(45deg,#052e16_0px,#052e16_6px,#22c55e_6px,#22c55e_12px)] border-emerald-300/60 text-white', value: 'bg-[repeating-linear-gradient(45deg,#052e16_0px,#052e16_6px,#22c55e_6px,#22c55e_12px)]', label: 'Volt Stripes', special: true },
  { class: 'bg-[repeating-linear-gradient(45deg,#000000_0px,#000000_6px,#facc15_6px,#facc15_12px)] border-yellow-300/60 text-white', value: 'bg-[repeating-linear-gradient(45deg,#000000_0px,#000000_6px,#facc15_6px,#facc15_12px)]', label: 'Hazard Stripes', special: true },

  // ── Special: polka dots ──────────────────────────────────────────────
  // At swatch size (32px), tiny hard-edged dots anti-alias into squares.
  // Use a bigger 2x2 tile with a soft-feathered radial edge so each dot
  // reads clearly as round even at small sizes and on low-DPI screens.
  { class: 'bg-indigo-950 bg-[radial-gradient(circle,#f9fafb_28%,transparent_46%)] bg-[length:50%_50%] border-indigo-300/60 text-white', value: 'bg-indigo-950 bg-[radial-gradient(circle,#f9fafb_28%,transparent_46%)] bg-[length:50%_50%]', label: 'Indigo Dots', special: true },
  { class: 'bg-rose-950 bg-[radial-gradient(circle,#fda4af_28%,transparent_46%)] bg-[length:50%_50%] border-rose-300/60 text-white', value: 'bg-rose-950 bg-[radial-gradient(circle,#fda4af_28%,transparent_46%)] bg-[length:50%_50%]', label: 'Rose Dots', special: true },
  { class: 'bg-teal-950 bg-[radial-gradient(circle,#5eead4_28%,transparent_46%)] bg-[length:50%_50%] border-teal-300/60 text-white', value: 'bg-teal-950 bg-[radial-gradient(circle,#5eead4_28%,transparent_46%)] bg-[length:50%_50%]', label: 'Teal Dots', special: true },
  { class: 'bg-amber-950 bg-[radial-gradient(circle,#fde047_28%,transparent_46%)] bg-[length:50%_50%] border-amber-300/60 text-white', value: 'bg-amber-950 bg-[radial-gradient(circle,#fde047_28%,transparent_46%)] bg-[length:50%_50%]', label: 'Amber Dots', special: true },
];
