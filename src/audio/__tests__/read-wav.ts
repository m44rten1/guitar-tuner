import { readFileSync } from "node:fs";

export interface WavData {
  sampleRate: number;
  channels: number;
  samples: Float32Array; // mono (averaged if stereo)
}

/**
 * Minimal WAV reader for 16-bit PCM files.
 * Converts to mono Float32Array in [-1, 1] range.
 */
export function readWav(path: string): WavData {
  const buf = readFileSync(path);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // RIFF header
  const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (riff !== "RIFF") throw new Error("Not a RIFF file");

  const wave = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  if (wave !== "WAVE") throw new Error("Not a WAVE file");

  // Find fmt chunk
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buf.length) {
    const chunkId = String.fromCharCode(
      buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3],
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      const audioFormat = view.getUint16(offset + 8, true);
      if (audioFormat !== 1) throw new Error(`Unsupported format: ${audioFormat} (need PCM)`);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      if (bitsPerSample !== 16) throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
  }

  if (!sampleRate || !dataOffset) throw new Error("Missing fmt or data chunk");

  const totalSamples = dataSize / 2; // 16-bit = 2 bytes per sample
  const framesCount = totalSamples / channels;
  const mono = new Float32Array(framesCount);

  for (let i = 0; i < framesCount; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const sampleOffset = dataOffset + (i * channels + ch) * 2;
      sum += view.getInt16(sampleOffset, true) / 32768;
    }
    mono[i] = sum / channels;
  }

  return { sampleRate, channels, samples: mono };
}
