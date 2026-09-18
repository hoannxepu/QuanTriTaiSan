with open('src/components/TabGoals.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """      {/* 1. DEDICATED MOBILE VIEW (< md) - COMPACT GOALS CASHFLOW DASHBOARD */}
      <div className="md:hidden bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        {/* Row 1: Đệm Dòng Tiền Tự Do Còn Lại Banner ĐƯỢC ĐẶT LÊN ĐẦU TIÊN */}
        <div
          className={`flex items-center justify-between rounded-lg px-2.5 py-2 border ${
            remainingFreeBuffer >= 0
              ? 'bg-blue-50/70 border-blue-200/80'
              : 'bg-rose-50/70 border-rose-200/80'
          }`}
        >
          <div className="min-w-0 flex-1 mr-2">
            <span
              className={`text-[9.5px] font-bold uppercase tracking-wide block truncate ${
                remainingFreeBuffer >= 0 ? 'text-blue-800' : 'text-rose-800'
              }`}
            >
              Dòng Tiền Tự Do Còn Lại
            </span>
            <span
              className={`text-base font-black tracking-tight block truncate ${
                remainingFreeBuffer >= 0 ? 'text-blue-700' : 'text-rose-600'
              }`}
            >
              {isPrivacyMode
                ? '•••••• ₫'
                : remainingFreeBuffer >= 0
                ? `+${formatVND(remainingFreeBuffer)}`
                : `${formatVND(remainingFreeBuffer)}`}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
              remainingFreeBuffer >= 0
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {remainingFreeBuffer >= 0 ? '✓ An toàn' : '⚠️ Quá tải'}
          </span>
        </div>

        {/* Row 2: 2 Mini Columns side-by-side (Thặng Dư Khả Dụng vs Nhu Cầu Mục Tiêu) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Cột 1: Thặng Dư Khả Dụng */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 p-2 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wide block truncate">
                Thặng Dư Khả Dụng
              </span>
              <div className="text-xs font-black text-emerald-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(monthlySurplusAvailable)}`}
              </div>
            </div>

            <div className="mt-1.5 pt-1 border-t border-emerald-200/60 text-[8.5px] space-y-0.5 text-emerald-950">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Thu:</span>
                <span className="font-bold">{formatVND(totalMonthlyInflow, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Nợ:</span>
                <span className="font-bold text-rose-600">-{formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Ngân Sách Mục Tiêu */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-2 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide truncate">
                  Nhu Cầu Mục Tiêu
                </span>
                <span
                  className={`px-1 py-0.2 rounded text-[8.5px] font-bold border shrink-0 ${
                    allocationBurdenRatio <= 70
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : allocationBurdenRatio <= 100
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Tải: {isPrivacyMode ? '••%' : `${allocationBurdenRatio}%`}
                </span>
              </div>
              <div className="text-xs font-black text-amber-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(monthlyGoalAllocation)}`}
              </div>
            </div>

            <div className="mt-1.5 pt-1 border-t border-amber-200/60 text-[8.5px] space-y-0.5 text-amber-950">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Quý:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 3, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Năm:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 12, isPrivacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chú thích 4 trụ cột */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[10px] gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGoalStandards(!showGoalStandards)}
            className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded transition shrink-0"
          >
            <span>{showGoalStandards ? 'Ẩn Chuẩn Mực' : 'Xem 4 Trụ Cột'}</span>
            {showGoalStandards ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        </div>"""

replacement = """      {/* 1. DEDICATED MOBILE VIEW (< md) - CHUẨN GIAO DIỆN ĐIỆN THOẠI */}
      <div className="md:hidden bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Row 1: Đệm Dòng Tiền Tự Do Còn Lại Banner */}
        <div
          className={`flex items-center justify-between rounded-xl p-3 border ${
            remainingFreeBuffer >= 0
              ? 'bg-blue-50/80 border-blue-200/90'
              : 'bg-rose-50/80 border-rose-200/90'
          }`}
        >
          <div className="min-w-0 flex-1 mr-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wide block truncate ${
                remainingFreeBuffer >= 0 ? 'text-blue-800' : 'text-rose-800'
              }`}
            >
              Dòng Tiền Tự Do Còn Lại
            </span>
            <span
              className={`text-lg font-black tracking-tight block truncate mt-0.5 ${
                remainingFreeBuffer >= 0 ? 'text-blue-700' : 'text-rose-600'
              }`}
            >
              {isPrivacyMode
                ? '•••••• ₫'
                : remainingFreeBuffer >= 0
                ? `+${formatVND(remainingFreeBuffer)}`
                : `${formatVND(remainingFreeBuffer)}`}
            </span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border shrink-0 ${
              remainingFreeBuffer >= 0
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {remainingFreeBuffer >= 0 ? '✓ An toàn' : '⚠️ Quá tải'}
          </span>
        </div>

        {/* Row 2: 2 Mini Columns side-by-side (Thặng Dư Khả Dụng vs Nhu Cầu Mục Tiêu) */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* Cột 1: Thặng Dư Khả Dụng */}
          <div className="bg-emerald-50/80 border border-emerald-200/90 p-2.5 rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wide block truncate">
                Thặng Dư Khả Dụng
              </span>
              <div className="text-sm font-black text-emerald-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `+${formatVND(monthlySurplusAvailable)}`}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-emerald-200/70 text-[10px] space-y-1 text-emerald-950 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Thu:</span>
                <span className="font-bold">{formatVND(totalMonthlyInflow, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Nợ:</span>
                <span className="font-bold text-rose-600">-{formatVND(totalMonthlyDebtOutflow, isPrivacyMode)}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Ngân Sách Mục Tiêu */}
          <div className="bg-amber-50/80 border border-amber-200/90 p-2.5 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wide truncate">
                  Nhu Cầu Mục Tiêu
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border shrink-0 ${
                    allocationBurdenRatio <= 70
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : allocationBurdenRatio <= 100
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Tải: {isPrivacyMode ? '••%' : `${allocationBurdenRatio}%`}
                </span>
              </div>
              <div className="text-sm font-black text-amber-700 mt-0.5 truncate">
                {isPrivacyMode ? '•••••• ₫' : `-${formatVND(monthlyGoalAllocation)}`}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-amber-200/70 text-[10px] space-y-1 text-amber-950 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Quý:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 3, isPrivacyMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 truncate">Năm:</span>
                <span className="font-bold">{formatVND(monthlyGoalAllocation * 12, isPrivacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chú thích 4 trụ cột */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGoalStandards(!showGoalStandards)}
            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition shrink-0"
          >
            <span>{showGoalStandards ? 'Ẩn Chuẩn Mực' : 'Xem 4 Trụ Cột'}</span>
            {showGoalStandards ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open('src/components/TabGoals.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("NOT_FOUND")
