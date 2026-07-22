import React, { useState } from 'react';
import { Trip, User } from '../types';
import { sendJoinRequest, manageJoinRequest, completeTrip, updateTrip, cancelJoinRequest, deleteTrip } from '../services/db';
import LocationShare from './LocationShare';
import { useLanguage } from '../LanguageContext';
import { 
  Car, 
  User as UserIcon, 
  Calendar, 
  Clock, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  UserCheck, 
  UserX, 
  Play, 
  CheckCircle, 
  Navigation,
  Edit2,
  RefreshCcw,
  Users,
  Info,
  MoreVertical,
  Trash2
} from 'lucide-react';

interface TripCardProps {
  trip: Trip;
  currentUser: User;
  allUsers: User[];
  onEdit: (trip: Trip) => void;
  onRepeat: (trip: Trip) => void;
}

export default function TripCard({ trip, currentUser, allUsers, onEdit, onRepeat }: TripCardProps) {
  const { currencySymbol } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [openDriveMode, setOpenDriveMode] = useState(false);

  const isDriver = trip.driverId === currentUser.uid;
  const isPassenger = trip.passengers?.includes(currentUser.uid);
  const myRequest = trip.requests?.find(r => r.userId === currentUser.uid);

  const totalPeople = (trip.passengers?.length || 0) + 1; // driver + passengers
  const splitCostPerPerson = parseFloat((trip.estimatedCost / totalPeople).toFixed(2));

  const handleJoinRequest = async () => {
    await sendJoinRequest(trip.id, {
      uid: currentUser.uid,
      name: currentUser.name,
      email: currentUser.email
    });
  };

  const handleCancelRequest = async () => {
    await cancelJoinRequest(trip.id, currentUser.uid);
  };

  const handleRequestAction = async (passengerId: string, approve: boolean) => {
    await manageJoinRequest(trip.id, passengerId, approve);
  };

  const handleStartTrip = async () => {
    if (trip.status === 'scheduled') {
      await updateTrip(trip.id, { status: 'active' });
    }
    setExpanded(true);
    setOpenDriveMode(true);
  };

  const handleCompleteTrip = async () => {
    await completeTrip(trip.id);
  };

  // Get user details for avatars
  const driverDetails = allUsers.find(u => u.uid === trip.driverId);

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden ${
        trip.status === 'completed' ? 'opacity-80' : ''
      }`}
      id={`trip-card-${trip.id}`}
    >
      {/* Primary Card Top Row */}
      <div className="p-4 flex items-start gap-3.5">
        
        {/* Driver Avatar */}
        <div className="relative">
          {driverDetails?.avatarUrl ? (
            <img 
              src={driverDetails.avatarUrl} 
              alt={trip.driverName} 
              className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">
              {driverDetails?.initials || trip.driverName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-lg text-white flex items-center justify-center border-2 border-white">
            <Car className="w-3 h-3" />
          </div>
        </div>

        {/* Core Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-display font-bold text-slate-800 truncate max-w-[150px]">{trip.title}</h4>
            
            {/* Status badges */}
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
              trip.status === 'scheduled' ? 'bg-indigo-50 text-indigo-600' :
              trip.status === 'active' ? 'bg-blue-100 text-blue-700 animate-pulse' :
              'bg-gray-100 text-gray-600'
            }`}>
              {trip.status === 'scheduled' ? 'Planlandı' :
               trip.status === 'active' ? 'Yolculuk Başladı' : 'Tamamlandı'}
            </span>

            {isDriver && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 uppercase">
                Sizinki
              </span>
            )}
          </div>

          <p className="text-[10px] text-gray-400 font-semibold">{trip.driverName} • Taşıyıcı</p>

          {trip.vehicleInfo && (
            <div className="inline-flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-700 mt-1">
              <Car className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-900">{trip.vehicleInfo.makeModel}</span>
              {trip.vehicleInfo.plate && (
                <span className="font-mono bg-slate-800 text-white px-1 py-0.2 rounded text-[8px] font-bold">
                  {trip.vehicleInfo.plate}
                </span>
              )}
              {trip.vehicleInfo.fuelCostPerKm && (
                <span className="text-[9px] text-emerald-700 font-semibold">
                  ({trip.vehicleInfo.fuelCostPerKm} {currencySymbol}/km)
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium pt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {trip.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {trip.time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              {trip.passengers?.length || 0}/{trip.maxPassengers} Koltuk Dolu
            </span>
          </div>
        </div>

        {/* Price Tag & Join Button */}
        <div className="text-right space-y-1.5 shrink-0">
          <p className="text-xs font-black text-indigo-600">
            {splitCostPerPerson.toFixed(2)} {currencySymbol} <span className="text-[9px] text-gray-400 font-medium">/ kişi</span>
          </p>
          <span className="text-[8px] text-gray-400 block">Toplam: {trip.estimatedCost} {currencySymbol}</span>
        </div>

        {/* Corner Dropdown Menu */}
        <div className="shrink-0 relative self-start -mt-1 -mr-1">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            id={`trip-menu-btn-${trip.id}`}
            title="Menüyü Aç"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowDeleteConfirm(false); }}></div>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-50 divide-y divide-slate-100 py-1 text-xs text-slate-700 animate-fadeIn">
                {isDriver ? (
                  <>
                    <button
                      onClick={() => {
                        onEdit(trip);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                      Düzenle
                    </button>

                    {trip.status === 'scheduled' && (
                      <button
                        onClick={() => {
                          handleStartTrip();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 text-blue-500" />
                        Yolculuğu Başlat
                      </button>
                    )}

                    {trip.status === 'active' && (
                      <button
                        onClick={() => {
                          handleCompleteTrip();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Yolculuğu Tamamla
                      </button>
                    )}

                    {trip.status === 'completed' && (
                      <button
                        onClick={() => {
                          onRepeat(trip);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <RefreshCcw className="w-3.5 h-3.5 text-indigo-500" />
                        Yolculuğu Tekrarla
                      </button>
                    )}

                    {!showDeleteConfirm ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 cursor-pointer text-red-600 transition-colors font-semibold"
                        id={`trip-delete-btn-${trip.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        Yolculuğu Sil / İptal Et
                      </button>
                    ) : (
                      <div className="p-3 bg-red-50 text-red-700 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] font-semibold">Silmek istediğinize emin misiniz?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await deleteTrip(trip.id);
                              setShowDeleteConfirm(false);
                              setShowMenu(false);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex-1 text-center"
                          >
                            Evet, Sil
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(false);
                            }}
                            className="bg-white border border-red-200 hover:bg-red-100 text-red-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex-1 text-center"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {trip.status === 'scheduled' && (
                      <>
                        {!myRequest && (
                          <button
                            onClick={() => {
                              handleJoinRequest();
                              setShowMenu(false);
                            }}
                            disabled={trip.passengers?.length >= trip.maxPassengers}
                            className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Navigation className="w-3.5 h-3.5 text-indigo-500" />
                            Yolculuğa Katıl
                          </button>
                        )}

                        {myRequest && (
                          <button
                            onClick={() => {
                              handleCancelRequest();
                              setShowMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-2 cursor-pointer text-rose-600"
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-500" />
                            Ayrıl / İsteği İptal Et
                          </button>
                        )}
                      </>
                    )}
                    <div className="px-4 py-1.5 text-[10px] text-gray-400 bg-slate-50">
                      Sürücü: {trip.driverName}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Styled Route stops preview inside card */}
      <div className="px-4 pb-3">
        <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
          {trip.stops?.slice(0, 3).map((stop, idx) => (
            <div key={stop.id} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full border-2 bg-white flex items-center justify-center shrink-0 ${
                stop.type === 'start' ? 'border-green-500' : stop.type === 'end' ? 'border-indigo-600' : 'border-amber-500'
              }`}>
                <div className={`w-1 h-1 rounded-full ${
                  stop.type === 'start' ? 'bg-green-500' : stop.type === 'end' ? 'bg-indigo-600' : 'bg-amber-500'
                }`}></div>
              </div>
              <p className="text-[10px] text-gray-700 font-medium truncate flex-1">{stop.address}</p>
            </div>
          ))}
          {trip.stops && trip.stops.length > 3 && (
            <p className="text-[9px] text-indigo-600 font-semibold pl-4">
              + {trip.stops.length - 3} durak daha...
            </p>
          )}
        </div>
      </div>

      {/* Action panel */}
      <div className="px-4 pb-4 flex items-center justify-between gap-2.5 border-t border-gray-50 pt-3">
        
        {/* Toggle Expand Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
        >
          {expanded ? (
            <>Detayları Gizle <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Detayları Gör <ChevronDown className="w-4 h-4" /></>
          )}
        </button>

        {/* Main Action based on driver / passenger status */}
        <div className="flex gap-2">
          
          {isDriver ? (
            // Driver actions
            <>
              {trip.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => onEdit(trip)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                    title="Yolculuğu Düzenle"
                    id={`edit-trip-btn-${trip.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleStartTrip}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer shadow-indigo-100"
                    id={`start-trip-btn-${trip.id}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-white" /> Yolculuğa Başla
                  </button>
                </>
              )}

              {trip.status === 'active' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartTrip}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer shadow-indigo-100 animate-pulse"
                    id={`start-drive-btn-${trip.id}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-white" /> Yolculuğa Başla
                  </button>
                  <button
                    onClick={handleCompleteTrip}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                    id={`complete-trip-btn-${trip.id}`}
                    title="Yolculuğu Tamamla"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Tamamla
                  </button>
                </div>
              )}

              {trip.status === 'completed' && (
                <button
                  onClick={() => onRepeat(trip)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  id={`repeat-trip-btn-${trip.id}`}
                >
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" /> Tekrarla
                </button>
              )}
            </>
          ) : (
            // Passenger actions
            <>
              {trip.status === 'scheduled' && (
                <>
                  {!myRequest && (
                    <button
                      onClick={handleJoinRequest}
                      disabled={trip.passengers?.length >= trip.maxPassengers}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-[10px] px-4 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-indigo-100"
                      id={`join-request-btn-${trip.id}`}
                    >
                      <Navigation className="w-3.5 h-3.5" /> Yolculuğa Katıl
                    </button>
                  )}

                  {myRequest && myRequest.status === 'pending' && (
                    <div className="flex items-center gap-1.5" id={`pending-req-container-${trip.id}`}>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                        Onay Bekliyor
                      </span>
                      <button
                        onClick={handleCancelRequest}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[10px] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center"
                        id={`cancel-request-btn-${trip.id}`}
                        title="Katılım İsteğini İptal Et"
                      >
                        İptal Et
                      </button>
                    </div>
                  )}

                  {myRequest && myRequest.status === 'approved' && (
                    <div className="flex items-center gap-1.5" id={`approved-req-container-${trip.id}`}>
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Katılıyorsunuz
                      </span>
                      <button
                        onClick={handleCancelRequest}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[10px] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center"
                        id={`leave-trip-btn-${trip.id}`}
                        title="Yolculuktan Ayrıl"
                      >
                        Ayrıl
                      </button>
                    </div>
                  )}

                  {myRequest && myRequest.status === 'rejected' && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                      Reddedildi
                    </span>
                  )}
                </>
              )}

              {trip.status === 'active' && isPassenger && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl animate-pulse">
                  Yoldasınız
                </span>
              )}
            </>
          )}

        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-gray-50 bg-slate-50/50 p-4 space-y-4 animate-slideDown">
          
          {/* Stops Timeline */}
          <div className="space-y-2.5">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Tüm Duraklar</h5>
            <div className="relative pl-3 space-y-2">
              <div className="absolute left-4.5 top-2 bottom-2 w-0.5 bg-gray-200"></div>
              {trip.stops?.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-2 relative">
                  <div className={`w-3 h-3 rounded-full border-2 bg-white flex items-center justify-center z-10 shrink-0 ${
                    stop.type === 'start' ? 'border-green-500' : stop.type === 'end' ? 'border-indigo-600' : 'border-amber-500'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${
                      stop.type === 'start' ? 'bg-green-500' : stop.type === 'end' ? 'bg-indigo-600' : 'bg-amber-500'
                    }`}></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-800 font-medium truncate">{stop.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Splitting Detail */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-100 space-y-2">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              Detaylı Masraf Bölüşüm Tablosu
            </h5>
            <div className="space-y-1.5 text-xs text-gray-600 font-medium">
              <div className="flex justify-between">
                <span>Yol Mesafesi / Süre</span>
                <span className="text-gray-800">{trip.distanceKm} km / {trip.durationMin} dk</span>
              </div>
              <div className="flex justify-between">
                <span>Toplam Araç Masrafı</span>
                <span className="text-gray-800">{trip.estimatedCost} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span>Kişi Sayısı (Taşıyıcı + Onaylı Yolcular)</span>
                <span className="text-gray-800">{totalPeople} Kişi</span>
              </div>
              <div className="border-t border-dashed border-gray-100 pt-1.5 flex justify-between font-black text-indigo-700">
                <span>Kişi Başına Düşen Masraf</span>
                <span>{trip.estimatedCost} / {totalPeople} = {splitCostPerPerson.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>
          </div>

          {/* Pending Requests for Driver */}
          {isDriver && trip.requests && trip.requests.some(r => r.status === 'pending') && (
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Katılma İstekleri</h5>
              <div className="space-y-2">
                {trip.requests.filter(r => r.status === 'pending').map((req) => (
                  <div 
                    key={req.userId} 
                    className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-sm"
                    id={`join-request-item-${req.userId}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{req.userName}</p>
                      <p className="text-[9px] text-gray-400 truncate mt-0.5">{req.userEmail}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRequestAction(req.userId, false)}
                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                        title="Reddet"
                        id={`reject-btn-${req.userId}`}
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRequestAction(req.userId, true)}
                        className="p-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold text-[10px] px-2.5 py-1.5"
                        id={`approve-btn-${req.userId}`}
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Onayla
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live location share directly inside card details */}
          {(trip.status === 'active' || trip.status === 'scheduled') && (isDriver || isPassenger) && (
            <LocationShare 
              trip={trip} 
              currentUser={currentUser} 
              autoOpenDriveMode={openDriveMode} 
              onCloseDriveMode={() => setOpenDriveMode(false)} 
            />
          )}

        </div>
      )}

    </div>
  );
}
