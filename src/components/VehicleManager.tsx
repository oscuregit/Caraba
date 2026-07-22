import React, { useState } from 'react';
import { Vehicle, User } from '../types';
import { addVehicle, updateVehicle, deleteVehicle } from '../services/db';
import { useLanguage } from '../LanguageContext';
import { 
  Car, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Gauge, 
  Users, 
  Palette, 
  Fuel, 
  ShieldCheck, 
  Star,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface VehicleManagerProps {
  currentUser: User;
  vehicles: Vehicle[];
  onStartTripWithVehicle?: (vehicle: Vehicle) => void;
}

const PRESET_COLORS = [
  { name: 'Beyaz', hex: '#FFFFFF', border: 'border-slate-300', text: 'text-slate-800' },
  { name: 'Siyah', hex: '#1E293B', border: 'border-slate-800', text: 'text-white' },
  { name: 'Gri', hex: '#64748B', border: 'border-slate-500', text: 'text-white' },
  { name: 'Gümüş', hex: '#94A3B8', border: 'border-slate-400', text: 'text-slate-900' },
  { name: 'Kırmızı', hex: '#EF4444', border: 'border-red-500', text: 'text-white' },
  { name: 'Mavi', hex: '#3B82F6', border: 'border-blue-500', text: 'text-white' },
  { name: 'Lacivert', hex: '#1E3A8A', border: 'border-blue-900', text: 'text-white' },
  { name: 'Yeşil', hex: '#10B981', border: 'border-emerald-500', text: 'text-white' },
  { name: 'Sarı', hex: '#F59E0B', border: 'border-amber-500', text: 'text-slate-900' },
];

const FUEL_TYPES = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit'];

export default function VehicleManager({ currentUser, vehicles, onStartTripWithVehicle }: VehicleManagerProps) {
  const { t, language, currencySymbol } = useLanguage();
  
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form states
  const [makeModel, setMakeModel] = useState('');
  const [plate, setPlate] = useState('');
  const [fuelCostPerKm, setFuelCostPerKm] = useState<number>(3.5);
  const [seats, setSeats] = useState<number>(5);
  const [color, setColor] = useState('Beyaz');
  const [fuelType, setFuelType] = useState('Dizel');
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openNewVehicleModal = () => {
    setEditingVehicle(null);
    setMakeModel('');
    setPlate('');
    setFuelCostPerKm(3.5);
    setSeats(5);
    setColor('Beyaz');
    setFuelType('Dizel');
    setIsDefault(vehicles.length === 0);
    setError('');
    setShowModal(true);
  };

  const openEditVehicleModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setMakeModel(v.makeModel);
    setPlate(v.plate);
    setFuelCostPerKm(v.fuelCostPerKm);
    setSeats(v.seats);
    setColor(v.color || 'Beyaz');
    setFuelType(v.fuelType || 'Dizel');
    setIsDefault(!!v.isDefault);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!makeModel.trim()) {
      setError(language === 'en' ? 'Please enter make and model.' : 'Lütfen marka ve model bilgisini girin.');
      return;
    }
    if (!plate.trim()) {
      setError(language === 'en' ? 'Please enter vehicle license plate.' : 'Lütfen araç plakasını girin.');
      return;
    }
    if (fuelCostPerKm <= 0) {
      setError(language === 'en' ? 'Fuel cost per km must be greater than 0.' : 'Kilometre başı yakıt ücreti 0\'dan büyük olmalıdır.');
      return;
    }
    if (seats < 1) {
      setError(language === 'en' ? 'Vehicle seats must be at least 1.' : 'Araç koltuk sayısı en az 1 olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, {
          makeModel: makeModel.trim(),
          plate: plate.trim().toUpperCase(),
          fuelCostPerKm: Number(fuelCostPerKm),
          seats: Number(seats),
          color: color.trim(),
          fuelType,
          isDefault
        });
      } else {
        await addVehicle({
          userId: currentUser.uid,
          makeModel: makeModel.trim(),
          plate: plate.trim().toUpperCase(),
          fuelCostPerKm: Number(fuelCostPerKm),
          seats: Number(seats),
          color: color.trim(),
          fuelType,
          isDefault
        });
      }

      // If set as default, unset others
      if (isDefault) {
        const otherVehicles = vehicles.filter(v => v.id !== editingVehicle?.id && v.isDefault);
        for (const ov of otherVehicles) {
          await updateVehicle(ov.id, { isDefault: false });
        }
      }

      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError(language === 'en' ? 'Failed to save vehicle details.' : 'Araç kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(language === 'en' ? 'Are you sure you want to delete this vehicle?' : 'Bu aracı silmek istediğinizden emin misiniz?')) {
      try {
        await deleteVehicle(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSetDefault = async (v: Vehicle) => {
    try {
      await updateVehicle(v.id, { isDefault: true });
      for (const ov of vehicles) {
        if (ov.id !== v.id && ov.isDefault) {
          await updateVehicle(ov.id, { isDefault: false });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const defaultVehicle = vehicles.find(v => v.isDefault) || vehicles[0];

  return (
    <div className="space-y-6" id="vehicle-manager">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Car className="w-3.5 h-3.5 text-indigo-400" />
              {language === 'en' ? 'My Garages & Vehicles' : 'Araç Garajım & Filom'}
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-black tracking-tight text-white">
              {language === 'en' ? 'Vehicle & Fuel Expense Management' : 'Araçlarım ve Yakıt Ücretleri'}
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
              {language === 'en' 
                ? 'Register your vehicles, specify fuel cost per km, seat capacity, and vehicle color. When creating a new trip, select your vehicle to auto-calculate trip expenses.'
                : 'Sahip olduğunuz araçları ekleyin; kilometre başı yakıt ücretini, koltuk sayısını ve renk bilgilerini tanımlayın. Sefer oluştururken aracınızı seçerek yolculuk masrafını otomatik hesaplayın.'}
            </p>
          </div>

          <button
            onClick={openNewVehicleModal}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-display font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] shrink-0"
            id="add-vehicle-btn"
          >
            <Plus className="w-4 h-4" />
            {language === 'en' ? 'Add New Vehicle' : 'Yeni Araç Ekle'}
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{language === 'en' ? 'Registered Vehicles' : 'Kayıtlı Araç Sayısı'}</p>
              <p className="text-base font-black text-white">{vehicles.length} {language === 'en' ? 'Cars' : 'Araç'}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{language === 'en' ? 'Avg. Fuel Rate' : 'Ort. Km Başı Yakıt'}</p>
              <p className="text-base font-black text-emerald-300">
                {vehicles.length > 0 
                  ? (vehicles.reduce((acc, v) => acc + (v.fuelCostPerKm || 0), 0) / vehicles.length).toFixed(2) 
                  : '0.00'} {currencySymbol}/km
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase">{language === 'en' ? 'Primary Vehicle' : 'Varsayılan Araç'}</p>
              <p className="text-xs font-black text-white truncate">
                {defaultVehicle ? defaultVehicle.makeModel : (language === 'en' ? 'None' : 'Yok')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicles List Area */}
      {vehicles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">
              {language === 'en' ? 'No Vehicles Saved Yet' : 'Henüz Kayıtlı Bir Aracınız Yok'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'en'
                ? 'Add your vehicle to automatically calculate travel expenses based on fuel per km rate when starting new trips.'
                : 'Yolculuk başlatırken masrafların kilometre başı yakıt ücretinize göre otomatik hesaplanması için hemen ilk aracınızı ekleyin.'}
            </p>
          </div>
          <button
            onClick={openNewVehicleModal}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === 'en' ? 'Add My First Vehicle' : 'İlk Aracımı Ekle'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <div 
              key={v.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                v.isDefault ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'
              }`}
              id={`vehicle-card-${v.id}`}
            >
              {/* Default Tag */}
              {v.isDefault && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-white" />
                  {language === 'en' ? 'Primary' : 'Varsayılan'}
                </div>
              )}

              <div>
                {/* Vehicle Title & Plate */}
                <div className="flex items-start justify-between pr-16">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{v.makeModel}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{v.fuelType || 'Dizel'} Vehicle</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plate Badge */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="inline-flex items-center bg-slate-900 text-white rounded-lg px-2.5 py-1 font-mono font-bold text-xs tracking-wider border border-slate-700 shadow-sm">
                    <span className="text-[9px] text-blue-400 font-sans font-black mr-1.5 border-r border-slate-700 pr-1.5">TR</span>
                    {v.plate}
                  </div>

                  {/* Color pill */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold">
                    <span 
                      className="w-3 h-3 rounded-full border border-slate-400 shadow-xs" 
                      style={{ 
                        backgroundColor: PRESET_COLORS.find(c => c.name.toLowerCase() === (v.color || '').toLowerCase())?.hex || '#94A3B8' 
                      }}
                    />
                    <span>{v.color || 'Belirtilmedi'}</span>
                  </div>
                </div>

                {/* Specifications Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-xl">
                    <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-bold uppercase">
                      <Gauge className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Fuel Rate' : 'Km Ücreti'}</span>
                    </div>
                    <p className="text-sm font-black text-emerald-800 mt-0.5">
                      {v.fuelCostPerKm.toFixed(2)} <span className="text-[10px] font-normal text-emerald-600">{currencySymbol}/km</span>
                    </p>
                  </div>

                  <div className="bg-indigo-50/60 border border-indigo-100 p-2.5 rounded-xl">
                    <div className="flex items-center gap-1.5 text-indigo-700 text-[10px] font-bold uppercase">
                      <Users className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Seats' : 'Koltuk Sayısı'}</span>
                    </div>
                    <p className="text-sm font-black text-indigo-800 mt-0.5">
                      {v.seats} <span className="text-[10px] font-normal text-indigo-600">{language === 'en' ? 'Seats' : 'Kişilik'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {!v.isDefault && (
                    <button
                      onClick={() => handleSetDefault(v)}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all cursor-pointer"
                      title={language === 'en' ? 'Set as primary vehicle' : 'Varsayılan araç yap'}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditVehicleModal(v)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                    title={language === 'en' ? 'Edit vehicle' : 'Aracı düzenle'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                    title={language === 'en' ? 'Delete vehicle' : 'Aracı sil'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {onStartTripWithVehicle && (
                  <button
                    onClick={() => onStartTripWithVehicle(v)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>{language === 'en' ? 'Plan Trip' : 'Sefer Başlat'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT VEHICLE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="vehicle-form-modal">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingVehicle 
                    ? (language === 'en' ? 'Edit Vehicle Details' : 'Araç Bilgilerini Düzenle') 
                    : (language === 'en' ? 'Add New Vehicle' : 'Yeni Araç Ekle')}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Make & Model */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {language === 'en' ? 'Vehicle Make & Model' : 'Marka ve Model'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'en' ? 'e.g. Volkswagen Golf 1.6 TDI' : 'Örn: Renault Megane 1.5 dCi'}
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Plate & Fuel Type Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {language === 'en' ? 'License Plate' : 'Plaka'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="34 ABC 123"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    className="w-full text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {language === 'en' ? 'Fuel Type' : 'Yakıt Tipi'}
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    {FUEL_TYPES.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fuel Cost Per Km & Seats count */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {language === 'en' ? `Fuel Rate (${currencySymbol} / km)` : `Km Başı Yakıt (${currencySymbol})`}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={fuelCostPerKm}
                      onChange={(e) => setFuelCostPerKm(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-10 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {language === 'en' ? 'Total Seats' : 'Koltuk Sayısı'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="9"
                    required
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Vehicle Color Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {language === 'en' ? 'Vehicle Color' : 'Araç Rengi'}
                </label>
                
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => {
                    const selected = color.toLowerCase() === c.name.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColor(c.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          selected 
                            ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 text-indigo-900' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span 
                          className={`w-3 h-3 rounded-full border ${c.border}`} 
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.name}</span>
                        {selected && <Check className="w-3 h-3 text-indigo-600 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Is Default Checkbox */}
              <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 pt-3">
                <input
                  type="checkbox"
                  id="isDefaultVehicleCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="isDefaultVehicleCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  {language === 'en' ? 'Set as primary vehicle for trips' : 'Varsayılan aracım olarak işaretle'}
                </label>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer flex items-center gap-1"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {t('save')}
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
