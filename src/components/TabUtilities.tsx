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
  calculateDistanceKm,
  formatDistance,
  getGoogleMapsDirectionsUrl,
  getCurrentDevicePosition,
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
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'food'>('calendar');

  // View modes
  // In Calendar: 'list' (Danh sách sự kiện dễ nhìn) vs 'grid' (Lưới lịch tháng)
  const [calViewMode, setCalViewMode] = useState<'list' | 'grid'>('list');

  // In Food: 'list' (Danh sách thẻ thông tin) vs 'compact_list' (Bảng gọn) vs 'map' (Bản đồ radar)
  const [foodViewMode, setFoodViewMode] = useState<'list' | 'compact_list' | 'map'>('list');

  // Ensure default data exists
  const lifeEvents: LifeEvent[] = useMemo(() => {
    return db.lifeEvents && db.lifeEvents.length > 0 ? db.lifeEvents : DEFAULT_LIFE_EVENTS;
  }, [db.lifeEvents]);

  const foodPlaces: FoodPlace[] = useMemo(() => {
    return db.foodPlaces && db.foodPlaces.length > 0 ? db.foodPlaces : DEFAULT_FOOD_PLACES;
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
  const [userCoords, setUserCoords] = useState<Coordinates>(PRESET_LOCATIONS.hanoi);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Vị trí mặc định: Hà Nội');
  const [foodSearch, setFoodSearch] = useState<string>('');
  const [foodCategory, setFoodCategory] = useState<FoodCategory>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'budget' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price_asc'>('distance');
  const [selectedFoodPlace, setSelectedFoodPlace] = useState<FoodPlace | null>(null);

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

  // Auto locate user position on first load
  useEffect(() => {
    handleRequestLocation(false);
  }, []);

  const handleRequestLocation = async (showAlert: boolean = true) => {
    setIsLocating(true);
    setLocationStatus('Đang xác định vị trí GPS...');
    try {
      const pos = await getCurrentDevicePosition();
      setUserCoords(pos);
      setLocationStatus(`Đã định vị vị trí của bạn (Độ chính xác ~${Math.round(pos.accuracy || 20)}m)`);
      setIsLocating(false);
    } catch (err: any) {
      setIsLocating(false);
      setLocationStatus('Chưa có GPS, dùng tọa độ trung tâm thành phố');
      if (showAlert) {
        alert(
          'Không thể lấy vị trí GPS tự động (có thể do trình duyệt chưa cấp quyền). Bạn có thể chọn nhanh thành phố ở thanh bên trên!'
        );
      }
    }
  };

  const handleSelectPresetLocation = (key: string) => {
    if (PRESET_LOCATIONS[key]) {
      setUserCoords(PRESET_LOCATIONS[key]);
      setLocationStatus(`Đang dùng vị trí: ${PRESET_LOCATIONS[key].cityName}`);
    }
  };

  // Filter and sort food places
  const processedFoodPlaces = useMemo(() => {
    let list = foodPlaces.map((place) => {
      const distKm = calculateDistanceKm(
        userCoords.latitude,
        userCoords.longitude,
        place.latitude,
        place.longitude
      );
      return {
        ...place,
        distanceKm: distKm,
        formattedDistance: formatDistance(distKm),
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

    // Sort
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
      return 0;
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
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Tiện Ích & Đời Sống
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80">
                Gia đình • Vị trí • Bản đồ
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Quản lý danh sách sinh nhật, ngày giỗ âm lịch, ngày lễ nhà nước và khám phá quán ăn ngon kèm
              định vị dẫn đường Google Maps 1 chạm.
            </p>
          </div>

          {/* Segmented Switcher for Main Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-200'
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                activeSubTab === 'food'
                  ? 'bg-white text-amber-800 shadow-xs ring-1 ring-amber-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
              <span>Quán Ăn & Món Ngon</span>
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(
                [
                  { id: 'all', label: 'Tất cả', count: lifeEvents.length },
                  {
                    id: 'anniversary_death',
                    label: '🕯️ Ngày giỗ (ÂL)',
                    count: lifeEvents.filter((x) => x.type === 'anniversary_death').length,
                  },
                  {
                    id: 'birthday',
                    label: '🎂 Sinh nhật',
                    count: lifeEvents.filter((x) => x.type === 'birthday').length,
                  },
                  {
                    id: 'holiday',
                    label: '🇻🇳 Nghỉ lễ nhà nước',
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
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    eventFilter === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono ${
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
                  {filteredEvents.map((item) => {
                    const badge = getEventBadge(item.event.type);
                    const isToday = item.daysRemaining === 0;
                    const isVeryClose = item.daysRemaining > 0 && item.daysRemaining <= 3;
                    const isWithinWeek = item.daysRemaining > 3 && item.daysRemaining <= 7;

                    return (
                      <div
                        key={item.event.id}
                        className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition ${
                          isToday ? 'bg-red-50/60' : isVeryClose ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        {/* Left Info: Badge, Title, Solar Date, Lunar Date & Person */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          {/* Type Icon Badge */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badge.color}`}
                          >
                            {badge.icon}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                                {item.event.title}
                              </h4>
                              {item.event.personName && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {item.event.personName}
                                </span>
                              )}
                              {item.event.isNationalHoliday && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                                  Nghỉ Lễ Toàn Quốc
                                </span>
                              )}
                            </div>

                            {/* Dual Date Format: Dương lịch & Âm lịch */}
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                              <span className="font-bold text-slate-800">
                                Dương lịch: {item.solarStr}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-amber-800">
                                Âm lịch: {item.lunarStr}
                              </span>
                              {item.event.isLunar && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-semibold font-sans">
                                  Tính theo Lịch Âm
                                </span>
                              )}
                            </div>

                            {/* Note snippet */}
                            {item.event.note && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 max-w-xl">
                                {item.event.note}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right Actions: Countdown Pill, Edit, Delete */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {/* Countdown Badge */}
                          <div
                            className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tight whitespace-nowrap tabular-nums shadow-2xs ${
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
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditEvent(item.event)}
                              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa sự kiện"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(item.event.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa sự kiện"
                            >
                              <Trash2 className="w-4 h-4" />
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
          {/* Top GPS Navigation Bar & Quick City Switcher */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Current Location Status */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">Vị Trí Định Vị</span>
                    {isLocating && (
                      <span className="text-[10px] text-emerald-600 font-semibold animate-pulse">
                        (Đang dò GPS...)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-md">
                    {userCoords.cityName || locationStatus}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Auto GPS + Quick Cities */}
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRequestLocation(true)}
                  disabled={isLocating}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  title="Tự động định vị GPS vị trí của tôi hiện tại"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Định vị tôi</span>
                </button>

                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl text-[11px] font-semibold text-slate-700">
                  <button
                    type="button"
                    onClick={() => handleSelectPresetLocation('hanoi')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                      userCoords.cityName?.includes('Hà Nội')
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Hà Nội
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetLocation('hcm')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                      userCoords.cityName?.includes('TP. Hồ Chí Minh')
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    TP.HCM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetLocation('danang')}
                    className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                      userCoords.cityName?.includes('Đà Nẵng')
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Đà Nẵng
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openAddFood}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm quán ăn</span>
                </button>
              </div>
            </div>

            {/* Search & Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
              {/* Search input */}
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Tìm quán ăn, món ngon, địa chỉ..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category Filter */}
              <div className="lg:col-span-3">
                <select
                  value={foodCategory}
                  onChange={(e) => setFoodCategory(e.target.value as FoodCategory)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Tất cả thể loại món</option>
                  <option value="noodles">Bún • Phở • Mì</option>
                  <option value="rice">Cơm tấm • Cơm niêu</option>
                  <option value="hotpot_bbq">Lẩu & Nướng</option>
                  <option value="seafood">Hải sản & Cá</option>
                  <option value="coffee_dessert">Cà phê & Tráng miệng</option>
                  <option value="casual">Ăn vặt & Bánh mì</option>
                  <option value="fine_dining">Tiệc & Tiếp khách</option>
                </select>
              </div>

              {/* Price Filter */}
              <div className="lg:col-span-2">
                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Mọi mức giá</option>
                  <option value="budget">Bình dân (≤ 60k)</option>
                  <option value="medium">Vừa phải (60k - 150k)</option>
                  <option value="high">Cao cấp (&gt; 150k)</option>
                </select>
              </div>

              {/* Sort By & 3 View Modes Toggle (Danh sách thẻ | Danh sách bảng gọn | Bản đồ) */}
              <div className="lg:col-span-3 flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="distance">Gần tôi nhất</option>
                  <option value="rating">Đánh giá cao</option>
                  <option value="price_asc">Giá tăng dần</option>
                </select>

                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setFoodViewMode('list')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      foodViewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Dạng danh sách thẻ chi tiết"
                  >
                    <List className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setFoodViewMode('compact_list')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      foodViewMode === 'compact_list'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Dạng danh sách bảng gọn, thao tác nhanh"
                  >
                    <TableIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setFoodViewMode('map')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      foodViewMode === 'map'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Dạng bản đồ radar trực quan"
                  >
                    <MapIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* FOOD VIEW MODE 1: COMPACT LIST VIEW (DANH SÁCH BẢNG GỌN)   */}
          {/* ========================================================= */}
          {foodViewMode === 'compact_list' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
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
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        {/* Category & Star icon */}
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 text-xs font-bold">
                          {getCategoryLabel(place.category).charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {place.name}
                            </h4>
                            <span className="text-[10px] font-bold text-emerald-700 font-mono">
                              📍 Cách {place.formattedDistance}
                            </span>
                            {place.rating && (
                              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {place.rating.toFixed(1)}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-amber-900 font-semibold truncate mt-0.5">
                            Món ngon: {place.specialtyDishes}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 truncate mt-0.5">
                            <span className="font-mono font-bold text-slate-700">{place.priceRange}</span>
                            <span>•</span>
                            <span className="truncate">{place.address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right direct actions: Google Maps & Phone */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs select-none active:scale-98"
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Chỉ đường</span>
                        </a>

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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition"
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition"
                          title="Sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {place.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFood(place.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition"
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
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all duration-200 p-3.5 sm:p-4 flex flex-col justify-between group"
                    >
                      <div>
                        {/* Card Header: Name + Favorite */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-800 transition truncate leading-snug">
                              {place.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {place.rating && (
                                <div className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{place.rating.toFixed(1)}</span>
                                </div>
                              )}
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-[11px] font-bold text-emerald-700 font-mono">
                                📍 Cách {place.formattedDistance}
                              </span>
                            </div>
                          </div>

                          {/* Favorite button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavoriteFood(place.id, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer shrink-0"
                            title={place.isFavorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                place.isFavorite ? 'fill-rose-500 text-rose-500' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Specialty Dish */}
                        <div className="mt-2.5 p-2 rounded-xl bg-amber-50/70 border border-amber-200/80">
                          <div className="text-[10px] text-amber-900/80 font-bold uppercase tracking-wider">
                            Món ngon nên thử:
                          </div>
                          <div className="text-xs font-bold text-amber-950 mt-0.5 line-clamp-2">
                            {place.specialtyDishes}
                          </div>
                        </div>

                        {/* Metadata: Price & Address */}
                        <div className="mt-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-[11px] text-slate-500">Giá sơ bộ:</span>
                            <span className="font-bold text-slate-900 font-mono tabular-nums">
                              {place.priceRange}
                            </span>
                          </div>

                          <div className="flex items-start gap-1 text-[11px] text-slate-500 line-clamp-2">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>{place.address}</span>
                          </div>

                          {place.openingHours && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Mở cửa: {place.openingHours}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions: Google Maps Navigation Button */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none active:scale-98"
                        >
                          <Navigation className="w-4 h-4 shrink-0" />
                          <span>Chỉ đường Google Maps</span>
                        </a>

                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title={`Gọi điện: ${place.phone}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => openEditFood(place, e)}
                          className="min-h-[44px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {place.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFood(place.id, e)}
                            className="min-h-[44px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Xóa quán"
                          >
                            <Trash2 className="w-4 h-4" />
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

              {/* Simulated Interactive Vector Map Canvas */}
              <div className="relative w-full h-[360px] sm:h-[440px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center select-none">
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30"></div>

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
    </div>
  );
};
