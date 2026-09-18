import { Asset } from '../types';
import { normalizeDateStr, formatDateVN, calculateMaturityDateISO } from './format';

export interface BankGroup {
  bankKey: string;
  bankName: string;
  bankIcon: string;
  assets: Asset[];
  totalPrincipal: number;
  totalMaturityInterest: number;
  avgMonthlyInterest: number;
  weightedRate: number;
  nearestMaturityDate?: string;
  nearestMaturityISO?: string;
  daysToNearestMaturity?: number;
  count: number;
}

const BANK_RULES: { match: RegExp; name: string; icon: string }[] = [
  { match: /\b(ncb|quoc\s*dan|quốc\s*dân)\b/i, name: 'NCB', icon: '🏛️' },
  { match: /\b(vcb|vietcombank|ngoai\s*thuong|ngoại\s*thương)\b/i, name: 'Vietcombank', icon: '🏛️' },
  { match: /\b(ctg|vietinbank|vietin|cong\s*thuong|công\s*thương)\b/i, name: 'VietinBank', icon: '🏛️' },
  { match: /\b(bidv|dau\s*tu\s*va\s*phat\s*trien|đầu\s*tư\s*và\s*phát\s*triển)\b/i, name: 'BIDV', icon: '🏛️' },
  { match: /\b(agribank|vba|nong\s*nghiep|nông\s*nghiệp)\b/i, name: 'Agribank', icon: '🏛️' },
  { match: /\b(tcb|techcombank|ky\s*thuong|kỹ\s*thương)\b/i, name: 'Techcombank', icon: '🏛️' },
  { match: /\b(mbbank|mb\s*bank|\bmb\b|quan\s*doi|quân\s*đội)\b/i, name: 'MB Bank', icon: '🏛️' },
  { match: /\b(vpb|vpbank|thinh\s*vuong|thịnh\s*vượng)\b/i, name: 'VPBank', icon: '🏛️' },
  { match: /\b(acb|a\s*chau|á\s*châu)\b/i, name: 'ACB', icon: '🏛️' },
  { match: /\b(tpb|tpbank|tien\s*phong|tiên\s*phong)\b/i, name: 'TPBank', icon: '🏛️' },
  { match: /\b(stb|sacombank|sai\s*gon\s*thuong\s*tin|sài\s*gòn\s*thương\s*tín)\b/i, name: 'Sacombank', icon: '🏛️' },
  { match: /\b(hdb|hdbank|phat\s*trien\s*tphcm|phát\s*triển\s*tphcm)\b/i, name: 'HDBank', icon: '🏛️' },
  { match: /\b(vib|quoc\s*te|quốc\s*tế)\b/i, name: 'VIB', icon: '🏛️' },
  { match: /\b(shb|sai\s*gon\s*ha\s*noi|sài\s*gòn\s*hà\s*nội)\b/i, name: 'SHB', icon: '🏛️' },
  { match: /\b(msb|maritime|hang\s*hai|hàng\s*hải)\b/i, name: 'MSB', icon: '🏛️' },
  { match: /\b(ssb|seabank|dong\s*nam\s*a|đông\s*nam\s*á)\b/i, name: 'SeABank', icon: '🏛️' },
  { match: /\b(ocb|phuong\s*dong|phương\s*đông)\b/i, name: 'OCB', icon: '🏛️' },
  { match: /\b(lpb|lpbank|lienviet|lien\s*viet|bưu\s*điện\s*liên\s*việt)\b/i, name: 'LPBank', icon: '🏛️' },
  { match: /\b(bab|bacabank|bac\s*a|bắc\s*á)\b/i, name: 'Bac A Bank', icon: '🏛️' },
  { match: /\b(baoviet|bvb|bao\s*viet|bảo\s*việt)\b/i, name: 'Bảo Việt Bank', icon: '🏛️' },
  { match: /\b(pvcom|pvcombank|dau\s*khi|dầu\s*khí)\b/i, name: 'PVcomBank', icon: '🏛️' },
  { match: /\b(eib|eximbank|xuat\s*nhap\s*khau|xuất\s*nhập\s*khẩu)\b/i, name: 'Eximbank', icon: '🏛️' },
  { match: /\b(scb|sai\s*gon)\b/i, name: 'SCB', icon: '🏛️' },
  { match: /\b(klb|kienlongbank|kien\s*long|kiên\s*long)\b/i, name: 'Kienlongbank', icon: '🏛️' },
  { match: /\b(nab|namabank|nam\s*a|nam\s*á)\b/i, name: 'Nam A Bank', icon: '🏛️' },
  { match: /\b(bvbank|vietcapital|ban\s*viet|bản\s*việt)\b/i, name: 'BVBank', icon: '🏛️' },
  { match: /\b(vab|vietabank|viet\s*a|việt\s*á)\b/i, name: 'VietABank', icon: '🏛️' },
  { match: /\b(sgb|saigonbank)\b/i, name: 'Saigonbank', icon: '🏛️' },
  { match: /\b(pgb|pgbank|xang\s*dau|xăng\s*dầu)\b/i, name: 'PG Bank', icon: '🏛️' },
  { match: /\b(cake)\b/i, name: 'Cake by VPBank', icon: '🧁' },
  { match: /\b(timo)\b/i, name: 'Timo', icon: '💜' },
  { match: /\b(shinhan)\b/i, name: 'Shinhan Bank', icon: '🏛️' },
  { match: /\b(woori)\b/i, name: 'Woori Bank', icon: '🏛️' },
  { match: /\b(hsbc)\b/i, name: 'HSBC', icon: '🏛️' },
  { match: /\b(standard\s*chartered|scb\s*vn)\b/i, name: 'Standard Chartered', icon: '🏛️' },
  { match: /\b(uob)\b/i, name: 'UOB', icon: '🏛️' },
  { match: /\b(public\s*bank)\b/i, name: 'Public Bank', icon: '🏛️' },
];

export function extractBankFromAssetName(name: string): { bankName: string; bankIcon: string } {
  if (!name) return { bankName: 'Ngân hàng khác', bankIcon: '🏛️' };
  
  const trimmed = name.trim();
  
  for (const rule of BANK_RULES) {
    if (rule.match.test(trimmed)) {
      return { bankName: rule.name, bankIcon: rule.icon };
    }
  }

  // Fallback: Check separator e.g. "VCB - Sổ 1" or "NCB: Sổ 1"
  const sepMatch = trimmed.match(/^([^:\-\|\/]+)[\:\-\|\/]/);
  if (sepMatch && sepMatch[1]) {
    const candidate = sepMatch[1].replace(/sổ|tiết kiệm|stk|gửi/gi, '').trim();
    if (candidate.length >= 2) {
      return { bankName: candidate, bankIcon: '🏛️' };
    }
  }

  // Fallback: If starts with STK/Sổ/Tiết kiệm, take next word
  const cleaned = trimmed.replace(/^(sổ\s*tiết\s*kiệm|tiết\s*kiệm|stk|sổ)\s*/gi, '').trim();
  const firstWord = cleaned.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 2) {
    return { bankName: firstWord.toUpperCase(), bankIcon: '🏛️' };
  }

  return { bankName: 'Ngân hàng khác', bankIcon: '🏛️' };
}

export function groupSavingsByBank(savingAssets: Asset[]): BankGroup[] {
  const map = new Map<string, BankGroup>();

  for (const asset of savingAssets) {
    const { bankName, bankIcon } = extractBankFromAssetName(asset.name);
    const key = bankName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        bankKey: key,
        bankName,
        bankIcon,
        assets: [],
        totalPrincipal: 0,
        totalMaturityInterest: 0,
        avgMonthlyInterest: 0,
        weightedRate: 0,
        count: 0,
      });
    }

    const group = map.get(key)!;
    group.assets.push(asset);
    const amt = asset.amount || 0;
    group.totalPrincipal += amt;

    const rate = asset.rate || 0;
    const term = asset.termMonths || 0;
    if (rate > 0 && term > 0) {
      const matInterest = Math.round(amt * (rate / 100) * (term / 12));
      group.totalMaturityInterest += matInterest;
    }
    if (rate > 0) {
      const monthlyInt = Math.round((amt * (rate / 100)) / 12);
      group.avgMonthlyInterest += monthlyInt;
    }
  }

  const groups = Array.from(map.values());
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Compute weighted rate and nearest maturity date for each bank
  groups.forEach((g) => {
    g.count = g.assets.length;
    if (g.totalPrincipal > 0) {
      const sumRateWeight = g.assets.reduce((sum, a) => sum + (a.amount * (a.rate || 0)), 0);
      g.weightedRate = Number((sumRateWeight / g.totalPrincipal).toFixed(2));
    }

    // Determine nearest maturity date among all assets in this bank
    const maturities: { iso: string; time: number }[] = [];
    g.assets.forEach((a) => {
      let iso = a.maturityDate ? normalizeDateStr(a.maturityDate) : '';
      if (!iso && a.startDate && a.termMonths) {
        iso = calculateMaturityDateISO(a.startDate, a.termMonths);
      }
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const parts = iso.split('-').map(Number);
        const t = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        if (!isNaN(t)) {
          maturities.push({ iso, time: t });
        }
      }
    });

    if (maturities.length > 0) {
      // Find the nearest upcoming maturity date (time >= todayTime), or if all in past, the latest past one
      const upcoming = maturities.filter((m) => m.time >= todayTime).sort((a, b) => a.time - b.time);
      const chosen = upcoming.length > 0 ? upcoming[0] : maturities.sort((a, b) => b.time - a.time)[0];
      g.nearestMaturityISO = chosen.iso;
      g.nearestMaturityDate = formatDateVN(chosen.iso);
      g.daysToNearestMaturity = Math.round((chosen.time - todayTime) / (1000 * 60 * 60 * 24));
    }

    // Sort assets inside each bank by maturityDate or amount descending
    g.assets.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  });

  // Sort groups by total principal descending
  groups.sort((a, b) => b.totalPrincipal - a.totalPrincipal);

  return groups;
}

export interface GoalBankResolution {
  isBankLinked: boolean;
  bankKey: string;
  bankName: string;
  bankIcon: string;
  assets: Asset[];
  totalPrincipal: number;
  count: number;
  nearestMaturityDate?: string;
  weightedRate?: number;
}

/**
 * Tự động phân giải mục tiêu sang nhóm sổ tiết kiệm cùng ngân hàng ở Tab 1
 * Ưu tiên:
 * 1. linkedBankKey đã gán trực tiếp (VD: 'ncb')
 * 2. Tên mục tiêu có chứa tên ngân hàng (VD: 'Lập stk NCB', 'Gửi NCB', 'Sổ tiết kiệm NCB')
 * 3. linkedAssetId chỉ định 1 sổ tiết kiệm cụ thể thuộc ngân hàng đó
 */
export function resolveGoalBankSavings(
  goal: { name?: string; linkedAssetId?: number; linkedBankKey?: string; assetType?: string; unit?: string; group?: string },
  savingAssets: Asset[]
): GoalBankResolution | null {
  const bankGroups = groupSavingsByBank(savingAssets);

  // 1. Nếu đã ghim trực tiếp linkedBankKey
  if (goal.linkedBankKey) {
    const key = goal.linkedBankKey.toLowerCase();
    const group = bankGroups.find((bg) => bg.bankKey === key);
    if (group) {
      return {
        isBankLinked: true,
        bankKey: group.bankKey,
        bankName: group.bankName,
        bankIcon: group.bankIcon,
        assets: group.assets,
        totalPrincipal: group.totalPrincipal,
        count: group.count,
        nearestMaturityDate: group.nearestMaturityDate,
        weightedRate: group.weightedRate,
      };
    }
    const info = extractBankFromAssetName(goal.linkedBankKey);
    return {
      isBankLinked: true,
      bankKey: key,
      bankName: info.bankName !== 'Ngân hàng khác' ? info.bankName : goal.linkedBankKey.toUpperCase(),
      bankIcon: info.bankIcon,
      assets: [],
      totalPrincipal: 0,
      count: 0,
    };
  }

  // 2. Tên mục tiêu tự động nhận diện được ngân hàng trong danh sách ngân hàng có sổ ở Tab 1
  if (goal.name) {
    const fromName = extractBankFromAssetName(goal.name);
    if (fromName.bankName !== 'Ngân hàng khác') {
      const key = fromName.bankName.toLowerCase();
      const group = bankGroups.find((bg) => bg.bankKey === key || bg.bankName.toLowerCase() === key);
      if (group) {
        return {
          isBankLinked: true,
          bankKey: group.bankKey,
          bankName: group.bankName,
          bankIcon: group.bankIcon,
          assets: group.assets,
          totalPrincipal: group.totalPrincipal,
          count: group.count,
          nearestMaturityDate: group.nearestMaturityDate,
          weightedRate: group.weightedRate,
        };
      }
    }
  }

  // 3. Nếu mục tiêu từng liên kết với một sổ lẻ ở Tab 1 nhưng sổ đó thuộc một ngân hàng có sổ
  if (goal.linkedAssetId) {
    const asset = savingAssets.find((a) => a.id === goal.linkedAssetId);
    if (asset) {
      const { bankName, bankIcon } = extractBankFromAssetName(asset.name);
      if (bankName !== 'Ngân hàng khác') {
        const key = bankName.toLowerCase();
        const group = bankGroups.find((bg) => bg.bankKey === key);
        if (group) {
          return {
            isBankLinked: true,
            bankKey: group.bankKey,
            bankName: group.bankName,
            bankIcon: group.bankIcon,
            assets: group.assets,
            totalPrincipal: group.totalPrincipal,
            count: group.count,
            nearestMaturityDate: group.nearestMaturityDate,
            weightedRate: group.weightedRate,
          };
        }
      }
    }
  }

  return null;
}
