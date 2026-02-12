'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioEngine } from '@/lib/AudioEngine';
import { calculateBearing, calculateDistance } from '@/lib/utils';

// Mock Target: Beppu Tower
const TARGET_LAT = 33.2820;
const TARGET_LON = 131.5064;

export default function Home() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Refs for logic
  const headingRef = useRef<number | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const requestRef = useRef<number>(0);
  const lastFetchTimeRef = useRef<number>(0);
  const minDistRef = useRef<number>(Infinity);

  // Navigation State
  const [waypoints, setWaypoints] = useState<{ lat: number; lon: number }[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);

  useEffect(() => {
    setIsClient(true);
    audioRef.current = AudioEngine.getInstance((msg) => addLog(msg));

    // Smooth heading interpolation loop
    const animate = () => {
      if (headingRef.current !== null) {
        setHeading(prev => {
          if (prev === null) return headingRef.current;
          let diff = headingRef.current! - prev;
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;
          if (Math.abs(diff) > 100) return headingRef.current;
          return (prev + diff * 0.15 + 360) % 360;
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 5));
  };

  const fetchRoute = async (startLat: number, startLon: number, isReroute = false) => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 15000) return;
    lastFetchTimeRef.current = now;

    try {
      addLog(isReroute ? 'rerouting...' : 'fetching route...');
      const url = `https://router.project-osrm.org/route/v1/walking/${startLon},${startLat};${TARGET_LON},${TARGET_LAT}?steps=true&overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.[0]) {
        const steps = data.routes[0].legs[0].steps;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newWaypoints = steps.map((step: any) => ({
          lat: step.maneuver.location[1],
          lon: step.maneuver.location[0]
        }));
        setWaypoints(newWaypoints);
        setCurrentWaypointIndex(0);
        minDistRef.current = Infinity;
        addLog(isReroute ? 'Route Updated' : `Route Started (${newWaypoints.length})`);
      }
    } catch (e) {
      addLog(`Route Error: ${e}`);
    }
  };

  const requestPermission = async () => {
    if (audioRef.current) audioRef.current.start();

    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') setPermissionGranted(true);
        else setError('Permission denied');
      } catch (e) {
        setError(String(e));
      }
    } else {
      setPermissionGranted(true);
    }
  };

  useEffect(() => {
    if (!permissionGranted) return;

    const geoId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords(prev => {
          if (prev === null) fetchRoute(lat, lon);
          return { latitude: lat, longitude: lon };
        });

        if (waypoints.length > 0 && currentWaypointIndex < waypoints.length) {
          const wp = waypoints[currentWaypointIndex];
          const dist = calculateDistance(lat, lon, wp.lat, wp.lon);

          if (dist < 10) {
            setCurrentWaypointIndex(prev => prev + 1);
            minDistRef.current = Infinity;
            addLog(currentWaypointIndex < waypoints.length - 1 ? 'Next target...' : 'Final destination');
          } else {
            if (dist < minDistRef.current) minDistRef.current = dist;
            if (dist > minDistRef.current + 25) {
              fetchRoute(lat, lon, true);
              minDistRef.current = dist;
            }
          }
        }
        setError('');
      },
      (err) => setError(`GPS Error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 20000 }
    );

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (e as any).webkitCompassHeading ?? (e.alpha !== null ? 360 - e.alpha : null);
      if (val !== null) headingRef.current = val;
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      navigator.geolocation.clearWatch(geoId);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionGranted, waypoints, currentWaypointIndex]);

  useEffect(() => {
    if (coords && audioRef.current && heading !== null) {
      const finalDestBearing = calculateBearing(coords.latitude, coords.longitude, TARGET_LAT, TARGET_LON);
      let waypointBearing: number | null = null;
      if (waypoints.length > 0 && currentWaypointIndex < waypoints.length) {
        const wp = waypoints[currentWaypointIndex];
        waypointBearing = calculateBearing(coords.latitude, coords.longitude, wp.lat, wp.lon);
      }
      audioRef.current.update(heading, finalDestBearing, waypointBearing);
    }
  }, [heading, coords, waypoints, currentWaypointIndex]);

  if (!isClient) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-[#e0e0e0] overflow-hidden select-none touch-none">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      <div className="absolute top-8 right-8 writing-vertical-rl text-xs tracking-[0.5em] text-gray-500 font-serif opacity-80">
        別府・名もなき社
      </div>

      {!permissionGranted ? (
        <div className="z-10 flex flex-col items-center space-y-12 animate-fade-in-up">
          <p className="text-sm font-serif tracking-[0.2em] leading-loose text-gray-300 text-center">
            街の気配に耳を澄ます<br />地図なき参拝へ
          </p>
          <button onClick={requestPermission} className="group relative px-8 py-4 border border-white/10 rounded-sm transition-all duration-700 hover:border-white/30">
            <span className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <span className="relative text-xs tracking-[0.4em] font-serif group-hover:text-white">接続ノ儀</span>
          </button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <div className="relative w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] flex items-center justify-center">
            <div className="absolute inset-0 border border-white/5 rounded-full scale-90 opacity-30" />
            <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.85] opacity-10" />
            {heading !== null && (
              <div className="absolute inset-0 transition-transform duration-700 ease-out" style={{ transform: `rotate(${-heading}deg)` }}>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2">
                  <div className="w-[1px] h-4 bg-gradient-to-b from-white/50 to-transparent" />
                  <span className="text-[10px] font-serif text-white/40">北</span>
                </div>
                {['東', '西', '南'].map((d, i) => (
                  <div key={d} className={`absolute ${i === 0 ? 'right-4 top-1/2 -translate-y-1/2' : i === 1 ? 'left-4 top-1/2 -translate-y-1/2' : 'bottom-4 left-1/2 -translate-x-1/2'}`}>
                    <span className="text-[8px] opacity-20">{d}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="relative z-20">
              <div className={`w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-opacity duration-1000 ${permissionGranted ? 'opacity-80 animate-pulse' : 'opacity-20'}`} />
            </div>
            <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1px] h-12 bg-gradient-to-t from-white/20 to-transparent" />
          </div>
          <div className="absolute bottom-16 text-center space-y-2">
            <div className="text-[10px] tracking-[0.2em] text-gray-600 font-serif">気配ヲ追エ</div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-4 right-4 text-center">
          <span className="text-[10px] text-red-900/50 bg-red-900/10 px-2 py-1 rounded">{error}</span>
        </div>
      )}

      <style jsx global>{`
        .writing-vertical-rl { writing-mode: vertical-rl; text-orientation: upright; }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 1s ease-out forwards; }
      `}</style>
    </div>
  );
}
