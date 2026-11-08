/**
 * Cloudflare Pages Function: /api/reverse-geocode
 * Reverse Geocoding Proxy with Vietnamese Landmark & Exact House/Building Intelligence
 */

interface Env {}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request } = context;
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lng = parseFloat(url.searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Tọa độ lat, lng không hợp lệ' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. OpenStreetMap Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi&addressdetails=1`;
    const nomRes = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'ThapTaiSanApp/2.0 (contact@thaptaisan.vn)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (nomRes.ok) {
      const nomData = (await nomRes.json()) as any;
      if (nomData && nomData.address) {
        const addr = nomData.address;
        const houseNumber = addr.house_number || '';
        const road = addr.road || addr.street || '';
        const amenity = addr.amenity || addr.building || addr.office || addr.shop || '';
        const quarter = addr.quarter || addr.neighbourhood || '';
        const suburb = addr.suburb || addr.ward || '';
        const district = addr.city_district || addr.district || addr.county || '';
        const city = addr.city || addr.state || 'Hà Nội';

        const parts: string[] = [];
        if (amenity && amenity !== road) parts.push(amenity);
        if (houseNumber && road) {
          parts.push(`Số ${houseNumber} ${road}`);
        } else if (road) {
          parts.push(road);
        }
        if (quarter && quarter !== suburb) parts.push(quarter);
        if (suburb) parts.push(suburb);
        if (district) parts.push(district);
        if (city) parts.push(city);

        const fullAddress = parts.length > 0 ? parts.join(', ') : nomData.display_name;
        const districtOrCity = [district, city].filter(Boolean).join(', ') || city;

        return new Response(
          JSON.stringify({
            success: true,
            address: fullAddress,
            fullAddress,
            districtOrCity,
            building: amenity || undefined,
            houseNumber: houseNumber || undefined,
            road: road || undefined,
            lat,
            lng,
            source: 'OpenStreetMap Nominatim',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch {}

  // 2. Photon Komoot Reverse Geocoding
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const photonRes = await fetch(photonUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (photonRes.ok) {
      const photonData = (await photonRes.json()) as any;
      const feat = photonData?.features?.[0];
      if (feat && feat.properties) {
        const p = feat.properties;
        const houseNumber = p.housenumber || '';
        const road = p.street || '';
        const name = p.name || '';
        const locality = p.locality || '';
        const district = p.district || '';
        const city = p.city || p.county || p.state || '';

        const streetAddress = houseNumber ? `Số ${houseNumber} ${road}`.trim() : road;
        const addressParts = [
          name && name !== road ? name : '',
          streetAddress,
          locality,
          district,
          city,
        ].filter(Boolean);

        const fullAddress =
          addressParts.length > 0 ? addressParts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const districtOrCity = district ? `${district}, ${city}` : city || 'Việt Nam';

        return new Response(
          JSON.stringify({
            success: true,
            address: fullAddress,
            fullAddress,
            districtOrCity,
            building: name || undefined,
            houseNumber: houseNumber || undefined,
            road: road || undefined,
            lat,
            lng,
            source: 'Photon Worldwide Engine',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch {}

  // 3. Fallback
  const dHanoi = calculateDistance(lat, lng, 21.0285, 105.8542);
  const dHcm = calculateDistance(lat, lng, 10.7769, 106.7009);
  const dDanang = calculateDistance(lat, lng, 16.0544, 108.2022);

  let fallbackAddress = `Vị trí (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  let fallbackDistrict = 'Việt Nam';

  if (dHanoi < 60) {
    fallbackAddress = 'Khu vực Hà Nội, Việt Nam';
    fallbackDistrict = 'Hà Nội';
  } else if (dHcm < 60) {
    fallbackAddress = 'Khu vực TP. Hồ Chí Minh, Việt Nam';
    fallbackDistrict = 'TP. Hồ Chí Minh';
  } else if (dDanang < 60) {
    fallbackAddress = 'Khu vực Đà Nẵng, Việt Nam';
    fallbackDistrict = 'Đà Nẵng';
  }

  return new Response(
    JSON.stringify({
      success: true,
      address: fallbackAddress,
      fullAddress: fallbackAddress,
      districtOrCity: fallbackDistrict,
      lat,
      lng,
      source: 'Global Geocoding Fallback',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
