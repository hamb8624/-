'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioEngine } from '@/lib/AudioEngine';

// Mock Target: Example (Beppu Station or a Shrine)
// For testing anywhere: We will set the target to be "North" relative to the user initially, 
// or just a fixed coordinate. 
// Let's use a fixed coordinate for "Beppu Tower" as a test: 33.2820, 131.5064
const TARGET_LAT = 33.2820;
const TARGET_LON = 131.5064;

export default function Home() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Smoothing state
  const headingRef = useRef<number | null>(null);

  // Audio State
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<AudioEngine | null>(null);

  // Animation Frame for smooth UI updates
  const requestRef = useRef<number>(0);

  useEffect(() => {
    setIsClient(true);
    // Initialize Audio Engine singleton
    audioRef.current = AudioEngine.getInstance((msg) => addLog(msg));

    // Start Animation Loop for smoothing
    const animate = () => {
      if (headingRef.current !== null) {
        setHeading(prev => {
          if (prev === null) return headingRef.current;

          // Smooth interpolation (Lerp)
          // We need to handle the wrap-around (0 <-> 360)
          let diff = headingRef.current! - prev;

          // Shortest path logic
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;

          // Lerp factor: 0.1 (very smooth) to 0.5 (responsive)
          // If diff is huge (first load), jump directly.
          if (Math.abs(diff) > 100) return headingRef.current; // Jump

          let next = prev + diff * 0.15; // Smooth factor

          // Normalize result 0-360
          return (next + 360) % 360;
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const addLog = (msg: string) => {
    // Suppress logs to avoid clutter during smooth mode
    // setLog(prev => [msg, ...prev].slice(0, 5));
  };

  const calculateBearing = (startLat: number, startLon: number, destLat: number, destLon: number) => {
    const startLatRad = startLat * (Math.PI / 180);
    const startLonRad = startLon * (Math.PI / 180);
    const destLatRad = destLat * (Math.PI / 180);
    const destLonRad = destLon * (Math.PI / 180);

    const y = Math.sin(destLonRad - startLonRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
      Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLonRad - startLonRad);
    let brng = Math.atan2(y, x);
    brng = brng * (180 / Math.PI);
    return (brng + 360) % 360;
  };

  const requestPermission = async () => {
    // 1. Audio Context needs user gesture
    if (audioRef.current && !audioStarted) {
      audioRef.current.init();
      audioRef.current.start();
      setAudioStarted(true);
    }

    // 2. Sensors
    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          // addLog('Sensor Permission granted');
          setPermissionGranted(true);
        } else {
          setError('Sensor Permission denied');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } else {
      // addLog('Permission auto-granted (Android/Desktop)');
      setPermissionGranted(true);
    }
  };

  useEffect(() => {
    if (!permissionGranted) return;

    // GPS
    const geoId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setError(''); // Clear error on success
      },
      (err) => {
        // Detailed error for debugging
        let msg = `GPS Error (${err.code}): ${err.message}`;
        if (err.code === 1) msg = "Location Access Denied. Please allow in settings.";
        if (err.code === 3) msg = "GPS Timeout. Moving to open area may help.";
        setError(msg);
      },
      {
        enableHighAccuracy: false, // Priority: Get ANY location over precise location
        maximumAge: 0,
        timeout: 20000 // 20 seconds timeout
      }
    );

    // Compass
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let headingValue = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((event as any).webkitCompassHeading) {
        // iOS
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headingValue = (event as any).webkitCompassHeading;
      } else if (event.alpha !== null) {
        headingValue = 360 - event.alpha;
      }

      // Store raw value for smoothing loop
      headingRef.current = headingValue;

      // Update Audio Engine (using the RAW value is fine, but audio also benefits from smooth updates relative to head.
      // Actually, for audio physics, updating on every frame (in the loop) is better.
      // But for MVP, let's keep audio update here or move to animate loop?
      // Let's move Audio Update to the animation loop if coords exist.
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      navigator.geolocation.clearWatch(geoId);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionGranted]);

  // Sync Audio in Loop (Pseudo-effect: we use a separate effect that depends on `heading` state which is now smooth)
  useEffect(() => {
    if (coords && audioRef.current && heading !== null) {
      const targetBearing = calculateBearing(
        coords.latitude,
        coords.longitude,
        TARGET_LAT,
        TARGET_LON
      );
      audioRef.current.update(heading, targetBearing, 1000);
    }
  }, [heading, coords]);

  if (!isClient) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-[#e0e0e0] overflow-hidden select-none touch-none">

      {/* Background Texture (Subtle Noise) */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Title - Vertical Text */}
      <div className="absolute top-8 right-8 writing-vertical-rl text-xs tracking-[0.5em] text-gray-500 font-serif opacity-80">
        別府・名もなき社
      </div>

      {!permissionGranted ? (
        <div className="z-10 flex flex-col items-center space-y-12 animate-fade-in-up">
          <div className="space-y-4 text-center">
            <p className="text-sm font-serif tracking-[0.2em] leading-loose text-gray-300">
              街の気配に耳を澄ます<br />
              地図なき参拝へ
            </p>
          </div>

          <button
            onClick={requestPermission}
            className="group relative px-8 py-4 overflow-hidden border border-white/10 rounded-sm transition-all duration-700 hover:border-white/30"
          >
            <span className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl" />
            <span className="relative text-xs tracking-[0.4em] font-serif group-hover:text-white transition-colors">
              接続ノ儀
            </span>
          </button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center">

          {/* Main Compass Area */}
          <div className="relative w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] flex items-center justify-center">

            {/* Outer Subtle Ring */}
            <div className="absolute inset-0 border border-white/5 rounded-full scale-90 opacity-30" />
            <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.85] opacity-10" />

            {/* Rotating Layer (The World rotates around the user) */}
            {heading !== null ? (
              <div
                className="absolute inset-0 transition-transform duration-700 ease-out will-change-transform"
                style={{ transform: `rotate(${-heading}deg)` }}
              >
                {/* North Marker */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2">
                  <div className="w-[1px] h-4 bg-gradient-to-b from-white/50 to-transparent" />
                  <span className="text-[10px] font-serif text-white/40">北</span>
                </div>

                {/* East */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-[8px] opacity-20">東</span>
                </div>
                {/* West */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <span className="text-[8px] opacity-20">西</span>
                </div>
                {/* South */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <span className="text-[8px] opacity-20">南</span>
                </div>

                {/* Target Ghost/Spirit (Only appears if close or generally for direction) */}
                {/* We can place an indicator at the target's relative angle? 
                        The current structure rotates the whole 'compass' so North is always North relative to screen if screen was map.
                        Actually, typical compass UI: 
                        - 'N' mark rotates according to -heading. 
                        - If Target is at North East, and I face North East, Target should be at TOP.
                        
                        Wait, let's keep it simple abstract.
                        Center line is "User's Forward".
                        If we rotate the compass by -heading, then 'N' is where North is.
                    */}

              </div>
            ) : null}

            {/* Center User/Spirit */}
            <div className="relative z-20">
              <div className={`w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-opacity duration-1000 ${audioStarted ? 'opacity-80 animate-pulse' : 'opacity-20'}`} />
              {audioStarted && (
                <div className="absolute inset-0 w-3 h-3 border border-white rounded-full animate-ping opacity-20 duration-[3000ms]" />
              )}
            </div>

            {/* Forward Indicator (User is always facing UP on screen) */}
            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1px] h-12 bg-gradient-to-t from-white/20 to-transparent" />

          </div>

          {/* Status Text */}
          <div className="absolute bottom-16 text-center space-y-2 animate-fade-in">
            <div className="text-[10px] tracking-[0.2em] text-gray-600 font-serif">
              {audioStarted ? "気配ヲ追エ" : "静寂"}
            </div>
            {/* Debug/Test Target Info */}
            <div className="text-[9px] text-gray-800 tracking-widest uppercase opacity-0 transition-opacity hover:opacity-100">
              Target: Beppu Tower
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-4 right-4 text-center">
          <span className="text-[10px] text-red-900/50 bg-red-900/10 px-2 py-1 rounded">
            {error}
          </span>
        </div>
      )}

      <style jsx global>{`
        .writing-vertical-rl {
          writing-mode: vertical-rl;
          text-orientation: upright;
        }
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
