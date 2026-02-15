import type { Component } from "solid-js";
import type { TunerState } from "../tuner/types";

interface NoteDisplayProps {
  state: TunerState;
}

function formatCents(cents: number): string {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}${cents.toFixed(1)} cents`;
}

const NoteDisplay: Component<NoteDisplayProps> = (props) => {
  const detected = () =>
    props.state.status === "detected" ? props.state : null;
  const inTune = () => {
    const d = detected();
    return d !== null && Math.abs(d.cents) < 3;
  };

  return (
    <div class="note-display">
      <div
        class="note-name"
        classList={{
          "note-name--active": detected() !== null,
          "note-name--in-tune": inTune(),
        }}
      >
        {detected()?.note ?? "—"}
        <sub class="note-octave">{detected()?.octave ?? ""}</sub>
      </div>
      <div class="frequency-readout">
        {detected() ? `${detected()!.frequency.toFixed(1)} Hz` : "\u00A0"}
      </div>
      <div
        class="cents-readout"
        classList={{ "cents-readout--in-tune": inTune() }}
      >
        {detected() ? formatCents(detected()!.cents) : "\u00A0"}
      </div>
    </div>
  );
};

export default NoteDisplay;
