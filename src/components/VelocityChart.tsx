import React, { useRef, useState, useCallback } from 'react';

interface VelocityChartProps {
  speeds: number[];
  totalTime: number;
}

const WIDTH = 560;
const HEIGHT = 160;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function VelocityChart({ speeds, totalTime }: VelocityChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const maxSpeed = Math.max(...speeds, 0.01);
  const minSpeed = 0;
  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const n = speeds.length;

  const xForIndex = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * chartW);
  const yForSpeed = (s: number) => {
    const pct = (s - minSpeed) / (maxSpeed - minSpeed || 1);
    return PAD_TOP + chartH - pct * chartH;
  };
  const timeForIndex = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * totalTime);

  const pathD = speeds
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(2)} ${yForSpeed(s).toFixed(2)}`)
    .join(' ');

  const areaD = `${pathD} L ${xForIndex(n - 1).toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} L ${xForIndex(0).toFixed(2)} ${(PAD_TOP + chartH).toFixed(2)} Z`;

  const updateHoverFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const clamped = Math.min(Math.max(relX, PAD_LEFT), PAD_LEFT + chartW);
    const frac = chartW === 0 ? 0 : (clamped - PAD_LEFT) / chartW;
    const idx = Math.round(frac * (n - 1));
    setHoverIndex(Math.min(Math.max(idx, 0), n - 1));
  }, [n, chartW]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragging(true);
    updateHoverFromClientX(e.clientX);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    updateHoverFromClientX(e.clientX);
  };
  const handlePointerUp = () => setDragging(false);
  const handleMouseEnter = () => {};
  const handleMouseLeave = () => {
    setDragging(false);
    setHoverIndex(null);
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => minSpeed + f * (maxSpeed - minSpeed));
  const xTickCount = Math.min(6, Math.max(2, n));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (n - 1));
    return idx;
  });

  const hoverSpeed = hoverIndex !== null ? speeds[hoverIndex] : null;
  const hoverTime = hoverIndex !== null ? timeForIndex(hoverIndex) : null;

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-40 cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yForSpeed(tick)}
              y2={yForSpeed(tick)}
              stroke="#27272a"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '2,3'}
            />
            <text
              x={PAD_LEFT - 6}
              y={yForSpeed(tick) + 3}
              textAnchor="end"
              className="fill-neutral-600"
              fontSize="8"
              fontFamily="monospace"
            >
              {tick.toFixed(0)}
            </text>
          </g>
        ))}

        {xTicks.map((idx, i) => (
          <text
            key={i}
            x={xForIndex(idx)}
            y={HEIGHT - PAD_BOTTOM + 14}
            textAnchor="middle"
            className="fill-neutral-600"
            fontSize="8"
            fontFamily="monospace"
          >
            {timeForIndex(idx).toFixed(1)}s
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

        <path d={areaD} fill="url(#velocityFill)" stroke="none" />
        <path d={pathD} fill="none" stroke="#818cf8" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {hoverIndex !== null && (
          <>
            <line
              x1={xForIndex(hoverIndex)}
              x2={xForIndex(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + chartH}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <circle
              cx={xForIndex(hoverIndex)}
              cy={yForSpeed(speeds[hoverIndex])}
              r={3.5}
              fill="#f59e0b"
              stroke="#0a0a0a"
              strokeWidth={1}
            />
          </>
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 h-4">
        {hoverIndex !== null && hoverSpeed !== null && hoverTime !== null ? (
          <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
            t = {hoverTime.toFixed(2)}s &nbsp;•&nbsp; v = {hoverSpeed.toFixed(1)} m/s
          </div>
        ) : (
          <div className="text-[9px] font-mono text-neutral-600">Hover the graph to inspect speed at a point in time</div>
        )}
      </div>
    </div>
  );
}
