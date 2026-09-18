import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  Shield,
  Target,
  Wallet,
  Scale,
  Percent,
  Trash2,
  RefreshCw,
  PlusCircle,
  Edit3,
  History,
} from 'lucide-react';
import {
  ParsedFullDatabase,
  parseExcelFile,
  downloadStandardExcelTemplate,
  ParsedAssetItem,
  ParsedDebtItem,
  ParsedGoalItem,
} from '../utils/excelEngine';
import { Asset, Debt, Goal, AssetTransaction } from '../types';

interface SmartExcelModalProps {
  isOpen: boolean;
  currentAssetsCount: number;
  currentDebtsCount: number;
  currentGoalsCount: number;
  onClose: () => void;
  onImportData: (
    data: {
      assets: (Asset | Omit<Asset, 'id'>)[];
      debts: (Debt | Omit<Debt, 'id'>)[];
      goals: (Goal | Omit<Goal, 'id'>)[];
      transactions?: (AssetTransaction | Omit<AssetTransaction, 'id'>)[];
      salaryIncome?: number;
      otherIncome?: number;
    },
    mode: 'sync' | 'replace' | 'append'
  ) => void;
}

export const SmartExcelModal: React.FC<SmartExcelModalProps> = ({
  isOpen,
  currentAssetsCount,
  currentDebtsCount,
  currentGoalsCount,
  onClose,
  onImportData,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<ParsedFullDatabase | null>(null);
  const [previewTab, setPreviewTab] = useState<'assets' | 'debts' | 'goals' | 'transactions'>('assets');
  const [importMode, setImportMode] = useState<'sync' | 'replace' | 'append'>('sync');
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleResetFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFileName('');
    setParsedData(null);
    setErrorMsg('');
    setSuccessNotice('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcessFile = async (file: File) => {
    setErrorMsg('');
    setSuccessNotice('');
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const data = await parseExcelFile(file);
      const txCount = data.transactions?.length || 0;
      const totalCount = data.assets.length + data.debts.length + data.goals.length + txCount;

      if (totalCount === 0 && (!data.salaryIncome && !data.otherIncome)) {
        setErrorMsg('Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng tải File Mẫu Chuẩn để kiểm tra cấu trúc!');
        setParsedData(null);
      } else {
        setParsedData(data);
        if (data.assets.length > 0) setPreviewTab('assets');
        else if (data.debts.length > 0) setPreviewTab('debts');
        else if (data.goals.length > 0) setPreviewTab('goals');
        else if (txCount > 0) setPreviewTab('transactions');

        const withIdCount =
          data.assets.filter((a) => !!a.id).length +
          data.debts.filter((d) => !!d.id).length +
          data.goals.filter((g) => !!g.id).length;

        setSuccessNotice(
          `Đã đọc ${data.assets.length} tài sản, ${data.debts.length} khoản nợ, ${data.goals.length} mục tiêu, ${txCount} giao dịch lịch sử${
            withIdCount > 0 ? ` (trong đó có ${withIdCount} mục chứa Mã ID đồng bộ)` : ''
          }.`
        );
      }
    } catch (err: any) {
      setErrorMsg('Lỗi khi đọc file Excel. Định dạng được hỗ trợ: .xlsx, .xls, .csv');
      setParsedData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Remove individual row from preview
  const handleRemoveAssetRow = (index: number) => {
    if (!parsedData) return;
    const nextAssets = parsedData.assets.filter((_, i) => i !== index);
    setParsedData({ ...parsedData, assets: nextAssets });
  };

  const handleRemoveDebtRow = (index: number) => {
    if (!parsedData) return;
    const nextDebts = parsedData.debts.filter((_, i) => i !== index);
    setParsedData({ ...parsedData, debts: nextDebts });
  };

  const handleRemoveGoalRow = (index: number) => {
    if (!parsedData) return;
    const nextGoals = parsedData.goals.filter((_, i) => i !== index);
    setParsedData({ ...parsedData, goals: nextGoals });
  };

  const handleRemoveTxRow = (index: number) => {
    if (!parsedData || !parsedData.transactions) return;
    const nextTxs = parsedData.transactions.filter((_, i) => i !== index);
    setParsedData({ ...parsedData, transactions: nextTxs });
  };

  const handleConfirmSave = () => {
    if (!parsedData) return;

    const assetsToImport: (Asset | Omit<Asset, 'id'>)[] = parsedData.assets.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      level: item.level,
      type: item.type,
      name: item.name,
      amount: item.amount,
      costPrice: item.costPrice,
      rate: item.rate,
      startDate: item.startDate,
      termMonths: item.termMonths,
      quantity: item.quantity,
      cashflow: item.cashflow,
      divCash: item.divCash,
      maturityDate: item.maturityDate,
      note: item.note,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
    }));

    const debtsToImport: (Debt | Omit<Debt, 'id'>)[] = parsedData.debts.map((item) => {
      const isActuallyNoTerm = !!(
        item.isNoTerm ||
        item.category === 'type_free' ||
        item.frequency === 'flexible' ||
        (item.note && (item.note.toLowerCase().includes('khi nào có') || item.note.toLowerCase().includes('không kỳ hạn')))
      );

      return {
        ...(item.id ? { id: item.id } : {}),
        category: item.category,
        name: item.name,
        frequency: isActuallyNoTerm ? 'flexible' : (item.frequency || 'monthly'),
        startDate: item.startDate,
        amount: item.amount,
        paidPrincipal: item.paidPrincipal || 0,
        termMonths: isActuallyNoTerm ? undefined : item.termMonths,
        installmentAmount: isActuallyNoTerm ? undefined : (item.installmentAmount || (item.category === 'type2' && item.monthlyBefore > 0 ? item.monthlyBefore : undefined)),
        periodicAmount: isActuallyNoTerm ? undefined : (item.periodicAmount || ((item.category === 'type3' || item.category === 'type4') ? (item.monthlyBefore || item.amount) : undefined)),
        promoRate: item.promoRate,
        normalRate: item.normalRate,
        promoMonths: item.promoMonths,
        promoEndDate: item.promoEndDate,
        monthlyBefore: isActuallyNoTerm ? 0 : item.monthlyBefore,
        monthlyAfter: isActuallyNoTerm ? 0 : item.monthlyAfter,
        day: isActuallyNoTerm ? undefined : (item.day !== undefined && item.day !== null ? item.day : 20),
        status: item.status || 'Chưa tất toán',
        note: item.note,
        isNoTerm: isActuallyNoTerm ? true : undefined,
      };
    });

    const goalsToImport: (Goal | Omit<Goal, 'id'>)[] = parsedData.goals.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      group: item.group,
      goalType: item.goalType,
      assetType: item.assetType,
      linkedAssetId: item.linkedAssetId,
      linkedBankKey: item.linkedBankKey,
      linkedDebtId: item.linkedDebtId,
      name: item.name,
      freqMonths: item.freqMonths,
      day: item.day,
      targetQty: item.targetQty,
      targetAmountPerPeriod: item.targetAmountPerPeriod,
      unit: item.unit,
      totalBought: item.totalBought,
      backlogQty: item.backlogQty,
      target: item.target,
      years: item.years,
      status: item.status,
      note: item.note,
    }));

    onImportData(
      {
        assets: assetsToImport,
        debts: debtsToImport,
        goals: goalsToImport,
        transactions: parsedData.transactions,
        salaryIncome: parsedData.salaryIncome,
        otherIncome: parsedData.otherIncome,
      },
      importMode
    );
    onClose();
  };

  // Stats calculation
  const totalAssetAmount = parsedData?.assets.reduce((sum, item) => sum + item.amount, 0) || 0;
  const totalDebtAmount = parsedData?.debts.reduce((sum, item) => sum + item.amount, 0) || 0;
  const txList = parsedData?.transactions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        id="smart-excel-modal"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80 shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                Cập Nhật & Nhập Dữ Liệu Từ Excel
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                Hỗ trợ sửa dòng cũ theo Mã ID, thêm mới, lịch sử giao dịch và tự động tính toán
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={downloadStandardExcelTemplate}
              className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Tải tệp mẫu Excel chuẩn 4 sheet đầy đủ thông tin"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải File Mẫu (4 Sheet)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Mobile-optimized Template Download Banner */}
          <div className="sm:hidden flex items-center justify-between gap-2 p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs">
            <div className="flex items-center space-x-2 text-amber-900 min-w-0">
              <Download className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-bold text-[11px] truncate">Tải file mẫu Excel chuẩn (4 Sheet)</span>
            </div>
            <button
              type="button"
              onClick={downloadStandardExcelTemplate}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              Tải mẫu
            </button>
          </div>

          {/* FILE DRAG & DROP WITH CLEAR [X] BUTTON */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!fileName) fileInputRef.current?.click();
            }}
            className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center transition flex flex-col items-center justify-center ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50/60'
                : fileName
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-emerald-400 bg-slate-50/40 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!fileName ? (
              <>
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-emerald-600 shadow-xs mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Kéo thả file Excel vào đây hoặc <span className="text-emerald-600 underline font-extrabold">nhấp để chọn</span>
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                  Tự động đối chiếu Mã ID để sửa dòng cũ, thêm mới dòng không có ID, tự động chuẩn hóa ngày tháng và khối lượng thập phân.
                </p>
              </>
            ) : (
              <div className="w-full flex items-center justify-between p-2 sm:p-3 bg-white border border-emerald-300 rounded-xl shadow-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-xs font-bold text-slate-900 truncate">{fileName}</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">Tệp đã nạp thành công</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    Chọn file khác
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-500 bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                    title="Xóa tệp này (Hủy file)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* PREVIEW SECTION (XEM TRƯỚC DỮ LIỆU ĐẦY ĐỦ THÔNG TIN VÀ NÚT XÓA DÒNG) */}
          {parsedData && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              {/* Top Overview Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div
                  onClick={() => setPreviewTab('assets')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    previewTab === 'assets'
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/20'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-blue-700 font-bold text-xs mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Tài Sản ({parsedData.assets.length})</span>
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate">
                    {totalAssetAmount.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div
                  onClick={() => setPreviewTab('debts')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    previewTab === 'debts'
                      ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-rose-700 font-bold text-xs mb-1">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Dòng Tiền & Nợ ({parsedData.debts.length})</span>
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate">
                    Nợ: {totalDebtAmount.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div
                  onClick={() => setPreviewTab('goals')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    previewTab === 'goals'
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs mb-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>Mục Tiêu ({parsedData.goals.length})</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 truncate">
                    DCA & Cột mốc
                  </div>
                </div>

                <div
                  onClick={() => setPreviewTab('transactions')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    previewTab === 'transactions'
                      ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-purple-700 font-bold text-xs mb-1">
                    <History className="w-3.5 h-3.5" />
                    <span>Giao Dịch ({txList.length})</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 truncate">
                    Lịch sử tích sản
                  </div>
                </div>
              </div>

              {/* TAB 1 PREVIEW: TÀI SẢN */}
              {previewTab === 'assets' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Danh sách {parsedData.assets.length} tài sản (Bấm [X] để loại bỏ dòng không muốn nạp):
                    </span>
                    <span className="text-slate-500">
                      Tổng: <strong className="text-blue-700 font-black">{totalAssetAmount.toLocaleString('vi-VN')} đ</strong>
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                    {parsedData.assets.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">Không có dòng tài sản nào</div>
                    ) : (
                      parsedData.assets.map((item, idx) => (
                        <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 w-5">#{idx + 1}</span>
                              {item.id ? (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 shrink-0 inline-flex items-center gap-0.5">
                                  <Edit3 className="w-2.5 h-2.5" />
                                  TS-{item.id}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0 inline-flex items-center gap-0.5">
                                  <PlusCircle className="w-2.5 h-2.5" />
                                  Mới
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                                  item.level === '1'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.level === '2'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                T{item.level}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.name}</span>
                              <span className="text-[11px] text-slate-400">({item.typeName})</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1 pl-6">
                              {item.costPrice && item.costPrice > 0 && (
                                <span>Vốn: <strong className="text-slate-700">{item.costPrice.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.rate && item.rate > 0 && (
                                <span className="inline-flex items-center text-emerald-700 font-semibold">
                                  <Percent className="w-3 h-3 mr-0.5" />
                                  {item.rate}%/năm
                                </span>
                              )}
                              {item.quantity && item.quantity > 0 && (
                                <span>SL: <strong>{item.quantity.toLocaleString('vi-VN')}</strong></span>
                              )}
                              {item.startDate && (
                                <span className="text-slate-600">Ngày: {item.startDate}</span>
                              )}
                              {item.maturityDate && (
                                <span className="text-amber-700">Đáo hạn: {item.maturityDate}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="text-right">
                              <div className="font-black text-slate-900 text-xs">
                                {item.amount.toLocaleString('vi-VN')} đ
                              </div>
                              {item.note && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.note}>
                                  {item.note}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssetRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Xóa dòng này khỏi danh sách nạp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2 PREVIEW: DÒNG TIỀN VÀ NỢ */}
              {previewTab === 'debts' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Danh sách khoản nợ ({parsedData.debts.length} khoản):
                    </span>
                    <span className="text-slate-500">
                      Tổng nợ: <strong className="text-rose-700 font-black">{totalDebtAmount.toLocaleString('vi-VN')} đ</strong>
                    </span>
                  </div>

                  {/* Income Preview Strip */}
                  {((parsedData.salaryIncome && parsedData.salaryIncome > 0) || (parsedData.otherIncome && parsedData.otherIncome > 0)) && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <span>Thu nhập nhận diện:</span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        {parsedData.salaryIncome ? (
                          <span>Lương: <strong className="text-emerald-950 font-black">{parsedData.salaryIncome.toLocaleString('vi-VN')} đ</strong></span>
                        ) : null}
                        {parsedData.otherIncome ? (
                          <span>Khác: <strong className="text-emerald-950 font-black">{parsedData.otherIncome.toLocaleString('vi-VN')} đ</strong></span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                    {parsedData.debts.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">Không có khoản nợ nào trong file</div>
                    ) : (
                      parsedData.debts.map((item, idx) => (
                        <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 w-5">#{idx + 1}</span>
                              {item.id ? (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 shrink-0 inline-flex items-center gap-0.5">
                                  <Edit3 className="w-2.5 h-2.5" />
                                  NO-{item.id}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0 inline-flex items-center gap-0.5">
                                  <PlusCircle className="w-2.5 h-2.5" />
                                  Mới
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 shrink-0">
                                {item.categoryName}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.name}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1 pl-6">
                              {item.amount > 0 && (
                                <span>Gốc: <strong className="text-slate-700">{item.amount.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.startDate && <span>Ngày vay: {item.startDate}</span>}
                              {item.monthlyBefore > 0 && (
                                <span>Trả/tháng: <strong className="text-rose-700">{item.monthlyBefore.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.isNoTerm ? (
                                <span className="text-purple-700 font-semibold">✨ Không kỳ hạn</span>
                              ) : (
                                <span>Mùng {item.day || 20}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveDebtRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Xóa dòng này khỏi danh sách nạp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3 PREVIEW: MỤC TIÊU TÀI CHÍNH */}
              {previewTab === 'goals' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Mục tiêu tài chính ({parsedData.goals.length} mục tiêu):
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                    {parsedData.goals.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">Không có mục tiêu nào trong file</div>
                    ) : (
                      parsedData.goals.map((item, idx) => (
                        <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 w-5">#{idx + 1}</span>
                              {item.id ? (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 shrink-0 inline-flex items-center gap-0.5">
                                  <Edit3 className="w-2.5 h-2.5" />
                                  MT-{item.id}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0 inline-flex items-center gap-0.5">
                                  <PlusCircle className="w-2.5 h-2.5" />
                                  Mới
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                                {item.groupName}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.name}</span>
                              {item.linkedAssetId && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  🔗 TS-{item.linkedAssetId}
                                </span>
                              )}
                              {item.linkedBankKey && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  🏦 {item.linkedBankKey.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1 pl-6">
                              {item.targetQty && (
                                <span>Định mức: <strong>{item.targetQty.toLocaleString('vi-VN')} {item.unit}</strong></span>
                              )}
                              {item.targetAmountPerPeriod && item.targetAmountPerPeriod > 0 && (
                                <span>Nạp/kỳ: <strong className="text-emerald-700">{item.targetAmountPerPeriod.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.target && item.target > 0 && (
                                <span>Mục tiêu tiền: <strong className="text-blue-700">{item.target.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.years && <span>Thời hạn: {item.years} năm</span>}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveGoalRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Xóa dòng này khỏi danh sách nạp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4 PREVIEW: LỊCH SỬ GIAO DỊCH */}
              {previewTab === 'transactions' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Lịch sử giao dịch tích sản ({txList.length} giao dịch):
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                    {txList.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">Không có giao dịch lịch sử nào trong file</div>
                    ) : (
                      txList.map((item, idx) => (
                        <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 w-5">#{idx + 1}</span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 shrink-0">
                                {item.id || `GD-${idx + 1}`}
                              </span>
                              {item.assetId && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 shrink-0">
                                  TS-{item.assetId}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                  item.type === 'buy'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.type === 'deposit'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.type === 'buy' ? 'Mua gom' : item.type === 'deposit' ? 'Nạp thêm' : 'Bán/Rút'}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{item.assetName || 'Tài sản'}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1 pl-6">
                              {item.date && <span>Ngày: {item.date}</span>}
                              {item.quantity && (
                                <span>SL: <strong>{item.quantity.toLocaleString('vi-VN')} {item.unit || ''}</strong></span>
                              )}
                              {item.pricePerUnit && (
                                <span>Đơn giá: {item.pricePerUnit.toLocaleString('vi-VN')} đ</span>
                              )}
                              {item.totalAmount > 0 && (
                                <span>Thành tiền: <strong className="text-purple-700">{item.totalAmount.toLocaleString('vi-VN')} đ</strong></span>
                              )}
                              {item.note && <span className="text-slate-400 italic">({item.note})</span>}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveTxRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Xóa dòng này khỏi danh sách nạp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Mode Selection with 3 Options */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Lựa chọn chế độ nạp dữ liệu:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Mode 1: Smart Sync (Recommended) */}
                  <label
                    className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer select-none transition ${
                      importMode === 'sync'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-950 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'sync'}
                      onChange={() => setImportMode('sync')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <div className="text-xs min-w-0">
                      <div className="font-bold flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-blue-600" />
                        <span>Đồng bộ theo Mã ID</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Cập nhật dòng cũ trùng ID, thêm mới dòng không có ID.
                      </div>
                    </div>
                  </label>

                  {/* Mode 2: Overwrite All */}
                  <label
                    className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer select-none transition ${
                      importMode === 'replace'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 shrink-0"
                    />
                    <div className="text-xs min-w-0">
                      <div className="font-bold text-amber-900">Ghi đè thay thế toàn bộ</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Thay thế toàn bộ danh mục cũ trong App bằng file Excel.
                      </div>
                    </div>
                  </label>

                  {/* Mode 3: Append All */}
                  <label
                    className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer select-none transition ${
                      importMode === 'append'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500 shrink-0"
                    />
                    <div className="text-xs min-w-0">
                      <div className="font-bold text-emerald-900">Thêm mới toàn bộ</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        Thêm toàn bộ các dòng thành mục mới (bỏ qua ID cũ).
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={!parsedData || isProcessing}
            onClick={handleConfirmSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Lưu Dữ Liệu Vào Ứng Dụng</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
