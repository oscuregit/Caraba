import React, { useState } from 'react';
import { RouteStop } from '../types';
import { MapPin, Plus, Trash2, ArrowUpDown, Info, Check } from 'lucide-react';

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
    const finalLat = lat || 41.0082 + (Math.random() - 0.5) * 0.15;
    const finalLng = lng || 28.9784 + (Math.random() - 0.5) * 0.15;

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

  return (
    <div className="space-y-4" id="route-builder">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Güzergah & Duraklar</span>
        <span className="text-xs text-gray-400">Durakları yukarı/aşağı taşıyarak rotayı değiştirin</span>
      </div>

      {/* Selected Stops List */}
      <div className="space-y-2.5">
        {stops.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            <MapPin className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 font-medium">Henüz durak eklemediniz.</p>
            <p className="text-[10px] text-gray-400 mt-1">Aşağıdan önerilen adresleri seçin veya kendiniz yazın.</p>
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
                  <p className="text-xs text-gray-800 font-medium mt-1 truncate">{stop.address}</p>
                </div>

                {/* Reorder and Delete Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStop(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                    title="Yukarı taşı"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(index, 'down')}
                    disabled={index === stops.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                    title="Aşağı taşı"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStop(stop.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1"
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
      <div className="relative">
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
              placeholder="Adres yazın veya durak arayın..."
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-gray-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={() => addStop(addressInput)}
            disabled={!addressInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </div>

        {/* Preset/Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-gray-50 p-1.5 animate-fadeIn">
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Sık Kullanılan İş Yeri Durakları
            </div>
            {PRESET_PLACES.filter(place => 
              place.address.toLowerCase().includes(addressInput.toLowerCase())
            ).map((place) => (
              <button
                key={place.address}
                type="button"
                onClick={() => addStop(place.address, place.lat, place.lng)}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg flex items-center gap-2 transition-all"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{place.address}</span>
              </button>
            ))}
            {addressInput.trim() && (
              <button
                type="button"
                onClick={() => addStop(addressInput)}
                className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2 transition-all border-t border-gray-50"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Yeni Adres Ekle: "{addressInput}"
              </button>
            )}
            <div className="flex justify-end p-1">
              <button 
                type="button" 
                onClick={() => setShowSuggestions(false)}
                className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Notice about prices & calculations */}
      <div className="flex gap-2.5 bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-[10px] leading-relaxed">
          <span className="font-semibold block">Tahmini Hesaplama Bilgisi</span>
          Sistem, duraklar arasındaki gerçek mesafeyi analiz ederek yakıt maliyeti tahmini çıkarır. 
          Toplam masraf, taşıyıcı ve tüm onaylanmış yolculara eşit bölünür. (Örnek: 30 {currencySymbol} / 4 Kişi = 7.5 {currencySymbol} kişi başı)
        </div>
      </div>
    </div>
  );
}
