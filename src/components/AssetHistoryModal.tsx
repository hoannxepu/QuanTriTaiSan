import React, { useState } from 'react';
import { Asset, Goal, AssetTransaction, DatabaseState } from '../types';
import { formatVND, formatNumberString, parseFormattedNumber, formatDateVN } from '../utils/format';
import {
  X,
  History,
  Plus,
  Trash2,
  Pen,
  Calendar,
  DollarSign,
  TrendingUp,
  Tag,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface AssetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: Asset | null;
  goal?: Goal | null;
  db: DatabaseState;
  isPrivacyMode: boolean;
  onSaveTransactions: (updatedTxs: AssetTransaction[], updatedAsset?: Asset, updatedGoal?: Goal) => void;
}

export const AssetHistoryModal: React.FC<AssetHistoryModalProps> = ({
  isOpen,
  onClose,
  asset,
  goal,
  db,
  isPrivacyMode,
  onSaveTransactions,
}) => {
  if (!isOpen || (!asset && !goal)) return null;

  // Resolve two-way linked asset and goal
  const resolvedAsset =
    asset ||
    (goal?.linkedAssetId
      ? db.assets.find((a) => a.id === goal.linkedAssetId)
      : db.assets.find((a) => a.name.toLowerCase() === goal?.name.toLowerCase()));
  const resolvedGoal =
    goal ||
    db.goals.find(
      (g) =>
        (resolvedAsset && g.linkedAssetId === resolvedAsset.id) ||
        (resolvedAsset && g.name.toLowerCase() === resolvedAsset.name.toLowerCase())
    );

  // Determine target item metadata
  const targetId = resolvedAsset?.id || goal?.linkedAssetId;
  const goalId = resolvedGoal?.id || goal?.id;
  const itemName = resolvedAsset?.name || resolvedGoal?.name || goal?.name || 'Tài sản';
  const itemType = resolvedAsset?.type || resolvedGoal?.assetType || goal?.assetType || 'stock';
  const unit =
    resolvedGoal?.unit || resolvedAsset?.unit || goal?.unit || (itemType === 'stock' ? 'CP' : itemType === 'gold' ? 'chỉ' : 'VNĐ');

  // Filter transactions belonging to this asset or goal
  const allTxs = db.transactions || [];
  const currentItemTxs = allTxs.filter((t) => {
    if (targetId && t.assetId === targetId) return true;
    if (goalId && t.goalId === goalId) return true;
    if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
    if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
    if (resolvedGoal?.linkedBankKey && t.assetName && t.assetName.toLowerCase().includes(resolvedGoal.linkedBankKey.toLowerCase())) return true;
    return false;
  });

  // Sort descending by date
  const sortedTxs = [...currentItemTxs].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });

  // Form states for adding / editing a single transaction
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txAction, setTxAction] = useState<'buy' | 'deposit' | 'sell' | 'withdraw'>('buy');
  const [txQtyStr, setTxQtyStr] = useState<string>('');
  const [txUnitPriceStr, setTxUnitPriceStr] = useState<string>('');
  const [txTotalAmountStr, setTxTotalAmountStr] = useState<string>('');
  const [txNote, setTxNote] = useState<string>('');
  const [customMarketPriceStr, setCustomMarketPriceStr] = useState<string>('');
  const [isEditingMarketPrice, setIsEditingMarketPrice] = useState<boolean>(false);

  // Auto-calculate Total Amount when Qty or Unit Price changes
  const handleQtyChange = (val: string) => {
    setTxQtyStr(val);
    const qty = parseFormattedNumber(val);
    const price = parseFormattedNumber(txUnitPriceStr);
    if (qty > 0 && price > 0) {
      setTxTotalAmountStr(formatNumberString(Math.round(qty * price), false));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    const formatted = formatNumberString(val, false);
    setTxUnitPriceStr(formatted);
    const price = parseFormattedNumber(formatted);
    const qty = parseFormattedNumber(txQtyStr);
    if (qty > 0 && price > 0) {
      setTxTotalAmountStr(formatNumberString(Math.round(qty * price), false));
    }
  };

  // Aggregated calculations from transactions
  let totalQty = 0;
  let totalCost = 0;

  currentItemTxs.forEach((t) => {
    if (t.type === 'buy' || t.type === 'deposit') {
      totalQty += t.quantity || 0;
      totalCost += t.totalAmount || (t.quantity || 0) * (t.pricePerUnit || 0);
    } else if (t.type === 'sell' || t.type === 'withdraw') {
      totalQty = Math.max(0, totalQty - (t.quantity || 0));
      totalCost = Math.max(0, totalCost - (t.totalAmount || 0));
    }
  });

  // If no transactions yet, fallback to asset/goal existing state
  const hasRecordedTxs = currentItemTxs.length > 0;
  const effectiveQty = hasRecordedTxs ? totalQty : (asset?.quantity || goal?.totalBought || 0);
  const effectiveCost = hasRecordedTxs ? totalCost : (asset?.costPrice || (goal?.costPrice || 0));
  const avgCostPerUnit = effectiveQty > 0 && effectiveCost > 0 ? Math.round(effectiveCost / effectiveQty) : (asset?.unitPrice || goal?.unitPrice || 0);

  // Market price
  const currentMarketPricePerUnit =
    parseFormattedNumber(customMarketPriceStr) > 0
      ? parseFormattedNumber(customMarketPriceStr)
      : (asset?.currentPrice || goal?.currentPrice || (effectiveQty > 0 && asset?.amount ? Math.round(asset.amount / effectiveQty) : avgCostPerUnit));

  const totalMarketVal = effectiveQty > 0 ? (currentMarketPricePerUnit > 0 ? effectiveQty * currentMarketPricePerUnit : asset?.amount || 0) : (asset?.amount || 0);
  const pnlAmount = totalMarketVal - effectiveCost;
  const pnlPercent = effectiveCost > 0 ? ((pnlAmount / effectiveCost) * 100).toFixed(1) : '0';
  const isGain = pnlAmount >= 0;

  // Start edit transaction
  const handleStartEditTx = (tx: AssetTransaction) => {
    setEditingTxId(tx.id);
    setTxDate(tx.date || new Date().toISOString().split('T')[0]);
    setTxAction(tx.type || 'buy');
    setTxQtyStr(formatNumberString(tx.quantity || 0));
    setTxUnitPriceStr(formatNumberString(tx.pricePerUnit || 0));
    setTxTotalAmountStr(formatNumberString(tx.totalAmount || 0));
    setTxNote(tx.note || '');
    setShowAddForm(true);
  };

  // Reset form
  const resetForm = () => {
    setEditingTxId(null);
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxAction('buy');
    setTxQtyStr('');
    setTxUnitPriceStr('');
    setTxTotalAmountStr('');
    setTxNote('');
    setShowAddForm(false);
  };

  // Save Transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFormattedNumber(txQtyStr);
    const unitPrice = parseFormattedNumber(txUnitPriceStr);
    let totalAmt = parseFormattedNumber(txTotalAmountStr);

    if (qty <= 0 && totalAmt <= 0) {
      alert('Vui lòng nhập số lượng hoặc tổng số tiền của đợt tích lũy/mua gom!');
      return;
    }

    if (totalAmt <= 0 && qty > 0 && unitPrice > 0) {
      totalAmt = qty * unitPrice;
    }

    const newTx: AssetTransaction = {
      id: editingTxId || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      assetId: targetId,
      goalId: goalId,
      assetName: itemName,
      date: txDate,
      type: txAction,
      quantity: qty,
      unit: unit,
      pricePerUnit: unitPrice > 0 ? unitPrice : (qty > 0 && totalAmt > 0 ? Math.round(totalAmt / qty) : 0),
      totalAmount: totalAmt,
      note: txNote.trim(),
      createdAt: new Date().toISOString(),
    };

    let updatedTxs: AssetTransaction[];
    if (editingTxId) {
      updatedTxs = allTxs.map((t) => (t.id === editingTxId ? newTx : t));
    } else {
      updatedTxs = [newTx, ...allTxs];
    }

    // Recompute stats
    let newTotalQty = 0;
    let newTotalCost = 0;
    const thisItemUpdatedTxs = updatedTxs.filter((t) => {
      if (targetId && t.assetId === targetId) return true;
      if (goalId && t.goalId === goalId) return true;
      if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
      if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
      if (resolvedGoal?.linkedBankKey && t.assetName && t.assetName.toLowerCase().includes(resolvedGoal.linkedBankKey.toLowerCase())) return true;
      return false;
    });

    thisItemUpdatedTxs.forEach((t) => {
      if (t.type === 'buy' || t.type === 'deposit') {
        newTotalQty += t.quantity || 0;
        newTotalCost += t.totalAmount || 0;
      } else if (t.type === 'sell' || t.type === 'withdraw') {
        newTotalQty = Math.max(0, newTotalQty - (t.quantity || 0));
        newTotalCost = Math.max(0, newTotalCost - (t.totalAmount || 0));
      }
    });

    const newAvgCost = newTotalQty > 0 && newTotalCost > 0 ? Math.round(newTotalCost / newTotalQty) : 0;
    const effectiveMarketPrice =
      currentMarketPricePerUnit > 0
        ? currentMarketPricePerUnit
        : (resolvedAsset?.currentPrice || resolvedGoal?.currentPrice || newAvgCost);
    const newMarketVal =
      itemType === 'saving' || itemType === 'cash'
        ? (newTotalCost > 0 ? newTotalCost : newTotalQty)
        : (newTotalQty > 0 ? (effectiveMarketPrice > 0 ? newTotalQty * effectiveMarketPrice : newTotalCost) : 0);

    // Prepare updated Asset & Goal
    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      if (resolvedAsset.type === 'stock' || resolvedAsset.type === 'gold') {
        updatedAsset = {
          ...resolvedAsset,
          quantity: newTotalQty,
          costPrice: newTotalCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedAsset.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedAsset.currentPrice,
          amount: newMarketVal,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      } else {
        updatedAsset = {
          ...resolvedAsset,
          amount: newMarketVal,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      }
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      updatedGoal = {
        ...resolvedGoal,
        totalBought: newTotalQty,
        costPrice: newTotalCost,
        unitPrice: newAvgCost > 0 ? newAvgCost : resolvedGoal.unitPrice,
        currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedGoal.currentPrice,
      };
    }

    onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
    resetForm();
  };

  // Delete transaction
  const executeDeleteTx = (txId: string) => {
    const updatedTxs = allTxs.filter((t) => t.id !== txId);

    // Recompute stats
    let newTotalQty = 0;
    let newTotalCost = 0;
    const thisItemUpdatedTxs = updatedTxs.filter((t) => {
      if (targetId && t.assetId === targetId) return true;
      if (goalId && t.goalId === goalId) return true;
      if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
      if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
      if (resolvedGoal?.linkedBankKey && t.assetName && t.assetName.toLowerCase().includes(resolvedGoal.linkedBankKey.toLowerCase())) return true;
      return false;
    });

    thisItemUpdatedTxs.forEach((t) => {
      if (t.type === 'buy' || t.type === 'deposit') {
        newTotalQty += t.quantity || 0;
        newTotalCost += t.totalAmount || 0;
      } else if (t.type === 'sell' || t.type === 'withdraw') {
        newTotalQty = Math.max(0, newTotalQty - (t.quantity || 0));
        newTotalCost = Math.max(0, newTotalCost - (t.totalAmount || 0));
      }
    });

    const newAvgCost = newTotalQty > 0 && newTotalCost > 0 ? Math.round(newTotalCost / newTotalQty) : 0;
    const effectiveMarketPrice =
      currentMarketPricePerUnit > 0
        ? currentMarketPricePerUnit
        : (resolvedAsset?.currentPrice || resolvedGoal?.currentPrice || newAvgCost);
    const newMarketVal =
      itemType === 'saving' || itemType === 'cash'
        ? (newTotalCost > 0 ? newTotalCost : newTotalQty)
        : (newTotalQty > 0 ? (effectiveMarketPrice > 0 ? newTotalQty * effectiveMarketPrice : newTotalCost) : 0);

    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      if (resolvedAsset.type === 'stock' || resolvedAsset.type === 'gold') {
        updatedAsset = {
          ...resolvedAsset,
          quantity: newTotalQty,
          costPrice: newTotalCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedAsset.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedAsset.currentPrice,
          amount: newMarketVal,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      } else {
        updatedAsset = {
          ...resolvedAsset,
          amount: newMarketVal,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      }
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      updatedGoal = {
        ...resolvedGoal,
        totalBought: newTotalQty,
        costPrice: newTotalCost,
        unitPrice: newAvgCost > 0 ? newAvgCost : resolvedGoal.unitPrice,
        currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedGoal.currentPrice,
      };
    }

    onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
  };

  // Update Market Price directly from modal
  const handleSaveMarketPrice = () => {
    const newPrice = parseFormattedNumber(customMarketPriceStr);
    if (newPrice <= 0) {
      setIsEditingMarketPrice(false);
      return;
    }
    const newMarketVal = effectiveQty > 0 ? effectiveQty * newPrice : totalMarketVal;

    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      updatedAsset = {
        ...resolvedAsset,
        currentPrice: newPrice,
        amount: newMarketVal,
        updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
      };
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      updatedGoal = {
        ...resolvedGoal,
        currentPrice: newPrice,
      };
    }

    onSaveTransactions(allTxs, updatedAsset, updatedGoal);
    setIsEditingMarketPrice(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{itemName}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                  Lịch Sử Tích Lũy / Mua Gom ({sortedTxs.length} đợt)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Theo dõi chi tiết từng đợt mua gom, tự động tính đơn giá vốn trung bình & đồng bộ Tab 1 & Tab 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition cursor-pointer shrink-0"
            title="Đóng bảng lịch sử"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUMMARY STATS BAR */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-xs">
          {/* Card 1: Khối lượng */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Tổng Gom Tích Lũy</span>
            <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
              {formatNumberString(effectiveQty)} {unit}
            </div>
            <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
              {sortedTxs.length > 0 ? `${sortedTxs.length} đợt giao dịch` : 'Chưa có đợt mua'}
            </span>
          </div>

          {/* Card 2: Giá vốn trung bình */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Đơn Giá Vốn TB (1 {unit})</span>
            <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
              {avgCostPerUnit > 0 ? formatVND(avgCostPerUnit, isPrivacyMode) : '—'}
            </div>
            <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
              Tổng vốn: {formatVND(effectiveCost, isPrivacyMode)}
            </span>
          </div>

          {/* Card 3: Giá thị trường hiện tại */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Giá Thị Trường (1 {unit})</span>
              <button
                onClick={() => {
                  setCustomMarketPriceStr(formatNumberString(currentMarketPricePerUnit));
                  setIsEditingMarketPrice(!isEditingMarketPrice);
                }}
                className="text-[9.5px] text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {isEditingMarketPrice ? 'Hủy' : 'Đổi giá'}
              </button>
            </div>
            {isEditingMarketPrice ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={customMarketPriceStr}
                  onChange={(e) => setCustomMarketPriceStr(formatNumberString(e.target.value, false))}
                  placeholder="Giá mới..."
                  className="w-full bg-white border border-blue-400 rounded-lg p-1 text-[11px] font-bold text-blue-700 outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveMarketPrice}
                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs sm:text-sm font-black text-blue-700 mt-0.5">
                  {currentMarketPricePerUnit > 0 ? formatVND(currentMarketPricePerUnit, isPrivacyMode) : '—'}
                </div>
                <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                  Tổng TT: {formatVND(totalMarketVal, isPrivacyMode)}
                </span>
              </>
            )}
          </div>

          {/* Card 4: Lãi / Lỗ */}
          <div className={`border rounded-xl p-2.5 ${isGain ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
            <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Lãi / Lỗ Ước Tính</span>
            <div className={`text-xs sm:text-sm font-black mt-0.5 ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isGain ? '+' : ''}
              {pnlPercent}% ({formatVND(pnlAmount, isPrivacyMode)})
            </div>
            <span className="text-[9.5px] text-slate-500 font-medium block mt-0.5">
              {isGain ? '🟢 Sinh lời so với vốn' : '🔴 Tạm lỗ so với vốn'}
            </span>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ACTION BUTTON & FORM ACCORDION */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Nhật Ký Các Đợt Mua / Nạp Tích Sản</span>
            </h4>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  setEditingTxId(null);
                  setTxDate(new Date().toISOString().split('T')[0]);
                  setTxAction('buy');
                  setTxQtyStr('');
                  setTxUnitPriceStr(currentMarketPricePerUnit > 0 ? formatNumberString(currentMarketPricePerUnit) : '');
                  setTxTotalAmountStr('');
                  setTxNote('');
                  setShowAddForm(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ghi Nhận Đợt Mua Mới</span>
              </button>
            )}
          </div>

          {/* INLINE FORM FOR ADD / EDIT TRANSACTION */}
          {showAddForm && (
            <form
              onSubmit={handleSaveTransaction}
              className="bg-slate-50 border border-emerald-300 ring-2 ring-emerald-100 rounded-2xl p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Pen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{editingTxId ? 'Chỉnh Sửa Đợt Giao Dịch' : 'Thêm Đợt Mua / Gom Tích Sản Mới'}</span>
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* Ngày mua */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Ngày Giao Dịch</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Hành động */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Loại Hành Động</label>
                  <select
                    value={txAction}
                    onChange={(e) => setTxAction(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  >
                    <option value="buy">Mua gom tích sản (DCA)</option>
                    <option value="deposit">Nạp thêm / Gửi thêm</option>
                    <option value="sell">Bán bớt chốt lời</option>
                    <option value="withdraw">Rút bớt thanh khoản</option>
                  </select>
                </div>

                {/* Số lượng */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                    Số Lượng Mua ({unit})
                  </label>
                  <input
                    type="text"
                    value={txQtyStr}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    placeholder={unit === 'VNĐ' ? 'Số tiền' : 'Ví dụ: 1'}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Đơn giá mua */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                    Đơn Giá Mua (VNĐ/1 {unit})
                  </label>
                  <input
                    type="text"
                    value={txUnitPriceStr}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    placeholder="Ví dụ: 8.200.000"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Thành tiền */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                    Tổng Thành Tiền Đợt Này (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={txTotalAmountStr}
                    onChange={(e) => setTxTotalAmountStr(formatNumberString(e.target.value, false))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-blue-700 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Ghi chú */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Ghi Chú Đợt Mua</label>
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="Ví dụ: Tiệm Bảo Tín Minh Châu, Khớp lệnh ATC..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  {editingTxId ? '✓ Cập Nhật Đợt Này' : '+ Lưu Đợt Mua Vào Lịch Sử'}
                </button>
              </div>
            </form>
          )}

          {/* LIST OF TRANSACTIONS */}
          {sortedTxs.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700">Chưa có lịch sử các đợt mua nào được ghi nhận</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Bấm nút <b>"+ Ghi Nhận Đợt Mua Mới"</b> ở trên để bắt đầu lưu lại ngày mua, số lượng và đơn giá từng lần gom.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Mobile View (< sm) */}
              <div className="sm:hidden space-y-2">
                {sortedTxs.map((tx, idx) => {
                  const isBuy = tx.type === 'buy' || tx.type === 'deposit';
                  return (
                    <div
                      key={tx.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-900 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateVN(tx.date)}</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isBuy ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {isBuy ? '✓ Mua gom' : 'Bán / Rút'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                        <div>
                          <div className="text-xs font-black text-emerald-700">
                            {formatNumberString(tx.quantity)} {tx.unit || unit}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Đơn giá: {formatVND(tx.pricePerUnit, isPrivacyMode)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900">
                            {formatVND(tx.totalAmount, isPrivacyMode)}
                          </div>
                          {tx.note && <div className="text-[9.5px] text-slate-400 italic truncate max-w-[120px]">{tx.note}</div>}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-1.5">
                        <button
                          onClick={() => handleStartEditTx(tx)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Pen className="w-2.5 h-2.5" /> Sửa
                        </button>
                        <button
                          onClick={() => setTxToDelete(tx.id)}
                          className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= sm) */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-3 text-center w-8">#</th>
                      <th className="py-2 px-3">Ngày Giao Dịch</th>
                      <th className="py-2 px-3 text-center">Hành Động</th>
                      <th className="py-2 px-3 text-right">Khối Lượng</th>
                      <th className="py-2 px-3 text-right">Đơn Giá Mua</th>
                      <th className="py-2 px-3 text-right">Tổng Thành Tiền</th>
                      <th className="py-2 px-3">Ghi Chú</th>
                      <th className="py-2 px-3 text-center w-20">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700 text-[11.5px]">
                    {sortedTxs.map((tx, idx) => {
                      const isBuy = tx.type === 'buy' || tx.type === 'deposit';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDateVN(tx.date)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                                isBuy
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {isBuy ? '✓ Mua gom' : 'Bán / Rút'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-700">
                            {formatNumberString(tx.quantity)} {tx.unit || unit}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-800">
                            {formatVND(tx.pricePerUnit, isPrivacyMode)}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">
                            {formatVND(tx.totalAmount, isPrivacyMode)}
                          </td>
                          <td className="py-2 px-3 text-slate-500 max-w-[180px] truncate text-[11px]">
                            {tx.note || '—'}
                          </td>
                          <td className="py-2 px-3 text-center space-x-1">
                            <button
                              onClick={() => handleStartEditTx(tx)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="Sửa"
                            >
                              <Pen className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setTxToDelete(tx.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Đã đồng bộ tự động với <b>Tab 1 (Tháp Tài Sản)</b> & <b>Tab 3 (Mục Tiêu Tích Sản)</b>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Delete Transaction Confirmation Modal */}
      <ConfirmModal
        isOpen={!!txToDelete}
        title="Xác nhận xóa giao dịch"
        message="Bạn có chắc chắn muốn xóa bản ghi giao dịch này?"
        subMessage="Số lượng, giá vốn trung bình và tổng tài sản liên quan sẽ được tự động tính toán lại."
        confirmText="Xóa giao dịch"
        onConfirm={() => {
          if (txToDelete) {
            executeDeleteTx(txToDelete);
            setTxToDelete(null);
          }
        }}
        onClose={() => setTxToDelete(null)}
      />
    </div>
  );
};
