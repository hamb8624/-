export class AudioEngine {
    private static instance: AudioEngine;
    private context: AudioContext | null = null;
    private lastTriggerTime: number = 0;
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
        this.debugLog('Audio: Ready (Sparkle Mode)');
    }

    private playSparkle() {
        if (!this.context) return;

        const now = this.context.currentTime;

        // Create 2 tones for "Ki-Ran" effect
        // Tone 1: High
        const osc1 = this.context.createOscillator();
        const gain1 = this.context.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, now);
        osc1.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        gain1.gain.setValueAtTime(0.1, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        // Tone 2: Higher (slightly delayed)
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1800, now + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(3000, now + 0.2);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0.08, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc1.connect(gain1).connect(this.context.destination);
        osc2.connect(gain2).connect(this.context.destination);

        osc1.start(now);
        osc1.stop(now + 0.5);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.6);
    }

    public update(heading: number, targetBearing: number, distance: number) {
        if (!this.context) return;

        let diff = targetBearing - heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        const absDiff = Math.abs(diff);

        // Trigger logic: If within 15 degrees
        if (absDiff < 15) {
            const now = Date.now();
            // Cooldown: 2 seconds
            if (now - this.lastTriggerTime > 2000) {
                this.playSparkle();
                this.lastTriggerTime = now;
                // Optional: visual feedback trigger could be sent back via callback if needed
            }
        }
    }
}
