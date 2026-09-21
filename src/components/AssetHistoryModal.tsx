import React, { useState } from 'react';
import { Asset, Goal, AssetTransaction, DatabaseState } from '../types';
import { formatVND, formatNumberString, parseFormattedNumber, formatDateVN, normalizeDateStr } from '../utils/format';
import { extractBankFromAssetName } from '../utils/bankUtils';
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
  Building2,
  Percent,
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

  // Check if item is Bank / Saving / Cash
  const isSavingOrCash =
    itemType === 'saving' ||
    itemType === 'cash' ||
    resolvedGoal?.assetType === 'saving' ||
    resolvedGoal?.assetType === 'cash' ||
    unit === 'VNĐ' ||
    unit === 'VND' ||
    unit === 'đ' ||
    unit === 'sổ' ||
    Boolean(resolvedGoal?.linkedBankKey) ||
    /\b(sổ|tiết kiệm|saving|bank|tiền gửi|ncb|vcb|bidv|agribank|vietinbank|vpbank|mbbank|tcb|acb|hdbank|ocb|shb|tpbank|msb|vib|scb|lienvietpostbank|lpbank|seabank|bacabank|baoviet|pvcombank|vietbank|saigonbank|kienlongbank|dongabank|oceanbank|gpbank|cbbank)\b/i.test(itemName);

  // Bank name & icon for saving
  const bankInfo = isSavingOrCash ? extractBankFromAssetName(itemName) : null;

  // Tìm các sổ tiết kiệm liên quan ở Tab 1
  const relatedSavingAssets = isSavingOrCash
    ? db.assets.filter((a) => {
        if (a.type !== 'saving') return false;
        if (resolvedAsset && a.id === resolvedAsset.id) return true;
        if (resolvedGoal?.linkedBankKey && a.name.toLowerCase().includes(resolvedGoal.linkedBankKey.toLowerCase())) return true;
        if (bankInfo?.bankName && bankInfo.bankName !== 'Ngân hàng khác' && extractBankFromAssetName(a.name).bankName === bankInfo.bankName) return true;
        if (itemName && a.name.toLowerCase().includes(itemName.toLowerCase())) return true;
        return false;
      })
    : [];

  const relatedAssetIds = new Set(relatedSavingAssets.map((a) => a.id));
  if (targetId) relatedAssetIds.add(targetId);

  // Filter recorded transactions from db.transactions
  const allTxs = db.transactions || [];
  const currentItemTxs = allTxs.filter((t) => {
    if (t.assetId && relatedAssetIds.has(t.assetId)) return true;
    if (targetId && t.assetId === targetId) return true;
    if (goalId && t.goalId === goalId) return true;
    if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
    if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
    if (resolvedGoal?.linkedBankKey && t.assetName && t.assetName.toLowerCase().includes(resolvedGoal.linkedBankKey.toLowerCase())) return true;
    return false;
  });

  // Khởi tạo các giao dịch gốc ban đầu nếu trong db.transactions chưa ghi nhận sổ gốc
  const initialVirtualSavingTxs: AssetTransaction[] = [];
  if (isSavingOrCash) {
    const assetsToCheck = relatedSavingAssets.length > 0 ? relatedSavingAssets : (resolvedAsset ? [resolvedAsset] : []);
    assetsToCheck.forEach((a) => {
      const hasTx = currentItemTxs.some((t) => t.assetId === a.id);
      if (!hasTx && (a.amount || 0) > 0) {
        initialVirtualSavingTxs.push({
          id: `init_asset_${a.id}`,
          assetId: a.id,
          goalId: goalId,
          assetName: a.name,
          date: a.startDate ? normalizeDateStr(a.startDate) : (a.updatedAt ? normalizeDateStr(a.updatedAt) : new Date().toISOString().split('T')[0]),
          type: 'deposit',
          quantity: a.amount,
          unit: 'VNĐ',
          pricePerUnit: 1,
          totalAmount: a.amount,
          rate: a.rate || 5.5,
          termMonths: a.termMonths || 12,
          note: `Số dư gốc ban đầu (${a.rate ? `${a.rate}%/năm` : '5.5%/năm'}, ${a.termMonths || 12} tháng)`,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  // Kết hợp transactions thực tế và các sổ gốc
  const mergedTxs = [...currentItemTxs, ...initialVirtualSavingTxs];

  // Sort descending by date
  const sortedTxs = [...mergedTxs].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });

  // Form states for adding / editing a single transaction
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txAction, setTxAction] = useState<'buy' | 'deposit' | 'sell' | 'withdraw'>('deposit');
  const [txQtyStr, setTxQtyStr] = useState<string>('');
  const [txUnitPriceStr, setTxUnitPriceStr] = useState<string>('');
  const [txTotalAmountStr, setTxTotalAmountStr] = useState<string>('');
  const [txRateStr, setTxRateStr] = useState<string>(resolvedAsset?.rate ? String(resolvedAsset.rate) : '5.5');
  const [txTermMonthsStr, setTxTermMonthsStr] = useState<string>(resolvedAsset?.termMonths ? String(resolvedAsset.termMonths) : '12');
  const [txNote, setTxNote] = useState<string>('');
  const [customMarketPriceStr, setCustomMarketPriceStr] = useState<string>('');
  const [isEditingMarketPrice, setIsEditingMarketPrice] = useState<boolean>(false);

  // Auto-calculate Total Amount when Qty or Unit Price changes
  const handleQtyChange = (val: string) => {
    setTxQtyStr(val);
    const qty = parseFormattedNumber(val);
    if (isSavingOrCash) {
      setTxTotalAmountStr(formatNumberString(qty, false));
      setTxUnitPriceStr('1');
      return;
    }
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

  const handleTotalAmountChange = (val: string) => {
    const formatted = formatNumberString(val, false);
    setTxTotalAmountStr(formatted);
    if (isSavingOrCash) {
      setTxQtyStr(formatted);
      setTxUnitPriceStr('1');
    }
  };

  // Aggregated calculations from transactions
  let totalDepositQty = 0;
  let totalDepositAmount = 0;
  let totalWithdrawQty = 0;
  let totalWithdrawAmount = 0;

  mergedTxs.forEach((t) => {
    if (t.type === 'buy' || t.type === 'deposit') {
      totalDepositQty += t.quantity || 0;
      totalDepositAmount += t.totalAmount || (t.quantity || 0) * (t.pricePerUnit || 1);
    } else if (t.type === 'sell' || t.type === 'withdraw') {
      totalWithdrawQty += t.quantity || 0;
      totalWithdrawAmount += t.totalAmount || (t.quantity || 0) * (t.pricePerUnit || 1);
    }
  });

  const netQty = Math.max(0, totalDepositQty - totalWithdrawQty);
  const netAmount = Math.max(0, totalDepositAmount - totalWithdrawAmount);

  // Effective cost / Principal
  const effectiveCost = isSavingOrCash
    ? (netAmount > 0 ? netAmount : (resolvedAsset?.amount || resolvedGoal?.totalBought || 0))
    : (netAmount > 0 ? netAmount : (resolvedAsset?.costPrice || resolvedGoal?.costPrice || 0));

  const effectiveQty = isSavingOrCash
    ? effectiveCost
    : (netQty > 0 ? netQty : (resolvedAsset?.quantity || resolvedGoal?.totalBought || 0));

  const avgCostPerUnit = isSavingOrCash
    ? 1
    : (effectiveQty > 0 && effectiveCost > 0 ? Math.round(effectiveCost / effectiveQty) : (resolvedAsset?.unitPrice || resolvedGoal?.unitPrice || 0));

  // Lãi suất & Lãi dự kiến cho tiết kiệm
  const savingRate = resolvedAsset?.rate || (mergedTxs[0]?.rate) || 5.5;
  const savingTermMonths = resolvedAsset?.termMonths || (mergedTxs[0]?.termMonths) || 12;

  // Tính tổng lãi dự kiến từ từng đợt gửi (hoặc theo số dư chung)
  let calculatedEstInterest = 0;
  if (isSavingOrCash) {
    if (mergedTxs.length > 0) {
      mergedTxs.forEach((t) => {
        if (t.type === 'buy' || t.type === 'deposit') {
          const r = t.rate || savingRate;
          const m = t.termMonths || savingTermMonths;
          calculatedEstInterest += Math.round((t.totalAmount || 0) * (r / 100) * (m / 12));
        } else {
          const r = t.rate || savingRate;
          const m = t.termMonths || savingTermMonths;
          calculatedEstInterest = Math.max(0, calculatedEstInterest - Math.round((t.totalAmount || 0) * (r / 100) * (m / 12)));
        }
      });
    }
    if (calculatedEstInterest <= 0) {
      calculatedEstInterest = Math.round(effectiveCost * (savingRate / 100) * (savingTermMonths / 12));
    }
  }

  // Market price
  const currentMarketPricePerUnit = isSavingOrCash
    ? 1
    : (parseFormattedNumber(customMarketPriceStr) > 0
        ? parseFormattedNumber(customMarketPriceStr)
        : (resolvedAsset?.currentPrice || resolvedGoal?.currentPrice || avgCostPerUnit));

  const totalMarketVal = isSavingOrCash
    ? effectiveCost + calculatedEstInterest
    : (effectiveQty > 0 ? (currentMarketPricePerUnit > 0 ? effectiveQty * currentMarketPricePerUnit : effectiveCost) : 0);

  const pnlAmount = isSavingOrCash ? calculatedEstInterest : (totalMarketVal - effectiveCost);
  const pnlPercent = isSavingOrCash ? String(savingRate) : (effectiveCost > 0 ? ((pnlAmount / effectiveCost) * 100).toFixed(1) : '0');
  const isGain = isSavingOrCash ? true : (pnlAmount >= 0);

  // Start edit transaction
  const handleStartEditTx = (tx: AssetTransaction) => {
    setEditingTxId(tx.id);
    setTxDate(tx.date || new Date().toISOString().split('T')[0]);
    setTxAction(tx.type || (isSavingOrCash ? 'deposit' : 'buy'));
    setTxQtyStr(formatNumberString(tx.quantity || 0));
    setTxUnitPriceStr(formatNumberString(tx.pricePerUnit || 1));
    setTxTotalAmountStr(formatNumberString(tx.totalAmount || 0));
    setTxRateStr(tx.rate ? String(tx.rate) : (resolvedAsset?.rate ? String(resolvedAsset.rate) : '5.5'));
    setTxTermMonthsStr(tx.termMonths ? String(tx.termMonths) : (resolvedAsset?.termMonths ? String(resolvedAsset.termMonths) : '12'));
    setTxNote(tx.note || '');
    setShowAddForm(true);
  };

  // Reset form
  const resetForm = () => {
    setEditingTxId(null);
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxAction(isSavingOrCash ? 'deposit' : 'buy');
    setTxQtyStr('');
    setTxUnitPriceStr(isSavingOrCash ? '1' : '');
    setTxTotalAmountStr('');
    setTxRateStr(resolvedAsset?.rate ? String(resolvedAsset.rate) : '5.5');
    setTxTermMonthsStr(resolvedAsset?.termMonths ? String(resolvedAsset.termMonths) : '12');
    setTxNote('');
    setShowAddForm(false);
  };

  // Save Transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFormattedNumber(txQtyStr);
    const unitPrice = parseFormattedNumber(txUnitPriceStr);
    let totalAmt = parseFormattedNumber(txTotalAmountStr);
    const rateVal = parseFloat(txRateStr) || (resolvedAsset?.rate || 5.5);
    const termVal = parseInt(txTermMonthsStr, 10) || (resolvedAsset?.termMonths || 12);

    let finalQty = qty;
    let finalUnitPrice = unitPrice;

    if (isSavingOrCash) {
      if (totalAmt <= 0 && qty > 0) {
        totalAmt = qty;
      }
      if (finalQty <= 0 && totalAmt > 0) {
        finalQty = totalAmt;
      }
      finalUnitPrice = 1;
    } else {
      if (totalAmt <= 0 && qty > 0 && unitPrice > 0) {
        totalAmt = qty * unitPrice;
      }
    }

    if (finalQty <= 0 && totalAmt <= 0) {
      alert(isSavingOrCash ? 'Vui lòng nhập số tiền gửi tiết kiệm!' : 'Vui lòng nhập số lượng hoặc tổng số tiền tích lũy!');
      return;
    }

    const newTx: AssetTransaction = {
      id: editingTxId && !editingTxId.startsWith('init_')
        ? editingTxId
        : `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      assetId: targetId,
      goalId: goalId,
      assetName: itemName,
      date: txDate,
      type: txAction,
      quantity: finalQty,
      unit: unit,
      pricePerUnit: finalUnitPrice > 0 ? finalUnitPrice : 1,
      totalAmount: totalAmt,
      rate: isSavingOrCash ? rateVal : undefined,
      termMonths: isSavingOrCash ? termVal : undefined,
      note: txNote.trim(),
      createdAt: new Date().toISOString(),
    };

    // Nếu đang chỉnh sửa bản ghi ảo ban đầu init_*, ta cũng giữ lại bản ghi gốc như một tx thực tế
    let updatedTxs: AssetTransaction[];
    if (editingTxId && !editingTxId.startsWith('init_')) {
      updatedTxs = allTxs.map((t) => (t.id === editingTxId ? newTx : t));
    } else {
      // Nếu có các bản ghi gốc ban đầu chưa được lưu vào allTxs, ta biến chúng thành tx thực tế
      const virtualTxsToPersist = initialVirtualSavingTxs
        .filter((vt) => vt.id !== editingTxId)
        .map((vt) => ({ ...vt, id: `tx_init_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` }));
      updatedTxs = [newTx, ...virtualTxsToPersist, ...allTxs];
    }

    // Recompute stats for this asset/goal
    let newDepositQty = 0;
    let newDepositCost = 0;
    let newWithdrawQty = 0;
    let newWithdrawCost = 0;

    const thisItemUpdatedTxs = updatedTxs.filter((t) => {
      if (t.assetId && relatedAssetIds.has(t.assetId)) return true;
      if (targetId && t.assetId === targetId) return true;
      if (goalId && t.goalId === goalId) return true;
      if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
      if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
      return false;
    });

    thisItemUpdatedTxs.forEach((t) => {
      if (t.type === 'buy' || t.type === 'deposit') {
        newDepositQty += t.quantity || 0;
        newDepositCost += t.totalAmount || 0;
      } else if (t.type === 'sell' || t.type === 'withdraw') {
        newWithdrawQty += t.quantity || 0;
        newWithdrawCost += t.totalAmount || 0;
      }
    });

    const newNetCost = Math.max(0, newDepositCost - newWithdrawCost);
    const newNetQty = Math.max(0, newDepositQty - newWithdrawQty);
    const newAvgCost = newNetQty > 0 && newNetCost > 0 ? Math.round(newNetCost / newNetQty) : 0;
    const effectiveMarketPrice =
      currentMarketPricePerUnit > 0
        ? currentMarketPricePerUnit
        : (resolvedAsset?.currentPrice || resolvedGoal?.currentPrice || newAvgCost);

    // Prepare updated Asset & Goal
    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      if (isSavingOrCash) {
        updatedAsset = {
          ...resolvedAsset,
          amount: newNetCost,
          costPrice: newNetCost,
          rate: rateVal || resolvedAsset.rate,
          termMonths: termVal || resolvedAsset.termMonths,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      } else if (resolvedAsset.type === 'stock' || resolvedAsset.type === 'gold') {
        updatedAsset = {
          ...resolvedAsset,
          quantity: newNetQty,
          costPrice: newNetCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedAsset.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedAsset.currentPrice,
          amount: newNetQty > 0 ? Math.round(newNetQty * (effectiveMarketPrice || newAvgCost)) : 0,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      } else {
        updatedAsset = {
          ...resolvedAsset,
          amount: newNetCost,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      }
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      if (isSavingOrCash) {
        updatedGoal = {
          ...resolvedGoal,
          totalBought: newNetCost,
          costPrice: newNetCost,
          unitPrice: 1,
          currentPrice: 1,
        };
      } else {
        updatedGoal = {
          ...resolvedGoal,
          totalBought: newNetQty,
          costPrice: newNetCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedGoal.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedGoal.currentPrice,
        };
      }
    }

    onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
    resetForm();
  };

  // Delete transaction
  const executeDeleteTx = (txId: string) => {
    // Nếu là bản ghi ảo init_* thì không có trong allTxs, bỏ qua
    const updatedTxs = allTxs.filter((t) => t.id !== txId);

    // Recompute stats
    let newDepositQty = 0;
    let newDepositCost = 0;
    let newWithdrawQty = 0;
    let newWithdrawCost = 0;

    const thisItemUpdatedTxs = updatedTxs.filter((t) => {
      if (t.assetId && relatedAssetIds.has(t.assetId)) return true;
      if (targetId && t.assetId === targetId) return true;
      if (goalId && t.goalId === goalId) return true;
      if (resolvedAsset?.name && t.assetName && t.assetName.toLowerCase() === resolvedAsset.name.toLowerCase()) return true;
      if (resolvedGoal?.name && t.assetName && t.assetName.toLowerCase() === resolvedGoal.name.toLowerCase()) return true;
      return false;
    });

    thisItemUpdatedTxs.forEach((t) => {
      if (t.type === 'buy' || t.type === 'deposit') {
        newDepositQty += t.quantity || 0;
        newDepositCost += t.totalAmount || 0;
      } else if (t.type === 'sell' || t.type === 'withdraw') {
        newWithdrawQty += t.quantity || 0;
        newWithdrawCost += t.totalAmount || 0;
      }
    });

    const newNetCost = Math.max(0, newDepositCost - newWithdrawCost);
    const newNetQty = Math.max(0, newDepositQty - newWithdrawQty);
    const newAvgCost = newNetQty > 0 && newNetCost > 0 ? Math.round(newNetCost / newNetQty) : 0;
    const effectiveMarketPrice =
      currentMarketPricePerUnit > 0
        ? currentMarketPricePerUnit
        : (resolvedAsset?.currentPrice || resolvedGoal?.currentPrice || newAvgCost);

    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      if (isSavingOrCash) {
        updatedAsset = {
          ...resolvedAsset,
          amount: newNetCost,
          costPrice: newNetCost,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      } else if (resolvedAsset.type === 'stock' || resolvedAsset.type === 'gold') {
        updatedAsset = {
          ...resolvedAsset,
          quantity: newNetQty,
          costPrice: newNetCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedAsset.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedAsset.currentPrice,
          amount: newNetQty > 0 ? Math.round(newNetQty * (effectiveMarketPrice || newAvgCost)) : 0,
          updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
        };
      }
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      if (isSavingOrCash) {
        updatedGoal = {
          ...resolvedGoal,
          totalBought: newNetCost,
          costPrice: newNetCost,
          unitPrice: 1,
          currentPrice: 1,
        };
      } else {
        updatedGoal = {
          ...resolvedGoal,
          totalBought: newNetQty,
          costPrice: newNetCost,
          unitPrice: newAvgCost > 0 ? newAvgCost : resolvedGoal.unitPrice,
          currentPrice: effectiveMarketPrice > 0 ? effectiveMarketPrice : resolvedGoal.currentPrice,
        };
      }
    }

    onSaveTransactions(updatedTxs, updatedAsset, updatedGoal);
    setTxToDelete(null);
  };

  // Quick Market price edit for DCA assets (Stock / Gold)
  const handleSaveMarketPrice = () => {
    const p = parseFormattedNumber(customMarketPriceStr);
    if (p <= 0) {
      setIsEditingMarketPrice(false);
      return;
    }

    let updatedAsset: Asset | undefined = undefined;
    if (resolvedAsset) {
      const q = resolvedAsset.quantity || effectiveQty;
      updatedAsset = {
        ...resolvedAsset,
        currentPrice: p,
        amount: q > 0 ? Math.round(q * p) : resolvedAsset.amount,
        updatedAt: formatDateVN(new Date().toISOString().split('T')[0]),
      };
    }

    let updatedGoal: Goal | undefined = undefined;
    if (resolvedGoal) {
      updatedGoal = {
        ...resolvedGoal,
        currentPrice: p,
      };
    }

    onSaveTransactions(allTxs, updatedAsset, updatedGoal);
    setIsEditingMarketPrice(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* HEADER */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                {isSavingOrCash ? <Building2 className="w-5 h-5" /> : <History className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white">{itemName}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isSavingOrCash
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                        : itemType === 'gold'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    }`}
                  >
                    {isSavingOrCash ? (bankInfo?.bankName ? `${bankInfo.bankIcon} ${bankInfo.bankName}` : '🏦 Tiền Gửi Tiết Kiệm') : itemType === 'gold' ? '🪙 Vàng Tích Trữ' : '📈 Cổ Phiếu Tích Sản'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isSavingOrCash
                    ? 'Lịch sử mở sổ, nạp tiền gốc định kỳ & theo dõi lãi suất tiền gửi ngân hàng'
                    : 'Lịch sử chi tiết từng đợt mua gom tích sản (DCA), giá vốn trung bình & hiệu suất'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
              title="Đóng modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SUMMARY STATS BAR */}
          <div className="p-3 sm:p-4 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-xs">
            {isSavingOrCash ? (
              <>
                {/* Tiết Kiệm - Card 1: Tổng Tiền Gốc */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Tổng Tiền Gốc Đã Gửi</span>
                  <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                    {formatVND(effectiveCost, isPrivacyMode)}
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                    {sortedTxs.length > 0 ? `${sortedTxs.length} đợt gửi tiền ghi nhận` : 'Chưa có đợt gửi'}
                  </span>
                </div>

                {/* Tiết Kiệm - Card 2: Lãi Suất & Kỳ Hạn */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Lãi Suất & Kỳ Hạn</span>
                  <div className="text-xs sm:text-sm font-black text-blue-700 mt-0.5">
                    {savingRate}% / năm
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                    Kỳ hạn: {savingTermMonths} tháng
                  </span>
                </div>

                {/* Tiết Kiệm - Card 3: Tiền Lãi Dự Kiến */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Tiền Lãi Dự Kiến Khi Đáo Hạn</span>
                  <div className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5">
                    +{formatVND(calculatedEstInterest, isPrivacyMode)}
                  </div>
                  <span className="text-[9.5px] text-slate-500 font-medium block mt-0.5">
                    🟢 Bảo toàn vốn 100%
                  </span>
                </div>

                {/* Tiết Kiệm - Card 4: Tổng Nhận Dự Kiến */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Tổng Nhận Khi Đáo Hạn</span>
                  <div className="text-xs sm:text-sm font-black text-blue-900 mt-0.5">
                    {formatVND(effectiveCost + calculatedEstInterest, isPrivacyMode)}
                  </div>
                  <span className="text-[9.5px] text-slate-500 font-medium block mt-0.5">
                    Gốc + Toàn bộ tiền lãi
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* DCA - Card 1: Tổng Gom Tích Lũy */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Tổng Gom Tích Lũy</span>
                  <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                    {formatNumberString(effectiveQty)} {unit}
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                    {sortedTxs.length > 0 ? `${sortedTxs.length} đợt tích lũy` : 'Chưa có đợt mua'}
                  </span>
                </div>

                {/* DCA - Card 2: Đơn Giá Vốn TB */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Đơn Giá Vốn TB (1 {unit})</span>
                  <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                    {avgCostPerUnit > 0 ? formatVND(avgCostPerUnit, isPrivacyMode) : '—'}
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                    Tổng vốn: {formatVND(effectiveCost, isPrivacyMode)}
                  </span>
                </div>

                {/* DCA - Card 3: Giá Thị Trường Hiện Tại */}
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

                {/* DCA - Card 4: Lãi / Lỗ Ước Tính */}
                <div className={`border rounded-xl p-2.5 ${isGain ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                  <span className="text-[10px] text-slate-500 font-semibold block leading-tight">Lãi / Lỗ Ước Tính</span>
                  <div className={`text-xs sm:text-sm font-black mt-0.5 ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isGain ? '+' : ''}{pnlPercent}% ({formatVND(pnlAmount, isPrivacyMode)})
                  </div>
                  <span className="text-[9.5px] text-slate-500 font-medium block mt-0.5">
                    {isGain ? '🟢 Sinh lời so với vốn' : '🔴 Tạm lỗ so với vốn'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* MODAL BODY (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* ACTION BUTTON & HEADER */}
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600" />
                <span>{isSavingOrCash ? 'Nhật Ký Các Đợt Gửi Tiết Kiệm' : 'Nhật Ký Các Đợt Mua / Nạp Tích Sản'}</span>
              </h4>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTxId(null);
                    setTxDate(new Date().toISOString().split('T')[0]);
                    setTxAction(isSavingOrCash ? 'deposit' : 'buy');
                    setTxQtyStr('');
                    setTxUnitPriceStr(isSavingOrCash ? '1' : (currentMarketPricePerUnit > 0 ? formatNumberString(currentMarketPricePerUnit) : ''));
                    setTxTotalAmountStr('');
                    setTxRateStr(resolvedAsset?.rate ? String(resolvedAsset.rate) : '5.5');
                    setTxTermMonthsStr(resolvedAsset?.termMonths ? String(resolvedAsset.termMonths) : '12');
                    setTxNote('');
                    setShowAddForm(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSavingOrCash ? '+ Ghi Nhận Đợt Gửi Mới' : '+ Ghi Nhận Đợt Mua Mới'}</span>
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
                    <span>
                      {editingTxId
                        ? 'Chỉnh Sửa Đợt Giao Dịch'
                        : (isSavingOrCash ? 'Thêm Đợt Gửi Tiết Kiệm Mới' : 'Thêm Đợt Mua / Gom Tích Sản Mới')}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                </div>

                {isSavingOrCash ? (
                  /* Form Tiết Kiệm chuyên biệt */
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Ngày gửi */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Ngày Gửi Tiết Kiệm</label>
                        <input
                          type="date"
                          value={txDate}
                          onChange={(e) => setTxDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      {/* Loại hành động */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Loại Hành Động</label>
                        <select
                          value={txAction}
                          onChange={(e) => setTxAction(e.target.value as any)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        >
                          <option value="deposit">Gửi thêm vào sổ / Nạp gốc</option>
                          <option value="buy">Mở sổ tiết kiệm mới</option>
                          <option value="withdraw">Rút bớt tiền / Tất toán một phần</option>
                        </select>
                      </div>

                      {/* Số tiền gửi */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Số Tiền Gửi (VNĐ)</label>
                        <input
                          type="text"
                          value={txTotalAmountStr}
                          onChange={(e) => handleTotalAmountChange(e.target.value)}
                          placeholder="Ví dụ: 50.000.000"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Lãi suất */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Lãi Suất (%/năm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={txRateStr}
                          onChange={(e) => setTxRateStr(e.target.value)}
                          placeholder="5.5"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Kỳ hạn */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Kỳ Hạn (Tháng)</label>
                        <input
                          type="number"
                          value={txTermMonthsStr}
                          onChange={(e) => setTxTermMonthsStr(e.target.value)}
                          placeholder="12"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Ghi chú */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Ghi Chú Đợt Gửi</label>
                        <input
                          type="text"
                          value={txNote}
                          onChange={(e) => setTxNote(e.target.value)}
                          placeholder="Ví dụ: Gửi online app VCB, Sổ 2..."
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Form DCA Cổ Phiếu / Vàng */
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Ngày giao dịch */}
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
                          <option value="deposit">Nạp thêm</option>
                          <option value="sell">Bán bớt chốt lời</option>
                          <option value="withdraw">Rút bớt</option>
                        </select>
                      </div>

                      {/* Số lượng */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Số Lượng Mua ({unit})</label>
                        <input
                          type="text"
                          value={txQtyStr}
                          onChange={(e) => handleQtyChange(e.target.value)}
                          placeholder="Ví dụ: 100"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-emerald-700 outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      {/* Đơn giá mua */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Đơn Giá Mua (VNĐ/1 {unit})</label>
                        <input
                          type="text"
                          value={txUnitPriceStr}
                          onChange={(e) => handleUnitPriceChange(e.target.value)}
                          placeholder="Ví dụ: 8.200.000"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Tổng Thành Tiền (VNĐ)</label>
                        <input
                          type="text"
                          value={txTotalAmountStr}
                          onChange={(e) => handleTotalAmountChange(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-blue-700 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Ghi Chú Đợt Mua</label>
                        <input
                          type="text"
                          value={txNote}
                          onChange={(e) => setTxNote(e.target.value)}
                          placeholder="Ví dụ: Tiệm Doji, Khớp lệnh ATC..."
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                    {editingTxId ? '✓ Cập Nhật Đợt Này' : (isSavingOrCash ? '+ Lưu Đợt Gửi Vào Lịch Sử' : '+ Lưu Đợt Mua Vào Lịch Sử')}
                  </button>
                </div>
              </form>
            )}

            {/* LIST OF TRANSACTIONS */}
            {sortedTxs.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700">
                  {isSavingOrCash
                    ? 'Chưa có lịch sử các đợt gửi tiền nào được ghi nhận'
                    : 'Chưa có lịch sử các đợt mua nào được ghi nhận'}
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  {isSavingOrCash
                    ? 'Bấm nút "+ Ghi Nhận Đợt Gửi Mới" ở trên để bắt đầu lưu lại ngày gửi và số tiền từng lần tích lũy.'
                    : 'Bấm nút "+ Ghi Nhận Đợt Mua Mới" ở trên để bắt đầu lưu lại ngày mua, số lượng và đơn giá từng lần gom.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Desktop Table View (>= sm) */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3 text-center w-8">#</th>
                        <th className="py-2.5 px-3">Ngày Giao Dịch</th>
                        <th className="py-2.5 px-3 text-center">Hành Động</th>
                        {isSavingOrCash ? (
                          <>
                            <th className="py-2.5 px-3 text-right">Số Tiền Gửi (Gốc)</th>
                            <th className="py-2.5 px-3 text-center">Lãi Suất & Kỳ Hạn</th>
                            <th className="py-2.5 px-3 text-right">Tiền Lãi Dự Kiến</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-3 text-right">Khối Lượng</th>
                            <th className="py-2.5 px-3 text-right">Đơn Giá Mua</th>
                            <th className="py-2.5 px-3 text-right">Tổng Thành Tiền</th>
                          </>
                        )}
                        <th className="py-2.5 px-3">Ghi Chú</th>
                        <th className="py-2.5 px-3 text-center w-20">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700 text-[11.5px]">
                      {sortedTxs.map((tx, idx) => {
                        const isBuy = tx.type === 'buy' || tx.type === 'deposit';
                        const itemRate = tx.rate || savingRate;
                        const itemTerm = tx.termMonths || savingTermMonths;
                        const itemInterest = Math.round((tx.totalAmount || tx.quantity || 0) * (itemRate / 100) * (itemTerm / 12));

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatDateVN(tx.date)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                                  isBuy
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {isSavingOrCash ? (isBuy ? '✓ Gửi tiết kiệm' : 'Rút bớt') : (isBuy ? '✓ Mua gom' : 'Bán / Rút')}
                              </span>
                            </td>

                            {isSavingOrCash ? (
                              <>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                                  {formatVND(tx.totalAmount || tx.quantity, isPrivacyMode)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-blue-700 whitespace-nowrap">
                                  {itemRate}% / năm • {itemTerm}T
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                  +{formatVND(itemInterest, isPrivacyMode)}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                                  {formatNumberString(tx.quantity)} {tx.unit || unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                                  {formatVND(tx.pricePerUnit, isPrivacyMode)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                  {formatVND(tx.totalAmount, isPrivacyMode)}
                                </td>
                              </>
                            )}

                            <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate text-[11px]">
                              {tx.note || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleStartEditTx(tx)}
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                                title="Sửa đợt này"
                              >
                                <Pen className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setTxToDelete(tx.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Xóa đợt này"
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
      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(txToDelete)}
        title="Xác nhận xóa đợt giao dịch"
        message="Bạn có chắc chắn muốn xóa bản ghi đợt giao dịch này không? Số dư và giá vốn sẽ được tự động tính toán lại."
        confirmText="Xác nhận xóa"
        cancelText="Hủy"
        onConfirm={() => {
          if (txToDelete) executeDeleteTx(txToDelete);
        }}
        onCancel={() => setTxToDelete(null)}
      />
    </>
  );
};
