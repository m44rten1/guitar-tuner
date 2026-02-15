import type { PitchResult } from "../tuner/types";
import { frequencyToNote } from "../tuner/note-mapping";

const MEDIAN_WINDOW = 5;
const EMA_ALPHA = 0.3;
const MIN_CLARITY = 0.85;
const MIN_CONSECUTIVE_CONFIDENT = 3;
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
  private consecutiveConfident = 0;
  private currentNote: string | null = null;
  private currentOctave: number | null = null;
  private pendingNote: string | null = null;
  private pendingOctave: number | null = null;
  private pendingNoteTimestamp: number | null = null;

  reset(): void {
    this.medianBuffer = [];
    this.emaFrequency = null;
    this.consecutiveConfident = 0;
    this.currentNote = null;
    this.currentOctave = null;
    this.pendingNote = null;
    this.pendingOctave = null;
    this.pendingNoteTimestamp = null;
  }

  /** Process a new pitch reading. Returns null if not yet confident enough. */
  process(result: PitchResult, now: number = Date.now()): SmoothedResult | null {
    // Confidence gating
    if (result.clarity < MIN_CLARITY) {
      this.consecutiveConfident = 0;
      return null;
    }

    this.consecutiveConfident++;
    if (this.consecutiveConfident < MIN_CONSECUTIVE_CONFIDENT) {
      return null;
    }

    // Median filter
    this.medianBuffer.push(result.frequency);
    if (this.medianBuffer.length > MEDIAN_WINDOW) {
      this.medianBuffer.shift();
    }
    const medianFreq = median(this.medianBuffer);

    // EMA smoothing
    if (this.emaFrequency === null) {
      this.emaFrequency = medianFreq;
    } else {
      this.emaFrequency = EMA_ALPHA * medianFreq + (1 - EMA_ALPHA) * this.emaFrequency;
    }

    const smoothedFreq = this.emaFrequency;
    const noteInfo = frequencyToNote(smoothedFreq);

    // Hysteresis on note name: don't switch unless stable for HYSTERESIS_MS
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
