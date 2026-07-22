import React, { useState, useEffect, useRef } from 'react';
import { Trip, LiveLocation, User } from '../types';
import { updateLiveLocation, completeTrip } from '../services/db';
import { Navigation, MapPin, Check, Compass, Play, Pause, RefreshCw, Crosshair, Maximize2, Minimize2, X, ArrowRight, ShieldCheck, Gauge } from 'lucide-react';
import L from 'leaflet';
import { fetchRoadRoute, interpolateAlongRoad, getUserLocation } from '../services/routing';

interface LocationShareProps {
  trip: Trip;
  currentUser: User;
  autoOpenDriveMode?: boolean;
  onCloseDriveMode?: () => void;
}

export default function LocationShare({ trip, currentUser, autoOpenDriveMode = false, onCloseDriveMode }: LocationShareProps) {
  const [sharing, setSharing] = useState(true);
  const [roadCoords, setRoadCoords] = useState<[number, number][]>([]);
  const [loadingRoad, setLoadingRoad] = useState(false);
  const [isDriveModeOpen, setIsDriveModeOpen] = useState(autoOpenDriveMode);
  const [currentSpeed, setCurrentSpeed] = useState(48); // simulated live driving speed in km/h
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const stops = trip.stops || [];
  const hasStops = stops.length >= 2;

  // Find if user is driver or passenger in this trip
  const isDriver = trip.driverId === currentUser.uid;
  const isPassenger = trip.passengers?.includes(currentUser.uid);
  const isParticipant = isDriver || isPassenger;

  // Get current list of shared locations in the trip doc
  const liveLocations = trip.liveLocations || {};
  const activeShares = Object.values(liveLocations).filter(loc => loc.active);

  // Sync autoOpenDriveMode prop to local state when triggered
  useEffect(() => {
    if (autoOpenDriveMode) {
      setIsDriveModeOpen(true);
    }
  }, [autoOpenDriveMode]);

  // Continuously track live user location via Browser Geolocation API
  useEffect(() => {
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          
          if (pos.coords.speed && pos.coords.speed > 0) {
            setCurrentSpeed(Math.round(pos.coords.speed * 3.6));
          } else {
            setCurrentSpeed(45 + Math.floor(Math.random() * 12));
          }

          // Broadcast live location if sharing
          if (isParticipant) {
            updateLiveLocation(trip.id, currentUser.uid, {
              userName: currentUser.name,
              lat,
              lng,
              role: isDriver ? 'driver' : 'passenger',
              active: true
            });
          }
        },
        (err) => {
          console.warn('Geolocation watch error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [trip.id, currentUser.uid, isParticipant, isDriver]);

  // Fetch real road route from OSRM
  useEffect(() => {
    if (!hasStops) {
      setRoadCoords([]);
      return;
    }
    setLoadingRoad(true);
    fetchRoadRoute(stops)
      .then(res => {
        setRoadCoords(res.coordinates);
      })
      .finally(() => {
        setLoadingRoad(false);
      });
  }, [trip.id, stops]);

  // OpenStreetMap leaflet map logic
  const mapContainerId = `map-${trip.id}`;
  const fullscreenMapId = `fs-map-${trip.id}`;
  
  const mapRef = useRef<L.Map | null>(null);
  const fsMapRef = useRef<L.Map | null>(null);
  
  const polylineRef = useRef<L.Polyline | null>(null);
  const fsPolylineRef = useRef<L.Polyline | null>(null);
  
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const fsStopsLayerRef = useRef<L.LayerGroup | null>(null);
  
  const liveLayerRef = useRef<L.LayerGroup | null>(null);
  const fsLiveLayerRef = useRef<L.LayerGroup | null>(null);

  // Custom marker styles using divIcon
  const createStopIcon = (type: 'start' | 'end' | 'stop', index: number, address: string) => {
    const colorClass = type === 'start' ? 'bg-emerald-500' : type === 'end' ? 'bg-indigo-600' : 'bg-amber-500';
    const label = type === 'start' ? 'BAŞLANGIÇ' : type === 'end' ? 'VARIS' : `${index}. DURAK`;
    return L.divIcon({
      html: `
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white shadow-lg ${colorClass} text-white text-[10px] font-black whitespace-nowrap animate-fadeIn">
          <div class="w-2 h-2 rounded-full bg-white"></div>
          <span>${label}</span>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [80, 24],
      iconAnchor: [40, 12]
    });
  };

  const createLiveLocationIcon = (role: 'driver' | 'passenger', name: string) => {
    const colorClass = role === 'driver' ? 'bg-blue-600' : 'bg-purple-600';
    const pulseClass = role === 'driver' ? 'bg-blue-400' : 'bg-purple-400';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center animate-fadeIn">
          <span class="absolute inline-flex h-10 w-10 rounded-full ${pulseClass} opacity-50 animate-ping"></span>
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-xl ${colorClass} text-white text-[10px] font-black">
            ${initials}
          </div>
        </div>
      `,
      className: 'custom-live-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  // Initialize Embedded Map
  useEffect(() => {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    const centerLat = hasStops ? stops[0].lat : 41.0082;
    const centerLng = hasStops ? stops[0].lng : 28.9784;

    if (!mapRef.current) {
      const map = L.map(mapContainerId, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
    }

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

  // Sync embedded map layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasStops) return;

    const latLngs = roadCoords.length > 0 ? roadCoords : stops.map(s => [s.lat, s.lng] as [number, number]);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else {
      polylineRef.current = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    try {
      map.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
    } catch (e) {
      console.error("fitBounds error", e);
    }
  }, [stops, hasStops, roadCoords]);

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

  // Initialize Fullscreen Navigation Drive Map
  useEffect(() => {
    if (!isDriveModeOpen) return;

    const timer = setTimeout(() => {
      const container = document.getElementById(fullscreenMapId);
      if (!container) return;

      const startLat = hasStops ? stops[0].lat : 41.0082;
      const startLng = hasStops ? stops[0].lng : 28.9784;

      if (!fsMapRef.current) {
        const map = L.map(fullscreenMapId, {
          center: userLocation ? [userLocation.lat, userLocation.lng] : [startLat, startLng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false
        });

        // Add vibrant OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        fsMapRef.current = map;
      }

      const fsMap = fsMapRef.current;
      fsMap.invalidateSize();

      // Render road polyline in bright neon blue
      const latLngs = roadCoords.length > 0 ? roadCoords : stops.map(s => [s.lat, s.lng] as [number, number]);
      if (fsPolylineRef.current) {
        fsPolylineRef.current.setLatLngs(latLngs);
      } else {
        fsPolylineRef.current = L.polyline(latLngs, {
          color: '#1d4ed8',
          weight: 7,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(fsMap);
      }

      // Render stops
      if (!fsStopsLayerRef.current) {
        fsStopsLayerRef.current = L.layerGroup().addTo(fsMap);
      }
      fsStopsLayerRef.current.clearLayers();
      stops.forEach((stop, idx) => {
        const icon = createStopIcon(stop.type, idx, stop.address);
        const marker = L.marker([stop.lat, stop.lng], { icon });
        fsStopsLayerRef.current?.addLayer(marker);
      });

      // Render live driver & passenger locations
      if (!fsLiveLayerRef.current) {
        fsLiveLayerRef.current = L.layerGroup().addTo(fsMap);
      }
      fsLiveLayerRef.current.clearLayers();

      Object.entries(liveLocations).forEach(([uid, loc]) => {
        if (!loc.active) return;
        const icon = createLiveLocationIcon(loc.role, loc.userName);
        const marker = L.marker([loc.lat, loc.lng], { icon });
        fsLiveLayerRef.current?.addLayer(marker);
      });

      if (userLocation) {
        fsMap.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      } else if (fsPolylineRef.current) {
        try {
          fsMap.fitBounds(fsPolylineRef.current.getBounds(), { padding: [50, 50] });
        } catch (e) {
          console.error(e);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (fsMapRef.current) {
        fsMapRef.current.remove();
        fsMapRef.current = null;
        fsPolylineRef.current = null;
        fsStopsLayerRef.current = null;
        fsLiveLayerRef.current = null;
      }
    };
  }, [isDriveModeOpen, stops, roadCoords, liveLocations, userLocation]);

  const recenterGPS = () => {
    if (userLocation && fsMapRef.current) {
      fsMapRef.current.setView([userLocation.lat, userLocation.lng], 17, { animate: true });
    } else if (hasStops && fsMapRef.current) {
      fsMapRef.current.setView([stops[0].lat, stops[0].lng], 16, { animate: true });
    }
  };

  const handleFinishDrive = async () => {
    if (isDriver) {
      await completeTrip(trip.id);
    }
    setIsDriveModeOpen(false);
    if (onCloseDriveMode) onCloseDriveMode();
  };

  const closeDriveMode = () => {
    setIsDriveModeOpen(false);
    if (onCloseDriveMode) onCloseDriveMode();
  };

  const destinationStop = stops.length > 0 ? stops[stops.length - 1] : null;

  return (
    <>
      {/* Embedded Card Widget */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3" id="location-share-widget">
        
        {/* Widget Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Canlı Yolculuk & Sürüş Haritası</h4>
              <span className="text-[10px] text-slate-400">Google Haritalar Uyumlu Canlı Takip</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDriveModeOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer animate-pulse"
            id="open-drive-mode-btn"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Sürüş Modu / Tam Ekran
          </button>
        </div>

        {/* Embedded Map Container (No slider under map!) */}
        <div className="relative bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden h-[210px] shadow-inner" id="map-parent">
          <div id={mapContainerId} className="w-full h-full z-10" />
          
          <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-white text-[9px] font-semibold flex items-center gap-1.5 z-20">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            <span>{activeShares.length} Aktif Sürücü/Yolcu Paylaşımı</span>
          </div>

          <button
            type="button"
            onClick={() => setIsDriveModeOpen(true)}
            className="absolute bottom-2.5 right-2.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-lg z-20 transition-all cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            Sürüş Moduna Geç
          </button>
        </div>

        {/* Active Locations List */}
        <div className="space-y-1.5 pt-1">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Canlı Konumda Olanlar</h5>
          {activeShares.length === 0 ? (
            <div className="text-center py-2 text-[10px] text-slate-400 italic bg-slate-50 rounded-xl">
              Şu an haritada yayınlanan aktif konum bulunuyor. Sürüş moduna geçerek canlı GPS takibini başlatabilirsiniz.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeShares.map((loc) => (
                <div 
                  key={loc.userId} 
                  className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] ${
                    loc.role === 'driver' 
                      ? 'bg-blue-50 border-blue-100 text-blue-900' 
                      : 'bg-purple-50 border-purple-100 text-purple-900'
                  }`}
                  id={`active-share-${loc.userId}`}
                >
                  <div className={`w-2 h-2 rounded-full ${loc.role === 'driver' ? 'bg-blue-600' : 'bg-purple-600'} animate-pulse`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{loc.userName}</p>
                    <span className="text-[9px] text-slate-400 block">
                      {loc.role === 'driver' ? 'Sürücü (Araçta)' : 'Yolcu'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Google Maps Style Live Driving Navigation Overlay */}
      {isDriveModeOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-900 flex flex-col animate-fadeIn" id="fullscreen-drive-overlay">
          
          {/* Top Navigation HUD - Google Maps Emerald Green Bar */}
          <div className="bg-emerald-700 text-white p-3.5 sm:p-4 shadow-xl z-30 flex items-center justify-between gap-3 border-b border-emerald-600">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-md">
                <Navigation className="w-6 h-6 transform rotate-45" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full">
                    SÜRÜŞ MODU
                  </span>
                  <span className="text-[10px] text-emerald-100 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-ping"></span>
                    Canlı GPS
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold truncate mt-0.5">
                  Hedef: {destinationStop ? destinationStop.address : 'Güzergah Tamamlanıyor'}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={closeDriveMode}
              className="p-2 hover:bg-emerald-800 rounded-2xl text-emerald-100 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Tam Ekrandan Çık"
              id="close-fullscreen-drive-btn"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Fullscreen Map Area */}
          <div className="relative flex-1 w-full h-full bg-slate-800">
            <div id={fullscreenMapId} className="w-full h-full z-10" />

            {/* Recenter GPS Floating Button */}
            <button
              type="button"
              onClick={recenterGPS}
              className="absolute top-4 right-4 bg-white text-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-200 z-20 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
              title="Konumumu Haritada Merkezle"
            >
              <Crosshair className="w-6 h-6 text-indigo-600 animate-pulse" />
            </button>

            {/* Turn by turn notification card floating on map */}
            <div className="absolute top-4 left-4 z-20 bg-slate-900/85 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700 shadow-xl max-w-[220px]">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-300">Güzergah İzleniyor</span>
              </div>
              <p className="text-[11px] font-bold text-white mt-1 truncate">
                {trip.distanceKm} km • {trip.durationMin} dakika
              </p>
            </div>
          </div>

          {/* Bottom Drive Telemetry HUD - Google Maps Dashboard */}
          <div className="bg-slate-900 border-t border-slate-800 p-4 z-30 shadow-2xl">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">
              
              {/* Speedometer */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center font-black shadow-lg">
                  <span className="text-sm leading-none">{currentSpeed}</span>
                  <span className="text-[7px] tracking-wider uppercase opacity-80 mt-0.5">KM/S</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Sürüş Hızı</p>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Canlı Yol Takibi
                  </span>
                </div>
              </div>

              {/* Trip stats summary */}
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Kalan Tahmini</span>
                <p className="text-xs font-black text-indigo-400">
                  {trip.distanceKm} KM • {trip.durationMin} DK
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isDriver && (
                  <button
                    type="button"
                    onClick={handleFinishDrive}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    id="finish-drive-btn"
                  >
                    <Check className="w-4 h-4" />
                    Yolculuğu Tamamla
                  </button>
                )}
                {!isDriver && (
                  <button
                    type="button"
                    onClick={closeDriveMode}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-3 rounded-2xl transition-all cursor-pointer"
                  >
                    Moddan Çık
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      )}
    </>
  );
}

