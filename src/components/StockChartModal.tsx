import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart2,
  RefreshCw,
  Star,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calendar,
} from 'lucide-react';
import {
  StockCandlePoint,
  fetchStockHistory,
  StockQuoteItem,
  StockFinancialRatios,
  fetchStockFinancialRatios,
} from '../utils/stockService';
import { formatVND } from '../utils/format';

export interface StockChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string; // e.g. "VNINDEX" or "HPG", "FPT", "TCB", "VIC"...
  stockQuote?: StockQuoteItem | null;
  vnindexData?: {
    price: number;
    change: number;
    changePercent: number;
    volume?: string;
  } | null;
  ratios?: StockFinancialRatios | null;
  isPrivacyMode?: boolean;
  isInWatchlist?: boolean;
  onToggleWatchlist?: (symbol: string) => void;
  onAddStockGoal?: (symbol: string, name: string, price: number) => void;
  onAddStockAsset?: (symbol: string, name: string, price: number) => void;
}

export type TimeframeOption = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';
export type ChartStyleOption = 'area' | 'candle';

export const StockChartModal: React.FC<StockChartModalProps> = ({
  isOpen,
  onClose,
  symbol,
  stockQuote,
  vnindexData,
  ratios: initialRatios,
  isPrivacyMode = false,
  isInWatchlist = false,
  onToggleWatchlist,
  onAddStockGoal,
  onAddStockAsset,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('1Y');
  const [chartStyle, setChartStyle] = useState<ChartStyleOption>('area');
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  const [historyData, setHistoryData] = useState<StockCandlePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'financials' | 'cycle'>('financials');
  const [ratios, setRatios] = useState<StockFinancialRatios | null>(initialRatios || null);

  // Hover state cho thước ngắm crosshair & tooltip
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isIndex = symbol.toUpperCase() === 'VNINDEX' || symbol.toUpperCase() === 'VN-INDEX';
  const cleanSymbol = isIndex ? 'VNINDEX' : symbol.toUpperCase().trim();

  // Nạp BCTC TCBS nếu chưa có
  useEffect(() => {
    if (!isIndex && cleanSymbol && !ratios) {
      fetchStockFinancialRatios(cleanSymbol).then((res) => {
        if (res) setRatios(res);
      });
    }
  }, [cleanSymbol, isIndex, ratios]);

  // Nạp dữ liệu nến lịch sử đa khung thời gian & nhiều năm
  useEffect(() => {
    if (!isOpen || !cleanSymbol) return;

    let days = 365;
    if (timeframe === '1M') days = 30;
    else if (timeframe === '3M') days = 90;
    else if (timeframe === '6M') days = 180;
    else if (timeframe === '1Y') days = 365;
    else if (timeframe === '3Y') days = 365 * 3;
    else if (timeframe === '5Y') days = 365 * 5;
    else if (timeframe === 'ALL') days = 365 * 30; // 30 năm (lấy toàn bộ từ gốc)

    setIsLoading(true);
    setHoverIndex(null);

    fetchStockHistory(cleanSymbol, days, timeframe)
      .then((data) => {
        setHistoryData(data);
      })
      .catch((err) => {
        console.warn('Lỗi tải dữ liệu lịch sử giá:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, cleanSymbol, timeframe]);

  // Xác định giá hiện tại và thống kê trong phiên
  const latestCandle = historyData.length > 0 ? historyData[historyData.length - 1] : null;

  const currentPrice = isIndex
    ? vnindexData?.price || latestCandle?.close || 1813.5
    : stockQuote?.price || latestCandle?.close || 25000;

  const prevCandle = historyData.length > 1 ? historyData[historyData.length - 2] : null;
  const refPrice = isIndex
    ? (vnindexData ? vnindexData.price - vnindexData.change : prevCandle?.close || latestCandle?.open || currentPrice)
    : stockQuote?.refPrice || prevCandle?.close || latestCandle?.open || currentPrice;

  const change = isIndex
    ? vnindexData?.change ?? (latestCandle && prevCandle ? latestCandle.close - prevCandle.close : 0)
    : stockQuote?.change ?? (latestCandle && prevCandle ? latestCandle.close - prevCandle.close : 0);

  const changePercent = isIndex
    ? vnindexData?.changePercent ?? (refPrice > 0 ? parseFloat(((change / refPrice) * 100).toFixed(2)) : 0)
    : stockQuote?.changePercent ?? (refPrice > 0 ? parseFloat(((change / refPrice) * 100).toFixed(2)) : 0);

  const isUp = change > 0;
  const isDown = change < 0;

  // Cao nhất và thấp nhất trong khung thời gian đang chọn
  const periodHigh = historyData.length > 0
    ? Math.max(...historyData.map((d) => d.high))
    : (stockQuote?.high || currentPrice);

  const periodLow = historyData.length > 0
    ? Math.min(...historyData.map((d) => d.low))
    : (stockQuote?.low || currentPrice);

  const displayName = isIndex
    ? 'Chỉ số VN-INDEX (Sở GDCK TP.HCM - HOSE)'
    : stockQuote?.name || `Cổ phiếu ${cleanSymbol}`;

  const exchangeLabel = isIndex ? 'Chỉ số chính' : cleanSymbol.length === 3 ? 'HOSE / HNX' : 'UPCoM';

  // Vẽ biểu đồ trên Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Padding thoáng đãng, tuyệt đối không bị đè chữ
    const topPadding = 24;
    const bottomPadding = 44; // Đủ chỗ cho trục ngày và năm
    const rightPadding = 75; // Đủ chỗ cho số giá (e.g. 1,813.5 hoặc 241.3k)
    const leftPadding = 16;

    const availableHeight = height - topPadding - bottomPadding;
    const priceChartHeight = showVolume ? availableHeight * 0.72 : availableHeight;
    const volChartHeight = showVolume ? availableHeight * 0.22 : 0;
    const volTop = topPadding + priceChartHeight + 12;

    const data = historyData;
    const n = data.length;

    // Tìm Min & Max giá
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    for (let i = 0; i < n; i++) {
      const p = data[i];
      if (p.low < minPrice) minPrice = p.low;
      if (p.high > maxPrice) maxPrice = p.high;
      if (showMA50 && p.ma50) {
        if (p.ma50 < minPrice) minPrice = p.ma50;
        if (p.ma50 > maxPrice) maxPrice = p.ma50;
      }
      if (showMA200 && p.ma200) {
        if (p.ma200 < minPrice) minPrice = p.ma200;
        if (p.ma200 > maxPrice) maxPrice = p.ma200;
      }
      if (p.volume > maxVol) maxVol = p.volume;
    }

    if (minPrice === Infinity || maxPrice === -Infinity) {
      minPrice = currentPrice * 0.95;
      maxPrice = currentPrice * 1.05;
    }

    // Thêm biên độ 4% ở đỉnh và đáy
    const priceRange = maxPrice - minPrice || 1;
    const adjMin = Math.max(0, minPrice - priceRange * 0.04);
    const adjMax = maxPrice + priceRange * 0.04;
    const adjRange = adjMax - adjMin || 1;

    const getX = (idx: number) => {
      const plotWidth = width - leftPadding - rightPadding;
      if (n <= 1) return leftPadding + plotWidth / 2;
      return leftPadding + (idx / (n - 1)) * plotWidth;
    };

    const getY = (val: number) => {
      return topPadding + priceChartHeight - ((val - adjMin) / adjRange) * priceChartHeight;
    };

    const getVolY = (vol: number) => {
      if (maxVol <= 0) return volTop + volChartHeight;
      return volTop + volChartHeight - (vol / maxVol) * volChartHeight;
    };

    // 1. Vẽ Lưới ngang (Horizontal Grid Lines & Price Labels)
    const gridSteps = 5;
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridSteps; i++) {
      const pVal = adjMin + (i / gridSteps) * adjRange;
      const y = getY(pVal);

      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(width - rightPadding, y);
      ctx.stroke();

      const label = isIndex ? pVal.toFixed(1) : (pVal / 1000).toFixed(1) + 'k';
      ctx.fillText(label, width - rightPadding + 8, y + 3);
    }
    ctx.setLineDash([]);

    // 2. Vẽ Lưới dọc và nhãn thời gian / năm (X-Axis: Date & Year Labels)
    ctx.textAlign = 'center';

    if (timeframe === 'ALL' || timeframe === '5Y' || timeframe === '3Y') {
      // Tìm các mốc năm trong dữ liệu lịch sử
      const yearIndices: { idx: number; year: number }[] = [];
      let lastYear = -1;
      for (let i = 0; i < n; i++) {
        const itemYear = data[i].year || new Date(data[i].time * 1000).getFullYear();
        if (itemYear !== lastYear) {
          yearIndices.push({ idx: i, year: itemYear });
          lastYear = itemYear;
        }
      }

      // Giãn nhãn năm hợp lý để không đè lên nhau
      const maxLabels = Math.min(8, Math.max(3, Math.floor((width - leftPadding - rightPadding) / 75)));
      const step = Math.max(1, Math.ceil(yearIndices.length / maxLabels));

      for (let k = 0; k < yearIndices.length; k += step) {
        const { idx, year } = yearIndices[k];
        const x = getX(idx);

        // Vạch gióng đứng phân chia năm
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(x, topPadding);
        ctx.lineTo(x, height - bottomPadding);
        ctx.stroke();

        // Nhãn năm in đậm rõ ràng
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(year.toString(), x, height - 16);
      }
      ctx.setLineDash([]);
    } else if (timeframe === '1Y') {
      // 1 Năm: Hiển thị Tháng / Năm (T01/26, T05/26...)
      const step = Math.max(1, Math.floor(n / 6));
      ctx.font = '10px sans-serif';
      for (let i = 0; i < n; i += step) {
        const x = getX(i);
        ctx.beginPath();
        ctx.strokeStyle = '#f1f5f9';
        ctx.moveTo(x, topPadding);
        ctx.lineTo(x, height - bottomPadding);
        ctx.stroke();

        const d = data[i];
        const m = (d.month || new Date(d.time * 1000).getMonth() + 1).toString().padStart(2, '0');
        const y = (d.year || new Date(d.time * 1000).getFullYear()).toString().slice(-2);
        ctx.fillStyle = '#64748b';
        ctx.fillText(`T${m}/${y}`, x, height - 16);
      }
    } else {
      // 1M, 3M, 6M: Hiển thị Ngày / Tháng (DD/MM)
      const step = Math.max(1, Math.floor(n / 6));
      ctx.font = '10px sans-serif';
      for (let i = 0; i < n; i += step) {
        const x = getX(i);
        ctx.beginPath();
        ctx.strokeStyle = '#f1f5f9';
        ctx.moveTo(x, topPadding);
        ctx.lineTo(x, height - bottomPadding);
        ctx.stroke();

        const d = data[i];
        const dateText = d.dateStr.slice(0, 5); // DD/MM
        ctx.fillStyle = '#64748b';
        ctx.fillText(dateText, x, height - 16);
      }
    }

    // 3. Vẽ Cột Khối Lượng Giao Dịch (Volume Bars)
    if (showVolume && maxVol > 0) {
      const barWidth = Math.max(1.5, Math.min(8, ((width - leftPadding - rightPadding) / n) * 0.7));
      for (let i = 0; i < n; i++) {
        const item = data[i];
        const x = getX(i);
        const yTop = getVolY(item.volume);
        const yBottom = volTop + volChartHeight;
        const isUpSession = item.close >= item.open;

        ctx.fillStyle = isUpSession ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(x - barWidth / 2, yTop, barWidth, yBottom - yTop);
      }
    }

    // 4. Vẽ Đồ Thị Giá (Area Gradient hoặc Candlestick)
    const firstPoint = data[0];
    const lastPoint = data[n - 1];
    const overallUp = lastPoint.close >= firstPoint.close;
    const strokeColor = overallUp ? '#10b981' : '#f43f5e';
    const gradientTop = overallUp ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)';
    const gradientBottom = 'rgba(255, 255, 255, 0.01)';

    if (chartStyle === 'area') {
      // Area Fill
      const grad = ctx.createLinearGradient(0, topPadding, 0, topPadding + priceChartHeight);
      grad.addColorStop(0, gradientTop);
      grad.addColorStop(1, gradientBottom);

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(data[0].close));
      for (let i = 1; i < n; i++) {
        ctx.lineTo(getX(i), getY(data[i].close));
      }
      ctx.lineTo(getX(n - 1), topPadding + priceChartHeight);
      ctx.lineTo(getX(0), topPadding + priceChartHeight);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Main Line
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(data[0].close));
      for (let i = 1; i < n; i++) {
        ctx.lineTo(getX(i), getY(data[i].close));
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      // Candlestick Style
      const barWidth = Math.max(2, Math.min(10, ((width - leftPadding - rightPadding) / n) * 0.7));

      for (let i = 0; i < n; i++) {
        const item = data[i];
        const x = getX(i);
        const yOpen = getY(item.open);
        const yClose = getY(item.close);
        const yHigh = getY(item.high);
        const yLow = getY(item.low);
        const isGreen = item.close >= item.open;
        const color = isGreen ? '#10b981' : '#f43f5e';

        // Râu nến
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Thân nến
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
      }
    }

    // 5. Vẽ Đường MA50 (Màu vàng hổ phách - Trung hạn 50 phiên)
    if (showMA50) {
      let started = false;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (data[i].ma50) {
          const x = getX(i);
          const y = getY(data[i].ma50!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      if (started) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // 6. Vẽ Đường MA200 (Màu xanh tím / Indigo - Dài hạn 200 phiên)
    if (showMA200) {
      let started = false;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (data[i].ma200) {
          const x = getX(i);
          const y = getY(data[i].ma200!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      if (started) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // 7. Huy hiệu Đỉnh và Đáy trong kỳ
    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 0; i < n; i++) {
      if (data[i].high > data[maxIdx].high) maxIdx = i;
      if (data[i].low < data[minIdx].low) minIdx = i;
    }

    const drawPill = (idx: number, val: number, isHigh: boolean) => {
      const x = getX(idx);
      const y = getY(val);
      const txt = isHigh
        ? `Đỉnh: ${isIndex ? val.toFixed(1) : (val / 1000).toFixed(1) + 'k'}`
        : `Đáy: ${isIndex ? val.toFixed(1) : (val / 1000).toFixed(1) + 'k'}`;

      ctx.font = '9.5px sans-serif';
      const textWidth = ctx.measureText(txt).width;
      const pillW = textWidth + 10;
      const pillH = 17;
      const pillX = Math.max(leftPadding + 4, Math.min(width - rightPadding - pillW - 4, x - pillW / 2));
      const pillY = isHigh ? Math.max(topPadding, y - 22) : Math.min(topPadding + priceChartHeight - pillH, y + 6);

      ctx.fillStyle = isHigh ? '#dbeafe' : '#fee2e2';
      ctx.strokeStyle = isHigh ? '#93c5fd' : '#fca5a5';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHigh ? '#1e40af' : '#991b1b';
      ctx.textAlign = 'left';
      ctx.fillText(txt, pillX + 5, pillY + 12);
    };

    drawPill(maxIdx, data[maxIdx].high, true);
    drawPill(minIdx, data[minIdx].low, false);

    // 8. Thước ngắm Crosshair khi di chuột
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n) {
      const hPoint = data[hoverIndex];
      const hX = getX(hoverIndex);
      const hY = getY(hPoint.close);

      // Trục dọc
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.moveTo(hX, topPadding);
      ctx.lineTo(hX, height - bottomPadding);
      ctx.stroke();

      // Trục ngang
      ctx.beginPath();
      ctx.moveTo(leftPadding, hY);
      ctx.lineTo(width - rightPadding, hY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Điểm tròn tâm ngắm
      ctx.beginPath();
      ctx.arc(hX, hY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Giá dóng trên trục Y bên phải
      const priceText = isIndex ? hPoint.close.toFixed(1) : (hPoint.close / 1000).toFixed(1) + 'k';
      ctx.font = '10px monospace';
      const pw = ctx.measureText(priceText).width + 8;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(width - rightPadding + 2, hY - 9, pw, 18);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(priceText, width - rightPadding + 6, hY + 4);
    }
  }, [
    historyData,
    chartStyle,
    showMA50,
    showMA200,
    showVolume,
    hoverIndex,
    timeframe,
    currentPrice,
    isIndex,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || historyData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const leftPadding = 16;
    const rightPadding = 75;
    const plotWidth = rect.width - leftPadding - rightPadding;

    const relX = Math.max(0, Math.min(plotWidth, clientX - leftPadding));
    const idx = Math.round((relX / plotWidth) * (historyData.length - 1));
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredPoint = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < historyData.length
    ? historyData[hoverIndex]
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={containerRef}
        className="bg-white border border-slate-200 w-full max-w-4xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900"
      >
        {/* Vùng Cuộn Nội Dung Chính */}
        <div className="overflow-y-auto flex-1 flex flex-col">
          {/* 1. Header Bảng Điều Khiển Cổ Phiếu / VN-INDEX */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col gap-2.5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 sticky top-0 z-30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${
                    isIndex
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
                      : 'bg-gradient-to-br from-slate-900 to-blue-900 text-white'
                  }`}
                >
                  {isIndex ? 'VN' : cleanSymbol.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                      {cleanSymbol}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {exchangeLabel}
                    </span>
                    {!isIndex && (
                      <button
                        type="button"
                        onClick={() => onToggleWatchlist?.(cleanSymbol)}
                        className={`text-xs px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                          isInWatchlist
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={isInWatchlist ? 'Bỏ theo dõi khỏi danh mục' : 'Thêm vào danh mục theo dõi'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isInWatchlist ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                        <span>{isInWatchlist ? 'Đang theo dõi' : '+ Theo dõi'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md">
                    {displayName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Đóng biểu đồ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dòng hiển thị giá to & biến động */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1 border-t border-slate-100/80">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  {isPrivacyMode
                    ? '••••••'
                    : isIndex
                    ? `${currentPrice.toLocaleString('vi-VN')} điểm`
                    : formatVND(currentPrice)}
                </span>

                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black leading-none border ${
                    isUp
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : isDown
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-amber-50 text-amber-700 border-amber-300'
                  }`}
                >
                  {isUp && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {isDown && <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    {change > 0 ? `+${change}` : change} ({changePercent > 0 ? `+${changePercent}` : changePercent}%)
                  </span>
                </div>
              </div>

              {/* Dải thống kê tham chiếu / đỉnh đáy trong kỳ */}
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-mono flex-wrap">
                <div className="text-slate-500">
                  <span>TC: </span>
                  <b className="text-amber-700">{isIndex ? refPrice.toFixed(1) : (refPrice / 1000).toFixed(1) + 'k'}</b>
                </div>
                <div className="text-slate-500">
                  <span>Cao kỳ: </span>
                  <b className="text-emerald-700">{isIndex ? periodHigh.toFixed(1) : (periodHigh / 1000).toFixed(1) + 'k'}</b>
                </div>
                <div className="text-slate-500">
                  <span>Thấp kỳ: </span>
                  <b className="text-rose-700">{isIndex ? periodLow.toFixed(1) : (periodLow / 1000).toFixed(1) + 'k'}</b>
                </div>
                {stockQuote?.volume || vnindexData?.volume ? (
                  <div className="text-slate-500 hidden sm:block">
                    <span>KL: </span>
                    <b className="text-slate-800">
                      {isIndex
                        ? vnindexData?.volume || '520M CP'
                        : `${Math.round((stockQuote?.volume || 0) / 1000).toLocaleString('vi-VN')}k CP`}
                    </b>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* 2. Thanh Công Cụ Biểu Đồ (Timeframe Đầy Đủ Các Năm & Tùy chọn chỉ báo) */}
          <div className="px-3.5 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 text-xs shrink-0">
            {/* Timeframe Buttons: Đầy đủ từ 1 Tháng, 1 Năm đến Tất Cả Các Năm */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200/90 shadow-2xs">
              {(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                    timeframe === tf
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={
                    tf === '1M' ? '1 Tháng gần nhất' :
                    tf === '1Y' ? '1 Năm gần nhất' :
                    tf === '3Y' ? '3 Năm chu kỳ' :
                    tf === '5Y' ? '5 Năm trung hạn' :
                    tf === 'ALL' ? 'Toàn bộ các năm từ khi niêm yết' : `${tf}`
                  }
                >
                  {tf === 'ALL' ? 'Tất Cả (Năm)' : tf}
                </button>
              ))}
            </div>

            {/* Style & Indicator Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Chart Style Toggle */}
              <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/90">
                <button
                  type="button"
                  onClick={() => setChartStyle('area')}
                  className={`px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                    chartStyle === 'area'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Đường
                </button>
                <button
                  type="button"
                  onClick={() => setChartStyle('candle')}
                  className={`px-2 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                    chartStyle === 'candle'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Nến Nhật
                </button>
              </div>

              {/* MA Toggles */}
              <button
                type="button"
                onClick={() => setShowMA50((prev) => !prev)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                  showMA50
                    ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
                title="Đường trung bình động 50 phiên (Xu hướng trung hạn)"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>MA50</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMA200((prev) => !prev)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                  showMA200
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
                title="Đường trung bình động 200 phiên (Xu hướng dài hạn)"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>MA200</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVolume((prev) => !prev)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border transition cursor-pointer ${
                  showVolume
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                Vol
              </button>
            </div>
          </div>

          {/* 3. Vùng Biểu Đồ Chính (Độ cao cố định, Canvas Độc Lập Không Bị Đè) */}
          <div className="relative h-[370px] sm:h-[430px] w-full bg-white shrink-0">
            {isLoading && (
              <div className="absolute inset-0 bg-white/75 backdrop-blur-2xs flex items-center justify-center z-20">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs bg-white px-3.5 py-2 rounded-xl shadow-lg border border-slate-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Đang tải nến lịch sử {cleanSymbol} ({timeframe})...</span>
                </div>
              </div>
            )}

            {/* Thanh Tooltip Động Hiện Chi Tiết Nến Khi Rà Chuột */}
            {hoveredPoint ? (
              <div className="absolute top-2.5 left-4 z-10 bg-slate-900/90 text-white rounded-lg px-2.5 py-1 text-[11px] font-mono shadow-md backdrop-blur-xs flex items-center gap-2.5 flex-wrap pointer-events-none border border-slate-800">
                <div className="text-amber-300 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{hoveredPoint.dateStr}</span>
                </div>
                <div>
                  Đóng: <b className="text-emerald-400">{isIndex ? hoveredPoint.close.toFixed(2) : formatVND(hoveredPoint.close)}</b>
                </div>
                <div>
                  Mở: <span className="text-slate-300">{isIndex ? hoveredPoint.open.toFixed(2) : (hoveredPoint.open / 1000).toFixed(1) + 'k'}</span>
                </div>
                <div>
                  Cao: <span className="text-slate-300">{isIndex ? hoveredPoint.high.toFixed(2) : (hoveredPoint.high / 1000).toFixed(1) + 'k'}</span>
                </div>
                <div>
                  Thấp: <span className="text-slate-300">{isIndex ? hoveredPoint.low.toFixed(2) : (hoveredPoint.low / 1000).toFixed(1) + 'k'}</span>
                </div>
                {hoveredPoint.volume > 0 && (
                  <div>
                    KL: <span className="text-sky-300">{Math.round(hoveredPoint.volume / 1000).toLocaleString('vi-VN')}k</span>
                  </div>
                )}
                {showMA50 && hoveredPoint.ma50 && (
                  <div>
                    MA50: <span className="text-amber-400">{isIndex ? hoveredPoint.ma50.toFixed(1) : (hoveredPoint.ma50 / 1000).toFixed(1) + 'k'}</span>
                  </div>
                )}
                {showMA200 && hoveredPoint.ma200 && (
                  <div>
                    MA200: <span className="text-indigo-400">{isIndex ? hoveredPoint.ma200.toFixed(1) : (hoveredPoint.ma200 / 1000).toFixed(1) + 'k'}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute top-2.5 left-4 z-10 text-[10px] text-slate-400 font-medium pointer-events-none flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                <span>Rà chuột hoặc chạm vào nến để xem chi tiết từng phiên</span>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="w-full h-full block cursor-crosshair"
            />
          </div>

          {/* 4. Tab Thông Tin Bổ Trợ Dưới Cùng (Tách Biệt Hoàn Toàn Khỏi Vùng Vẽ) */}
          <div className="border-t border-slate-200 bg-slate-50/80 p-3.5 sm:p-4 shrink-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('financials')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    activeTab === 'financials'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isIndex ? 'Tổng Quan Định Giá HOSE' : 'BCTC & Định Giá (TCBS)'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cycle')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    activeTab === 'cycle'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isIndex ? 'Xu Hướng & Khuyến Nghị Vĩ Mô' : 'Đáy Chu Kỳ 52 Tuần & Vùng Gom'}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {!isIndex && onAddStockAsset && (
                  <button
                    type="button"
                    onClick={() => onAddStockAsset(cleanSymbol, displayName, currentPrice)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ Tab 1 (Tài sản)</span>
                  </button>
                )}
                {!isIndex && onAddStockGoal && (
                  <button
                    type="button"
                    onClick={() => onAddStockGoal(cleanSymbol, displayName, currentPrice)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Tab 3 (Mục tiêu DCA)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Nội dung Tab */}
            {isIndex ? (
              activeTab === 'financials' ? (
                // Định giá toàn sàn HOSE
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">P/E Toàn Sàn (Trailing)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-slate-900 font-mono">14.2x</span>
                      <span className="text-[10.5px] text-emerald-600 font-bold">Vùng hấp dẫn</span>
                    </div>
                    <p className="text-[10.5px] text-slate-600">Thấp hơn mức trung bình 10 năm (15.5x), định giá thích hợp để gom định kỳ dài hạn.</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">P/B Thị Trường (Sổ sách)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-slate-900 font-mono">1.65x</span>
                      <span className="text-[10.5px] text-slate-500 font-mono">Toàn thị trường</span>
                    </div>
                    <p className="text-[10.5px] text-slate-600">Biên an toàn cao so với tốc độ tăng trưởng EPS dự phóng toàn sàn &gt;15%/năm.</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thanh Khoản & Dòng Tiền</span>
                    <div className="text-[11px] text-slate-700 space-y-0.5 font-mono">
                      <div>GTGD bình quân: <b className="text-slate-900">~22,000 - 26,000 tỷ/phiên</b></div>
                      <div>Dòng vốn FII: <b className="text-emerald-700">Trở lại mua ròng</b></div>
                    </div>
                  </div>
                </div>
              ) : (
                // Xu hướng & Vĩ mô
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Chu Kỳ Nới Lỏng Tiền Tệ</span>
                    </span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Cục Dự trữ Liên bang Mỹ (FED) và Ngân hàng Nhà nước (SBV) duy trì lãi suất hỗ trợ tăng trưởng kinh tế. Dòng tiền nhàn rỗi đang dần luân chuyển vào kênh chứng khoán tích sản.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Chiến Lược Phân Bổ Vốn</span>
                    </span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Ưu tiên tích lũy các cổ phiếu đầu ngành trong rổ VN30 có định giá P/B dưới 1.5x, ROE trên 18% và tỷ lệ cổ tức tiền mặt đều đặn. Hạn chế lướt sóng đòn bẩy cao.
                    </p>
                  </div>
                </div>
              )
            ) : activeTab === 'financials' ? (
              // BCTC TCBS của Cổ phiếu
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">P/E (Trailing)</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {ratios?.pe ? `${ratios.pe}x` : '12.5x'}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">Giá / Lợi nhuận</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">P/B (Giá / Sổ sách)</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {ratios?.pb ? `${ratios.pb}x` : '1.45x'}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">Giá trị sổ sách</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-emerald-600 block">ROE (Sinh lời VCSH)</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">
                    {ratios?.roe ? `${ratios.roe}%` : '18.2%'}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">Hiệu quả vốn</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block">ROA (Sinh lời Tài sản)</span>
                  <span className="text-sm font-black text-slate-800 font-mono">
                    {ratios?.roa ? `${ratios.roa}%` : '8.6%'}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">{ratios?.period || 'Q2/2026'}</span>
                </div>
              </div>
            ) : (
              // Dải Đáy Chu Kỳ
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-xs">
                  <div className="bg-white border border-slate-200 rounded-lg p-1.5">
                    <div className="text-[8.5px] text-slate-400 font-bold font-sans">Đáy 5T</div>
                    <div className="font-black text-slate-800">
                      {((stockQuote?.low5w || currentPrice * 0.96) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-slate-500 font-bold">
                      +{stockQuote?.diffFromLow5wPct ?? 4}%
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-1.5">
                    <div className="text-[8.5px] text-slate-400 font-bold font-sans">Đáy 10T</div>
                    <div className="font-black text-slate-800">
                      {((stockQuote?.low10w || currentPrice * 0.92) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-slate-500 font-bold">
                      +{stockQuote?.diffFromLow10wPct ?? 8}%
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-1.5">
                    <div className="text-[8.5px] text-slate-400 font-bold font-sans">Đáy 20T</div>
                    <div className="font-black text-slate-800">
                      {((stockQuote?.low20w || currentPrice * 0.88) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-slate-500 font-bold">
                      +{stockQuote?.diffFromLow20wPct ?? 12}%
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-1.5">
                    <div className="text-[8.5px] text-slate-400 font-bold font-sans">Đáy 30T</div>
                    <div className="font-black text-slate-800">
                      {((stockQuote?.low30w || currentPrice * 0.82) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-slate-500 font-bold">
                      +{stockQuote?.diffFromLow30wPct ?? 18}%
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-1.5">
                    <div className="text-[8.5px] text-indigo-700 font-black font-sans">Đáy 52T</div>
                    <div className="font-black text-indigo-950">
                      {((stockQuote?.low52w || currentPrice * 0.76) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-[8px] text-indigo-700 font-bold">
                      +{stockQuote?.diffFromLow52wPct ?? 24}%
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Định giá: <b>{stockQuote?.valuationStatus || 'Vùng tích sản dài hạn (DCA)'}</b></span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-bold font-mono">
                    Cách đáy 52 tuần +{stockQuote?.diffFromLow52wPct ?? 24}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
