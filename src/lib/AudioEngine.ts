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

    private droneOscillators: OscillatorNode[] = [];
    private droneGain: GainNode | null = null;
    private lfo: OscillatorNode | null = null;

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

        this.startDrone();
        this.debugLog('Audio: Ready (Drone + Sparkle)');
    }

    private startDrone() {
        if (!this.context) return;
        // Prevent duplicate drones
        if (this.droneOscillators.length > 0) return;

        // Create Master Gain for Drone
        this.droneGain = this.context.createGain();
        this.droneGain.gain.setValueAtTime(0, this.context.currentTime);
        this.droneGain.connect(this.context.destination);

        // Gagaku-ish Chord (Sho instrument feel)
        // A4 (440), E5 (659.25), A5 (880), B5 (987.77), C#6 (1108.73)
        // Let's go for a mystic open 5th texture: A, E, A (lower octaves for vibe)
        const frequencies = [220, 330, 440, 660]; // A3, E4, A4, E5

        frequencies.forEach(freq => {
            if (!this.context) return;
            const osc = this.context.createOscillator();
            osc.type = 'sawtooth'; // Sawtooth filtered sounds like reed instruments (Sho)
            osc.frequency.setValueAtTime(freq, this.context.currentTime);

            // Detune slightly for natural feel
            const detune = (Math.random() - 0.5) * 10;
            osc.detune.setValueAtTime(detune, this.context.currentTime);

            // Filter to soften the sawtooth (Lowpass)
            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, this.context.currentTime);
            filter.Q.setValueAtTime(1, this.context.currentTime);

            // Individual gain for balance
            const oscGain = this.context.createGain();
            oscGain.gain.setValueAtTime(0.03, this.context.currentTime); // Low volume mix

            osc.connect(filter).connect(oscGain).connect(this.droneGain!);
            osc.start();
            this.droneOscillators.push(osc);
        });

        // Breathing effect (LFO on Filter or Volume)
        this.lfo = this.context.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.setValueAtTime(0.1, this.context.currentTime); // Very slow breath (10s)

        const lfoGain = this.context.createGain();
        lfoGain.gain.setValueAtTime(0.02, this.context.currentTime); // Modulate volume slightly

        this.lfo.connect(lfoGain).connect(this.droneGain.gain);
        this.lfo.start();

        // Fade In Drone
        this.droneGain.gain.linearRampToValueAtTime(0.2, this.context.currentTime + 5);
    }

    private stopDrone() {
        if (!this.context) return;

        // Fade out drone
        if (this.droneGain) {
            this.droneGain.gain.cancelScheduledValues(this.context.currentTime);
            this.droneGain.gain.linearRampToValueAtTime(0.0001, this.context.currentTime + 2);
            // Disconnect after fade
            setTimeout(() => {
                if (this.droneGain) {
                    this.droneGain.disconnect();
                    this.droneGain = null;
                }
            }, 2000);
        }

        // Stop oscillators
        this.droneOscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                this.debugLog(`Audio: Error stopping drone oscillator: ${e}`);
            }
        });
        this.droneOscillators = [];

        // Stop LFO
        if (this.lfo) {
            try {
                this.lfo.stop();
                this.lfo.disconnect();
                this.lfo = null;
            } catch (e) {
                this.debugLog(`Audio: Error stopping LFO: ${e}`);
            }
        }
        this.debugLog('Audio: Drone Stopped');
    }

    private playWaypoint() {
        if (!this.context) return;

        const now = this.context.currentTime;

        // Waypoint (Hyoshigi/Woodblock) - Short, dry, sharp
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain).connect(this.context.destination);

        osc.start(now);
        osc.stop(now + 0.1);

        // Double tap for clarity
        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(800, now + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(200, now + 0.2);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.setValueAtTime(0.3, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(gain2).connect(this.context.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.25);
    }

    private playSparkle() {
        if (!this.context) return;

        const now = this.context.currentTime;

        // Sparkle (Suzu/Bell) - Sharper, clearer, higher
        const osc1 = this.context.createOscillator();
        const gain1 = this.context.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(2000, now);
        osc1.frequency.exponentialRampToValueAtTime(3000, now + 0.1);
        gain1.gain.setValueAtTime(0.3, now); // Louder than drone
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5); // Long ring

        const osc2 = this.context.createOscillator();
        const gain2 = this.context.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(3000, now); // Harmonic
        osc2.frequency.linearRampToValueAtTime(3000, now + 1);
        gain2.gain.setValueAtTime(0.1, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gain1).connect(this.context.destination);
        osc2.connect(gain2).connect(this.context.destination);

        osc1.start(now);
        osc1.stop(now + 1.5);
        osc2.start(now + 0.05); // Slight delay
        osc2.stop(now + 2.0);
    }

    public stop() {
        if (!this.context) return;

        this.stopDrone();

        if (this.context.state !== 'closed') {
            this.context.close().then(() => {
                this.debugLog('Audio: Context Closed');
                this.context = null;
            }).catch(e => {
                this.debugLog(`Audio Error: Failed to close context: ${e}`);
            });
        }
    }

    public update(heading: number, targetBearing: number, waypointBearing: number | null) {
        if (!this.context) return;

        const now = Date.now();
        if (now - this.lastTriggerTime < 2000) return;

        // 1. Check Waypoint first (if any)
        if (waypointBearing !== null) {
            let diff = waypointBearing - heading;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;

            if (Math.abs(diff) < 15) {
                this.playWaypoint();
                this.lastTriggerTime = now;
                return; // Prioritize waypoint guidance
            }
        }

        // 2. Check Final Destination
        let diff = targetBearing - heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        const absDiff = Math.abs(diff);

        // Trigger logic: If within 15 degrees
        if (absDiff < 15) {
            this.playSparkle();
            this.lastTriggerTime = now;
        }
    }
}
