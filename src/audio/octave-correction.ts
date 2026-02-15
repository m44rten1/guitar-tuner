import type { PitchResult } from "../tuner/types";
import { cumulativeMeanNormalizedDifference } from "./pitch-detector";

const GUITAR_MIN_HZ = 75;
const GUITAR_MAX_HZ = 1400;

/**
 * Correct octave errors by checking whether the sub-harmonic (f/2) is a
 * *better* fundamental than the detected frequency. Only prefer f/2 if
 * its CMND value is lower than at the detected lag — meaning the true
 * period is 2T, not T.
 *
 * Also clamps to the playable guitar frequency range.
 */
export function correctOctaveErrors(
  result: PitchResult,
  buffer: Float32Array,
  sampleRate: number,
): PitchResult | null {
  const halfLen = Math.floor(buffer.length / 2);
  const cmnd = cumulativeMeanNormalizedDifference(buffer, halfLen);

  let { frequency, clarity } = result;

  const lagT = Math.round(sampleRate / frequency);
  const lag2T = Math.round(sampleRate / (frequency / 2));

  // Only prefer the sub-harmonic if its CMND is substantially lower than the
  // detected lag's CMND. A periodic signal at f will always have low CMND
  // at 2T; in a genuine octave error (YIN caught 2nd harmonic), the true
  // fundamental at lag 2T will have a dramatically better CMND.
  if (
    lagT < halfLen &&
    lag2T < halfLen &&
    cmnd[lag2T] < cmnd[lagT] * 0.5
  ) {
    frequency = frequency / 2;
  }

  // Clamp to guitar range
  if (frequency < GUITAR_MIN_HZ || frequency > GUITAR_MAX_HZ) {
    return null;
  }

  return { frequency, clarity };
}
