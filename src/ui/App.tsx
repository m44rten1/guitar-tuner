import { createSignal, onCleanup, Show } from "solid-js";
import type { TunerState } from "../tuner/types";
import { createAudioCapture } from "../audio/capture";
import Gauge from "./Gauge";
import NoteDisplay from "./NoteDisplay";
import "./App.css";

export default function App() {
  const [state, setState] = createSignal<TunerState>({ status: "idle" });
  let capture: ReturnType<typeof createAudioCapture> | null = null;

  async function handleStart() {
    if (state().status !== "idle") return;
    capture = createAudioCapture(setState);
    await capture.start();
  }

  onCleanup(() => capture?.stop());

  const isDetected = () => state().status === "detected";
  const cents = () => {
    const s = state();
    return s.status === "detected" ? s.cents : 0;
  };

  return (
    <div class="tuner" onClick={handleStart}>
      <Show when={state().status === "idle"}>
        <div class="tap-prompt">Tap to start</div>
      </Show>

      <Show when={state().status !== "idle"}>
        <Gauge cents={cents()} active={isDetected()} />
        <NoteDisplay state={state()} />
      </Show>

      <Show when={state().status === "listening" && !isDetected()}>
        <div class="listening-hint">Listening…</div>
      </Show>
    </div>
  );
}
