import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { TunerState } from "../tuner/types";
import { createAudioCapture } from "../audio/capture";
import Gauge from "./Gauge";
import NoteDisplay from "./NoteDisplay";
import "./App.css";

async function micAlreadyGranted(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state === "granted";
  } catch {
    return false; // Safari doesn't support querying microphone permission
  }
}

export default function App() {
  const [state, setState] = createSignal<TunerState>({ status: "idle" });
  let capture: ReturnType<typeof createAudioCapture> | null = null;

  async function startCapture() {
    if (state().status !== "idle") return;
    capture = createAudioCapture(setState);
    await capture.start();
  }

  onMount(async () => {
    if (await micAlreadyGranted()) {
      await startCapture();
    }
  });

  onCleanup(() => capture?.stop());

  const isDetected = () => state().status === "detected";
  const cents = () => {
    const s = state();
    return s.status === "detected" ? s.cents : 0;
  };

  return (
    <div class="tuner" onClick={startCapture}>
      <Show when={state().status === "idle"}>
        <div class="tap-prompt">Tap to start</div>
      </Show>

      <Show when={state().status !== "idle"}>
        <Gauge cents={cents()} active={isDetected()} />
        <NoteDisplay state={state()} />
      </Show>
    </div>
  );
}
