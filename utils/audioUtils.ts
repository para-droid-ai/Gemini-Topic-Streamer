// utils/audioUtils.ts
import { downloadFile } from './exportUtils';

let audioContext: AudioContext | null = null;
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
        // Adjust to the largest multiple of 2 bytes
        const safeBufferLength = Math.floor(bytes.buffer.byteLength / 2) * 2;
        if (safeBufferLength === 0) return new Float32Array(0); // Handle case where it's less than 2 bytes
        const safeBufferView = new Uint8Array(bytes.buffer, 0, safeBufferLength);
        const int16Array = new Int16Array(safeBufferView.buffer, safeBufferView.byteOffset, safeBufferView.byteLength / 2);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }
        return float32Array;
    } else {
        if (bytes.buffer.byteLength === 0) return new Float32Array(0);
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }
        return float32Array;
    }
  } catch (e) {
    console.error("Error in base64ToFloat32Array:", e);
    throw e; 
  }
}

function _cleanupCurrentSource() {
    if (currentSourceNode) {
        currentSourceNode.onended = null; // CRITICAL: Detach handler before stopping
        try { 
            currentSourceNode.stop(); 
        } catch (e) { 
            // console.warn("Error stopping source node (might be already stopped or not started):", e);
        }
        currentSourceNode.disconnect();
        currentSourceNode = null;
    }
}

function _stopTimer() {
    if (timeUpdateInterval) {
        window.clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
}

function _startTimer(getCurrentTimeFn: () => number) {
    _stopTimer();
    timeUpdateInterval = window.setInterval(() => {
        if (isPlayingGlobally && !isPausedGlobally && onTimeUpdateCallbackGlobal) {
             onTimeUpdateCallbackGlobal(getCurrentTimeFn());
        }
    }, 250); 
}

export async function loadAudioForPlayback(
    float32PcmData: Float32Array, 
    sampleRate: number,
    onError: (error: any) => void
): Promise<AudioBuffer | null> {
    stopGlobalAudio(); // Ensure any previous global audio is stopped

    const context = getAudioContext();

    if (!float32PcmData || float32PcmData.length === 0) {
        onError(new Error("Provided PCM data is empty."));
        return null;
    }

    try {
        const audioBuffer = context.createBuffer(1, float32PcmData.length, sampleRate);
        audioBuffer.copyToChannel(float32PcmData, 0);
        return audioBuffer;
    } catch (bufferError) {
        console.error("Error creating AudioBuffer:", bufferError);
        onError(bufferError);
        return null;
    }
}

export function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number): ArrayBuffer {
    const bytesPerSample = 2; 
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
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
    exportWav: (filename: string) => void;
}

export function getPlaybackControls(
    audioBuffer: AudioBuffer,
    onEnd: () => void,
    onError: (error: any) => void, 
    onTimeUpdate: (currentTime: number) => void
): AudioPlaybackControls {
    
    onEndCallbackGlobal = onEnd;
    onErrorCallbackGlobal = onError;
    onTimeUpdateCallbackGlobal = onTimeUpdate;

    const _startPlaybackInternal = (offsetSeconds: number) => {
        const context = getAudioContext();
        _cleanupCurrentSource(); 

        currentSourceNode = context.createBufferSource();
        currentSourceNode.buffer = audioBuffer;
        currentSourceNode.playbackRate.value = currentGlobalPlaybackRate;
        currentSourceNode.connect(context.destination);
        
        // Store reference to these specific controls for the timer
        (currentSourceNode as any)._playbackControlsRef = playbackControlsInstance; 

        currentSourceNode.onended = () => {
             // Check if this 'onended' is for the node we think is current
            if (currentSourceNode === null || currentSourceNode.buffer !== audioBuffer) {
                return; 
            }
            // Only process if it was playing or paused (i.e., not already stopped and cleaned up)
            const wasPlayingOrPaused = isPlayingGlobally || isPausedGlobally;

            _cleanupCurrentSource(); // Nulls out currentSourceNode, critical for state management
            isPlayingGlobally = false;
            isPausedGlobally = false;
            globalBufferStartOffset = audioBuffer.duration; 
            _stopTimer();

            if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(audioBuffer.duration);
            if (wasPlayingOrPaused && onEndCallbackGlobal) {
                onEndCallbackGlobal();
            }
        };
        
        try {
            currentSourceNode.start(0, offsetSeconds);
            globalAudioContextStartTime = context.currentTime;
            globalBufferStartOffset = offsetSeconds;
            isPlayingGlobally = true;
            isPausedGlobally = false;
            _startTimer(getCurrentPlaybackTimeInternal);
        } catch (e) {
            if (onErrorCallbackGlobal) onErrorCallbackGlobal(e);
            _cleanupCurrentSource();
        }
    };

    const getCurrentPlaybackTimeInternal = (): number => {
        if (!isPlayingGlobally && !isPausedGlobally) return globalBufferStartOffset; 
        if (isPausedGlobally) return globalBufferStartOffset; 
        
        if (isPlayingGlobally && currentSourceNode && currentSourceNode.buffer === audioBuffer) { 
            const context = getAudioContext();
            const elapsed = (context.currentTime - globalAudioContextStartTime) * currentGlobalPlaybackRate;
            return Math.min(globalBufferStartOffset + elapsed, audioBuffer.duration);
        }
        return globalBufferStartOffset; 
    };
    
    const play = () => {
        if (audioContext?.state === 'suspended') {
            audioContext.resume().then(() => {
                _startPlaybackInternal(globalBufferStartOffset);
            }).catch(err => {
                if (onErrorCallbackGlobal) onErrorCallbackGlobal(err);
            });
        } else {
            _startPlaybackInternal(globalBufferStartOffset); 
        }
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
        const wasActive = isPlayingGlobally || isPausedGlobally;
        _cleanupCurrentSource(); // This nulls currentSourceNode and its onended
        isPlayingGlobally = false;
        isPausedGlobally = false;
        const finalTime = globalBufferStartOffset; 
        globalBufferStartOffset = 0; 
        _stopTimer();
        if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(finalTime > 0 ? finalTime : 0);
        // Do NOT call onEndCallbackGlobal here. It's called by the natural 'onended' or handled by the caller of stop (e.g. resetPodcastPlayer).
    };

    const seek = (timeInSeconds: number) => {
        const originallyPaused = isPausedGlobally;
        const originallyPlaying = isPlayingGlobally;

        const newOffset = Math.max(0, Math.min(timeInSeconds, audioBuffer.duration));
        if (onTimeUpdateCallbackGlobal) onTimeUpdateCallbackGlobal(newOffset); 

        if (originallyPlaying || originallyPaused) {
            _cleanupCurrentSource(); 
            globalBufferStartOffset = newOffset; 
            _startPlaybackInternal(newOffset); 
            if (originallyPaused) { 
                pause(); 
            }
        } else { 
            globalBufferStartOffset = newOffset; 
        }
    };
    
    const setPlaybackRate = (rate: number) => {
        const originallyPaused = isPausedGlobally;
        const originallyPlaying = isPlayingGlobally;
        
        const currentTimeForRestart = getCurrentPlaybackTimeInternal(); 
        currentGlobalPlaybackRate = rate;
        
        if (originallyPlaying || originallyPaused) {
            _cleanupCurrentSource(); 
            globalBufferStartOffset = currentTimeForRestart; 
            _startPlaybackInternal(currentTimeForRestart); 
            if (originallyPaused) { 
                pause();
            }
        }
    };

    const getCurrentTime = (): number => getCurrentPlaybackTimeInternal();
    const getDuration = (): number => audioBuffer.duration;

    const exportWav = (filename: string) => {
        try {
            const pcmData = audioBuffer.getChannelData(0); 
            const wavBufferData = encodeWAV(pcmData, audioBuffer.sampleRate, 1);
            const blob = new Blob([wavBufferData], { type: 'audio/wav' });
            downloadFile(blob, filename); 
        } catch (e) {
            console.error("Error exporting WAV:", e);
            if (onErrorCallbackGlobal) onErrorCallbackGlobal(e);
            alert(`Error exporting audio: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const cleanup = () => {
        // This specific instance's cleanup. If it was the one playing, stopGlobalAudio will handle it.
        // If a new sound starts, stopGlobalAudio is called first.
        if (currentSourceNode && currentSourceNode.buffer === audioBuffer) {
             stopGlobalAudio(); // This will call _cleanupCurrentSource for the global node
        }
        // Clear instance-specific callbacks to prevent them from being called by other instances
        if (onEndCallbackGlobal === onEnd) onEndCallbackGlobal = null;
        if (onErrorCallbackGlobal === onError) onErrorCallbackGlobal = null;
        if (onTimeUpdateCallbackGlobal === onTimeUpdate) onTimeUpdateCallbackGlobal = null;
    };
    
    const playbackControlsInstance = { play, pause, stop, seek, setPlaybackRate, getCurrentTime, getDuration, cleanup, exportWav };
    return playbackControlsInstance;
}

// This function stops ANY audio that might be playing globally.
export function stopGlobalAudio() {
  _cleanupCurrentSource(); 
  isPlayingGlobally = false;
  isPausedGlobally = false;
  globalBufferStartOffset = 0;
  _stopTimer();
  // Do not clear global callbacks here, they are managed by specific playback instances
}
