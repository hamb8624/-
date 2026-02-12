export class AudioEngine {
    private static instance: AudioEngine;
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private lastTriggerTime: number = 0;
    private debugLog: (msg: string) => void;

    // Drone properties
    private droneOscillators: OscillatorNode[] = [];
    private droneGain: GainNode | null = null;
    private lfo: OscillatorNode | null = null;

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
        if (this.context) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.context = new AudioContextClass();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.debugLog('Audio: System Initialized');
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
        this.debugLog('Audio: Navigation Mode Started');
    }

    private startDrone() {
        if (!this.context || !this.masterGain || this.droneOscillators.length > 0) return;

        this.droneGain = this.context.createGain();
        this.droneGain.gain.setValueAtTime(0, this.context.currentTime);
        this.droneGain.connect(this.masterGain);

        // Gagaku-inspired frequency set (A-E-A-B-C#)
        [220, 330, 440, 660].forEach(freq => {
            if (!this.context) return;
            const osc = this.context.createOscillator();
            const filter = this.context.createBiquadFilter();
            const oscGain = this.context.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setTargetAtTime(freq, this.context.currentTime, 0.1);
            osc.detune.setValueAtTime((Math.random() - 0.5) * 10, this.context.currentTime);

            filter.type = 'lowpass';
            filter.frequency.setTargetAtTime(800, this.context.currentTime, 0.1);
            filter.Q.setValueAtTime(1, this.context.currentTime);

            oscGain.gain.setValueAtTime(0.03, this.context.currentTime);

            osc.connect(filter).connect(oscGain).connect(this.droneGain!);
            osc.start();
            this.droneOscillators.push(osc);
        });

        // Breathing modulation (LFO)
        this.lfo = this.context.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.setValueAtTime(0.1, this.context.currentTime);

        const lfoGain = this.context.createGain();
        lfoGain.gain.setValueAtTime(0.02, this.context.currentTime);

        this.lfo.connect(lfoGain).connect(this.droneGain.gain);
        this.lfo.start();

        this.droneGain.gain.linearRampToValueAtTime(0.2, this.context.currentTime + 5);
    }

    private stopDrone() {
        if (!this.context) return;

        if (this.droneGain) {
            this.droneGain.gain.cancelScheduledValues(this.context.currentTime);
            this.droneGain.gain.linearRampToValueAtTime(0, this.context.currentTime + 1);
        }

        setTimeout(() => {
            this.droneOscillators.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) { }
            });
            this.droneOscillators = [];
            if (this.lfo) {
                try { this.lfo.stop(); this.lfo.disconnect(); } catch (e) { }
                this.lfo = null;
            }
            if (this.droneGain) { this.droneGain.disconnect(); this.droneGain = null; }
        }, 1100);
    }

    private playWaypoint() {
        if (!this.context || !this.masterGain) return;
        const now = this.context.currentTime;

        // Woodblock (Hyoshigi) double tap
        [0, 0.15].forEach(delay => {
            if (!this.context) return;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now + delay);
            osc.frequency.exponentialRampToValueAtTime(200, now + delay + 0.05);

            gain.gain.setValueAtTime(delay === 0 ? 0.4 : 0.3, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

            osc.connect(gain).connect(this.masterGain!);
            osc.start(now + delay);
            osc.stop(now + delay + 0.1);
        });
    }

    private playSparkle() {
        if (!this.context || !this.masterGain) return;
        const now = this.context.currentTime;

        // Sacred Bell (Suzu) sound
        const oscs = [
            { type: 'sine', freq: 2000, target: 3000, vol: 0.3, dur: 1.5 },
            { type: 'triangle', freq: 3000, target: 3000, vol: 0.1, dur: 2.0 }
        ] as const;

        oscs.forEach(s => {
            if (!this.context) return;
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = s.type;
            osc.frequency.setValueAtTime(s.freq, now);
            osc.frequency.exponentialRampToValueAtTime(s.target, now + 0.1);
            gain.gain.setValueAtTime(s.vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + s.dur);
            osc.connect(gain).connect(this.masterGain!);
            osc.start(now);
            osc.stop(now + s.dur);
        });
    }

    public update(heading: number, targetBearing: number, waypointBearing: number | null) {
        if (!this.context) return;

        const now = Date.now();
        if (now - this.lastTriggerTime < 2000) return;

        const checkMatch = (bearing: number) => {
            let diff = bearing - heading;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            return Math.abs(diff) < 15;
        };

        if (waypointBearing !== null && checkMatch(waypointBearing)) {
            this.playWaypoint();
            this.lastTriggerTime = now;
        } else if (checkMatch(targetBearing)) {
            this.playSparkle();
            this.lastTriggerTime = now;
        }
    }

    public stop() {
        this.stopDrone();
        if (this.context) {
            this.context.close().then(() => {
                this.context = null;
                this.masterGain = null;
            }).catch(() => { });
        }
    }
}
