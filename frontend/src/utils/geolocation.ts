/**
 * Geolocation utilities
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Get the user's current location
 * @returns Location data or undefined if location is not available
 */
export async function getCurrentLocation(): Promise<LocationData | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      resolve(undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.warn('Failed to get location:', error.message);
        // Don't throw error - just return undefined
        // This allows the app to continue working even if location is denied
        resolve(undefined);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Check if geolocation is available and permission is granted
 */
export async function checkLocationPermission(): Promise<boolean> {
  if (!navigator.geolocation) {
    return false;
  }

  // Try to get location to check permission
  try {
    const location = await getCurrentLocation();
    return location !== undefined;
  } catch {
    return false;
  }
}
