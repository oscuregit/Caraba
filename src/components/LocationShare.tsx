import React, { useState, useEffect, useRef } from 'react';
import { Trip, LiveLocation, User } from '../types';
import { updateLiveLocation } from '../services/db';
import { Navigation, MapPin, Check, Compass, Play, Pause, RefreshCw } from 'lucide-react';
import L from 'leaflet';

interface LocationShareProps {
  trip: Trip;
  currentUser: User;
}

export default function LocationShare({ trip, currentUser }: LocationShareProps) {
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100 representing position along the route
  const [simulationActive, setSimulationActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stops = trip.stops || [];
  const hasStops = stops.length >= 2;

  // Find if user is driver or passenger in this trip
  const isDriver = trip.driverId === currentUser.uid;
  const isPassenger = trip.passengers?.includes(currentUser.uid);
  const isParticipant = isDriver || isPassenger;

  // Get current list of shared locations in the trip doc
  const liveLocations = trip.liveLocations || {};
  const activeShares = Object.values(liveLocations).filter(loc => loc.active);

  // Helper to interpolate coordinate along the list of stops
  const getInterpolatedCoordinate = (percentage: number) => {
    if (!hasStops) return { lat: 41.0082, lng: 28.9784 };
    
    const segmentCount = stops.length - 1;
    const exactSegment = (percentage / 100) * segmentCount;
    const segmentIndex = Math.min(Math.floor(exactSegment), segmentCount - 1);
    const segmentProgress = exactSegment - segmentIndex;

    const startStop = stops[segmentIndex];
    const endStop = stops[segmentIndex + 1];

    const lat = startStop.lat + (endStop.lat - startStop.lat) * segmentProgress;
    const lng = startStop.lng + (endStop.lng - startStop.lng) * segmentProgress;

    return { lat, lng };
  };

  // Sync state to Firestore when sharing is active or progress changes
  useEffect(() => {
    if (sharing && isParticipant) {
      const coord = getInterpolatedCoordinate(progress);
      updateLiveLocation(trip.id, currentUser.uid, {
        userName: currentUser.name,
        lat: coord.lat,
        lng: coord.lng,
        role: isDriver ? 'driver' : 'passenger',
        active: true
      });
    } else if (!sharing && isParticipant && liveLocations[currentUser.uid]?.active) {
      // Set active to false when turning off
      const coord = getInterpolatedCoordinate(progress);
      updateLiveLocation(trip.id, currentUser.uid, {
        userName: currentUser.name,
        lat: coord.lat,
        lng: coord.lng,
        role: isDriver ? 'driver' : 'passenger',
        active: false
      });
    }
  }, [sharing, progress, trip.id]);

  // Clean up location sharing on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle simulation interval
  useEffect(() => {
    if (simulationActive && sharing) {
      timerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setSimulationActive(false);
            return 100;
          }
          return prev + 5;
        });
      }, 2000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simulationActive, sharing]);

  const toggleSharing = () => {
    if (!isParticipant) return;
    const nextSharing = !sharing;
    setSharing(nextSharing);
    if (!nextSharing) {
      setSimulationActive(false);
    }
  };

  const toggleSimulation = () => {
    if (!sharing) {
      setSharing(true);
    }
    setSimulationActive(!simulationActive);
  };

  const resetSimulation = () => {
    setProgress(0);
  };

  // OpenStreetMap leaflet map logic
  const mapContainerId = `map-${trip.id}`;
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);

  // Custom marker styles using divIcon (completely styled via Tailwind classes)
  const createStopIcon = (type: 'start' | 'end' | 'stop', index: number, address: string) => {
    const colorClass = type === 'start' ? 'bg-emerald-500' : type === 'end' ? 'bg-indigo-600' : 'bg-amber-500';
    const label = type === 'start' ? 'B' : type === 'end' ? 'S' : `${index}`;
    return L.divIcon({
      html: `<div class="flex items-center justify-center w-5 h-5 rounded-full border border-white shadow-md ${colorClass} text-white text-[9px] font-black" title="${address}">${label}</div>`,
      className: 'custom-div-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  const createLiveLocationIcon = (role: 'driver' | 'passenger', name: string) => {
    const colorClass = role === 'driver' ? 'bg-blue-600' : 'bg-purple-600';
    const pulseClass = role === 'driver' ? 'bg-blue-400' : 'bg-purple-400';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center animate-fadeIn">
          <span class="absolute inline-flex h-7 w-7 rounded-full ${pulseClass} opacity-40 animate-ping"></span>
          <div class="relative flex items-center justify-center w-6 h-6 rounded-full border border-white shadow-md ${colorClass} text-white text-[8px] font-black">
            ${initials}
          </div>
        </div>
      `,
      className: 'custom-live-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  // Initialize Map
  useEffect(() => {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    // Center map on the first stop or default to Istanbul coordinates
    const centerLat = hasStops ? stops[0].lat : 41.0082;
    const centerLng = hasStops ? stops[0].lng : 28.9784;

    if (!mapRef.current) {
      const map = L.map(mapContainerId, {
        center: [centerLat, centerLng],
        zoom: 12,
        zoomControl: true,
        attributionControl: false
      });

      // Add clean OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
    }

    // Trigger map invalidation to handle proper size when mounting
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        polylineRef.current = null;
        stopsLayerRef.current = null;
        liveLayerRef.current = null;
      }
    };
  }, [trip.id]);

  // Sync Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasStops) return;

    const latLngs = stops.map(s => [s.lat, s.lng] as [number, number]);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else {
      polylineRef.current = L.polyline(latLngs, {
        color: '#4f46e5',
        weight: 3.5,
        opacity: 0.85
      }).addTo(map);
    }

    // Auto fit bounds to show entire route comfortably
    try {
      map.fitBounds(polylineRef.current.getBounds(), { padding: [25, 25] });
    } catch (e) {
      console.error("fitBounds error", e);
    }
  }, [stops, hasStops]);

  // Sync Stops Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!stopsLayerRef.current) {
      stopsLayerRef.current = L.layerGroup().addTo(map);
    }

    stopsLayerRef.current.clearLayers();

    stops.forEach((stop, idx) => {
      const icon = createStopIcon(stop.type, idx, stop.address);
      const marker = L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(`<b class="text-xs text-slate-800">${stop.address}</b>`);
      stopsLayerRef.current?.addLayer(marker);
    });
  }, [stops]);

  // Sync Live Location Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!liveLayerRef.current) {
      liveLayerRef.current = L.layerGroup().addTo(map);
    }

    liveLayerRef.current.clearLayers();

    Object.entries(liveLocations).forEach(([uid, loc]) => {
      if (!loc.active) return;
      const icon = createLiveLocationIcon(loc.role, loc.userName);
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .bindPopup(`<b class="text-xs text-slate-800">${loc.userName} (${loc.role === 'driver' ? 'Sürücü' : 'Yolcu'})</b>`);
      liveLayerRef.current?.addLayer(marker);
    });
  }, [liveLocations]);

  // Handle map resizing periodically or when sharing states change to keep it accurate
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [sharing]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4" id="location-share-widget">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800">Canlı Yolculuk Haritası</h4>
            <span className="text-[10px] text-gray-400">Gerçek zamanlı OpenStreetMap senkronizasyonu</span>
          </div>
        </div>

        {isParticipant ? (
          <button
            onClick={toggleSharing}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              sharing 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
            }`}
            id="share-live-location-toggle"
          >
            <Navigation className={`w-3 h-3 ${sharing ? 'animate-pulse' : ''}`} />
            {sharing ? 'Paylaşımı Durdur' : 'Canlı Konumumu Paylaş'}
          </button>
        ) : (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-semibold">
            İzleyici Modu
          </span>
        )}
      </div>

      {/* Interactive OpenStreetMap Container */}
      <div className="relative bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-[200px] shadow-inner" id="map-parent">
        <div id={mapContainerId} className="w-full h-full z-10" />
        
        {/* active count badge */}
        <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[9px] font-semibold flex items-center gap-1 z-20">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></span>
          <span>{activeShares.length} Aktif Paylaşım</span>
        </div>

        {/* route progress controller if sharing */}
        {sharing && (
          <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md border border-gray-100 p-2 rounded-xl flex items-center justify-between gap-3 shadow-md animate-slideUp z-20">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSimulation}
                className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-all cursor-pointer"
                title={simulationActive ? 'Duraklat' : 'Simülasyonu Başlat'}
              >
                {simulationActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={resetSimulation}
                className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all cursor-pointer"
                title="Sıfırla"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[9px] text-gray-400 font-bold">YOLDA:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 accent-indigo-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[9px] text-indigo-600 font-bold min-w-8 text-right">%{progress}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sharing Details List */}
      <div className="space-y-1.5">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Aktif Sürücü & Yolcu Konumları</h5>
        {activeShares.length === 0 ? (
          <div className="text-center py-3 text-[10px] text-gray-400 italic">
            Şu an haritada paylaşılan canlı konum bulunmuyor. {isParticipant && 'Yukarıdaki tuşla konum paylaşabilirsiniz!'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activeShares.map((loc) => (
              <div 
                key={loc.userId} 
                className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] ${
                  loc.role === 'driver' 
                    ? 'bg-blue-50/50 border-blue-100 text-blue-900' 
                    : 'bg-purple-50/50 border-purple-100 text-purple-900'
                }`}
                id={`active-share-${loc.userId}`}
              >
                <div className={`w-2 h-2 rounded-full ${loc.role === 'driver' ? 'bg-blue-600' : 'bg-purple-600'} animate-pulse`}></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{loc.userName}</p>
                  <span className="text-[9px] text-gray-400 block capitalize">
                    {loc.role === 'driver' ? 'Şoför / Taşıyıcı' : 'Yolcu'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
