// utils/audioUtils.ts
import { downloadFile } from './exportUtils';

let audioContext: AudioContext | null = null;
let masterAudioBuffer: AudioBuffer | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;

let isPlayingGlobally = false;
let isPausedGlobally = false;
let currentGlobalPlaybackRate = 1.0;
let globalAudioContextStartTime = 0; 
let globalBufferStartOffset = 0;   

let onEndCallbackGlobal: (() => void) | null = null;
let onErrorCallbackGlobal: ((error: any) => void) | null = null;
let onTimeUpdateCallbackGlobal: ((currentTime: number) => void) | null = null;
let timeUpdateInterval: number | null = null;


function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function base64ToFloat32Array(base64String: string): Float32Array {
  try {
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.buffer.byteLength % 2 !== 0) {
        console.warn("PCM data length is not a multiple of 2, potential truncation or corruption.");
        // Ensure buffer is even for Int16Array
        const safeBufferLength = Math.floor(bytes.buffer.byteLength / 2) * 2;
        const safeBufferView = new Uint8Array(bytes.buffer, 0, safeBufferLength);
        const int16Array = new Int16Array(safeBufferView.buffer, safeBufferView.byteOffset, safeBufferView.byteLength / 2);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }
        return float32Array;
    } else {
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }
        return float32Array;
    }
  } catch (e) {
    console.error("Error in base64ToFloat32Array:", e);
    if (onErrorCallbackGlobal) onErrorCallbackGlobal(e);
    return new Float32Array(0);
  }
}

function _cleanupCurrentSource() {
    if (currentSourceNode) {
        currentSourceNode.onended = null;
        try { currentSourceNode.stop(); } catch (e) { /* ignore if already stopped or not started */ }
        currentSourceNode.disconnect();
        currentSourceNode = null;
    }
}

function _stopTimer() {
    if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
}

function _startTimer() {
    _stopTimer();
    timeUpdateInterval = setInterval(() => {
        if (isPlayingGlobally && !isPausedGlobally && onTimeUpdateCallbackGlobal) {
            onTimeUpdateCallbackGlobal(getCurrentPlaybackTimeInternal());
        }
    }, 250); // Update ~4 times a second
}

export async function loadAudioForPlayback(
    base64PcmData: string,
    sampleRate: number,
    onLoaded: (duration: number) => void,
    onError: (error: any) => void
): Promise<void> {
    stopGlobalAudio(); 
    masterAudioBuffer = null;
    onErrorCallbackGlobal = onError;

    const context = getAudioContext();
    const float32PcmData = base64ToFloat32Array(base64PcmData);

    if (!float32PcmData || float32PcmData.length === 0) {
        onError(new Error("Decoded PCM data is empty."));
        return;
    }

    try {
        masterAudioBuffer = context.createBuffer(1, float32PcmData.length, sampleRate);
        masterAudioBuffer.copyToChannel(float32PcmData, 0);
        onLoaded(masterAudioBuffer.duration);
    } catch (bufferError) {
        console.error("Error creating AudioBuffer:", bufferError);
        onError(bufferError);
        masterAudioBuffer = null;
    }
}

function _startPlaybackInternal(offsetSeconds: number) {
    if (!masterAudioBuffer) {
        if (onErrorCallbackGlobal) onErrorCallbackGlobal(new Error("Audio buffer not loaded."));
        return;
    }
    const context = getAudioContext();
    _cleanupCurrentSource();

    currentSourceNode = context.createBufferSource();
    currentSourceNode.buffer = masterAudioBuffer;
    currentSourceNode.playbackRate.value = currentGlobalPlaybackRate;
    currentSourceNode.connect(context.destination);

    currentSourceNode.onended = () => {
        if (currentSourceNode && isPlayingGlobally && !isPausedGlobally) {
            // Check if it truly ended (or very close to it)
            const endedNaturally = masterAudioBuffer && (globalBufferStartOffset + (context.currentTime - globalAudioContextStartTime) * currentGlobalPlaybackRate >= masterAudioBuffer.duration - 0.1);
            if (endedNaturally) {
                 _cleanupCurrentSource();
                 isPlayingGlobally = false;
                 isPausedGlobally = false;
                 globalBufferStartOffset = 0; // Reset to start for next play, or to duration?
                 _stopTimer();
                 if (onTimeUpdateCallbackGlobal && masterAudioBuffer) onTimeUpdateCallbackGlobal(masterAudioBuffer.duration);
                 if (onEndCallbackGlobal) onEndCallbackGlobal();
            }
        }
    };
    
    try {
        currentSourceNode.start(0, offsetSeconds);
        globalAudioContextStartTime = context.currentTime;
        globalBufferStartOffset = offsetSeconds;
        isPlayingGlobally = true;
        isPausedGlobally = false;
        _startTimer();
    } catch (e) {
        if (onErrorCallbackGlobal) onErrorCallbackGlobal(e);
        _cleanupCurrentSource();
    }
}

function getCurrentPlaybackTimeInternal(): number {
    if (!masterAudioBuffer) return 0;
    if (isPausedGlobally) return globalBufferStartOffset; // When paused, this stores the exact pause time
    if (isPlayingGlobally && currentSourceNode) {
        const context = getAudioContext();
        const elapsed = (context.currentTime - globalAudioContextStartTime) * currentGlobalPlaybackRate;
        return Math.min(globalBufferStartOffset + elapsed, masterAudioBuffer.duration);
    }
    return globalBufferStartOffset; 
}

// Function to encode Float32Array PCM data to WAV ArrayBuffer
function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number): ArrayBuffer {
    const EOL = '\r\n';
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* FMT sub-chunk */
    writeString(view, 12, 'fmt ');
    /* FMT chunk length */
    view.setUint32(16, 16, true);
    /* Audio format (PCM) */
    view.setUint16(20, 1, true);
    /* Number of channels */
    view.setUint16(22, numChannels, true);
    /* Sample rate */
    view.setUint32(24, sampleRate, true);
    /* Byte rate (SampleRate * NumChannels * BitsPerSample/8) */
    view.setUint32(28, byteRate, true);
    /* Block align (NumChannels * BitsPerSample/8) */
    view.setUint16(32, blockAlign, true);
    /* Bits per sample */
    view.setUint16(34, 16, true);
    /* DATA sub-chunk */
    writeString(view, 36, 'data');
    /* DATA chunk length */
    view.setUint32(40, samples.length * bytesPerSample, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


export interface AudioPlaybackControls {
    play: () => void;
    pause: () => void;
    stop: () => void;
    seek: (timeInSeconds: number) => void;
    setPlaybackRate: (rate: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    cleanup: () => void;
    exportWav: (filename: string) => void; // New method
}

export function getPlaybackControls(
    onEnd: () => void,
    onError: (error: any) => void,
    onTimeUpdate: (currentTime: number) => void
): AudioPlaybackControls {
    onEndCallbackGlobal = onEnd;
    onErrorCallbackGlobal = onError;
    onTimeUpdateCallbackGlobal = onTimeUpdate;

    const play = () => {
        if (!masterAudioBuffer) {
            if (onErrorCallbackGlobal) onErrorCallbackGlobal(new Error("Audio not loaded to play."));
            return;
        }
        _startPlaybackInternal(globalBufferStartOffset); 
    };

    const pause = () => {
        if (!isPlayingGlobally) return; 
        const currentTime = getCurrentPlaybackTimeInternal();
        _cleanupCurrentSource(); 
        globalBufferStartOffset = currentTime; 
        isPlayingGlobally = false;
        isPausedGlobally = true;
        _stopTimer(); 
        if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(globalBufferStartOffset); 
    };
    
    const stop = () => {
        _cleanupCurrentSource();
        isPlayingGlobally = false;
        isPausedGlobally = false;
        globalBufferStartOffset = 0; 
        _stopTimer();
        if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(0); 
        if (onEndCallbackGlobal) onEndCallbackGlobal(); 
    };

    const seek = (timeInSeconds: number) => {
        if (!masterAudioBuffer) return;
        const originallyPaused = isPausedGlobally;
        const originallyPlaying = isPlayingGlobally;

        const newOffset = Math.max(0, Math.min(timeInSeconds, masterAudioBuffer.duration));
        if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(newOffset); 

        if (originallyPlaying || originallyPaused) {
            _cleanupCurrentSource(); 
            _startPlaybackInternal(newOffset); 
            if (originallyPaused) { 
                pause(); 
            }
        } else {
            globalBufferStartOffset = newOffset; 
        }
    };
    
    const setPlaybackRate = (rate: number) => {
        if (!masterAudioBuffer) return;
        const originallyPaused = isPausedGlobally;
        const originallyPlaying = isPlayingGlobally;
        
        const currentTimeForRestart = getCurrentPlaybackTimeInternal(); 
        currentGlobalPlaybackRate = rate;
        
        if (originallyPlaying || originallyPaused) {
            _cleanupCurrentSource(); 
            _startPlaybackInternal(currentTimeForRestart); 
            if (originallyPaused) { 
                pause();
            }
        }
    };

    const getCurrentTime = (): number => {
        return getCurrentPlaybackTimeInternal();
    };

    const getDuration = (): number => {
        return masterAudioBuffer ? masterAudioBuffer.duration : 0;
    };

    const exportWav = (filename: string) => {
        if (!masterAudioBuffer) {
            if (onErrorCallbackGlobal) onErrorCallbackGlobal(new Error("No audio loaded to export."));
            alert("Error: No audio loaded to export.");
            return;
        }
        try {
            const pcmData = masterAudioBuffer.getChannelData(0); // Assuming mono
            const wavBuffer = encodeWAV(pcmData, masterAudioBuffer.sampleRate, 1);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            // Pass the Blob directly, not its URL.
            // The downloadFile utility will handle creating a URL from the Blob for the anchor tag.
            downloadFile(blob, filename); 
        } catch (e) {
            console.error("Error exporting WAV:", e);
            if (onErrorCallbackGlobal) onErrorCallbackGlobal(e);
            alert(`Error exporting audio: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const cleanup = () => {
        stopGlobalAudio(); 
        onEndCallbackGlobal = null;
        onErrorCallbackGlobal = null;
        onTimeUpdateCallbackGlobal = null;
    };

    return { play, pause, stop, seek, setPlaybackRate, getCurrentTime, getDuration, cleanup, exportWav };
}

export function stopGlobalAudio() {
  _cleanupCurrentSource();
  isPlayingGlobally = false;
  isPausedGlobally = false;
  globalBufferStartOffset = 0;
  masterAudioBuffer = null; 
  _stopTimer();
}
