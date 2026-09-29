/**
 * Geolocation & Map Navigation Utilities
 * Calculates real distances and provides direct turn-by-turn navigation via Google Maps
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  cityName?: string;
  fullAddress?: string;
}

// Default reference locations for Vietnam (used when GPS is unavailable or user chooses preset)
export const PRESET_LOCATIONS: Record<string, Coordinates> = {
  hanoi: {
    latitude: 21.0285,
    longitude: 105.8542,
    cityName: 'Hà Nội (Trung tâm Hoàn Kiếm)',
    fullAddress: 'Khu vực Hồ Hoàn Kiếm, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội',
  },
  hcm: {
    latitude: 10.7769,
    longitude: 106.7009,
    cityName: 'TP. Hồ Chí Minh (Quận 1)',
    fullAddress: 'Khu vực Nhà thờ Đức Bà, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  },
  danang: {
    latitude: 16.0544,
    longitude: 108.2022,
    cityName: 'Đà Nẵng (Hải Châu)',
    fullAddress: 'Khu vực Cầu Rồng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng',
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
 * Reverse Geocode: Get specific street, ward, district, city address from GPS coordinates
 * Uses OpenStreetMap Nominatim with safe fallback
 */
export async function reverseGeocodeAddress(
  lat: number,
  lng: number
): Promise<{ address: string; districtOrCity: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const road = addr.road || addr.suburb || addr.neighbourhood || '';
        const quarter = addr.quarter || addr.suburb || '';
        const district = addr.city_district || addr.district || addr.county || '';
        const city = addr.city || addr.state || 'Việt Nam';

        const shortParts = [road, quarter, district, city].filter(Boolean);
        const detailedShort = shortParts.length > 0 ? shortParts.join(', ') : data.display_name;

        return {
          address: detailedShort,
          districtOrCity: district ? `${district}, ${city}` : city,
        };
      }
    }
  } catch (err) {
    // ignore network or timeout errors
  }

  // Fallback estimation by closest major city
  const dHanoi = calculateDistanceKm(lat, lng, 21.0285, 105.8542);
  const dHcm = calculateDistanceKm(lat, lng, 10.7769, 106.7009);
  const dDanang = calculateDistanceKm(lat, lng, 16.0544, 108.2022);

  if (dHanoi < 60) {
    return {
      address: `Khu vực Hà Nội (Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      districtOrCity: 'Hà Nội',
    };
  } else if (dHcm < 60) {
    return {
      address: `Khu vực TP. Hồ Chí Minh (Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      districtOrCity: 'TP. Hồ Chí Minh',
    };
  } else if (dDanang < 60) {
    return {
      address: `Khu vực Đà Nẵng (Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      districtOrCity: 'Đà Nẵng',
    };
  }

  return {
    address: `Tọa độ GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    districtOrCity: 'Vị trí hiện tại',
  };
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
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        const coords: Coordinates = {
          latitude: lat,
          longitude: lng,
          accuracy,
          cityName: 'Vị trí GPS của bạn',
          fullAddress: `Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        };

        // Attempt quick reverse geocoding in background
        try {
          const geoInfo = await reverseGeocodeAddress(lat, lng);
          if (geoInfo) {
            coords.cityName = geoInfo.districtOrCity;
            coords.fullAddress = geoInfo.address;
          }
        } catch (e) {}

        resolve(coords);
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
