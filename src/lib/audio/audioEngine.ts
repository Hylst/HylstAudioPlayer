// src/lib/audio/audioEngine.ts — Low-level Web Audio API engine
// Manages the audio graph: Source → EQ Bands → Gain → Analyser → Destination

export class AudioEngine {
    context: AudioContext;
    gainNode: GainNode;
    analyserNode: AnalyserNode;
    eqNodes: BiquadFilterNode[] = [];

    // Only AudioBufferSourceNode is used — MediaElementAudioSourceNode is not.
    private source: AudioBufferSourceNode | null = null;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private isPlaying: boolean = false;

    constructor() {
        this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.gainNode = this.context.createGain();
        this.analyserNode = this.context.createAnalyser();
        this.analyserNode.fftSize = 2048;

        // Initialize EQ chain, then connect: EQ → Gain → Analyser → Destination
        this.setupEQ();
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.context.destination);
    }

    private setupEQ(): void {
        const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        let previousNode: AudioNode | null = null;

        this.eqNodes = frequencies.map((freq) => {
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

        // Connect last EQ filter to Gain node
        if (previousNode) {
            (previousNode as AudioNode).connect(this.gainNode);
        }
    }

    /** Entry point for source nodes — connect here to route through EQ */
    get EQInputNode(): AudioNode {
        return this.eqNodes[0];
    }

    async loadTrack(buffer: ArrayBuffer): Promise<void> {
        const audioBuffer = await this.context.decodeAudioData(buffer);
        this.stop(); // Stop and clean up previous source

        this.source = this.context.createBufferSource();
        this.source.buffer = audioBuffer;
        this.source.connect(this.EQInputNode);

        this.startTime = 0;
        this.pauseTime = 0;
    }

    async play(): Promise<void> {
        // Chrome autoplay policy: AudioContext starts suspended — must await resume
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        if (!this.source) return;
        if (this.isPlaying) return;

        // AudioBufferSourceNode can only play once — recreate from buffer on resume
        if (this.pauseTime > 0) {
            const buffer = this.source.buffer;
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

    pause(): void {
        if (!this.source || !this.isPlaying) return;
        this.source.stop();
        this.pauseTime = this.context.currentTime - this.startTime;
        this.isPlaying = false;
    }

    stop(): void {
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch {
                // Already stopped — ignore
            }
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseTime = 0;
        this.startTime = 0;
    }

    seek(time: number): void {
        const buffer = this.source?.buffer ?? null;
        const wasPlaying = this.isPlaying;
        this.stop();
        if (buffer) {
            this.createSourceFromBuffer(buffer, time);
            this.pauseTime = time;
            if (wasPlaying) {
                // Re-start immediately — context is already running so no await needed
                this.source!.start(0, time);
                this.startTime = this.context.currentTime - time;
                this.pauseTime = time;
                this.isPlaying = true;
                this.source!.onended = () => { if (this.isPlaying) this.isPlaying = false; };
            }
        }
    }

    setVolume(v: number): void {
        this.gainNode.gain.setTargetAtTime(v, this.context.currentTime, 0.01);
    }

    setEQBand(index: number, gain: number): void {
        if (this.eqNodes[index]) {
            this.eqNodes[index].gain.setTargetAtTime(gain, this.context.currentTime, 0.1);
        }
    }

    private createSourceFromBuffer(buffer: AudioBuffer, _offset: number): void {
        this.source = this.context.createBufferSource();
        this.source.buffer = buffer;
        this.source.connect(this.EQInputNode);
    }

    getCurrentTime(): number {
        if (!this.isPlaying) return this.pauseTime;
        const t = this.context.currentTime - this.startTime;
        const dur = this.getDuration();
        return dur > 0 ? Math.min(t, dur) : t;
    }

    getDuration(): number {
        return this.source?.buffer?.duration ?? 0;
    }
}
