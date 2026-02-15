import type { NoteInfo } from "./types";

const NOTE_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F",
  "F♯", "G", "G♯", "A", "A♯", "B",
] as const;

const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export function frequencyToNote(hz: number): NoteInfo {
  const midiFloat = 12 * Math.log2(hz / A4_FREQUENCY) + A4_MIDI;
  const midiRounded = Math.round(midiFloat);
  const cents = (midiFloat - midiRounded) * 100;
  const note = NOTE_NAMES[((midiRounded % 12) + 12) % 12];
  const octave = Math.floor(midiRounded / 12) - 1;

  return { note, octave, cents, frequency: hz };
}
