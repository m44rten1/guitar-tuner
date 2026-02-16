import type { TunerState } from "../tuner/types";
import { detectPitch } from "./pitch-detector";
import { correctOctaveErrors } from "./octave-correction";
import { PitchSmoother } from "./smoother";

export interface AudioCapture {
  start(): Promise<void>;
  stop(): void;
}

/**
 * Creates a mic capture pipeline:
 * getUserMedia -> AnalyserNode -> rAF loop -> YIN -> octave correction -> smoother -> callback
 *
 * Stops the mic when the page is hidden and restarts when visible again.
 */
export function createAudioCapture(
  onState: (state: TunerState) => void,
): AudioCapture {
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;
  let restarting = false;
  const smoother = new PitchSmoother();

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      restart();
    } else {
      releaseResources();
    }
  }

  async function restart(): Promise<void> {
    if (restarting) return;
    restarting = true;
    teardown();
    try {
      await start();
    } catch {
      onState({ status: "idle" });
    } finally {
      restarting = false;
    }
  }

  async function start(): Promise<void> {
    try {
      audioContext = new AudioContext();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const sampleRate = audioContext.sampleRate;

      // iOS kills mic tracks when the PWA is backgrounded
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => restart();
      });

      document.addEventListener("visibilitychange", onVisibilityChange);

      onState({ status: "listening" });

      function tick() {
        analyser.getFloatTimeDomainData(buffer);

        const raw = detectPitch(buffer, sampleRate);
        if (raw) {
          const corrected = correctOctaveErrors(raw, buffer, sampleRate);
          if (corrected) {
            const smoothed = smoother.process(corrected);
            if (smoothed) {
              onState({
                status: "detected",
                note: smoothed.note,
                octave: smoothed.octave,
                cents: smoothed.cents,
                frequency: smoothed.frequency,
                clarity: smoothed.clarity,
              });
              rafId = requestAnimationFrame(tick);
              return;
            }
          }
        }

        onState({ status: "listening" });
        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    } catch (e) {
      teardown();
      throw e;
    }
  }

  /** Releases audio resources but keeps the visibility listener. */
  function releaseResources(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stream?.getAudioTracks().forEach((t) => {
      t.onended = null;
    });
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    audioContext?.close();
    audioContext = null;
    smoother.reset();
  }

  /** Releases all resources and removes event listeners. */
  function teardown(): void {
    releaseResources();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function stop(): void {
    teardown();
    onState({ status: "idle" });
  }

  return { start, stop };
}
