import React, { useState } from 'react';
import { User } from '../types';
import { updateUser, deleteUserAccount } from '../services/db';
import { 
  X, 
  Settings, 
  User as UserIcon, 
  Globe, 
  Sun, 
  Moon, 
  Trash2, 
  Save, 
  Check, 
  AlertTriangle,
  Mail
} from 'lucide-react';

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export default function SettingsModal({
  currentUser,
  onClose,
  currentTheme,
  onThemeChange,
  currentLanguage,
  onLanguageChange
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'app' | 'user'>('app');
  
  // User settings state
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [savingUser, setSavingUser] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [userErrorMsg, setUserErrorMsg] = useState('');

  // Delete account confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSuccessMsg('');
    setUserErrorMsg('');

    if (!name.trim() || !email.trim()) {
      setUserErrorMsg('Ad Soyad ve E-posta alanları boş bırakılamaz.');
      return;
    }

    setSavingUser(true);
    try {
      const initials = name
        .split(' ')
        .map(part => part.slice(0, 1).toUpperCase())
        .join('')
        .slice(0, 2);

      await updateUser(currentUser.uid, {
        name: name.trim(),
        email: email.trim(),
        initials
      });
      setUserSuccessMsg('Kullanıcı bilgileriniz başarıyla güncellendi.');
    } catch (err: any) {
      console.error(err);
      setUserErrorMsg('Güncelleme sırasında bir hata oluştu: ' + (err.message || err));
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SİL') {
      setUserErrorMsg('Onaylamak için büyük harflerle SİL yazmalısınız.');
      return;
    }

    setDeleting(true);
    setUserErrorMsg('');
    try {
      await deleteUserAccount(currentUser.uid);
      onClose();
    } catch (err: any) {
      console.error(err);
      setUserErrorMsg('Hesap silinirken bir hata oluştu: ' + (err.message || err));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" id="settings-modal-overlay">
      <div 
        className={`w-full max-w-lg rounded-3xl border overflow-hidden shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh] ${
          currentTheme === 'dark' 
            ? 'bg-slate-900 border-slate-800 text-slate-100' 
            : 'bg-white border-slate-100 text-slate-800'
        }`}
        id="settings-modal-card"
      >
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          currentTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              currentTheme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Settings className="w-4.5 h-4.5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold">Ayarlar</h2>
              <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Caraba Tercihleri</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-all hover:scale-105 ${
              currentTheme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'
            }`}
            id="close-settings-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`flex border-b text-xs font-bold ${
          currentTheme === 'dark' ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <button
            onClick={() => setActiveTab('app')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all relative ${
              activeTab === 'app'
                ? 'text-indigo-600'
                : 'text-gray-400 hover:text-gray-500'
            }`}
            id="tab-app-settings-btn"
          >
            <Globe className="w-4 h-4" />
            Uygulama Ayarları
            {activeTab === 'app' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all relative ${
              activeTab === 'user'
                ? 'text-indigo-600'
                : 'text-gray-400 hover:text-gray-500'
            }`}
            id="tab-user-settings-btn"
          >
            <UserIcon className="w-4 h-4" />
            Kullanıcı Ayarları
            {activeTab === 'user' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {userErrorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <span>{userErrorMsg}</span>
            </div>
          )}

          {userSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4.5 h-4.5 shrink-0" />
              <span>{userSuccessMsg}</span>
            </div>
          )}

          {/* TAB 1: Uygulama Ayarları */}
          {activeTab === 'app' && (
            <div className="space-y-6" id="app-settings-container">
              
              {/* Language Selection */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Dil Seçeneği (Language)</label>
                <div className="relative">
                  <select
                    value={currentLanguage}
                    onChange={(e) => {
                      onLanguageChange(e.target.value);
                      setUserSuccessMsg('Dil tercihi güncellendi.');
                    }}
                    className={`w-full text-xs rounded-xl py-3 px-3.5 outline-none border transition-all appearance-none cursor-pointer font-medium ${
                      currentTheme === 'dark' 
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                        : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500'
                    }`}
                    id="language-select-dropdown"
                  >
                    <option value="tr">Türkçe (TR)</option>
                    <option value="en">English (EN)</option>
                  </select>
                  <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Theme Selection Toggle */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Görünüm Modu</label>
                <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                  currentTheme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {currentTheme === 'dark' ? (
                      <Moon className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-xs font-bold">{currentTheme === 'dark' ? 'Karanlık Mod Açık' : 'Aydınlık Mod Açık'}</p>
                      <span className="text-[10px] text-gray-400">Arayüz renklerini değiştirin</span>
                    </div>
                  </div>

                  {/* Switch toggle container */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                      onThemeChange(nextTheme);
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer outline-none relative ${
                      currentTheme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                    id="theme-switch-toggle-btn"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                      currentTheme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border text-[10px] leading-relaxed text-slate-400 ${
                currentTheme === 'dark' ? 'bg-slate-950/20 border-slate-800/80' : 'bg-slate-50 border-slate-100'
              }`}>
                💡 <b>Caraba Bilgilendirme:</b> Uygulama ayarlarınız tarayıcı önbelleğinizde saklanır ve uygulamayı her açtığınızda otomatik olarak uygulanır.
              </div>
            </div>
          )}

          {/* TAB 2: Kullanıcı Ayarları */}
          {activeTab === 'user' && (
            <div className="space-y-6" id="user-settings-container">
              {!showDeleteConfirm ? (
                <form onSubmit={handleSaveUser} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Kullanıcı Adı</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ad Soyad"
                        className={`w-full text-xs rounded-xl py-3 px-3.5 outline-none border transition-all ${
                          currentTheme === 'dark' 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500'
                        }`}
                        required
                      />
                      <div className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Kayıtlı E-posta Adresi</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-posta adresi"
                        className={`w-full text-xs rounded-xl py-3 px-3.5 outline-none border transition-all ${
                          currentTheme === 'dark' 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500'
                        }`}
                        required
                      />
                      <div className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                      id="save-user-profile-btn"
                    >
                      {savingUser ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Değişiklikleri Kaydet
                        </>
                      )}
                    </button>
                  </div>

                  <div className={`border-t my-4 pt-4 ${
                    currentTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
                  }`}>
                    <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest pl-0.5 mb-2.5">Tehlikeli Bölge (Danger Zone)</h4>
                    <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-rose-600">Hesabı Sil</p>
                        <p className="text-[10px] text-gray-400 leading-normal mt-0.5 max-w-sm">
                          Hesabınızı sildiğinizde profil bilgileriniz, arkadaşlık ilişkileriniz ve seyahat verileriniz kalıcı olarak kaldırılır.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setUserSuccessMsg('');
                          setUserErrorMsg('');
                        }}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center"
                        id="show-delete-confirm-btn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hesabımı Kaldır
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Delete account confirmation box */
                <div className="space-y-4 bg-rose-500/5 border border-rose-500/20 p-5 rounded-2xl animate-scaleUp">
                  <div className="flex items-center gap-2.5 text-rose-500">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-600">Hesabınızı silmek istediğinize emin misiniz?</h4>
                      <p className="text-[9px] text-gray-400">Bu işlem kalıcıdır ve geri alınamaz.</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    İşlemi onaylamak için lütfen aşağıdaki kutuya büyük harflerle <span className="font-bold text-rose-600">SİL</span> yazın.
                  </p>

                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="SİL"
                    className="w-full text-xs font-bold bg-white text-gray-800 border border-rose-200 focus:border-rose-500 outline-none rounded-xl py-2.5 px-3.5 text-center shadow-inner tracking-widest"
                  />

                  <div className="flex justify-end gap-2.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className={`px-3.5 py-2 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                        currentTheme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-gray-100'
                      }`}
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteConfirmText !== 'SİL'}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800 text-white text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-600/10"
                      id="confirm-delete-account-btn"
                    >
                      {deleting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Hesabımı Kalıcı Olarak Sil
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
