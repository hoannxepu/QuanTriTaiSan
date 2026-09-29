/**
 * Geolocation & Map Navigation Utilities
 * Calculates real distances and provides direct turn-by-turn navigation via Google Maps
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  cityName?: string;
}

// Default reference locations for Vietnam (used when GPS is unavailable or user chooses preset)
export const PRESET_LOCATIONS: Record<string, Coordinates> = {
  hanoi: {
    latitude: 21.0285,
    longitude: 105.8542,
    cityName: 'Hà Nội (Trung tâm Hoàn Kiếm)',
  },
  hcm: {
    latitude: 10.7769,
    longitude: 106.7009,
    cityName: 'TP. Hồ Chí Minh (Quận 1)',
  },
  danang: {
    latitude: 16.0544,
    longitude: 108.2022,
    cityName: 'Đà Nẵng (Hải Châu)',
  },
};

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance into a clean readable string (e.g. "450 m" or "2.3 km")
 */
export function formatDistance(distanceKm: number): string {
  if (isNaN(distanceKm) || distanceKm < 0) return '—';
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Generates direct Google Maps URL for directions / turn-by-turn navigation
 */
export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  destAddress?: string,
  userLat?: number,
  userLng?: number
): string {
  const destination = `${destLat},${destLng}`;
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  if (userLat && userLng) {
    url += `&origin=${encodeURIComponent(`${userLat},${userLng}`)}`;
  }
  url += '&travelmode=driving';
  return url;
}

/**
 * Request real device GPS position via browser Geolocation API
 */
export function getCurrentDevicePosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị GPS'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          cityName: 'Vị trí hiện tại của bạn (GPS)',
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
