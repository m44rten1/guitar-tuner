import type { PitchResult } from "../tuner/types";

const DEFAULT_THRESHOLD = 0.15;

/**
 * YIN pitch detection algorithm.
 *
 * Operates on a time-domain float32 buffer (from AnalyserNode).
 * Returns detected frequency and clarity, or null if no clear pitch found.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  threshold: number = DEFAULT_THRESHOLD,
): PitchResult | null {
  const halfLen = Math.floor(buffer.length / 2);

  // Step 1 & 2: Difference function + cumulative mean normalized difference
  const cmnd = cumulativeMeanNormalizedDifference(buffer, halfLen);

  // Step 3: Absolute threshold — find the first lag where CMND dips below threshold
  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau++) {
    if (cmnd[tau] < threshold) {
      // Walk to the local minimum
      while (tau + 1 < halfLen && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return null;

  // Step 4: Parabolic interpolation for sub-sample accuracy
  const betterTau = parabolicInterpolation(cmnd, tauEstimate);
  const frequency = sampleRate / betterTau;
  const clarity = 1 - cmnd[tauEstimate];

  return { frequency, clarity };
}

/**
 * Returns the CMND array used for both pitch detection and octave correction.
 * Exported so octave-correction can re-check at lag 2T without recomputing.
 */
export function cumulativeMeanNormalizedDifference(
  buffer: Float32Array,
  halfLen: number,
): Float32Array {
  const diff = new Float32Array(halfLen);
  const cmnd = new Float32Array(halfLen);

  // Difference function: d(tau) = sum of (x[i] - x[i+tau])^2
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = diff[tau] / (runningSum / tau);
  }

  return cmnd;
}

function parabolicInterpolation(cmnd: Float32Array, tau: number): number {
  if (tau < 1 || tau >= cmnd.length - 1) return tau;

  const s0 = cmnd[tau - 1];
  const s1 = cmnd[tau];
  const s2 = cmnd[tau + 1];
  const adjustment = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));

  if (Math.abs(adjustment) > 1) return tau;
  return tau + adjustment;
}
