import React, { useState, useEffect, useRef } from 'react';
import {
  EnrichedFoodPlace,
  getEnrichedFoodPlaces,
} from './services/restaurantService';
import { calculateRoute, RouteResult } from './services/routingService';
import { getCurrentDevicePosition, PRESET_LOCATIONS } from './utils/geoUtils';
import { MapContainer } from './components/MapContainer';
import { RestaurantSidebar } from './components/RestaurantSidebar';
import { NavigationSimulationPanel } from './components/NavigationSimulationPanel';
import { LocationPickerModal } from './components/LocationPickerModal';
import {
  Navigation,
  MapPin,
  Locate,
  List,
  Map as MapIcon,
  UtensilsCrossed,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // Default to Thanh Hà / Hà Nội coordinates until GPS resolves
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    address: string;
  }>({
    lat: 20.9315,
    lng: 105.7892,
    name: 'KĐT Thanh Hà Cienco 5',
    address: 'Khu Đô Thị Thanh Hà, Cự Khê, Thanh Oai, Hà Nội',
  });

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [minRating, setMinRating] = useState(0);

  // Selected place & Routing states
  const [selectedRestaurant, setSelectedRestaurant] = useState<EnrichedFoodPlace | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [selectedTravelMode, setSelectedTravelMode] = useState<'motorcycle' | 'driving' | 'walking'>('motorcycle');

  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedIndex, setSimulatedIndex] = useState(0);
  const [simulatedPosition, setSimulatedPosition] = useState<[number, number] | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState(2);

  // UI modal and mobile view toggles
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Load user GPS position on mount
  const handleRequestLiveGps = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const pos = await getCurrentDevicePosition();
      setUserLocation({
        lat: pos.latitude,
        lng: pos.longitude,
        name: pos.cityName || pos.building || pos.landmark || 'Vị trí hiện tại',
        address: pos.fullAddress || `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`,
      });
    } catch (err: any) {
      console.warn('Geolocation error or permission denied:', err);
      setLocationError('Không thể lấy vị trí tự động. Bạn có thể chọn địa điểm từ danh sách gợi ý.');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    handleRequestLiveGps();
  }, []);

  // Compute enriched food places near current userLocation
  const restaurants = getEnrichedFoodPlaces(
    userLocation.lat,
    userLocation.lng,
    selectedCategory,
    minRating,
    searchQuery,
    50,
    false
  );

  // Handle route calculation when user selects restaurant for navigation or changes transport mode
  const handleStartNavigationTo = async (
    restaurant: EnrichedFoodPlace,
    mode: 'motorcycle' | 'driving' | 'walking' = selectedTravelMode
  ) => {
    setSelectedRestaurant(restaurant);
    setIsLoadingRoute(true);
    setIsSimulating(false);
    setSimulatedIndex(0);
    setSimulatedPosition([userLocation.lat, userLocation.lng]);
    setMobileTab('map'); // Switch to map view to show route

    try {
      const route = await calculateRoute(
        userLocation.lat,
        userLocation.lng,
        restaurant.latitude,
        restaurant.longitude,
        mode
      );
      setActiveRoute(route);
      if (route.coordinates && route.coordinates.length > 0) {
        setSimulatedPosition(route.coordinates[0]);
      }
    } catch (err) {
      console.error('Failed to compute route:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Handle mode change in navigation panel
  const handleModeChange = (mode: 'motorcycle' | 'driving' | 'walking') => {
    setSelectedTravelMode(mode);
    if (selectedRestaurant) {
      handleStartNavigationTo(selectedRestaurant, mode);
    }
  };

  // Close navigation panel
  const handleCloseNavigation = () => {
    setActiveRoute(null);
    setIsSimulating(false);
    setSimulatedPosition(null);
    setSimulatedIndex(0);
  };

  // Simulation loop timer
  useEffect(() => {
    let intervalId: any;

    if (isSimulating && activeRoute && activeRoute.coordinates.length > 0) {
      const stepDurationMs = Math.max(80, Math.round(300 / simulationSpeed));

      intervalId = setInterval(() => {
        setSimulatedIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= activeRoute.coordinates.length) {
            setIsSimulating(false);
            setSimulatedPosition(activeRoute.coordinates[activeRoute.coordinates.length - 1]);
            return activeRoute.coordinates.length - 1;
          }
          setSimulatedPosition(activeRoute.coordinates[nextIndex]);
          return nextIndex;
        });
      }, stepDurationMs);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSimulating, activeRoute, simulationSpeed]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Top Header Styled with Google Maps Theme */}
      <header className="h-14 bg-white border-b border-slate-200 px-3 md:px-5 flex items-center justify-between shrink-0 z-30 shadow-xs">
        {/* Logo and App Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm md:text-base text-slate-900 tracking-tight">
                Google Maps <span className="text-blue-600 font-bold">Ẩm Thực</span>
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md">
                Quán Ngon ★
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden md:block">
              Tìm quán ăn đánh giá cao & dẫn đường mô phỏng trực tiếp trên bản đồ
            </p>
          </div>
        </div>

        {/* Current Location Badge & Location Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-full text-xs font-semibold border border-slate-200 transition max-w-[210px] sm:max-w-xs truncate shadow-2xs"
            title="Nhấp để đổi vị trí của bạn"
          >
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">{userLocation.name}</span>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {/* Quick GPS locate button */}
          <button
            onClick={handleRequestLiveGps}
            disabled={isLocating}
            title="Định vị GPS thực tế"
            className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center border border-blue-200 transition shrink-0"
          >
            <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Location Error Notification (if any) */}
      {locationError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-1.5 text-xs flex items-center justify-between z-20">
          <span>{locationError}</span>
          <button
            onClick={() => setLocationError(null)}
            className="text-amber-600 hover:text-amber-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar on Desktop (Restaurant List & Filters) */}
        <aside
          className={`w-full md:w-[380px] lg:w-[420px] shrink-0 h-full z-10 ${
            mobileTab === 'list' ? 'block' : 'hidden md:block'
          }`}
        >
          <RestaurantSidebar
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={(r) => {
              setSelectedRestaurant(r);
              // On mobile, if clicked, switch to map to see place
              if (window.innerWidth < 768) {
                setMobileTab('map');
              }
            }}
            onNavigateTo={handleStartNavigationTo}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            minRating={minRating}
            onMinRatingChange={setMinRating}
            userLocation={userLocation}
          />
        </aside>

        {/* Right Area: Interactive Map Container */}
        <main
          className={`flex-1 h-full relative ${
            mobileTab === 'map' ? 'block' : 'hidden md:block'
          }`}
        >
          <MapContainer
            userLocation={userLocation}
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            onNavigateTo={handleStartNavigationTo}
            activeRoute={activeRoute}
            simulatedPosition={simulatedPosition}
            isSimulating={isSimulating}
            onReLocateUser={handleRequestLiveGps}
            isLocating={isLocating}
          />

          {/* Floating Navigation Simulation Panel */}
          {activeRoute && selectedRestaurant && (
            <div className="absolute top-4 left-4 right-4 md:right-auto md:left-4 z-30 max-w-sm w-full">
              <NavigationSimulationPanel
                restaurant={selectedRestaurant}
                userLocation={userLocation}
                route={activeRoute}
                isLoadingRoute={isLoadingRoute}
                selectedMode={selectedTravelMode}
                onModeChange={handleModeChange}
                onClose={handleCloseNavigation}
                isSimulating={isSimulating}
                simulatedIndex={simulatedIndex}
                onStartSimulation={() => setIsSimulating(true)}
                onPauseSimulation={() => setIsSimulating(false)}
                onResetSimulation={() => {
                  setIsSimulating(false);
                  setSimulatedIndex(0);
                  if (activeRoute?.coordinates?.[0]) {
                    setSimulatedPosition(activeRoute.coordinates[0]);
                  }
                }}
                simulationSpeed={simulationSpeed}
                onSpeedChange={setSimulationSpeed}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Switcher (Bản đồ / Danh sách) */}
      <div className="md:hidden h-14 bg-white border-t border-slate-200 flex items-center justify-around px-4 shrink-0 z-30 shadow-lg">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex flex-col items-center gap-0.5 text-xs font-semibold py-1 px-4 rounded-xl transition ${
            mobileTab === 'map'
              ? 'text-blue-600 bg-blue-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span>Bản đồ ({restaurants.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('list')}
          className={`flex flex-col items-center gap-0.5 text-xs font-semibold py-1 px-4 rounded-xl transition ${
            mobileTab === 'list'
              ? 'text-blue-600 bg-blue-50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <List className="w-5 h-5" />
          <span>Danh sách quán</span>
        </button>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLat={userLocation.lat}
        currentLng={userLocation.lng}
        onSelectLocation={(loc) => {
          setUserLocation({
            lat: loc.lat,
            lng: loc.lng,
            name: loc.name,
            address: loc.address,
          });
          // Reset any ongoing route
          setActiveRoute(null);
          setIsSimulating(false);
          setSimulatedPosition(null);
        }}
        onRequestGps={handleRequestLiveGps}
        isLocating={isLocating}
      />
    </div>
  );
}
