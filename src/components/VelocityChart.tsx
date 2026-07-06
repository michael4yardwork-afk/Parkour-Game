import React, { useRef, useState, useCallback } from 'react';

interface CompareSeries {
  speeds: number[];
  totalTime: number;
  label: string;
}

interface VelocityChartProps {
  speeds: number[];
  totalTime: number;
  label?: string;
  compare?: CompareSeries | null;
}

const WIDTH = 560;
const HEIGHT = 160;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

const PRIMARY_COLOR = '#818cf8';
const PRIMARY_FILL_ID = 'velocityFillPrimary';
const COMPARE_COLOR = '#fb7185';

// SPEED mode: x = elapsed time (shared timeline), y = speed.
// A run that finished sooner ends its line earlier on the X axis.
function buildSpeedSeriesHelpers(speeds: number[], totalTime: number, chartW: number, chartH: number, maxSpeed: number, maxTotalTime: number) {
  const n = speeds.length;
  const timeForIndex = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * totalTime);
  const xForIndex = (i: number) => PAD_LEFT + (maxTotalTime <= 0 ? 0 : (timeForIndex(i) / maxTotalTime) * chartW);
  const yForValue = (s: number) => {
    const pct = s / (maxSpeed || 1);
    return PAD_TOP + chartH - pct * chartH;
  };
  const valueAtFrac = (frac: number) => {
    if (n === 0) return null;
    const t = frac * maxTotalTime;
    if (t > totalTime) return null;
    if (totalTime <= 0) return speeds[0];
    const idxFrac = Math.min(Math.max(t / totalTime, 0), 1);
    const idx = Math.round(idxFrac * (n - 1));
    return speeds[Math.min(Math.max(idx, 0), n - 1)];
  };
  const pathD = speeds
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(2)} ${yForValue(s).toFixed(2)}`)
    .join(' ');
  const firstX = n > 0 ? xForIndex(0) : PAD_LEFT;
  const lastX = n > 0 ? xForIndex(n - 1) : PAD_LEFT;
  return { n, pathD, valueAtFrac, firstX, lastX };
}

// PROGRESS mode: x = % of the run's own distance covered (integrated from
// speed), y = elapsed time to reach that point. Every series always spans
// the full 0-100% width, making it easy to compare pacing at the same
// point in the course regardless of how long each run took overall.
function buildProgressSeriesHelpers(speeds: number[], totalTime: number, chartW: number, chartH: number, maxTotalTime: number) {
  const n = speeds.length;
  if (n === 0) {
    return { n, pathD: '', valueAtFrac: () => null as number | null, firstX: PAD_LEFT, lastX: PAD_LEFT };
  }
  const dt = n > 1 ? totalTime / (n - 1) : totalTime;
  const cumDist: number[] = new Array(n);
  cumDist[0] = 0;
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += ((speeds[i - 1] + speeds[i]) / 2) * dt;
    cumDist[i] = acc;
  }
  const totalDist = cumDist[n - 1] || 1;
  const progress = cumDist.map(d => (d / totalDist) * 100);
  const times = Array.from({ length: n }, (_, i) => i * dt);

  const xForProgress = (p: number) => PAD_LEFT + (p / 100) * chartW;
  const yForTime = (t: number) => PAD_TOP + chartH - (maxTotalTime <= 0 ? 0 : (t / maxTotalTime) * chartH);

  const pathD = progress
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForProgress(p).toFixed(2)} ${yForTime(times[i]).toFixed(2)}`)
    .join(' ');

  const valueAtFrac = (frac: number) => {
    const pct = Math.min(Math.max(frac, 0), 1) * 100;
    if (pct <= progress[0]) return times[0];
    if (pct >= progress[n - 1]) return times[n - 1];
    for (let i = 0; i < n - 1; i++) {
      if (progress[i] <= pct && pct <= progress[i + 1]) {
        const p0 = progress[i], p1 = progress[i + 1], t0 = times[i], t1 = times[i + 1];
        const localFrac = p1 > p0 ? (pct - p0) / (p1 - p0) : 0;
        return t0 + (t1 - t0) * localFrac;
      }
    }
    return times[n - 1];
  };

  const firstX = xForProgress(progress[0]);
  const lastX = xForProgress(progress[n - 1]);
  return { n, pathD, valueAtFrac, firstX, lastX };
}

export default function VelocityChart({ speeds, totalTime, label = 'You', compare }: VelocityChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'speed' | 'progress'>('speed');

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxSpeed = Math.max(...speeds, ...(compare?.speeds || []), 0.01);
  const maxTotalTime = Math.max(totalTime, compare?.totalTime || 0) || 1;

  const primary = mode === 'speed'
    ? buildSpeedSeriesHelpers(speeds, totalTime, chartW, chartH, maxSpeed, maxTotalTime)
    : buildProgressSeriesHelpers(speeds, totalTime, chartW, chartH, maxTotalTime);
  const secondary = compare
    ? (mode === 'speed'
      ? buildSpeedSeriesHelpers(compare.speeds, compare.totalTime, chartW, chartH, maxSpeed, maxTotalTime)
      : buildProgressSeriesHelpers(compare.speeds, compare.totalTime, chartW, chartH, maxTotalTime))
    : null;

  const xForFrac = (frac: number) => PAD_LEFT + frac * chartW;

  const areaD = `${primary.pathD} L ${primary.lastX.toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} L ${primary.firstX.toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} Z`;

  const updateHoverFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg || primary.n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const clamped = Math.min(Math.max(relX, PAD_LEFT), PAD_LEFT + chartW);
    const frac = chartW === 0 ? 0 : (clamped - PAD_LEFT) / chartW;
    setHoverFrac(frac);
  }, [primary.n, chartW]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragging(true);
    updateHoverFromClientX(e.clientX);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    updateHoverFromClientX(e.clientX);
  };
  const handlePointerUp = () => setDragging(false);
  const handleMouseLeave = () => {
    setDragging(false);
    setHoverFrac(null);
  };

  const isSpeedMode = mode === 'speed';

  const yTicks = isSpeedMode
    ? [0, 0.25, 0.5, 0.75, 1].map(f => f * maxSpeed)
    : [0, 0.25, 0.5, 0.75, 1].map(f => f * maxTotalTime);
  const xTickCount = isSpeedMode ? Math.min(6, Math.max(2, primary.n)) : 6;
  const xTicks = isSpeedMode
    ? Array.from({ length: xTickCount }, (_, i) => (i / (xTickCount - 1)) * maxTotalTime)
    : Array.from({ length: xTickCount }, (_, i) => (i / (xTickCount - 1)) * 100);

  const hoverPrimaryValue = hoverFrac !== null ? primary.valueAtFrac(hoverFrac) : null;
  const hoverCompareValue = hoverFrac !== null && secondary ? secondary.valueAtFrac(hoverFrac) : null;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-4 text-[9px] font-mono">
          {compare && (
            <>
              <span className="flex items-center gap-1.5 text-indigo-300">
                <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: PRIMARY_COLOR }} />
                {label}
              </span>
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: COMPARE_COLOR }} />
                {compare.label}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => { setMode(m => m === 'speed' ? 'progress' : 'speed'); setHoverFrac(null); }}
          className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 cursor-pointer transition-colors tracking-wider"
        >
          {isSpeedMode ? 'SHOW PROGRESS' : 'SHOW SPEED'}
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-40 cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={PRIMARY_FILL_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY_COLOR} stopOpacity="0.35" />
            <stop offset="100%" stopColor={PRIMARY_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={PAD_TOP + chartH - (i / (yTicks.length - 1)) * chartH}
              y2={PAD_TOP + chartH - (i / (yTicks.length - 1)) * chartH}
              stroke="#27272a"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '2,3'}
            />
            <text
              x={PAD_LEFT - 6}
              y={PAD_TOP + chartH - (i / (yTicks.length - 1)) * chartH + 3}
              textAnchor="end"
              className="fill-neutral-600"
              fontSize="8"
              fontFamily="monospace"
            >
              {isSpeedMode ? tick.toFixed(0) : tick.toFixed(1)}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <text
            key={i}
            x={xForFrac(isSpeedMode ? t / maxTotalTime : t / 100)}
            y={HEIGHT - PAD_BOTTOM + 14}
            textAnchor="middle"
            className="fill-neutral-600"
            fontSize="8"
            fontFamily="monospace"
          >
            {isSpeedMode ? `${t.toFixed(1)}s` : `${t.toFixed(0)}%`}
          </text>
        ))}

        <text
          x={-(PAD_TOP + chartH / 2)}
          y={10}
          textAnchor="middle"
          transform="rotate(-90)"
          className="fill-neutral-500"
          fontSize="8"
          fontFamily="monospace"
        >
          {isSpeedMode ? 'SPEED (m/s)' : 'TIME (s)'}
        </text>
        <text
          x={PAD_LEFT + chartW / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          className="fill-neutral-500"
          fontSize="8"
          fontFamily="monospace"
        >
          {isSpeedMode ? 'TIME (s)' : 'PROGRESS (%)'}
        </text>

        {!compare && <path d={areaD} fill={`url(#${PRIMARY_FILL_ID})`} stroke="none" />}
        <path d={primary.pathD} fill="none" stroke={PRIMARY_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        {secondary && (
          <path d={secondary.pathD} fill="none" stroke={COMPARE_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4,2" />
        )}

        {hoverFrac !== null && (
          <>
            <line
              x1={xForFrac(hoverFrac)}
              x2={xForFrac(hoverFrac)}
              y1={PAD_TOP}
              y2={PAD_TOP + chartH}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {hoverPrimaryValue !== null && (
              <circle
                cx={xForFrac(hoverFrac)}
                cy={isSpeedMode
                  ? PAD_TOP + chartH - (hoverPrimaryValue / (maxSpeed || 1)) * chartH
                  : PAD_TOP + chartH - (hoverPrimaryValue / (maxTotalTime || 1)) * chartH}
                r={3.5}
                fill={PRIMARY_COLOR}
                stroke="#0a0a0a"
                strokeWidth={1}
              />
            )}
            {hoverCompareValue !== null && (
              <circle
                cx={xForFrac(hoverFrac)}
                cy={isSpeedMode
                  ? PAD_TOP + chartH - (hoverCompareValue / (maxSpeed || 1)) * chartH
                  : PAD_TOP + chartH - (hoverCompareValue / (maxTotalTime || 1)) * chartH}
                r={3.5}
                fill={COMPARE_COLOR}
                stroke="#0a0a0a"
                strokeWidth={1}
              />
            )}
          </>
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 min-h-4">
        {hoverFrac !== null && hoverPrimaryValue !== null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
              {isSpeedMode ? `t = ${(hoverFrac * maxTotalTime).toFixed(2)}s` : `progress = ${(hoverFrac * 100).toFixed(0)}%`}
            </div>
            <div className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-0.5">
              {label}: {isSpeedMode ? `${hoverPrimaryValue.toFixed(1)} m/s` : `${hoverPrimaryValue.toFixed(2)}s`}
            </div>
            {hoverCompareValue !== null && compare && (
              <div className="text-[10px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5">
                {compare.label}: {isSpeedMode ? `${hoverCompareValue.toFixed(1)} m/s` : `${hoverCompareValue.toFixed(2)}s`}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[9px] font-mono text-neutral-600">Hover the graph to inspect {isSpeedMode ? 'speed at a point in time' : 'time at a point of progress'}</div>
        )}
      </div>
    </div>
  );
}
