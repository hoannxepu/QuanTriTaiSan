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
  Map as MapIcon,
  List,
  Table as TableIcon,
  X,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpDown,
  ExternalLink,
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
  getGoogleMapsNearbyFoodUrl,
  getGoogleMapsPinUrl,
  getCurrentDevicePosition,
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

  // In Food: 'compact_list' (Bảng gọn dòng, mặc định) vs 'list' (Danh sách thẻ) vs 'map' (Bản đồ radar)
  const [foodViewMode, setFoodViewMode] = useState<'list' | 'compact_list' | 'map'>('compact_list');

  // Ensure default data exists
  const lifeEvents: LifeEvent[] = useMemo(() => {
    return db.lifeEvents && db.lifeEvents.length > 0 ? db.lifeEvents : DEFAULT_LIFE_EVENTS;
  }, [db.lifeEvents]);

  const foodPlaces: FoodPlace[] = useMemo(() => {
    if (!db.foodPlaces || db.foodPlaces.length === 0) {
      return DEFAULT_FOOD_PLACES;
    }
    // Tự động bổ sung các quán ăn mới (KĐT Thanh Hà, Xa La, Văn Phú, Hà Đông) vào database hiện có của người dùng
    const existingIds = new Set(db.foodPlaces.map((p) => p.id));
    const missingDefaults = DEFAULT_FOOD_PLACES.filter((d) => !existingIds.has(d.id));
    if (missingDefaults.length > 0) {
      return [...db.foodPlaces, ...missingDefaults];
    }
    return db.foodPlaces;
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
  // Mặc định khởi tạo tại Tòa HH03D (Khu B2.1 KĐT Thanh Hà)
  const [userCoords, setUserCoords] = useState<Coordinates>(PRESET_LOCATIONS.thanhha);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Tòa HH03D (Khu B2.1), KĐT Thanh Hà, Hà Nội');
  const [foodSearch, setFoodSearch] = useState<string>('');
  const [foodCategory, setFoodCategory] = useState<FoodCategory>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'budget' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price_asc'>('distance');
  const [selectedFoodPlace, setSelectedFoodPlace] = useState<FoodPlace | null>(null);

  // Exact House Number & Building Modal State
  const [showExactAddressModal, setShowExactAddressModal] = useState<boolean>(false);
  const [exactAddressTab, setExactAddressTab] = useState<'thanhha' | 'search' | 'custom' | 'nearby'>('thanhha');
  const [addressSearchInput, setAddressSearchInput] = useState<string>('');
  const [addressSearchResults, setAddressSearchResults] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [customUnitInput, setCustomUnitInput] = useState<string>('');

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

  // Auto locate user position on first load or restore saved exact address
  useEffect(() => {
    try {
      const saved = localStorage.getItem('thaptaisan_exact_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.latitude && parsed.longitude) {
          // Nếu là bộ nhớ cũ HH02-2A thì cập nhật chuẩn xác sang Tòa HH03D
          if (parsed.building?.includes('HH02-2A') || parsed.cityName?.includes('HH02-2A')) {
            setUserCoords(PRESET_LOCATIONS.thanhha);
            setLocationStatus(PRESET_LOCATIONS.thanhha.fullAddress || 'Tòa HH03D Thanh Hà');
            localStorage.setItem('thaptaisan_exact_location', JSON.stringify(PRESET_LOCATIONS.thanhha));
            return;
          }
          setUserCoords(parsed);
          setLocationStatus(parsed.fullAddress || parsed.cityName || 'Đã lưu vị trí cụ thể');
          return;
        }
      }
    } catch (e) {}

    handleRequestLocation(false);
  }, []);

  const handleRequestLocation = async (showAlert: boolean = true) => {
    setIsLocating(true);
    setLocationStatus('Đang kết nối GPS và nhận diện vị trí...');
    try {
      const pos = await getCurrentDevicePosition();
      setUserCoords(pos);
      try {
        localStorage.setItem('thaptaisan_exact_location', JSON.stringify(pos));
      } catch (e) {}
      const landmarkDesc = pos.building ? ` (${pos.building})` : pos.landmark ? ` (${pos.landmark})` : '';
      setLocationStatus(`Đã định vị thành công${landmarkDesc} (Độ chính xác ~${Math.round(pos.accuracy || 15)}m)`);
      setIsLocating(false);
    } catch (err: any) {
      setIsLocating(false);
      setUserCoords(PRESET_LOCATIONS.thanhha);
      setLocationStatus('Đang dùng vị trí: Tòa HH03D (Khu B2.1), KĐT Thanh Hà');
      if (showAlert) {
        alert(
          'Không thể lấy vị trí GPS tự động (do trình duyệt chưa cấp quyền). Ứng dụng đã thiết lập vị trí chuẩn tại Tòa HH03D (Khu B2.1 KĐT Thanh Hà).'
        );
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
      setLocationStatus(`Đang dùng vị trí: ${target.fullAddress || target.cityName}`);
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
    let list = foodPlaces.map((place) => {
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
    setFoodFormPriceRange('');
    setFoodFormApproxPrice('');
    setFoodFormAddress('');
    setFoodFormCity('Hà Nội');
    setFoodFormPhone('');
    setFoodFormOpening('08:00 - 22:00');
    setFoodFormRating(5.0);
    setFoodFormTags('');
    setFoodFormNote('');
    setFoodFormLat(userCoords.latitude ? userCoords.latitude.toFixed(6) : '21.0285');
    setFoodFormLng(userCoords.longitude ? userCoords.longitude.toFixed(6) : '105.8542');
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
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-3.5 space-y-2.5">
            {/* Row 1: Location & Google Maps Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {userCoords.building || userCoords.fullAddress || userCoords.cityName || 'Khu đô thị Thanh Hà, Hà Nội'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRequestLocation(true)}
                      disabled={isLocating}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                      title="Dò lại vị trí GPS"
                    >
                      <LocateFixed className="w-3 h-3" />
                      <span>{isLocating ? 'Đang dò...' : 'Dò GPS'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressSearchInput('');
                        setAddressSearchResults([]);
                        setCustomUnitInput(userCoords.building || '');
                        setShowExactAddressModal(true);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                    >
                      (Đổi)
                    </button>
                  </div>
                  {userCoords.fullAddress && userCoords.building && (
                    <div className="text-[11px] text-slate-500 truncate" title={userCoords.fullAddress}>
                      {userCoords.fullAddress}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Open in Google Maps + Add Place */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <a
                  href={getGoogleMapsNearbyFoodUrl(userCoords.latitude, userCoords.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs whitespace-nowrap active:scale-98"
                  title="Mở Google Maps tìm kiếm quán ăn quanh vị trí của bạn"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Maps quán quanh đây</span>
                </a>

                <button
                  type="button"
                  onClick={openAddFood}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                  title="Thêm quán ăn mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            {/* Row 2: Search input, Category filter, and View toggle */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Tìm món ngon, tên quán..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <select
                value={foodCategory}
                onChange={(e) => setFoodCategory(e.target.value as FoodCategory)}
                className="w-36 sm:w-44 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="all">Tất cả món</option>
                <option value="noodles">Bún • Phở • Mì</option>
                <option value="rice">Cơm tấm • Cơm niêu</option>
                <option value="hotpot_bbq">Lẩu & Nướng</option>
                <option value="seafood">Hải sản</option>
                <option value="casual">Ăn vặt • Bánh mì</option>
                <option value="coffee_dessert">Cà phê • Trà</option>
              </select>

              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFoodViewMode('compact_list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    foodViewMode === 'compact_list'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Bảng danh sách"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFoodViewMode('list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    foodViewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Danh sách thẻ"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* FOOD VIEW MODE 1: COMPACT LIST VIEW (DANH SÁCH BẢNG GỌN)   */}
          {/* ========================================================= */}
          {foodViewMode === 'compact_list' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {/* Table Header on sm+ */}
              <div className="hidden sm:flex items-center justify-between px-3.5 py-2 bg-slate-50/90 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span>Quán Ăn & Món Đặc Trưng</span>
                </div>
                <div className="flex items-center gap-6 pr-2">
                  <span>Khoảng Cách</span>
                  <span>Chỉ Đường & Thao Tác</span>
                </div>
              </div>

              {processedFoodPlaces.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy quán ăn nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                processedFoodPlaces.map((place) => {
                  const directionsUrl = getGoogleMapsDirectionsUrl(
                    place.latitude,
                    place.longitude,
                    place.address,
                    userCoords.latitude,
                    userCoords.longitude
                  );

                  return (
                    <div
                      key={place.id}
                      className="px-3 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 transition"
                    >
                      {/* Left: Category Icon + Details */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Category Mini Badge */}
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 text-xs font-bold">
                          {getCategoryLabel(place.category).charAt(0)}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Line 1: Name, Rating, Distance & Travel Estimate */}
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
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
                            <span className="text-slate-300 hidden md:inline">•</span>
                            <span className="text-slate-400 truncate max-w-[200px] lg:max-w-xs hidden md:inline">
                              {place.address}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Directions & Action Buttons */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs select-none active:scale-98 whitespace-nowrap"
                          title="Mở Google Maps chỉ đường"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden xs:inline">Chỉ đường</span>
                        </a>

                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="p-1 sm:p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title={`Gọi điện: ${place.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleToggleFavoriteFood(place.id, e)}
                          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title="Lưu yêu thích"
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
                          className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {place.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFood(place.id, e)}
                            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200/90 p-6">
                  <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">Không tìm thấy quán ăn phù hợp</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Hãy thử đổi từ khóa tìm kiếm hoặc bấm nút "Thêm quán ăn" để nhập địa điểm yêu thích của bạn!
                  </p>
                </div>
              ) : (
                processedFoodPlaces.map((place) => {
                  const directionsUrl = getGoogleMapsDirectionsUrl(
                    place.latitude,
                    place.longitude,
                    place.address,
                    userCoords.latitude,
                    userCoords.longitude
                  );

                  return (
                    <div
                      key={place.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all duration-200 p-3 sm:p-3.5 flex flex-col justify-between group"
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
                            Món ngon:
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

                          <div className="flex items-start gap-1 text-[11px] text-slate-500 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate">{place.address}</span>
                          </div>

                          {place.openingHours && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">Mở cửa: {place.openingHours}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions: Google Maps Navigation Button */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[36px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer select-none active:scale-98 whitespace-nowrap"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Chỉ đường</span>
                        </a>

                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title={`Gọi điện: ${place.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => openEditFood(place, e)}
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {place.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFood(place.id, e)}
                            className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Xóa quán"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* FOOD VIEW MODE 3: RADAR MAP VIEW                          */}
          {/* ========================================================= */}
          {foodViewMode === 'map' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span className="font-bold text-sm text-slate-900">
                    Bản Đồ Quán Ăn Gần Bạn ({processedFoodPlaces.length} địa điểm)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Nhấp vào ghim để xem chi tiết & chỉ đường
                </span>
              </div>

              {/* Simulated Interactive Vector Map Canvas with Concentric Distance Rings */}
              <div className="relative w-full h-[380px] sm:h-[460px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center select-none">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30"></div>

                {/* Concentric Distance Rings (Vòng tròn đồng tâm cự ly quanh bạn) */}
                <div className="absolute w-[120px] h-[120px] rounded-full border border-emerald-500/30 pointer-events-none flex items-start justify-center">
                  <span className="text-[9px] font-mono text-emerald-400/80 bg-slate-900/80 px-1 rounded -translate-y-2">
                    Vòng 1 km
                  </span>
                </div>
                <div className="absolute w-[220px] h-[220px] rounded-full border border-emerald-400/25 pointer-events-none flex items-start justify-center">
                  <span className="text-[9px] font-mono text-emerald-400/70 bg-slate-900/80 px-1 rounded -translate-y-2">
                    Vòng 3 km
                  </span>
                </div>
                <div className="absolute w-[320px] h-[320px] rounded-full border border-sky-400/20 pointer-events-none flex items-start justify-center">
                  <span className="text-[9px] font-mono text-sky-400/60 bg-slate-900/80 px-1 rounded -translate-y-2">
                    Vòng 5 km
                  </span>
                </div>

                {/* Center User Location Marker */}
                <div className="absolute z-20 flex flex-col items-center pointer-events-none">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
                    <div className="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg z-10"></div>
                  </div>
                  <span className="mt-1 px-2 py-0.5 bg-slate-900/90 text-emerald-300 text-[10px] font-bold rounded shadow-md border border-emerald-500/40">
                    Vị trí của bạn
                  </span>
                </div>

                {/* Nearby Restaurant Pins */}
                {processedFoodPlaces.slice(0, 12).map((place, idx) => {
                  const angle = (idx * (360 / Math.min(processedFoodPlaces.length, 12)) * Math.PI) / 180;
                  const radius = Math.min(150, 45 + Math.min(place.distanceKm, 25) * 5);
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  const isSelected = selectedFoodPlace?.id === place.id;

                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => setSelectedFoodPlace(place)}
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                      }}
                      className={`absolute z-30 flex flex-col items-center transition cursor-pointer group hover:scale-110 ${
                        isSelected ? 'scale-125 z-40' : ''
                      }`}
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border-2 transition ${
                          isSelected
                            ? 'bg-amber-500 border-white text-white'
                            : 'bg-white/95 border-slate-700 text-slate-800 group-hover:bg-amber-500 group-hover:text-white'
                        }`}
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                      </div>
                      <span className="mt-0.5 px-1.5 py-0.2 bg-slate-900/90 text-white text-[9px] font-bold rounded shadow truncate max-w-[90px] border border-slate-700">
                        {place.name.split(' ')[0]} • {place.formattedDistance}
                      </span>
                    </button>
                  );
                })}

                {/* Selected Food Place Overlay Card in Map */}
                {selectedFoodPlace && (
                  <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-200 shadow-2xl z-40 text-slate-900 animate-in fade-in zoom-in-95">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {selectedFoodPlace.name}
                        </div>
                        <div className="text-[11px] text-amber-700 font-semibold truncate mt-0.5">
                          {selectedFoodPlace.specialtyDishes}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFoodPlace(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                      <span className="font-bold text-emerald-700">
                        📍 Cách bạn {selectedFoodPlace.formattedDistance}
                      </span>
                      <span>•</span>
                      <span>{selectedFoodPlace.priceRange}</span>
                    </div>

                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      {selectedFoodPlace.address}
                    </p>

                    <div className="mt-2.5 flex items-center gap-2">
                      <a
                        href={getGoogleMapsDirectionsUrl(
                          selectedFoodPlace.latitude,
                          selectedFoodPlace.longitude,
                          selectedFoodPlace.address,
                          userCoords.latitude,
                          userCoords.longitude
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>Chỉ đường Google Maps</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
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
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ chi tiết quán</label>
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
      {/* MODAL: ĐỊNH VỊ CHÍNH XÁC SỐ NHÀ, CĂN HỘ & TÒA NHÀ CỤ THỂ  */}
      {/* ========================================================= */}
      {showExactAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/90 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                    Định Vị Chính Xác Số Nhà & Tòa Nhà Cụ Thể
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ghim chính xác tới từng căn hộ, số nhà hoặc tòa chung cư để tìm quán ăn sát chân nhà
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExactAddressModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Position Banner */}
            <div className="px-4 sm:px-5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] sm:text-xs text-emerald-950 min-w-0">
                <span className="font-bold text-emerald-800">Đang ghim vị trí: </span>
                <span className="font-semibold">{userCoords.fullAddress || userCoords.cityName}</span>
                {userCoords.building && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200">
                    🏢 {userCoords.building}
                  </span>
                )}
              </div>
              <a
                href={getGoogleMapsPinUrl(userCoords.latitude, userCoords.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Xem trên Maps</span>
              </a>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold px-3 pt-2 gap-1 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setExactAddressTab('thanhha')}
                className={`px-3 py-2 border-b-2 rounded-t-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                  exactAddressTab === 'thanhha'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🏢 Tòa Nhà KĐT Thanh Hà</span>
              </button>

              <button
                type="button"
                onClick={() => setExactAddressTab('search')}
                className={`px-3 py-2 border-b-2 rounded-t-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                  exactAddressTab === 'search'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🔍 Tìm Số Nhà / Địa Chỉ Bất Kỳ</span>
              </button>

              <button
                type="button"
                onClick={() => setExactAddressTab('custom')}
                className={`px-3 py-2 border-b-2 rounded-t-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                  exactAddressTab === 'custom'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>✍️ Nhập Căn Hộ / Số Nhà</span>
              </button>

              <button
                type="button"
                onClick={() => setExactAddressTab('nearby')}
                className={`px-3 py-2 border-b-2 rounded-t-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                  exactAddressTab === 'nearby'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>📍 Khu Vực Khác</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* TAB 1: KĐT THANH HÀ PRESETS WITH EXACT BUILDINGS */}
              {exactAddressTab === 'thanhha' && (
                <div className="space-y-4">
                  {/* Optional Unit / Apartment input */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                    <label className="block font-bold text-amber-950 text-xs">
                      🏠 Nhập số căn hộ / tầng của bạn (Tùy chọn):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customUnitInput}
                        onChange={(e) => setCustomUnitInput(e.target.value)}
                        placeholder="VD: Căn 1208 Tầng 12, P.604, Liền kề ô 15..."
                        className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCustomUnit(customUnitInput)}
                        disabled={!customUnitInput.trim()}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg transition shrink-0"
                      >
                        Áp dụng ngay
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-800">
                      * Mẹo: Nhập số căn ở trên rồi bấm vào tòa nhà bên dưới, địa chỉ sẽ lưu đầy đủ cả số phòng lẫn tòa nhà.
                    </p>
                  </div>

                  {/* Grouped Buildings */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Bấm chọn tòa nhà bạn đang ở (KĐT Thanh Hà Cienco 5):</span>
                      <span className="text-[10px] font-normal text-slate-500">Độ chính xác: Sai số dưới 15m</span>
                    </h4>

                    {/* Group: Cụm HH02-2 (B1.4) */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Cụm Tòa Chung Cư HH02-2 (Khu B1.4 Thanh Hà)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXACT_BUILDING_PRESETS.filter((b) => b.tag === 'HH02 Thanh Hà' && b.id.includes('hh02_2')).map((b) => {
                          const isSelected = userCoords.building?.includes(b.buildingName);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectExactBuilding(b, customUnitInput)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{b.buildingName}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.fullAddress}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group: Cụm HH02-1 (B1.4) */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span>Cụm Tòa Chung Cư HH02-1 (Khu B1.4 Thanh Hà)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXACT_BUILDING_PRESETS.filter((b) => b.tag === 'HH02 Thanh Hà' && b.id.includes('hh02_1')).map((b) => {
                          const isSelected = userCoords.building?.includes(b.buildingName);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectExactBuilding(b, customUnitInput)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{b.buildingName}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.fullAddress}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group: Cụm HH01 */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                        <span>Cụm Tòa Chung Cư HH01 (Khu HH01 Thanh Hà)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXACT_BUILDING_PRESETS.filter((b) => b.tag === 'HH01 Thanh Hà').map((b) => {
                          const isSelected = userCoords.building?.includes(b.buildingName);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectExactBuilding(b, customUnitInput)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{b.buildingName}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.fullAddress}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group: Cụm HH03 (B2.1) */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                        <span>Cụm Tòa Chung Cư HH03 (Khu B2.1 Thanh Hà)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXACT_BUILDING_PRESETS.filter((b) => b.tag === 'HH03 Thanh Hà').map((b) => {
                          const isSelected = userCoords.building?.includes(b.buildingName);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectExactBuilding(b, customUnitInput)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{b.buildingName}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.fullAddress}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group: Liền Kề & Biệt Thự */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Khu Liền Kề & Biệt Thự Ven Hồ Thanh Hà</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {EXACT_BUILDING_PRESETS.filter(
                          (b) => b.tag === 'Liền kề Thanh Hà' || b.tag === 'Hồ Thanh Hà'
                        ).map((b) => {
                          const isSelected = userCoords.building?.includes(b.buildingName);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectExactBuilding(b, customUnitInput)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                  : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{b.buildingName}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.fullAddress}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SEARCH ANY ADDRESS OR HOUSE NUMBER */}
              {exactAddressTab === 'search' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="block font-bold text-slate-800 text-xs">
                      🔍 Nhập số nhà, tên đường ngõ, tòa nhà hoặc địa danh:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={addressSearchInput}
                          onChange={(e) => {
                            setAddressSearchInput(e.target.value);
                            if (e.target.value.trim().length >= 2) {
                              handleExecuteAddressSearch(e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleExecuteAddressSearch(addressSearchInput);
                            }
                          }}
                          placeholder="VD: Số 12 ngõ 45 Kim Mã, CT4 Xa La, 180 Cầu Giấy..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExecuteAddressSearch(addressSearchInput)}
                        disabled={isSearchingAddress}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition shrink-0 flex items-center gap-1.5"
                      >
                        {isSearchingAddress ? (
                          <span>Đang tìm...</span>
                        ) : (
                          <>
                            <Search className="w-3.5 h-3.5" />
                            <span>Tìm kiếm</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                      <span>Kết quả tìm kiếm địa chỉ:</span>
                      {addressSearchResults.length > 0 && (
                        <span>Tìm thấy {addressSearchResults.length} địa điểm</span>
                      )}
                    </div>

                    {isSearchingAddress && (
                      <div className="p-6 text-center text-slate-400 font-medium">
                        Đang tra cứu cơ sở dữ liệu bản đồ địa chỉ...
                      </div>
                    )}

                    {!isSearchingAddress && addressSearchResults.length === 0 && addressSearchInput.trim() && (
                      <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        Không tìm thấy địa chỉ phù hợp. Vui lòng nhập chi tiết hơn kèm tên quận/huyện hoặc chọn tòa nhà bên Tab KĐT Thanh Hà!
                      </div>
                    )}

                    {!isSearchingAddress && addressSearchResults.length > 0 && (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        {addressSearchResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSearchResult(item)}
                            className="w-full p-3 text-left hover:bg-emerald-50/50 transition flex items-start justify-between gap-3 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 group-hover:text-emerald-700 text-xs">
                                📍 {item.name || item.districtOrCity}
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {item.fullAddress}
                              </div>
                            </div>
                            <span className="shrink-0 px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] group-hover:bg-emerald-600 group-hover:text-white transition">
                              Chọn vị trí này
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CUSTOM APARTMENT / HOUSE NUMBER */}
              {exactAddressTab === 'custom' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs">
                      ✍️ Ghép thêm Số nhà / Số căn hộ vào vị trí hiện tại của bạn:
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Giữ nguyên tọa độ định vị GPS thực tế và bổ sung chi tiết số nhà, số phòng, tầng để khi lưu hoặc chỉ đường không bị nhầm lẫn.
                    </p>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                        Số nhà / Căn hộ / Tầng:
                      </label>
                      <input
                        type="text"
                        value={customUnitInput}
                        onChange={(e) => setCustomUnitInput(e.target.value)}
                        placeholder="VD: P.1406 Tòa HH02-2A, Số 28 Ngõ 10..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-bold">Địa chỉ hoàn chỉnh sau khi lưu: </span>
                      <span className="text-emerald-700 font-semibold">
                        {customUnitInput.trim() ? `${customUnitInput.trim()}, ` : ''}
                        {userCoords.fullAddress || userCoords.cityName}
                      </span>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleApplyCustomUnit(customUnitInput)}
                        disabled={!customUnitInput.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Lưu & Áp Dụng Vị Trí</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NEARBY URBAN DISTRICTS */}
              {exactAddressTab === 'nearby' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 text-xs">
                    📍 Chọn nhanh các khu đô thị & quận huyện lân cận:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* CT4 Xa La */}
                    <button
                      type="button"
                      onClick={() => handleSelectExactBuilding(EXACT_BUILDING_PRESETS.find((x) => x.id === 'xala_ct4')!)}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Chung cư CT4 Xa La</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Phúc La, Quận Hà Đông (gần viện 103)</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>

                    {/* Văn Phú */}
                    <button
                      type="button"
                      onClick={() => handleSelectExactBuilding(EXACT_BUILDING_PRESETS.find((x) => x.id === 'vanphu_lacasta')!)}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">KĐT Văn Phú (Lacasta)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Phú La, Quận Hà Đông</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>

                    {/* Linh Đàm */}
                    <button
                      type="button"
                      onClick={() => handleSelectExactBuilding(EXACT_BUILDING_PRESETS.find((x) => x.id === 'linhdam_hh2')!)}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Tổ Hợp Chung Cư HH Linh Đàm</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Hoàng Liệt, Quận Hoàng Mai</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>

                    {/* Thanh Xuân */}
                    <button
                      type="button"
                      onClick={() => handleSelectPresetLocation('thanhxuan')}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Khu vực Royal City (Ngã Tư Sở)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Quận Thanh Xuân, Hà Nội</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>

                    {/* Cầu Giấy */}
                    <button
                      type="button"
                      onClick={() => handleSelectPresetLocation('caugiay')}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Cầu Giấy (Duy Tân)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Dịch Vọng Hậu, Quận Cầu Giấy</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>

                    {/* Hoàn Kiếm */}
                    <button
                      type="button"
                      onClick={() => handleSelectPresetLocation('hanoi')}
                      className="p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl text-left transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Hoàn Kiếm (Phố Cổ)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Hồ Hoàn Kiếm, Quận Hoàn Kiếm</div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Chọn</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleRequestLocation(true)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Dò lại GPS thiết bị</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExactAddressModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
