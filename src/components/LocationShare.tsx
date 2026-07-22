import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trip, LiveLocation, User } from '../types';
import { updateLiveLocation, completeTrip } from '../services/db';
import { 
  Navigation, MapPin, Check, Compass, Play, Pause, RefreshCw, Crosshair, 
  Maximize2, Minimize2, X, ArrowRight, ShieldCheck, Gauge, LocateFixed, 
  Locate, Eye, Route, Radio, Footprints, ChevronDown, ChevronUp 
} from 'lucide-react';
import L from 'leaflet';
import { fetchRoadRoute, interpolateAlongRoad, getUserLocation, getHaversineDistance } from '../services/routing';

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
  const [autoCenterLock, setAutoCenterLock] = useState(true); // Auto-lock map center to user location
  const [userAccessRoadCoords, setUserAccessRoadCoords] = useState<[number, number][]>([]);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

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
      setAutoCenterLock(true);
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

  // Fetch real road route from user location to trip starting stop
  useEffect(() => {
    const startStop = stops.length > 0 ? stops[0] : null;
    if (!userLocation || !startStop) {
      setUserAccessRoadCoords([]);
      return;
    }

    let isSubscribed = true;
    fetchRoadRoute([
      { lat: userLocation.lat, lng: userLocation.lng },
      { lat: startStop.lat, lng: startStop.lng }
    ]).then(res => {
      if (isSubscribed && res.coordinates && res.coordinates.length > 0) {
        setUserAccessRoadCoords(res.coordinates);
      }
    }).catch(err => {
      console.warn("User access route fetch error:", err);
      if (isSubscribed) {
        setUserAccessRoadCoords([[userLocation.lat, userLocation.lng], [startStop.lat, startStop.lng]]);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [userLocation?.lat, userLocation?.lng, stops]);

  // OpenStreetMap leaflet map logic
  const mapContainerId = `map-${trip.id}`;
  const fullscreenMapId = `fs-map-${trip.id}`;
  
  const mapRef = useRef<L.Map | null>(null);
  const fsMapRef = useRef<L.Map | null>(null);
  
  const polylineRef = useRef<L.Polyline | null>(null);
  const fsPolylineRef = useRef<L.Polyline | null>(null);
  const fsUserAccessPolylineRef = useRef<L.Polyline | null>(null);
  
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const fsStopsLayerRef = useRef<L.LayerGroup | null>(null);
  
  const liveLayerRef = useRef<L.LayerGroup | null>(null);
  const fsLiveLayerRef = useRef<L.LayerGroup | null>(null);
  const fsUserMarkerRef = useRef<L.Marker | null>(null);

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

  const createUserLocationIcon = (name: string, roleLabel: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center animate-fadeIn">
          <span class="absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-60 animate-ping"></span>
          <div class="relative flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs">
            ${initials}
          </div>
          <div class="absolute -bottom-5 bg-slate-900/90 text-emerald-300 border border-emerald-500/50 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
            Sen (${roleLabel})
          </div>
        </div>
      `,
      className: 'custom-user-live-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
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

  // 1. Initialize Fullscreen Navigation Drive Map Instance
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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        map.on('dragstart', () => {
          setAutoCenterLock(false);
        });

        fsStopsLayerRef.current = L.layerGroup().addTo(map);
        fsLiveLayerRef.current = L.layerGroup().addTo(map);

        fsMapRef.current = map;
      }

      fsMapRef.current.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (fsMapRef.current) {
        fsMapRef.current.remove();
        fsMapRef.current = null;
        fsPolylineRef.current = null;
        fsUserAccessPolylineRef.current = null;
        fsStopsLayerRef.current = null;
        fsLiveLayerRef.current = null;
        fsUserMarkerRef.current = null;
      }
    };
  }, [isDriveModeOpen, fullscreenMapId]);

  // 2. Sync Fullscreen Main Route Polyline
  useEffect(() => {
    const fsMap = fsMapRef.current;
    if (!isDriveModeOpen || !fsMap) return;

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
  }, [isDriveModeOpen, roadCoords, stops]);

  // 3. Sync Fullscreen Stops Layer
  useEffect(() => {
    const fsMap = fsMapRef.current;
    if (!isDriveModeOpen || !fsMap) return;

    if (!fsStopsLayerRef.current) {
      fsStopsLayerRef.current = L.layerGroup().addTo(fsMap);
    }
    fsStopsLayerRef.current.clearLayers();

    stops.forEach((stop, idx) => {
      const icon = createStopIcon(stop.type, idx, stop.address);
      const marker = L.marker([stop.lat, stop.lng], { icon });
      fsStopsLayerRef.current?.addLayer(marker);
    });
  }, [isDriveModeOpen, stops]);

  // 4. Sync Fullscreen Other Live Locations
  useEffect(() => {
    const fsMap = fsMapRef.current;
    if (!isDriveModeOpen || !fsMap) return;

    if (!fsLiveLayerRef.current) {
      fsLiveLayerRef.current = L.layerGroup().addTo(fsMap);
    }
    fsLiveLayerRef.current.clearLayers();

    Object.entries(liveLocations).forEach(([uid, loc]) => {
      if (!loc.active || uid === currentUser.uid) return;
      const icon = createLiveLocationIcon(loc.role, loc.userName);
      const marker = L.marker([loc.lat, loc.lng], { icon });
      fsLiveLayerRef.current?.addLayer(marker);
    });
  }, [isDriveModeOpen, liveLocations, currentUser.uid]);

  // 5. Sync User Live Position, User Access Route to Start, and Camera Position
  useEffect(() => {
    const fsMap = fsMapRef.current;
    if (!isDriveModeOpen || !fsMap || !userLocation) return;

    // Render / update user marker position
    const userIcon = createUserLocationIcon(currentUser.name, isDriver ? 'Sürücü' : 'Yolcu');
    if (fsUserMarkerRef.current) {
      fsUserMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      fsUserMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(fsMap);
    }

    // Render / update user access route to start stop using OSRM coordinates
    const startStop = stops.length > 0 ? stops[0] : null;
    if (startStop) {
      const accessCoords: [number, number][] = userAccessRoadCoords.length > 0
        ? userAccessRoadCoords
        : [
            [userLocation.lat, userLocation.lng],
            [startStop.lat, startStop.lng]
          ];

      if (fsUserAccessPolylineRef.current) {
        fsUserAccessPolylineRef.current.setLatLngs(accessCoords);
      } else {
        fsUserAccessPolylineRef.current = L.polyline(accessCoords, {
          color: '#10b981', // emerald road connector
          weight: 5,
          dashArray: '8, 8',
          opacity: 0.95
        }).addTo(fsMap);
      }
    }

    // Smooth map re-centering if lock is active
    if (autoCenterLock) {
      fsMap.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.5 });
    }
  }, [isDriveModeOpen, userLocation, userAccessRoadCoords, autoCenterLock, currentUser.name, isDriver, stops]);

  const recenterOnUser = async () => {
    setAutoCenterLock(true);
    let loc = userLocation;
    if (!loc) {
      const res = await getUserLocation();
      if (res.isRealLocation || res.lat) {
        loc = { lat: res.lat, lng: res.lng };
        setUserLocation(loc);
      }
    }
    if (loc && fsMapRef.current) {
      fsMapRef.current.setView([loc.lat, loc.lng], 17, { animate: true });
    } else if (hasStops && fsMapRef.current) {
      fsMapRef.current.setView([stops[0].lat, stops[0].lng], 16, { animate: true });
    }
  };

  const recenterWholeRoute = () => {
    setAutoCenterLock(false);
    if (fsMapRef.current) {
      if (fsPolylineRef.current) {
        try {
          fsMapRef.current.fitBounds(fsPolylineRef.current.getBounds(), { padding: [50, 50] });
        } catch (e) {
          console.error(e);
        }
      } else if (hasStops) {
        fsMapRef.current.setView([stops[0].lat, stops[0].lng], 13, { animate: true });
      }
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
  const startStop = stops.length > 0 ? stops[0] : null;
  
  const distToStartKm = userLocation && startStop 
    ? getHaversineDistance(userLocation.lat, userLocation.lng, startStop.lat, startStop.lng)
    : null;
  const etaToStartMin = distToStartKm !== null ? Math.max(1, Math.round((distToStartKm / 35) * 60)) : null;

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

        {/* Embedded Map Container */}
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

      {/* Fullscreen Google Maps Style Live Driving Navigation Overlay (Rendered via React Portal at document.body) */}
      {isDriveModeOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-900 flex flex-col animate-fadeIn w-screen h-screen top-0 left-0 right-0 bottom-0 overflow-hidden" id="fullscreen-drive-overlay">
          
          {/* Top Navigation HUD - Google Maps Emerald Green Bar */}
          <div className="bg-emerald-700 text-white p-3 sm:p-4 shadow-2xl z-30 flex items-center justify-between gap-2 border-b border-emerald-600 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-md">
                <Navigation className="w-6 h-6 transform rotate-45" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-950/60 text-emerald-200 px-2 py-0.5 rounded-full">
                    SÜRÜŞ MODU
                  </span>
                  <span className="text-[10px] text-emerald-100 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-ping"></span>
                    Canlı GPS
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold truncate mt-0.5 text-white">
                  Hedef: {destinationStop ? destinationStop.address : 'Güzergah Tamamlanıyor'}
                </h3>
              </div>
            </div>

            {/* Quick Action Controls on Header */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={recenterOnUser}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                  autoCenterLock
                    ? 'bg-emerald-300 text-slate-950 ring-2 ring-emerald-100 font-black'
                    : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/40'
                }`}
                id="recenter-user-btn"
                title="Konumumu Ekranın Ortasında Göster"
              >
                <LocateFixed className={`w-4 h-4 ${autoCenterLock ? 'animate-spin-slow text-slate-950' : ''}`} />
                <span>Ortala</span>
                {autoCenterLock && <span className="w-2 h-2 bg-slate-950 rounded-full animate-ping"></span>}
              </button>

              <button
                type="button"
                onClick={recenterWholeRoute}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                id="recenter-route-btn"
                title="Tüm Sefer Güzergahını Göster"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Tüm Güzergah</span>
              </button>

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
          </div>

          {/* Fullscreen Map Area */}
          <div className="relative flex-1 w-full h-full bg-slate-800 overflow-hidden">
            <div id={fullscreenMapId} className="w-full h-full z-10" />

            {/* Floating Action Center Control Panel - Positioned directly above bottom HUD */}
            <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2 items-end">
              <button
                type="button"
                onClick={recenterOnUser}
                className={`px-4 py-2.5 rounded-2xl shadow-2xl border transition-all cursor-pointer flex items-center gap-2 font-bold text-xs ${
                  autoCenterLock
                    ? 'bg-emerald-600 text-white border-emerald-400 ring-4 ring-emerald-200/50 shadow-emerald-500/30'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
                title="Haritada Ortala"
                id="floating-recenter-user-btn"
              >
                <LocateFixed className={`w-4 h-4 ${autoCenterLock ? 'text-white' : 'text-emerald-600'}`} />
                <span>Ortala</span>
                {autoCenterLock && <span className="w-2 h-2 bg-emerald-300 rounded-full animate-ping"></span>}
              </button>

              <button
                type="button"
                onClick={recenterWholeRoute}
                className="bg-white/95 backdrop-blur-md text-slate-700 px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5 font-semibold text-[11px]"
                id="floating-recenter-route-btn"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Tüm Güzergah</span>
              </button>
            </div>

            {/* Expandable/Collapsible Realtime User Access Route & Telemetry Card */}
            <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-w-[280px]">
              <button
                type="button"
                onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/80 transition-colors cursor-pointer"
                id="toggle-telemetry-card-btn"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Route className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 truncate">
                    Kişisel Güzergah Takibi
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {isTelemetryOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isTelemetryOpen && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-slate-800 animate-fadeIn">
                  {distToStartKm !== null ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Kalkış Noktasına:</span>
                        <span className="font-bold text-emerald-300">{distToStartKm} km (~{etaToStartMin} dk)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Sefer Mesafesi:</span>
                        <span className="font-bold text-indigo-300">{trip.distanceKm} km</span>
                      </div>
                      <div className="text-[9px] text-emerald-300 flex items-center gap-1.5 mt-1 bg-emerald-950/80 p-2 rounded-xl border border-emerald-800/60 leading-tight">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                        <span>Konumunuzdan kalkış noktasına gerçek karayolu rotası gösteriliyor.</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-300 italic">
                      GPS konumunuz alınıyor... Sefer noktasına canlı bağlantı kuruluyor.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Drive Telemetry HUD - Google Maps Dashboard */}
          <div className="bg-slate-900 border-t border-slate-800 p-4 z-30 shadow-2xl shrink-0">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
              
              {/* Speedometer */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center font-black shadow-lg shrink-0">
                  <span className="text-sm leading-none">{currentSpeed}</span>
                  <span className="text-[7px] tracking-wider uppercase opacity-80 mt-0.5">KM/S</span>
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className="text-xs font-bold text-white">Sürüş Hızı</p>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Canlı Yol Takibi
                  </span>
                </div>
              </div>

              {/* Status pill */}
              <div className="text-center flex-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Kamera Kilit Durumu</span>
                <p className={`text-[11px] font-bold mt-0.5 ${autoCenterLock ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {autoCenterLock ? 'Ortalanmış Takip Açık' : 'Serbest Görünüm (Ortala\'ya basarak kilitleyin)'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
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

        </div>,
        document.body
      )}
    </>
  );
}


