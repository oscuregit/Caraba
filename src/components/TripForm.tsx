import React, { useState, useEffect } from 'react';
import { Trip, RouteStop, User } from '../types';
import { createTrip, updateTrip } from '../services/db';
import RouteBuilder from './RouteBuilder';
import { X, Calendar, Clock, Car, Tag, Sparkles, AlertCircle, Copy } from 'lucide-react';

interface TripFormProps {
  currentUser: User;
  onClose: () => void;
  editingTrip?: Trip; // If editing
  repeatingTrip?: Trip; // If duplicating/repeating
}

export default function TripForm({ currentUser, onClose, editingTrip, repeatingTrip }: TripFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxPassengers, setMaxPassengers] = useState(3);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [recurring, setRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize form fields based on whether editing or repeating a trip
  useEffect(() => {
    if (editingTrip) {
      setTitle(editingTrip.title);
      setDate(editingTrip.date);
      setTime(editingTrip.time);
      setMaxPassengers(editingTrip.maxPassengers);
      setStops(editingTrip.stops || []);
      setDistanceKm(editingTrip.distanceKm);
      setDurationMin(editingTrip.durationMin);
      setEstimatedCost(editingTrip.estimatedCost);
      setRecurring(editingTrip.recurring);
      setRecurringDays(editingTrip.recurringDays || [1, 2, 3, 4, 5]);
    } else if (repeatingTrip) {
      // Duplicating trip for repeat feature: preserve route/details, set today or tomorrow
      setTitle(repeatingTrip.title);
      // Auto-set tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      setDate(tomorrowStr);
      setTime(repeatingTrip.time);
      setMaxPassengers(repeatingTrip.maxPassengers);
      setStops(repeatingTrip.stops || []);
      setDistanceKm(repeatingTrip.distanceKm);
      setDurationMin(repeatingTrip.durationMin);
      setEstimatedCost(repeatingTrip.estimatedCost);
      setRecurring(repeatingTrip.recurring);
      setRecurringDays(repeatingTrip.recurringDays || [1, 2, 3, 4, 5]);
    } else {
      // Default placeholder values for a quick neat creation
      setTitle('Sabah İşe Gidiş Rotalı');
      const todayStr = new Date().toISOString().split('T')[0];
      setDate(todayStr);
      setTime('08:00');
    }
  }, [editingTrip, repeatingTrip]);

  const handleMetricsChange = (metrics: { distance: number; duration: number; cost: number }) => {
    setDistanceKm(metrics.distance);
    setDurationMin(metrics.duration);
    setEstimatedCost(metrics.cost);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Lütfen yolculuk için açıklayıcı bir başlık girin.');
      return;
    }
    if (!date) {
      setError('Lütfen yolculuk tarihini seçin.');
      return;
    }
    if (!time) {
      setError('Lütfen kalkış saatini seçin.');
      return;
    }
    if (stops.length < 2) {
      setError('Lütfen en az bir Başlangıç ve bir Varış noktası girin.');
      return;
    }

    setLoading(true);
    try {
      if (editingTrip) {
        // Edit existing trip
        await updateTrip(editingTrip.id, {
          title,
          date,
          time,
          maxPassengers,
          stops,
          distanceKm,
          durationMin,
          estimatedCost,
          recurring,
          recurringDays
        });
      } else {
        // Create new trip (or recreate duplicated)
        await createTrip({
          driverId: currentUser.uid,
          driverName: currentUser.name,
          title,
          date,
          time,
          stops,
          maxPassengers,
          estimatedCost,
          distanceKm,
          durationMin,
          status: 'scheduled',
          passengers: [],
          requests: [],
          recurring,
          recurringDays
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yolculuk kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayNum: number) => {
    if (recurringDays.includes(dayNum)) {
      setRecurringDays(recurringDays.filter(d => d !== dayNum));
    } else {
      setRecurringDays([...recurringDays, dayNum].sort());
    }
  };

  const DAYS_LOOKUP = [
    { num: 1, label: 'Pzt' },
    { num: 2, label: 'Sal' },
    { num: 3, label: 'Çar' },
    { num: 4, label: 'Per' },
    { num: 5, label: 'Cum' },
    { num: 6, label: 'Cmt' },
    { num: 0, label: 'Paz' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="trip-form-modal">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleUp">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-800 text-sm">
              {editingTrip ? 'Yolculuğu Düzenle' : repeatingTrip ? 'Yolculuğu Tekrarla & Oluştur' : 'Yeni Yolculuk Başlat'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-800 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block pl-1">Yolculuk Başlığı</label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Kadıköy - Maslak Sabah İşe Gidiş"
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-gray-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              />
              <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block pl-1">Tarih</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-gray-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block pl-1">Kalkış Saati</label>
              <div className="relative">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-gray-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
                <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Route Builder */}
          <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
            <RouteBuilder 
              stops={stops}
              onChange={setStops}
              onMetricsChange={handleMetricsChange}
            />
          </div>

          {/* Calculated metrics results preview */}
          {stops.length >= 2 && (
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Mesafe</p>
                <p className="text-sm font-black text-gray-800 mt-1">{distanceKm} km</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Süre</p>
                <p className="text-sm font-black text-gray-800 mt-1">{durationMin} dk</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase">Tahmini Masraf</p>
                <p className="text-sm font-black text-emerald-700 mt-1">{estimatedCost} zł</p>
              </div>
            </div>
          )}

          {/* Max Passengers & Recurring options */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
              <div>
                <span className="text-xs font-bold text-gray-700">Maksimum Yolcu Sayısı</span>
                <p className="text-[10px] text-gray-400">Aracınızdaki boş koltuk sayısı</p>
              </div>
              <input
                type="number"
                min="1"
                max="8"
                value={maxPassengers}
                onChange={(e) => setMaxPassengers(Number(e.target.value))}
                className="w-16 bg-white border border-gray-200 rounded-lg py-1 px-2.5 text-xs text-center text-gray-800 focus:border-indigo-500 outline-none font-bold"
              />
            </div>

            {/* Repeating option */}
            <div className="border border-gray-100 p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-700">Yolculuğu Düzenli Tekrarla</span>
                  <p className="text-[10px] text-gray-400">Her gün tekrar oluşturmamak için günleri seçin</p>
                </div>
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="w-4.5 h-4.5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {recurring && (
                <div className="flex justify-between gap-1 pt-1">
                  {DAYS_LOOKUP.map((d) => {
                    const active = recurringDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleDay(d.num)}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                          active 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1 cursor-pointer"
          >
            {editingTrip ? 'Değişiklikleri Kaydet' : repeatingTrip ? 'Yolculuğu Tekrarla' : 'Yolculuk Başlat'}
          </button>
        </div>

      </div>
    </div>
  );
}
