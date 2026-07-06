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

function buildSeriesHelpers(speeds: number[], totalTime: number, chartW: number, chartH: number, maxSpeed: number) {
  const n = speeds.length;
  const xForIndex = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * chartW);
  const yForSpeed = (s: number) => {
    const pct = s / (maxSpeed || 1);
    return PAD_TOP + chartH - pct * chartH;
  };
  const timeForIndex = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * totalTime);
  const speedAtTime = (t: number) => {
    if (n === 0) return 0;
    if (totalTime <= 0) return speeds[0];
    const frac = Math.min(Math.max(t / totalTime, 0), 1);
    const idx = Math.round(frac * (n - 1));
    return speeds[Math.min(Math.max(idx, 0), n - 1)];
  };
  const pathD = speeds
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(2)} ${yForSpeed(s).toFixed(2)}`)
    .join(' ');
  return { n, xForIndex, yForSpeed, timeForIndex, speedAtTime, pathD };
}

export default function VelocityChart({ speeds, totalTime, label = 'You', compare }: VelocityChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxSpeed = Math.max(...speeds, ...(compare?.speeds || []), 0.01);
  const maxTotalTime = Math.max(totalTime, compare?.totalTime || 0) || 1;

  const primary = buildSeriesHelpers(speeds, totalTime, chartW, chartH, maxSpeed);
  const secondary = compare ? buildSeriesHelpers(compare.speeds, compare.totalTime, chartW, chartH, maxSpeed) : null;

  const xForTime = (t: number) => PAD_LEFT + (t / maxTotalTime) * chartW;

  const areaD = `${primary.pathD} L ${primary.xForIndex(primary.n - 1).toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} L ${primary.xForIndex(0).toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} Z`;

  const updateHoverFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg || primary.n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const clamped = Math.min(Math.max(relX, PAD_LEFT), PAD_LEFT + chartW);
    const frac = chartW === 0 ? 0 : (clamped - PAD_LEFT) / chartW;
    setHoverTime(frac * maxTotalTime);
  }, [primary.n, chartW, maxTotalTime]);

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
    setHoverTime(null);
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxSpeed);
  const xTickCount = Math.min(6, Math.max(2, primary.n));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => (i / (xTickCount - 1)) * maxTotalTime);

  const hoverPrimarySpeed = hoverTime !== null ? primary.speedAtTime(hoverTime) : null;
  const hoverCompareSpeed = hoverTime !== null && secondary ? secondary.speedAtTime(hoverTime) : null;

  return (
    <div className="select-none">
      {compare && (
        <div className="flex items-center gap-4 mb-2 text-[9px] font-mono">
          <span className="flex items-center gap-1.5 text-indigo-300">
            <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: PRIMARY_COLOR }} />
            {label}
          </span>
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: COMPARE_COLOR }} />
            {compare.label}
          </span>
        </div>
      )}

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
              y1={PAD_TOP + chartH - (tick / (maxSpeed || 1)) * chartH}
              y2={PAD_TOP + chartH - (tick / (maxSpeed || 1)) * chartH}
              stroke="#27272a"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '2,3'}
            />
            <text
              x={PAD_LEFT - 6}
              y={PAD_TOP + chartH - (tick / (maxSpeed || 1)) * chartH + 3}
              textAnchor="end"
              className="fill-neutral-600"
              fontSize="8"
              fontFamily="monospace"
            >
              {tick.toFixed(0)}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <text
            key={i}
            x={xForTime(t)}
            y={HEIGHT - PAD_BOTTOM + 14}
            textAnchor="middle"
            className="fill-neutral-600"
            fontSize="8"
            fontFamily="monospace"
          >
            {t.toFixed(1)}s
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
          SPEED (m/s)
        </text>
        <text
          x={PAD_LEFT + chartW / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          className="fill-neutral-500"
          fontSize="8"
          fontFamily="monospace"
        >
          TIME (s)
        </text>

        {!compare && <path d={areaD} fill={`url(#${PRIMARY_FILL_ID})`} stroke="none" />}
        <path d={primary.pathD} fill="none" stroke={PRIMARY_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        {secondary && (
          <path d={secondary.pathD} fill="none" stroke={COMPARE_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4,2" />
        )}

        {hoverTime !== null && (
          <>
            <line
              x1={xForTime(hoverTime)}
              x2={xForTime(hoverTime)}
              y1={PAD_TOP}
              y2={PAD_TOP + chartH}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {hoverPrimarySpeed !== null && (
              <circle
                cx={xForTime(hoverTime)}
                cy={PAD_TOP + chartH - (hoverPrimarySpeed / (maxSpeed || 1)) * chartH}
                r={3.5}
                fill={PRIMARY_COLOR}
                stroke="#0a0a0a"
                strokeWidth={1}
              />
            )}
            {hoverCompareSpeed !== null && (
              <circle
                cx={xForTime(hoverTime)}
                cy={PAD_TOP + chartH - (hoverCompareSpeed / (maxSpeed || 1)) * chartH}
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
        {hoverTime !== null && hoverPrimarySpeed !== null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
              t = {hoverTime.toFixed(2)}s
            </div>
            <div className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-0.5">
              {label}: {hoverPrimarySpeed.toFixed(1)} m/s
            </div>
            {hoverCompareSpeed !== null && compare && (
              <div className="text-[10px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5">
                {compare.label}: {hoverCompareSpeed.toFixed(1)} m/s
              </div>
            )}
          </div>
        ) : (
          <div className="text-[9px] font-mono text-neutral-600">Hover the graph to inspect speed at a point in time</div>
        )}
      </div>
    </div>
  );
}
