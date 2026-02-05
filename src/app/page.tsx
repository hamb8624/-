'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 5));
  };

  const requestPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          addLog('Permission granted');
          setPermissionGranted(true);
        } else {
          setError('Permission denied');
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
            // Android (approximate, magnetic north vs true north issues apply)
            // event.alpha is 0 when pointing user keeps device flat and top points North (roughly)
            // But typical implementation varies.
            // Simplified fallback:
            headingValue = 360 - event.alpha;
        }
        
        setHeading(headingValue);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      navigator.geolocation.clearWatch(geoId);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionGranted]);

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
                Connect your senses to the city. Allow location and orientation access.
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
        </div>
      )}

      {error && (
        <div className="fixed top-0 left-0 w-full p-4 bg-red-900/80 text-white text-xs text-center backdrop-blur-md">
            warning: {error}
        </div>
      )}

      {/* Logs for debug */}
      <div className="fixed bottom-0 left-0 w-full p-4 pointer-events-none fade-mask">
         <div className="flex flex-col-reverse items-start space-y-reverse space-y-1">
            {log.map((l, i) => (
                <div key={i} className="text-[9px] text-emerald-900 font-mono bg-emerald-100/10 px-1 rounded">
                    {l}
                </div>
            ))}
         </div>
      </div>
    </div>
  );
}
