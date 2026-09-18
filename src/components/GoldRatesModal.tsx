import React from 'react';
import { GoldRateData, GoldRateItem } from '../utils/goldService';
import { formatVND } from '../utils/format';
import { X, RefreshCw, Sparkles, TrendingUp, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react';

interface GoldRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  goldData: GoldRateData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onApplyAllGoldGoals: () => void;
  isPrivacyMode: boolean;
}

export const GoldRatesModal: React.FC<GoldRatesModalProps> = ({
  isOpen,
  onClose,
  goldData,
  isLoading,
  onRefresh,
  onApplyAllGoldGoals,
  isPrivacyMode,
}) => {
  const [activeTab, setActiveTab] = React.useState<'doji' | 'nhan' | 'sjc' | 'all'>('doji');

  if (!isOpen) return null;

  const items = goldData?.items || [];
  const filteredItems = items.filter((item) => {
    if (activeTab === 'doji') return item.brand === 'DOJI' || item.name.includes('DOJI');
    if (activeTab === 'nhan') return item.category === 'nhan_9999';
    if (activeTab === 'sjc') return item.category === 'sjc_mieng';
    return true;
  });

  const dojiBuy = goldData?.summary.dojiBuyPerChi || 14400000;
  const dojiSell = goldData?.summary.dojiSellPerChi || 14800000;
  const dojiLuongSell = goldData?.summary.dojiSellPerLuong || dojiSell * 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 font-bold">
              <Sparkles className="w-5 h-5 text-yellow-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Bảng Giá Vàng Thị Trường Mới Nhất</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  Live Feed
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {goldData?.updatedAtStr || 'Đang cập nhật từ thị trường Việt Nam...'} • Nguồn: {goldData?.source || 'SJC & Tổng hợp'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-slate-600 hover:text-amber-700 hover:bg-amber-100/60 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Làm mới giá từ web"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Quick Summary Cards */}
          {goldData?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* DOJI - Trọng tâm tự động */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-amber-500/5 border-2 border-amber-400 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                    <span>DOJI (Nhẫn 9999)</span>
                  </div>
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-600 text-white rounded">
                    Tự động đồng bộ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-rose-700 font-semibold block">Bán ra (Mục tiêu T3):</span>
                    <span className="text-xs sm:text-sm font-black text-rose-950">
                      {formatVND(dojiSell, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 font-semibold block">Mua vào (Tài sản T1):</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-950">
                      {formatVND(dojiBuy, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                </div>
                <div className="text-[10px] text-amber-900 border-t border-amber-200/80 pt-1 flex justify-between">
                  <span>Quy đổi / lượng:</span>
                  <span className="font-bold">{formatVND(dojiLuongSell, isPrivacyMode)}</span>
                </div>
              </div>

              {/* Vàng Nhẫn 9999 Tham Chiếu */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Vàng Nhẫn 9999 (Chung)</span>
                  </div>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                    Tham khảo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Giá Bán Ra:</span>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {formatVND(goldData.summary.nhan9999SellPerChi, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Giá Mua Vào:</span>
                    <span className="text-xs sm:text-sm font-black text-slate-700">
                      {formatVND(goldData.summary.nhan9999BuyPerChi, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-600 border-t border-slate-200 pt-1 flex justify-between">
                  <span>Quy đổi / lượng:</span>
                  <span className="font-bold">{formatVND(goldData.summary.nhan9999SellPerChi * 10, isPrivacyMode)}</span>
                </div>
              </div>

              {/* Vàng Miếng SJC Tham Chiếu */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
                    <span>Vàng Miếng SJC</span>
                  </div>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                    Tham khảo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Giá Bán Ra:</span>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {formatVND(goldData.summary.sjcSellPerChi, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Giá Mua Vào:</span>
                    <span className="text-xs sm:text-sm font-black text-slate-700">
                      {formatVND(goldData.summary.sjcBuyPerChi, isPrivacyMode)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-medium">đ/chỉ</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-600 border-t border-slate-200 pt-1 flex justify-between">
                  <span>Quy đổi / lượng:</span>
                  <span className="font-bold">{formatVND(goldData.summary.sjcSellPerLuong, isPrivacyMode)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Filter */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('doji')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'doji'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>⭐ DOJI</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-black ${activeTab === 'doji' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {items.filter((i) => i.brand === 'DOJI' || i.name.includes('DOJI')).length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('nhan')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'nhan'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Vàng Nhẫn 9999
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sjc')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'sjc'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Vàng Miếng SJC
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({items.length})
              </button>
            </div>
          </div>

          {/* Table List of Rates */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Thương Hiệu / Loại Vàng</th>
                  <th className="py-2.5 px-3 text-right">Mua Vào (đ/chỉ)</th>
                  <th className="py-2.5 px-3 text-right">Bán Ra (đ/chỉ)</th>
                  <th className="py-2.5 px-3 text-right hidden sm:table-cell">Bán Ra (đ/lượng)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((item, idx) => (
                  <tr key={`${item.brand}-${item.name}-${idx}`} className="hover:bg-amber-50/40 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{item.brand}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                      {formatVND(item.buyPerChi, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-amber-800">
                      {formatVND(item.sellPerChi, isPrivacyMode)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 hidden sm:table-cell">
                      {formatVND(item.sellPerLuong, isPrivacyMode)}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs italic">
                      Chưa có dữ liệu cho phân loại này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50">
          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 text-center sm:text-left">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Giá vàng được hệ thống tự động đồng bộ liên tục vào Mục tiêu & Tài sản</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
            >
              Đóng Bảng Giá
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
