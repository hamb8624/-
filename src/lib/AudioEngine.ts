export class AudioEngine {
    private static instance: AudioEngine;
    private context: AudioContext | null = null;
    private oscillator: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;
    private pannerNode: StereoPannerNode | null = null;
    private isPlaying: boolean = false;
    private debugLog: (msg: string) => void;

    private constructor(logFunc: (msg: string) => void) {
        this.debugLog = logFunc;
    }

    public static getInstance(logFunc: (msg: string) => void): AudioEngine {
        if (!AudioEngine.instance) {
            AudioEngine.instance = new AudioEngine(logFunc);
        }
        return AudioEngine.instance;
    }

    public init() {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.context = new AudioContextClass();
            this.debugLog('Audio: Context Created');
        } catch (e) {
            this.debugLog(`Audio Error: ${e}`);
        }
    }

    public start() {
        if (!this.context) this.init();
        if (!this.context) return;

        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        if (this.isPlaying) return;

        try {
            // Create Oscillator (Drone sound)
            this.oscillator = this.context.createOscillator();
            this.oscillator.type = 'sine'; // deeply resonant sine wave
            this.oscillator.frequency.setValueAtTime(440, this.context.currentTime); // A4

            // Create Gain (Volume)
            this.gainNode = this.context.createGain();
            this.gainNode.gain.setValueAtTime(0, this.context.currentTime); // Start silent

            // Create Panner (Stereo)
            this.pannerNode = this.context.createStereoPanner();

            // Connect: Osc -> Gain -> Panner -> Destination
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.pannerNode);
            this.pannerNode.connect(this.context.destination);

            this.oscillator.start();
            this.isPlaying = true;
            this.debugLog('Audio: Started (Synth)');

            // Fade in slightly
            this.gainNode.gain.linearRampToValueAtTime(0.1, this.context.currentTime + 1);

        } catch (e) {
            this.debugLog(`Audio Start Error: ${e}`);
        }
    }

    public update(heading: number, targetBearing: number, distance: number) {
        if (!this.context || !this.gainNode || !this.pannerNode || !this.oscillator) return;

        let diff = targetBearing - heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        const absDiff = Math.abs(diff);

        // Volume Logic: Louder when facing target
        // Max Volume: 0.5, Min Volume: 0.05
        let targetVolume = 0.05;
        if (absDiff < 45) {
            targetVolume = 0.5 - (absDiff / 45) * 0.45;
        }

        // Smooth transition
        this.gainNode.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.1);

        // Pitch modulation based on accuracy (optional, adds "game" feel)
        // Higher pitch when closer/more accurate? 
        // Let's keep pitch steady for now, maybe slight vibrato if accurate.
        if (absDiff < 10) {
            this.oscillator.frequency.setTargetAtTime(880, this.context.currentTime, 0.2); // Octave up when locked on
        } else {
            this.oscillator.frequency.setTargetAtTime(440, this.context.currentTime, 0.5);
        }

        // Pan Logic
        const pan = Math.max(-1.0, Math.min(1.0, diff / 90));
        this.pannerNode.pan.setTargetAtTime(pan, this.context.currentTime, 0.1);
    }
}
