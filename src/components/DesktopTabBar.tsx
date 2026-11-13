import React from 'react';
import { Layers, Scale, Target, TrendingUp, Sparkles } from 'lucide-react';
import { ActiveTab } from '../types';

interface DesktopTabBarProps {
  currentTab: ActiveTab;
  onSwitchTab: (tab: ActiveTab) => void;
  assetCount?: number;
  debtCount?: number;
  goalCount?: number;
}

export const DesktopTabBar: React.FC<DesktopTabBarProps> = ({
  currentTab,
  onSwitchTab,
  assetCount = 0,
  debtCount = 0,
  goalCount = 0,
}) => {
  const tabs: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
  }[] = [
    {
      id: 'pyramid',
      label: 'Tháp Tài Sản',
      icon: Layers,
      badge: assetCount > 0 ? assetCount : undefined,
      badgeColor: 'bg-emerald-500 text-white',
    },
    {
      id: 'debts',
      label: 'Dòng Tiền & Nợ',
      icon: Scale,
      badge: debtCount > 0 ? debtCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'goals',
      label: 'Mục Tiêu Tích Sản',
      icon: Target,
      badge: goalCount > 0 ? goalCount : undefined,
      badgeColor: 'bg-blue-500 text-white',
    },
    {
      id: 'market',
      label: 'Thị Trường & Vĩ Mô',
      icon: TrendingUp,
      badge: 'Live',
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'utilities',
      label: 'Tiện Ích & Đời Sống',
      icon: Sparkles,
    },
  ];

  return (
    <div className="hidden lg:block w-full border-t border-slate-100 bg-white/80 backdrop-blur-xs py-1.5">
      <div className="flex items-center space-x-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSwitchTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-semibold'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-1.5 px-2 py-0.5 rounded-full text-micro font-bold ${
                    isActive ? 'bg-white/20 text-white' : tab.badgeColor
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
