import React from 'react';
import { Layers, Scale, Target, TrendingUp, Sparkles } from 'lucide-react';
import { ActiveTab } from '../types';

interface FixedBottomNavProps {
  currentTab: ActiveTab;
  onSwitchTab: (tab: ActiveTab) => void;
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-1.5 sm:px-4 py-2 safe-area-pb">
      <div className="max-w-3xl mx-auto grid grid-cols-5 gap-1 sm:gap-2">
        {/* Tháp Tài Sản */}
        <button
          type="button"
          onClick={() => onSwitchTab('pyramid')}
          title="Tháp Tài Sản"
          className={`flex flex-col items-center justify-center min-h-[52px] py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative select-none ${
            currentTab === 'pyramid'
              ? 'bg-emerald-50 text-emerald-800 font-black shadow-xs ring-1 ring-emerald-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Layers
              className={`w-6 h-6 sm:w-5 sm:h-5 ${
                currentTab === 'pyramid' ? 'text-emerald-600 scale-105' : 'text-slate-400'
              } transition-transform`}
            />
            {assetCount > 0 && (
              <span className="absolute -top-1 -right-2.5 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-micro font-black leading-none">
                {assetCount}
              </span>
            )}
          </div>
          <span className="text-micro sm:text-caption font-bold mt-1 tracking-tight truncate max-w-full">
            <span className="sm:hidden">Tháp Tài Sản</span>
            <span className="hidden sm:inline">Tháp Tài Sản</span>
          </span>
        </button>

        {/* Dòng Tiền & Nợ */}
        <button
          type="button"
          onClick={() => onSwitchTab('debts')}
          title="Dòng Tiền & Nợ"
          className={`flex flex-col items-center justify-center min-h-[52px] py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative select-none ${
            currentTab === 'debts'
              ? 'bg-rose-50 text-rose-800 font-black shadow-xs ring-1 ring-rose-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Scale
              className={`w-6 h-6 sm:w-5 sm:h-5 ${
                currentTab === 'debts' ? 'text-rose-600 scale-105' : 'text-slate-400'
              } transition-transform`}
            />
            {debtCount > 0 && (
              <span className="absolute -top-1 -right-2.5 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-micro font-black leading-none">
                {debtCount}
              </span>
            )}
          </div>
          <span className="text-micro sm:text-caption font-bold mt-1 tracking-tight truncate max-w-full">
            <span className="sm:hidden">Dòng Tiền & Nợ</span>
            <span className="hidden sm:inline">Dòng Tiền & Nợ</span>
          </span>
        </button>

        {/* Mục Tiêu Tích Sản */}
        <button
          type="button"
          onClick={() => onSwitchTab('goals')}
          title="Mục Tiêu Tích Sản"
          className={`flex flex-col items-center justify-center min-h-[52px] py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative select-none ${
            currentTab === 'goals'
              ? 'bg-blue-50 text-blue-800 font-black shadow-xs ring-1 ring-blue-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Target
              className={`w-6 h-6 sm:w-5 sm:h-5 ${
                currentTab === 'goals' ? 'text-blue-600 scale-105' : 'text-slate-400'
              } transition-transform`}
            />
            {goalCount > 0 && (
              <span className="absolute -top-1 -right-2.5 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-micro font-black leading-none">
                {goalCount}
              </span>
            )}
          </div>
          <span className="text-micro sm:text-caption font-bold mt-1 tracking-tight truncate max-w-full">
            <span className="sm:hidden">Mục Tiêu</span>
            <span className="hidden sm:inline">Mục Tiêu Tích Sản</span>
          </span>
        </button>

        {/* Thị Trường & Vĩ Mô */}
        <button
          type="button"
          onClick={() => onSwitchTab('market')}
          title="Thị Trường & Vĩ Mô"
          className={`flex flex-col items-center justify-center min-h-[52px] py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative select-none ${
            currentTab === 'market'
              ? 'bg-amber-50 text-amber-900 font-black shadow-xs ring-1 ring-amber-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <TrendingUp
              className={`w-6 h-6 sm:w-5 sm:h-5 ${
                currentTab === 'market' ? 'text-amber-600 scale-105' : 'text-slate-400'
              } transition-transform`}
            />
            <span className="absolute -top-1 -right-3 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-micro font-black leading-none">
              Live
            </span>
          </div>
          <span className="text-micro sm:text-caption font-bold mt-1 tracking-tight truncate max-w-full">
            <span className="sm:hidden">Thị Trường</span>
            <span className="hidden sm:inline">Thị Trường & Vĩ Mô</span>
          </span>
        </button>

        {/* Tiện Ích & Đời Sống */}
        <button
          type="button"
          onClick={() => onSwitchTab('utilities')}
          title="Tiện Ích & Đời Sống"
          className={`flex flex-col items-center justify-center min-h-[52px] py-1.5 px-0.5 sm:px-2 rounded-xl transition cursor-pointer relative select-none ${
            currentTab === 'utilities'
              ? 'bg-purple-50 text-purple-900 font-black shadow-xs ring-1 ring-purple-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold'
          }`}
        >
          <div className="relative">
            <Sparkles
              className={`w-6 h-6 sm:w-5 sm:h-5 ${
                currentTab === 'utilities' ? 'text-purple-600 scale-105' : 'text-slate-400'
              } transition-transform`}
            />
          </div>
          <span className="text-micro sm:text-caption font-bold mt-1 tracking-tight truncate max-w-full">
            <span className="sm:hidden">Tiện Ích</span>
            <span className="hidden sm:inline">Tiện Ích & Đời Sống</span>
          </span>
        </button>
      </div>
    </nav>
  );
};
