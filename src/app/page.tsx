'use client';

import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';
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

  // Audio State
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Initialize Audio Engine singleton
    audioRef.current = AudioEngine.getInstance((msg) => addLog(msg));
  }, []);

  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 5));
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
          addLog('Sensor Permission granted');
          setPermissionGranted(true);
        } else {
          setError('Sensor Permission denied');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } else {
      addLog('Permission auto-granted (Android/Desktop)');
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
      },
      (err) => {
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
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

      setHeading(headingValue);

      // Update Audio Engine
      if (coords && audioRef.current && headingValue !== null) {
        const targetBearing = calculateBearing(
          coords.latitude,
          coords.longitude,
          TARGET_LAT,
          TARGET_LON
        );
        // Calculate roughly distance (very simple approx for volume check if needed later)
        // For now, just pass 1000m to ignore distance attenuation in logic or handle strictly directional
        audioRef.current.update(headingValue, targetBearing, 1000);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      navigator.geolocation.clearWatch(geoId);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionGranted, coords]);

  if (!isClient) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 font-mono text-center select-none overflow-hidden touch-none">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black -z-10" />

      <h1 className="text-xl font-bold tracking-[0.3em] text-emerald-500/80 mb-12 uppercase">
        Beppu / Namonaki
      </h1>

      {!permissionGranted ? (
        <div className="space-y-6">
          <p className="text-gray-400 text-sm max-w-[200px] mx-auto leading-relaxed">
            Connect your senses to the city.<br />
            <span className="text-xs text-gray-600 mt-2 block">Audio / Location / Orientation</span>
          </p>
          <button
            onClick={requestPermission}
            className="px-8 py-3 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 rounded-full hover:bg-emerald-900/50 hover:border-emerald-500 transition-all duration-500 tracking-widest text-xs uppercase"
          >
            Initiate Connection
          </button>
        </div>
      ) : (
        <div className="space-y-8 w-full max-w-xs relative z-10">
          {/* Compass Visual */}
          <div className="relative w-64 h-64 mx-auto mb-8 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 border border-gray-800 rounded-full opacity-50" />
            <div className="absolute inset-[10%] border border-gray-800/50 rounded-full opacity-30 border-dashed" />

            {/* Direction Indicator */}
            {heading !== null ? (
              <>
                <div
                  className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
                  style={{ transform: `rotate(${-heading}deg)` }}
                />
                <div
                  className="absolute w-[1px] h-full bg-gradient-to-b from-emerald-500 to-transparent opacity-50"
                  style={{ transform: `rotate(${-heading}deg)`, transformOrigin: 'center bottom', top: '50%', height: '50%' }}
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full absolute -top-1 -left-[3px] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>

                <div className="text-4xl font-thin text-white tracking-tighter">
                  {heading.toFixed(0)}<span className="text-sm text-gray-500 ml-1">DEG</span>
                </div>

                {/* Audio Status Indicator */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                  {audioStarted ? (
                    <div className="flex gap-1">
                      <span className="w-1 h-3 bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite]" />
                      <span className="w-1 h-2 bg-emerald-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
                      <span className="w-1 h-4 bg-emerald-500 animate-[pulse_0.8s_ease-in-out_infinite]" />
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-600">MUTE</span>
                  )}
                </div>
              </>
            ) : (
              <div className="animate-pulse text-gray-600 text-xs">CALIBRATING</div>
            )}

            {/* Static Markers */}
            <div className="absolute top-2 text-[10px] text-gray-600">N</div>
            <div className="absolute bottom-2 text-[10px] text-gray-600">S</div>
            <div className="absolute left-2 text-[10px] text-gray-600">W</div>
            <div className="absolute right-2 text-[10px] text-gray-600">E</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div className="border border-white/5 p-3 rounded bg-white/5 backdrop-blur-sm">
              <div className="uppercase tracking-widest text-[9px] text-gray-600 mb-1">LAT</div>
              {coords ? coords.latitude.toFixed(5) : '---'}
            </div>
            <div className="border border-white/5 p-3 rounded bg-white/5 backdrop-blur-sm">
              <div className="uppercase tracking-widest text-[9px] text-gray-600 mb-1">LON</div>
              {coords ? coords.longitude.toFixed(5) : '---'}
            </div>
          </div>

          {/* Debug info regarding target */}
          <div className="text-[10px] text-gray-600 font-mono mt-4">
            TARGET: BEPPU TOWER (TEST)
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-0 left-0 w-full p-4 bg-red-900/80 text-white text-xs text-center backdrop-blur-md">
          warning: {error}
        </div>
      )}

      {/* Logs for debug */}
      <div className="fixed bottom-0 left-0 w-full p-4 pointer-events-none fade-mask z-50">
        <div className="flex flex-col-reverse items-start space-y-reverse space-y-1">
          {log.map((l, i) => (
            <div key={i} className="text-[9px] text-emerald-900 font-mono bg-emerald-100/10 px-1 rounded shadow-sm backdrop-blur-sm">
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
