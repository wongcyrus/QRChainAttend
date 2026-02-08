/**
 * Geolocation validation utilities
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export interface GeolocationCheckResult {
  withinGeofence: boolean;
  distance?: number; // Distance from session location in meters
  warning?: string;
  shouldBlock: boolean;
}

/**
 * Validate student location against session geofence
 * @param sessionLocation Session's location {latitude, longitude}
 * @param geofenceRadius Geofence radius in meters
 * @param enforceGeofence Whether to block (true) or warn (false)
 * @param studentLocation Student's GPS location
 * @returns Validation result
 */
export function validateGeolocation(
  sessionLocation: { latitude: number; longitude: number } | undefined,
  geofenceRadius: number | undefined,
  enforceGeofence: boolean | undefined,
  studentLocation: { latitude: number; longitude: number; accuracy?: number } | undefined
): GeolocationCheckResult {
  // If no geofence is configured, allow entry
  if (!sessionLocation || !geofenceRadius) {
    return {
      withinGeofence: true,
      shouldBlock: false
    };
  }

  // If student didn't provide location, handle based on enforcement mode
  if (!studentLocation) {
    if (enforceGeofence) {
      return {
        withinGeofence: false,
        warning: 'Location permission required',
        shouldBlock: true
      };
    } else {
      return {
        withinGeofence: false,
        warning: 'Location not provided',
        shouldBlock: false
      };
    }
  }

  // Calculate distance
  const distance = calculateDistance(
    sessionLocation.latitude,
    sessionLocation.longitude,
    studentLocation.latitude,
    studentLocation.longitude
  );

  const withinGeofence = distance <= geofenceRadius;

  if (!withinGeofence) {
    const warning = `${Math.round(distance)}m from classroom (limit: ${geofenceRadius}m)`;
    return {
      withinGeofence: false,
      distance,
      warning,
      shouldBlock: enforceGeofence || false
    };
  }

  return {
    withinGeofence: true,
    distance,
    shouldBlock: false
  };
}
