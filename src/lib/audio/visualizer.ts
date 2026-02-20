// src/lib/audio/visualizer.ts
// Helper to read frequency and time-domain data from AnalyserNode

export class Visualizer {
    private analyser: AnalyserNode;
    private dataArray: Uint8Array<ArrayBuffer>;
    private timeArray: Uint8Array<ArrayBuffer>;

    constructor(analyser: AnalyserNode) {
        this.analyser = analyser;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        this.timeArray = new Uint8Array(this.analyser.fftSize) as Uint8Array<ArrayBuffer>;
    }

    /**
     * Get frequency data for FFT visualization (0-255 per bin).
     */
    getFrequencyData(): Uint8Array<ArrayBuffer> {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Get waveform (time-domain) data for oscilloscope (0-255).
     */
    getTimeDomainData(): Uint8Array<ArrayBuffer> {
        this.analyser.getByteTimeDomainData(this.timeArray);
        return this.timeArray;
    }

    /**
     * Compute an RMS audio level (0-1) from current time-domain data.
     * Useful for VU meter and reactive glow effects.
     */
    getLevel(): number {
        this.analyser.getByteTimeDomainData(this.timeArray);
        let sum = 0;
        for (let i = 0; i < this.timeArray.length; i++) {
            const normalized = (this.timeArray[i] - 128) / 128; // -1 to 1
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / this.timeArray.length);
    }

    /**
     * Get the AnalyserNode's fftSize for canvas sizing.
     */
    get frequencyBinCount(): number {
        return this.analyser.frequencyBinCount;
    }
}
