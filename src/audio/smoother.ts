import type { PitchResult } from "../tuner/types";
import { frequencyToNote } from "../tuner/note-mapping";

const MEDIAN_WINDOW = 5;
const EMA_ALPHA = 0.1;
const MIN_CLARITY = 0.85;
const STABILITY_WINDOW = 5;
const STABILITY_SPREAD_CENTS = 30;
const NOTE_CHANGE_CENTS = 150;
const HYSTERESIS_MS = 100;

export interface SmoothedResult {
  frequency: number;
  clarity: number;
  note: string;
  octave: number;
  cents: number;
}

export class PitchSmoother {
  private medianBuffer: number[] = [];
  private emaFrequency: number | null = null;
  private stabilityBuffer: number[] = [];
  private currentNote: string | null = null;
  private currentOctave: number | null = null;
  private pendingNote: string | null = null;
  private pendingOctave: number | null = null;
  private pendingNoteTimestamp: number | null = null;

  reset(): void {
    this.medianBuffer = [];
    this.emaFrequency = null;
    this.stabilityBuffer = [];
    this.currentNote = null;
    this.currentOctave = null;
    this.pendingNote = null;
    this.pendingOctave = null;
    this.pendingNoteTimestamp = null;
  }

  /** Process a new pitch reading. Returns null if not yet stable enough. */
  process(result: PitchResult, now: number = Date.now()): SmoothedResult | null {
    // Clarity gate: require high-confidence reading
    if (result.clarity < MIN_CLARITY) {
      this.stabilityBuffer = [];
      return null;
    }

    // Note-change detection: reset when a clearly different note appears
    if (this.emaFrequency !== null) {
      const centsDiff = Math.abs(1200 * Math.log2(result.frequency / this.emaFrequency));
      if (centsDiff > NOTE_CHANGE_CENTS) {
        this.reset();
      }
    }

    // Stability buffer: collect confident readings and check convergence
    this.stabilityBuffer.push(result.frequency);
    if (this.stabilityBuffer.length > STABILITY_WINDOW) {
      this.stabilityBuffer.shift();
    }

    if (this.stabilityBuffer.length < STABILITY_WINDOW) {
      return null;
    }

    if (this.stabilitySpreadCents() > STABILITY_SPREAD_CENTS) {
      return null;
    }

    // Readings are stable — proceed with median + EMA
    this.medianBuffer.push(result.frequency);
    if (this.medianBuffer.length > MEDIAN_WINDOW) {
      this.medianBuffer.shift();
    }
    const medianFreq = median(this.medianBuffer);

    if (this.emaFrequency === null) {
      this.emaFrequency = medianFreq;
    } else {
      this.emaFrequency = EMA_ALPHA * medianFreq + (1 - EMA_ALPHA) * this.emaFrequency;
    }

    const smoothedFreq = this.emaFrequency;
    const noteInfo = frequencyToNote(smoothedFreq);

    const displayNote = this.applyHysteresis(
      noteInfo.note,
      noteInfo.octave,
      now,
    );

    return {
      frequency: smoothedFreq,
      clarity: result.clarity,
      note: displayNote.note,
      octave: displayNote.octave,
      cents: noteInfo.cents,
    };
  }

  private stabilitySpreadCents(): number {
    const min = Math.min(...this.stabilityBuffer);
    const max = Math.max(...this.stabilityBuffer);
    return 1200 * Math.log2(max / min);
  }

  private applyHysteresis(
    newNote: string,
    newOctave: number,
    now: number,
  ): { note: string; octave: number } {
    // No current note yet — accept immediately
    if (this.currentNote === null || this.currentOctave === null) {
      this.currentNote = newNote;
      this.currentOctave = newOctave;
      this.pendingNote = null;
      this.pendingOctave = null;
      this.pendingNoteTimestamp = null;
      return { note: newNote, octave: newOctave };
    }

    // Same as current — keep it
    if (newNote === this.currentNote && newOctave === this.currentOctave) {
      this.pendingNote = null;
      this.pendingOctave = null;
      this.pendingNoteTimestamp = null;
      return { note: this.currentNote, octave: this.currentOctave };
    }

    // Different note — start or continue pending timer
    if (newNote !== this.pendingNote || newOctave !== this.pendingOctave) {
      this.pendingNote = newNote;
      this.pendingOctave = newOctave;
      this.pendingNoteTimestamp = now;
      return { note: this.currentNote, octave: this.currentOctave };
    }

    // Pending note is consistent — check if enough time has passed
    if (this.pendingNoteTimestamp !== null && now - this.pendingNoteTimestamp >= HYSTERESIS_MS) {
      this.currentNote = newNote;
      this.currentOctave = newOctave;
      this.pendingNote = null;
      this.pendingOctave = null;
      this.pendingNoteTimestamp = null;
      return { note: newNote, octave: newOctave };
    }

    return { note: this.currentNote, octave: this.currentOctave };
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
