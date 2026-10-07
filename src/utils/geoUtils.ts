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

  // Cụm tòa HH02-2 (B1.4 KĐT Thanh Hà)
  {
    id: 'thanhha_hh02_2a',
    buildingName: 'Tòa HH02-2A (Khu B1.4)',
    fullAddress: 'Tòa HH02-2A, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-2A Thanh Hà',
    latitude: 20.929798,
    longitude: 105.788330,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_2b',
    buildingName: 'Tòa HH02-2B (Khu B1.4)',
    fullAddress: 'Tòa HH02-2B, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-2B Thanh Hà',
    latitude: 20.930100,
    longitude: 105.788700,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_2c',
    buildingName: 'Tòa HH02-2C (Khu B1.4)',
    fullAddress: 'Tòa HH02-2C, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-2C Thanh Hà',
    latitude: 20.929500,
    longitude: 105.788100,
    tag: 'HH02 Thanh Hà',
  },

  // Cụm tòa HH02-1 (B1.4 KĐT Thanh Hà)
  {
    id: 'thanhha_hh02_1a',
    buildingName: 'Tòa HH02-1A (Khu B1.4)',
    fullAddress: 'Tòa HH02-1A, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-1A Thanh Hà',
    latitude: 20.931200,
    longitude: 105.788900,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_1b',
    buildingName: 'Tòa HH02-1B (Khu B1.4)',
    fullAddress: 'Tòa HH02-1B, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-1B Thanh Hà',
    latitude: 20.931500,
    longitude: 105.789200,
    tag: 'HH02 Thanh Hà',
  },
  {
    id: 'thanhha_hh02_1c',
    buildingName: 'Tòa HH02-1C (Khu B1.4)',
    fullAddress: 'Tòa HH02-1C, Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH02-1C Thanh Hà',
    latitude: 20.931800,
    longitude: 105.789500,
    tag: 'HH02 Thanh Hà',
  },

  // Cụm tòa HH01 (B1.4 KĐT Thanh Hà)
  {
    id: 'thanhha_hh01a',
    buildingName: 'Tòa HH01A (Khu B1.4)',
    fullAddress: 'Tòa HH01A, B1.4 Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH01A Thanh Hà',
    latitude: 20.933050,
    longitude: 105.791817,
    tag: 'HH01 Thanh Hà',
  },
  {
    id: 'thanhha_hh01b',
    buildingName: 'Tòa HH01B (Khu B1.4)',
    fullAddress: 'Tòa HH01B, B1.4 Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH01B Thanh Hà',
    latitude: 20.933523,
    longitude: 105.792155,
    tag: 'HH01 Thanh Hà',
  },
  {
    id: 'thanhha_hh01c',
    buildingName: 'Tòa HH01C (Khu B1.4)',
    fullAddress: 'Tòa HH01C, B1.4 Khu Đô Thị Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'HH01C Thanh Hà',
    latitude: 20.933808,
    longitude: 105.791725,
    tag: 'HH01 Thanh Hà',
  },

  // Khu Liền kề & Biệt thự Thanh Hà
  {
    id: 'thanhha_lk_b14',
    buildingName: 'Khu Liền Kề B1.4',
    fullAddress: 'Khu Liền Kề B1.4, KĐT Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'Liền kề B1.4 Thanh Hà',
    latitude: 20.9330,
    longitude: 105.7910,
    tag: 'Liền kề Thanh Hà',
  },
  {
    id: 'thanhha_lk_a24',
    buildingName: 'Khu Liền Kề A2.4',
    fullAddress: 'Khu Liền Kề A2.4, KĐT Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'Liền kề A2.4 Thanh Hà',
    latitude: 20.9340,
    longitude: 105.7820,
    tag: 'Liền kề Thanh Hà',
  },
  {
    id: 'thanhha_ho_b21',
    buildingName: 'Khu Biệt Thự Ven Hồ B2.1',
    fullAddress: 'Ven Hồ Điều Hòa B2.1, KĐT Thanh Hà Cienco 5, Hà Nội',
    districtOrCity: 'Hồ B2.1 Thanh Hà',
    latitude: 20.9315,
    longitude: 105.7865,
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
    fullAddress: 'Khu đô thị Thanh Hà (Cienco 5), Cự Khê, Thanh Oai, Hà Nội',
    districtOrCity: 'KĐT Thanh Hà, Hà Nội',
    centerLat: 20.9355,
    centerLng: 105.7885,
    radiusKm: 0.8,
  },
  {
    name: 'Khu đô thị Xa La',
    fullAddress: 'Khu đô thị Xa La, Phường Phúc La, Quận Hà Đông, Hà Nội',
    districtOrCity: 'KĐT Xa La, Hà Đông',
    centerLat: 20.9620,
    centerLng: 105.7950,
    radiusKm: 0.8,
  },
  {
    name: 'Khu đô thị Văn Phú',
    fullAddress: 'Khu đô thị Văn Phú, Phường Phú La, Quận Hà Đông, Hà Nội',
    districtOrCity: 'KĐT Văn Phú, Hà Đông',
    centerLat: 20.9650,
    centerLng: 105.7720,
    radiusKm: 0.8,
  },
  {
    name: 'Bán đảo Linh Đàm',
    fullAddress: 'Bán đảo Linh Đàm, Phường Hoàng Liệt, Quận Hoàng Mai, Hà Nội',
    districtOrCity: 'Linh Đàm, Hoàng Mai',
    centerLat: 20.9705,
    centerLng: 105.8280,
    radiusKm: 0.8,
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

// Reference preset locations for Vietnam & Worldwide (Allows 1-tap switching anywhere like Google Maps)
export const PRESET_LOCATIONS: Record<string, Coordinates> = {
  // --- KĐT Thanh Hà (Từng tòa nhà & khu vực chi tiết trên Google Maps) ---
  thanhha: {
    latitude: 20.9315,
    longitude: 105.7892,
    cityName: 'KĐT Thanh Hà (Hà Nội)',
    fullAddress: 'Khu Đô Thị Thanh Hà Cienco 5, Cự Khê, Thanh Oai, Hà Nội',
    landmark: 'Khu đô thị Thanh Hà Cienco 5',
    building: 'KĐT Thanh Hà Cienco 5',
  },
  thanhha_hh022a: {
    latitude: 20.929798,
    longitude: 105.788330,
    cityName: 'Tòa HH02-2A Thanh Hà',
    fullAddress: 'Tòa HH02-2A Khu Đô Thị Thanh Hà, Cự Khê, Thanh Oai, Hà Nội',
    landmark: 'Tòa HH02-2A',
    building: 'HH02-2A Thanh Hà',
    accuracy: 5,
  },
  thanhha_hh021b: {
    latitude: 20.931500,
    longitude: 105.789200,
    cityName: 'Tòa HH02-1B Thanh Hà',
    fullAddress: 'Tòa HH02-1B Khu Đô Thị Thanh Hà, Cự Khê, Thanh Oai, Hà Nội',
    landmark: 'Tòa HH02-1B',
    building: 'HH02-1B Thanh Hà',
    accuracy: 5,
  },
  thanhha_hh01c: {
    latitude: 20.938500,
    longitude: 105.787200,
    cityName: 'Tòa HH01C Thanh Hà',
    fullAddress: 'Tòa HH01C Khu Đô Thị Thanh Hà, Cự Khê, Thanh Oai, Hà Nội',
    landmark: 'Tòa HH01C',
    building: 'HH01C Thanh Hà',
    accuracy: 5,
  },
  thanhha_b14: {
    latitude: 20.934800,
    longitude: 105.787600,
    cityName: 'Liền Kề B1.4 Thanh Hà',
    fullAddress: 'Khu Liền Kề B1.4, Khu Đô Thị Thanh Hà, Hà Đông, Hà Nội',
    landmark: 'B1.4 Thanh Hà',
    building: 'Liền kề B1.4 Thanh Hà',
    accuracy: 5,
  },
  thanhha_b21: {
    latitude: 20.932500,
    longitude: 105.786500,
    cityName: 'Hồ Điều Hòa B2.1 Thanh Hà',
    fullAddress: 'Ven Hồ Điều Hòa B2.1, Khu Đô Thị Thanh Hà, Hà Nội',
    landmark: 'Hồ B2.1 Thanh Hà',
    building: 'Ven Hồ B2.1 Thanh Hà',
    accuracy: 5,
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

  // --- Các thành phố lớn Việt Nam (Bắc - Trung - Nam) ---
  hcm: {
    latitude: 10.7769,
    longitude: 106.7009,
    cityName: 'TP. Hồ Chí Minh (Quận 1)',
    fullAddress: 'Khu vực Chợ Bến Thành - Nhà thờ Đức Bà, Quận 1, TP. Hồ Chí Minh',
    landmark: 'Quận 1 TP.HCM',
  },
  danang: {
    latitude: 16.0544,
    longitude: 108.2022,
    cityName: 'Đà Nẵng (Hải Châu)',
    fullAddress: 'Khu vực Cầu Rồng - Sông Hàn, Quận Hải Châu, TP. Đà Nẵng',
    landmark: 'Cầu Rồng Đà Nẵng',
  },
  haiphong: {
    latitude: 20.8449,
    longitude: 106.6881,
    cityName: 'Hải Phòng (Hồng Bàng)',
    fullAddress: 'Khu vực Nhà Hát Lớn Hải Phòng, Quận Hồng Bàng, TP. Hải Phòng',
    landmark: 'Nhà Hát Lớn Hải Phòng',
  },
  cantho: {
    latitude: 10.0452,
    longitude: 105.7469,
    cityName: 'Cần Thơ (Ninh Kiều)',
    fullAddress: 'Khu vực Bến Ninh Kiều, Quận Ninh Kiều, TP. Cần Thơ',
    landmark: 'Bến Ninh Kiều',
  },
  nhatrang: {
    latitude: 12.2388,
    longitude: 109.1967,
    cityName: 'Nha Trang (Khánh Hòa)',
    fullAddress: 'Quảng Trường 2/4 - Tháp Trầm Hương, TP. Nha Trang, Tỉnh Khánh Hòa',
    landmark: 'Tháp Trầm Hương Nha Trang',
  },
  dalat: {
    latitude: 11.9404,
    longitude: 108.4583,
    cityName: 'Đà Lạt (Lâm Đồng)',
    fullAddress: 'Quảng Trường Lâm Viên - Hồ Xuân Hương, TP. Đà Lạt, Tỉnh Lâm Đồng',
    landmark: 'Hồ Xuân Hương Đà Lạt',
  },
  hue: {
    latitude: 16.4637,
    longitude: 107.5909,
    cityName: 'Thừa Thiên Huế (Đại Nội)',
    fullAddress: 'Khu vực Kinh Thành Huế - Đại Nội, TP. Huế, Tỉnh Thừa Thiên Huế',
    landmark: 'Đại Nội Huế',
  },
  vungtau: {
    latitude: 10.3460,
    longitude: 107.0843,
    cityName: 'Vũng Tàu (Bãi Trước)',
    fullAddress: 'Khu vực Bãi Trước - Công Viên Bãi Trước, TP. Vũng Tàu, Tỉnh Bà Rịa - Vũng Tàu',
    landmark: 'Bãi Trước Vũng Tàu',
  },
  phuquoc: {
    latitude: 10.2289,
    longitude: 103.9572,
    cityName: 'Phú Quốc (Kiên Giang)',
    fullAddress: 'Khu vực Chợ Đêm Phú Quốc - Dương Đông, TP. Phú Quốc, Tỉnh Kiên Giang',
    landmark: 'Chợ Đêm Phú Quốc',
  },
  halong: {
    latitude: 20.9599,
    longitude: 107.0453,
    cityName: 'Hạ Long (Quảng Ninh)',
    fullAddress: 'Khu du lịch Bãi Cháy - Vịnh Hạ Long, TP. Hạ Long, Tỉnh Quảng Ninh',
    landmark: 'Bãi Cháy Vịnh Hạ Long',
  },
  sapa: {
    latitude: 22.3364,
    longitude: 103.8438,
    cityName: 'Sa Pa (Lào Cai)',
    fullAddress: 'Khu vực Nhà thờ đá Sa Pa, Thị xã Sa Pa, Tỉnh Lào Cai',
    landmark: 'Nhà thờ đá Sa Pa',
  },

  // --- Các điểm đến quốc tế nổi tiếng (International Hotspots) ---
  tokyo: {
    latitude: 35.6586,
    longitude: 139.7454,
    cityName: 'Tokyo (Nhật Bản)',
    fullAddress: 'Khu vực Tháp Tokyo & Roppongi, Minato-ku, Tokyo, Nhật Bản',
    landmark: 'Tokyo Tower, Japan',
  },
  singapore: {
    latitude: 1.2838,
    longitude: 103.8591,
    cityName: 'Singapore (Marina Bay)',
    fullAddress: 'Marina Bay Sands - Vịnh Marina, Singapore 018956',
    landmark: 'Marina Bay Sands, Singapore',
  },
  bangkok: {
    latitude: 13.7469,
    longitude: 100.5349,
    cityName: 'Bangkok (Thái Lan)',
    fullAddress: 'Khu vực Siam Paragon - Central World, Pathum Wan, Bangkok, Thái Lan',
    landmark: 'Siam Bangkok, Thailand',
  },
  seoul: {
    latitude: 37.5512,
    longitude: 126.9882,
    cityName: 'Seoul (Hàn Quốc)',
    fullAddress: 'Khu vực Tháp N Seoul - Myeongdong, Jung-gu, Seoul, Hàn Quốc',
    landmark: 'N Seoul Tower, Korea',
  },
  paris: {
    latitude: 48.8584,
    longitude: 2.2945,
    cityName: 'Paris (Pháp)',
    fullAddress: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, Pháp',
    landmark: 'Eiffel Tower, Paris',
  },
  london: {
    latitude: 51.5007,
    longitude: -0.1246,
    cityName: 'London (Vương quốc Anh)',
    fullAddress: 'Westminster - Big Ben, London SW1A 0AA, Vương quốc Anh',
    landmark: 'Big Ben, London',
  },
  newyork: {
    latitude: 40.7580,
    longitude: -73.9855,
    cityName: 'New York (Hoa Kỳ)',
    fullAddress: 'Times Square - Broadway & 7th Ave, Manhattan, New York, NY 10036, Hoa Kỳ',
    landmark: 'Times Square, New York',
  },
  sydney: {
    latitude: -33.8568,
    longitude: 151.2153,
    cityName: 'Sydney (Australia)',
    fullAddress: 'Bennelong Point, Sydney NSW 2000, Australia (Nhà hát Opera)',
    landmark: 'Sydney Opera House',
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
 * Calculates compass bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
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
 * Finds the closest exact building preset if coordinates fall within 150m - 500m
 * With special sensitivity for urban apartment complexes like KĐT Thanh Hà
 */
export function detectExactBuilding(lat: number, lng: number): BuildingMicroZone | null {
  // Check if within Thanh Hà Urban Area perimeter
  const isInsideThanhHa = lat >= 20.915 && lat <= 20.945 && lng >= 105.770 && lng <= 105.805;
  // Chỉ gán tòa nhà cụ thể khi thiết bị đứng trong bán kính < 60m (tránh gán sai tòa nhà lân cận)
  let minDistance = isInsideThanhHa ? 0.06 : 0.04;
  let closest: BuildingMicroZone | null = null;

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
          address: data.fullAddress || data.address,
          districtOrCity: data.districtOrCity || (exactBuilding ? exactBuilding.districtOrCity : ''),
          landmark: data.landmark || landmark?.name,
          building: data.building || exactBuilding?.buildingName,
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
        const country = data.countryName || '';
        const locality = data.locality || data.principalSubdivision || '';
        const city = data.city || data.principalSubdivision || (country ? country : 'Vị trí hiện tại');

        if (landmark) {
          return {
            address: `${landmark.fullAddress}`,
            districtOrCity: landmark.districtOrCity,
            landmark: landmark.name,
          };
        }

        const parts = [data.locality, data.city, data.principalSubdivision, country].filter(Boolean);
        const detailed = parts.length > 0 ? parts.join(', ') : (country ? `${city}, ${country}` : city);
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

  // Step 6: Regional fallback without raw number strings (Phủ toàn quốc và quốc tế)
  const dHanoi = calculateDistanceKm(lat, lng, 21.0285, 105.8542);
  const dHcm = calculateDistanceKm(lat, lng, 10.7769, 106.7009);
  const dDanang = calculateDistanceKm(lat, lng, 16.0544, 108.2022);
  const dHaiPhong = calculateDistanceKm(lat, lng, 20.8449, 106.6881);
  const dCanTho = calculateDistanceKm(lat, lng, 10.0452, 105.7469);
  const dNhaTrang = calculateDistanceKm(lat, lng, 12.2388, 109.1967);
  const dDaLat = calculateDistanceKm(lat, lng, 11.9404, 108.4583);
  const dHue = calculateDistanceKm(lat, lng, 16.4637, 107.5909);
  const dVungTau = calculateDistanceKm(lat, lng, 10.3460, 107.0843);

  if (dHanoi < 60) return { address: 'Khu vực Hà Nội, Việt Nam', districtOrCity: 'Hà Nội' };
  if (dHcm < 60) return { address: 'Khu vực TP. Hồ Chí Minh, Việt Nam', districtOrCity: 'TP. Hồ Chí Minh' };
  if (dDanang < 60) return { address: 'Khu vực Đà Nẵng, Việt Nam', districtOrCity: 'Đà Nẵng' };
  if (dHaiPhong < 50) return { address: 'Khu vực Hải Phòng, Việt Nam', districtOrCity: 'Hải Phòng' };
  if (dCanTho < 50) return { address: 'Khu vực Cần Thơ, Việt Nam', districtOrCity: 'Cần Thơ' };
  if (dNhaTrang < 50) return { address: 'Khu vực Nha Trang, Khánh Hòa', districtOrCity: 'Nha Trang' };
  if (dDaLat < 50) return { address: 'Khu vực Đà Lạt, Lâm Đồng', districtOrCity: 'Đà Lạt' };
  if (dHue < 50) return { address: 'Khu vực TP. Huế, Thừa Thiên Huế', districtOrCity: 'Huế' };
  if (dVungTau < 50) return { address: 'Khu vực Vũng Tàu, Bà Rịa - Vũng Tàu', districtOrCity: 'Vũng Tàu' };

  const isInsideVn = lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.5;
  return {
    address: isInsideVn ? `Vị trí tại Việt Nam (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `Vị trí quốc tế (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    districtOrCity: isInsideVn ? 'Việt Nam' : 'Quốc tế',
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

  // Match coordinates directly (e.g., "10.7769, 106.7009" or "35.6586, 139.7454")
  const coordMatch = cleanQ.match(/([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)/);
  if (coordMatch) {
    const parsedLat = parseFloat(coordMatch[1]);
    const parsedLng = parseFloat(coordMatch[2]);
    if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
      return [{
        name: `Tọa độ GPS (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`,
        fullAddress: `Tọa độ vị trí: ${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`,
        districtOrCity: `GPS: ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
        lat: parsedLat,
        lng: parsedLng,
      }];
    }
  }

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
      signal: AbortSignal.timeout(5000),
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
 * Quick Google Maps Amenity Search around coordinates
 */
export function getGoogleMapsNearbyUrl(
  category: 'food' | 'cafe' | 'gas' | 'supermarket' | 'atm' | 'pharmacy' | 'hotel',
  lat: number,
  lng: number
): string {
  const queryMap: Record<string, string> = {
    food: 'quán ăn ngon',
    cafe: 'quán cà phê',
    gas: 'cây xăng',
    supermarket: 'siêu thị tiện lợi',
    atm: 'cây ATM ngân hàng',
    pharmacy: 'nhà thuốc hiệu thuốc',
    hotel: 'khách sạn nhà nghỉ',
  };
  const q = queryMap[category] || 'quán ăn ngon';
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${lat},${lng},15z`;
}

/**
 * Generates direct Google Maps URL for turn-by-turn navigation.
 * Uses exact GPS coordinates for origin and destination so Google Maps routes 100% accurately:
 * - Điểm bắt đầu: Tọa độ GPS chính xác tuyệt đối từ thiết bị / vị trí đã chọn
 * - Điểm đến: Tọa độ GPS chính xác của quán ăn
 */
/**
 * Generates direct Google Maps URL for turn-by-turn navigation.
 * Uses exact GPS coordinates for destination so Google Maps routes 100% accurately without "Place not found" errors.
 * - Điểm bắt đầu (Origin): Tọa độ GPS từ thiết bị / vị trí đã chọn
 * - Điểm đến (Destination): Tọa độ GPS chính xác tuyệt đối của quán ăn (đến tận cửa)
 */
/**
 * Generates direct Google Maps URL for turn-by-turn navigation.
 * Uses exact GPS coordinates for destination so Google Maps routes 100% accurately without "Place not found" errors.
 * - If fromLiveGps is true (default): Leaves origin empty so Google Maps routes from user's REAL device GPS.
 * - If fromLiveGps is false and user coordinates are provided: Routes from that specific pinned building/location.
 */
export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  destAddress?: string,
  userLat?: number,
  userLng?: number,
  placeName?: string,
  userAddress?: string,
  travelMode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  fromLiveGps: boolean = true
): string {
  const mode = travelMode || 'driving';
  const destParam = `${destLat},${destLng}`;

  // Khi fromLiveGps = true (hoặc chưa có tọa độ tùy chỉnh): Google Maps tự động dùng GPS thiết bị thực tế ("Vị trí của bạn")
  if (fromLiveGps || userLat == null || userLng == null || isNaN(userLat) || isNaN(userLng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=${mode}`;
  }

  // Khi người dùng chỉ định xuất phát từ vị trí cụ thể đã chọn trên app (VD: Từ Tòa HH02-2A)
  const originParam = `${userLat},${userLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${mode}`;
}

/**
 * Generates direct Google Maps URL using exact GPS coordinates for destination
 */
export function getGoogleMapsGpsDirectionsUrl(
  destLat: number,
  destLng: number,
  userLat?: number,
  userLng?: number,
  travelMode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=${travelMode}`;
}

/**
 * Generates embedded Google Maps iframe URL
 * Works 100% reliably worldwide without any API key or billing required
 */
export function getGoogleMapsEmbedUrl(options: {
  lat?: number;
  lng?: number;
  query?: string;
  origin?: string;
  destination?: string;
  isSatellite?: boolean;
  zoom?: number;
}): string {
  const { lat, lng, query, origin, destination, isSatellite, zoom = 16 } = options;

  // Route iframe directions between origin and destination
  if (origin && destination) {
    return `https://maps.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&output=embed`;
  }

  // Place / Pin iframe
  const q = query ? query.trim() : (lat != null && lng != null ? `${lat},${lng}` : 'Việt Nam');
  const t = isSatellite ? 'k' : 'm';
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=${t}&z=${zoom}&output=embed`;
}

/**
 * Generates direct Google Maps URL to view user's current live location with exact pin
 */
export function getGoogleMapsMyLocationUrl(userLat?: number, userLng?: number, address?: string): string {
  if (userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
    return `https://www.google.com/maps/search/?api=1&query=${userLat},${userLng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps/@?api=1&map_action=map';
}

/**
 * Generates direct Google Maps general directions route planning starting from user's location
 */
export function getGoogleMapsFindRouteUrl(userLat?: number, userLng?: number, userAddress?: string): string {
  if (userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}`;
  }
  if (userAddress) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(userAddress)}`;
  }
  return 'https://www.google.com/maps/dir/?api=1';
}

/**
 * Generates direct Google Maps URL to view place details pinned on Google Maps.
 */
export function getGoogleMapsPlaceSearchUrl(name: string, address?: string, lat?: number, lng?: number): string {
  const cleanName = name ? name.replace(/\([^)]*\)/g, '').trim() : '';

  // Khi có cả tên quán và tọa độ GPS chuẩn xác
  if (cleanName && lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    // Dạng URL Google Maps trực quan: hiển thị ghim tại đúng tọa độ GPS và gắn tên quán
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}&center=${lat},${lng}`;
  }

  if (cleanName && address) {
    // Rút gọn các ký hiệu kỹ thuật như LK16, B1.4 để Google Maps tìm kiếm chính xác tuyệt đối
    const simplifiedAddr = address
      .replace(/B\d+\.\d+[-–]LK\d+(\s+Số\s+Nhà\s+\d+)?/gi, '')
      .replace(/Kiot\s+\d+/gi, '')
      .trim()
      .replace(/^[,\s]+/, '');
    const searchQuery = `${cleanName}, ${simplifiedAddr || address}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  }
  if (cleanName) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}`;
  }
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps`;
}

/**
 * Generates direct Google Maps search URL to discover nearby food places around coordinates
 */
export function getGoogleMapsNearbyFoodUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('quán ăn ngon')}&center=${lat},${lng}`;
}

/**
 * Generates direct Google Maps URL to view user's current pin location
 */
export function getGoogleMapsPinUrl(lat: number, lng: number, label?: string): string {
  if (label) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&center=${lat},${lng}`;
  }
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

        // Giữ nguyên tọa độ thực tế của người dùng, không bao giờ tự ý ghi đè tọa độ
        const coords: Coordinates = {
          latitude: lat,
          longitude: lng,
          accuracy,
          cityName: exactBuilding ? exactBuilding.districtOrCity : landmark ? landmark.districtOrCity : 'Vị trí của bạn',
          fullAddress: exactBuilding ? exactBuilding.fullAddress : landmark ? landmark.fullAddress : 'Đang định vị địa chỉ...',
          landmark: landmark?.name,
          building: exactBuilding?.buildingName,
        };

        // Reverse geocoding chuẩn xác qua API
        try {
          const geoInfo = await reverseGeocodeAddress(lat, lng);
          if (geoInfo && geoInfo.address) {
            coords.cityName = geoInfo.districtOrCity || coords.cityName;
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
