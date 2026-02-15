import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readWav } from "./read-wav";
import { detectPitch } from "../pitch-detector";
import { correctOctaveErrors } from "../octave-correction";
import { PitchSmoother } from "../smoother";

const FIXTURES = join(import.meta.dirname!, "fixtures");
const BUFFER_SIZE = 8192;

/**
 * Guitar tuning reference frequencies (12-TET, A4=440)
 *
 * C3 = 130.81 Hz
 * C4 = 261.63 Hz
 */
const SAMPLES = [
  { file: "steel-guitar-C4.wav", expectedNote: "C", expectedOctave: 4, expectedHz: 261.63 },
  { file: "steel-guitar-C3.wav", expectedNote: "C", expectedOctave: 3, expectedHz: 130.81 },
  { file: "clean-guitar-C3.wav", expectedNote: "C", expectedOctave: 3, expectedHz: 130.81 },
];

/**
 * Run the full tuner pipeline on a WAV file:
 * read audio → take chunk from sustain → YIN detect → octave correct → smooth
 */
function runPipeline(filePath: string) {
  const wav = readWav(filePath);

  // Skip the attack transient (~100ms) and take a chunk from the sustain portion
  const skipSamples = Math.floor(wav.sampleRate * 0.15);
  const start = Math.min(skipSamples, wav.samples.length - BUFFER_SIZE);
  const chunk = wav.samples.slice(start, start + BUFFER_SIZE);

  const raw = detectPitch(chunk, wav.sampleRate);
  if (!raw) return null;

  const corrected = correctOctaveErrors(raw, chunk, wav.sampleRate);
  if (!corrected) return null;

  // Feed several identical frames to get past the confidence gating (3 consecutive)
  const smoother = new PitchSmoother();
  let result = null;
  for (let i = 0; i < 5; i++) {
    result = smoother.process(corrected, 1000 + i * 33);
  }

  return result;
}

describe("tuner pipeline with real guitar samples", () => {
  for (const sample of SAMPLES) {
    it(`detects ${sample.expectedNote}${sample.expectedOctave} from ${sample.file}`, () => {
      const result = runPipeline(join(FIXTURES, sample.file));

      expect(result).not.toBeNull();
      expect(result!.note).toBe(sample.expectedNote);
      expect(result!.octave).toBe(sample.expectedOctave);

      // Frequency should be within 5 Hz of expected (real samples won't be perfectly tuned)
      expect(result!.frequency).toBeCloseTo(sample.expectedHz, -1);

      // Cents deviation should be reasonable (within ±50 cents = still same note)
      expect(Math.abs(result!.cents)).toBeLessThan(50);
    });
  }
});

describe("raw pitch detection on real samples", () => {
  for (const sample of SAMPLES) {
    it(`YIN detects ~${sample.expectedHz} Hz from ${sample.file}`, () => {
      const wav = readWav(join(FIXTURES, sample.file));
      const skipSamples = Math.floor(wav.sampleRate * 0.15);
      const start = Math.min(skipSamples, wav.samples.length - BUFFER_SIZE);
      const chunk = wav.samples.slice(start, start + BUFFER_SIZE);

      const raw = detectPitch(chunk, wav.sampleRate);
      expect(raw).not.toBeNull();
      expect(raw!.clarity).toBeGreaterThan(0.8);

      const corrected = correctOctaveErrors(raw!, chunk, wav.sampleRate);
      expect(corrected).not.toBeNull();

      // After octave correction, frequency should be in the right ballpark
      const ratio = corrected!.frequency / sample.expectedHz;
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
    });
  }
});
