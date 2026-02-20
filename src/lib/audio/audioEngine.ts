import type { EQBand } from '$lib/types';

export class AudioEngine {
    context: AudioContext;
    gainNode: GainNode;
    analyserNode: AnalyserNode;
    eqNodes: BiquadFilterNode[] = [];

    private source: AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private isPlaying: boolean = false;

    constructor() {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.gainNode = this.context.createGain();
        this.analyserNode = this.context.createAnalyser();
        this.analyserNode.fftSize = 2048;

        // Initialize EQ
        this.setupEQ();

        // Connect graph: EQ -> Gain -> Analyser -> Destination
        // (Source will connect to EQ input)
        let lastNode: AudioNode = this.eqNodes[0];
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.context.destination);
    }

    private setupEQ() {
        const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        let previousNode: AudioNode | null = null;

        this.eqNodes = frequencies.map((freq, index) => {
            const filter = this.context.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.0;
            filter.gain.value = 0;

            if (previousNode) {
                previousNode.connect(filter);
            }
            previousNode = filter;
            return filter;
        });

        // Connect last EQ filter to Gain
        if (previousNode) {
            (previousNode as AudioNode).connect(this.gainNode);
        }
    }

    get EQInputNode(): AudioNode {
        return this.eqNodes[0];
    }

    async loadTrack(buffer: ArrayBuffer) {
        const audioBuffer = await this.context.decodeAudioData(buffer);
        this.stop(); // Stop potential previous track

        this.source = this.context.createBufferSource();
        this.source.buffer = audioBuffer;
        this.source.connect(this.EQInputNode);

        // Reset times
        this.startTime = 0;
        this.pauseTime = 0;
    }

    play() {
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
        if (!this.source) return;
        if (this.isPlaying) return;

        // AudioBufferSourceNode can only be played once.
        // If resuming from pause, a new source at the saved offset is needed.
        if (this.pauseTime > 0) {
            const buffer = (this.source as AudioBufferSourceNode).buffer;
            if (buffer) {
                this.source.disconnect();
                this.createSourceFromBuffer(buffer, this.pauseTime);
            }
        }

        this.source.start(0, this.pauseTime);
        this.startTime = this.context.currentTime - this.pauseTime;
        this.isPlaying = true;

        this.source.onended = () => {
            if (this.isPlaying) this.isPlaying = false;
        };
    }

    pause() {
        if (!this.source || !this.isPlaying) return;
        this.source.stop();
        this.pauseTime = this.context.currentTime - this.startTime;
        this.isPlaying = false;
    }

    stop() {
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (e) { /* ignore if already stopped */ }
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseTime = 0;
        this.startTime = 0;
    }

    seek(time: number) {
        if (!this.source) return;
        // We must restart the source node
        const buffer = (this.source as AudioBufferSourceNode).buffer;
        this.stop();
        if (buffer) {
            this.createSourceFromBuffer(buffer, time);
            this.source!.start(0, time);
            this.startTime = this.context.currentTime - time;
            this.pauseTime = time;
            this.isPlaying = true;
        }
    }

    setVolume(v: number) {
        this.gainNode.gain.setTargetAtTime(v, this.context.currentTime, 0.01);
    }

    setEQBand(index: number, gain: number) {
        if (this.eqNodes[index]) {
            this.eqNodes[index].gain.setTargetAtTime(gain, this.context.currentTime, 0.1);
        }
    }

    private createSourceFromBuffer(buffer: AudioBuffer, offset: number) {
        this.source = this.context.createBufferSource();
        this.source.buffer = buffer;
        this.source.connect(this.EQInputNode);
    }

    getCurrentTime(): number {
        if (!this.isPlaying) return this.pauseTime;
        return this.context.currentTime - this.startTime;
    }

    getDuration(): number {
        if (this.source && (this.source as AudioBufferSourceNode).buffer) {
            return (this.source as AudioBufferSourceNode).buffer!.duration;
        }
        return 0;
    }
}
