import React from 'react';
import { Layers, Scale, Target, TrendingUp } from 'lucide-react';

interface FixedBottomNavProps {
  currentTab: 'pyramid' | 'debts' | 'goals' | 'market';
  onSwitchTab: (tab: 'pyramid' | 'debts' | 'goals' | 'market') => void;
  assetCount?: number;
  debtCount?: number;
  goalCount?: number;
}

export const FixedBottomNav: React.FC<FixedBottomNavProps> = ({
  currentTab,
  onSwitchTab,
  assetCount = 0,
  debtCount = 0,
  goalCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-1.5 sm:px-4 py-1.5 safe-area-pb">
      <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1 sm:gap-2">
        {/* Tab 1: Tháp Tài Sản */}
        <button
          type="button"
          onClick={() => onSwitchTab('pyramid')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'pyramid'
              ? 'bg-emerald-50 text-emerald-800 font-black shadow-xs ring-1 ring-emerald-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Layers
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                currentTab === 'pyramid' ? 'text-emerald-600 scale-110' : 'text-slate-400'
              } transition-transform`}
            />
            {assetCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-emerald-600 text-white rounded-full text-[8px] font-black leading-none">
                {assetCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-xs mt-0.5 tracking-tight truncate">Tháp Tài Sản</span>
        </button>

        {/* Tab 2: Dòng Tiền & Nợ */}
        <button
          type="button"
          onClick={() => onSwitchTab('debts')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'debts'
              ? 'bg-rose-50 text-rose-800 font-black shadow-xs ring-1 ring-rose-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Scale
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                currentTab === 'debts' ? 'text-rose-600 scale-110' : 'text-slate-400'
              } transition-transform`}
            />
            {debtCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-rose-600 text-white rounded-full text-[8px] font-black leading-none">
                {debtCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-xs mt-0.5 tracking-tight truncate">Dòng Tiền & Nợ</span>
        </button>

        {/* Tab 3: Kế Hoạch Mục Tiêu */}
        <button
          type="button"
          onClick={() => onSwitchTab('goals')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'goals'
              ? 'bg-blue-50 text-blue-800 font-black shadow-xs ring-1 ring-blue-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Target
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                currentTab === 'goals' ? 'text-blue-600 scale-110' : 'text-slate-400'
              } transition-transform`}
            />
            {goalCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-blue-600 text-white rounded-full text-[8px] font-black leading-none">
                {goalCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-xs mt-0.5 tracking-tight truncate">Mục Tiêu</span>
        </button>

        {/* Tab 4: Thị Trường & Vĩ Mô */}
        <button
          type="button"
          onClick={() => onSwitchTab('market')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative ${
            currentTab === 'market'
              ? 'bg-amber-50 text-amber-900 font-black shadow-xs ring-1 ring-amber-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <TrendingUp
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                currentTab === 'market' ? 'text-amber-600 scale-110' : 'text-slate-400'
              } transition-transform`}
            />
            <span className="absolute -top-1 -right-2.5 px-1 py-0.2 bg-amber-500 text-white rounded-full text-[7.5px] font-black leading-none">
              Live
            </span>
          </div>
          <span className="text-[10px] sm:text-xs mt-0.5 tracking-tight truncate">Thị Trường & Vĩ Mô</span>
        </button>
      </div>
    </nav>
  );
};
