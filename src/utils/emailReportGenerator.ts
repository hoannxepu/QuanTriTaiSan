import { DatabaseState, EmailScheduleSettings, Goal, Asset } from '../types';
import { formatVND, getCurrentTimestampVN } from './format';
import { getVietnamWealthBenchmark } from './benchmarkUtils';

export const DEFAULT_EMAIL_SCHEDULE: EmailScheduleSettings = {
  enabled: true,
  email: '',
  emails: [],
  frequency: 'monthly',
  sendWeekday: 1, // Thứ Hai
  sendDay: 1, // Ngày 1 hàng tháng mặc định
  sendHour: 8, // 08:00 sáng
  includeMonthlyGoals: true,
  includeNetWorthOverview: true,
  includeDebts: true,
  includeCashFlow: true,
  includeAssetPyramid: true,
};

export function formatScheduleLabel(settings: EmailScheduleSettings): string {
  const hourStr = `${String(settings.sendHour).padStart(2, '0')}:00`;
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const weekdayName = weekdays[settings.sendWeekday ?? 1] || 'Thứ Hai';
  const freq = settings.frequency || 'monthly';

  if (!settings.enabled) {
    return 'Đang tắt tự động';
  }

  switch (freq) {
    case 'weekly':
      return `Hàng tuần (${weekdayName}, lúc ${hourStr})`;
    case '2months':
      return `Định kỳ 2 tháng / lần (Ngày ${settings.sendDay}, lúc ${hourStr})`;
    case 'quarterly':
      return `Định kỳ 3 tháng / lần - Mỗi Quý (Ngày ${settings.sendDay}, lúc ${hourStr})`;
    case '6months':
      return `Định kỳ 6 tháng / lần - Nửa năm (Ngày ${settings.sendDay}, lúc ${hourStr})`;
    case 'yearly':
      return `Định kỳ hàng năm (Ngày ${settings.sendDay}, lúc ${hourStr})`;
    case 'monthly':
    default:
      return `Hàng tháng (Ngày ${settings.sendDay}, lúc ${hourStr})`;
  }
}

/**
 * Phân tích và lọc danh sách các địa chỉ email hợp lệ từ chuỗi hoặc mảng.
 * Hỗ trợ các ký tự ngăn cách: dấu phẩy (,), chấm phẩy (;), khoảng trắng, xuống dòng.
 */
export function parseEmailList(input?: string | string[] | null): string[] {
  if (!input) return [];
  const rawParts: string[] = Array.isArray(input)
    ? input
    : String(input).split(/[,;\n\r\t ]+/);

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const validEmails: string[] = [];

  for (const part of rawParts) {
    const clean = part.trim().toLowerCase();
    if (clean && emailRegex.test(clean)) {
      if (!validEmails.includes(clean)) {
        validEmails.push(clean);
      }
    }
  }

  return validEmails;
}

export function getEmailScheduleSettings(db?: DatabaseState): EmailScheduleSettings {
  let loaded: EmailScheduleSettings = { ...DEFAULT_EMAIL_SCHEDULE };
  if (db?.emailSchedule) {
    loaded = { ...DEFAULT_EMAIL_SCHEDULE, ...db.emailSchedule };
  } else {
    try {
      const saved = localStorage.getItem('thaptaisan_email_schedule');
      if (saved) {
        loaded = { ...DEFAULT_EMAIL_SCHEDULE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error reading email schedule:', e);
    }
  }

  // Chuẩn hóa danh sách emails
  const parsed = parseEmailList(loaded.emails && loaded.emails.length > 0 ? loaded.emails : loaded.email);
  loaded.emails = parsed;
  loaded.email = parsed.join(', ');

  return loaded;
}

export function saveEmailScheduleSettings(settings: EmailScheduleSettings) {
  try {
    localStorage.setItem('thaptaisan_email_schedule', JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving email schedule:', e);
  }
}

/**
 * Generate a refined, minimalist, banking-grade HTML email report.
 * - Section 1 (TOP): Mục Tiêu Tích Sản Cần Hoàn Thành (Clean, high contrast, elegant cards)
 * - Section 5: Phân Bổ Danh Mục Tháp Tài Sản 3 Tầng (Specific table of items for each tier)
 */
export function generateEmailHtml(
  db: DatabaseState,
  settings: EmailScheduleSettings,
  userDisplay?: string
): string {
  const totalAssets = (db.assets || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalDebts = (db.debts || [])
    .filter((d) => d.status !== 'Đã tất toán')
    .reduce((s, d) => s + (Number(d.amount) - (Number(d.paidPrincipal) || 0)), 0);
  const netWorth = totalAssets - totalDebts;

  const totalMonthlyDebtPayment = (db.debts || [])
    .filter((d) => d.status !== 'Đã tất toán')
    .reduce((s, d) => s + (Number(d.monthlyBefore) || Number(d.monthlyAfter) || 0), 0);

  const totalIncome = (Number(db.salaryIncome) || 0) + (Number(db.otherIncome) || 0);
  const surplus = totalIncome - totalMonthlyDebtPayment;

  const benchmark = getVietnamWealthBenchmark(netWorth);
  const currentDateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const currentMonthYear = new Date().toLocaleDateString('vi-VN', {
    month: '2-digit',
    year: 'numeric',
  });

  // Calculate monthly goal targets
  const activeGoals = (db.goals || []).filter((g) => g.status !== 'completed');

  let sectionsHtml = '';

  // 1. PHẦN 1 (ĐẶT TRÊN ĐẦU TIÊN): MỤC TIÊU TÀI CHÍNH CẦN HOÀN THÀNH TRONG THÁNG
  if (settings.includeMonthlyGoals) {
    let goalsTableRows = '';
    if (activeGoals.length === 0) {
      goalsTableRows = `
        <tr>
          <td colspan="4" style="padding: 16px; text-align: center; color: #64748b; font-size: 12px; background: #f8fafc; border-radius: 8px;">
            Chưa có mục tiêu nào đang thực hiện. Hãy thiết lập mục tiêu tích sản tại ứng dụng!
          </td>
        </tr>
      `;
    } else {
      goalsTableRows = activeGoals
        .map((g, idx) => {
          let monthlyTargetText = '';
          let progressPercent = 0;
          let currentAccumulated = '';

          if (g.goalType === 'dca') {
            monthlyTargetText = `${(g.targetQty || 0).toLocaleString('vi-VN')} ${g.unit || ''} ${
              g.targetAmountPerPeriod ? `(${formatVND(g.targetAmountPerPeriod)})` : ''
            }`;
            const total = g.totalBought || 0;
            const targetTotal = (g.targetQty || 1) * (g.freqMonths || 12);
            progressPercent = Math.min(100, Math.round((total / (targetTotal || 1)) * 100));
            currentAccumulated = `${total.toLocaleString('vi-VN')} ${g.unit || ''}`;
          } else {
            monthlyTargetText = `Tổng: ${formatVND(g.target || 0)}`;
            const total = g.totalBought || 0;
            progressPercent = Math.min(100, Math.round((total / (g.target || 1)) * 100));
            currentAccumulated = formatVND(total);
          }

          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 8px; vertical-align: middle;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${idx + 1}. ${g.name}</div>
                ${g.day ? `<div style="font-size: 10.5px; color: #0284c7; margin-top: 2px;">📅 Ngày gom: ${g.day} hàng tháng</div>` : ''}
              </td>
              <td style="padding: 10px 8px; vertical-align: middle; text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${monthlyTargetText}</div>
                <div style="font-size: 10.5px; color: #64748b;">Đã có: ${currentAccumulated}</div>
              </td>
              <td style="padding: 10px 8px; vertical-align: middle; width: 110px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #059669; margin-bottom: 3px;">
                  <span>Tiến độ</span>
                  <span>${progressPercent}%</span>
                </div>
                <div style="background: #e2e8f0; border-radius: 4px; height: 6px; overflow: hidden;">
                  <div style="background: #10b981; height: 6px; width: ${progressPercent}%;"></div>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    sectionsHtml += `
      <!-- SECTION 1: MỤC TIÊU HOÀN THÀNH TRONG THÁNG (TOP) -->
      <div style="margin-bottom: 22px;">
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 15px; margin-right: 6px;">🎯</span>
            <span style="font-size: 13px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.3px;">
              1. Mục Tiêu Tích Sản Cần Hoàn Thành Tháng ${currentMonthYear}
            </span>
          </div>
          <span style="font-size: 11px; font-weight: 700; background: #059669; color: #ffffff; padding: 2px 8px; border-radius: 12px;">
            ${activeGoals.length} Mục tiêu
          </span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 8px; text-align: left;">Mục tiêu</th>
              <th style="padding: 8px; text-align: right;">Định mức</th>
              <th style="padding: 8px; text-align: right;">Hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            ${goalsTableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // 2. PHẦN 2: TỔNG QUAN TÀI SẢN & TÀI SẢN RÒNG (NET WORTH)
  if (settings.includeNetWorthOverview) {
    sectionsHtml += `
      <!-- SECTION 2: TỔNG QUAN TÀI CHÍNH -->
      <div style="margin-bottom: 22px;">
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center;">
          <span style="font-size: 15px; margin-right: 6px;">💎</span>
          <span style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
            2. Tổng Quan Sức Khỏe Tài Chính & Tài Sản Ròng
          </span>
        </div>

        <table style="width: 100%; border-collapse: separate; border-spacing: 6px; margin-bottom: 4px;">
          <tr>
            <td style="width: 50%; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; vertical-align: top;">
              <div style="font-size: 10.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Tài Sản Ròng (Net Worth)</div>
              <div style="font-size: 18px; font-weight: 900; color: #15803d; margin: 3px 0;">${formatVND(netWorth)}</div>
              <div style="font-size: 11px; color: #166534;">Vị thế: <strong>${benchmark.currentTier.title} (${benchmark.currentTier.topPercent} VN)</strong></div>
            </td>
            <td style="width: 50%; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; vertical-align: top;">
              <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Tổng Tài Sản</div>
              <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 3px 0;">${formatVND(totalAssets)}</div>
              <div style="font-size: 11px; color: #64748b;">${(db.assets || []).length} danh mục • Đòn bẩy: ${totalAssets > 0 ? ((totalDebts / totalAssets) * 100).toFixed(1) : 0}%</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  // 3. PHẦN 3: NGHĨA VỤ NỢ & LỊCH TRẢ NỢ HÀNG THÁNG
  if (settings.includeDebts) {
    const activeDebts = (db.debts || []).filter((d) => d.status !== 'Đã tất toán');
    let debtsRowsHtml = '';

    if (activeDebts.length === 0) {
      debtsRowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 14px; color: #16a34a; font-weight: 600; font-size: 12px;">
            ✓ Tuyệt vời! Bạn hiện không có khoản nợ nào cần thanh toán.
          </td>
        </tr>
      `;
    } else {
      debtsRowsHtml = activeDebts
        .map((d, idx) => {
          const remaining = (Number(d.amount) || 0) - (Number(d.paidPrincipal) || 0);
          const monthly = Number(d.monthlyBefore) || Number(d.monthlyAfter) || 0;
          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #0f172a; font-size: 12px;">
                ${idx + 1}. ${d.name}
              </td>
              <td style="padding: 8px; font-size: 12px; color: #e11d48; text-align: right; font-weight: 700;">
                ${formatVND(remaining)}
              </td>
              <td style="padding: 8px; font-size: 12px; color: #0f172a; text-align: right; font-weight: 600;">
                ${formatVND(monthly)}
              </td>
              <td style="padding: 8px; font-size: 11px; color: #64748b; text-align: center;">
                ${d.day ? `Ngày ${d.day}` : '-'}
              </td>
            </tr>
          `;
        })
        .join('');
    }

    sectionsHtml += `
      <!-- SECTION 3: NGHĨA VỤ NỢ -->
      <div style="margin-bottom: 22px;">
        <div style="border-bottom: 2px solid #e11d48; padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 15px; margin-right: 6px;">⚖️</span>
            <span style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
              3. Nghĩa Vụ Nợ & Lịch Thanh Toán Hàng Tháng
            </span>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #be123c;">
            Tổng nợ: ${formatVND(totalDebts)}
          </span>
        </div>

        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #fecdd3; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #fff1f2; font-size: 11px; color: #9f1239; text-transform: uppercase; border-bottom: 1px solid #fecdd3;">
              <th style="padding: 8px; text-align: left;">Khoản nợ</th>
              <th style="padding: 8px; text-align: right;">Dư nợ còn lại</th>
              <th style="padding: 8px; text-align: right;">Gốc + Lãi/tháng</th>
              <th style="padding: 8px; text-align: center;">Hạn trả</th>
            </tr>
          </thead>
          <tbody>
            ${debtsRowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // 4. PHẦN 4: DÒNG TIỀN THU NHẬP - CHI TIÊU
  if (settings.includeCashFlow) {
    sectionsHtml += `
      <!-- SECTION 4: DÒNG TIỀN -->
      <div style="margin-bottom: 22px;">
        <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center;">
          <span style="font-size: 15px; margin-right: 6px;">📈</span>
          <span style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
            4. Dòng Tiền & Kế Hoạch Ngân Sách Tháng
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 12px; font-size: 12px; color: #475569;">Thu nhập ròng (Lương & Nguồn khác):</td>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">${formatVND(totalIncome)}/tháng</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 12px; font-size: 12px; color: #475569;">Tổng nghĩa vụ trả nợ bắt buộc:</td>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #e11d48; text-align: right;">-${formatVND(totalMonthlyDebtPayment)}/tháng</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #047857;">Dòng tiền thặng dư đầu tư & tích sản:</td>
            <td style="padding: 10px 12px; font-size: 14px; font-weight: 900; color: #059669; text-align: right;">${formatVND(surplus)}/tháng</td>
          </tr>
        </table>
      </div>
    `;
  }

  // 5. PHẦN 5: PHÂN BỔ DANH MỤC THÁP TÀI SẢN 3 TẦNG (CÓ DANH SÁCH CỤ THỂ THEO TỪNG TẦNG)
  if (settings.includeAssetPyramid) {
    const l1Assets = (db.assets || []).filter((a) => a.level === '1');
    const l2Assets = (db.assets || []).filter((a) => a.level === '2');
    const l3Assets = (db.assets || []).filter((a) => a.level === '3');

    const l1Sum = l1Assets.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const l2Sum = l2Assets.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const l3Sum = l3Assets.reduce((s, a) => s + (Number(a.amount) || 0), 0);

    const l1Pct = totalAssets > 0 ? ((l1Sum / totalAssets) * 100).toFixed(1) : '0';
    const l2Pct = totalAssets > 0 ? ((l2Sum / totalAssets) * 100).toFixed(1) : '0';
    const l3Pct = totalAssets > 0 ? ((l3Sum / totalAssets) * 100).toFixed(1) : '0';

    const renderTierTable = (title: string, colorHex: string, bgHex: string, borderHex: string, sum: number, pct: string, assets: Asset[]) => {
      let rows = '';
      if (assets.length === 0) {
        rows = `<tr><td colspan="2" style="padding: 6px 10px; font-size: 11px; color: #94a3b8; font-style: italic;">Chưa có tài sản trong tầng này</td></tr>`;
      } else {
        rows = assets.map((a, i) => `
          <tr style="border-bottom: 1px solid ${borderHex}40;">
            <td style="padding: 6px 10px; font-size: 11.5px; color: #1e293b; font-weight: 600;">${i + 1}. ${a.name}</td>
            <td style="padding: 6px 10px; font-size: 11.5px; color: #0f172a; font-weight: 700; text-align: right;">${formatVND(a.amount || 0)}</td>
          </tr>
        `).join('');
      }

      return `
        <div style="background: ${bgHex}; border: 1px solid ${borderHex}; border-radius: 10px; overflow: hidden; margin-bottom: 10px;">
          <div style="padding: 8px 12px; background: ${colorHex}; color: #ffffff; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
            <span>${title}</span>
            <span>${formatVND(sum)} (${pct}%)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; background: #ffffff;">
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    };

    sectionsHtml += `
      <!-- SECTION 5: CHI TIẾT THÁP TÀI SẢN 3 TẦNG (CỤ THỂ TỪNG TẦNG) -->
      <div style="margin-bottom: 20px;">
        <div style="border-bottom: 2px solid #d97706; padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center;">
          <span style="font-size: 15px; margin-right: 6px;">🏛️</span>
          <span style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
            5. Phân Bổ Danh Mục Chi Tiết Tháp Tài Sản 3 Tầng
          </span>
        </div>

        ${renderTierTable('Tầng 1: Tài Sản Bảo Đảm (Dự phòng & Thanh khoản)', '#2563eb', '#eff6ff', '#bfdbfe', l1Sum, l1Pct, l1Assets)}
        ${renderTierTable('Tầng 2: Tài Sản Tăng Trưởng (BĐS, Cổ phiếu, Vàng)', '#16a34a', '#f0fdf4', '#bbf7d0', l2Sum, l2Pct, l2Assets)}
        ${renderTierTable('Tầng 3: Tài Sản Rủi Ro / Cơ Hội', '#dc2626', '#fef2f2', '#fecaca', l3Sum, l3Pct, l3Assets)}
      </div>
    `;
  }

  // Master Email Template Wrap
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo & Nhắc Nhở Mục Tiêu Tài Chính Tháng ${currentMonthYear}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px 10px; color: #1e293b; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- HEADER -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 22px 20px; color: #ffffff; text-align: center;">
      <div style="display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 4px 12px; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: #34d399; letter-spacing: 0.5px;">THÁP TÀI SẢN 3 TẦNG</span>
      </div>
      <h1 style="font-size: 17px; font-weight: 800; margin: 2px 0 4px 0; color: #ffffff;">
        Báo Cáo & Nhắc Nhở Mục Tiêu Tháng ${currentMonthYear}
      </h1>
      <div style="font-size: 11.5px; color: #94a3b8;">
        Người nhận: <strong style="color: #ffffff;">${userDisplay || 'Chủ tài khoản'}</strong> • Thời điểm: ${currentDateStr}
      </div>
    </div>

    <!-- MAIN BODY -->
    <div style="padding: 20px 18px;">
      ${sectionsHtml}
    </div>

    <!-- FOOTER -->
    <div style="background: #f8fafc; padding: 14px 18px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
      <div style="font-weight: 600; color: #334155; margin-bottom: 2px;">
        Hệ Thống Hoạch Định & Quản Trị Tháp Tài Sản Cá Nhân
      </div>
      <div>Bản tin tài chính định kỳ được lập lịch tự động bởi bạn.</div>
      <div style="margin-top: 4px; font-family: monospace; font-size: 10px; color: #94a3b8;">
        Đồng bộ lần cuối: ${db.lastUpdate || getCurrentTimestampVN()}
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

export function generatePlainTextSummary(
  db: DatabaseState,
  settings: EmailScheduleSettings,
  userDisplay?: string
): string {
  const currentMonthYear = new Date().toLocaleDateString('vi-VN', {
    month: '2-digit',
    year: 'numeric',
  });
  const totalAssets = (db.assets || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalDebts = (db.debts || [])
    .filter((d) => d.status !== 'Đã tất toán')
    .reduce((s, d) => s + (Number(d.amount) - (Number(d.paidPrincipal) || 0)), 0);
  const netWorth = totalAssets - totalDebts;

  let text = `BÁO CÁO & NHẮC NHỞ MỤC TIÊU TÀI CHÍNH THÁNG ${currentMonthYear}\n`;
  text += `Tài khoản: ${userDisplay || 'Người dùng'}\n\n`;

  if (settings.includeMonthlyGoals) {
    text += `1. MỤC TIÊU TÍCH SẢN CẦN HOÀN THÀNH:\n`;
    (db.goals || []).forEach((g, idx) => {
      text += ` - #${idx + 1} ${g.name}: ${
        g.goalType === 'dca'
          ? `${g.targetQty} ${g.unit || ''}/tháng`
          : `Tổng ${formatVND(g.target || 0)}`
      } (Đã có: ${g.totalBought || 0})\n`;
    });
    text += `\n`;
  }

  if (settings.includeNetWorthOverview) {
    text += `2. TỔNG QUAN TÀI CHÍNH:\n`;
    text += ` - Tài Sản Ròng (Net Worth): ${formatVND(netWorth)}\n`;
    text += ` - Tổng Tài Sản: ${formatVND(totalAssets)}\n`;
    text += ` - Nghĩa Vụ Nợ: ${formatVND(totalDebts)}\n\n`;
  }

  if (settings.includeAssetPyramid) {
    text += `3. DANH MỤC THÁP TÀI SẢN 3 TẦNG:\n`;
    const l1 = (db.assets || []).filter(a => a.level === '1');
    const l2 = (db.assets || []).filter(a => a.level === '2');
    const l3 = (db.assets || []).filter(a => a.level === '3');
    text += ` * Tầng 1 (Bảo đảm): ${l1.map(a => `${a.name} (${formatVND(a.amount)})`).join(', ') || 'Trống'}\n`;
    text += ` * Tầng 2 (Tăng trưởng): ${l2.map(a => `${a.name} (${formatVND(a.amount)})`).join(', ') || 'Trống'}\n`;
    text += ` * Tầng 3 (Rủi ro): ${l3.map(a => `${a.name} (${formatVND(a.amount)})`).join(', ') || 'Trống'}\n\n`;
  }

  text += `Xem chi tiết trên ứng dụng Tháp Tài Sản: https://ais-pre-thucysrlu7qakeibgvm2k6-299083950282.asia-southeast1.run.app\n`;
  return text;
}
