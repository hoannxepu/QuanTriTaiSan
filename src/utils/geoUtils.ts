/**
 * Geolocation & Map Navigation Utilities
 * Calculates real distances, performs intelligent reverse geocoding with Vietnamese landmark & building detection,
 * down to exact house numbers, buildings, and provides direct turn-by-turn navigation & discovery via Google Maps
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  cityName?: string;
  fullAddress?: string;
  landmark?: string;
  building?: string;
  houseNumber?: string;
  road?: string;
}

// Exact Building & Unit Zones in Vietnam Urban Developments
export interface BuildingMicroZone {
  id: string;
  buildingName: string;
  fullAddress: string;
  districtOrCity: string;
  latitude: number;
  longitude: number;
  tag: string;
}

export const EXACT_BUILDING_PRESETS: BuildingMicroZone[] = [
  // Cụm tòa HH02-2 (B1.4 KĐT Thanh Hà)
  {
    id: 'thanhha_hh02_2a',
    buildingName: 'Tòa HH02-2A (Khu B1.4)',
    fullAddress: 'Tòa HH02-2A, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-2A Thanh Hà',
    latitude: 20.9492,
    longitude: 105.8078,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_2b',
    buildingName: 'Tòa HH02-2B (Khu B1.4)',
    fullAddress: 'Tòa HH02-2B, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-2B Thanh Hà',
    latitude: 20.9494,
    longitude: 105.8082,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_2c',
    buildingName: 'Tòa HH02-2C (Khu B1.4)',
    fullAddress: 'Tòa HH02-2C, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-2C Thanh Hà',
    latitude: 20.9490,
    longitude: 105.8075,
    tag: 'HH02 Thanh Hà',
  },

  // Cụm tòa HH02-1 (B1.4 KĐT Thanh Hà)
  {
    id: 'thanhha_hh02_1a',
    buildingName: 'Tòa HH02-1A (Khu B1.4)',
    fullAddress: 'Tòa HH02-1A, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-1A Thanh Hà',
    latitude: 20.9483,
    longitude: 105.8085,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_1b',
    buildingName: 'Tòa HH02-1B (Khu B1.4)',
    fullAddress: 'Tòa HH02-1B, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-1B Thanh Hà',
    latitude: 20.9487,
    longitude: 105.8090,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_1c',
    buildingName: 'Tòa HH02-1C (Khu B1.4)',
    fullAddress: 'Tòa HH02-1C, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH02-1C Thanh Hà',
    latitude: 20.9485,
    longitude: 105.8088,
    tag: 'HH02 Thanh Hà',
  },

  // Cụm tòa HH01 (KĐT Thanh Hà)
  {
    id: 'thanhha_hh01a',
    buildingName: 'Tòa HH01A (Khu HH01)',
    fullAddress: 'Tòa HH01A, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH01A Thanh Hà',
    latitude: 20.9528,
    longitude: 105.8092,
    tag: 'HH01 Thanh Hà',
  },
  {
    id: 'thanhha_hh01b',
    buildingName: 'Tòa HH01B (Khu HH01)',
    fullAddress: 'Tòa HH01B, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH01B Thanh Hà',
    latitude: 20.9525,
    longitude: 105.8098,
    tag: 'HH01 Thanh Hà',
  },
  {
    id: 'thanhha_hh01c',
    buildingName: 'Tòa HH01C (Khu HH01)',
    fullAddress: 'Tòa HH01C, Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'HH01C Thanh Hà',
    latitude: 20.9525,
    longitude: 105.8095,
    tag: 'HH01 Thanh Hà',
  },

  // Cụm tòa HH03 (Khu B2.1 KĐT Thanh Hà - Đường trục phía Nam)
  {
    id: 'thanhha_hh03d',
    buildingName: 'Tòa HH03D (Khu B2.1)',
    fullAddress: 'Tòa HH03D, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03D Thanh Hà',
    latitude: 20.9302079,
    longitude: 105.7844325,
    tag: 'HH03 Thanh Hà',
  },
  {
    id: 'thanhha_hh03c',
    buildingName: 'Tòa HH03C (Khu B2.1)',
    fullAddress: 'Tòa HH03C, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03C Thanh Hà',
    latitude: 20.9297419,
    longitude: 105.7844485,
    tag: 'HH03 Thanh Hà',
  },
  {
    id: 'thanhha_hh03b',
    buildingName: 'Tòa HH03B (Khu B2.1)',
    fullAddress: 'Tòa HH03B, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03B Thanh Hà',
    latitude: 20.9292960,
    longitude: 105.7844700,
    tag: 'HH03 Thanh Hà',
  },
  {
    id: 'thanhha_hh03a',
    buildingName: 'Tòa HH03A (Khu B2.1)',
    fullAddress: 'Tòa HH03A, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03A Thanh Hà',
    latitude: 20.9288601,
    longitude: 105.7844646,
    tag: 'HH03 Thanh Hà',
  },
  {
    id: 'thanhha_hh03e',
    buildingName: 'Tòa HH03E (Khu B2.1)',
    fullAddress: 'Tòa HH03E, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03E Thanh Hà',
    latitude: 20.9306689,
    longitude: 105.7844164,
    tag: 'HH03 Thanh Hà',
  },
  {
    id: 'thanhha_hh03f',
    buildingName: 'Tòa HH03F (Khu B2.1)',
    fullAddress: 'Tòa HH03F, Khu B2.1, KĐT Thanh Hà Cienco 5, Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'Tòa HH03F Thanh Hà',
    latitude: 20.9311048,
    longitude: 105.7843949,
    tag: 'HH03 Thanh Hà',
  },

  // Khu Liền kề & Biệt thự Thanh Hà
  {
    id: 'thanhha_lk_b14',
    buildingName: 'Khu Liền Kề B1.4',
    fullAddress: 'Khu Liền Kề B1.4, KĐT Thanh Hà Cienco 5, Cự Khê, Hà Nội',
    districtOrCity: 'Liền kề B1.4 Thanh Hà',
    latitude: 20.9510,
    longitude: 105.8115,
    tag: 'Liền kề Thanh Hà',
  },
  {
    id: 'thanhha_lk_a24',
    buildingName: 'Khu Liền Kề A2.4',
    fullAddress: 'Khu Liền Kề A2.4, KĐT Thanh Hà Cienco 5, Cự Khê, Hà Nội',
    districtOrCity: 'Liền kề A2.4 Thanh Hà',
    latitude: 20.9450,
    longitude: 105.8045,
    tag: 'Liền kề Thanh Hà',
  },
  {
    id: 'thanhha_ho_b21',
    buildingName: 'Khu Biệt Thự Ven Hồ B2.1',
    fullAddress: 'Ven Hồ Điều Hòa B2.1, KĐT Thanh Hà Cienco 5, Cự Khê, Hà Nội',
    districtOrCity: 'Hồ B2.1 Thanh Hà',
    latitude: 20.9465,
    longitude: 105.8062,
    tag: 'Hồ Thanh Hà',
  },

  // Khu vực lân cận
  {
    id: 'xala_ct4',
    buildingName: 'Chung cư CT4 Xa La',
    fullAddress: 'Chung cư CT4 KĐT Xa La, Phường Phúc La, Quận Hà Đông, Hà Nội',
    districtOrCity: 'CT4 Xa La, Hà Đông',
    latitude: 20.9620,
    longitude: 105.7950,
    tag: 'KĐT Xa La',
  },
  {
    id: 'vanphu_lacasta',
    buildingName: 'KĐT Văn Phú (Lacasta)',
    fullAddress: 'Khu Đô Thị Văn Phú (ngã tư Lacasta), P. Phú La, Q. Hà Đông, Hà Nội',
    districtOrCity: 'KĐT Văn Phú, Hà Đông',
    latitude: 20.9650,
    longitude: 105.7720,
    tag: 'KĐT Văn Phú',
  },
  {
    id: 'linhdam_hh2',
    buildingName: 'Chung cư HH Linh Đàm',
    fullAddress: 'Khu Tổ Hợp Chung Cư HH Linh Đàm, P. Hoàng Liệt, Q. Hoàng Mai, Hà Nội',
    districtOrCity: 'HH Linh Đàm',
    latitude: 20.9675,
    longitude: 105.8285,
    tag: 'KĐT Linh Đàm',
  },
];

// Vietnam Urban Landmarks for instant high-precision address resolution
export interface LandmarkZone {
  name: string;
  fullAddress: string;
  districtOrCity: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export const VIETNAM_LANDMARK_ZONES: LandmarkZone[] = [
  {
    name: 'Khu đô thị Thanh Hà Cienco 5',
    fullAddress: 'Khu đô thị Thanh Hà (Cienco 5), Cự Khê - Phú Lương, Hà Nội',
    districtOrCity: 'KĐT Thanh Hà, Hà Nội',
    centerLat: 20.9380,
    centerLng: 105.7950,
    radiusKm: 4.5,
  },
  {
    name: 'Khu đô thị Xa La',
    fullAddress: 'Khu đô thị Xa La, Phường Phúc La, Quận Hà Đông, Hà Nội',
    districtOrCity: 'KĐT Xa La, Hà Đông',
    centerLat: 20.9620,
    centerLng: 105.7950,
    radiusKm: 1.5,
  },
  {
    name: 'Khu đô thị Văn Phú',
    fullAddress: 'Khu đô thị Văn Phú, Phường Phú La, Quận Hà Đông, Hà Nội',
    districtOrCity: 'KĐT Văn Phú, Hà Đông',
    centerLat: 20.9650,
    centerLng: 105.7720,
    radiusKm: 1.8,
  },
  {
    name: 'Bán đảo Linh Đàm',
    fullAddress: 'Bán đảo Linh Đàm, Phường Hoàng Liệt, Quận Hoàng Mai, Hà Nội',
    districtOrCity: 'Linh Đàm, Hoàng Mai',
    centerLat: 20.9705,
    centerLng: 105.8280,
    radiusKm: 1.8,
  },
  {
    name: 'Khu đô thị Mỗ Lao',
    fullAddress: 'Khu đô thị Mỗ Lao, Phường Mộ Lao, Quận Hà Đông, Hà Nội',
    districtOrCity: 'Mỗ Lao, Hà Đông',
    centerLat: 20.9850,
    centerLng: 105.7870,
    radiusKm: 1.5,
  },
  {
    name: 'Vinhomes Smart City',
    fullAddress: 'Vinhomes Smart City, Phường Tây Mỗ, Quận Nam Từ Liêm, Hà Nội',
    districtOrCity: 'Smart City, Nam Từ Liêm',
    centerLat: 20.9990,
    centerLng: 105.7440,
    radiusKm: 2.2,
  },
  {
    name: 'Vinhomes Times City',
    fullAddress: 'KĐT Vinhomes Times City, Phường Vĩnh Tuy, Quận Hai Bà Trưng, Hà Nội',
    districtOrCity: 'Times City, Hai Bà Trưng',
    centerLat: 20.9950,
    centerLng: 105.8670,
    radiusKm: 1.5,
  },
  {
    name: 'Vinhomes Royal City',
    fullAddress: 'KĐT Royal City, 72A Nguyễn Trãi, Phường Thượng Đình, Quận Thanh Xuân, Hà Nội',
    districtOrCity: 'Royal City, Thanh Xuân',
    centerLat: 21.0025,
    centerLng: 105.8155,
    radiusKm: 1.2,
  },
  {
    name: 'Sân Vận Động Mỹ Đình',
    fullAddress: 'Khu vực Sân vận động Mỹ Đình, Quận Nam Từ Liêm, Hà Nội',
    districtOrCity: 'Mỹ Đình, Nam Từ Liêm',
    centerLat: 21.0200,
    centerLng: 105.7650,
    radiusKm: 2.0,
  },
  {
    name: 'Cầu Giấy (Duy Tân)',
    fullAddress: 'Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
    districtOrCity: 'Cầu Giấy, Hà Nội',
    centerLat: 21.0310,
    centerLng: 105.7830,
    radiusKm: 1.5,
  },
  {
    name: 'Phố Cổ Hoàn Kiếm',
    fullAddress: 'Khu vực Phố Cổ - Hồ Hoàn Kiếm, Quận Hoàn Kiếm, Hà Nội',
    districtOrCity: 'Hoàn Kiếm, Hà Nội',
    centerLat: 21.0285,
    centerLng: 105.8542,
    radiusKm: 2.0,
  },
  {
    name: 'Trung tâm Quận 1 TP.HCM',
    fullAddress: 'Khu vực Nhà thờ Đức Bà - Chợ Bến Thành, Quận 1, TP. Hồ Chí Minh',
    districtOrCity: 'Quận 1, TP. Hồ Chí Minh',
    centerLat: 10.7769,
    centerLng: 106.7009,
    radiusKm: 2.5,
  },
  {
    name: 'Trung tâm Đà Nẵng',
    fullAddress: 'Khu vực Cầu Rồng - Sông Hàn, Quận Hải Châu, Đà Nẵng',
    districtOrCity: 'Hải Châu, Đà Nẵng',
    centerLat: 16.0544,
    centerLng: 108.2022,
    radiusKm: 3.0,
  },
];

// Reference preset locations for Vietnam (Allows 1-tap switching)
export const PRESET_LOCATIONS: Record<string, Coordinates> = {
  thanhha: {
    latitude: 20.9302079,
    longitude: 105.7844325,
    cityName: 'Tòa HH03D Thanh Hà',
    fullAddress: 'Tòa HH03D, Khu B2.1, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    landmark: 'Khu đô thị Thanh Hà Cienco 5',
    building: 'Tòa HH03D (Khu B2.1)',
  },
  xala: {
    latitude: 20.9620,
    longitude: 105.7950,
    cityName: 'KĐT Xa La (Hà Đông)',
    fullAddress: 'Khu đô thị Xa La, Phường Phúc La, Quận Hà Đông, Hà Nội',
    landmark: 'Khu đô thị Xa La',
  },
  vanphu: {
    latitude: 20.9650,
    longitude: 105.7720,
    cityName: 'KĐT Văn Phú (Hà Đông)',
    fullAddress: 'Khu đô thị Văn Phú, Phường Phú La, Quận Hà Đông, Hà Nội',
    landmark: 'Khu đô thị Văn Phú',
  },
  linhdam: {
    latitude: 20.9705,
    longitude: 105.8280,
    cityName: 'KĐT Linh Đàm (Hoàng Mai)',
    fullAddress: 'Bán đảo Linh Đàm, Phường Hoàng Liệt, Quận Hoàng Mai, Hà Nội',
    landmark: 'Bán đảo Linh Đàm',
  },
  thanhxuan: {
    latitude: 21.0005,
    longitude: 105.8170,
    cityName: 'Thanh Xuân (Ngã Tư Sở)',
    fullAddress: 'Khu vực Ngã Tư Sở - Royal City, Quận Thanh Xuân, Hà Nội',
    landmark: 'Royal City',
  },
  caugiay: {
    latitude: 21.0310,
    longitude: 105.7830,
    cityName: 'Cầu Giấy (Duy Tân)',
    fullAddress: 'Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
    landmark: 'Cầu Giấy',
  },
  mydinh: {
    latitude: 21.0180,
    longitude: 105.7730,
    cityName: 'Mỹ Đình (Nam Từ Liêm)',
    fullAddress: 'Khu vực Sân vận động Mỹ Đình, Quận Nam Từ Liêm, Hà Nội',
    landmark: 'Sân Vận Động Mỹ Đình',
  },
  hanoi: {
    latitude: 21.0285,
    longitude: 105.8542,
    cityName: 'Hoàn Kiếm (Phố Cổ)',
    fullAddress: 'Hồ Hoàn Kiếm, Phường Hàng Bạc, Quận Hoàn Kiếm, Hà Nội',
    landmark: 'Phố Cổ Hoàn Kiếm',
  },
  hcm: {
    latitude: 10.7769,
    longitude: 106.7009,
    cityName: 'TP. Hồ Chí Minh (Quận 1)',
    fullAddress: 'Khu vực Nhà thờ Đức Bà, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    landmark: 'Quận 1',
  },
  danang: {
    latitude: 16.0544,
    longitude: 108.2022,
    cityName: 'Đà Nẵng (Hải Châu)',
    fullAddress: 'Khu vực Cầu Rồng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng',
    landmark: 'Cầu Rồng',
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
 * Returns practical travel time and transport mode advice based on distance
 */
export function formatTravelEstimate(distanceKm: number): {
  badgeText: string;
  isSuperClose: boolean;
  isNearby: boolean;
  timeEstimate: string;
} {
  if (isNaN(distanceKm) || distanceKm < 0) {
    return { badgeText: '—', isSuperClose: false, isNearby: false, timeEstimate: '' };
  }

  if (distanceKm <= 0.6) {
    const walkMinutes = Math.max(1, Math.round(distanceKm * 12));
    return {
      badgeText: `⚡ Siêu gần (${Math.round(distanceKm * 1000)}m)`,
      isSuperClose: true,
      isNearby: true,
      timeEstimate: `Đi bộ ~${walkMinutes}p`,
    };
  }

  if (distanceKm <= 2.0) {
    const rideMinutes = Math.max(2, Math.round(distanceKm * 2.5));
    return {
      badgeText: `🛵 Rất gần (${distanceKm.toFixed(1)} km)`,
      isSuperClose: false,
      isNearby: true,
      timeEstimate: `Đi xe ~${rideMinutes}p`,
    };
  }

  if (distanceKm <= 5.0) {
    const driveMinutes = Math.round(distanceKm * 2.5);
    return {
      badgeText: `🚗 ${distanceKm.toFixed(1)} km`,
      isSuperClose: false,
      isNearby: false,
      timeEstimate: `Đi xe ~${driveMinutes}p`,
    };
  }

  return {
    badgeText: `📍 ${distanceKm.toFixed(1)} km`,
    isSuperClose: false,
    isNearby: false,
    timeEstimate: '',
  };
}

/**
 * Finds the closest exact building preset if coordinates fall within 150m - 200m
 */
export function detectExactBuilding(lat: number, lng: number): BuildingMicroZone | null {
  let closest: BuildingMicroZone | null = null;
  let minDistance = 0.25; // 250m max threshold

  for (const b of EXACT_BUILDING_PRESETS) {
    const dist = calculateDistanceKm(lat, lng, b.latitude, b.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closest = b;
    }
  }

  return closest;
}

/**
 * Identifies if coordinates fall within known urban landmark zones
 */
export function detectVietnamLandmark(lat: number, lng: number): LandmarkZone | null {
  for (const zone of VIETNAM_LANDMARK_ZONES) {
    const dist = calculateDistanceKm(lat, lng, zone.centerLat, zone.centerLng);
    if (dist <= zone.radiusKm) {
      return zone;
    }
  }
  return null;
}

/**
 * High-reliability Reverse Geocoding with multi-tier fallback down to exact building/house number:
 * 1. Building Micro-Zone Detector (Exact HH02-2A, HH01, HH03, v.v.)
 * 2. Server Proxy /api/reverse-geocode (Full headers, exact road and house_number)
 * 3. Client BigDataCloud Reverse Geocode API
 * 4. Regional fallback
 */
export async function reverseGeocodeAddress(
  lat: number,
  lng: number
): Promise<{
  address: string;
  districtOrCity: string;
  landmark?: string;
  building?: string;
  houseNumber?: string;
}> {
  // Step 1: Detect building with micro precision (100-200m)
  const exactBuilding = detectExactBuilding(lat, lng);
  const landmark = detectVietnamLandmark(lat, lng);

  // Step 2: Try Server Proxy endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.address) {
        return {
          address: exactBuilding ? exactBuilding.fullAddress : data.address,
          districtOrCity: exactBuilding ? exactBuilding.districtOrCity : data.districtOrCity,
          landmark: data.landmark || landmark?.name,
          building: exactBuilding ? exactBuilding.buildingName : data.building,
          houseNumber: data.houseNumber,
        };
      }
    }
  } catch (e) {
    // Proceed to client fallback
  }

  // Step 3: If exact building matched
  if (exactBuilding) {
    return {
      address: exactBuilding.fullAddress,
      districtOrCity: exactBuilding.districtOrCity,
      landmark: landmark?.name || 'KĐT Thanh Hà Cienco 5',
      building: exactBuilding.buildingName,
    };
  }

  // Step 4: Client BigDataCloud API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`;
    const res = await fetch(bdcUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data) {
        const locality = data.locality || data.principalSubdivision || '';
        const city = data.city || data.principalSubdivision || 'Hà Nội';

        if (landmark) {
          return {
            address: `${landmark.fullAddress}`,
            districtOrCity: landmark.districtOrCity,
            landmark: landmark.name,
          };
        }

        const parts = [data.locality, data.city, data.principalSubdivision].filter(Boolean);
        const detailed = parts.length > 0 ? parts.join(', ') : 'Hà Nội';
        return {
          address: detailed,
          districtOrCity: locality ? `${locality}, ${city}` : city,
        };
      }
    }
  } catch (e) {
    // Proceed
  }

  // Step 5: If landmark matched earlier
  if (landmark) {
    return {
      address: landmark.fullAddress,
      districtOrCity: landmark.districtOrCity,
      landmark: landmark.name,
    };
  }

  // Step 6: Regional fallback without raw number strings
  const dHanoi = calculateDistanceKm(lat, lng, 21.0285, 105.8542);
  const dHcm = calculateDistanceKm(lat, lng, 10.7769, 106.7009);
  const dDanang = calculateDistanceKm(lat, lng, 16.0544, 108.2022);

  if (dHanoi < 70) {
    return {
      address: 'Khu vực Hà Nội',
      districtOrCity: 'Hà Nội',
    };
  } else if (dHcm < 70) {
    return {
      address: 'Khu vực TP. Hồ Chí Minh',
      districtOrCity: 'TP. Hồ Chí Minh',
    };
  } else if (dDanang < 70) {
    return {
      address: 'Khu vực Đà Nẵng',
      districtOrCity: 'Đà Nẵng',
    };
  }

  return {
    address: 'Vị trí hiện tại của bạn',
    districtOrCity: 'Việt Nam',
  };
}

/**
 * Searches address, building, or house number via backend search API
 */
export async function searchAddressOnMap(query: string): Promise<
  Array<{
    name: string;
    fullAddress: string;
    districtOrCity: string;
    lat: number;
    lng: number;
  }>
> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // Match local presets first
  const qLower = cleanQ.toLowerCase();
  const localMatches = EXACT_BUILDING_PRESETS.filter(
    (b) =>
      b.buildingName.toLowerCase().includes(qLower) ||
      b.fullAddress.toLowerCase().includes(qLower) ||
      b.tag.toLowerCase().includes(qLower)
  ).map((b) => ({
    name: b.buildingName,
    fullAddress: b.fullAddress,
    districtOrCity: b.districtOrCity,
    lat: b.latitude,
    lng: b.longitude,
  }));

  try {
    const res = await fetch(`/api/search-address?q=${encodeURIComponent(cleanQ)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        // Merge without duplicates
        const combined = [...localMatches];
        for (const item of data.results) {
          if (!combined.some((c) => Math.abs(c.lat - item.lat) < 0.001 && Math.abs(c.lng - item.lng) < 0.001)) {
            combined.push(item);
          }
        }
        return combined;
      }
    }
  } catch (e) {}

  return localMatches;
}

/**
 * Generates direct Google Maps URL for turn-by-turn navigation
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
 * Generates direct Google Maps search URL to discover nearby food places around coordinates
 */
export function getGoogleMapsNearbyFoodUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/quán+ăn+ngon/@${lat},${lng},16z`;
}

/**
 * Generates direct Google Maps URL to view user's current pin location
 */
export function getGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
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

        // Check exact building and landmark immediately
        const exactBuilding = detectExactBuilding(lat, lng);
        const landmark = detectVietnamLandmark(lat, lng);

        const coords: Coordinates = {
          latitude: lat,
          longitude: lng,
          accuracy,
          cityName: exactBuilding ? exactBuilding.districtOrCity : landmark ? landmark.districtOrCity : 'Vị trí của bạn',
          fullAddress: exactBuilding ? exactBuilding.fullAddress : landmark ? landmark.fullAddress : 'Đang định vị địa chỉ...',
          landmark: landmark?.name,
          building: exactBuilding?.buildingName,
        };

        // Attempt reverse geocoding in background
        try {
          const geoInfo = await reverseGeocodeAddress(lat, lng);
          if (geoInfo && geoInfo.address) {
            coords.cityName = geoInfo.districtOrCity;
            coords.fullAddress = geoInfo.address;
            coords.landmark = geoInfo.landmark || landmark?.name;
            coords.building = geoInfo.building || exactBuilding?.buildingName;
            coords.houseNumber = geoInfo.houseNumber;
          }
        } catch (e) {
          // Keep building or landmark
        }

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
