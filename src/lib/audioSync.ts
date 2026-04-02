// Audio onset detection — finds when music/sound starts in a video
// Uses Web Audio API to analyze audio energy

export interface AudioOnset {
  startTime: number; // seconds where audio energy first exceeds threshold
  beatTimes: number[]; // detected beat/onset times
}

// Extract audio buffer from video element
async function extractAudioBuffer(videoUrl: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(videoUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();
    return audioBuffer;
  } catch {
    console.warn('Could not extract audio from video');
    return null;
  }
}

// Compute RMS energy for chunks of audio
function computeEnergy(samples: Float32Array, chunkSize: number): number[] {
  const energies: number[] = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    let sum = 0;
    const end = Math.min(i + chunkSize, samples.length);
    for (let j = i; j < end; j++) {
      sum += samples[j] * samples[j];
    }
    energies.push(Math.sqrt(sum / (end - i)));
  }
  return energies;
}

// Detect onsets (sudden increases in energy)
function detectOnsets(energies: number[], threshold: number): number[] {
  const onsets: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    if (diff > threshold && energies[i] > threshold * 0.5) {
      // Avoid detecting onsets too close together (min 0.2s apart at typical chunk rates)
      if (onsets.length === 0 || i - onsets[onsets.length - 1] > 3) {
        onsets.push(i);
      }
    }
  }
  return onsets;
}

// Find the start time of music/activity in a video
export async function detectAudioStart(videoUrl: string): Promise<AudioOnset> {
  const audioBuffer = await extractAudioBuffer(videoUrl);

  if (!audioBuffer) {
    return { startTime: 0, beatTimes: [] };
  }

  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0); // mono

  // Chunk size: ~50ms per chunk
  const chunkSize = Math.floor(sampleRate * 0.05);
  const chunkDuration = chunkSize / sampleRate;

  const energies = computeEnergy(samples, chunkSize);

  // Find energy threshold (adaptive: mean + 1.5 * stddev of first 2 seconds)
  const silenceChunks = Math.min(Math.floor(2 / chunkDuration), energies.length);
  let mean = 0;
  for (let i = 0; i < silenceChunks; i++) mean += energies[i];
  mean /= silenceChunks;

  let stddev = 0;
  for (let i = 0; i < silenceChunks; i++) stddev += (energies[i] - mean) ** 2;
  stddev = Math.sqrt(stddev / silenceChunks);

  const threshold = mean + Math.max(stddev * 1.5, 0.01);

  // Find first chunk that exceeds threshold
  let startChunk = 0;
  for (let i = 0; i < energies.length; i++) {
    if (energies[i] > threshold) {
      startChunk = i;
      break;
    }
  }
  const startTime = startChunk * chunkDuration;

  // Detect beat onsets
  const onsetChunks = detectOnsets(energies, threshold * 0.3);
  const beatTimes = onsetChunks.map((c) => c * chunkDuration);

  return { startTime, beatTimes };
}

// Compute a time offset between two videos based on audio onset
export async function computeAudioOffset(
  refUrl: string,
  userUrl: string
): Promise<{ refStart: number; userStart: number }> {
  const [refOnset, userOnset] = await Promise.all([
    detectAudioStart(refUrl),
    detectAudioStart(userUrl),
  ]);

  return {
    refStart: refOnset.startTime,
    userStart: userOnset.startTime,
  };
}
