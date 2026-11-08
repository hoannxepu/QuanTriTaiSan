/**
 * Cloudflare Pages Function: /api/search-address
 * Address Search Endpoint - Tìm kiếm số nhà, tòa nhà, địa chỉ toàn quốc
 */

interface Env {}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request } = context;
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get('q') || '').trim();

  if (!rawQuery) {
    return new Response(JSON.stringify({ success: true, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{
    name: string;
    fullAddress: string;
    districtOrCity: string;
    lat: number;
    lng: number;
  }> = [];

  // 0. GPS Coordinates
  const coordMatch = rawQuery.match(/([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)/);
  if (coordMatch) {
    const parsedLat = parseFloat(coordMatch[1]);
    const parsedLng = parseFloat(coordMatch[2]);
    if (
      !isNaN(parsedLat) &&
      !isNaN(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180
    ) {
      results.push({
        name: `Tọa độ GPS (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`,
        fullAddress: `Tọa độ GPS: ${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`,
        districtOrCity: `GPS: ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
        lat: parsedLat,
        lng: parsedLng,
      });
    }
  }

  // 1. Photon Komoot Geocoding
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawQuery)}&lat=20.9355&lon=105.7950&limit=8`;
    const photonRes = await fetch(photonUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (photonRes.ok) {
      const photonData = (await photonRes.json()) as any;
      if (photonData && Array.isArray(photonData.features)) {
        for (const feat of photonData.features) {
          const coords = feat.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const pLng = coords[0];
            const pLat = coords[1];
            if (!isNaN(pLat) && !isNaN(pLng)) {
              if (
                !results.some(
                  (r) => Math.abs(r.lat - pLat) < 0.001 && Math.abs(r.lng - pLng) < 0.001
                )
              ) {
                const p = feat.properties || {};
                const pName = p.name || rawQuery;
                const parts = [
                  p.name,
                  p.housenumber ? `Số ${p.housenumber} ${p.street || ''}`.trim() : p.street,
                  p.district,
                  p.city || p.county,
                  p.state,
                  p.country,
                ].filter(Boolean);
                const fullAddress = parts.join(', ');
                const displayCity = p.district
                  ? `${p.district}, ${p.city || p.state || 'Việt Nam'}`
                  : p.city || p.state || 'Việt Nam';

                results.push({
                  name: pName,
                  fullAddress: fullAddress || pName,
                  districtOrCity: displayCity,
                  lat: pLat,
                  lng: pLng,
                });
              }
            }
          }
        }
      }
    }
  } catch {}

  // 2. OpenStreetMap Nominatim fallback
  if (results.length < 5) {
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&countrycodes=vn&limit=6&addressdetails=1&accept-language=vi`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'ThapTaiSanApp/2.0 (contact@thaptaisan.vn)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (searchRes.ok) {
        const list = (await searchRes.json()) as any;
        if (Array.isArray(list)) {
          for (const item of list) {
            const parsedLat = parseFloat(item.lat);
            const parsedLng = parseFloat(item.lon);
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
              if (
                !results.some(
                  (r) => Math.abs(r.lat - parsedLat) < 0.001 && Math.abs(r.lng - parsedLng) < 0.001
                )
              ) {
                const addr = item.address || {};
                const city = addr.city || addr.town || addr.municipality || addr.state || '';
                const district = addr.city_district || addr.district || addr.county || '';
                const displayName = item.name || item.display_name.split(',')[0].trim();

                results.push({
                  name: displayName,
                  fullAddress: item.display_name,
                  districtOrCity: district ? `${district}, ${city || 'Việt Nam'}` : city || 'Việt Nam',
                  lat: parsedLat,
                  lng: parsedLng,
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  return new Response(
    JSON.stringify({ success: true, query: rawQuery, results: results.slice(0, 10) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
