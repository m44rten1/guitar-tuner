export type TunerState =
  | { status: "idle" }
  | { status: "listening" }
  | {
      status: "detected";
      note: string;
      octave: number;
      cents: number;
      frequency: number;
      clarity: number;
    };

export interface PitchResult {
  frequency: number;
  clarity: number;
}

export interface NoteInfo {
  note: string;
  octave: number;
  cents: number;
  frequency: number;
}
