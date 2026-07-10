import React, { useState, useEffect } from 'react';
import { User, BuddyRequest } from '../types';
import { 
  removeBuddy, 
  updateUser, 
  createCustomUser, 
  subscribeToBuddyRequests, 
  sendBuddyRequest, 
  acceptBuddyRequest, 
  deleteBuddyRequest 
} from '../services/db';
import { 
  UserPlus, 
  UserMinus, 
  Search, 
  Mail, 
  Heart, 
  Sparkles, 
  Edit2, 
  Save, 
  X, 
  Plus, 
  Check, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle 
} from 'lucide-react';

interface BuddySelectorProps {
  currentUser: User;
  allUsers: User[];
}

export default function BuddySelector({ currentUser, allUsers }: BuddySelectorProps) {
  const [activeSubTab, setActiveSubTab] = useState<'approved' | 'pending' | 'add'>('approved');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time buddy requests
  const [buddyRequests, setBuddyRequests] = useState<BuddyRequest[]>([]);
  
  // State for editing buddy details
  const [editingBuddyId, setEditingBuddyId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // State for creating new custom buddy
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Subscribe to buddy requests in real-time
  useEffect(() => {
    const unsubscribe = subscribeToBuddyRequests(currentUser.uid, (reqs) => {
      setBuddyRequests(reqs);
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // Clear messages when tab changes
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
  }, [activeSubTab]);

  // --- BUDDY CLASSIFICATION LOGIC ---
  const userBuddies = currentUser.buddies || [];
  
  const pendingOutgoing = buddyRequests.filter(r => r.fromId === currentUser.uid && r.status === 'pending');
  const pendingIncoming = buddyRequests.filter(r => r.toId === currentUser.uid && r.status === 'pending');
  const acceptedRequests = buddyRequests.filter(r => r.status === 'accepted');

  // Approved Buddies List:
  // 1. Custom buddies (UID starting with 'custom_')
  // 2. Real users with whom we have an accepted request
  // 3. Real users already in our 'buddies' array that don't have any pending request (backward compatibility)
  const approvedBuddiesList = allUsers.filter(u => {
    if (u.uid === currentUser.uid) return false;
    
    if (u.uid.startsWith('custom_') && userBuddies.includes(u.uid)) return true;

    const hasAcceptedReq = acceptedRequests.some(r => 
      (r.fromId === currentUser.uid && r.toId === u.uid) || 
      (r.fromId === u.uid && r.toId === currentUser.uid)
    );
    if (hasAcceptedReq) return true;

    const isUserBuddy = userBuddies.includes(u.uid);
    const hasPendingReq = buddyRequests.some(r => 
      r.status === 'pending' && 
      ((r.fromId === currentUser.uid && r.toId === u.uid) || 
       (r.fromId === u.uid && r.toId === currentUser.uid))
    );
    if (isUserBuddy && !hasPendingReq) return true;

    return false;
  });

  // Outgoing Pending (Sent Requests)
  const outgoingPendingUsers = allUsers.filter(u => 
    pendingOutgoing.some(r => r.toId === u.uid)
  ).map(u => ({
    user: u,
    requestId: pendingOutgoing.find(r => r.toId === u.uid)?.id || ''
  }));

  // Incoming Pending (Received Requests)
  const incomingPendingUsers = allUsers.filter(u => 
    pendingIncoming.some(r => r.fromId === u.uid)
  ).map(u => ({
    user: u,
    requestId: pendingIncoming.find(r => r.fromId === u.uid)?.id || ''
  }));

  // Coworkers Search Pool: All registered users EXCEPT:
  // - current user
  // - already approved buddies
  // - outgoing pending
  // - incoming pending
  const searchPool = allUsers.filter(u => {
    if (u.uid === currentUser.uid) return false;
    
    const isApproved = approvedBuddiesList.some(ab => ab.uid === u.uid);
    if (isApproved) return false;

    const isPendingOutgoing = outgoingPendingUsers.some(op => op.user.uid === u.uid);
    if (isPendingOutgoing) return false;

    const isPendingIncoming = incomingPendingUsers.some(ip => ip.user.uid === u.uid);
    if (isPendingIncoming) return false;

    return true;
  });

  // Filtered list based on active search typing
  const searchedCoworkers = searchQuery.trim() === '' 
    ? [] 
    : searchPool.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // --- ACTIONS ---

  const handleSendRequest = async (targetUserId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const targetUser = allUsers.find(u => u.uid === targetUserId);
    if (!targetUser) return;

    await sendBuddyRequest(currentUser.uid, targetUserId, currentUser.name);
    setSuccessMsg(`${targetUser.name} kullanıcısına yol arkadaşlığı isteği gönderildi.`);
  };

  const handleAccept = async (reqId: string, fromId: string, fromName: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    await acceptBuddyRequest(reqId, fromId, currentUser.uid, currentUser.name);
    setSuccessMsg(`${fromName} ile artık yol arkadaşısınız!`);
  };

  const handleReject = async (reqId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    await deleteBuddyRequest(reqId);
    setSuccessMsg('Talep reddedildi.');
  };

  const handleCancel = async (reqId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    await deleteBuddyRequest(reqId);
    setSuccessMsg('Onay talebi iptal edildi.');
  };

  const handleRemove = async (buddyId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const buddy = allUsers.find(u => u.uid === buddyId);
    await removeBuddy(currentUser.uid, buddyId);
    if (buddy) {
      setSuccessMsg(`${buddy.name} yol arkadaşlarınızdan çıkarıldı.`);
    }
  };

  const startEditing = (buddy: User) => {
    setEditingBuddyId(buddy.uid);
    setEditName(buddy.name);
    setEditEmail(buddy.email);
  };

  const cancelEditing = () => {
    setEditingBuddyId(null);
    setEditName('');
    setEditEmail('');
  };

  const handleSaveEdit = async (buddyId: string) => {
    if (!editName.trim() || !editEmail.trim()) {
      setErrorMsg('İsim ve e-posta alanları boş bırakılamaz.');
      return;
    }
    const initials = editName
      .split(' ')
      .map(part => part.slice(0, 1).toUpperCase())
      .join('')
      .slice(0, 2);

    await updateUser(buddyId, {
      name: editName.trim(),
      email: editEmail.trim(),
      initials
    });
    setEditingBuddyId(null);
    setErrorMsg('');
    setSuccessMsg('Arkadaş bilgileri güncellendi.');
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!customName.trim() || !customEmail.trim()) {
      setErrorMsg('Lütfen tüm alanları doldurun.');
      return;
    }
    
    // Check if the email already exists in the system to decide between request or custom
    const existingUser = allUsers.find(u => u.email.toLowerCase() === customEmail.trim().toLowerCase());
    if (existingUser) {
      if (existingUser.uid === currentUser.uid) {
        setErrorMsg('Kendinizi yol arkadaşı olarak ekleyemezsiniz.');
        return;
      }

      // Check if already approved or pending
      const isApproved = approvedBuddiesList.some(ab => ab.uid === existingUser.uid);
      if (isApproved) {
        setErrorMsg('Bu kişi zaten yol arkadaşlarınız arasında.');
        return;
      }

      const isPending = outgoingPendingUsers.some(op => op.user.uid === existingUser.uid) ||
                        incomingPendingUsers.some(ip => ip.user.uid === existingUser.uid);
      if (isPending) {
        setErrorMsg('Bu kişiyle zaten bekleyen bir onay talebiniz bulunuyor.');
        return;
      }

      // Automatically send a real buddy request!
      await sendBuddyRequest(currentUser.uid, existingUser.uid, currentUser.name);
      setSuccessMsg(`${existingUser.name} sistemde kayıtlı olduğu için kendisine onay talebi gönderildi.`);
      setCustomName('');
      setCustomEmail('');
      setShowAddCustom(false);
      setActiveSubTab('pending');
      return;
    }

    // Email is truly custom, create custom buddy
    await createCustomUser(currentUser.uid, customName.trim(), customEmail.trim());
    setSuccessMsg('Yeni arkadaş listenize eklendi.');
    setCustomName('');
    setCustomEmail('');
    setShowAddCustom(false);
  };

  return (
    <div className="space-y-4" id="buddy-selector">
      
      {/* Intro section */}
      <div className="bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full w-max text-[10px] font-bold tracking-wider uppercase">
            <Sparkles className="w-3 h-3" /> Yol Arkadaşlarım
          </div>
          <h3 className="text-sm font-display font-bold pt-1">İş Yeri Yolculuk Grubu</h3>
          <p className="text-[11px] text-indigo-100 leading-relaxed">
            Yol arkadaşlarınızı yönetin, yeni çalışma arkadaşları ekleyin ve onay bekleyen talepleri inceleyin.
          </p>
        </div>
      </div>

      {/* Global Action feedback messages */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-xl flex items-start gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Custom Tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('approved')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            activeSubTab === 'approved' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
          id="tab-approved-buddies"
        >
          <Heart className="w-3.5 h-3.5" />
          Yoldaşlarım ({approvedBuddiesList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('pending')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all relative cursor-pointer ${
            activeSubTab === 'pending' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
          id="tab-pending-buddies"
        >
          <Clock className="w-3.5 h-3.5" />
          Onay Bekleyenler
          {(incomingPendingUsers.length + outgoingPendingUsers.length) > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
              {incomingPendingUsers.length + outgoingPendingUsers.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('add')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            activeSubTab === 'add' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
          id="tab-find-buddies"
        >
          <Search className="w-3.5 h-3.5" />
          Bul & Ekle
        </button>
      </div>

      {/* TAB CONTENT 1: YOLDAŞLARIM (APPROVED) */}
      {activeSubTab === 'approved' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h4 className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider">
              Aktif Yol Arkadaşlarım ({approvedBuddiesList.length})
            </h4>
            <button
              type="button"
              onClick={() => {
                setShowAddCustom(!showAddCustom);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
              id="toggle-add-custom-buddy-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Arkadaş Oluştur
            </button>
          </div>

          {/* Create Custom Friend Form */}
          {showAddCustom && (
            <form onSubmit={handleCreateCustom} className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3 shadow-inner animate-fadeIn" id="create-custom-buddy-form">
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Yeni Yol Arkadaşı Bilgileri</span>
                <button 
                  type="button" 
                  onClick={() => setShowAddCustom(false)} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">AD SOYAD</label>
                  <input
                    type="text"
                    placeholder="Örn. Mehmet Yılmaz"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-xl py-2 px-3 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">E-POSTA ADRESİ</label>
                  <input
                    type="email"
                    placeholder="Örn. mehmet@firma.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-xl py-2 px-3 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  Arkadaşı Kaydet
                </button>
              </div>
            </form>
          )}

          {approvedBuddiesList.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Henüz yol arkadaşı eklemediniz.</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                "Bul & Ekle" sekmesini kullanarak çalışma arkadaşlarınızı arayabilir veya sağ üstteki "Yeni Arkadaş Oluştur" butonundan manuel ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {approvedBuddiesList.map((buddy) => {
                const isEditing = editingBuddyId === buddy.uid;
                if (isEditing) {
                  return (
                    <div 
                      key={buddy.uid} 
                      className="bg-slate-50 p-3 rounded-2xl border border-indigo-200 shadow-sm flex flex-col gap-2 animate-fadeIn"
                      id={`buddy-edit-${buddy.uid}`}
                    >
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100/60">
                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Arkadaş Bilgilerini Düzenle</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">İSİM SOYİSİM</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-xs bg-white border border-gray-200 rounded-xl py-1.5 px-2.5 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">E-POSTA</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full text-xs bg-white border border-gray-200 rounded-xl py-1.5 px-2.5 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Vazgeç
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(buddy.uid)}
                          className="px-3 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          id={`save-edit-btn-${buddy.uid}`}
                        >
                          <Save className="w-3 h-3" /> Kaydet
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={buddy.uid} 
                    className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 transition-all"
                    id={`buddy-item-${buddy.uid}`}
                  >
                    {/* Avatar / Initials */}
                    <div className="relative">
                      {buddy.avatarUrl ? (
                        <img 
                          src={buddy.avatarUrl} 
                          alt={buddy.name} 
                          className="w-9 h-9 rounded-full object-cover border border-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center">
                          {buddy.initials || buddy.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
                    </div>

                    {/* Buddy Info */}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[11px] font-semibold text-gray-800 truncate">{buddy.name}</h5>
                      <span className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="w-2.5 h-2.5" />
                        {buddy.email}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(buddy)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                        title="Bilgileri Düzenle"
                        id={`edit-buddy-btn-${buddy.uid}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(buddy.uid)}
                        className="px-2 py-1 text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                        title="Yol arkadaşlığından çıkar"
                        id={`remove-buddy-btn-${buddy.uid}`}
                      >
                        <UserMinus className="w-3 h-3" />
                        Çıkar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: ONAY BEKLEYENLER (PENDING) */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          
          {/* Incoming Requests */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider pl-1">
              Gelen Onay Talepleri ({incomingPendingUsers.length})
            </h4>
            
            {incomingPendingUsers.length === 0 ? (
              <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-[10px] text-slate-400 italic">
                Bekleyen gelen onay talebi bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {incomingPendingUsers.map(({ user, requestId }) => (
                  <div 
                    key={user.uid} 
                    className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm"
                    id={`incoming-req-${user.uid}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {user.initials || user.name.slice(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[11px] font-semibold text-gray-800 truncate">{user.name}</h5>
                      <p className="text-[9px] text-amber-600 font-medium mt-0.5">Size onay talebi gönderdi</p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAccept(requestId, user.uid, user.name)}
                        className="px-2.5 py-1 text-[9px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                      >
                        <Check className="w-3 h-3" /> Kabul Et
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(requestId)}
                        className="px-2 py-1 text-[9px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <X className="w-3 h-3" /> Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="space-y-2 pt-1">
            <h4 className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider pl-1">
              Giden Onay Talepleri ({outgoingPendingUsers.length})
            </h4>
            
            {outgoingPendingUsers.length === 0 ? (
              <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-[10px] text-slate-400 italic">
                Bekleyen giden onay talebi bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {outgoingPendingUsers.map(({ user, requestId }) => (
                  <div 
                    key={user.uid} 
                    className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm opacity-90"
                    id={`outgoing-req-${user.uid}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-150 text-slate-500 font-bold text-xs flex items-center justify-center shrink-0">
                      {user.initials || user.name.slice(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[11px] font-semibold text-gray-800 truncate">{user.name}</h5>
                      <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-indigo-400 animate-spin-slow" />
                        Onay Bekleniyor...
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancel(requestId)}
                      className="px-2 py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                    >
                      İptal Et
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT 3: BUL & EKLE (SEARCH & ADD) */}
      {activeSubTab === 'add' && (
        <div className="space-y-3">
          
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Çalışma arkadaşınızın ismi veya e-postası..."
              className="w-full text-xs bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm"
              id="search-coworkers-input"
            />
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
          </div>

          {searchQuery.trim() === '' ? (
            <div className="text-center py-8 bg-slate-50/40 rounded-2xl border border-slate-100 p-5">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 font-medium">Arkadaş Aramaya Başlayın</p>
              <p className="text-[9px] text-slate-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
                Kayıtlı çalışma arkadaşlarınızı bulup onay talebi göndermek için yukarıdaki kutuyu kullanın.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider pl-1">
                Arama Sonuçları ({searchedCoworkers.length})
              </h4>
              
              {searchedCoworkers.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-gray-50 text-xs text-gray-400 font-medium">
                  Kriterlere uygun yeni çalışma arkadaşı bulunamadı.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {searchedCoworkers.map((user) => (
                    <div 
                      key={user.uid}
                      className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-gray-50 shadow-sm"
                      id={`dir-user-item-${user.uid}`}
                    >
                      {/* Avatar */}
                      {user.avatarUrl ? (
                        <img 
                          src={user.avatarUrl} 
                          alt={user.name} 
                          className="w-9 h-9 rounded-full object-cover border border-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 text-gray-600 font-semibold text-xs flex items-center justify-center shrink-0">
                          {user.initials || user.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-[11px] font-semibold text-gray-800 truncate">{user.name}</h5>
                        <span className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="w-2.5 h-2.5" />
                          {user.email}
                        </span>
                      </div>

                      {/* Add Action */}
                      <button
                        type="button"
                        onClick={() => handleSendRequest(user.uid)}
                        className="px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100/50 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        id={`dir-add-btn-${user.uid}`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Ekle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
