import React, { useState } from 'react';
import { FinanceTransaction, User } from '../types';
import { markAsPaid } from '../services/db';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Fuel, 
  Download, 
  Sparkles,
  Award,
  Wallet
} from 'lucide-react';

interface FinanceSummaryProps {
  currentUser: User;
  transactions: FinanceTransaction[];
}

export default function FinanceSummary({ currentUser, transactions }: FinanceSummaryProps) {
  const [activeTab, setActiveTab] = useState<'debts' | 'receivables' | 'report'>('debts');

  // Filter transactions
  const myDebts = transactions.filter(t => t.payerId === currentUser.uid);
  const myReceivables = transactions.filter(t => t.receiverId === currentUser.uid);

  // Totals calculations
  const totalOwed = myDebts
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalToReceive = myReceivables
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  // Monthly fuel & cost savings calculation
  const completedTripsTrans = transactions.filter(t => 
    (t.payerId === currentUser.uid || t.receiverId === currentUser.uid) && 
    t.status === 'paid'
  );

  // Monthly fuel stats
  const totalTripsShared = completedTripsTrans.length;
  // Standard travel assumes fuel consumption of 2.2 zł per km.
  // Carpooling splits this by typical 3 co-workers, saving massive money.
  const estimatedFuelSavedLitres = parseFloat((totalTripsShared * 8.5).toFixed(1)); // 8.5L saved average per carpool
  const estimatedMoneySaved = parseFloat((totalTripsShared * 45).toFixed(1)); // 45 zł saved average per carpool trip

  const handleMarkAsPaid = async (transactionId: string) => {
    await markAsPaid(transactionId);
  };

  // Export report to pseudo-CSV / Print
  const handleExportCSV = () => {
    const headers = ['Tarih', 'Yolculuk', 'Ödeyen', 'Alıcı', 'Tutar (zł)', 'Durum'];
    const rows = transactions
      .filter(t => t.payerId === currentUser.uid || t.receiverId === currentUser.uid)
      .map(t => [
        t.date,
        t.tripTitle,
        t.payerName,
        t.receiverName,
        `${t.amount} zł`,
        t.status === 'paid' ? 'Ödendi' : 'Bekliyor'
      ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Yol_Arkadasim_Odeme_Raporu_${currentUser.name.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="finance-tab">
      
      {/* Visual Balanced Totals Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Debts Summary Card */}
        <div className="bg-gradient-to-tr from-rose-500 to-orange-500 rounded-2xl p-4 text-white shadow-md space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-display font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full uppercase">
              Borçlarım
            </span>
            <ArrowUpRight className="w-4.5 h-4.5 text-white/80" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl font-display font-bold tracking-tight">{totalOwed.toFixed(2)} zł</h3>
            <p className="text-[9px] text-rose-100">Ödemem Gereken Toplam</p>
          </div>
        </div>

        {/* Receivables Summary Card */}
        <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-display font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full uppercase">
              Alacaklarım
            </span>
            <ArrowDownLeft className="w-4.5 h-4.5 text-white/80" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl font-display font-bold tracking-tight">{totalToReceive.toFixed(2)} zł</h3>
            <p className="text-[9px] text-emerald-100">Alacağım Toplam Tutar</p>
          </div>
        </div>
      </div>

      {/* Segmented Controller navigation */}
      <div className="flex bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('debts')}
          className={`flex-1 text-xs py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'debts' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
          id="tab-debts"
        >
          Yapılacak Ödemeler
        </button>
        <button
          onClick={() => setActiveTab('receivables')}
          className={`flex-1 text-xs py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'receivables' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
          id="tab-receivables"
        >
          Alınacaklar
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 text-xs py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'report' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
          id="tab-report"
        >
          Yakıt & Tasarruf Raporu
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'debts' && (
        <div className="space-y-3" id="debts-list">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aktif Borç Talepleri</h4>
            {myDebts.length > 0 && (
              <button 
                onClick={handleExportCSV}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> Raporu İndir
              </button>
            )}
          </div>

          {myDebts.length === 0 ? (
            <div className="text-center py-10 bg-white border border-gray-50 rounded-2xl shadow-sm p-4 text-gray-400">
              <Wallet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-medium">Harika! Herhangi bir borcunuz bulunmuyor.</p>
              <p className="text-[10px] text-gray-400 mt-1">İş arkadaşlarınızla yaptığınız tüm tamamlanmış yolculuk borçları burada görünür.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myDebts.map((t) => (
                <div 
                  key={t.id}
                  className={`bg-white p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    t.status === 'paid' ? 'border-gray-100 opacity-65 bg-gray-50/50' : 'border-gray-100 hover:border-gray-200 shadow-sm'
                  }`}
                  id={`debt-transaction-${t.id}`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">{t.receiverName}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        t.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {t.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 font-medium truncate">{t.tripTitle}</p>
                    
                    <div className="flex items-center gap-2 text-[9px] text-gray-400 font-medium">
                      <Calendar className="w-3 h-3" />
                      <span>{t.date}</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <span className="text-xs font-black text-gray-800">{t.amount.toFixed(2)} zł</span>
                    
                    {t.status === 'pending' && (
                      <button
                        onClick={() => handleMarkAsPaid(t.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-indigo-100"
                        id={`pay-btn-${t.id}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Ödendi
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'receivables' && (
        <div className="space-y-3" id="receivables-list">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bekleyen Alacaklarım</h4>
            {myReceivables.length > 0 && (
              <button 
                onClick={handleExportCSV}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> Raporu İndir
              </button>
            )}
          </div>

          {myReceivables.length === 0 ? (
            <div className="text-center py-10 bg-white border border-gray-50 rounded-2xl shadow-sm p-4 text-gray-400">
              <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-medium">Kimseden bir alacağınız bulunmuyor.</p>
              <p className="text-[10px] text-gray-400 mt-1">Sürücü olarak tamamladığınız yolculukların masraf alacakları burada toplanır.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myReceivables.map((t) => (
                <div 
                  key={t.id}
                  className={`bg-white p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    t.status === 'paid' ? 'border-gray-100 opacity-65 bg-gray-50/50' : 'border-gray-100 hover:border-gray-200 shadow-sm'
                  }`}
                  id={`receivable-transaction-${t.id}`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">{t.payerName}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        t.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.status === 'paid' ? 'Ödendi' : 'Onay Bekliyor'}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 font-medium truncate">{t.tripTitle}</p>
                    
                    <div className="flex items-center gap-2 text-[9px] text-gray-400 font-medium">
                      <Calendar className="w-3 h-3" />
                      <span>{t.date}</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-gray-800">{t.amount.toFixed(2)} zł</p>
                      {t.status === 'pending' && (
                        <span className="text-[8px] text-amber-600 block font-semibold animate-pulse">
                          Ödeme Bekleniyor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-5" id="report-tab">
          
          {/* Sparkles Carpooling benefits */}
          <div className="bg-gradient-to-tr from-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-xl space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
            
            <div className="flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Aylık Tasarruf ve Yakıt Raporu</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Aracı ortak kullanmak yalnızca cebinizi korumakla kalmaz, aynı zamanda karbon salınımını azaltarak dünyamızı da korur. 
              İşte bu ayki carpool başarı tablonuz!
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">Toplam Kazanç</span>
                </div>
                <h5 className="text-lg font-black text-white mt-1">{(totalTripsShared * 45).toFixed(0)} zł</h5>
                <span className="text-[8px] text-slate-500 block mt-0.5">Yol masrafı paylaşım karı</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">Yakıt Tasarrufu</span>
                </div>
                <h5 className="text-lg font-black text-white mt-1">{(totalTripsShared * 8.5).toFixed(1)} L</h5>
                <span className="text-[8px] text-slate-500 block mt-0.5">Atmosferden korunan CO2</span>
              </div>
            </div>
          </div>

          {/* Visual bar chart of fuel costs by co-workers */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-800">Ortak Yolculuk Masraf Bölüşümü Oranları</h4>
              <p className="text-[10px] text-gray-400">Carpool yaptığınız iş arkadaşlarınızla olan masraf dağılımı</p>
            </div>

            {totalTripsShared === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 italic">
                Veri oluşturmak için henüz tamamlanmış ve ödenmiş bir yolculuğunuz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-600">
                    <span>Yakıt & Amortisman Maliyeti</span>
                    <span>%35</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '35%' }}></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-600">
                    <span>Paylaşılan Sürücü Katkısı</span>
                    <span>%45</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-600">
                    <span>Otoyol & Köprü Geçiş Ücretleri</span>
                    <span>%20</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: '20%' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
