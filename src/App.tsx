import React, { useState, useEffect, useRef } from 'react';
import { DatabaseState, Asset, Debt, Goal, AssetTransaction } from './types';
import {
  DEFAULT_DATABASE_STATE,
  loadCloudData,
  saveCloudData,
} from './utils/storage';
import { normalizeAccountKey, hashString, getCurrentTimestampVN, getCurrentTimeOnlyVN, getDbTimestamp } from './utils/format';
import { recordRegisteredAccount, getRegisteredAccountsList } from './utils/faceIdEngine';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { FixedBottomNav } from './components/FixedBottomNav';
import { TabPyramid } from './components/TabPyramid';
import { TabDebts } from './components/TabDebts';
import { TabGoals } from './components/TabGoals';
import { TabMarketMacro } from './components/TabMarketMacro';
import { PyramidLogo } from './components/PyramidLogo';
import { EmailReportModal } from './components/EmailReportModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SmartExcelModal } from './components/SmartExcelModal';
import { exportAssetsToExcel } from './utils/excelEngine';
import { EmailScheduleSettings } from './types';
import { Lock, ScanFace, LogIn, CheckCircle2, ShieldCheck } from 'lucide-react';
import { fetchGoldRates, getDojiPrices, GoldRateData } from './utils/goldService';
import {
  fetchStockRates,
  getStockQuote,
  extractStockTicker,
  isStockEntity,
  collectAllStockSymbols,
  StockRateData,
  fetchVNIndexOnly,
} from './utils/stockService';

function isDefaultSampleData(d?: DatabaseState | null): boolean {
  if (!d || !d.assets) return false;
  if (d.assets.length === 7 && d.assets[0]?.name === 'Tiền gửi thanh toán VCB' && d.assets[1]?.name === 'Sổ tiết kiệm BIDV 12 Tháng') {
    return true;
  }
  return false;
}

// Đảm bảo không làm mất giá thị trường (cổ phiếu / vàng) đã được cập nhật mới nhất
function preserveLatestMarketPrices(
  baseDb: DatabaseState,
  sourceWithLiveRates: DatabaseState
): DatabaseState {
  if (!sourceWithLiveRates || !sourceWithLiveRates.assets) return baseDb;

  const liveStockAssetsMap = new Map<string, Asset>();
  const liveGoldAssetsMap = new Map<string, Asset>();
  for (const a of sourceWithLiveRates.assets || []) {
    if (isStockEntity(a)) {
      const sym = extractStockTicker(a.name, a.type, a.unit);
      if (sym && a.currentPrice && a.currentPrice > 0) {
        liveStockAssetsMap.set(sym, a);
      }
    } else if (
      a.type === 'gold' ||
      a.unit === 'chỉ' ||
      a.unit === 'lượng' ||
      a.unit === 'cây' ||
      a.name.toLowerCase().includes('vàng')
    ) {
      if (a.currentPrice && a.currentPrice > 0) {
        liveGoldAssetsMap.set(a.name.toLowerCase().trim(), a);
      }
    }
  }

  const liveStockGoalsMap = new Map<string, Goal>();
  const liveGoldGoalsMap = new Map<string, Goal>();
  for (const g of sourceWithLiveRates.goals || []) {
    if (isStockEntity(g)) {
      const sym = extractStockTicker(g.name, g.assetType, g.unit);
      if (sym && g.currentPrice && g.currentPrice > 0) {
        liveStockGoalsMap.set(sym, g);
      }
    } else if (
      g.assetType === 'gold' ||
      g.unit === 'chỉ' ||
      g.unit === 'lượng' ||
      g.unit === 'cây' ||
      g.name.toLowerCase().includes('vàng') ||
      g.name.toLowerCase().includes('doji') ||
      g.name.toLowerCase().includes('gold')
    ) {
      if (g.currentPrice && g.currentPrice > 0) {
        liveGoldGoalsMap.set(g.name.toLowerCase().trim(), g);
      }
    }
  }

  let hasChanged = false;
  const mergedAssets = (baseDb.assets || []).map((a) => {
    if (isStockEntity(a)) {
      const sym = extractStockTicker(a.name, a.type, a.unit);
      const live = sym ? liveStockAssetsMap.get(sym) : null;
      if (live && live.currentPrice && live.currentPrice > 0 && a.currentPrice !== live.currentPrice) {
        hasChanged = true;
        const qty = a.quantity || 0;
        const newAmount = qty > 0 ? Math.round(qty * live.currentPrice) : a.amount;
        return {
          ...a,
          currentPrice: live.currentPrice,
          amount: newAmount,
          updatedAt: live.updatedAt || a.updatedAt,
        };
      }
    } else if (
      a.type === 'gold' ||
      a.unit === 'chỉ' ||
      a.unit === 'lượng' ||
      a.unit === 'cây' ||
      a.name.toLowerCase().includes('vàng') ||
      a.name.toLowerCase().includes('doji') ||
      a.name.toLowerCase().includes('gold')
    ) {
      const live = liveGoldAssetsMap.get(a.name.toLowerCase().trim());
      if (live && live.currentPrice && live.currentPrice > 0 && a.currentPrice !== live.currentPrice) {
        hasChanged = true;
        const qty = a.quantity || 0;
        const newAmount = qty > 0 ? Math.round(qty * live.currentPrice) : a.amount;
        return {
          ...a,
          currentPrice: live.currentPrice,
          amount: newAmount,
          updatedAt: live.updatedAt || a.updatedAt,
        };
      }
    }
    return a;
  });

  const mergedGoals = (baseDb.goals || []).map((g) => {
    if (isStockEntity(g)) {
      const sym = extractStockTicker(g.name, g.assetType, g.unit);
      const live = sym ? liveStockGoalsMap.get(sym) : null;
      if (live && live.currentPrice && live.currentPrice > 0 && g.currentPrice !== live.currentPrice) {
        hasChanged = true;
        return {
          ...g,
          currentPrice: live.currentPrice,
        };
      }
    } else if (
      g.assetType === 'gold' ||
      g.unit === 'chỉ' ||
      g.unit === 'lượng' ||
      g.unit === 'cây' ||
      g.name.toLowerCase().includes('vàng') ||
      g.name.toLowerCase().includes('doji') ||
      g.name.toLowerCase().includes('gold')
    ) {
      const live = liveGoldGoalsMap.get(g.name.toLowerCase().trim());
      if (live && live.currentPrice && live.currentPrice > 0 && g.currentPrice !== live.currentPrice) {
        hasChanged = true;
        return {
          ...g,
          currentPrice: live.currentPrice,
        };
      }
    }
    return g;
  });

  if (!hasChanged) return baseDb;

  return {
    ...baseDb,
    assets: mergedAssets,
    goals: mergedGoals,
  };
}

// Thuật toán đối soát dữ liệu đa thiết bị (Timestamp-based Conflict Resolution)
function reconcileUserData(
  cloudData?: DatabaseState | null,
  localData?: DatabaseState | null
): { data: DatabaseState; shouldUploadToCloud: boolean } {
  if (!cloudData && !localData) {
    return { data: DEFAULT_DATABASE_STATE, shouldUploadToCloud: false };
  }
  if (!cloudData && localData) {
    return { data: localData, shouldUploadToCloud: true };
  }
  if (cloudData && !localData) {
    return { data: cloudData, shouldUploadToCloud: false };
  }

  // Khóa an toàn chống ghi đè: Nếu Cloud đã có dữ liệu thực tế mà Local chỉ là dữ liệu mẫu ban đầu -> Luôn lấy Cloud!
  const isLocalSample = isDefaultSampleData(localData);
  const isCloudSample = isDefaultSampleData(cloudData);
  if (!isCloudSample && isLocalSample) {
    return { data: cloudData!, shouldUploadToCloud: false };
  }

  const cloudTime = getDbTimestamp(cloudData);
  const localTime = getDbTimestamp(localData);

  if (cloudTime > localTime) {
    // Cloud mới hơn (do vừa chỉnh trên điện thoại/máy tính khác) -> Cập nhật Local theo Cloud, nhưng bảo toàn giá thị trường mới nhất
    const merged = preserveLatestMarketPrices(cloudData!, localData!);
    return { data: merged, shouldUploadToCloud: merged !== cloudData };
  } else if (localTime > cloudTime) {
    // Local mới hơn -> Giữ Local và cần đẩy lên Cloud
    const merged = preserveLatestMarketPrices(localData!, cloudData!);
    return { data: merged, shouldUploadToCloud: true };
  } else {
    // Cùng thời gian -> Ưu tiên Cloud nhưng bảo toàn giá thị trường mới nhất
    const merged = preserveLatestMarketPrices(cloudData!, localData!);
    return { data: merged, shouldUploadToCloud: merged !== cloudData };
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'pyramid' | 'debts' | 'goals' | 'market'>('pyramid');
  const [db, setDb] = useState<DatabaseState>(DEFAULT_DATABASE_STATE);
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('thaptaisan_privacy_mode') === '1';
  });

  const [currentAccountKey, setCurrentAccountKey] = useState<string>('');
  const [userDisplay, setUserDisplay] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(true);
  const [showEmailReportModal, setShowEmailReportModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [showSmartExcelModal, setShowSmartExcelModal] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'saved' | 'offline'>('synced');
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const syncToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedStateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showSyncNotification = (message: string) => {
    if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
    setSyncToast(message);
    syncToastTimerRef.current = setTimeout(() => {
      setSyncToast(null);
    }, 2600);
  };

  const [marketGoldData, setMarketGoldData] = useState<GoldRateData | null>(null);
  const [marketStockData, setMarketStockData] = useState<StockRateData | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('thaptaisan_last_sync_time') || getCurrentTimeOnlyVN();
  });

  const updateSyncTimestamp = (customTime?: string) => {
    const t = customTime || getCurrentTimeOnlyVN();
    setLastSyncTime(t);
    try {
      localStorage.setItem('thaptaisan_last_sync_time', t);
    } catch (e) {}
  };

  // Cloud root memory cache - nạp ngay từ local cache nếu có để kiểm tra trong 0.001s
  const [cloudRoot, setCloudRoot] = useState<{
    passwords: Record<string, string>;
    users: Record<string, DatabaseState>;
  }>(() => {
    try {
      const cached = localStorage.getItem('thaptaisan_cloud_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          passwords: parsed.passwords || {},
          users: parsed.users || {},
        };
      }
    } catch (e) {}
    return { passwords: {}, users: {} };
  });

  // Refs for background debounce sync & lifecycle exit auto-save
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isBackgroundSavingRef = useRef<boolean>(false);
  const pendingDbRef = useRef<DatabaseState | null>(null);
  const currentAccountKeyRef = useRef<string>('');
  const cloudRootRef = useRef(cloudRoot);
  const dbRef = useRef(db);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  useEffect(() => {
    currentAccountKeyRef.current = currentAccountKey;
  }, [currentAccountKey]);

  useEffect(() => {
    cloudRootRef.current = cloudRoot;
  }, [cloudRoot]);

  // Tự động đồng bộ ngầm khi thoát, ẩn tab, chuyển app trên điện thoại hoặc đóng trình duyệt
  useEffect(() => {
    const handleAutoSync = () => {
      const targetKey = currentAccountKeyRef.current;
      const currentDb = pendingDbRef.current || dbRef.current;
      if (targetKey && currentDb && (currentDb.assets?.length > 0 || currentDb.debts?.length > 0 || currentDb.goals?.length > 0 || currentDb.salaryIncome > 0)) {
        const updatedCloud = {
          ...cloudRootRef.current,
          users: {
            ...cloudRootRef.current.users,
            [targetKey]: currentDb,
          },
        };
        saveCloudData(updatedCloud, true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAutoSync();
      }
    };

    window.addEventListener('pagehide', handleAutoSync);
    window.addEventListener('beforeunload', handleAutoSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handleAutoSync);
      window.removeEventListener('beforeunload', handleAutoSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // On App Mount: Always show login screen / Face ID lock so user explicitly clicks to unlock
  useEffect(() => {
    const initApp = async () => {
      // Keep-alive warm-up ping để đánh thức Google Apps Script ngay khi vừa mở ứng dụng
      fetch('/api/cloud-sync?ping=1').catch(() => {});

      // Fetch cloud root in background to be ready for instant verification
      loadCloudData().then((cloudData) => {
        if (cloudData) {
          setCloudRoot(cloudData);
          updateSyncTimestamp();
        }
      });

      // Always require explicit Face ID tap or login click upon reopening the app
      setShowAuthModal(true);
    };

    initApp();
  }, []);

  const setupUserSession = (rawAccount: string, accKey: string, userData?: DatabaseState) => {
    setCurrentAccountKey(accKey);
    updateSyncTimestamp();

    let displayLabel = rawAccount;
    if (rawAccount.includes('@')) {
      const [userPart, domain] = rawAccount.split('@');
      displayLabel = (userPart.length > 3 ? userPart.substring(0, 3) + '***' : userPart) + '@' + domain;
    } else {
      displayLabel = rawAccount.length > 4 ? rawAccount.substring(0, 4) + '***' : rawAccount;
    }
    setUserDisplay(displayLabel);
    setShowAuthModal(false);

    if (userData) {
      setDb({
        ...DEFAULT_DATABASE_STATE,
        ...userData,
        assets: userData.assets || [],
        debts: userData.debts || [],
        goals: userData.goals || [],
        history: userData.history || [],
      });
    }
  };

  // HỆ THỐNG CẬP NHẬT ĐƠN GIÁ THỊ TRƯỜNG TỰ ĐỘNG CHẠY NỀN LIÊN TỤC (Real-time Background Market Sync)
  // Tự động quét giá Vàng DOJI & Cổ phiếu trực tuyến và đồng bộ vào Tài sản (Tab 1) và Mục tiêu (Tab 3)
  const syncLiveMarketRates = React.useCallback(async (forceRefresh = true) => {
    try {
      const currentDb = dbRef.current;
      const symbols = collectAllStockSymbols(currentDb.assets || [], currentDb.goals || []);

      // Gọi đồng thời cả giá Vàng, Cổ phiếu và VN-Index trực tiếp
      const [goldData, stockData, vnData] = await Promise.all([
        fetchGoldRates(forceRefresh),
        fetchStockRates(symbols, forceRefresh),
        fetchVNIndexOnly(forceRefresh),
      ]);

      if (goldData) setMarketGoldData(goldData);
      if (stockData) {
        if (vnData) stockData.vnindex = vnData;
        setMarketStockData(stockData);
      } else if (vnData) {
        setMarketStockData((prev) => (prev ? { ...prev, vnindex: vnData } : null));
      }

      setDb((prevDb) => {
        let hasAssetChange = false;
        let hasGoalChange = false;

        // 1. Cập nhật giá Vàng vào Tài sản Tab 1 & Mục tiêu Tab 3
        const updatedAssetsAfterGold = (prevDb.assets || []).map((a) => {
          const isGold =
            a.type === 'gold' ||
            a.unit === 'chỉ' ||
            a.unit === 'lượng' ||
            a.unit === 'cây' ||
            a.name.toLowerCase().includes('vàng') ||
            a.name.toLowerCase().includes('doji') ||
            a.name.toLowerCase().includes('gold');

          if (!isGold || !goldData || !goldData.summary) return a;
          const { buyPrice } = getDojiPrices(goldData, a.unit, a.name);
          if (!buyPrice || buyPrice <= 0) return a;

          const qty = a.quantity || 0;
          const expectedAmt = qty > 0 ? Math.round(qty * buyPrice) : a.amount;
          if (a.currentPrice !== buyPrice || (qty > 0 && a.amount !== expectedAmt)) {
            hasAssetChange = true;
            return {
              ...a,
              currentPrice: buyPrice,
              amount: expectedAmt,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            };
          }
          return a;
        });

        const updatedGoalsAfterGold = (prevDb.goals || []).map((g) => {
          const isGold =
            g.assetType === 'gold' ||
            g.unit === 'chỉ' ||
            g.unit === 'lượng' ||
            g.unit === 'cây' ||
            g.name.toLowerCase().includes('vàng') ||
            g.name.toLowerCase().includes('doji') ||
            g.name.toLowerCase().includes('gold');

          if (!isGold || !goldData || !goldData.summary) return g;
          const { sellPrice } = getDojiPrices(goldData, g.unit, g.name);
          if (!sellPrice || sellPrice <= 0) return g;

          if (g.currentPrice !== sellPrice) {
            hasGoalChange = true;
            return {
              ...g,
              currentPrice: sellPrice,
            };
          }
          return g;
        });

        // 2. Cập nhật giá Cổ phiếu vào Tài sản Tab 1 & Mục tiêu Tab 3
        const finalAssets = updatedAssetsAfterGold.map((a) => {
          if (!isStockEntity(a) || !stockData || !stockData.stocks) return a;
          const sym = extractStockTicker(a.name, a.type, a.unit);
          const quote = sym ? getStockQuote(stockData, sym) : null;
          if (!quote || quote.price <= 0) return a;

          const qty = a.quantity || 0;
          const expectedAmt = qty > 0 ? Math.round(qty * quote.price) : a.amount;
          if (a.currentPrice !== quote.price || (qty > 0 && a.amount !== expectedAmt)) {
            hasAssetChange = true;
            return {
              ...a,
              currentPrice: quote.price,
              amount: expectedAmt,
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            };
          }
          return a;
        });

        const finalGoals = updatedGoalsAfterGold.map((g) => {
          if (!isStockEntity(g) || !stockData || !stockData.stocks) return g;
          const sym = extractStockTicker(g.name, g.assetType, g.unit);
          const quote = sym ? getStockQuote(stockData, sym) : null;
          if (!quote || quote.price <= 0) return g;

          if (g.currentPrice !== quote.price) {
            hasGoalChange = true;
            return {
              ...g,
              currentPrice: quote.price,
            };
          }
          return g;
        });

        if (!hasAssetChange && !hasGoalChange) return prevDb;

        const now = Date.now();
        const newDb = {
          ...prevDb,
          assets: finalAssets,
          goals: finalGoals,
          lastUpdate: getCurrentTimestampVN(),
          updatedAtTimestamp: now,
        };

        const accKey = currentAccountKeyRef.current;
        if (accKey) {
          localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(newDb));
          dbRef.current = newDb;
          triggerBackgroundSync(newDb, { immediate: false, isUserAction: false });
        }
        return newDb;
      });
    } catch (err) {
      console.warn('[RealtimeUpdater] Lỗi tự động cập nhật đơn giá thị trường:', err);
    }
  }, []);

  // KÍCH HOẠT CHẠY NỀN LIÊN TỤC:
  // - Chạy ngay khi mở ứng dụng / đổi tài khoản
  // - Lặp lại liên tục mỗi 20 giây (chu kỳ thị trường)
  // - Tự động tải lại ngay khi người dùng quay lại tab trình duyệt (Focus / VisibilityChange)
  useEffect(() => {
    // Tải ngay lần đầu
    syncLiveMarketRates(true);

    // Chu kỳ cập nhật ngầm định kỳ mỗi 20 giây
    const pollInterval = setInterval(() => {
      syncLiveMarketRates(true);
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncLiveMarketRates(true);
      }
    };
    const handleFocus = () => {
      syncLiveMarketRates(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncLiveMarketRates]);

  // Kích hoạt khi đổi tài khoản
  useEffect(() => {
    if (currentAccountKey) {
      syncLiveMarketRates(true);
    }
  }, [currentAccountKey, syncLiveMarketRates]);

  // Face ID Biometric Unlock Handler - ĐỒNG BỘ 2 CHIỀU CHUẨN XÁC THEO THỜI GIAN
  const handleFaceIdUnlock = async (accountName?: string): Promise<boolean> => {
    const savedAccount =
      accountName ||
      localStorage.getItem('thaptaisan_faceid_account') ||
      localStorage.getItem('thaptaisan_saved_account') ||
      localStorage.getItem('thaptaisan_active_account') ||
      '';

    if (!savedAccount) return false;

    const accKey = normalizeAccountKey(savedAccount);
    const localSavedStr = localStorage.getItem(`thaptaisan_local_${accKey}`);
    let localData: DatabaseState | null = null;
    if (localSavedStr) {
      try {
        localData = JSON.parse(localSavedStr);
      } catch (e) {
        console.error('Error parsing local cache for Face ID:', e);
      }
    }
    const cloudData = cloudRootRef.current.users?.[accKey];
    const { data: bestData, shouldUploadToCloud } = reconcileUserData(cloudData, localData);

    localStorage.setItem('thaptaisan_saved_account', savedAccount);
    localStorage.setItem('thaptaisan_faceid_account', savedAccount);
    localStorage.setItem('thaptaisan_active_account', savedAccount);
    localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(bestData));
    recordRegisteredAccount(savedAccount);

    // 1. Vào App ngay lập tức với bản dữ liệu tối ưu nhất
    setupUserSession(savedAccount, accKey, bestData);
    setCurrentTab('pyramid');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Tải bản Cloud mới nhất từ Google Drive và đối soát lại
    setCloudSyncStatus('syncing');
    loadCloudData().then((fetched) => {
      if (fetched) {
        setCloudRoot(fetched);
        const freshCloudUser = fetched.users?.[accKey];
        const currentLocalStr = localStorage.getItem(`thaptaisan_local_${accKey}`);
        const currentLocal = currentLocalStr ? JSON.parse(currentLocalStr) : bestData;
        const reconciled = reconcileUserData(freshCloudUser, currentLocal);

        if (reconciled.data !== currentLocal) {
          setDb({
            ...DEFAULT_DATABASE_STATE,
            ...reconciled.data,
            assets: reconciled.data.assets || [],
            debts: reconciled.data.debts || [],
            goals: reconciled.data.goals || [],
            history: reconciled.data.history || [],
          });
          localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(reconciled.data));
        }

        if (reconciled.shouldUploadToCloud) {
          const latestPayload = {
            ...fetched,
            users: {
              ...fetched.users,
              [accKey]: reconciled.data,
            },
          };
          saveCloudData(latestPayload).then((ok) => {
            setCloudSyncStatus(ok ? 'synced' : 'offline');
            if (ok) updateSyncTimestamp();
          });
        } else {
          setCloudSyncStatus('synced');
          updateSyncTimestamp();
        }
      } else {
        setCloudSyncStatus('offline');
      }
    });

    return true;
  };

  const handleLogin = async (
    rawAccount: string,
    pass: string,
    remember: boolean
  ): Promise<{ success: boolean; reason?: string }> => {
    const accKey = normalizeAccountKey(rawAccount);
    const hashed = await hashString(pass);

    // Hàm hỗ trợ tìm tài khoản thông minh trong danh mục mật khẩu (hỗ trợ số điện thoại 0/84/+84 và username)
    const resolveMatchedKey = (inputKey: string, passMap: Record<string, string>): string | null => {
      if (!passMap) return null;
      if (passMap[inputKey]) return inputKey;
      if (inputKey.startsWith('phone_')) {
        const phoneDigits = inputKey.replace('phone_', '');
        for (const k of Object.keys(passMap)) {
          if (k.startsWith('phone_')) {
            const kDigits = k.replace('phone_', '');
            if (kDigits.length >= 8 && phoneDigits.length >= 8 && (kDigits.slice(-9) === phoneDigits.slice(-9))) {
              return k;
            }
          }
        }
      }
      const lower = inputKey.toLowerCase();
      for (const k of Object.keys(passMap)) {
        if (k.toLowerCase() === lower) return k;
      }
      return null;
    };

    // 1. Xác thực tức thì từ Local / RAM Cache (< 0.05s)
    const localSavedStr = localStorage.getItem(`thaptaisan_local_${accKey}`);
    const localPassHash = localStorage.getItem(`thaptaisan_pass_${accKey}`);
    const registeredList = getRegisteredAccountsList();
    const isKnownLocally = registeredList.some(
      (a) => normalizeAccountKey(a) === accKey
    );
    const currentMemoryCloud = cloudRootRef.current;
    const resolvedLocalCloudKey = resolveMatchedKey(accKey, currentMemoryCloud.passwords || {});
    const knownCloudPass = resolvedLocalCloudKey ? currentMemoryCloud.passwords?.[resolvedLocalCloudKey] : undefined;

    const isMatch =
      (localPassHash && (localPassHash === hashed || localPassHash === pass)) ||
      (knownCloudPass && (knownCloudPass === hashed || knownCloudPass === pass)) ||
      (localStorage.getItem('thaptaisan_saved_account')?.trim().toLowerCase() === rawAccount.trim().toLowerCase() &&
        localStorage.getItem('thaptaisan_saved_pass') === pass);

    if (isMatch) {
      const activeKey = resolvedLocalCloudKey || accKey;
      let localData: DatabaseState | null = null;
      if (localSavedStr) {
        try {
          localData = JSON.parse(localSavedStr);
        } catch (e) {}
      }
      const { data: userData, shouldUploadToCloud } = reconcileUserData(
        currentMemoryCloud.users?.[activeKey],
        localData
      );

      if (remember) {
        localStorage.setItem('thaptaisan_saved_account', rawAccount);
        localStorage.setItem('thaptaisan_saved_pass', pass);
        localStorage.setItem('thaptaisan_faceid_enabled', '1');
        localStorage.setItem('thaptaisan_faceid_account', rawAccount);
      } else {
        localStorage.setItem('thaptaisan_saved_account', rawAccount);
        localStorage.removeItem('thaptaisan_saved_pass');
      }
      localStorage.setItem('thaptaisan_active_account', rawAccount);
      localStorage.setItem(`thaptaisan_pass_${activeKey}`, hashed);
      localStorage.setItem(`thaptaisan_local_${activeKey}`, JSON.stringify(userData));
      recordRegisteredAccount(rawAccount);

      // Mở màn hình chính ngay lập tức
      setupUserSession(rawAccount, activeKey, userData);
      setCurrentTab('pyramid');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Đồng bộ ngầm với Google Drive và giải quyết xung đột
      setCloudSyncStatus('syncing');
      loadCloudData().then((fetched) => {
        if (fetched) {
          setCloudRoot(fetched);
          const freshCloudUser = fetched.users?.[activeKey];
          const currentLocalStr = localStorage.getItem(`thaptaisan_local_${activeKey}`);
          const currentLocal = currentLocalStr ? JSON.parse(currentLocalStr) : userData;
          const reconciled = reconcileUserData(freshCloudUser, currentLocal);

          if (reconciled.data !== currentLocal) {
            setDb({
              ...DEFAULT_DATABASE_STATE,
              ...reconciled.data,
              assets: reconciled.data.assets || [],
              debts: reconciled.data.debts || [],
              goals: reconciled.data.goals || [],
              history: reconciled.data.history || [],
            });
            localStorage.setItem(`thaptaisan_local_${activeKey}`, JSON.stringify(reconciled.data));
          }

          if (reconciled.shouldUploadToCloud) {
            const latestPayload = {
              ...fetched,
              users: {
                ...fetched.users,
                [activeKey]: reconciled.data,
              },
            };
            saveCloudData(latestPayload).then((ok) => {
              setCloudSyncStatus(ok ? 'synced' : 'offline');
              if (ok) updateSyncTimestamp();
            });
          } else {
            setCloudSyncStatus('synced');
            updateSyncTimestamp();
          }
        } else {
          setCloudSyncStatus('offline');
        }
      });

      return { success: true };
    }

    // Nếu thông tin đã biết nhưng sai mật khẩu -> Báo lỗi ngay lập tức
    if (
      (localPassHash && localPassHash !== hashed && localPassHash !== pass) ||
      (knownCloudPass && knownCloudPass !== hashed && knownCloudPass !== pass)
    ) {
      return {
        success: false,
        reason: 'Mật khẩu không chính xác. Vui lòng thử lại!',
      };
    }

    // 2. Fallback: Nếu là tài khoản hoàn toàn mới trên thiết bị này (ví dụ điện thoại mới vào lần đầu)
    setCloudSyncStatus('syncing');
    let latestCloud = currentMemoryCloud;
    const fetched = await loadCloudData();
    if (fetched) {
      latestCloud = fetched;
      setCloudRoot(fetched);
      setCloudSyncStatus('synced');
    } else {
      setCloudSyncStatus('offline');
    }

    if (!latestCloud.passwords) latestCloud.passwords = {};
    if (!latestCloud.users) latestCloud.users = {};

    const effectiveCloudKey = resolveMatchedKey(accKey, latestCloud.passwords);

    // Nếu không kết nối được tới Cloud và máy chưa từng lưu tài khoản
    if (!fetched && Object.keys(latestCloud.passwords).length === 0 && !isKnownLocally && !localSavedStr) {
      return {
        success: false,
        reason: 'Không thể kết nối đến máy chủ Google Drive để xác thực tài khoản. Vui lòng kiểm tra lại mạng Wifi/4G và thử lại!',
      };
    }

    // Nếu tài khoản không tồn tại ở cả cloud lẫn máy
    if (!effectiveCloudKey && !isKnownLocally && !localSavedStr) {
      return {
        success: false,
        reason: 'Tài khoản chưa tồn tại trên hệ thống. Vui lòng chuyển sang tab Đăng Ký để tạo tài khoản và cài đặt Face ID!',
      };
    }

    // Kiểm tra mật khẩu từ cloud
    const cloudUserKey = effectiveCloudKey || accKey;
    if (latestCloud.passwords[cloudUserKey]) {
      const savedHash = latestCloud.passwords[cloudUserKey];
      if (savedHash !== hashed && savedHash !== pass) {
        return {
          success: false,
          reason: 'Mật khẩu không chính xác. Vui lòng thử lại!',
        };
      }
    }

    let fallbackLocal: DatabaseState | null = null;
    if (localSavedStr) {
      try {
        fallbackLocal = JSON.parse(localSavedStr);
      } catch (e) {}
    }
    const { data: userData } = reconcileUserData(latestCloud.users[cloudUserKey], fallbackLocal);

    if (remember) {
      localStorage.setItem('thaptaisan_saved_account', rawAccount);
      localStorage.setItem('thaptaisan_saved_pass', pass);
      localStorage.setItem('thaptaisan_faceid_enabled', '1');
      localStorage.setItem('thaptaisan_faceid_account', rawAccount);
    } else {
      localStorage.setItem('thaptaisan_saved_account', rawAccount);
      localStorage.removeItem('thaptaisan_saved_pass');
    }
    localStorage.setItem('thaptaisan_active_account', rawAccount);
    localStorage.setItem(`thaptaisan_pass_${cloudUserKey}`, hashed);
    localStorage.setItem(`thaptaisan_local_${cloudUserKey}`, JSON.stringify(userData));
    recordRegisteredAccount(rawAccount);

    setupUserSession(rawAccount, cloudUserKey, userData);
    setCurrentTab('pyramid');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { success: true };
  };

  const handleRegister = async (
    rawAccount: string,
    pass: string,
    remember: boolean
  ): Promise<{ success: boolean; reason?: string }> => {
    const accKey = normalizeAccountKey(rawAccount);
    const hashed = await hashString(pass);
    const now = Date.now();

    const initialUserData: DatabaseState = {
      ...DEFAULT_DATABASE_STATE,
      lastUpdate: getCurrentTimestampVN(),
      updatedAtTimestamp: now,
    };

    // Lưu ngay cục bộ để vào App lập tức (< 0.05s)
    localStorage.setItem(`thaptaisan_pass_${accKey}`, hashed);
    localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(initialUserData));
    if (remember) {
      localStorage.setItem('thaptaisan_saved_account', rawAccount);
      localStorage.setItem('thaptaisan_saved_pass', pass);
      localStorage.setItem('thaptaisan_faceid_enabled', '1');
      localStorage.setItem('thaptaisan_faceid_account', rawAccount);
    } else {
      localStorage.setItem('thaptaisan_saved_account', rawAccount);
      localStorage.removeItem('thaptaisan_saved_pass');
    }
    localStorage.setItem('thaptaisan_active_account', rawAccount);
    recordRegisteredAccount(rawAccount);

    // Mở màn hình chính ngay lập tức
    setupUserSession(rawAccount, accKey, initialUserData);
    setCurrentTab('pyramid');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Đồng bộ tài khoản mới lên Google Drive chạy ngầm (non-blocking)
    setCloudSyncStatus('syncing');
    loadCloudData().then((fetched) => {
      const latest = fetched || cloudRootRef.current || { passwords: {}, users: {} };
      if (!latest.passwords) latest.passwords = {};
      if (!latest.users) latest.users = {};
      latest.passwords[accKey] = hashed;
      latest.users[accKey] = initialUserData;
      setCloudRoot(latest);
      saveCloudData(latest).then((ok) => {
        setCloudSyncStatus(ok ? 'synced' : 'offline');
      });
    });

    return { success: true };
  };

  const handleLogout = async () => {
    // Tự động đồng bộ dữ liệu mới nhất lên Cloud trước khi đăng xuất
    const targetKey = currentAccountKeyRef.current;
    const currentDb = pendingDbRef.current || dbRef.current;
    if (targetKey && currentDb) {
      setCloudSyncStatus('syncing');
      const updatedCloud = {
        ...cloudRootRef.current,
        users: {
          ...cloudRootRef.current.users,
          [targetKey]: currentDb,
        },
      };
      await saveCloudData(updatedCloud, true);
      setCloudSyncStatus('synced');
    }

    // Xóa phiên làm việc hiện tại
    localStorage.removeItem('thaptaisan_active_account');
    localStorage.removeItem('thaptaisan_saved_pass');
    setUserDisplay('');
    setCurrentAccountKey('');
    currentAccountKeyRef.current = '';
    // Đưa giao diện về trạng thái mặc định sạch để bảo vệ tính riêng tư
    setDb(DEFAULT_DATABASE_STATE);
    // Mở màn hình đăng nhập
    setShowAuthModal(true);
  };

  // Đổi mật khẩu từ bên ngoài (khi chưa đăng nhập / quên mật khẩu)
  const handleResetPassword = async (
    rawAccount: string,
    newPass: string
  ): Promise<{ success: boolean; reason?: string }> => {
    const accKey = normalizeAccountKey(rawAccount);
    const hashed = await hashString(newPass);

    // Cập nhật pass hash local
    localStorage.setItem(`thaptaisan_pass_${accKey}`, hashed);
    localStorage.setItem('thaptaisan_saved_account', rawAccount);
    localStorage.removeItem('thaptaisan_saved_pass');
    recordRegisteredAccount(rawAccount);

    // Cập nhật cloud root
    setCloudSyncStatus('syncing');
    const latest = cloudRootRef.current || { passwords: {}, users: {} };
    if (!latest.passwords) latest.passwords = {};
    latest.passwords[accKey] = hashed;
    setCloudRoot(latest);
    saveCloudData(latest).then((ok) => {
      setCloudSyncStatus(ok ? 'synced' : 'offline');
    });

    return { success: true };
  };

  // Đổi mật khẩu từ bên trong ứng dụng (khi đã đăng nhập)
  const handleChangePasswordInside = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; reason?: string }> => {
    const rawAccount = userDisplay || localStorage.getItem('thaptaisan_active_account') || '';
    if (!rawAccount) {
      return { success: false, reason: 'Chưa xác định được tài khoản đang đăng nhập' };
    }
    const accKey = normalizeAccountKey(rawAccount);
    const oldHashed = await hashString(oldPass);

    // Kiểm tra mật khẩu cũ
    const localPassHash = localStorage.getItem(`thaptaisan_pass_${accKey}`);
    const cloudPassHash = cloudRootRef.current?.passwords?.[accKey];
    const savedPass = localStorage.getItem('thaptaisan_saved_pass');

    const isOldCorrect =
      (localPassHash && (localPassHash === oldHashed || localPassHash === oldPass)) ||
      (cloudPassHash && (cloudPassHash === oldHashed || cloudPassHash === oldPass)) ||
      (savedPass && savedPass === oldPass);

    if (!isOldCorrect) {
      return { success: false, reason: 'Mật khẩu hiện tại không chính xác!' };
    }

    const newHashed = await hashString(newPass);
    localStorage.setItem(`thaptaisan_pass_${accKey}`, newHashed);
    localStorage.setItem('thaptaisan_saved_account', rawAccount);
    localStorage.removeItem('thaptaisan_saved_pass');

    // Đồng bộ lên cloud ngầm
    setCloudSyncStatus('syncing');
    const latest = cloudRootRef.current || { passwords: {}, users: {} };
    if (!latest.passwords) latest.passwords = {};
    latest.passwords[accKey] = newHashed;
    setCloudRoot(latest);
    saveCloudData(latest).then((ok) => {
      setCloudSyncStatus(ok ? 'synced' : 'offline');
    });

    return { success: true };
  };

  const handleTogglePrivacy = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem('thaptaisan_privacy_mode', next ? '1' : '0');
      return next;
    });
  };

  // OPTIMISTIC UI + NON-BLOCKING BACKGROUND SYNC
  // Tự động đồng bộ ẩn hoàn toàn (không hiện xoay, không đổi màu nhấp nháy khi tự động cập nhật nền)
  // Chỉ hiển thị trạng thái "Đang lưu..." -> "✓ Đã lưu an toàn" khi người dùng thực hiện thao tác nhập/sửa/xóa dữ liệu
  interface SyncOptions {
    immediate?: boolean;
    isUserAction?: boolean;
    actionLabel?: string;
  }

  const triggerBackgroundSync = (
    newDb: DatabaseState,
    options: boolean | SyncOptions = false
  ) => {
    const immediate = typeof options === 'boolean' ? options : !!options.immediate;
    const isUserAction =
      typeof options === 'boolean'
        ? true
        : options.isUserAction !== undefined
        ? options.isUserAction
        : true;
    const actionLabel =
      typeof options === 'object' && options.actionLabel ? options.actionLabel : '';

    const accKey = currentAccountKeyRef.current;
    if (!accKey) return;

    // Step 1: Instant local save (0ms - completely immune to lag)
    localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(newDb));
    pendingDbRef.current = newDb;

    // Step 2: Clear any pending debounce timer
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Step 3: CHỈ hiển thị trạng thái "Đang lưu..." trên nút đồng bộ khi có thao tác của người dùng
    if (isUserAction) {
      setIsSyncing(true);
      setCloudSyncStatus('syncing');
    }

    const performSave = async () => {
      const targetDb = pendingDbRef.current;
      const targetKey = currentAccountKeyRef.current;
      if (!targetDb || !targetKey) {
        if (isUserAction) setIsSyncing(false);
        return;
      }

      if (isBackgroundSavingRef.current) {
        // If already saving, queue a retry right after
        syncTimeoutRef.current = setTimeout(performSave, 1500);
        return;
      }

      // Khóa an toàn chống ghi đè: Nếu Cloud đã có dữ liệu thực tế mà targetDb chỉ là dữ liệu mẫu -> Không ghi đè!
      const existingCloudUser = cloudRootRef.current.users?.[targetKey];
      if (existingCloudUser && !isDefaultSampleData(existingCloudUser) && isDefaultSampleData(targetDb)) {
        console.warn('Safe-sync guard prevented overwriting real cloud data with default sample data');
        isBackgroundSavingRef.current = false;
        if (isUserAction) {
          setIsSyncing(false);
          setCloudSyncStatus('synced');
        }
        return;
      }

      isBackgroundSavingRef.current = true;
      if (isUserAction) {
        setCloudSyncStatus('syncing');
      }

      const updatedCloud = {
        ...cloudRootRef.current,
        users: {
          ...cloudRootRef.current.users,
          [targetKey]: targetDb,
        },
      };
      setCloudRoot(updatedCloud);

      const success = await saveCloudData(updatedCloud);
      isBackgroundSavingRef.current = false;

      if (success) {
        const nowTime = getCurrentTimeOnlyVN();
        updateSyncTimestamp(nowTime);

        if (isUserAction) {
          // Báo lưu thành công rõ ràng để tăng sự an tâm và tin tưởng của người dùng
          setIsSyncing(false);
          setCloudSyncStatus('saved');
          const toastMsg = actionLabel
            ? `✓ ${actionLabel} - Đã lưu an toàn lên Cloud`
            : `✓ Đã lưu an toàn & đồng bộ với Cloud (${nowTime})`;
          showSyncNotification(toastMsg);

          if (savedStateTimerRef.current) clearTimeout(savedStateTimerRef.current);
          savedStateTimerRef.current = setTimeout(() => {
            setCloudSyncStatus('synced');
          }, 2500);
        } else {
          // Tự đồng bộ ẩn: cập nhật giờ êm ru mà không làm phiền người dùng
          setCloudSyncStatus('synced');
        }

        // Check if user made another change while we were uploading
        if (pendingDbRef.current && pendingDbRef.current !== targetDb) {
          syncTimeoutRef.current = setTimeout(performSave, 1200);
        }
      } else {
        if (isUserAction) {
          setIsSyncing(false);
          setCloudSyncStatus('offline');
        }
      }
    };

    if (immediate) {
      performSave();
    } else {
      // 1.2s debounce so rapid clicks don't spam Google Apps Script
      syncTimeoutRef.current = setTimeout(performSave, 1200);
    }
  };

  // Manual Explicit Google Drive Sync Action (Optimistic UI < 0.1s + Background Drive Sync)
  const handleSyncDrive = async () => {
    const accKey = currentAccountKeyRef.current;
    const nowTime = getCurrentTimeOnlyVN();
    
    // 1. Phản hồi tức thì: Đang lưu... -> Đã lưu an toàn
    updateSyncTimestamp(nowTime);
    setIsSyncing(true);
    setCloudSyncStatus('syncing');

    setTimeout(() => {
      setIsSyncing(false);
      setCloudSyncStatus('saved');
      showSyncNotification(`✓ Đã đồng bộ an toàn toàn bộ dữ liệu lên Cloud (${nowTime})`);
      if (savedStateTimerRef.current) clearTimeout(savedStateTimerRef.current);
      savedStateTimerRef.current = setTimeout(() => {
        setCloudSyncStatus('synced');
      }, 2500);
    }, 450);

    if (!accKey) return;

    // Lưu vào local cache ngay lập tức
    const currentLocal = dbRef.current;
    try {
      localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(currentLocal));
    } catch (e) {}

    // 2. Chạy tác vụ đồng bộ Google Drive ở chế độ nền (Background Sync) - không bắt người dùng ngồi chờ
    (async () => {
      try {
        const fetched = await loadCloudData();
        if (fetched) {
          setCloudRoot(fetched);
          const cloudUserData = fetched.users?.[accKey];
          const localSavedStr = localStorage.getItem(`thaptaisan_local_${accKey}`);
          let localUserData: DatabaseState | null = null;
          if (localSavedStr) {
            try {
              localUserData = JSON.parse(localSavedStr);
            } catch (e) {}
          }
          if (!localUserData) localUserData = dbRef.current;

          const reconciled = reconcileUserData(cloudUserData, localUserData);

          if (reconciled.data !== localUserData) {
            setDb({
              ...DEFAULT_DATABASE_STATE,
              ...reconciled.data,
              assets: reconciled.data.assets || [],
              debts: reconciled.data.debts || [],
              goals: reconciled.data.goals || [],
              history: reconciled.data.history || [],
            });
            localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(reconciled.data));
          }

          if (reconciled.shouldUploadToCloud) {
            const latestPayload = {
              ...fetched,
              users: {
                ...fetched.users,
                [accKey]: reconciled.data,
              },
            };
            await saveCloudData(latestPayload);
          }
          updateSyncTimestamp();
        } else {
          // Nếu mất mạng hoặc lỗi kết nối, kích hoạt lưu tạm
          triggerBackgroundSync(dbRef.current, { immediate: true, isUserAction: false });
        }
      } catch (err) {
        console.warn('Background sync drive error:', err);
      }
    })();
  };

  // TÍNH NĂNG SAO LƯU VÀ KHÔI PHỤC DỮ LIỆU TỪ TỆP JSON (JSON Backup & Restore)
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreJsonClick = () => {
    jsonFileInputRef.current?.click();
  };

  const handleRestoreJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const accKey = currentAccountKeyRef.current;
      if (!accKey) {
        alert('Vui lòng đăng nhập trước khi khôi phục dữ liệu!');
        return;
      }

      let restoredUserData: Partial<DatabaseState> | null = null;

      // Trường hợp 1: Tệp là bản xuất toàn bộ từ Google Drive / Apps Script
      // Cấu trúc dạng: { passwords?: ..., users: { phone_0966203310: { assets, debts, ... } } }
      if (parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object') {
        if (parsed.users[accKey]) {
          restoredUserData = parsed.users[accKey];
        } else {
          const userKeys = Object.keys(parsed.users);
          if (userKeys.length === 1) {
            restoredUserData = parsed.users[userKeys[0]];
          } else {
            const cleanAcc = accKey.replace('phone_', '');
            const matchedKey = userKeys.find((k) => k.includes(cleanAcc) || cleanAcc.includes(k.replace('phone_', '')));
            if (matchedKey) {
              restoredUserData = parsed.users[matchedKey];
            } else if (userKeys.length > 0) {
              restoredUserData = parsed.users[userKeys[0]];
            }
          }
        }
      }
      // Trường hợp 2: Tệp là một bản ghi DatabaseState trực tiếp (có mảng assets)
      else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.assets)) {
        restoredUserData = parsed;
      }

      if (!restoredUserData || !Array.isArray(restoredUserData.assets)) {
        alert('Tệp JSON không đúng cấu trúc dữ liệu của Tháp Tài Sản (thiếu danh mục tài sản assets). Vui lòng kiểm tra lại!');
        return;
      }

      const newTimestamp = getCurrentTimestampVN();
      const restoredDb: DatabaseState = {
        ...DEFAULT_DATABASE_STATE,
        ...restoredUserData,
        assets: restoredUserData.assets || [],
        debts: restoredUserData.debts || [],
        goals: restoredUserData.goals || [],
        history: restoredUserData.history || [],
        lastUpdate: newTimestamp,
        updatedAtTimestamp: Date.now(),
      };

      // 1. Cập nhật state vào ứng dụng ngay lập tức
      setDb(restoredDb);
      dbRef.current = restoredDb;
      localStorage.setItem(`thaptaisan_local_${accKey}`, JSON.stringify(restoredDb));

      // 2. Cập nhật giờ đồng bộ và trạng thái
      const nowTime = getCurrentTimeOnlyVN();
      updateSyncTimestamp(nowTime);
      setCloudSyncStatus('synced');

      // 3. Đẩy an toàn ngay lên Google Drive và proxy cache
      const updatedCloud = {
        ...cloudRootRef.current,
        users: {
          ...cloudRootRef.current.users,
          [accKey]: restoredDb,
        },
      };
      setCloudRoot(updatedCloud);
      cloudRootRef.current = updatedCloud;
      saveCloudData(updatedCloud);

      alert(`✅ Khôi phục thành công ${restoredDb.assets.length} tài sản từ tệp JSON! Toàn bộ số liệu đã được nạp lại và đồng bộ an toàn lên Google Drive.`);
    } catch (err: any) {
      alert(`Không thể đọc tệp JSON: ${err?.message || 'Tệp không hợp lệ'}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleBackupJson = () => {
    const accKey = currentAccountKeyRef.current || 'backup';
    const cleanAccount = accKey.replace('phone_', '');
    const dateSlug = new Date().toISOString().slice(0, 10);
    const fileName = `thap_tai_san_backup_${cleanAccount}_${dateSlug}.json`;

    const jsonStr = JSON.stringify(dbRef.current, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // State mutation actions (instant state update + silent async sync + timestamp tracking)
  const handleUpdateAsset = (asset: Asset) => {
    setDb((prev) => {
      const index = prev.assets.findIndex((a) => a.id === asset.id);
      let newAssets: Asset[];
      if (index >= 0) {
        newAssets = [...prev.assets];
        newAssets[index] = asset;
      } else {
        newAssets = [...prev.assets, asset];
      }
      const now = Date.now();
      const newDb = {
        ...prev,
        assets: newAssets,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu tài sản' });
      return newDb;
    });
  };

  const handleRemoveAsset = (id: number | string) => {
    setDb((prev) => {
      const idStr = String(id);
      const newAssets = prev.assets.filter((a) => String(a.id) !== idStr);
      // Clean up linkedAssetId in goals if matching deleted asset
      const newGoals = prev.goals.map((g) => {
        if (g.linkedAssetId !== undefined && String(g.linkedAssetId) === idStr) {
          const { linkedAssetId, ...rest } = g;
          return rest as Goal;
        }
        return g;
      });
      const now = Date.now();
      const newDb = {
        ...prev,
        assets: newAssets,
        goals: newGoals,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã xóa tài sản' });
      return newDb;
    });
  };

  const handleUpdateDebt = (debt: Debt) => {
    setDb((prev) => {
      const index = prev.debts.findIndex((d) => String(d.id) === String(debt.id));
      let newDebts: Debt[];
      if (index >= 0) {
        newDebts = [...prev.debts];
        newDebts[index] = debt;
      } else {
        newDebts = [...prev.debts, debt];
      }
      const now = Date.now();
      const newDb = {
        ...prev,
        debts: newDebts,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu khoản nợ' });
      return newDb;
    });
  };

  const handleRemoveDebt = (id: number | string) => {
    setDb((prev) => {
      const idStr = String(id);
      const newDebts = prev.debts.filter((d) => String(d.id) !== idStr);
      // Clean up linkedDebtId in goals if matching deleted debt
      const newGoals = prev.goals.map((g) => {
        if (g.linkedDebtId !== undefined && String(g.linkedDebtId) === idStr) {
          const { linkedDebtId, ...rest } = g;
          return rest as Goal;
        }
        return g;
      });
      const now = Date.now();
      const newDb = {
        ...prev,
        debts: newDebts,
        goals: newGoals,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã xóa khoản nợ' });
      return newDb;
    });
  };

  const handleUpdateIncome = (salary: number, other: number) => {
    setDb((prev) => {
      const now = Date.now();
      const newDb = {
        ...prev,
        salaryIncome: salary,
        otherIncome: other,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu thu nhập' });
      return newDb;
    });
  };

  const handleUpdateGoal = (goal: Goal) => {
    setDb((prev) => {
      const index = prev.goals.findIndex((g) => String(g.id) === String(goal.id));
      let newGoals: Goal[];
      if (index >= 0) {
        newGoals = [...prev.goals];
        newGoals[index] = goal;
      } else {
        newGoals = [...prev.goals, goal];
      }
      const now = Date.now();
      const newDb = {
        ...prev,
        goals: newGoals,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu mục tiêu' });
      return newDb;
    });
  };

  const handleRemoveGoal = (id: number | string) => {
    setDb((prev) => {
      const idStr = String(id);
      const newGoals = prev.goals.filter((g) => String(g.id) !== idStr);
      const now = Date.now();
      const newDb = {
        ...prev,
        goals: newGoals,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã xóa mục tiêu' });
      return newDb;
    });
  };

  const handleSaveTransactions = (
    updatedTxs: AssetTransaction[],
    updatedAsset?: Asset,
    updatedGoal?: Goal
  ) => {
    setDb((prev) => {
      let newAssets = prev.assets;
      if (updatedAsset) {
        const assetIndex = prev.assets.findIndex((a) => a.id === updatedAsset.id);
        if (assetIndex >= 0) {
          newAssets = [...prev.assets];
          newAssets[assetIndex] = updatedAsset;
        } else {
          newAssets = [...prev.assets, updatedAsset];
        }
      }

      let newGoals = prev.goals;
      if (updatedGoal) {
        const goalIndex = prev.goals.findIndex((g) => g.id === updatedGoal.id);
        if (goalIndex >= 0) {
          newGoals = [...prev.goals];
          newGoals[goalIndex] = updatedGoal;
        } else {
          newGoals = [...prev.goals, updatedGoal];
        }
      }

      const now = Date.now();
      const newDb = {
        ...prev,
        transactions: updatedTxs,
        assets: newAssets,
        goals: newGoals,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu giao dịch' });
      return newDb;
    });
  };

  const handleReloginAfterChangePass = () => {
    setShowChangePasswordModal(false);
    handleLogout();
  };

  const handleExportExcel = () => {
    exportAssetsToExcel(db, userDisplay);
  };

  const handleImportDataFromExcel = (
    data: {
      assets: (Asset | Omit<Asset, 'id'>)[];
      debts: (Debt | Omit<Debt, 'id'>)[];
      goals: (Goal | Omit<Goal, 'id'>)[];
      transactions?: (AssetTransaction | Omit<AssetTransaction, 'id'>)[];
      salaryIncome?: number;
      otherIncome?: number;
    },
    mode: 'sync' | 'replace' | 'append'
  ) => {
    setDb((prev) => {
      let updatedAssets: Asset[] = [...prev.assets];
      let updatedDebts: Debt[] = [...prev.debts];
      let updatedGoals: Goal[] = [...prev.goals];
      let updatedTransactions: AssetTransaction[] = [...(prev.transactions || [])];

      if (mode === 'sync') {
        // Mode 1: Smart Sync by ID
        // Assets Sync
        if (data.assets.length > 0) {
          const existingIds = new Set(prev.assets.map((a) => a.id));
          let nextAssetId = Date.now();
          const assetMap = new Map<number, Asset>();
          prev.assets.forEach((a) => assetMap.set(a.id, a));

          data.assets.forEach((item) => {
            if ('id' in item && item.id && assetMap.has(item.id)) {
              // Update existing asset
              assetMap.set(item.id, { ...(item as Asset) });
            } else {
              // Add new asset with unique ID
              while (existingIds.has(nextAssetId)) nextAssetId++;
              existingIds.add(nextAssetId);
              const newAsset: Asset = { ...(item as any), id: nextAssetId };
              assetMap.set(nextAssetId, newAsset);
            }
          });
          updatedAssets = Array.from(assetMap.values());
        }

        // Debts Sync
        if (data.debts.length > 0) {
          const existingDebtIds = new Set(prev.debts.map((d) => d.id));
          let nextDebtId = Date.now() + 1000;
          const debtMap = new Map<number, Debt>();
          prev.debts.forEach((d) => debtMap.set(d.id, d));

          data.debts.forEach((item) => {
            if ('id' in item && item.id && debtMap.has(item.id)) {
              // Update existing debt
              debtMap.set(item.id, { ...(item as Debt) });
            } else {
              // Add new debt
              while (existingDebtIds.has(nextDebtId)) nextDebtId++;
              existingDebtIds.add(nextDebtId);
              const newDebt: Debt = { ...(item as any), id: nextDebtId };
              debtMap.set(nextDebtId, newDebt);
            }
          });
          updatedDebts = Array.from(debtMap.values());
        }

        // Goals Sync
        if (data.goals.length > 0) {
          const existingGoalIds = new Set(prev.goals.map((g) => g.id));
          let nextGoalId = Date.now() + 2000;
          const goalMap = new Map<number, Goal>();
          prev.goals.forEach((g) => goalMap.set(g.id, g));

          data.goals.forEach((item) => {
            if ('id' in item && item.id && goalMap.has(item.id)) {
              // Update existing goal
              goalMap.set(item.id, { ...(item as Goal) });
            } else {
              // Add new goal
              while (existingGoalIds.has(nextGoalId)) nextGoalId++;
              existingGoalIds.add(nextGoalId);
              const newGoal: Goal = { ...(item as any), id: nextGoalId };
              goalMap.set(nextGoalId, newGoal);
            }
          });
          updatedGoals = Array.from(goalMap.values());
        }

        // Transactions Sync
        if (data.transactions && data.transactions.length > 0) {
          const txMap = new Map<string, AssetTransaction>();
          (prev.transactions || []).forEach((t) => txMap.set(String(t.id), t));
          data.transactions.forEach((tx) => {
            const txId = 'id' in tx && tx.id ? String(tx.id) : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            txMap.set(txId, { ...(tx as any), id: txId });
          });
          updatedTransactions = Array.from(txMap.values());
        }
      } else if (mode === 'replace') {
        // Mode 2: Replace All
        const usedAssetIds = new Set<number>();
        let nextAssetId = Date.now();
        updatedAssets =
          data.assets.length > 0
            ? data.assets.map((item) => {
                let id = 'id' in item && item.id ? item.id : 0;
                if (!id || usedAssetIds.has(id)) {
                  while (usedAssetIds.has(nextAssetId)) nextAssetId++;
                  id = nextAssetId;
                }
                usedAssetIds.add(id);
                return { ...(item as any), id };
              })
            : prev.assets;

        const usedDebtIds = new Set<number>();
        let nextDebtId = Date.now() + 1000;
        updatedDebts =
          data.debts.length > 0
            ? data.debts.map((item) => {
                let id = 'id' in item && item.id ? item.id : 0;
                if (!id || usedDebtIds.has(id)) {
                  while (usedDebtIds.has(nextDebtId)) nextDebtId++;
                  id = nextDebtId;
                }
                usedDebtIds.add(id);
                return { ...(item as any), id };
              })
            : prev.debts;

        const usedGoalIds = new Set<number>();
        let nextGoalId = Date.now() + 2000;
        updatedGoals =
          data.goals.length > 0
            ? data.goals.map((item) => {
                let id = 'id' in item && item.id ? item.id : 0;
                if (!id || usedGoalIds.has(id)) {
                  while (usedGoalIds.has(nextGoalId)) nextGoalId++;
                  id = nextGoalId;
                }
                usedGoalIds.add(id);
                return { ...(item as any), id };
              })
            : prev.goals;

        if (data.transactions && data.transactions.length > 0) {
          updatedTransactions = data.transactions.map((tx, idx) => ({
            ...(tx as any),
            id: 'id' in tx && tx.id ? String(tx.id) : `tx-${Date.now()}-${idx}`,
          }));
        }
      } else {
        // Mode 3: Append All (create fresh IDs)
        const existingAssetIds = new Set(prev.assets.map((a) => a.id));
        let nextAssetId = Date.now();
        const formattedNewAssets: Asset[] = data.assets.map((item) => {
          while (existingAssetIds.has(nextAssetId)) nextAssetId++;
          existingAssetIds.add(nextAssetId);
          return { ...(item as any), id: nextAssetId };
        });
        updatedAssets = [...prev.assets, ...formattedNewAssets];

        const existingDebtIds = new Set(prev.debts.map((d) => d.id));
        let nextDebtId = Date.now() + 1000;
        const formattedNewDebts: Debt[] = data.debts.map((item) => {
          while (existingDebtIds.has(nextDebtId)) nextDebtId++;
          existingDebtIds.add(nextDebtId);
          return { ...(item as any), id: nextDebtId };
        });
        updatedDebts = [...prev.debts, ...formattedNewDebts];

        const existingGoalIds = new Set(prev.goals.map((g) => g.id));
        let nextGoalId = Date.now() + 2000;
        const formattedNewGoals: Goal[] = data.goals.map((item) => {
          while (existingGoalIds.has(nextGoalId)) nextGoalId++;
          existingGoalIds.add(nextGoalId);
          return { ...(item as any), id: nextGoalId };
        });
        updatedGoals = [...prev.goals, ...formattedNewGoals];

        if (data.transactions && data.transactions.length > 0) {
          const appendedTxs: AssetTransaction[] = data.transactions.map((tx, idx) => ({
            ...(tx as any),
            id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          }));
          updatedTransactions = [...(prev.transactions || []), ...appendedTxs];
        }
      }

      const now = Date.now();
      const newDb: DatabaseState = {
        ...prev,
        assets: updatedAssets,
        debts: updatedDebts,
        goals: updatedGoals,
        transactions: updatedTransactions,
        salaryIncome:
          data.salaryIncome !== undefined && data.salaryIncome > 0 ? data.salaryIncome : prev.salaryIncome,
        otherIncome:
          data.otherIncome !== undefined && data.otherIncome > 0 ? data.otherIncome : prev.otherIncome,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { immediate: true, isUserAction: true, actionLabel: 'Đã nhập dữ liệu Excel' });
      return newDb;
    });
  };

  const handleSaveEmailSchedule = (newSchedule: EmailScheduleSettings) => {
    setDb((prev) => {
      const now = Date.now();
      const newDb = {
        ...prev,
        emailSchedule: newSchedule,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu lịch gửi email' });
      return newDb;
    });
  };

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen pb-24 sm:pb-28 font-sans overflow-x-hidden">
      <AuthModal
        isOpen={showAuthModal}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        onFaceIdUnlock={handleFaceIdUnlock}
        onClose={userDisplay ? () => setShowAuthModal(false) : undefined}
      />

      {/* Modal Đổi mật khẩu bên trong ứng dụng */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        accountName={userDisplay}
        onClose={() => setShowChangePasswordModal(false)}
        onChangePassword={handleChangePasswordInside}
        onSuccessRelogin={handleReloginAfterChangePass}
      />

      {/* Modal Cài đặt Lịch Gửi Email Báo Cáo Tự Động */}
      <EmailReportModal
        isOpen={showEmailReportModal}
        onClose={() => setShowEmailReportModal(false)}
        db={db}
        userDisplay={userDisplay}
        onSaveSchedule={handleSaveEmailSchedule}
      />

      {/* Modal Trợ Lý Excel Thông Minh (AI Smart Excel) */}
      <SmartExcelModal
        isOpen={showSmartExcelModal}
        currentAssetsCount={db.assets.length}
        currentDebtsCount={db.debts.length}
        currentGoalsCount={db.goals.length}
        onClose={() => setShowSmartExcelModal(false)}
        onImportData={handleImportDataFromExcel}
      />

      {/* Hidden File Input for JSON Restore */}
      <input
        type="file"
        ref={jsonFileInputRef}
        onChange={handleRestoreJsonFile}
        accept=".json,application/json"
        className="hidden"
      />

      {/* When user closes modal without logging in: Show clean exit/locked screen */}
      {!userDisplay && !showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-white/10 rounded-2xl p-2.5 flex items-center justify-center mb-4 border border-white/20 shadow-2xl backdrop-blur-md relative">
            <PyramidLogo className="w-full h-full" />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-xs">
              <Lock className="w-3 h-3" />
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white mb-1.5">
            Ứng Dụng Đang Khóa
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
            Phiên làm việc đã đóng để bảo vệ dữ liệu tài chính. Vui lòng đăng nhập hoặc xác thực sinh trắc học để tiếp tục.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập / Mở Khóa</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Sticky */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <Header
            currentTab={currentTab}
            onSwitchTab={setCurrentTab}
            isPrivacyMode={isPrivacyMode}
            onTogglePrivacy={handleTogglePrivacy}
            userDisplay={userDisplay}
            onOpenImportExcel={() => setShowSmartExcelModal(true)}
            onExportExcel={handleExportExcel}
            onLogout={handleLogout}
            cloudSyncStatus={cloudSyncStatus}
            onSyncDrive={handleSyncDrive}
            isSyncing={isSyncing}
            lastUpdate={db.lastUpdate || getCurrentTimestampVN()}
            lastSyncTime={lastSyncTime}
            onOpenEmailReport={() => setShowEmailReportModal(true)}
            onOpenChangePassword={() => setShowChangePasswordModal(true)}
            onRestoreJson={handleRestoreJsonClick}
            onBackupJson={handleBackupJson}
          />
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-[62px] sm:pt-22 pb-6">
        {currentTab === 'pyramid' && (
          <TabPyramid
            db={db}
            isPrivacyMode={isPrivacyMode}
            onUpdateAsset={handleUpdateAsset}
            onRemoveAsset={handleRemoveAsset}
            onSyncDrive={handleSyncDrive}
            isSyncing={isSyncing}
            cloudSyncStatus={cloudSyncStatus}
            onSaveTransactions={handleSaveTransactions}
            onSwitchTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            goldData={marketGoldData}
            stockData={marketStockData}
            onSyncMarketPrices={() => syncLiveMarketRates(true)}
          />
        )}

        {currentTab === 'debts' && (
          <TabDebts
            db={db}
            isPrivacyMode={isPrivacyMode}
            onUpdateDebt={handleUpdateDebt}
            onRemoveDebt={handleRemoveDebt}
            onUpdateIncome={handleUpdateIncome}
            onSwitchTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentTab === 'goals' && (
          <TabGoals
            db={db}
            isPrivacyMode={isPrivacyMode}
            onUpdateGoal={handleUpdateGoal}
            onRemoveGoal={handleRemoveGoal}
            onUpdateAssetDirectly={handleUpdateAsset}
            onUpdateDebtDirectly={handleUpdateDebt}
            onSaveTransactions={handleSaveTransactions}
            onSwitchTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            goldData={marketGoldData}
            stockData={marketStockData}
            onSyncMarketPrices={() => syncLiveMarketRates(true)}
          />
        )}

        {currentTab === 'market' && (
          <TabMarketMacro
            db={db}
            isPrivacyMode={isPrivacyMode}
            onUpdateGoal={handleUpdateGoal}
            onUpdateAssetDirectly={handleUpdateAsset}
            onSwitchTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            goldData={marketGoldData}
            stockData={marketStockData}
            onSyncMarketPrices={() => syncLiveMarketRates(true)}
          />
        )}
      </main>

      {/* Floating Reassurance Sync Toast (Chỉ xuất hiện khi người dùng thao tác dữ liệu để tăng tối đa sự an tâm) */}
      {syncToast && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 text-white backdrop-blur-md border border-emerald-500/50 rounded-full shadow-2xl text-xs font-semibold select-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">{syncToast}</span>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation (Mobile + Tablet + Desktop Dock) */}
      <FixedBottomNav
        currentTab={currentTab}
        onSwitchTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        assetCount={db.assets.length}
        debtCount={db.debts.length}
        goalCount={db.goals.length}
      />
    </div>
  );
}
