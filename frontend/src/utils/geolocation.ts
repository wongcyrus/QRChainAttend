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
 * Get the user's current location with detailed error information
 * @returns Object with location data and error details
 */
export async function getCurrentLocationWithError(): Promise<{
  location?: LocationData;
  error?: string;
  errorCode?: 'NOT_SUPPORTED' | 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT';
}> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        error: 'Geolocation is not supported by your browser',
        errorCode: 'NOT_SUPPORTED'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        let errorCode: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' = 'POSITION_UNAVAILABLE';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            errorCode = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your device settings.';
            errorCode = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            errorCode = 'TIMEOUT';
            break;
        }
        
        resolve({ error: errorMessage, errorCode });
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
