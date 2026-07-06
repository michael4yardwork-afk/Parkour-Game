export interface TimedFrame {
  time: number; // millisecond offset from run start
}

/**
 * Speed samples are recorded once per rendered frame, so raw sample spacing
 * varies with frame rate (device performance, frame drops, etc). Comparing
 * two runs by assuming `index / (length - 1) * totalTime` therefore lines
 * runs up incorrectly whenever their frame-rate profiles differ.
 *
 * This resamples the raw (frame, speed) pairs onto a fixed-size, evenly
 * time-spaced grid spanning [0, totalTime] using linear interpolation, so
 * every stored speeds array has a true, uniform index-to-time mapping and
 * can be safely compared against any other resampled run.
 */
export function resampleSpeedsToUniformTime(
  frames: TimedFrame[],
  speeds: number[],
  totalTimeSeconds: number,
  sampleCount = 120
): number[] {
  const n = speeds.length;
  if (n === 0) return [];
  if (n === 1 || totalTimeSeconds <= 0) return [speeds[0]];

  const times = frames.map(f => f.time / 1000);
  const result: number[] = new Array(sampleCount);
  let cursor = 0;

  for (let i = 0; i < sampleCount; i++) {
    const t = (i / (sampleCount - 1)) * totalTimeSeconds;

    while (cursor < times.length - 2 && times[cursor + 1] < t) {
      cursor++;
    }

    const t0 = times[cursor];
    const t1 = times[Math.min(cursor + 1, times.length - 1)];
    const s0 = speeds[cursor];
    const s1 = speeds[Math.min(cursor + 1, speeds.length - 1)];

    if (t1 <= t0) {
      result[i] = s0;
    } else {
      const frac = Math.min(Math.max((t - t0) / (t1 - t0), 0), 1);
      result[i] = s0 + (s1 - s0) * frac;
    }
  }

  return result;
}
