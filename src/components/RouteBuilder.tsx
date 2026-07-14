import React, { useState, useEffect, useRef } from 'react';
import { RouteStop } from '../types';
import { MapPin, Plus, Trash2, ArrowUpDown, Info, Check, Map, Compass, Loader2, X } from 'lucide-react';
import L from 'leaflet';

interface RouteBuilderProps {
  stops: RouteStop[];
  onChange: (stops: RouteStop[]) => void;
  onMetricsChange: (metrics: { distance: number; duration: number; cost: number }) => void;
  currencySymbol?: string;
}

const PRESET_PLACES = [
  { address: 'Merkez Ofis (Maslak Plaza)', lat: 41.1122, lng: 29.0211 },
  { address: 'Kadıköy Metro Durağı', lat: 40.9901, lng: 29.0289 },
  { address: 'Ataşehir Batı Konutları', lat: 40.9922, lng: 29.1144 },
  { address: 'Beşiktaş İskele Meydanı', lat: 41.0418, lng: 29.0061 },
  { address: 'Ümraniye Çarşı Metro', lat: 41.0261, lng: 29.0911 },
  { address: 'Kartal Köprüsü', lat: 40.9088, lng: 29.2133 },
  { address: 'Mecidiyeköy Metrobüs', lat: 41.0633, lng: 28.9911 },
  { address: 'Beylikdüzü Meydan', lat: 41.0022, lng: 28.6411 }
];

export default function RouteBuilder({ stops, onChange, onMetricsChange, currencySymbol = 'zł' }: RouteBuilderProps) {
  const [addressInput, setAddressInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);

  // OSM Autocomplete suggestion states
  const [osmSuggestions, setOsmSuggestions] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Mini-map references and states
  const miniMapRef = useRef<L.Map | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const previewMarkerRef = useRef<L.Marker | null>(null);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Picker Map references and states
  const pickerMapRef = useRef<L.Map | null>(null);
  const [pickerCenter, setPickerCenter] = useState<{ lat: number; lng: number }>({ lat: 41.0082, lng: 28.9784 });
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvingAddress, setResolvingAddress] = useState(false);

  // Simple heuristic distance calculation between coordinates in km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  const recalculateMetrics = (currentStops: RouteStop[]) => {
    if (currentStops.length < 2) {
      onMetricsChange({ distance: 0, duration: 0, cost: 0 });
      return;
    }

    let totalDist = 0;
    for (let i = 0; i < currentStops.length - 1; i++) {
      const from = currentStops[i];
      const to = currentStops[i + 1];
      totalDist += getDistance(from.lat, from.lng, to.lat, to.lng);
    }

    // Multiply by 1.2 to account for real road curves
    totalDist = parseFloat((totalDist * 1.2).toFixed(1));
    if (totalDist === 0) totalDist = 4.5; // default fallback

    // Estimate duration: 2.2 minutes per km + 3 mins buffer per extra stop
    const duration = Math.round(totalDist * 2.2 + (currentStops.length - 2) * 3);
    
    // Estimate cost: 2.5 currency units per km (representing fuel, wear, and toll cost)
    const cost = parseFloat((totalDist * 2.5).toFixed(1));

    onMetricsChange({ distance: totalDist, duration, cost });
  };

  const addStop = (address: string, lat?: number, lng?: number) => {
    if (!address.trim()) return;

    // Use selected values or generate dummy coordinates around Istanbul
    const finalLat = lat !== undefined ? lat : 41.0082 + (Math.random() - 0.5) * 0.15;
    const finalLng = lng !== undefined ? lng : 28.9784 + (Math.random() - 0.5) * 0.15;

    const newStop: RouteStop = {
      id: Math.random().toString(36).substring(2, 9),
      address: address.trim(),
      lat: finalLat,
      lng: finalLng,
      type: stops.length === 0 ? 'start' : 'stop'
    };

    const updatedStops = [...stops];
    if (updatedStops.length > 0) {
      // Re-assign the end type
      updatedStops[updatedStops.length - 1].type = 'stop';
    }
    
    newStop.type = stops.length === 0 ? 'start' : 'end';
    updatedStops.push(newStop);

    // Enforce correct types
    if (updatedStops.length > 1) {
      updatedStops[0].type = 'start';
      for (let i = 1; i < updatedStops.length - 1; i++) {
        updatedStops[i].type = 'stop';
      }
      updatedStops[updatedStops.length - 1].type = 'end';
    }

    onChange(updatedStops);
    recalculateMetrics(updatedStops);
    setAddressInput('');
    setPreviewCoords(null);
    setShowSuggestions(false);
  };

  const removeStop = (id: string) => {
    let updatedStops = stops.filter(s => s.id !== id);
    
    if (updatedStops.length > 0) {
      updatedStops[0].type = 'start';
      if (updatedStops.length > 1) {
        for (let i = 1; i < updatedStops.length - 1; i++) {
          updatedStops[i].type = 'stop';
        }
        updatedStops[updatedStops.length - 1].type = 'end';
      }
    }

    onChange(updatedStops);
    recalculateMetrics(updatedStops);
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === stops.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedStops = [...stops];
    const temp = updatedStops[index];
    updatedStops[index] = updatedStops[targetIndex];
    updatedStops[targetIndex] = temp;

    // Correct types
    updatedStops[0].type = 'start';
    if (updatedStops.length > 1) {
      for (let i = 1; i < updatedStops.length - 1; i++) {
        updatedStops[i].type = 'stop';
      }
      updatedStops[updatedStops.length - 1].type = 'end';
    }

    onChange(updatedStops);
    recalculateMetrics(updatedStops);
  };

  // Debounced real-time OSM Geocoding suggestion search
  useEffect(() => {
    if (!addressInput || addressInput.trim().length < 3) {
      setOsmSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingSuggestions(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}&limit=5&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const suggestions = data.map(item => ({
              address: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }));
            setOsmSuggestions(suggestions);
          }
        })
        .catch(err => {
          console.error("OSM suggestions error:", err);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [addressInput]);

  // Synchronize suggestions coordinates as preview coordinates
  useEffect(() => {
    if (osmSuggestions.length > 0) {
      setPreviewCoords({ lat: osmSuggestions[0].lat, lng: osmSuggestions[0].lng });
    } else {
      const exactPreset = PRESET_PLACES.find(p => p.address === addressInput);
      if (exactPreset) {
        setPreviewCoords({ lat: exactPreset.lat, lng: exactPreset.lng });
      } else if (!addressInput) {
        setPreviewCoords(null);
      }
    }
  }, [osmSuggestions, addressInput]);

  // Initialize and update mini preview map
  useEffect(() => {
    const container = document.getElementById('route-builder-mini-map');
    if (!container) return;

    if (!miniMapRef.current) {
      const map = L.map('route-builder-mini-map', {
        center: [41.0082, 28.9784],
        zoom: 11,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      miniMapRef.current = map;
      stopsLayerRef.current = L.layerGroup().addTo(map);
    }

    const resizeTimer = setTimeout(() => {
      if (miniMapRef.current) {
        miniMapRef.current.invalidateSize();
      }
    }, 150);

    return () => clearTimeout(resizeTimer);
  }, []);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, []);

  // Sync stops & preview marker on the mini map
  useEffect(() => {
    const map = miniMapRef.current;
    if (!map) return;

    if (stopsLayerRef.current) {
      stopsLayerRef.current.clearLayers();
    }

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }

    const bounds: L.LatLngTuple[] = [];

    // Render active route stops
    stops.forEach((stop, index) => {
      bounds.push([stop.lat, stop.lng]);
      const colorClass = stop.type === 'start' ? 'bg-green-500' : stop.type === 'end' ? 'bg-indigo-600' : 'bg-amber-500';
      const label = stop.type === 'start' ? 'B' : stop.type === 'end' ? 'S' : `${index}`;

      const icon = L.divIcon({
        html: `<div class="flex items-center justify-center w-5 h-5 rounded-full border border-white shadow-md ${colorClass} text-white text-[9px] font-black">${label}</div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon });
      stopsLayerRef.current?.addLayer(marker);
    });

    // Render current active typing address preview coordinate
    if (previewCoords) {
      bounds.push([previewCoords.lat, previewCoords.lng]);

      const previewIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center w-6 h-6 rounded-full border border-white shadow-lg bg-rose-500 text-white text-[10px] font-bold animate-bounce"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping absolute"></span>📍</div>`,
        className: 'custom-preview-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      previewMarkerRef.current = L.marker([previewCoords.lat, previewCoords.lng], { icon: previewIcon })
        .addTo(map)
        .bindPopup(`<b class="text-[10px] text-rose-600 block text-center">Yazılan Adres Konumu</b>`, { closeButton: false })
        .openPopup();
    }

    // Auto zoom and fit to wrap stops and preview comfortably
    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [25, 25], maxZoom: 14 });
      } catch (err) {
        console.error("Mini map fit bounds error", err);
      }
    } else {
      map.setView([41.0082, 28.9784], 11);
    }
  }, [stops, previewCoords]);

  // Picker Map reverse geocode execution
  const reverseGeocode = (lat: number, lng: number) => {
    setResolvingAddress(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'tr,en'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) {
          setResolvedAddress(data.display_name);
        } else {
          setResolvedAddress(`Seçilen Konum (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      })
      .catch(err => {
        console.error("Reverse geocode error:", err);
        setResolvedAddress(`Seçilen Konum (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      })
      .finally(() => {
        setResolvingAddress(false);
      });
  };

  // Picker Map initialization & lifecycle
  useEffect(() => {
    if (!isMapPopupOpen) {
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('popup-picker-map');
      if (!container) return;

      const defaultCenter = stops.length > 0 ? [stops[stops.length - 1].lat, stops[stops.length - 1].lng] : [41.0082, 28.9784];

      if (!pickerMapRef.current) {
        const map = L.map('popup-picker-map', {
          center: defaultCenter as L.LatLngExpression,
          zoom: 14,
          zoomControl: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        pickerMapRef.current = map;

        // Fetch first point address
        reverseGeocode(defaultCenter[0], defaultCenter[1]);
        setPickerCenter({ lat: defaultCenter[0], lng: defaultCenter[1] });

        // Move event updates selected center coordinates and triggers reverse-geocoding
        map.on('moveend', () => {
          const center = map.getCenter();
          setPickerCenter({ lat: center.lat, lng: center.lng });
          reverseGeocode(center.lat, center.lng);
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isMapPopupOpen]);

  const confirmPickerSelection = () => {
    if (resolvedAddress) {
      setAddressInput(resolvedAddress);
      setPreviewCoords({ lat: pickerCenter.lat, lng: pickerCenter.lng });
    }
    setIsMapPopupOpen(false);
  };

  // Prepare full list of suggestions
  const filteredPresets = PRESET_PLACES.filter(place =>
    place.address.toLowerCase().includes(addressInput.toLowerCase())
  );

  return (
    <div className="space-y-4" id="route-builder">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Güzergah & Duraklar</span>
        <span className="text-xs text-gray-400">Durakları sıralayarak rotayı güncelleyin</span>
      </div>

      {/* Selected Stops List */}
      <div className="space-y-2.5">
        {stops.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            <MapPin className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 font-medium">Henüz durak eklemediniz.</p>
            <p className="text-[10px] text-gray-400 mt-1">Aşağıdan önerilen adresleri seçin, haritadan işaretleyin veya kendiniz yazın.</p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-2">
            {/* Direct Line Background between stops */}
            <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gradient-to-b from-blue-500 to-indigo-600"></div>

            {stops.map((stop, index) => (
              <div 
                key={stop.id} 
                className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative hover:border-gray-200 transition-all"
                id={`stop-item-${stop.id}`}
              >
                {/* Visual Connector Dot */}
                <div className={`w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center z-10 ${
                  stop.type === 'start' ? 'border-green-500' : stop.type === 'end' ? 'border-indigo-600' : 'border-amber-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    stop.type === 'start' ? 'bg-green-500' : stop.type === 'end' ? 'bg-indigo-600' : 'bg-amber-500'
                  }`}></div>
                </div>

                {/* Stop Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      stop.type === 'start' ? 'bg-green-50 text-green-700' : stop.type === 'end' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {stop.type === 'start' ? 'BAŞLANGIÇ' : stop.type === 'end' ? 'VARIŞ' : `${index}. DURAK`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-800 font-medium mt-1 truncate" title={stop.address}>{stop.address}</p>
                </div>

                {/* Reorder and Delete Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStop(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors cursor-pointer"
                    title="Yukarı taşı"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(index, 'down')}
                    disabled={index === stops.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors cursor-pointer"
                    title="Aşağı taşı"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStop(stop.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1 cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Stop Input with Autocomplete Suggestion Dropdown */}
      <div className="relative space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Adres yazın, durak arayın..."
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-10 text-gray-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            
            {/* Loading spinner inside input if searching OSM */}
            {loadingSuggestions && (
              <Loader2 className="absolute right-3 top-3 w-4 h-4 text-indigo-500 animate-spin" />
            )}
          </div>

          {/* Map picker popup opener button */}
          <button
            type="button"
            id="open-map-picker-btn"
            onClick={() => setIsMapPopupOpen(true)}
            className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm shadow-indigo-100/50"
            title="Haritadan Konum Seç"
          >
            <Map className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => addStop(addressInput, previewCoords?.lat, previewCoords?.lng)}
            disabled={!addressInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </div>

        {/* Real-time Map preview directly below the input field showing entered stops & typed preview location */}
        <div className="relative bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden h-[130px] shadow-inner" id="route-builder-mini-map-container">
          <div id="route-builder-mini-map" className="w-full h-full z-10" />
          <div className="absolute top-2 left-2 bg-slate-900/75 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-[8px] font-bold tracking-wider uppercase z-20 pointer-events-none">
            Aktif Güzergah Önizleme
          </div>
        </div>

        {/* Combined Suggestions Dropdown */}
        {showSuggestions && (addressInput.trim().length > 0 || filteredPresets.length > 0) && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-gray-50 p-1.5 animate-fadeIn">
            {/* Presets Title */}
            {filteredPresets.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Sık Kullanılan İş Yeri Durakları
                </div>
                {filteredPresets.map((place) => (
                  <button
                    key={place.address}
                    type="button"
                    onClick={() => addStop(place.address, place.lat, place.lng)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate font-medium">{place.address}</span>
                  </button>
                ))}
              </>
            )}

            {/* OSM Live Geocoded Matches */}
            {osmSuggestions.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Harita Konum Sonuçları (Gerçek Konumlu)
                </div>
                {osmSuggestions.map((place, idx) => (
                  <button
                    key={`${place.address}-${idx}`}
                    type="button"
                    onClick={() => addStop(place.address, place.lat, place.lng)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-spin-slow" />
                    <span className="truncate">{place.address}</span>
                  </button>
                ))}
              </>
            )}

            {addressInput.trim() && (
              <button
                type="button"
                onClick={() => addStop(addressInput, previewCoords?.lat, previewCoords?.lng)}
                className="w-full text-left px-3 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2 transition-all border-t border-gray-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Girilen Adresi Kaydet: "{addressInput}"
              </button>
            )}
            
            <div className="flex justify-end p-1">
              <button 
                type="button" 
                onClick={() => setShowSuggestions(false)}
                className="text-[9px] font-bold text-gray-400 hover:text-gray-600 px-2.5 py-1 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                Önerileri Kapat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Notice about prices & calculations */}
      <div className="flex gap-2.5 bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-[10px] leading-relaxed">
          <span className="font-semibold block text-[11px]">Akıllı Güzergah & Gerçek Zamanlı Harita</span>
          Adres yazarken mini harita üzerinden anlık konumunu görebilir, harita ikonuna tıklayarak doğrudan haritayı sürükleyip istediğiniz yeri işaretleyerek durak belirleyebilirsiniz. Rotalar arasındaki gerçek yol mesafesi anında hesaplanıp yakıt masrafına bölünür.
        </div>
      </div>

      {/* Map Picker Modal Popup */}
      {isMapPopupOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fadeIn"
          id="map-picker-modal"
        >
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl relative animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-gray-800 text-sm">Haritadan Durak Seç</h4>
              </div>
              <button
                type="button"
                id="close-map-picker-btn"
                onClick={() => setIsMapPopupOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Map Area */}
            <div className="relative w-full h-[320px] bg-slate-100">
              <div id="popup-picker-map" className="w-full h-full z-10" />

              {/* Absolutely centered pinpoint */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[100%] pointer-events-none z-[1000] flex flex-col items-center">
                <div className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-md mb-2 animate-bounce">
                  {resolvingAddress ? 'Adres Çözümleniyor...' : 'Seçmek İçin Sürükleyin'}
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-indigo-600 fill-indigo-200" />
                </div>
                <div className="w-2 h-2 bg-slate-900/30 rounded-full blur-[1px] mt-0.5"></div>
              </div>
            </div>

            {/* Resolved Address bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">İşaretlenen Adres</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-800 font-semibold leading-normal min-h-8 flex items-center">
                  {resolvingAddress ? (
                    <span className="text-gray-400 flex items-center gap-1.5 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adres aranıyor...
                    </span>
                  ) : (
                    resolvedAddress || 'Haritayı kaydırarak bir nokta seçin...'
                  )}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsMapPopupOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                id="select-picker-location-btn"
                onClick={confirmPickerSelection}
                disabled={resolvingAddress || !resolvedAddress}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Bu Konumu Seç
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
