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
 */
export function createAudioCapture(
  onState: (state: TunerState) => void,
): AudioCapture {
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;
  const smoother = new PitchSmoother();

  async function start(): Promise<void> {
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

      // No detection this frame — stay in listening state
      onState({ status: "listening" });
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    audioContext?.close();
    audioContext = null;
    smoother.reset();
    onState({ status: "idle" });
  }

  return { start, stop };
}
