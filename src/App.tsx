import React, { useState, useEffect } from 'react';
import { 
  subscribeToUsers, 
  subscribeToTrips, 
  subscribeToFinances, 
  subscribeToNotifications, 
  subscribeToVehicles,
  seedMockUsers, 
  DEFAULT_USERS,
  markNotificationAsRead,
  registerNewUser,
  loginUser,
  logOutUser,
  getUserDoc,
  signInWithGoogle,
  cancelJoinRequest,
  subscribeToBuddyRequests
} from './services/db';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, initError } from './firebase';
import { User, Trip, FinanceTransaction, RealtimeNotification, BuddyRequest, Vehicle } from './types';
import TripCard from './components/TripCard';
import TripForm from './components/TripForm';
import BuddySelector from './components/BuddySelector';
import FinanceSummary from './components/FinanceSummary';
import VehicleManager from './components/VehicleManager';
import SettingsModal from './components/SettingsModal';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { 
  Car, 
  Users, 
  DollarSign, 
  Bell, 
  Plus, 
  Settings, 
  LogOut, 
  LogIn, 
  Shield, 
  Check, 
  Sparkles,
  ChevronDown,
  Gauge
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('language') || 'tr';
  });

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <LanguageProvider currentLang={language} onLangChange={handleLanguageChange}>
      <MainAppContent 
        theme={theme} 
        onThemeChange={handleThemeChange} 
        language={language} 
        onLanguageChange={handleLanguageChange} 
      />
    </LanguageProvider>
  );
}

function MainAppContent({ theme, onThemeChange, language, onLanguageChange }: {
  theme: 'light' | 'dark';
  onThemeChange: (newTheme: 'light' | 'dark') => void;
  language: string;
  onLanguageChange: (newLang: string) => void;
}) {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [buddyRequests, setBuddyRequests] = useState<BuddyRequest[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Layout View Tabs
  const [activeTab, setActiveTab] = useState<'trips' | 'vehicles' | 'buddies' | 'finances'>('trips');
  const [tripSubTab, setTripSubTab] = useState<'active' | 'scheduled' | 'completed'>('active');
  
  // Modals state
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>(undefined);
  const [repeatingTrip, setRepeatingTrip] = useState<Trip | undefined>(undefined);
  const [preselectedVehicleId, setPreselectedVehicleId] = useState<string | undefined>(undefined);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Real Auth state
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [firebaseInitError, setFirebaseInitError] = useState<Error | null>(initError);

  // Initialize and listen to real auth state
  useEffect(() => {
    if (initError) {
      setAuthLoading(false);
      return;
    }

    const initializeApp = async () => {
      // Seed default user documents in the background if they do not exist
      try {
        await seedMockUsers();
      } catch (err) {
        console.error("Mock users seeding issue (optional):", err);
      }
    };
    initializeApp();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getUserDoc(firebaseUser.uid);
          if (userDoc) {
            setCurrentUser(userDoc);
          } else {
            // Document might not be created yet, construct a fallback
            const initials = (firebaseUser.displayName || firebaseUser.email || 'YA')
              .split(' ')
              .map(part => part.slice(0, 1).toUpperCase())
              .join('')
              .slice(0, 2);
            setCurrentUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Kullanıcı',
              email: firebaseUser.email || '',
              buddies: [],
              initials
            });
          }
        } catch (e) {
          console.error("Error setting current user details:", e);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    }, (error) => {
      console.error("Auth state observation error:", error);
      if (error.message.includes('invalid-api-key') || error.message.includes('API key') || error.message.includes('invalid api key')) {
        setFirebaseInitError(error);
      } else {
        setAuthError(error.message);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore real-time collections
  useEffect(() => {
    // 1. Subscribe to Users
    const unsubUsers = subscribeToUsers((usersList) => {
      setAllUsers(usersList);
      // Update local current user details dynamically if they change
      if (currentUser) {
        const updatedMe = usersList.find(u => u.uid === currentUser.uid);
        if (updatedMe) {
          setCurrentUser(updatedMe);
        }
      }
    });

    // 2. Subscribe to Trips
    const unsubTrips = subscribeToTrips((tripsList) => {
      setTrips(tripsList);
    });

    // 3. Subscribe to Finances
    const unsubFinances = subscribeToFinances(currentUser?.uid, (financesList) => {
      setFinances(financesList);
    });

    // 4. Subscribe to Vehicles
    const unsubVehicles = subscribeToVehicles(currentUser?.uid || '', (vehiclesList) => {
      setVehicles(vehiclesList);
    });

    return () => {
      unsubUsers();
      unsubTrips();
      unsubFinances();
      unsubVehicles();
    };
  }, [currentUser?.uid]);

  // Subscribe to real-time Notifications specifically for the logged-in user
  useEffect(() => {
    if (!currentUser) return;

    const unsubNotifications = subscribeToNotifications(currentUser.uid, (notifsList) => {
      setNotifications(notifsList);
      const unread = notifsList.filter(n => !n.read).length;
      setUnreadCount(unread);
    });

    return () => {
      unsubNotifications();
    };
  }, [currentUser?.uid]);

  // Subscribe to buddy requests in real-time
  useEffect(() => {
    if (!currentUser) {
      setBuddyRequests([]);
      return;
    }
    const unsubscribe = subscribeToBuddyRequests(currentUser.uid, (reqs) => {
      setBuddyRequests(reqs);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (isRegistering) {
        if (!authName.trim()) {
          throw new Error('Lütfen adınızı ve soyadınızı girin.');
        }
        await registerNewUser(authEmail, authPassword, authName);
      } else {
        await loginUser(authEmail, authPassword);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Bir hata oluştu. Lütfen bilgilerinizi kontrol edin.';
      if (err.message) {
        if (err.message.includes('auth/email-already-in-use')) {
          errMsg = 'Bu e-posta adresi zaten kullanımda.';
        } else if (err.message.includes('auth/invalid-email')) {
          errMsg = 'Geçersiz bir e-posta adresi girdiniz.';
        } else if (err.message.includes('auth/weak-password')) {
          errMsg = 'Şifre en az 6 karakter olmalıdır.';
        } else if (err.message.includes('auth/invalid-credential') || err.message.includes('auth/user-not-found') || err.message.includes('auth/wrong-password')) {
          errMsg = 'E-posta adresi veya şifre hatalı.';
        } else {
          errMsg = err.message;
        }
      }
      setAuthError(errMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Google ile giriş yapılırken bir hata oluştu.';
      if (err.message) {
        if (err.message.includes('auth/popup-blocked')) {
          errMsg = 'Giriş penceresi tarayıcı tarafından engellendi. Lütfen açılır pencerelere izin verin.';
        } else if (err.message.includes('auth/popup-closed-by-user')) {
          errMsg = 'Giriş penceresi kapatıldı.';
        } else {
          errMsg = err.message;
        }
      }
      setAuthError(errMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOutUser();
      setShowUserDropdown(false);
    } catch (e) {
      console.error("Signout error:", e);
    }
  };

  const handleOpenEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setRepeatingTrip(undefined);
    setShowTripForm(true);
  };

  const handleOpenRepeat = (trip: Trip) => {
    setRepeatingTrip(trip);
    setEditingTrip(undefined);
    setShowTripForm(true);
  };

  const handleMarkRead = async (notifId: string) => {
    await markNotificationAsRead(notifId);
  };

  if (firebaseInitError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8 antialiased">
        <div className="w-full max-w-xl bg-slate-900 border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden" id="firebase-error-container">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {language === 'en' ? 'Firebase Configuration Required' : 'Firebase Kurulumu Gerekli'}
              </h1>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                {language === 'en' 
                  ? 'The Firebase API Key is missing or invalid. Please complete the Firebase setup from the AI Studio UI to provision your database and authentication keys.' 
                  : 'Firebase API Anahtarı eksik veya geçersiz. Lütfen veritabanınızı ve kimlik doğrulama anahtarlarınızı otomatik olarak oluşturmak için AI Studio arayüzündeki Firebase kurulumunu tamamlayın.'}
              </p>
            </div>
            
            <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-3 font-mono text-[10px] text-slate-400 leading-normal">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-red-400 font-bold">{language === 'en' ? 'Error Code:' : 'Hata Kodu:'}</span>
                <span>auth/invalid-api-key</span>
              </div>
              <div className="pt-1">
                <p className="text-slate-500 font-sans font-semibold uppercase text-[9px] tracking-wider mb-1">{language === 'en' ? 'How to resolve:' : 'Çözüm Adımları:'}</p>
                <ol className="list-decimal list-inside space-y-1 font-sans text-xs text-slate-300">
                  <li>{language === 'en' ? 'Find the Firebase setup UI in the sidebar or prompt panel.' : 'Sol veya alt paneldeki Firebase Kurulumu arayüzünü bulun.'}</li>
                  <li>{language === 'en' ? 'Approve and accept the Firebase terms to provision resources.' : 'Kaynakları oluşturmak için Firebase şartlarını kabul edip onaylayın.'}</li>
                  <li>{language === 'en' ? 'The system will automatically configure your credentials.' : 'Sistem gerekli anahtarları otomatik olarak güncelleyecektir.'}</li>
                </ol>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-500 font-mono">
              Caraba v2.0 • Security Guard Enabled
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-xs text-slate-400 font-medium mt-3">{language === 'en' ? 'Loading Caraba...' : 'Caraba yükleniyor...'}</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8 antialiased">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden" id="auth-bento-container">
          
          {/* Background Ambient Lights */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Left Info Column (Descriptive Cards) - Hidden on small mobile */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-8 z-10" id="auth-info-panel">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                {language === 'en' ? 'Workplace Smart Carpool Platform' : 'İş Yeri Akıllı Carpool Platformu'}
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight leading-none">
                Caraba
              </h1>
              <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest">
                {t('tagline')}
              </p>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                {t('welcome_desc')}
              </p>
            </div>

            {/* Bento cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Car className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-xs font-bold text-white">{language === 'en' ? 'Smart Route' : 'Akıllı Güzergah'}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {language === 'en' ? 'See stops along your coworkers routes and easily request to join.' : 'Çalışma arkadaşlarınızın rotası üzerindeki durakları görün ve kolayca katılım isteği gönderin.'}
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-xs font-bold text-white">{language === 'en' ? 'Fair Cost Sharing' : 'Adil Masraf Bölüşümü'}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {language === 'en' ? 'Fuel and road costs are automatically divided equally among passengers upon completion.' : 'Yolculuk tamamlandığında yakıt ve yol giderleri, yolcular arasında otomatik ve kuruşu kuruşuna bölünür.'}
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-xs font-bold text-white">{language === 'en' ? 'Verified Employee Pool' : 'Güvenli Çalışan Havuzu'}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {language === 'en' ? 'Match only with verified workplace coworkers and enjoy a safe commute.' : 'Yalnızca onaylanmış şirket çalışma arkadaşlarınızla eşleşin, güvenli yolculuğun tadını çıkarın.'}
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-xs font-bold text-white">{language === 'en' ? 'Instant Real-time Stream' : 'Anlık Real-time Akış'}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {language === 'en' ? 'New trips, approvals, and cost notifications immediately land on your notification feed.' : 'Yeni yolculuklar, katılım onayları ve masraf bildirimleri anında bildirim akışınıza düşer.'}
                </p>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              Caraba v2.0 • {t('tagline')}
            </div>
          </div>

          {/* Right Form Column */}
          <div className="md:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col justify-center z-10" id="auth-form-panel">
            <h2 className="text-xl font-bold text-white mb-2">
              {isRegistering ? t('register_title') : t('login_title')}
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              {isRegistering 
                ? (language === 'en' ? 'Register now to start carpooling with coworkers.' : 'Çalışma arkadaşlarınızla yol paylaşımına başlamak için hemen kayıt olun.')
                : (language === 'en' ? 'Log in with your Caraba account to view active trips.' : 'Caraba hesabınızla giriş yaparak mevcut yolculukları inceleyin.')}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isRegistering && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('username_label')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('name_placeholder')}
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('email_address')}</label>
                <input
                  type="email"
                  required
                  placeholder={language === 'en' ? 'john@company.com' : 'ahmet@firma.com'}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? 'Password' : 'Şifre'}</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs leading-relaxed font-semibold font-sans">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15"
              >
                {authSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    {isRegistering ? t('register_submit') : t('login_submit')}
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-slate-800/60"></div>
              <span className="mx-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'en' ? 'OR' : 'veya'}</span>
              <div className="flex-grow border-t border-slate-800/60"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authSubmitting}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 border border-slate-700/60 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2.5 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.104C18.28 1.91 15.538 1 12.24 1 5.925 1 12.24s4.925 11.24 11.24 11.24c6.594 0 11.012-4.636 11.012-11.218 0-.756-.082-1.334-.182-1.977H12.24z"
                />
              </svg>
              {t('google_signin')}
            </button>

            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError('');
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {isRegistering ? t('have_account') : t('no_account')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeUser = currentUser;

  // Real-time Approved Buddies calculation to filter trips
  const approvedBuddiesList = allUsers.filter(u => {
    if (!activeUser) return false;
    if (u.uid === activeUser.uid) return false;
    
    const userBuddies = activeUser.buddies || [];
    
    if (u.uid.startsWith('custom_') && userBuddies.includes(u.uid)) return true;

    const acceptedRequests = buddyRequests.filter(r => r.status === 'accepted');
    const hasAcceptedReq = acceptedRequests.some(r => 
      (r.fromId === activeUser.uid && r.toId === u.uid) || 
      (r.fromId === u.uid && r.toId === activeUser.uid)
    );
    if (hasAcceptedReq) return true;

    const isUserBuddy = userBuddies.includes(u.uid);
    const hasPendingReq = buddyRequests.some(r => 
      r.status === 'pending' && 
      ((r.fromId === activeUser.uid && r.toId === u.uid) || 
       (r.fromId === u.uid && r.toId === activeUser.uid))
    );
    if (isUserBuddy && !hasPendingReq) return true;

    return false;
  });

  // Only show trips created by me or my approved buddies
  const filteredTrips = trips.filter(trip => {
    if (!activeUser) return false;
    if (trip.driverId === activeUser.uid) return true;
    return approvedBuddiesList.some(buddy => buddy.uid === trip.driverId);
  });

  const activeTripsList = filteredTrips.filter(t => t.status === 'active');
  const scheduledTripsList = filteredTrips.filter(t => t.status === 'scheduled');
  const completedTripsList = filteredTrips.filter(t => t.status === 'completed');
  const currentSubTabTrips = filteredTrips.filter(t => t.status === tripSubTab);

  return (
    <div className={`min-h-screen flex flex-col justify-between antialiased transition-colors duration-300 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {/* 1. DESKTOP WIDESCREEN BENTO GRID LAYOUT */}
      <div className={`hidden lg:flex lg:flex-row h-screen w-full overflow-hidden transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`} id="desktop-bento-layout">
        
        {/* Sidebar Navigation */}
        <nav className="w-20 bg-slate-900 flex flex-col items-center py-8 space-y-8 shadow-2xl shrink-0 h-full justify-between" id="desktop-sidebar-nav">
          <div className="flex flex-col items-center space-y-8 w-full">
            {/* Logo */}
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg font-display font-bold shadow-lg shadow-indigo-500/25" title="Caraba">
              C
            </div>
            
            {/* Navigation Buttons linked to activeTab */}
            <div className="flex flex-col space-y-4 w-full px-2">
              <button 
                onClick={() => setActiveTab('trips')}
                className={`p-3 rounded-xl cursor-pointer transition-all flex justify-center ${activeTab === 'trips' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={t('tab_trips')}
                id="desktop-nav-trips"
              >
                <Car className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveTab('vehicles')}
                className={`p-3 rounded-xl cursor-pointer transition-all flex justify-center ${activeTab === 'vehicles' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={t('tab_vehicles')}
                id="desktop-nav-vehicles"
              >
                <Gauge className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveTab('buddies')}
                className={`p-3 rounded-xl cursor-pointer transition-all flex justify-center ${activeTab === 'buddies' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={t('tab_buddies')}
                id="desktop-nav-buddies"
              >
                <Users className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveTab('finances')}
                className={`p-3 rounded-xl cursor-pointer transition-all flex justify-center ${activeTab === 'finances' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={t('tab_finances')}
                id="desktop-nav-finances"
              >
                <DollarSign className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Profile Account Selector with Switcher */}
          <div className="relative mt-auto">
            <button 
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotificationMenu(false);
              }}
              className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-all shadow-md"
              id="desktop-active-user"
            >
              {activeUser.avatarUrl ? (
                <img src={activeUser.avatarUrl} alt={activeUser.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xs">{activeUser.initials}</span>
              )}
            </button>
            
            {/* Desktop User profile panel and logout */}
            {showUserDropdown && (
              <div className="absolute bottom-12 left-2 mt-2.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-fadeIn text-slate-800" id="desktop-user-profile-menu">
                <div className="flex items-center gap-2.5">
                  {activeUser.avatarUrl ? (
                    <img src={activeUser.avatarUrl} alt={activeUser.name} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center">
                      {activeUser.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate text-slate-950">{activeUser.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{activeUser.email}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <button
                    onClick={() => {
                      setShowSettingsModal(true);
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-2 hover:bg-indigo-50 rounded-xl text-xs text-indigo-600 font-bold transition-all flex items-center gap-2 cursor-pointer"
                    id="desktop-settings-button"
                  >
                    <Settings className="w-4 h-4" />
                    {t('settings')}
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-2.5 py-2 hover:bg-rose-50 rounded-xl text-xs text-rose-600 font-bold transition-all flex items-center gap-2 cursor-pointer"
                    id="desktop-logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Desktop Main Dashboard Body */}
        <main className="flex-1 flex flex-col p-8 overflow-hidden h-full">
          
          {/* Dashboard Widescreen Header */}
          <header className="flex justify-between items-end mb-6">
            <div>
              <h1 className={`text-2xl font-display font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{language === 'en' ? 'Caraba Dashboard' : 'Caraba Paneli'}</h1>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'en' ? (
                  <>Welcome, <span className={`font-semibold ${theme === 'dark' ? 'text-indigo-300' : 'text-slate-700'}`}>{activeUser.name}</span>! Today, {activeUser.buddies?.length || 0} buddies are waiting for you.</>
                ) : (
                  <>Hoş geldin, <span className={`font-semibold ${theme === 'dark' ? 'text-indigo-300' : 'text-slate-700'}`}>{activeUser.name}</span>! Bugün {activeUser.buddies?.length || 0} yol arkadaşın seni bekliyor.</>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notification bell block */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotificationMenu(!showNotificationMenu);
                    setShowUserDropdown(false);
                  }}
                  className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors relative cursor-pointer shadow-sm"
                  id="desktop-notification-btn"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce border border-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications list dropdown */}
                {showNotificationMenu && (
                  <div className="absolute right-0 mt-2.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 max-h-80 overflow-y-auto divide-y divide-slate-50 animate-fadeIn">
                    <div className="px-3 py-1.5 flex justify-between items-center">
                      <span className="text-[10px] font-display font-bold text-slate-400 uppercase tracking-wider">Bildirimler</span>
                      <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                        {unreadCount} Yeni
                      </span>
                    </div>
                    
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        Henüz bildirim bulunmuyor.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-2.5 text-left rounded-xl transition-all flex items-start gap-2 ${
                            !n.read ? 'bg-indigo-50/50' : 'opacity-85'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{n.message}</p>
                            <span className="text-[8px] text-slate-400 mt-0.5 block">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Okundu olarak işaretle"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Start new trip action */}
              <button
                onClick={() => {
                  setEditingTrip(undefined);
                  setRepeatingTrip(undefined);
                  setShowTripForm(true);
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-display font-bold text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/15 flex items-center gap-2 transition-all cursor-pointer hover:translate-y-[-1px]"
                id="desktop-create-trip-btn"
              >
                <Plus className="w-4 h-4" />
                {t('new_trip_btn')}
              </button>
            </div>
          </header>

          {/* Desktop Main View Switcher */}
          {activeTab === 'vehicles' ? (
            <div className="flex-1 overflow-y-auto pr-2 pb-4" id="desktop-view-vehicles">
              <VehicleManager 
                currentUser={activeUser} 
                vehicles={vehicles}
                onStartTripWithVehicle={(v) => {
                  setPreselectedVehicleId(v.id);
                  setEditingTrip(undefined);
                  setRepeatingTrip(undefined);
                  setShowTripForm(true);
                }}
              />
            </div>
          ) : activeTab === 'buddies' ? (
            <div className="flex-1 overflow-y-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200" id="desktop-view-buddies">
              <BuddySelector currentUser={activeUser} allUsers={allUsers} />
            </div>
          ) : activeTab === 'finances' ? (
            <div className="flex-1 overflow-y-auto bg-white rounded-2xl p-6 shadow-sm border border-slate-200" id="desktop-view-finances">
              <FinanceSummary currentUser={activeUser} transactions={finances} />
            </div>
          ) : (
            /* Core Widescreen Bento Grid (trips tab) */
            <div className="flex-1 grid grid-cols-12 gap-5 overflow-y-auto pr-2 pb-4">
              
              {/* Bento Block 1: Trips List with Tabs (col-span-8) */}
              <div className="col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                {/* Header Title bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center pb-2">
                  <span className="font-display font-bold text-slate-700 text-xs flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></span>
                    {language === 'en' ? 'Carpool Journeys' : 'Carpool Seferleri'}
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                    {filteredTrips.length} {language === 'en' ? 'Total' : 'Toplam'}
                  </span>
                </div>

                {/* Subtabs switcher */}
                <div className="flex border-b border-slate-100 bg-white p-2 gap-1.5 shrink-0">
                  <button
                    onClick={() => setTripSubTab('active')}
                    className={`flex-1 py-2.5 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tripSubTab === 'active'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                    }`}
                    id="tab-active-trips"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${tripSubTab === 'active' ? 'animate-pulse' : ''}`}></span>
                    {language === 'en' ? 'Active Trip' : 'Aktif Yolculuk'}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tripSubTab === 'active' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                      {activeTripsList.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setTripSubTab('scheduled')}
                    className={`flex-1 py-2.5 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tripSubTab === 'scheduled'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                    }`}
                    id="tab-scheduled-trips"
                  >
                    {language === 'en' ? 'Planned' : 'Planlanan'}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tripSubTab === 'scheduled' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                      {scheduledTripsList.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setTripSubTab('completed')}
                    className={`flex-1 py-2.5 px-3 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      tripSubTab === 'completed'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                    }`}
                    id="tab-completed-trips"
                  >
                    {language === 'en' ? 'Completed' : 'Tamamlanan'}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tripSubTab === 'completed' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                      {completedTripsList.length}
                    </span>
                  </button>
                </div>
                
                <div className="flex-1 p-5 overflow-y-auto bg-slate-50/20">
                  {currentSubTabTrips.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-80 min-h-[250px]">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mb-3">
                        <Car className="w-6 h-6" />
                      </div>
                      <h3 className="text-xs font-display font-bold text-slate-700">
                        {tripSubTab === 'active' ? (language === 'en' ? 'No Active Trips' : 'Aktif Yolculuk Yok') :
                         tripSubTab === 'scheduled' ? (language === 'en' ? 'No Planned Trips' : 'Planlanmış Yolculuk Yok') :
                         (language === 'en' ? 'No Completed Trips' : 'Tamamlanmış Yolculuk Yok')}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">
                        {tripSubTab === 'active' ? (language === 'en' ? 'There is no active journey right now.' : 'Şu anda yolda olan aktif bir carpool yolculuğu bulunmuyor.') :
                         tripSubTab === 'scheduled' ? (language === 'en' ? 'There are no planned routes. You can create a new route!' : 'İleri tarihli planlanmış bir carpool seferi bulunmuyor. Yeni bir rota oluşturabilirsiniz!') :
                         (language === 'en' ? 'You have not completed any carpool journeys yet.' : 'Daha önce tamamlenmiş bir carpool yolculuğunuz bulunmamaktadır.')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {currentSubTabTrips.map((trip) => (
                        <TripCard 
                          key={trip.id} 
                          trip={trip} 
                          currentUser={activeUser}
                          allUsers={allUsers}
                          onEdit={handleOpenEdit}
                          onRepeat={handleOpenRepeat}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bento Block 2: Road Buddies (col-span-4) */}
              <div className="col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden max-h-[380px]">
                <h3 className="text-xs font-display font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-wider border-b border-slate-50 pb-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  {t('buddies_title')}
                </h3>
                <div className="flex-1 overflow-y-auto pr-1">
                  <BuddySelector currentUser={activeUser} allUsers={allUsers} />
                </div>
              </div>

              {/* Bento Block 3: Quick Access Widget (col-span-4) */}
              <div className="col-span-4 bg-indigo-600 rounded-2xl shadow-lg p-5 flex flex-col justify-between text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none"></div>
                <div>
                  <span className="text-[10px] font-display font-bold text-indigo-200 uppercase tracking-widest bg-indigo-500/30 px-2 py-0.5 rounded-full w-max block mb-2">
                    {language === 'en' ? 'Quick Access' : 'Hızlı Erişim'}
                  </span>
                  <h3 className="text-lg font-display font-bold leading-tight">{language === 'en' ? 'Start Morning Commute' : 'Sabah Rutinini Başlat'}</h3>
                  <p className="text-indigo-100 text-xs mt-1.5 leading-relaxed">
                    {language === 'en' ? 'Quickly start a carpool commute and invite your workplace buddy group!' : 'İş yeri carpool yolculuğunu hızlıca başlatıp co-worker grubuna anında davetiye gönderin!'}
                  </p>
                </div>
                <div className="flex gap-2 mt-4 z-10">
                  <button 
                    onClick={() => {
                      const samplePreset = trips.find(t => t.driverId === activeUser.uid) || trips[0];
                      if (samplePreset) {
                        handleOpenRepeat(samplePreset);
                      } else {
                        setEditingTrip(undefined);
                        setRepeatingTrip(undefined);
                        setShowTripForm(true);
                      }
                    }}
                    className="flex-1 bg-white text-indigo-600 py-2.5 rounded-xl font-display font-bold text-xs hover:bg-indigo-50 shadow-inner transition-all cursor-pointer text-center"
                  >
                    {language === 'en' ? 'START NOW' : 'ŞİMDİ BAŞLAT'}
                  </button>
                </div>
              </div>

              {/* Bento Block 4: Finance Tracker (col-span-8) */}
              <div className="col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden min-h-[320px]">
                <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-xs font-display font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      {language === 'en' ? 'Trip Finance & Payments' : 'Yolculuk Finansı & Ödemeler'}
                    </h3>
                    <p className="text-[10px] text-slate-400">{language === 'en' ? 'Carpool cost sharing and payment transfer list' : 'Carpool masraf bölüşümleri ve ödeme transfer listesi'}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  <FinanceSummary currentUser={activeUser} transactions={finances} />
                </div>
              </div>

              {/* Bento Block 5: Fuel Stats / Yakıt Raporu (col-span-4) */}
              <div className="col-span-4 bg-slate-900 rounded-2xl shadow-xl p-5 flex flex-col justify-between text-white min-h-[320px] relative overflow-hidden border border-slate-800">
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-indigo-400 text-[10px] font-display font-black uppercase tracking-widest">{language === 'en' ? 'FUEL REPORT' : 'YAKIT RAPORU'}</p>
                      <p className="text-slate-400 text-xs font-medium">{language === 'en' ? 'July 2026' : 'Temmuz 2026'}</p>
                    </div>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {language === 'en' ? '-14% Savings' : '-14% Tasarruf'}
                    </span>
                  </div>
                  
                  <div className="my-6">
                    <p className="text-4xl font-display font-black text-white">
                      {(finances.filter(f => f.status === 'paid').length * 45).toFixed(0)} <span className="text-sm font-normal text-slate-400">TL</span>
                    </p>
                    <p className="text-[10px] text-emerald-400 font-bold mt-1 uppercase flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {language === 'en' ? 'Carpool Eco & Economic Profit' : 'Carpool Çevre ve Ekonomik Kazanç'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>{language === 'en' ? 'TARGET FUEL SAVINGS' : 'HEDEF YAKIT TASARRUFU'}</span>
                    <span>68%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: "68%" }}></div>
                  </div>
                  <p className="text-slate-500 text-[9px] text-center font-bold">{language === 'en' ? 'TARGET: 550 TL' : 'HEDEF: 550 TL'}</p>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* 2. MOBILE APP VIEW FRAME WRAPPER */}
      <div className="w-full max-w-md mx-auto bg-white min-h-screen flex flex-col shadow-xl border-x border-slate-200 relative lg:hidden" id="mobile-app-layout">
        
        {/* Upper Header */}
        <header className="px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-40 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Car className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-sm font-display font-bold text-slate-800 tracking-tight">Caraba</h1>
              <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider">{t('tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Realtime Notifications Feed Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationMenu(!showNotificationMenu);
                  setShowUserDropdown(false);
                }}
                className="p-1.5 hover:bg-slate-50 rounded-xl text-gray-600 hover:text-indigo-600 transition-colors relative cursor-pointer"
                id="notification-bell-btn"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotificationMenu && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-2 max-h-80 overflow-y-auto divide-y divide-gray-50 animate-fadeIn text-slate-800">
                  <div className="px-3 py-1.5 flex justify-between items-center">
                    <span className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider">{t('notifications')}</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} {language === 'en' ? 'New' : 'Yeni'}
                    </span>
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 italic">
                      {t('no_notifications')}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-2.5 text-left rounded-xl transition-all flex items-start gap-2 ${
                          !n.read ? 'bg-indigo-50/50' : 'opacity-85'
                        }`}
                        id={`notif-item-${n.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-700 font-medium leading-relaxed">{n.message}</p>
                          <span className="text-[8px] text-gray-400 mt-0.5 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title={language === 'en' ? 'Mark as read' : 'Okundu olarak işaretle'}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Simulated Active User Selector Profile */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotificationMenu(false);
                }}
                className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 hover:border-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                id="active-user-selector"
              >
                {activeUser.avatarUrl ? (
                  <img 
                    src={activeUser.avatarUrl} 
                    alt={activeUser.name} 
                    className="w-5 h-5 rounded-md object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                    {activeUser.initials}
                  </div>
                )}
                <span className="text-[10px] font-bold text-gray-700 truncate max-w-[65px]">{activeUser.name.split(' ')[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {/* Mobile User profile details & logout */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2.5 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-3 space-y-3.5 animate-fadeIn text-slate-800" id="mobile-user-profile-menu">
                  <div className="flex items-center gap-2">
                    {activeUser.avatarUrl ? (
                      <img src={activeUser.avatarUrl} alt={activeUser.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                        {activeUser.initials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] truncate text-slate-900 leading-tight">{activeUser.name}</p>
                      <p className="text-[9px] text-gray-500 truncate leading-none">{activeUser.email}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowSettingsModal(true);
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 rounded-xl text-xs text-indigo-600 font-bold transition-all flex items-center gap-2 cursor-pointer"
                      id="mobile-settings-button"
                    >
                      <Settings className="w-4 h-4" />
                      {t('settings')}
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-2 py-1.5 hover:bg-rose-50 rounded-xl text-xs text-rose-600 font-bold transition-all flex items-center gap-2 cursor-pointer"
                      id="mobile-logout-button"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Scrollable Core Screen Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-5">
          
          {/* Tabs View Switching */}
          {activeTab === 'trips' && (
            <div className="space-y-4" id="view-trips">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-display font-bold text-gray-400 uppercase tracking-wider pl-0.5">{language === 'en' ? 'Carpool Journeys' : 'Carpool Seferleri'}</h2>
                  <p className="text-[10px] text-gray-400">{language === 'en' ? 'Manage and browse routes' : 'Yolculukları inceleyin ve yönetin'}</p>
                </div>
                
                <button
                  onClick={() => {
                    setEditingTrip(undefined);
                    setRepeatingTrip(undefined);
                    setShowTripForm(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer shadow-md shadow-indigo-100 transition-all hover:translate-y-[-1px]"
                  id="create-new-trip-btn"
                >
                  <Plus className="w-4 h-4" />
                  {t('new_trip_btn')}
                </button>
              </div>

              {/* Subtabs switcher for Mobile */}
              <div className="flex border border-slate-200 bg-white p-1 rounded-2xl gap-1 shrink-0 shadow-sm">
                <button
                  onClick={() => setTripSubTab('active')}
                  className={`flex-1 py-2 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    tripSubTab === 'active'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${tripSubTab === 'active' ? 'animate-pulse' : ''}`}></span>
                  {language === 'en' ? 'Active' : 'Aktif'}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${tripSubTab === 'active' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                    {activeTripsList.length}
                  </span>
                </button>
                <button
                  onClick={() => setTripSubTab('scheduled')}
                  className={`flex-1 py-2 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    tripSubTab === 'scheduled'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  {language === 'en' ? 'Planned' : 'Planlanan'}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${tripSubTab === 'scheduled' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                    {scheduledTripsList.length}
                  </span>
                </button>
                <button
                  onClick={() => setTripSubTab('completed')}
                  className={`flex-1 py-2 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    tripSubTab === 'completed'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  {language === 'en' ? 'Completed' : 'Biten'}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${tripSubTab === 'completed' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                    {completedTripsList.length}
                  </span>
                </button>
              </div>

              {currentSubTabTrips.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Car className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-display font-bold text-gray-800">
                    {tripSubTab === 'active' ? (language === 'en' ? 'No Active Trips' : 'Aktif Yolculuk Yok') :
                     tripSubTab === 'scheduled' ? (language === 'en' ? 'No Planned Trips' : 'Planlanmış Yolculuk Yok') :
                     (language === 'en' ? 'No Completed Trips' : 'Tamamlanmış Yolculuk Yok')}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed max-w-[250px] mx-auto">
                    {tripSubTab === 'active' ? (language === 'en' ? 'There is no active journey right now.' : 'Şu anda yolda olan aktif bir carpool yolculuğu bulunmuyor.') :
                     tripSubTab === 'scheduled' ? (language === 'en' ? 'There are no planned routes.' : 'Planlanmış bir carpool seferi bulunmuyor.') :
                     (language === 'en' ? 'You have not completed any carpool journeys yet.' : 'Daha önce tamamlenmiş bir carpool yolculuğunuz bulunmamaktadır.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSubTabTrips.map((trip) => (
                    <TripCard 
                      key={trip.id} 
                      trip={trip} 
                      currentUser={activeUser}
                      allUsers={allUsers}
                      onEdit={handleOpenEdit}
                      onRepeat={handleOpenRepeat}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div id="view-vehicles" className="p-4">
              <VehicleManager 
                currentUser={activeUser} 
                vehicles={vehicles}
                onStartTripWithVehicle={(v) => {
                  setPreselectedVehicleId(v.id);
                  setEditingTrip(undefined);
                  setRepeatingTrip(undefined);
                  setShowTripForm(true);
                }}
              />
            </div>
          )}

          {activeTab === 'buddies' && (
            <div id="view-buddies">
              <BuddySelector currentUser={activeUser} allUsers={allUsers} />
            </div>
          )}

          {activeTab === 'finances' && (
            <div id="view-finances">
              <FinanceSummary currentUser={activeUser} transactions={finances} />
            </div>
          )}

        </main>

        {/* Global Bottom Navigation Menu (Premium Style) */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2.5 flex justify-around items-center sticky z-40 shadow-xl">
          
          <button
            onClick={() => setActiveTab('trips')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'trips' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
            id="nav-trips"
          >
            <Car className="w-5 h-5" />
            <span className="text-[9px] font-display font-bold">{t('tab_trips')}</span>
          </button>

          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'vehicles' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
            id="nav-vehicles"
          >
            <Gauge className="w-5 h-5" />
            <span className="text-[9px] font-display font-bold">{t('tab_vehicles')}</span>
          </button>

          <button
            onClick={() => setActiveTab('buddies')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'buddies' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
            id="nav-buddies"
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-display font-bold">{t('tab_buddies')}</span>
          </button>

          <button
            onClick={() => setActiveTab('finances')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 'finances' ? 'text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
            id="nav-finances"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-[9px] font-display font-bold">{t('tab_finances')}</span>
          </button>

        </nav>

      </div>

      {/* GLOBAL TRIP FORM MODAL OVERLAY (FOR BOTH DESKTOP AND MOBILE) */}
      {showTripForm && (
        <TripForm
          currentUser={activeUser}
          onClose={() => {
            setShowTripForm(false);
            setEditingTrip(undefined);
            setRepeatingTrip(undefined);
            setPreselectedVehicleId(undefined);
          }}
          editingTrip={editingTrip}
          repeatingTrip={repeatingTrip}
          preselectedVehicleId={preselectedVehicleId}
        />
      )}

      {/* GLOBAL SETTINGS MODAL OVERLAY */}
      {showSettingsModal && (
        <SettingsModal
          currentUser={activeUser}
          onClose={() => setShowSettingsModal(false)}
          currentTheme={theme}
          onThemeChange={onThemeChange}
          currentLanguage={language}
          onLanguageChange={onLanguageChange}
        />
      )}

      {/* Floating Sync indicator from mockup */}
      {notifications.length > 0 && !notifications[0].read && (
        <div className="fixed bottom-6 right-6 hidden md:flex items-center gap-3 bg-white border border-indigo-100 shadow-2xl p-3.5 rounded-2xl border-l-4 border-l-indigo-500 z-50 animate-fadeIn">
          <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></div>
          <p className="text-xs font-display font-bold text-slate-700">
            {notifications[0].message}
          </p>
        </div>
      )}

    </div>
  );
}
