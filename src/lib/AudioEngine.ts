export class AudioEngine {
    private static instance: AudioEngine;
    private sound: Howl | null = null;
    private isPlaying: boolean = false;
    private debugLog: (msg: string) => void;

    private constructor(logFunc: (msg: string) => void) {
        this.debugLog = logFunc;
        // In a real scenario, this would be a specific sound file (e.g. ambient drone or bell)
        // For MVP, we'll try to generate a beep or load a placeholder if available.
        // But Howler needs a file. We will use a base64 Data URI for a simple sine wave 
        // to avoid asset dependency issues for this immediate step.
    }

    public static getInstance(logFunc: (msg: string) => void): AudioEngine {
        if (!AudioEngine.instance) {
            AudioEngine.instance = new AudioEngine(logFunc);
        }
        return AudioEngine.instance;
    }

    public init() {
        // A simple soft sine wave drone (base64 encoded MP3 or WAV would be ideal, but for synthesized sound we might need WebAudio API directly)
        // Let's use Howler with a reliable test sound URL or base64. 
        // Using a simple "white noise" or "drone" placeholder. 
        // For now, let's use a public domain sound effect URL for testing "wind/atmosphere"

        // URL: Small wind loop (example)
        const TEST_AUDIO_URL = 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg';

        this.sound = new Howl({
            src: [TEST_AUDIO_URL],
            loop: true,
            volume: 0, // Start silent
            html5: true, // Force HTML5 Audio to allow streaming large files if needed
            onload: () => this.debugLog('Audio: Loaded'),
            onloaderror: (_id, err) => this.debugLog(`Audio Error: ${err}`)
        });
    }

    public start() {
        if (this.sound && !this.isPlaying) {
            this.sound.play();
            this.isPlaying = true;
            this.debugLog('Audio: Started');
        }
    }

    /**
     * Updates the audio based on the user's bearing relative to the target.
     * @param heading User's compass heading (0-360)
     * @param targetBearing Bearing to the target (0-360)
     * @param distance Distance to target in meters
     */
    public update(heading: number, targetBearing: number, distance: number) {
        if (!this.sound) return;

        // 1. Calculate angle difference (-180 to 180)
        let diff = targetBearing - heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        // 2. Spatial Audio Logic (Lite)
        // If facing towards target (diff near 0), volume goes UP.
        // If facing away, volume goes DOWN.
        // Focus width: +/- 30 degrees is "loudest"

        const absDiff = Math.abs(diff);
        let volume = 0;

        if (absDiff < 45) {
            // Facing roughly towards target: Max Volume
            volume = 1.0 - (absDiff / 45) * 0.3; // 1.0 to 0.7
        } else {
            // Facing away: Low Volume
            volume = 0.1;
        }

        // Distance attenuation (Optional for Step 1, but good for "getting closer")
        // If very far (> 1km), sound is faint. If close (< 100m), sound is clear.
        // mixing "Directional Volume" with "Distance Volume"
        // For MVP: Let's focus PURELY on Direction to guide the user.

        this.sound.fade(this.sound.volume(), volume, 100);

        // Stereo Panning (3D audio effect)
        // If target is to the LEFT (negative diff), pan -1.
        // If target is to the RIGHT (positive diff), pan 1.
        // Clamp between -1.0 and 1.0
        const pan = Math.max(-1.0, Math.min(1.0, diff / 90));
        this.sound.stereo(pan);
    }
}
