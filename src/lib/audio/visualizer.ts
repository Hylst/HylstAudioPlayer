// src/lib/audio/visualizer.ts
// Helper to read frequency data from AnalyserNode

export class Visualizer {
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;

    constructor(analyser: AnalyserNode) {
        this.analyser = analyser;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    /**
     * Get frequency data for visualization.
     * Returns array of 0-255 values.
     */
    getFrequencyData(): Uint8Array {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Get waveform data.
     */
    getTimeDomainData(): Uint8Array {
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }
}
