import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  UtensilsCrossed,
  MapPin,
  Navigation,
  Search,
  Plus,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Star,
  Phone,
  Cake,
  Flame,
  Flag,
  Users,
  Briefcase,
  LocateFixed,
  List,
  Table as TableIcon,
  X,
  CheckCircle2,
  Check,
  SlidersHorizontal,
  ArrowUpDown,
  ExternalLink,
  Copy,
  RotateCcw,
  Compass,
  Sparkles,
  Map as MapIcon,
} from 'lucide-react';
import { DatabaseState, LifeEvent, LifeEventType, FoodPlace, FoodCategory } from '../types';
import {
  convertSolarToLunar,
  convertLunarToSolar,
  getDaysInSolarMonth,
} from '../utils/lunarCalendar';
import {
  Coordinates,
  PRESET_LOCATIONS,
  EXACT_BUILDING_PRESETS,
  BuildingMicroZone,
  calculateDistanceKm,
  formatDistance,
  formatTravelEstimate,
  getGoogleMapsDirectionsUrl,
  getGoogleMapsGpsDirectionsUrl,
  getGoogleMapsNearbyUrl,
  getGoogleMapsPinUrl,
  getGoogleMapsMyLocationUrl,
  getGoogleMapsPlaceSearchUrl,
  getGoogleMapsEmbedUrl,
  getCurrentDevicePosition,
  detectExactBuilding,
  detectVietnamLandmark,
  searchAddressOnMap,
} from '../utils/geoUtils';
import { DEFAULT_LIFE_EVENTS, DEFAULT_FOOD_PLACES } from '../utils/utilityDefaultData';

interface TabUtilitiesProps {
  db: DatabaseState;
  onUpdateLifeEvents: (events: LifeEvent[]) => void;
  onUpdateFoodPlaces: (places: FoodPlace[]) => void;
  onSwitchTab?: (tab: any) => void;
}

export const TabUtilities: React.FC<TabUtilitiesProps> = ({
  db,
  onUpdateLifeEvents,
  onUpdateFoodPlaces,
}) => {
  // Main Sub-tabs: 'calendar' (Lịch & Sự kiện) or 'food' (Quán ăn & Món ngon)
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'food'>('food');

  // View modes
  // In Calendar: 'list' (Danh sách sự kiện dễ nhìn) vs 'grid' (Lưới lịch tháng)
  const [calViewMode, setCalViewMode] = useState<'list' | 'grid'>('list');

  // In Food: 'compact_list' (Bảng gọn dòng, mặc định) vs 'list' (Danh sách thẻ)
  const [foodViewMode, setFoodViewMode] = useState<'list' | 'compact_list'>('compact_list');

  // Ensure default data exists
  const lifeEvents: LifeEvent[] = useMemo(() => {
    return db.lifeEvents && db.lifeEvents.length > 0 ? db.lifeEvents : DEFAULT_LIFE_EVENTS;
  }, [db.lifeEvents]);

  // Danh sách mẫu quán ăn ngon gợi ý ban đầu (nếu người dùng muốn nạp mẫu)
  const SAMPLE_FAVORITE_PLACES: FoodPlace[] = useMemo(
    () => [
      {
        id: 'sample_pho_thin',
        name: 'Phở Thìn Lò Đúc',
        category: 'noodles',
        specialtyDishes: 'Phở bò tái lăn xào lăn lửa lớn, nhiều hành hoa',
        priceRange: '65.000đ - 90.000đ',
        approxPricePerPerson: 75000,
        address: '13 Lò Đúc, Phạm Đình Hổ, Hai Bà Trưng, Hà Nội',
        city: 'Hà Nội',
        latitude: 21.018265,
        longitude: 105.85642,
        phone: '02438212709',
        openingHours: '06:00 - 20:30',
        rating: 4.8,
        tags: ['Phở truyền thống', 'Thương hiệu lâu đời', 'Tái lăn'],
        note: 'Nước dùng béo ngậy đặc trưng, nên ăn kèm quẩy giòn và tương ớt truyền thống.',
        isCustom: true,
        isFavorite: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sample_buncha_dac_kim',
        name: 'Bún Chả Đắc Kim - Hàng Mành',
        category: 'noodles',
        specialtyDishes: 'Bún chả nướng than hoa, nem cua bể giòn rụm',
        priceRange: '60.000đ - 100.000đ',
        approxPricePerPerson: 80000,
        address: 'Số 1 Hàng Mành, Hàng Gai, Hoàn Kiếm, Hà Nội',
        city: 'Hà Nội',
        latitude: 21.033621,
        longitude: 105.84799,
        phone: '02438287053',
        openingHours: '08:30 - 21:00',
        rating: 4.7,
        tags: ['Bún chả', 'Nem cua bể', 'Phố Cổ'],
        note: 'Suất ăn đầy đặn, chả viên nướng mềm thơm ngậy.',
        isCustom: true,
        isFavorite: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sample_pizza_4ps',
        name: "Pizza 4P's",
        category: 'casual',
        specialtyDishes: 'Pizza phô mai Burrata tươi, Mì cua sốt kem cà chua',
        priceRange: '150.000đ - 350.000đ',
        approxPricePerPerson: 250000,
        address: '24 Lý Quốc Sư, Hàng Trống, Hoàn Kiếm, Hà Nội',
        city: 'Hà Nội',
        latitude: 21.02981,
        longitude: 105.84912,
        phone: '02836220500',
        openingHours: '10:00 - 22:00',
        rating: 4.9,
        tags: ['Pizza lò củi', 'Phô mai tươi', 'Hẹn hò gia đình'],
        note: 'Nên đặt bàn trước qua hotline/app, phô mai tự làm thủ công.',
        isCustom: true,
        isFavorite: true,
        createdAt: new Date().toISOString(),
      },
    ],
    []
  );

  // Danh sách quán ăn ngon do người dùng tự list vào app
  // Đối với các quán ăn nói chung: người dùng tự tìm trên Google Maps theo định vị, không cần list sẵn vào app.
  // Ứng dụng chỉ lưu và quản lý các quán ăn ngon do chính người dùng tự thêm.
  const foodPlaces: FoodPlace[] = useMemo(() => {
    const rawPlaces = db.foodPlaces || [];
    // Chỉ giữ lại những quán do người dùng tự thêm (isCustom === true)
    const customOnly = rawPlaces.filter((p) => p.isCustom);
    const uniqueMap = new Map<string, FoodPlace>();
    for (const p of customOnly) {
      if (!uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    }
    return Array.from(uniqueMap.values());
  }, [db.foodPlaces]);

  // -------------------------------------------------------------
  // CALENDAR & EVENTS STATE & LOGIC
  // -------------------------------------------------------------
  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<{ day: number; month: number; year: number }>({
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  });
  const [eventFilter, setEventFilter] = useState<LifeEventType | 'all'>('all');
  const [eventSearch, setEventSearch] = useState<string>('');
  const [eventTimeRange, setEventTimeRange] = useState<'all' | '30days' | '90days' | 'this_year'>('all');
  const [showAddEventModal, setShowAddEventModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);

  // New/Edit Event Form State
  const [eventFormTitle, setEventFormTitle] = useState<string>('');
  const [eventFormType, setEventFormType] = useState<LifeEventType>('family');
  const [eventFormIsLunar, setEventFormIsLunar] = useState<boolean>(false);
  const [eventFormDay, setEventFormDay] = useState<number>(1);
  const [eventFormMonth, setEventFormMonth] = useState<number>(1);
  const [eventFormYear, setEventFormYear] = useState<string>('');
  const [eventFormPerson, setEventFormPerson] = useState<string>('');
  const [eventFormNote, setEventFormNote] = useState<string>('');
  const [eventFormRepeat, setEventFormRepeat] = useState<boolean>(true);
  const [eventFormIsHoliday, setEventFormIsHoliday] = useState<boolean>(false);

  // Calculate upcoming events with countdown
  const upcomingEvents = useMemo(() => {
    const list: Array<{
      event: LifeEvent;
      targetDate: Date;
      solarStr: string;
      lunarStr: string;
      daysRemaining: number;
    }> = [];

    const currentYear = today.getFullYear();
    const todayZero = new Date(currentYear, today.getMonth(), today.getDate()).getTime();

    lifeEvents.forEach((ev) => {
      // Find the upcoming occurrence in this year or next year
      for (let y = currentYear; y <= currentYear + 1; y++) {
        let solarTarget: { day: number; month: number; year: number };
        if (ev.isLunar) {
          solarTarget = convertLunarToSolar(ev.day, ev.month, y);
        } else {
          solarTarget = { day: ev.day, month: ev.month, year: y };
        }

        const targetDate = new Date(solarTarget.year, solarTarget.month - 1, solarTarget.day);
        const targetZero = targetDate.getTime();
        const diffMs = targetZero - todayZero;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          const lDate = ev.isLunar
            ? { day: ev.day, month: ev.month, isLeap: false }
            : convertSolarToLunar(solarTarget.day, solarTarget.month, solarTarget.year);

          list.push({
            event: ev,
            targetDate,
            solarStr: `${solarTarget.day < 10 ? '0' + solarTarget.day : solarTarget.day}/${
              solarTarget.month < 10 ? '0' + solarTarget.month : solarTarget.month
            }/${solarTarget.year}`,
            lunarStr: `${lDate.day}/${lDate.month} ÂL`,
            daysRemaining: diffDays,
          });
          break; // Found the next immediate occurrence
        }
      }
    });

    // Sort by daysRemaining ascending
    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [lifeEvents, today]);

  // Filtered upcoming events for List View
  const filteredEvents = useMemo(() => {
    let result = upcomingEvents;

    if (eventFilter !== 'all') {
      result = result.filter((x) => x.event.type === eventFilter);
    }

    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase().trim();
      result = result.filter(
        (x) =>
          x.event.title.toLowerCase().includes(q) ||
          (x.event.note && x.event.note.toLowerCase().includes(q)) ||
          (x.event.personName && x.event.personName.toLowerCase().includes(q))
      );
    }

    if (eventTimeRange === '30days') {
      result = result.filter((x) => x.daysRemaining <= 30);
    } else if (eventTimeRange === '90days') {
      result = result.filter((x) => x.daysRemaining <= 90);
    } else if (eventTimeRange === 'this_year') {
      result = result.filter((x) => x.targetDate.getFullYear() === today.getFullYear());
    }

    return result;
  }, [upcomingEvents, eventFilter, eventSearch, eventTimeRange, today]);

  // Calendar Grid Days for the current month
  const calendarDays = useMemo(() => {
    const totalDays = getDaysInSolarMonth(calMonth, calYear);
    const firstDayIndexRaw = new Date(calYear, calMonth - 1, 1).getDay();
    const firstDayIndex = firstDayIndexRaw === 0 ? 6 : firstDayIndexRaw - 1;

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true, key: `empty-pre-${i}` });
    }

    for (let d = 1; d <= totalDays; d++) {
      const lunar = convertSolarToLunar(d, calMonth, calYear);
      const matchedEvents = lifeEvents.filter((ev) => {
        if (ev.isLunar) {
          return ev.day === lunar.day && ev.month === lunar.month;
        } else {
          return ev.day === d && ev.month === calMonth;
        }
      });

      const isToday =
        d === today.getDate() && calMonth === today.getMonth() + 1 && calYear === today.getFullYear();
      const isSelected =
        d === selectedDate.day && calMonth === selectedDate.month && calYear === selectedDate.year;

      days.push({
        empty: false,
        day: d,
        lunar,
        events: matchedEvents,
        isToday,
        isSelected,
        key: `day-${d}`,
      });
    }

    return days;
  }, [calMonth, calYear, lifeEvents, today, selectedDate]);

  // Events on selected day
  const eventsOnSelectedDate = useMemo(() => {
    const lunar = convertSolarToLunar(selectedDate.day, selectedDate.month, selectedDate.year);
    return lifeEvents.filter((ev) => {
      if (ev.isLunar) {
        return ev.day === lunar.day && ev.month === lunar.month;
      } else {
        return ev.day === selectedDate.day && ev.month === selectedDate.month;
      }
    });
  }, [selectedDate, lifeEvents]);

  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalMonth(12);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalMonth(1);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleResetToToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth() + 1);
    setSelectedDate({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
  };

  const openAddEvent = (presetDate?: { day: number; month: number }) => {
    setEditingEvent(null);
    setEventFormTitle('');
    setEventFormType('family');
    setEventFormIsLunar(false);
    setEventFormDay(presetDate?.day || selectedDate.day);
    setEventFormMonth(presetDate?.month || selectedDate.month);
    setEventFormYear('');
    setEventFormPerson('');
    setEventFormNote('');
    setEventFormRepeat(true);
    setEventFormIsHoliday(false);
    setShowAddEventModal(true);
  };

  const openEditEvent = (ev: LifeEvent) => {
    setEditingEvent(ev);
    setEventFormTitle(ev.title);
    setEventFormType(ev.type);
    setEventFormIsLunar(ev.isLunar);
    setEventFormDay(ev.day);
    setEventFormMonth(ev.month);
    setEventFormYear(ev.year ? String(ev.year) : '');
    setEventFormPerson(ev.personName || '');
    setEventFormNote(ev.note || '');
    setEventFormRepeat(ev.repeatYearly);
    setEventFormIsHoliday(!!ev.isNationalHoliday);
    setShowAddEventModal(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFormTitle.trim()) return;

    const newEv: LifeEvent = {
      id: editingEvent ? editingEvent.id : `evt_${Date.now()}`,
      title: eventFormTitle.trim(),
      type: eventFormType,
      isLunar: eventFormIsLunar,
      day: Number(eventFormDay),
      month: Number(eventFormMonth),
      year: eventFormYear ? Number(eventFormYear) : undefined,
      repeatYearly: eventFormRepeat,
      personName: eventFormPerson.trim() || undefined,
      note: eventFormNote.trim() || undefined,
      isNationalHoliday: eventFormIsHoliday,
      createdAt: editingEvent?.createdAt || new Date().toISOString(),
    };

    let updated: LifeEvent[];
    if (editingEvent) {
      updated = lifeEvents.map((x) => (x.id === editingEvent.id ? newEv : x));
    } else {
      updated = [newEv, ...lifeEvents];
    }

    onUpdateLifeEvents(updated);
    setShowAddEventModal(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      const updated = lifeEvents.filter((x) => x.id !== id);
      onUpdateLifeEvents(updated);
    }
  };

  // -------------------------------------------------------------
  // FOOD PLACES & MAP NAVIGATION LOGIC
  // -------------------------------------------------------------
  // Khởi tạo vị trí: Ưu tiên vị trí đã lưu hợp lệ; mặc định KĐT Thanh Hà để phục vụ ngay
  const [userCoords, setUserCoords] = useState<Coordinates>(() => {
    try {
      const saved = localStorage.getItem('thaptaisan_exact_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.latitude && parsed.longitude) {
          // Nâng cấp vị trí nếu trước đó bị kẹt ở mẫu cũ hoặc Hoàn Kiếm khi chưa cấp GPS
          if (
            parsed.fullAddress?.includes('HH03D') ||
            parsed.cityName?.includes('HH03D') ||
            (!parsed.accuracy && parsed.cityName?.includes('Hoàn Kiếm'))
          ) {
            return PRESET_LOCATIONS.thanhha;
          }
          return parsed;
        }
      }
    } catch (e) {}
    return PRESET_LOCATIONS.thanhha;
  });

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('thaptaisan_exact_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && !parsed.fullAddress?.includes('HH03D')) {
          return parsed.fullAddress || parsed.cityName || 'KĐT Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội';
        }
      }
    } catch (e) {}
    return 'KĐT Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội';
  });
  const [gpsErrorNotice, setGpsErrorNotice] = useState<string>('');
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [foodSearch, setFoodSearch] = useState<string>('');
  const [foodCategory, setFoodCategory] = useState<FoodCategory>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'budget' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price_asc'>('distance');
  const [selectedFoodPlace, setSelectedFoodPlace] = useState<FoodPlace | null>(null);

  // Quick Inline Address Input on Location Card
  const [quickAddressInput, setQuickAddressInput] = useState<string>('');
  const [quickSuggestions, setQuickSuggestions] = useState<any[]>([]);
  const [isQuickSearching, setIsQuickSearching] = useState<boolean>(false);
  const [showQuickDropdown, setShowQuickDropdown] = useState<boolean>(false);

  // Exact House Number & Building Modal State
  const [showExactAddressModal, setShowExactAddressModal] = useState<boolean>(false);
  const [addressSearchInput, setAddressSearchInput] = useState<string>('');
  const [addressSearchResults, setAddressSearchResults] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);

  // Add / Edit Food Place Modal
  const [showAddFoodModal, setShowAddFoodModal] = useState<boolean>(false);
  const [editingFood, setEditingFood] = useState<FoodPlace | null>(null);
  const [foodFormName, setFoodFormName] = useState<string>('');
  const [foodFormCategory, setFoodFormCategory] = useState<FoodCategory>('noodles');
  const [foodFormSpecialty, setFoodFormSpecialty] = useState<string>('');
  const [foodFormPriceRange, setFoodFormPriceRange] = useState<string>('');
  const [foodFormApproxPrice, setFoodFormApproxPrice] = useState<string>('');
  const [foodFormAddress, setFoodFormAddress] = useState<string>('');
  const [foodFormCity, setFoodFormCity] = useState<string>('Hà Nội');
  const [foodFormPhone, setFoodFormPhone] = useState<string>('');
  const [foodFormOpening, setFoodFormOpening] = useState<string>('');
  const [foodFormRating, setFoodFormRating] = useState<number>(5.0);
  const [foodFormTags, setFoodFormTags] = useState<string>('');
  const [foodFormNote, setFoodFormNote] = useState<string>('');
  const [foodFormLat, setFoodFormLat] = useState<string>('');
  const [foodFormLng, setFoodFormLng] = useState<string>('');
  const [showFoodMapPicker, setShowFoodMapPicker] = useState<boolean>(false);
  const [foodMapSearchQuery, setFoodMapSearchQuery] = useState<string>('');
  const [foodMapSearchResults, setFoodMapSearchResults] = useState<any[]>([]);
  const [isSearchingFoodMap, setIsSearchingFoodMap] = useState<boolean>(false);
  const [selectedFoodMapPlace, setSelectedFoodMapPlace] = useState<any | null>(null);

  const handleCopyAddress = (address: string, name: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${name}, ${address}`).catch(() => {});
    }
    setCopyToast(`Đã sao chép: "${name} - ${address}"`);
    setTimeout(() => {
      setCopyToast(null);
    }, 2800);
  };

  const handleQuickAddressChange = async (val: string) => {
    setQuickAddressInput(val);
    if (val.trim().length >= 2) {
      setIsQuickSearching(true);
      setShowQuickDropdown(true);
      try {
        const matches = await searchAddressOnMap(val);
        setQuickSuggestions(matches.slice(0, 6));
      } catch (e) {
        setQuickSuggestions([]);
      } finally {
        setIsQuickSearching(false);
      }
    } else {
      setQuickSuggestions([]);
      setShowQuickDropdown(false);
    }
  };

  const handleSelectQuickSuggestion = (item: any) => {
    const newCoords: Coordinates = {
      latitude: item.lat,
      longitude: item.lng,
      cityName: item.districtOrCity || item.name,
      fullAddress: item.fullAddress,
      building: item.name,
      accuracy: 10,
    };
    setUserCoords(newCoords);
    try {
      localStorage.setItem('thaptaisan_exact_location', JSON.stringify(newCoords));
    } catch (e) {}
    setLocationStatus(`Đã ghim vị trí: ${item.fullAddress}`);
    setQuickAddressInput('');
    setShowQuickDropdown(false);
    setCopyToast(`Đã định vị: ${item.name || item.fullAddress}`);
    setTimeout(() => setCopyToast(null), 2800);
  };

  const handleQuickAddressSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickAddressInput.trim()) return;
    setIsQuickSearching(true);
    try {
      const matches = await searchAddressOnMap(quickAddressInput.trim());
      if (matches.length > 0) {
        handleSelectQuickSuggestion(matches[0]);
      } else {
        setGpsErrorNotice(`Không tìm thấy vị trí khớp với "${quickAddressInput}". Bạn vui lòng nhập tên tòa nhà hoặc đường phố.`);
      }
    } catch (err) {
      setGpsErrorNotice('Lỗi tìm kiếm vị trí. Vui lòng thử lại.');
    } finally {
      setIsQuickSearching(false);
    }
  };

  const handleLoadSamplePlaces = () => {
    const customPlaces = foodPlaces.filter((p) => p.isCustom);
    const existingIds = new Set(customPlaces.map((p) => p.id));
    const toAdd = SAMPLE_FAVORITE_PLACES.filter((p) => !existingIds.has(p.id));
    const updated = [...customPlaces, ...toAdd];
    onUpdateFoodPlaces(updated);
    setCopyToast('Đã thêm 3 quán ăn ngon mẫu tham khảo vào bộ sưu tập cá nhân!');
    setTimeout(() => {
      setCopyToast(null);
    }, 3000);
  };

  const handleClearAllFoodPlaces = () => {
    if (confirm('Bạn có chắc chắn muốn làm trống danh sách quán ăn ngon của mình?')) {
      onUpdateFoodPlaces([]);
      setCopyToast('Đã làm trống bộ sưu tập quán ăn ngon!');
      setTimeout(() => {
        setCopyToast(null);
      }, 3000);
    }
  };

  const handleFillCurrentLocationToFoodForm = () => {
    setFoodFormAddress(userCoords.fullAddress || userCoords.building || userCoords.cityName || '');
    setFoodFormLat(userCoords.latitude ? userCoords.latitude.toFixed(6) : '');
    setFoodFormLng(userCoords.longitude ? userCoords.longitude.toFixed(6) : '');
    if (userCoords.cityName) {
      setFoodFormCity(userCoords.cityName);
    }
    setCopyToast('Đã lấy tọa độ & vị trí của bạn vào thông tin quán!');
    setTimeout(() => setCopyToast(null), 2500);
  };

  const handleOpenFoodMapPicker = () => {
    const initialQuery = foodFormAddress || foodFormName || '';
    setFoodMapSearchQuery(initialQuery);
    setSelectedFoodMapPlace({
      name: foodFormName || foodFormAddress || 'Vị trí đã chọn',
      fullAddress: foodFormAddress || userCoords.fullAddress || userCoords.cityName || 'Hà Nội',
      lat: Number(foodFormLat) || userCoords.latitude,
      lng: Number(foodFormLng) || userCoords.longitude,
      districtOrCity: foodFormCity || userCoords.cityName || 'Hà Nội',
    });
    if (initialQuery.trim().length >= 2) {
      setIsSearchingFoodMap(true);
      searchAddressOnMap(initialQuery)
        .then((res) => {
          setFoodMapSearchResults(res);
          if (res.length > 0) setSelectedFoodMapPlace(res[0]);
        })
        .catch(() => setFoodMapSearchResults([]))
        .finally(() => setIsSearchingFoodMap(false));
    } else {
      setFoodMapSearchResults([]);
    }
    setShowFoodMapPicker(true);
  };

  const handleFoodMapSearchChange = async (queryText: string) => {
    setFoodMapSearchQuery(queryText);
    if (!queryText.trim()) {
      setFoodMapSearchResults([]);
      return;
    }
    setIsSearchingFoodMap(true);
    try {
      const res = await searchAddressOnMap(queryText);
      setFoodMapSearchResults(res);
      if (res.length > 0) {
        setSelectedFoodMapPlace(res[0]);
      }
    } catch (e) {
      setFoodMapSearchResults([]);
    } finally {
      setIsSearchingFoodMap(false);
    }
  };

  const handleSelectFoodMapResult = (res: any) => {
    setSelectedFoodMapPlace(res);
    setFoodMapSearchQuery(res.fullAddress || res.name);
  };

  const handleApplyFoodMapPlace = () => {
    const chosen = selectedFoodMapPlace || {
      name: foodMapSearchQuery,
      fullAddress: foodMapSearchQuery,
      lat: userCoords.latitude,
      lng: userCoords.longitude,
      districtOrCity: userCoords.cityName || 'Hà Nội',
    };
    if (chosen.fullAddress || chosen.name) {
      setFoodFormAddress(chosen.fullAddress || chosen.name);
    }
    if (chosen.lat != null) {
      setFoodFormLat(chosen.lat.toFixed(6));
    }
    if (chosen.lng != null) {
      setFoodFormLng(chosen.lng.toFixed(6));
    }
    if (chosen.districtOrCity) {
      if (chosen.districtOrCity.includes('Hồ Chí Minh') || chosen.districtOrCity.includes('TP.HCM')) {
        setFoodFormCity('TP. Hồ Chí Minh');
      } else if (chosen.districtOrCity.includes('Đà Nẵng')) {
        setFoodFormCity('Đà Nẵng');
      } else if (chosen.districtOrCity.includes('Hải Phòng')) {
        setFoodFormCity('Hải Phòng');
      } else if (chosen.districtOrCity.includes('Cần Thơ')) {
        setFoodFormCity('Cần Thơ');
      } else {
        setFoodFormCity('Hà Nội');
      }
    }
    if (!foodFormName.trim() && chosen.name && !chosen.name.includes('Tọa độ') && !chosen.name.includes('GPS')) {
      setFoodFormName(chosen.name);
    }
    setShowFoodMapPicker(false);
    setCopyToast('Đã chọn địa chỉ quán trên map!');
    setTimeout(() => setCopyToast(null), 2500);
  };

  // Tự động thử lấy GPS thực tế từ thiết bị khi mở trang
  useEffect(() => {
    handleRequestLocation(false);
  }, []);

  const handleRequestLocation = async (showAlert: boolean = true) => {
    setIsLocating(true);
    setGpsErrorNotice('');
    try {
      const pos = await getCurrentDevicePosition();
      setUserCoords(pos);
      try {
        localStorage.setItem('thaptaisan_exact_location', JSON.stringify(pos));
      } catch (e) {}
      const addressDisplay = pos.fullAddress || pos.cityName || 'Đã định vị thành công';
      setLocationStatus(addressDisplay);
      setIsLocating(false);
    } catch (err: any) {
      setIsLocating(false);
      if (showAlert) {
        setGpsErrorNotice('Chưa bật quyền vị trí trên trình duyệt. Bạn có thể chọn nhanh khu vực bên dưới.');
      }
    }
  };

  const handleSelectPresetLocation = (key: string) => {
    if (PRESET_LOCATIONS[key]) {
      const target = PRESET_LOCATIONS[key];
      setUserCoords(target);
      try {
        localStorage.setItem('thaptaisan_exact_location', JSON.stringify(target));
      } catch (e) {}
      setLocationStatus(target.fullAddress || target.cityName || 'Đã chọn vị trí');
      setShowExactAddressModal(false);
    }
  };

  const handleSelectExactBuilding = (b: BuildingMicroZone, unitDetail?: string) => {
    const unitPrefix = unitDetail ? `${unitDetail.trim()}, ` : '';
    const newCoords: Coordinates = {
      latitude: b.latitude,
      longitude: b.longitude,
      cityName: b.districtOrCity,
      fullAddress: `${unitPrefix}${b.fullAddress}`,
      landmark: 'Khu đô thị Thanh Hà Cienco 5',
      building: b.buildingName,
      accuracy: 5,
    };
    setUserCoords(newCoords);
    try {
      localStorage.setItem('thaptaisan_exact_location', JSON.stringify(newCoords));
    } catch (e) {}
    setLocationStatus(`Đã ghim vị trí chính xác: ${newCoords.fullAddress}`);
    setShowExactAddressModal(false);
  };

  const handleExecuteAddressSearch = async (queryText: string) => {
    if (!queryText.trim()) {
      setAddressSearchResults([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const results = await searchAddressOnMap(queryText);
      setAddressSearchResults(results);
    } catch (e) {
      setAddressSearchResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    const newCoords: Coordinates = {
      latitude: item.lat,
      longitude: item.lng,
      cityName: item.districtOrCity || item.name,
      fullAddress: item.fullAddress,
      building: item.name,
      accuracy: 10,
    };
    setUserCoords(newCoords);
    try {
      localStorage.setItem('thaptaisan_exact_location', JSON.stringify(newCoords));
    } catch (e) {}
    setLocationStatus(`Đã ghim vị trí: ${item.fullAddress}`);
    setShowExactAddressModal(false);
  };

  const handleApplyCustomUnit = (unitStr: string) => {
    if (!unitStr.trim()) return;
    const cleanUnit = unitStr.trim();
    const updatedAddress = `${cleanUnit}, ${userCoords.fullAddress || userCoords.cityName}`;
    const newCoords: Coordinates = {
      ...userCoords,
      fullAddress: updatedAddress,
      building: cleanUnit,
    };
    setUserCoords(newCoords);
    try {
      localStorage.setItem('thaptaisan_exact_location', JSON.stringify(newCoords));
    } catch (e) {}
    setLocationStatus(`Đã lưu số nhà/căn hộ: ${updatedAddress}`);
    setShowExactAddressModal(false);
  };

  // Filter and sort food places (Mặc định và ưu tiên cao nhất: từ gần nhất tới xa dần quanh bạn)
  const processedFoodPlaces = useMemo(() => {
    // 1. Khử trùng lặp ID tuyệt đối trước khi xử lý khoảng cách
    const uniquePlacesMap = new Map<string, FoodPlace>();
    for (const place of foodPlaces) {
      if (place && place.id && !uniquePlacesMap.has(place.id)) {
        uniquePlacesMap.set(place.id, place);
      }
    }
    const dedupedFoodPlaces: FoodPlace[] = Array.from(uniquePlacesMap.values());

    let list = dedupedFoodPlaces.map((place: FoodPlace) => {
      const distKm = calculateDistanceKm(
        userCoords.latitude,
        userCoords.longitude,
        place.latitude,
        place.longitude
      );
      const travelInfo = formatTravelEstimate(distKm);
      return {
        ...place,
        distanceKm: distKm,
        formattedDistance: formatDistance(distKm),
        travelInfo,
      };
    });

    // Search filter
    if (foodSearch.trim()) {
      const q = foodSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.specialtyDishes.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    // Category filter
    if (foodCategory !== 'all') {
      list = list.filter((p) => p.category === foodCategory);
    }

    // Price filter
    if (priceFilter !== 'all') {
      if (priceFilter === 'budget') {
        list = list.filter((p) => (p.approxPricePerPerson || 0) <= 60000);
      } else if (priceFilter === 'medium') {
        list = list.filter(
          (p) => (p.approxPricePerPerson || 0) > 60000 && (p.approxPricePerPerson || 0) <= 150000
        );
      } else if (priceFilter === 'high') {
        list = list.filter((p) => (p.approxPricePerPerson || 0) > 150000);
      }
    }

    // Sort (Luôn ưu tiên mặc định: Gần tôi nhất, từ quán sát vị trí bạn dần ra xa)
    list.sort((a, b) => {
      if (sortBy === 'distance') {
        return a.distanceKm - b.distanceKm;
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'price_asc') {
        return (a.approxPricePerPerson || 0) - (b.approxPricePerPerson || 0);
      }
      return a.distanceKm - b.distanceKm;
    });

    return list;
  }, [foodPlaces, userCoords, foodSearch, foodCategory, priceFilter, sortBy]);

  const handleToggleFavoriteFood = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = foodPlaces.map((p) => {
      if (p.id === id) {
        return { ...p, isFavorite: !p.isFavorite };
      }
      return p;
    });
    onUpdateFoodPlaces(updated);
  };

  const openAddFood = () => {
    setEditingFood(null);
    setFoodFormName('');
    setFoodFormCategory('noodles');
    setFoodFormSpecialty('');
    setFoodFormPriceRange('40.000đ - 70.000đ');
    setFoodFormApproxPrice('50000');
    setFoodFormAddress(userCoords.fullAddress || userCoords.building || '');
    setFoodFormCity(userCoords.cityName || 'Hà Nội');
    setFoodFormPhone('');
    setFoodFormOpening('07:00 - 22:00');
    setFoodFormRating(5.0);
    setFoodFormTags('Quán ngon, Quán ruột');
    setFoodFormNote('');
    setFoodFormLat(userCoords.latitude ? userCoords.latitude.toFixed(6) : '');
    setFoodFormLng(userCoords.longitude ? userCoords.longitude.toFixed(6) : '');
    setShowAddFoodModal(true);
  };

  const openEditFood = (place: FoodPlace, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFood(place);
    setFoodFormName(place.name);
    setFoodFormCategory(place.category);
    setFoodFormSpecialty(place.specialtyDishes);
    setFoodFormPriceRange(place.priceRange);
    setFoodFormApproxPrice(place.approxPricePerPerson ? String(place.approxPricePerPerson) : '');
    setFoodFormAddress(place.address);
    setFoodFormCity(place.city || 'Hà Nội');
    setFoodFormPhone(place.phone || '');
    setFoodFormOpening(place.openingHours || '');
    setFoodFormRating(place.rating || 5.0);
    setFoodFormTags(place.tags ? place.tags.join(', ') : '');
    setFoodFormNote(place.note || '');
    setFoodFormLat(String(place.latitude));
    setFoodFormLng(String(place.longitude));
    setShowAddFoodModal(true);
  };

  const handleSaveFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodFormName.trim()) return;

    const tagsArr = foodFormTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newPlace: FoodPlace = {
      id: editingFood ? editingFood.id : `food_${Date.now()}`,
      name: foodFormName.trim(),
      category: foodFormCategory,
      specialtyDishes: foodFormSpecialty.trim(),
      priceRange: foodFormPriceRange.trim() || 'Thỏa thuận',
      approxPricePerPerson: foodFormApproxPrice ? Number(foodFormApproxPrice) : undefined,
      address: foodFormAddress.trim(),
      city: foodFormCity,
      latitude: Number(foodFormLat) || userCoords.latitude,
      longitude: Number(foodFormLng) || userCoords.longitude,
      phone: foodFormPhone.trim() || undefined,
      openingHours: foodFormOpening.trim() || undefined,
      rating: Number(foodFormRating) || 5.0,
      tags: tagsArr.length > 0 ? tagsArr : undefined,
      note: foodFormNote.trim() || undefined,
      isCustom: true,
      isFavorite: editingFood ? editingFood.isFavorite : false,
      createdAt: editingFood?.createdAt || new Date().toISOString(),
    };

    let updated: FoodPlace[];
    if (editingFood) {
      updated = foodPlaces.map((x) => (x.id === editingFood.id ? newPlace : x));
    } else {
      updated = [newPlace, ...foodPlaces];
    }

    onUpdateFoodPlaces(updated);
    setShowAddFoodModal(false);
  };

  const handleDeleteFood = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa quán ăn này khỏi danh sách?')) {
      const updated = foodPlaces.filter((x) => x.id !== id);
      onUpdateFoodPlaces(updated);
      if (selectedFoodPlace?.id === id) {
        setSelectedFoodPlace(null);
      }
    }
  };

  // Helper badge for event types
  const getEventBadge = (type: LifeEventType) => {
    switch (type) {
      case 'birthday':
        return {
          icon: <Cake className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Sinh nhật',
          color: 'text-rose-700 bg-rose-50 border-rose-200',
        };
      case 'anniversary_death':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-amber-600" />,
          label: 'Ngày giỗ',
          color: 'text-amber-800 bg-amber-50 border-amber-200',
        };
      case 'holiday':
        return {
          icon: <Flag className="w-3.5 h-3.5 text-red-600" />,
          label: 'Nghỉ lễ',
          color: 'text-red-700 bg-red-50 border-red-200',
        };
      case 'family':
        return {
          icon: <Users className="w-3.5 h-3.5 text-emerald-600" />,
          label: 'Gia đình',
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        };
      default:
        return {
          icon: <Briefcase className="w-3.5 h-3.5 text-blue-600" />,
          label: 'Công việc',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
        };
    }
  };

  const getCategoryLabel = (cat: FoodCategory) => {
    switch (cat) {
      case 'noodles':
        return 'Bún • Phở';
      case 'rice':
        return 'Cơm';
      case 'hotpot_bbq':
        return 'Lẩu & Nướng';
      case 'seafood':
        return 'Hải sản';
      case 'coffee_dessert':
        return 'Cà phê';
      case 'casual':
        return 'Ăn vặt';
      case 'fine_dining':
        return 'Tiệc/Nhà hàng';
      default:
        return 'Món ngon';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      {/* Top Banner & Main Sub-tab Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
              Tiện Ích & Đời Sống
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 whitespace-nowrap">
              Gia đình • Bản đồ quán
            </span>
          </div>

          {/* Segmented Switcher for Main Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none whitespace-nowrap ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lịch & Sự Kiện</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono">
                {lifeEvents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('food')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none whitespace-nowrap ${
                activeSubTab === 'food'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
              <span>Quán Ăn & Định Vị</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-mono">
                {foodPlaces.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB 1: LỊCH & SỰ KIỆN GIA ĐÌNH                         */}
      {/* ========================================================= */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Category Filters, View Switcher & Add Button */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Tìm sự kiện, ngày giỗ, sinh nhật người thân..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Time scope filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={eventTimeRange}
                  onChange={(e) => setEventTimeRange(e.target.value as any)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="30days">Trong 30 ngày tới</option>
                  <option value="90days">Trong 90 ngày tới</option>
                  <option value="this_year">Trong năm nay ({today.getFullYear()})</option>
                </select>

                {/* View switcher: Danh sách (mặc định) vs Lưới lịch tháng */}
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCalViewMode('list')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                      calViewMode === 'list'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng danh sách trực quan, dễ thao tác"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Danh sách</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalViewMode('grid')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                      calViewMode === 'grid'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Xem dạng bảng lưới lịch tháng"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Lịch tháng</span>
                  </button>
                </div>

                {/* Add Event Button */}
                <button
                  type="button"
                  onClick={() => openAddEvent()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm sự kiện</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Categories */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả', count: lifeEvents.length },
                  {
                    id: 'anniversary_death',
                    label: '🕯️ Ngày giỗ',
                    count: lifeEvents.filter((x) => x.type === 'anniversary_death').length,
                  },
                  {
                    id: 'birthday',
                    label: '🎂 Sinh nhật',
                    count: lifeEvents.filter((x) => x.type === 'birthday').length,
                  },
                  {
                    id: 'holiday',
                    label: '🇻🇳 Nghỉ lễ',
                    count: lifeEvents.filter((x) => x.isNationalHoliday).length,
                  },
                  {
                    id: 'family',
                    label: '👨‍👩‍👧 Gia đình',
                    count: lifeEvents.filter((x) => x.type === 'family').length,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEventFilter(f.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                    eventFilter === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                      eventFilter === f.id ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* CALENDAR VIEW MODE 1: COMPACT LIST VIEW (DANH SÁCH DỄ NHÌN) */}
          {/* ========================================================= */}
          {calViewMode === 'list' && (
            <div className="space-y-2.5">
              {filteredEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center">
                  <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">Không có sự kiện nào phù hợp</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Hãy thử đổi bộ lọc hoặc bấm nút "Thêm sự kiện" để tạo mốc thời gian mới!
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
                  {/* Table Header on sm+ */}
                  <div className="hidden sm:flex items-center justify-between px-3.5 py-2 bg-slate-50/90 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Sự Kiện & Mốc Thời Gian</span>
                    </div>
                    <div className="flex items-center gap-8 pr-2">
                      <span>Lịch Dương / Âm</span>
                      <span>Đếm Ngược</span>
                      <span>Thao Tác</span>
                    </div>
                  </div>

                  {filteredEvents.map((item) => {
                    const badge = getEventBadge(item.event.type);
                    const isToday = item.daysRemaining === 0;
                    const isVeryClose = item.daysRemaining > 0 && item.daysRemaining <= 3;
                    const isWithinWeek = item.daysRemaining > 3 && item.daysRemaining <= 7;

                    return (
                      <div
                        key={item.event.id}
                        className={`px-3 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 transition ${
                          isToday ? 'bg-red-50/60' : isVeryClose ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        {/* Left Info: Icon, Title, Person, Holiday, Dual Dates & Note */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Mini Type Icon */}
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border ${badge.color}`}
                          >
                            {badge.icon}
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Line 1: Title, Person, Holiday */}
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {item.event.title}
                              </span>
                              {item.event.personName && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                  {item.event.personName}
                                </span>
                              )}
                              {item.event.isNationalHoliday && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200 whitespace-nowrap shrink-0">
                                  Nghỉ Lễ
                                </span>
                              )}
                            </div>

                            {/* Line 2 (Compact inline): Solar & Lunar dates + optional note */}
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-mono flex-wrap sm:flex-nowrap">
                              <span className="font-bold text-slate-700 whitespace-nowrap">
                                DL: {item.solarStr}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-amber-800 whitespace-nowrap">
                                ÂL: {item.lunarStr}
                              </span>
                              {item.event.note && (
                                <>
                                  <span className="text-slate-300 hidden md:inline">•</span>
                                  <span className="text-slate-400 font-sans truncate max-w-[240px] hidden md:inline">
                                    {item.event.note}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Countdown Badge + Compact Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Countdown Badge */}
                          <span
                            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap tabular-nums shadow-2xs ${
                              isToday
                                ? 'bg-red-600 text-white animate-pulse'
                                : isVeryClose
                                ? 'bg-amber-500 text-white'
                                : isWithinWeek
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isToday
                              ? '🔥 Hôm nay!'
                              : item.daysRemaining === 1
                              ? '⚡ Ngày mai'
                              : `Còn ${item.daysRemaining} ngày`}
                          </span>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openEditEvent(item.event)}
                              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa sự kiện"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(item.event.id)}
                              className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa sự kiện"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* CALENDAR VIEW MODE 2: MONTHLY GRID (LƯỚI LỊCH THÁNG)     */}
          {/* ========================================================= */}
          {calViewMode === 'grid' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-5 space-y-3">
              {/* Calendar Month Navigation Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Tháng {calMonth} / {calYear}
                  </h3>
                  <button
                    type="button"
                    onClick={handleResetToToday}
                    className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded cursor-pointer transition"
                  >
                    Hôm nay
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                    title="Tháng sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day of week labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-bold text-slate-500 py-1">
                <span>Th 2</span>
                <span>Th 3</span>
                <span>Th 4</span>
                <span>Th 5</span>
                <span>Th 6</span>
                <span className="text-blue-600">Th 7</span>
                <span className="text-rose-600">CN</span>
              </div>

              {/* Calendar Day Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((item) => {
                  if (item.empty) {
                    return <div key={item.key} className="h-14 sm:h-18 bg-slate-50/40 rounded-lg"></div>;
                  }

                  const hasEvent = item.events && item.events.length > 0;
                  const hasHoliday = item.events && item.events.some((x) => x.isNationalHoliday);
                  const hasDeath = item.events && item.events.some((x) => x.type === 'anniversary_death');
                  const hasBirthday = item.events && item.events.some((x) => x.type === 'birthday');

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setSelectedDate({ day: item.day!, month: calMonth, year: calYear })
                      }
                      className={`h-14 sm:h-18 p-1 rounded-xl flex flex-col justify-between items-center transition cursor-pointer relative border select-none ${
                        item.isSelected
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                          : item.isToday
                          ? 'bg-blue-50/70 border-blue-400 font-bold'
                          : hasEvent
                          ? 'bg-white border-slate-200 hover:border-slate-400'
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-black font-mono tabular-nums leading-none ${
                            item.isToday
                              ? 'text-blue-700'
                              : hasHoliday
                              ? 'text-red-600'
                              : 'text-slate-800'
                          }`}
                        >
                          {item.day}
                        </span>

                        {hasEvent && (
                          <div className="flex items-center gap-0.5">
                            {hasHoliday && <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>}
                            {hasDeath && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                            {hasBirthday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                          </div>
                        )}
                      </div>

                      {/* Lunar Day Display */}
                      <div className="w-full text-center">
                        <span
                          className={`text-[8.5px] sm:text-[10px] font-mono leading-none block truncate ${
                            item.lunar?.day === 1 || item.lunar?.day === 15
                              ? 'text-red-600 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.lunar?.day === 1
                            ? `${item.lunar.day}/${item.lunar.month}`
                            : item.lunar?.day}
                        </span>
                      </div>

                      <div className="w-full min-h-[10px]">
                        {hasEvent && (
                          <div className="hidden sm:block text-[8px] font-medium text-emerald-800 truncate text-left px-0.5">
                            {item.events![0].title}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Event Drawer */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800">
                    Sự kiện ngày {selectedDate.day}/{selectedDate.month}/{selectedDate.year} (
                    {convertSolarToLunar(selectedDate.day, selectedDate.month, selectedDate.year).day}/
                    {convertSolarToLunar(selectedDate.day, selectedDate.month, selectedDate.year).month} ÂL)
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddEvent(selectedDate)}
                    className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    + Thêm vào ngày này
                  </button>
                </div>

                {eventsOnSelectedDate.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400">
                    Không có sự kiện đặc biệt trong ngày này.
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {eventsOnSelectedDate.map((ev) => {
                      const badge = getEventBadge(ev.type);
                      return (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">{badge.icon}</span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{ev.title}</div>
                              {ev.note && <div className="text-[10px] text-slate-500 truncate">{ev.note}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => openEditEvent(ev)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                              title="Sửa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 2: QUÁN ĂN NGON & BẢN ĐỒ CHỈ ĐƯỜNG                */}
      {/* ========================================================= */}
      {activeSubTab === 'food' && (
        <div className="space-y-4">
          {/* Top Clean Location & Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3">
            {/* Hàng 1: Vị trí của bạn & Thao tác định vị */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Vị trí của bạn:
                    </span>
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {userCoords.building || userCoords.cityName || 'Vị trí hiện tại'}
                    </span>
                    {userCoords.accuracy ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        🛰️ GPS thực tế thiết bị (~{Math.round(userCoords.accuracy)}m)
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1" title="Hệ thống đang hiển thị vị trí mẫu mặc định. Bấm nút 'Định vị GPS' để lấy vị trí thực tế của bạn.">
                        <span>📍 Vị trí mẫu mặc định (Chưa bật GPS)</span>
                      </span>
                    )}
                  </div>
                  {userCoords.fullAddress && (
                    <div className="text-xs text-slate-600 truncate max-w-lg mt-0.5 font-medium" title={userCoords.fullAddress}>
                      {userCoords.fullAddress}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                    <span>Tọa độ: {userCoords.latitude.toFixed(5)}, {userCoords.longitude.toFixed(5)}</span>
                    {!userCoords.accuracy && (
                      <span className="text-amber-700 font-sans font-medium text-[10px]">
                        • Bấm "Định vị GPS" bên cạnh để cập nhật vị trí thực tế
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nút hành động định vị & đổi vị trí */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRequestLocation(true)}
                  disabled={isLocating}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-98 disabled:opacity-50 shadow-2xs ${
                    !userCoords.accuracy
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                  }`}
                  title="Định vị GPS chính xác vị trí thiết bị hiện tại của bạn"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Đang dò GPS...' : 'Định vị GPS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddressSearchInput('');
                    setAddressSearchResults([]);
                    setShowExactAddressModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Đổi địa chỉ hoặc chọn khu vực khác"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Đổi vị trí</span>
                </button>

                <a
                  href={getGoogleMapsMyLocationUrl(userCoords.latitude, userCoords.longitude, userCoords.building || userCoords.fullAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-semibold transition"
                  title="Mở xem chính xác vị trí của bạn trên Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Kiểm tra trên Google Maps</span>
                </a>
              </div>
            </div>

            {/* Hàng 1.2: Nhập địa chỉ đang có thật trên Google Maps để định vị */}
            <div className="relative bg-emerald-50/60 p-2.5 sm:p-3 rounded-xl border border-emerald-200/80">
              <form onSubmit={handleQuickAddressSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 shrink-0">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span>Nhập địa chỉ thật trên Google Maps để định vị:</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={quickAddressInput}
                    onChange={(e) => handleQuickAddressChange(e.target.value)}
                    onFocus={() => {
                      if (quickSuggestions.length > 0) setShowQuickDropdown(true);
                    }}
                    placeholder="VD: HH02-2A Thanh Hà, Kiot 12 HH03B, B1.4 LK16, 13 Lò Đúc, Phố Cổ..."
                    className="w-full px-3 py-1.5 pr-8 bg-white border border-emerald-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  {quickAddressInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddressInput('');
                        setQuickSuggestions([]);
                        setShowQuickDropdown(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="submit"
                    disabled={isQuickSearching || !quickAddressInput.trim()}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                  >
                    <Search className={`w-3.5 h-3.5 ${isQuickSearching ? 'animate-spin' : ''}`} />
                    <span>{isQuickSearching ? 'Đang dò...' : 'Định vị ngay'}</span>
                  </button>
                </div>
              </form>

              {/* Suggestions Dropdown */}
              {showQuickDropdown && quickSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Gợi ý địa chỉ chuẩn xác trên Google Maps:</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickDropdown(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                    >
                      Đóng
                    </button>
                  </div>
                  {quickSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectQuickSuggestion(item)}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 transition flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.fullAddress}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                        Chọn vị trí này
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hàng 1.8: KHÁM PHÁ & TÌM KIẾM QUÁN ĂN TRỰC TIẾP TRÊN GOOGLE MAPS THEO ĐỊNH VỊ CỦA TÔI */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 rounded-2xl border border-emerald-200/90 p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                      <Compass className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Khám Phá Quán Ăn Trực Tiếp Trên Google Maps
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    Định vị hiện tại: <span className="font-bold text-slate-900">{userCoords.building || userCoords.cityName || 'Vị trí của bạn'}</span> ({userCoords.latitude.toFixed(4)}, {userCoords.longitude.toFixed(4)}). Bạn có thể tự do tìm kiếm mọi quán ăn, nhà hàng xung quanh trực tiếp trên Google Maps mà không cần list sẵn vào app.
                  </p>
                </div>

                {/* Nút lớn: Mở Google Maps tìm quán ăn gần tôi */}
                <a
                  href={`https://www.google.com/maps/search/quán+ăn+ngon/@${userCoords.latitude},${userCoords.longitude},15z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                  title="Mở Google Maps tìm quán ăn ngon quanh vị trí hiện tại"
                >
                  <Navigation className="w-4 h-4 shrink-0" />
                  <span>Mở Google Maps Tìm Quán Gần Tôi</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>

              {/* Các nút khám phá nhanh theo thể loại ẩm thực trên Google Maps */}
              <div className="pt-2 border-t border-emerald-200/60">
                <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tìm nhanh món ăn quanh vị trí GPS trên Google Maps:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { label: '🍜 Phở & Bún', query: 'quán phở bún ngon' },
                    { label: '🍚 Cơm Tấm / Cơm Niêu', query: 'quán cơm niêu cơm tấm ngon' },
                    { label: '🍲 Lẩu & Nướng BBQ', query: 'quán lẩu nướng bbq ngon' },
                    { label: '☕ Cà Phê & Trà', query: 'quán cafe đẹp gần đây' },
                    { label: '🦞 Hải Sản Tươi Sống', query: 'nhà hàng hải sản tươi sống' },
                    { label: '🍻 Quán Nhậu & Bia Hơi', query: 'quán nhậu bia hơi' },
                    { label: '🥐 Ăn Vặt & Bánh Mì', query: 'quán ăn vặt bánh mì ngon' },
                    { label: '🥗 Ăn Chay', query: 'quán ăn chay ngon' },
                  ].map((item, idx) => (
                    <a
                      key={idx}
                      href={`https://www.google.com/maps/search/${encodeURIComponent(item.query)}/@${userCoords.latitude},${userCoords.longitude},15z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 text-xs font-semibold border border-emerald-200/80 shadow-2xs transition whitespace-nowrap"
                    >
                      <span>{item.label}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Hàng 2: BỘ SƯU TẬP QUÁN ĂN NGON CỦA TÔI (TỰ LIST VÀO APP) */}
            <div className="pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
                      Bộ Sưu Tập Quán Ăn Ngon Của Tôi ({processedFoodPlaces.length})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quán ngon bạn tự lưu vào app. <b className="text-emerald-700">Bấm vào bất kỳ quán nào</b> để tự động chuyển sang Google Maps dẫn đường di chuyển.
                  </p>
                </div>

                {foodPlaces.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={openAddFood}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 whitespace-nowrap"
                      title="Thêm quán ăn ngon mới vào bộ sưu tập của tôi"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm quán</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllFoodPlaces}
                      className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                      title="Làm trống danh sách quán ăn cá nhân"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                      <span>Làm trống</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tìm kiếm, lọc và chuyển đổi xem danh sách */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-1">
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={foodSearch}
                      onChange={(e) => setFoodSearch(e.target.value)}
                      placeholder="Tìm trong quán của tôi (tên quán, món ăn, địa chỉ)..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                    {foodSearch && (
                      <button
                        type="button"
                        onClick={() => setFoodSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category select */}
                  <select
                    value={foodCategory}
                    onChange={(e) => setFoodCategory(e.target.value as FoodCategory)}
                    className="w-32 sm:w-40 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 truncate"
                  >
                    <option value="all">Tất cả món</option>
                    <option value="noodles">Bún • Phở • Mì</option>
                    <option value="rice">Cơm tấm • Cơm niêu</option>
                    <option value="hotpot_bbq">Lẩu & Nướng</option>
                    <option value="seafood">Hải sản</option>
                    <option value="casual">Ăn vặt • Bánh mì</option>
                    <option value="coffee_dessert">Cà phê • Trà</option>
                  </select>

                  {/* Sort select */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-28 sm:w-32 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 truncate hidden xs:block"
                  >
                    <option value="distance">Gần nhất</option>
                    <option value="rating">Đánh giá cao</option>
                    <option value="price_asc">Giá rẻ nhất</option>
                  </select>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end">
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFoodViewMode('compact_list')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        foodViewMode === 'compact_list'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Xem dạng bảng dòng gọn gàng"
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Bảng gọn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFoodViewMode('list')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        foodViewMode === 'list'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Xem dạng thẻ chi tiết"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Dạng thẻ</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* FOOD VIEW MODE 1: COMPACT LIST VIEW (DANH SÁCH BẢNG GỌN)   */}
          {/* ========================================================= */}
          {foodViewMode === 'compact_list' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {/* Table Header on sm+ */}
              <div className="hidden sm:flex items-center justify-between px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span>Quán Ăn & Món Đặc Trưng (Bấm vào để mở Google Maps dẫn đường)</span>
                </div>
                <div className="flex items-center gap-6 pr-2">
                  <span>Khoảng Cách</span>
                  <span>Chỉ Đường & Thao Tác</span>
                </div>
              </div>

              {processedFoodPlaces.length === 0 ? (
                <div className="py-12 px-4 text-center bg-white p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">
                      {foodSearch ? 'Không tìm thấy quán ăn nào phù hợp' : 'Chưa có quán ăn nào trong bộ sưu tập cá nhân'}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {foodSearch
                        ? 'Hãy thử đổi từ khóa tìm kiếm hoặc bấm nút "Thêm Quán Ngon" để lưu địa điểm mới.'
                        : 'Bạn có thể tự tìm kiếm quán ăn trên Google Maps (ở phần phía trên). Khi tìm được quán ưng ý hoặc có quán ruột, hãy bấm "Thêm Quán Ngon" để lưu vào app. Bất kỳ lúc nào cần đi ăn, bạn chỉ cần bấm vào quán trong app để mở Google Maps dẫn đường!'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={openAddFood}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Thêm Quán Ngon Của Tôi</span>
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/quán+ăn+ngon/@${userCoords.latitude},${userCoords.longitude},15z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-semibold transition"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Tìm Quán Quanh Tôi Trên Google Maps</span>
                    </a>
                    {foodPlaces.length === 0 && (
                      <button
                        type="button"
                        onClick={handleLoadSamplePlaces}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Nạp 3 quán mẫu tham khảo</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                processedFoodPlaces.map((place, idx) => {
                  const originAddress = userCoords.building
                    ? `${userCoords.building} - ${userCoords.fullAddress || userCoords.cityName}`
                    : (userCoords.fullAddress || userCoords.cityName || `${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}`);
                  const directionsUrl = getGoogleMapsDirectionsUrl(
                    place.latitude,
                    place.longitude,
                    place.address,
                    userCoords.latitude,
                    userCoords.longitude,
                    place.name,
                    originAddress
                  );
                  const placeGoogleMapsUrl = getGoogleMapsPlaceSearchUrl(
                    place.name,
                    place.address,
                    place.latitude,
                    place.longitude
                  );

                  return (
                    <div
                      key={`${place.id}-${idx}`}
                      onClick={() => window.open(directionsUrl, '_blank')}
                      className="px-3 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 hover:bg-emerald-50/50 cursor-pointer transition group border-l-4 border-l-transparent hover:border-l-emerald-500"
                      title={`👉 Bấm vào để mở Google Maps dẫn đường di chuyển tới "${place.name}"!`}
                    >
                      {/* Left: Category Icon + Details */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Category Mini Badge */}
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 text-xs font-bold group-hover:scale-105 transition">
                          {getCategoryLabel(place.category).charAt(0)}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Line 1: Name, Rating, Distance & Travel Estimate */}
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 transition truncate">
                              {place.name}
                            </span>
                            {place.rating && (
                              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {place.rating.toFixed(1)}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono whitespace-nowrap shrink-0 ${
                                place.travelInfo?.isSuperClose
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black'
                                  : place.travelInfo?.isNearby
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {place.travelInfo?.badgeText || `📍 ${place.formattedDistance}`}
                            </span>
                            {place.travelInfo?.timeEstimate && (
                              <span className="text-[10px] font-semibold text-emerald-700 hidden sm:inline whitespace-nowrap">
                                ({place.travelInfo.timeEstimate})
                              </span>
                            )}
                          </div>

                          {/* Line 2: Specialty dish • Price • Address */}
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap sm:flex-nowrap">
                            <span className="text-amber-900 font-semibold truncate max-w-[150px] sm:max-w-xs whitespace-nowrap">
                              {place.specialtyDishes}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono font-bold text-slate-700 whitespace-nowrap">
                              {place.priceRange}
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-slate-600 truncate max-w-[260px] lg:max-w-md hidden sm:inline" title={place.address}>
                              📍 {place.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Directions & Clean Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Nút 1: Chỉ đường Google Maps */}
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs select-none active:scale-95 whitespace-nowrap"
                          title={`Chỉ đường dẫn lối GPS tới quán ${place.name}`}
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Dẫn đường Google Maps</span>
                        </a>

                        {/* Nút 2: Mở xem hồ sơ trên Google Maps */}
                        <a
                          href={placeGoogleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition whitespace-nowrap"
                          title={`Xem quán "${place.name}" trên Google Maps`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          <span>Maps</span>
                        </a>

                        {/* Nút 3: Sao chép địa chỉ */}
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(place.address, place.name)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                          title="Sao chép tên quán & địa chỉ chính xác"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title={`Gọi điện: ${place.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleToggleFavoriteFood(place.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title={place.isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              place.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => openEditFood(place, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteFood(place.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Xóa quán khỏi danh sách"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* FOOD VIEW MODE 2: CARD LIST VIEW (DANH SÁCH THẺ DỄ NHÌN)   */}
          {/* ========================================================= */}
          {foodViewMode === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {processedFoodPlaces.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6 space-y-3">
                  <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-700">
                      {foodSearch ? 'Không tìm thấy quán ăn phù hợp' : 'Chưa có quán ăn nào trong bộ sưu tập'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Bấm nút "Thêm Quán Ngon Của Tôi" để nhập quán ăn ruột của bạn, hoặc tìm kiếm quán ăn xung quanh trên Google Maps!
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={openAddFood}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      + Thêm Quán Ngon Của Tôi
                    </button>
                    {foodPlaces.length === 0 && (
                      <button
                        type="button"
                        onClick={handleLoadSamplePlaces}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Nạp 3 quán mẫu tham khảo
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                processedFoodPlaces.map((place, idx) => {
                  const originAddress = userCoords.building
                    ? `${userCoords.building} - ${userCoords.fullAddress || userCoords.cityName}`
                    : (userCoords.fullAddress || userCoords.cityName || `${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}`);
                  const directionsUrl = getGoogleMapsDirectionsUrl(
                    place.latitude,
                    place.longitude,
                    place.address,
                    userCoords.latitude,
                    userCoords.longitude,
                    place.name,
                    originAddress
                  );
                  const placeGoogleMapsUrl = getGoogleMapsPlaceSearchUrl(
                    place.name,
                    place.address,
                    place.latitude,
                    place.longitude
                  );

                  return (
                    <div
                      key={`${place.id}-${idx}`}
                      onClick={() => window.open(directionsUrl, '_blank')}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all duration-200 p-3.5 sm:p-4 flex flex-col justify-between group"
                      title={`👉 Bấm vào để mở Google Maps dẫn đường di chuyển tới "${place.name}"!`}
                    >
                      <div>
                        {/* Card Header: Name + Favorite */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 transition truncate leading-snug">
                              {place.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {place.rating && (
                                <div className="flex items-center gap-0.5 text-amber-500 text-[10px] font-bold shrink-0">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{place.rating.toFixed(1)}</span>
                                </div>
                              )}
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono whitespace-nowrap shrink-0 ${
                                  place.travelInfo?.isSuperClose
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black'
                                    : place.travelInfo?.isNearby
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {place.travelInfo?.badgeText || `📍 ${place.formattedDistance}`}
                              </span>
                              {place.travelInfo?.timeEstimate && (
                                <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                  ({place.travelInfo.timeEstimate})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Favorite button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavoriteFood(place.id, e)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer shrink-0"
                            title={place.isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                place.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Specialty Dish */}
                        <div className="mt-2 p-1.5 rounded-lg bg-amber-50/70 border border-amber-200/70">
                          <div className="text-[9px] text-amber-900/80 font-bold uppercase tracking-wider">
                            Món ngon tủ:
                          </div>
                          <div className="text-xs font-bold text-amber-950 mt-0.5 truncate">
                            {place.specialtyDishes}
                          </div>
                        </div>

                        {/* Metadata: Price & Address */}
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-[10px] text-slate-500">Giá sơ bộ:</span>
                            <span className="font-bold text-slate-800 font-mono tabular-nums text-xs">
                              {place.priceRange}
                            </span>
                          </div>

                          <div className="flex items-start gap-1 text-[11px] text-slate-600 line-clamp-2" title={place.address}>
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>{place.address}</span>
                          </div>

                          {place.openingHours && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">Mở cửa: {place.openingHours}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions: Clean, Prominent Navigation & Action Buttons */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {/* Nút 1: Chỉ đường Google Maps */}
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs select-none active:scale-95 whitespace-nowrap"
                          title={`Chỉ đường Google Maps tới quán ${place.name}`}
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Dẫn đường Google Maps</span>
                        </a>

                        {/* Nút 2: Mở xem quán trên Google Maps */}
                        <a
                          href={placeGoogleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[36px] flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition whitespace-nowrap"
                          title={`Xem quán "${place.name}" trên Google Maps`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          <span>Maps</span>
                        </a>

                        {/* Nút 3: Sao chép địa chỉ */}
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(place.address, place.name)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                          title="Sao chép địa chỉ"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title={`Gọi điện: ${place.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => openEditFood(place, e)}
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteFood(place.id, e)}
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Xóa quán"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: THÊM / SỬA SỰ KIỆN LỊCH                            */}
      {/* ========================================================= */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                {editingEvent ? 'Chỉnh Sửa Sự Kiện' : 'Thêm Mốc Thời Gian Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEventModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên sự kiện / Ngày kỷ niệm *
                </label>
                <input
                  type="text"
                  required
                  value={eventFormTitle}
                  onChange={(e) => setEventFormTitle(e.target.value)}
                  placeholder="VD: Giỗ Bác Hai, Sinh nhật Mẹ, Đi nghỉ mát..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại sự kiện</label>
                  <select
                    value={eventFormType}
                    onChange={(e) => setEventFormType(e.target.value as LifeEventType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="anniversary_death">🕯️ Ngày giỗ</option>
                    <option value="birthday">🎂 Sinh nhật</option>
                    <option value="holiday">🇻🇳 Nghỉ lễ</option>
                    <option value="family">👨‍👩‍👧 Gia đình</option>
                    <option value="work">💼 Công việc</option>
                    <option value="other">📌 Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hệ lịch tính toán</label>
                  <select
                    value={eventFormIsLunar ? 'lunar' : 'solar'}
                    onChange={(e) => setEventFormIsLunar(e.target.value === 'lunar')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="solar">☀️ Dương lịch</option>
                    <option value="lunar">🌙 Âm lịch (Truyền thống)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày (1 - 31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={eventFormDay}
                    onChange={(e) => setEventFormDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tháng (1 - 12)</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={eventFormMonth}
                    onChange={(e) => setEventFormMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm gốc (Tùy chọn)</label>
                  <input
                    type="number"
                    placeholder="VD: 1965"
                    value={eventFormYear}
                    onChange={(e) => setEventFormYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người liên quan</label>
                <input
                  type="text"
                  value={eventFormPerson}
                  onChange={(e) => setEventFormPerson(e.target.value)}
                  placeholder="VD: Bố, Mẹ, Con trai, Ông Nội..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú / Nhắc việc</label>
                <textarea
                  rows={2}
                  value={eventFormNote}
                  onChange={(e) => setEventFormNote(e.target.value)}
                  placeholder="VD: Mua quà sinh nhật, chuẩn bị mâm cỗ giỗ trước 1 ngày..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                ></textarea>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventFormRepeat}
                    onChange={(e) => setEventFormRepeat(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">Lặp lại hàng năm</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventFormIsHoliday}
                    onChange={(e) => setEventFormIsHoliday(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">Nghỉ lễ nhà nước</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
                >
                  Lưu sự kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: THÊM / SỬA QUÁN ĂN NGON                            */}
      {/* ========================================================= */}
      {showAddFoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                {editingFood ? 'Chỉnh Sửa Quán Ăn' : 'Thêm Quán Ăn / Món Ngon Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddFoodModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFood} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên quán ăn / Nhà hàng *</label>
                <input
                  type="text"
                  required
                  value={foodFormName}
                  onChange={(e) => setFoodFormName(e.target.value)}
                  placeholder="VD: Phở Bát Đàn, Cơm tấm Ba Ghiền..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thể loại món</label>
                  <select
                    value={foodFormCategory}
                    onChange={(e) => setFoodFormCategory(e.target.value as FoodCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="noodles">Bún • Phở • Mì</option>
                    <option value="rice">Cơm tấm • Cơm niêu</option>
                    <option value="hotpot_bbq">Lẩu & Nướng</option>
                    <option value="seafood">Hải sản & Cá</option>
                    <option value="coffee_dessert">Cà phê & Tráng miệng</option>
                    <option value="casual">Ăn vặt & Bánh mì</option>
                    <option value="fine_dining">Tiệc & Tiếp khách</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thành phố</label>
                  <select
                    value={foodFormCity}
                    onChange={(e) => setFoodFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Món ngon đặc sắc (Nổi bật nhất nên thử) *
                </label>
                <input
                  type="text"
                  required
                  value={foodFormSpecialty}
                  onChange={(e) => setFoodFormSpecialty(e.target.value)}
                  placeholder="VD: Phở bò tái lăn nhiều hành hoa, quẩy giòn rụm..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khoảng giá hiển thị</label>
                  <input
                    type="text"
                    value={foodFormPriceRange}
                    onChange={(e) => setFoodFormPriceRange(e.target.value)}
                    placeholder="VD: 45.000đ - 70.000đ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giá trung bình/người (VNĐ)</label>
                  <input
                    type="number"
                    value={foodFormApproxPrice}
                    onChange={(e) => setFoodFormApproxPrice(e.target.value)}
                    placeholder="VD: 60000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <label className="font-semibold text-slate-700 text-xs sm:text-sm">
                    Địa chỉ chi tiết quán *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleFillCurrentLocationToFoodForm}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer"
                      title="Lấy địa chỉ & tọa độ của bạn hiện tại"
                    >
                      <LocateFixed className="w-3 h-3 text-emerald-600" />
                      <span>Vị trí hiện tại</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenFoodMapPicker}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition cursor-pointer"
                      title="Tìm và chọn địa chỉ trên bản đồ"
                    >
                      <MapIcon className="w-3 h-3 text-emerald-600" />
                      <span>Chọn trên map</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={foodFormAddress}
                  onChange={(e) => setFoodFormAddress(e.target.value)}
                  placeholder="VD: Số 12 ngõ 45 Kim Mã, Ba Đình, Hà Nội"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vĩ độ (Latitude)</label>
                  <input
                    type="text"
                    value={foodFormLat}
                    onChange={(e) => setFoodFormLat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kinh độ (Longitude)</label>
                  <input
                    type="text"
                    value={foodFormLng}
                    onChange={(e) => setFoodFormLng(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={foodFormPhone}
                    onChange={(e) => setFoodFormPhone(e.target.value)}
                    placeholder="VD: 0988123456"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giờ mở cửa</label>
                  <input
                    type="text"
                    value={foodFormOpening}
                    onChange={(e) => setFoodFormOpening(e.target.value)}
                    placeholder="VD: 07:00 - 22:00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Từ khóa / Tiện ích (cách nhau bởi dấu phẩy)
                </label>
                <input
                  type="text"
                  value={foodFormTags}
                  onChange={(e) => setFoodFormTags(e.target.value)}
                  placeholder="VD: Có chỗ đỗ ô tô, Máy lạnh, Gia đình..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
                <textarea
                  rows={2}
                  value={foodFormNote}
                  onChange={(e) => setFoodFormNote(e.target.value)}
                  placeholder="VD: Nên đi trước 12h trưa để tránh hết bàn..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddFoodModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
                >
                  Lưu quán ăn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHỌN ĐỊA CHỈ TRÊN MAP CHO QUÁN ĂN                  */}
      {/* ========================================================= */}
      {showFoodMapPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <MapIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                    Chọn Địa Chỉ Trên Map
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tìm kiếm địa chỉ quán hoặc chọn vị trí trên bản đồ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFoodMapPicker(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Search Box */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 text-xs">
                  Tìm tên quán, số nhà, đường phố hoặc tọa độ:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={foodMapSearchQuery}
                    onChange={(e) => handleFoodMapSearchChange(e.target.value)}
                    placeholder="VD: 13 Lò Đúc, Phở Bát Đàn, HH02 Thanh Hà, Cầu Giấy..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                  />
                  {foodMapSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setFoodMapSearchQuery('');
                        setFoodMapSearchResults([]);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Suggestions Dropdown / List */}
              {foodMapSearchResults.length > 0 && (
                <div className="border border-emerald-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 bg-emerald-50/20 max-h-48 overflow-y-auto shadow-2xs">
                  <div className="px-3 py-1.5 bg-emerald-100/60 text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Kết quả gợi ý ({foodMapSearchResults.length}):</span>
                    {isSearchingFoodMap && <span className="text-[10px] text-emerald-700 font-normal">Đang tìm...</span>}
                  </div>
                  {foodMapSearchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectFoodMapResult(res)}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 transition flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 truncate flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{res.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {res.fullAddress}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                        Chọn
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Map Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <span>Bản đồ xem trước vị trí:</span>
                  </label>
                  <a
                    href={getGoogleMapsMyLocationUrl(
                      selectedFoodMapPlace?.lat || userCoords.latitude,
                      selectedFoodMapPlace?.lng || userCoords.longitude,
                      selectedFoodMapPlace?.fullAddress || foodMapSearchQuery
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-bold inline-flex items-center gap-1"
                  >
                    <span>Mở Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 shadow-inner">
                  <iframe
                    title="Xem bản đồ vị trí quán"
                    src={getGoogleMapsEmbedUrl({
                      lat: selectedFoodMapPlace?.lat || userCoords.latitude,
                      lng: selectedFoodMapPlace?.lng || userCoords.longitude,
                      query: selectedFoodMapPlace?.fullAddress || foodMapSearchQuery || 'Việt Nam',
                      zoom: 16,
                    })}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Selected Location Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Địa chỉ đang chọn:
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {(selectedFoodMapPlace?.lat || userCoords.latitude).toFixed(5)}, {(selectedFoodMapPlace?.lng || userCoords.longitude).toFixed(5)}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 truncate">
                  {selectedFoodMapPlace?.name || selectedFoodMapPlace?.fullAddress || foodMapSearchQuery || 'Vị trí hiện tại'}
                </div>
                {selectedFoodMapPlace?.fullAddress && (
                  <div className="text-[11px] text-slate-600 truncate">
                    {selectedFoodMapPlace.fullAddress}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setShowFoodMapPicker(false)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyFoodMapPlace}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Áp Dụng Địa Chỉ Này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHỌN HOẶC TÌM KIẾM VỊ TRÍ NHANH & CHÍNH XÁC       */}
      {/* ========================================================= */}
      {showExactAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                    Chọn Vị Trí Của Bạn
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Để tính chính xác khoảng cách và dẫn đường tới các quán ăn ngon
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExactAddressModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* GPS Button */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Định vị GPS tự động từ thiết bị</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 truncate mt-0.5">
                    {userCoords.fullAddress || userCoords.cityName || 'Chưa định vị'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestLocation(true)}
                  disabled={isLocating}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Đang dò...' : 'Dò GPS ngay'}</span>
                </button>
              </div>

              {gpsErrorNotice && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                  {gpsErrorNotice}
                </div>
              )}

              {/* Search Bar */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 text-xs">
                  🔍 Tìm kiếm địa chỉ, tên đường hoặc địa danh:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={addressSearchInput}
                    onChange={(e) => {
                      setAddressSearchInput(e.target.value);
                      if (e.target.value.trim().length >= 2) {
                        handleExecuteAddressSearch(e.target.value);
                      } else {
                        setAddressSearchResults([]);
                      }
                    }}
                    placeholder="VD: Phố Cổ, Cầu Giấy, KĐT Văn Phú, KĐT Thanh Hà, Quận 1..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  {addressSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddressSearchInput('');
                        setAddressSearchResults([]);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {isSearchingAddress && (
                <div className="py-4 text-center text-slate-400 font-medium text-xs">
                  Đang tìm kiếm địa chỉ...
                </div>
              )}

              {!isSearchingAddress && addressSearchResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {addressSearchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full p-2.5 text-left hover:bg-emerald-50/60 transition flex items-center justify-between gap-2.5 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 group-hover:text-emerald-700 text-xs flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.name || item.districtOrCity}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.fullAddress}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded shrink-0">
                        Chọn
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Preset Buildings in KDT Thanh Ha */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>🏢 Tòa nhà & Liền kề KĐT Thanh Hà (Định vị chuẩn 100%):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'thanhha_hh022a', name: 'Tòa HH02-2A', detail: 'Tổ hợp HH02 Thanh Hà' },
                    { key: 'thanhha_hh021b', name: 'Tòa HH02-1B', detail: 'Tổ hợp HH02 Thanh Hà' },
                    { key: 'thanhha_hh01c', name: 'Tòa HH01C', detail: 'Tổ hợp HH01 Thanh Hà' },
                    { key: 'thanhha_b14', name: 'Liền Kề B1.4', detail: 'Khu biệt thự & phố ẩm thực' },
                    { key: 'thanhha_b21', name: 'Hồ Điều Hòa B2.1', detail: 'Ven hồ điều hòa mát mẻ' },
                    { key: 'thanhha', name: 'KĐT Thanh Hà', detail: 'Toàn khu đô thị Cienco 5' },
                  ].map((b) => {
                    const isSelected = userCoords.building === b.name || userCoords.fullAddress?.includes(b.name);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => handleSelectPresetLocation(b.key)}
                        className={`p-2 rounded-xl border text-left transition flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/30'
                            : 'bg-emerald-50/20 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{b.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{b.detail}</div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Preset Locations */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-700 text-xs flex items-center justify-between">
                  <span>📍 Các khu vực quận huyện khác:</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'hanoi', name: 'Hoàn Kiếm (Phố Cổ)', city: 'Hà Nội' },
                    { key: 'caugiay', name: 'Cầu Giấy (Duy Tân)', city: 'Hà Nội' },
                    { key: 'vanphu', name: 'KĐT Văn Phú (Hà Đông)', city: 'Hà Nội' },
                    { key: 'thanhha', name: 'KĐT Thanh Hà', city: 'Hà Nội' },
                    { key: 'xala', name: 'KĐT Xa La (Hà Đông)', city: 'Hà Nội' },
                    { key: 'mydinh', name: 'Mỹ Đình (Nam Từ Liêm)', city: 'Hà Nội' },
                    { key: 'thanhxuan', name: 'Thanh Xuân (Ngã Tư Sở)', city: 'Hà Nội' },
                    { key: 'linhdam', name: 'KĐT Linh Đàm', city: 'Hà Nội' },
                    { key: 'hcm', name: 'Quận 1 (Bến Thành)', city: 'TP. Hồ Chí Minh' },
                    { key: 'danang', name: 'Hải Châu (Cầu Rồng)', city: 'Đà Nẵng' },
                    { key: 'haiphong', name: 'Hồng Bàng (Nhà Hát)', city: 'Hải Phòng' },
                    { key: 'cantho', name: 'Ninh Kiều (Bến Ninh Kiều)', city: 'Cần Thơ' },
                  ].map((p) => {
                    const isSelected =
                      userCoords.cityName?.toLowerCase().includes(p.name.toLowerCase()) ||
                      userCoords.fullAddress?.toLowerCase().includes(p.name.toLowerCase());
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handleSelectPresetLocation(p.key)}
                        className={`p-2 rounded-xl border text-left transition flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/30'
                            : 'bg-slate-50/70 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{p.city}</div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                Đang ghim: <span className="font-bold text-slate-800">{userCoords.cityName || 'Hà Nội'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExactAddressModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Copy Notification Toast */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}
    </div>
  );
};
