import React, { useState, useEffect, useRef, Suspense } from 'react';
import { DatabaseState, Asset, Debt, Goal, AssetTransaction, ActiveTab, LifeEvent, FoodPlace, MonthlyIncomeRecord, IncomeItem } from './types';
import {
  DEFAULT_DATABASE_STATE,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getAuthUser,
  setAuthUser,
  removeAuthUser,
  setAuthCookie,
  getAuthCookie,
  saveLocalData,
  loadLocalData,
  safeStorage,
} from './utils/storage';
import { syncEngine, SyncEngineState, getLocalCachedAccountData } from './utils/syncEngine';
import { DEFAULT_LIFE_EVENTS, DEFAULT_FOOD_PLACES } from './utils/utilityDefaultData';
import { normalizeAccountKey, hashString, getCurrentTimestampVN, getCurrentTimeOnlyVN, getDbTimestamp, nowStamp } from './utils/format';
import { recordRegisteredAccount, getRegisteredAccountsList } from './utils/faceIdEngine';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { FixedBottomNav } from './components/FixedBottomNav';
import { DesktopTabBar } from './components/DesktopTabBar';
import { TabPyramid } from './components/TabPyramid';
import { TabDebts } from './components/TabDebts';
import { TabGoals } from './components/TabGoals';
import { PyramidLogo } from './components/PyramidLogo';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SyncDiagnosticsModal } from './components/SyncDiagnosticsModal';

// Code-split heavy components for optimal mobile PWA load speed
const TabMarketMacro = React.lazy(() => import('./components/TabMarketMacro').then(m => ({ default: m.TabMarketMacro })));
const TabUtilities = React.lazy(() => import('./components/TabUtilities').then(m => ({ default: m.TabUtilities })));
const SmartExcelModal = React.lazy(() => import('./components/SmartExcelModal').then(m => ({ default: m.SmartExcelModal })));
const DebtPayoffSimulatorModal = React.lazy(() => import('./components/DebtPayoffSimulatorModal').then(m => ({ default: m.DebtPayoffSimulatorModal })));
const FinancialCalendarModal = React.lazy(() => import('./components/FinancialCalendarModal').then(m => ({ default: m.FinancialCalendarModal })));
const FinancialHealthReportModal = React.lazy(() => import('./components/FinancialHealthReportModal').then(m => ({ default: m.FinancialHealthReportModal })));
const EmailReportModal = React.lazy(() => import('./components/EmailReportModal').then(m => ({ default: m.EmailReportModal })));

const LazyFallback: React.FC = () => (
  <div className="flex items-center justify-center p-12 min-h-[220px]">
    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
  </div>
);
import { exportAssetsToExcel } from './utils/excelEngine';
import { deepMergeDatabaseState } from './utils/dataMergeEngine';
import { EmailScheduleSettings } from './types';
import { Lock, ScanFace, LogIn, CheckCircle2, ShieldCheck } from 'lucide-react';
import { fetchGoldRates, getDojiPrices, GoldRateData } from './utils/goldService';
import {
  fetchStockRates,
  getStockQuote,
  extractStockTicker,
  isStockEntity,
  collectAllStockSymbols,
  safeMergeStockQuotesMap,
  StockRateData,
  fetchVNIndexOnly,
} from './utils/stockService';

function isDefaultSampleData(d?: DatabaseState | null): boolean {
  if (!d || !d.assets || d.assets.length === 0) return true;
  if (
    d.assets.length === 7 &&
    d.assets[0]?.name === 'Tiền gửi thanh toán VCB' &&
    d.assets[1]?.name === 'Sổ tiết kiệm BIDV 12 Tháng'
  ) {
    return true;
  }
  // Check if every asset is an untouched template asset with baseline version
  const isDefaultIds = d.assets.every((a) => a.id <= 7);
  if (isDefaultIds && (!d.version || d.version <= 1) && (!d.transactions || d.transactions.length <= 1)) {
    const hasDefaultNames = d.assets.some(
      (a) => a.name === 'Tiền gửi thanh toán VCB' || a.name === 'Sổ tiết kiệm BIDV 12 Tháng'
    );
    if (hasDefaultNames) return true;
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

// Thuật toán đối soát dữ liệu đa thiết bị (Deep 3-Way Entity Merge & Zero Data Loss)
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
  if (isCloudSample && !isLocalSample) {
    return { data: localData!, shouldUploadToCloud: true };
  }

  // Deep Entity Merge: Kết hợp từng Asset, Debt, Goal, Transaction, IncomeItem của cả 2 thiết bị
  // Sử dụng deepMergeDatabaseState với LWW: Bên nào mới hơn sẽ chiếm ưu thế
  const merged = deepMergeDatabaseState(localData!, cloudData!);
  const preserved = preserveLatestMarketPrices(merged, cloudData!);

  // Chỉ upload lên Cloud nếu Local thực sự có version cao hơn Cloud
  const localVer = localData?.version || 1;
  const cloudVer = cloudData?.version || 1;
  const shouldUpload = localVer > cloudVer;

  return { data: preserved, shouldUploadToCloud: shouldUpload };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<ActiveTab>('pyramid');
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
  const [showDebtSimulatorModal, setShowDebtSimulatorModal] = useState<boolean>(false);
  const [showFinancialCalendarModal, setShowFinancialCalendarModal] = useState<boolean>(false);
  const [showFinancialHealthReportModal, setShowFinancialHealthReportModal] = useState<boolean>(false);
  const [showSyncDiagnosticsModal, setShowSyncDiagnosticsModal] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncEngineState>(() => syncEngine.getState());
  const [authNotice, setAuthNotice] = useState<string>('');

  useEffect(() => {
    const handleAuthExpired = (e: any) => {
      const msg = e?.detail?.message || 'Phiên đăng nhập hết hạn, dữ liệu cục bộ vẫn được giữ';
      removeAuthToken();
      setAuthNotice(msg);
      setShowAuthModal(true);
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const unsubStatus = syncEngine.subscribeStatus((st) => {
      setSyncState(st);
      if (st.status === 'synced') setCloudSyncStatus('synced');
      else if (st.status === 'saving') setCloudSyncStatus('syncing');
      else if (st.status === 'pending') setCloudSyncStatus('offline');
      else setCloudSyncStatus('offline');
    });

    const unsubRemote = syncEngine.subscribeRemoteUpdate((updatedDb) => {
      setDb(updatedDb);
      const nowTime = getCurrentTimeOnlyVN();
      updateSyncTimestamp(nowTime);
      showSyncNotification(`⚡ Real-time: Đã cập nhật từ thiết bị khác (v${syncEngine.getVersion()})`);
    });

    return () => {
      unsubStatus();
      unsubRemote();
    };
  }, []);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'synced' | 'syncing' | 'saved' | 'offline' | 'drive_error' | 'conflict_merging'
  >('synced');
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


  // On App Mount: Auto-restore active session via Bearer Token
  useEffect(() => {
    const initApp = async () => {
      const token = getAuthToken();
      const isExplicitLoggedOut = localStorage.getItem('thaptaisan_explicit_logout') === '1';

      if (token && !isExplicitLoggedOut) {
        const authUser = getAuthUser();
        const accountLabel =
          authUser?.identifier ||
          localStorage.getItem('thaptaisan_saved_account') ||
          '';

        try {
          const res = await fetch('/api/data', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const body = await res.json();
            if (body.success && body.data) {
              setAuthNotice('');
              setupUserSession(accountLabel || 'Chủ Tài Khoản', body.data, body.version);
              setShowAuthModal(false);
              return;
            }
          } else if (res.status === 401) {
            removeAuthToken();
            removeAuthUser();
            setAuthNotice('Phiên đăng nhập hết hạn, dữ liệu cục bộ vẫn được giữ');
            setShowAuthModal(true);
            return;
          }
        } catch (e) {
          // Offline fallback: load local snapshot for this account with its stored version
          const localCache = getLocalCachedAccountData(authUser?.userId || authUser?.identifier || accountLabel);
          if (localCache.data) {
            setAuthNotice('');
            setupUserSession(accountLabel || 'Ngoại tuyến', localCache.data, localCache.version);
            setShowAuthModal(false);
            return;
          }
        }
      }

      setShowAuthModal(true);
    };

    initApp();
  }, []);

  const setupUserSession = (rawAccount: string, userData?: DatabaseState, version: number = 1) => {
    const accKey = normalizeAccountKey(rawAccount);
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

    const baseData = userData || DEFAULT_DATABASE_STATE;
    const normalizedAssets = (baseData.assets || []).map((a: any) => ({
      ...a,
      type: a.type === 'savings' ? 'saving' : a.type,
    }));

    const finalDb: DatabaseState = {
      ...DEFAULT_DATABASE_STATE,
      ...baseData,
      assets: normalizedAssets,
      debts: baseData.debts || [],
      goals: baseData.goals || [],
      history: baseData.history || [],
      lifeEvents:
        baseData.lifeEvents && baseData.lifeEvents.length > 0
          ? baseData.lifeEvents
          : DEFAULT_LIFE_EVENTS,
      foodPlaces:
        baseData.foodPlaces && baseData.foodPlaces.length > 0
          ? baseData.foodPlaces
          : DEFAULT_FOOD_PLACES,
    };

    setDb(finalDb);
    syncEngine.init(finalDb, version, accKey);
  };

  // HỆ THỐNG CẬP NHẬT ĐƠN GIÁ THỊ TRƯỜNG TỰ ĐỘNG CHẠY NỀN LIÊN TỤC (Real-time Background Market Sync)
  // Tự động quét giá Vàng DOJI & Cổ phiếu trực tuyến và đồng bộ vào Tài sản (Tháp Tài Sản) và Mục tiêu (Mục Tiêu Tích Sản)
  const syncLiveMarketRates = React.useCallback(async (forceRefresh = true) => {
    try {
      const currentDb = dbRef.current;
      const symbols = collectAllStockSymbols(
        currentDb.assets || [],
        currentDb.goals || [],
        false,
        currentDb.stockWatchlist || []
      );

      // Gọi đồng thời cả giá Vàng, Cổ phiếu và VN-Index trực tiếp
      const [goldData, stockData, vnData] = await Promise.all([
        fetchGoldRates(forceRefresh),
        fetchStockRates(symbols, forceRefresh),
        fetchVNIndexOnly(forceRefresh),
      ]);

      if (goldData) setMarketGoldData(goldData);
      if (stockData) {
        if (vnData) stockData.vnindex = vnData;
        setMarketStockData((prev) => {
          if (!prev) return stockData;
          return {
            ...stockData,
            stocks: safeMergeStockQuotesMap(prev.stocks, stockData.stocks),
          };
        });
      } else if (vnData) {
        setMarketStockData((prev) => (prev ? { ...prev, vnindex: vnData } : null));
      }

      setDb((prevDb) => {
        let hasAssetChange = false;
        let hasGoalChange = false;

        // 1. Cập nhật giá Vàng vào Tài sản Tháp Tài Sản & Mục tiêu Mục Tiêu Tích Sản
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
              updatedAt: nowStamp(),
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

        // 2. Cập nhật giá Cổ phiếu vào Tài sản Tháp Tài Sản & Mục tiêu Mục Tiêu Tích Sản
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
              updatedAt: nowStamp(),
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

  const handleSyncMarketPrices = React.useCallback(() => {
    syncLiveMarketRates(true);
  }, [syncLiveMarketRates]);

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

  // Face ID Biometric Unlock Handler
  const handleFaceIdUnlock = async (accountName?: string): Promise<boolean> => {
    const savedAccount =
      accountName ||
      localStorage.getItem('thaptaisan_faceid_account') ||
      localStorage.getItem('thaptaisan_saved_account') ||
      '';

    const token = getAuthToken();
    if (token) {
      try {
        const res = await fetch('/api/data', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            setAuthNotice('');
            setupUserSession(savedAccount || 'Tài khoản', body.data, body.version);
            setCurrentTab('pyramid');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return true;
          }
        }
      } catch (_) {}
    }

    const authUser = getAuthUser();
    const local = getLocalCachedAccountData(authUser?.userId || authUser?.identifier || savedAccount);
    if (local.data) {
      setAuthNotice('');
      setupUserSession(savedAccount || 'Ngoại tuyến', local.data, local.version);
      setCurrentTab('pyramid');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }

    return false;
  };

  const handleLogin = async (
    rawAccount: string,
    pass: string,
    remember: boolean
  ): Promise<{ success: boolean; reason?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: rawAccount, password: pass }),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setAuthToken(body.token);
        setAuthUser({ userId: body.user_id, identifier: body.identifier });
        localStorage.setItem('thaptaisan_saved_account', body.identifier);
        setAuthCookie('thaptaisan_saved_account', body.identifier);
        localStorage.removeItem('thaptaisan_explicit_logout');
        recordRegisteredAccount(body.identifier);

        // Fetch authoritative database from server
        try {
          const dataRes = await fetch('/api/data', {
            headers: { Authorization: `Bearer ${body.token}` },
          });
          if (dataRes.ok) {
            const dataJson = await dataRes.json();
            if (dataJson.success && dataJson.data) {
              setAuthNotice('');
              setupUserSession(body.identifier, dataJson.data, dataJson.version);
              setCurrentTab('pyramid');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return { success: true };
            }
          }
        } catch (_) {}

        // Fallback: Check if local cache exists for this account
        const local = getLocalCachedAccountData(body.user_id || body.identifier);
        if (local.data) {
          setAuthNotice('');
          setupUserSession(body.identifier, local.data, local.version);
          setCurrentTab('pyramid');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return { success: true };
        }

        // Server failed AND no local cache -> DO NOT load DEFAULT_DATABASE_STATE and allow overwrite!
        return {
          success: false,
          reason: 'Đăng nhập thành công nhưng không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
        };
      }

      return {
        success: false,
        reason: body.error || 'Thông tin tài khoản hoặc mật khẩu không chính xác',
      };
    } catch (err: any) {
      return {
        success: false,
        reason: 'Lỗi kết nối máy chủ: ' + (err.message || 'Vui lòng thử lại sau ít giây'),
      };
    }
  };

  const handleRegister = async (
    rawAccount: string,
    pass: string,
    remember: boolean
  ): Promise<{ success: boolean; reason?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: rawAccount, password: pass }),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setAuthToken(body.token);
        setAuthUser({ userId: body.user_id, identifier: body.identifier });
        localStorage.setItem('thaptaisan_saved_account', body.identifier);
        setAuthCookie('thaptaisan_saved_account', body.identifier);
        localStorage.removeItem('thaptaisan_explicit_logout');
        recordRegisteredAccount(body.identifier);

        setupUserSession(body.identifier, DEFAULT_DATABASE_STATE, 1);
        setCurrentTab('pyramid');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return { success: true };
      }

      return {
        success: false,
        reason: body.error || 'Đăng ký tài khoản không thành công',
      };
    } catch (err: any) {
      return {
        success: false,
        reason: 'Lỗi kết nối máy chủ: ' + (err.message || 'Vui lòng thử lại sau ít giây'),
      };
    }
  };

  const handleLogout = async () => {
    try {
      await syncEngine.syncNow();
    } catch (e) {}

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}

    removeAuthToken();
    removeAuthUser();
    localStorage.setItem('thaptaisan_explicit_logout', '1');
    setUserDisplay('');
    setCurrentAccountKey('');
    setDb(DEFAULT_DATABASE_STATE);
    setShowAuthModal(true);
  };

  const handleResetPassword = async (
    rawAccount: string,
    newPass: string
  ): Promise<{ success: boolean; reason?: string }> => {
    return { success: false, reason: 'Vui lòng liên hệ quản trị viên hoặc sử dụng tính năng Đổi Mật Khẩu sau khi đăng nhập' };
  };

  const handleChangePasswordInside = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; reason?: string }> => {
    const token = getAuthToken();
    if (!token) {
      return { success: false, reason: 'Chưa đăng nhập' };
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        if (body.token) {
          setAuthToken(body.token);
        }
        return { success: true };
      }
      return { success: false, reason: body.error || 'Đổi mật khẩu thất bại' };
    } catch (err: any) {
      return { success: false, reason: 'Lỗi kết nối: ' + err.message };
    }
  };

  const handleTogglePrivacy = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem('thaptaisan_privacy_mode', next ? '1' : '0');
      return next;
    });
  };

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
    const actionLabel = typeof options === 'object' && options.actionLabel ? options.actionLabel : '';

    pendingDbRef.current = newDb;
    setDb(newDb);
    syncEngine.scheduleSave(newDb);

    if (immediate) {
      syncEngine.syncNow();
    }

    if (actionLabel) {
      showSyncNotification(`✓ ${actionLabel}`);
    }
  };

  const handleSyncDrive = async () => {
    setIsSyncing(true);
    setCloudSyncStatus('syncing');
    const ok = await syncEngine.syncNow();
    setIsSyncing(false);
    setCloudSyncStatus(ok ? 'synced' : 'offline');
    if (ok) {
      const nowTime = getCurrentTimeOnlyVN();
      updateSyncTimestamp(nowTime);
      showSyncNotification(`✓ Đã đồng bộ thành công với Cloud D1 (${nowTime})`);
    } else {
      showSyncNotification('⚠ Không thể kết nối với Cloud D1, đang lưu ngoại tuyến');
    }
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
      saveLocalData(accKey, restoredDb);

      // 2. Cập nhật giờ đồng bộ và trạng thái
      const nowTime = getCurrentTimeOnlyVN();
      updateSyncTimestamp(nowTime);

      // 3. Đẩy đồng bộ an toàn qua syncEngine
      syncEngine.scheduleSave(restoredDb);
      syncEngine.syncNow();

      alert(`✅ Khôi phục thành công ${restoredDb.assets.length} tài sản từ tệp JSON! Toàn bộ số liệu đã được nạp lại và đồng bộ an toàn.`);
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

  const handleUpdateIncome = (salary: number, other: number, bonus?: number) => {
    setDb((prev) => {
      const now = Date.now();
      const currYear = new Date().getFullYear();
      const currMonth = new Date().getMonth() + 1;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const currMonthKey = `${currYear}-${pad(currMonth)}`;
      const bonusVal = bonus !== undefined ? bonus : (prev.bonusIncome || 0);

      const currentList = prev.monthlyIncomes || [];
      const existingIdx = currentList.findIndex((m) => m.month === currMonthKey);
      let updatedList: MonthlyIncomeRecord[];
      if (existingIdx >= 0) {
        updatedList = [...currentList];
        updatedList[existingIdx] = {
          ...updatedList[existingIdx],
          salary,
          bonus: bonusVal,
          other,
          updatedAt: now,
        };
      } else {
        updatedList = [
          ...currentList,
          {
            id: `inc-${now}`,
            month: currMonthKey,
            salary,
            bonus: bonusVal,
            other,
            note: 'Tháng hiện tại (Đã liên thông từ Thẻ Tổng Thu Nhập)',
            updatedAt: now,
          },
        ];
      }
      updatedList.sort((a, b) => a.month.localeCompare(b.month));

      // Đảm bảo tháng hiện tại không bị ẩn trong deletedMonths
      const updatedDeletedMonths = (prev.deletedMonths || []).filter((m) => m !== currMonthKey);

      const newDb: DatabaseState = {
        ...prev,
        salaryIncome: salary,
        bonusIncome: bonusVal,
        otherIncome: other,
        monthlyIncomes: updatedList,
        deletedMonths: updatedDeletedMonths,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu thu nhập và đồng bộ sổ tháng' });
      return newDb;
    });
  };

  const handleUpdateMonthlyIncomes = (records: MonthlyIncomeRecord[]) => {
    setDb((prev) => {
      const now = Date.now();
      const currYear = new Date().getFullYear();
      const currMonth = new Date().getMonth() + 1;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const currMonthKey = `${currYear}-${pad(currMonth)}`;
      const currentMonthRec = records.find((r) => r.month === currMonthKey);

      // Nếu có món kê khai chi tiết trong tháng hiện tại, ưu tiên tính theo items nếu có
      const currentMonthItems = (prev.incomeItems || []).filter(
        (it) => it.month === currMonthKey || it.date?.slice(0, 7) === currMonthKey
      );
      let newSalary = 0;
      let newBonus = 0;
      let newOther = 0;

      if (currentMonthItems.length > 0) {
        newSalary = currentMonthItems
          .filter((it) => it.category === 'salary')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
        newBonus = currentMonthItems
          .filter((it) => it.category === 'bonus')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
        newOther = currentMonthItems
          .filter((it) => it.category !== 'salary' && it.category !== 'bonus')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
      } else if (currentMonthRec) {
        newSalary = currentMonthRec.salary || 0;
        newBonus = currentMonthRec.bonus || 0;
        newOther = currentMonthRec.other || 0;
      } else {
        newSalary = 0;
        newBonus = 0;
        newOther = 0;
      }

      // Gỡ các tháng có bản ghi khỏi deletedMonths
      const recordedMonths = records.map((r) => r.month);
      const updatedDeletedMonths = (prev.deletedMonths || []).filter((m) => !recordedMonths.includes(m));

      const newDb: DatabaseState = {
        ...prev,
        monthlyIncomes: records,
        deletedMonths: updatedDeletedMonths,
        salaryIncome: newSalary,
        bonusIncome: newBonus,
        otherIncome: newOther,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu sổ thu nhập theo tháng' });
      return newDb;
    });
  };

  const handleUpdateIncomeItems = (items: IncomeItem[]) => {
    setDb((prev) => {
      const now = Date.now();
      const currYear = new Date().getFullYear();
      const currMonth = new Date().getMonth() + 1;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const currMonthKey = `${currYear}-${pad(currMonth)}`;

      // Gom tất cả các tháng có trong items
      const monthsInItems = Array.from(new Set(items.map((it) => it.month || it.date?.slice(0, 7)).filter(Boolean))) as string[];

      // Tự động tính toán lại mức lương, thưởng và thu nhập khác của tháng hiện tại (Ảnh 1)
      const currentMonthItems = items.filter((it) => it.month === currMonthKey || it.date?.slice(0, 7) === currMonthKey);
      let newSalary = 0;
      let newBonus = 0;
      let newOther = 0;
      if (currentMonthItems.length > 0) {
        newSalary = currentMonthItems
          .filter((it) => it.category === 'salary')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
        newBonus = currentMonthItems
          .filter((it) => it.category === 'bonus')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
        newOther = currentMonthItems
          .filter((it) => it.category !== 'salary' && it.category !== 'bonus')
          .reduce((sum, it) => sum + (it.amount || 0), 0);
      } else {
        // Nếu không có món chi tiết tháng này, kiểm tra xem có bản ghi tổng cục tháng này không
        const currentMonthRec = (prev.monthlyIncomes || []).find((m) => m.month === currMonthKey);
        if (currentMonthRec) {
          newSalary = currentMonthRec.salary || 0;
          newBonus = currentMonthRec.bonus || 0;
          newOther = currentMonthRec.other || 0;
        } else {
          newSalary = 0;
          newBonus = 0;
          newOther = 0;
        }
      }

      // Tự động tổng hợp và cập nhật vào monthlyIncomes
      const updatedMonthlyIncomes = [...(prev.monthlyIncomes || [])];
      monthsInItems.forEach((mKey) => {
        const mItems = items.filter((it) => it.month === mKey || it.date?.slice(0, 7) === mKey);
        const mSal = mItems.filter((it) => it.category === 'salary').reduce((sum, it) => sum + (it.amount || 0), 0);
        const mBon = mItems.filter((it) => it.category === 'bonus').reduce((sum, it) => sum + (it.amount || 0), 0);
        const mOth = mItems.filter((it) => it.category !== 'salary' && it.category !== 'bonus').reduce((sum, it) => sum + (it.amount || 0), 0);
        const mIdx = updatedMonthlyIncomes.findIndex((m) => m.month === mKey);
        if (mIdx >= 0) {
          updatedMonthlyIncomes[mIdx] = {
            ...updatedMonthlyIncomes[mIdx],
            salary: mSal,
            bonus: mBon,
            other: mOth,
            updatedAt: now,
          };
        } else {
          updatedMonthlyIncomes.push({
            id: `inc-${mKey}`,
            month: mKey,
            salary: mSal,
            bonus: mBon,
            other: mOth,
            note: 'Tự động tổng hợp từ các món kê khai',
            updatedAt: now,
          });
        }
      });
      updatedMonthlyIncomes.sort((a, b) => a.month.localeCompare(b.month));

      const newDb: DatabaseState = {
        ...prev,
        incomeItems: items,
        monthlyIncomes: updatedMonthlyIncomes,
        deletedMonths: (prev.deletedMonths || []).filter((m) => !monthsInItems.includes(m)),
        salaryIncome: newSalary,
        bonusIncome: newBonus,
        otherIncome: newOther,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu các món thu nhập và cập nhật Tổng Thu Nhập' });
      return newDb;
    });
  };

  const handleDeleteMonths = (monthKeys: string[]) => {
    if (!monthKeys || monthKeys.length === 0) return;
    const monthKeySet = new Set(monthKeys);
    setDb((prev) => {
      const now = Date.now();
      const currYear = new Date().getFullYear();
      const currMonth = new Date().getMonth() + 1;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const currMonthKey = `${currYear}-${pad(currMonth)}`;

      const updatedIncomeItems = (prev.incomeItems || []).filter(
        (it) => !monthKeySet.has(it.month) && !monthKeySet.has(it.date?.slice(0, 7))
      );
      const updatedMonthlyIncomes = (prev.monthlyIncomes || []).filter(
        (m) => !monthKeySet.has(m.month)
      );
      const updatedDeletedMonths = Array.from(new Set([...(prev.deletedMonths || []), ...monthKeys]));

      // TỰ ĐỘNG CẬP NHẬT LƯƠNG & THU NHẬP KHÁC CHO THÁNG HIỆN TẠI (ẢNH 1)
      let newSalary = prev.salaryIncome;
      let newOther = prev.otherIncome;

      // Nếu xóa tháng hiện tại hoặc xóa hết tất cả các tháng
      if (monthKeySet.has(currMonthKey) || (updatedIncomeItems.length === 0 && updatedMonthlyIncomes.length === 0)) {
        newSalary = 0;
        newOther = 0;
      } else {
        // Kiểm tra xem tháng hiện tại còn món nào không
        const currentMonthItems = updatedIncomeItems.filter(
          (it) => it.month === currMonthKey || it.date?.slice(0, 7) === currMonthKey
        );
        if (currentMonthItems.length > 0) {
          newSalary = currentMonthItems
            .filter((it) => it.category === 'salary')
            .reduce((sum, it) => sum + (it.amount || 0), 0);
          newOther = currentMonthItems
            .filter((it) => it.category !== 'salary')
            .reduce((sum, it) => sum + (it.amount || 0), 0);
        } else {
          const mRec = updatedMonthlyIncomes.find((m) => m.month === currMonthKey);
          if (mRec) {
            newSalary = mRec.salary || 0;
            newOther = mRec.other || 0;
          } else {
            newSalary = 0;
            newOther = 0;
          }
        }
      }

      const newDb: DatabaseState = {
        ...prev,
        incomeItems: updatedIncomeItems,
        monthlyIncomes: updatedMonthlyIncomes,
        deletedMonths: updatedDeletedMonths,
        salaryIncome: newSalary,
        otherIncome: newOther,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, {
        isUserAction: true,
        actionLabel: monthKeys.length === 1 ? `Đã xóa dữ liệu Tháng ${monthKeys[0]}` : `Đã xóa ${monthKeys.length} tháng`,
      });
      return newDb;
    });
  };

  const handleRestoreMonths = () => {
    setDb((prev) => {
      const now = Date.now();
      const newDb: DatabaseState = {
        ...prev,
        deletedMonths: [],
        salaryIncome: prev.salaryIncome === 0 ? 55000000 : prev.salaryIncome,
        otherIncome: prev.otherIncome === 0 ? 45000000 : prev.otherIncome,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã khôi phục các mốc tháng mẫu' });
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

  const handleUpdateStockWatchlist = (watchlist: string[]) => {
    setDb((prev) => {
      const now = Date.now();
      const newDb = {
        ...prev,
        stockWatchlist: watchlist,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã cập nhật danh mục cổ phiếu' });
      return newDb;
    });

    // Nạp báo giá tức thì cho danh sách theo dõi vừa cập nhật
    if (watchlist.length > 0) {
      fetchStockRates(watchlist, true).then((res) => {
        if (res?.stocks && Object.keys(res.stocks).length > 0) {
          setMarketStockData((prev) => {
            if (!prev) return res;
            return {
              ...prev,
              stocks: { ...(prev.stocks || {}), ...res.stocks },
            };
          });
        }
      });
    }
  };

  const handleUpdateLifeEvents = (events: LifeEvent[]) => {
    setDb((prev) => {
      const now = Date.now();
      const newDb = {
        ...prev,
        lifeEvents: events,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu sự kiện lịch' });
      return newDb;
    });
  };

  const handleUpdateFoodPlaces = (places: FoodPlace[]) => {
    setDb((prev) => {
      const now = Date.now();
      const newDb = {
        ...prev,
        foodPlaces: places,
        lastUpdate: getCurrentTimestampVN(),
        updatedAtTimestamp: now,
      };
      triggerBackgroundSync(newDb, { isUserAction: true, actionLabel: 'Đã lưu danh sách quán ăn' });
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
        initialNotice={authNotice}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        onFaceIdUnlock={handleFaceIdUnlock}
        onClose={userDisplay ? () => { setAuthNotice(''); setShowAuthModal(false); } : undefined}
      />

      {/* Modal Đổi mật khẩu bên trong ứng dụng */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        accountName={userDisplay}
        onClose={() => setShowChangePasswordModal(false)}
        onChangePassword={handleChangePasswordInside}
        onSuccessRelogin={handleReloginAfterChangePass}
      />

      <Suspense fallback={null}>
        {/* Modal Cài đặt Lịch Gửi Email Báo Cáo Tự Động */}
        {showEmailReportModal && (
          <EmailReportModal
            isOpen={showEmailReportModal}
            onClose={() => setShowEmailReportModal(false)}
            db={db}
            userDisplay={userDisplay}
            onSaveSchedule={handleSaveEmailSchedule}
          />
        )}

        {/* Modal Trợ Lý Excel Thông Minh (AI Smart Excel) */}
        {showSmartExcelModal && (
          <SmartExcelModal
            isOpen={showSmartExcelModal}
            currentAssetsCount={db.assets.length}
            currentDebtsCount={db.debts.length}
            currentGoalsCount={db.goals.length}
            onClose={() => setShowSmartExcelModal(false)}
            onImportData={handleImportDataFromExcel}
          />
        )}

        {/* Modal Bộ Mô Phỏng Trả Nợ Sớm Thông Minh (Snowball & Avalanche) */}
        {showDebtSimulatorModal && (
          <DebtPayoffSimulatorModal
            isOpen={showDebtSimulatorModal}
            onClose={() => setShowDebtSimulatorModal(false)}
            db={db}
            isPrivacyMode={isPrivacyMode}
          />
        )}

        {/* Modal Lịch Tài Chính & Dòng Tiền Trực Quan */}
        {showFinancialCalendarModal && (
          <FinancialCalendarModal
            isOpen={showFinancialCalendarModal}
            onClose={() => setShowFinancialCalendarModal(false)}
            db={db}
            isPrivacyMode={isPrivacyMode}
          />
        )}

        {/* Modal Xuất Báo Cáo Sức Khỏe Tài Chính (Executive 1-Page PDF) */}
        {showFinancialHealthReportModal && (
          <FinancialHealthReportModal
            isOpen={showFinancialHealthReportModal}
            onClose={() => setShowFinancialHealthReportModal(false)}
            db={db}
            userDisplay={userDisplay}
            isPrivacyMode={isPrivacyMode}
          />
        )}
      </Suspense>

      {/* Modal Chẩn Đoán Kết Nối & Đồng Bộ Cloud D1 */}
      <SyncDiagnosticsModal
        isOpen={showSyncDiagnosticsModal}
        onClose={() => setShowSyncDiagnosticsModal(false)}
        syncState={syncState}
        onRetrySync={async () => {
          return await syncEngine.syncNow();
        }}
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

      {/* Header + DesktopTabBar Sticky Wrapper */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs safe-area-pt">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
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
            onOpenFinancialCalendar={() => setShowFinancialCalendarModal(true)}
            onOpenHealthReport={() => setShowFinancialHealthReportModal(true)}
            onOpenSyncDiagnostics={() => setShowSyncDiagnosticsModal(true)}
          />
          {/* Desktop Horizontal Tab Bar (Visible on >=1024px) */}
          <DesktopTabBar
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
      </header>

      {/* Main Content Body */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 lg:pt-6 pb-20 lg:pb-10">
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
            onSyncMarketPrices={handleSyncMarketPrices}
            onOpenHealthReport={() => setShowFinancialHealthReportModal(true)}
          />
        )}

        {currentTab === 'debts' && (
          <TabDebts
            db={db}
            isPrivacyMode={isPrivacyMode}
            onUpdateDebt={handleUpdateDebt}
            onRemoveDebt={handleRemoveDebt}
            onUpdateIncome={handleUpdateIncome}
            onUpdateMonthlyIncomes={handleUpdateMonthlyIncomes}
            onUpdateIncomeItems={handleUpdateIncomeItems}
            onDeleteMonths={handleDeleteMonths}
            onRestoreMonths={handleRestoreMonths}
            onSwitchTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenDebtSimulator={() => setShowDebtSimulatorModal(true)}
            onOpenFinancialCalendar={() => setShowFinancialCalendarModal(true)}
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
            onSyncMarketPrices={handleSyncMarketPrices}
          />
        )}

        <Suspense fallback={<LazyFallback />}>
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
              onSyncMarketPrices={handleSyncMarketPrices}
              onUpdateStockWatchlist={handleUpdateStockWatchlist}
            />
          )}

          {currentTab === 'utilities' && (
            <TabUtilities
              db={db}
              onUpdateLifeEvents={handleUpdateLifeEvents}
              onUpdateFoodPlaces={handleUpdateFoodPlaces}
              onSwitchTab={(tab) => {
                setCurrentTab(tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </Suspense>
      </main>

      {/* Floating Reassurance Sync Toast (Chỉ xuất hiện khi người dùng thao tác dữ liệu để tăng tối đa sự an tâm) */}
      {syncToast && (
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 text-white backdrop-blur-md border border-emerald-500/50 rounded-full shadow-2xl text-xs font-semibold select-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">{syncToast}</span>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation (Mobile + Tablet <1024px; Desktop sử dụng DesktopTabBar) */}
      <div className="lg:hidden">
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
    </div>
  );
}
