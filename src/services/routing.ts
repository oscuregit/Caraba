// Routing & Real-time Geolocation Services using OSRM & Browser Geolocation API

export interface GeolocationResult {
  lat: number;
  lng: number;
  accuracy?: number;
  isRealLocation: boolean;
}

export interface RouteResult {
  coordinates: [number, number][]; // Array of [lat, lng] for Leaflet polyline
  distanceKm: number;
  durationMins: number;
  isRealRoad: boolean;
}

// Default fallback coordinates (Istanbul City Center)
export const DEFAULT_FALLBACK_LOCATION = { lat: 41.0082, lng: 28.9784 };

/**
 * Gets user's current live geolocation using Browser Geolocation API
 */
export function getUserLocation(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...DEFAULT_FALLBACK_LOCATION, isRealLocation: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          isRealLocation: true
        });
      },
      (error) => {
        console.warn('Geolocation error or permission denied:', error.message);
        resolve({ ...DEFAULT_FALLBACK_LOCATION, isRealLocation: false });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000
      }
    );
  });
}

/**
 * Calculate straight-line Haversine distance in KM between two coordinates
 */
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Fetches real turn-by-turn road route coordinates and metrics from OSRM driving API
 */
export async function fetchRoadRoute(waypoints: { lat: number; lng: number }[]): Promise<RouteResult> {
  if (waypoints.length < 2) {
    const coords: [number, number][] = waypoints.map(w => [w.lat, w.lng]);
    return { coordinates: coords, distanceKm: 0, durationMins: 0, isRealRoad: false };
  }

  try {
    // OSRM expects: longitude,latitude;longitude,latitude
    const formattedWaypoints = waypoints
      .map(w => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${formattedWaypoints}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // OSRM GeoJSON geometry coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
      const rawCoords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
      const durationMins = Math.round(route.duration / 60);

      return {
        coordinates: rawCoords,
        distanceKm: distanceKm || 1.0,
        durationMins: durationMins || 2,
        isRealRoad: true
      };
    }
  } catch (err) {
    console.warn('Failed to fetch OSRM road route, falling back to straight segment path:', err);
  }

  // Fallback if OSRM API is unreachable or fails: generate smooth sub-points along straight segments
  const fallbackCoords: [number, number][] = [];
  let totalDist = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const dist = getHaversineDistance(start.lat, start.lng, end.lat, end.lng);
    totalDist += dist;

    // Subdivide into 10 steps per segment
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const ratio = s / steps;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      fallbackCoords.push([lat, lng]);
    }
  }
  const last = waypoints[waypoints.length - 1];
  fallbackCoords.push([last.lat, last.lng]);

  const realDist = parseFloat((totalDist * 1.25).toFixed(1)); // 1.25 factor for road curvature
  const duration = Math.round(realDist * 2.2 + (waypoints.length - 2) * 3);

  return {
    coordinates: fallbackCoords,
    distanceKm: realDist || 1.0,
    durationMins: duration || 2,
    isRealRoad: false
  };
}

/**
 * Interpolates position along a detailed array of road [lat, lng] coordinates
 * given a percentage from 0 to 100.
 */
export function interpolateAlongRoad(
  roadCoords: [number, number][],
  percentage: number
): { lat: number; lng: number } {
  if (!roadCoords || roadCoords.length === 0) {
    return DEFAULT_FALLBACK_LOCATION;
  }
  if (roadCoords.length === 1) {
    return { lat: roadCoords[0][0], lng: roadCoords[0][1] };
  }

  const clampedPct = Math.max(0, Math.min(100, percentage));
  if (clampedPct === 0) return { lat: roadCoords[0][0], lng: roadCoords[0][1] };
  if (clampedPct === 100) {
    const last = roadCoords[roadCoords.length - 1];
    return { lat: last[0], lng: last[1] };
  }

  // Calculate segment lengths
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < roadCoords.length - 1; i++) {
    const p1 = roadCoords[i];
    const p2 = roadCoords[i + 1];
    const len = getHaversineDistance(p1[0], p1[1], p2[0], p2[1]);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return { lat: roadCoords[0][0], lng: roadCoords[0][1] };
  }

  const targetDist = (clampedPct / 100) * totalLength;
  let accumulatedDist = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulatedDist + segLen >= targetDist) {
      const segmentProgress = (targetDist - accumulatedDist) / segLen;
      const p1 = roadCoords[i];
      const p2 = roadCoords[i + 1];
      const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;
      return { lat, lng };
    }
    accumulatedDist += segLen;
  }

  const last = roadCoords[roadCoords.length - 1];
  return { lat: last[0], lng: last[1] };
}
