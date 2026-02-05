/**
 * Session Creation Form Component
 * 
 * Requirements: 2.1, 2.2, 2.5
 * 
 * Provides a form for teachers to create new attendance sessions.
 * Includes required fields (classId, startAt, endAt, lateCutoffMinutes)
 * and optional constraint fields (geofence, Wi-Fi allowlist).
 * 
 * Upon successful creation, displays the generated Session_QR code
 * for students to scan and join the session.
 */

import React, { useState } from 'react';
import Image from 'next/image';

interface SessionConstraints {
  geofence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  wifiAllowlist?: string[];
}

interface CreateSessionRequest {
  classId: string;
  startAt: string;
  endAt: string;
  lateCutoffMinutes: number;
  exitWindowMinutes?: number;
  constraints?: SessionConstraints;
}

interface CreateSessionResponse {
  sessionId: string;
  sessionQR: string;
}

interface SessionCreationFormProps {
  onSessionCreated?: (sessionId: string) => void;
}

export const SessionCreationForm: React.FC<SessionCreationFormProps> = ({
  onSessionCreated,
}) => {
  // Required fields
  const [classId, setClassId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [lateCutoffMinutes, setLateCutoffMinutes] = useState<number>(15);
  
  // Optional fields
  const [exitWindowMinutes, setExitWindowMinutes] = useState<number>(10);
  const [useExitWindow, setUseExitWindow] = useState(false);
  
  // Geofence constraints
  const [useGeofence, setUseGeofence] = useState(false);
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  
  // Wi-Fi constraints
  const [useWifi, setUseWifi] = useState(false);
  const [wifiSSIDs, setWifiSSIDs] = useState<string>('');
  
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<CreateSessionResponse | null>(null);

  /**
   * Get current location for geofence
   */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
      },
      (error) => {
        setError(`Failed to get location: ${error.message}`);
      }
    );
  };

  /**
   * Validate form inputs
   */
  const validateForm = (): string | null => {
    if (!classId.trim()) {
      return 'Class ID is required';
    }
    if (!startAt) {
      return 'Start time is required';
    }
    if (!endAt) {
      return 'End time is required';
    }
    if (lateCutoffMinutes < 0) {
      return 'Late cutoff minutes must be non-negative';
    }
    
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    
    if (isNaN(startDate.getTime())) {
      return 'Invalid start time';
    }
    if (isNaN(endDate.getTime())) {
      return 'Invalid end time';
    }
    if (endDate <= startDate) {
      return 'End time must be after start time';
    }
    
    if (useGeofence) {
      if (radiusMeters <= 0) {
        return 'Geofence radius must be positive';
      }
    }
    
    if (useWifi) {
      if (!wifiSSIDs.trim()) {
        return 'At least one Wi-Fi SSID is required when Wi-Fi constraint is enabled';
      }
    }
    
    return null;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError(null);
    
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Build constraints object
      const constraints: SessionConstraints | undefined = 
        (useGeofence || useWifi) ? {} : undefined;
      
      if (useGeofence && constraints) {
        constraints.geofence = {
          latitude,
          longitude,
          radiusMeters,
        };
      }
      
      if (useWifi && constraints) {
        constraints.wifiAllowlist = wifiSSIDs
          .split(',')
          .map(ssid => ssid.trim())
          .filter(ssid => ssid.length > 0);
      }
      
      // Build request
      const request: CreateSessionRequest = {
        classId: classId.trim(),
        startAt,
        endAt,
        lateCutoffMinutes,
      };
      
      if (useExitWindow) {
        request.exitWindowMinutes = exitWindowMinutes;
      }
      
      if (constraints && (constraints.geofence || constraints.wifiAllowlist)) {
        request.constraints = constraints;
      }
      
      // Call API
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to create session: ${response.statusText}`
        );
      }
      
      const data: CreateSessionResponse = await response.json();
      setCreatedSession(data);
      
      // Notify parent component
      if (onSessionCreated) {
        onSessionCreated(data.sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset form to create another session
   */
  const handleCreateAnother = () => {
    setCreatedSession(null);
    setClassId('');
    setStartAt('');
    setEndAt('');
    setLateCutoffMinutes(15);
    setExitWindowMinutes(10);
    setUseExitWindow(false);
    setUseGeofence(false);
    setUseWifi(false);
    setWifiSSIDs('');
    setError(null);
  };

  // If session created, show QR code
  if (createdSession) {
    return (
      <div className="session-creation-success">
        <h2>Session Created Successfully!</h2>
        <p>Session ID: <strong>{createdSession.sessionId}</strong></p>
        
        <div className="session-qr-display">
          <h3>Session QR Code</h3>
          <p>Students can scan this QR code to join the session:</p>
          <div className="qr-code-container">
            <Image 
              src={createdSession.sessionQR} 
              alt="Session QR Code"
              width={300}
              height={300}
            />
            <p className="qr-label">Session Join QR</p>
          </div>
        </div>
        
        <button 
          onClick={handleCreateAnother}
          className="create-another-button"
        >
          Create Another Session
        </button>
      </div>
    );
  }

  // Show form
  return (
    <div className="session-creation-form">
      <h2>Create New Session</h2>
      
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Required Fields */}
        <div className="form-section">
          <h3>Required Information</h3>
          
          <div className="form-field">
            <label htmlFor="classId">
              Class ID <span className="required">*</span>
            </label>
            <input
              id="classId"
              type="text"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="e.g., CS101-A"
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="startAt">
              Start Time <span className="required">*</span>
            </label>
            <input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="endAt">
              End Time <span className="required">*</span>
            </label>
            <input
              id="endAt"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="lateCutoffMinutes">
              Late Cutoff (minutes) <span className="required">*</span>
            </label>
            <input
              id="lateCutoffMinutes"
              type="number"
              min="0"
              value={lateCutoffMinutes}
              onChange={(e) => setLateCutoffMinutes(parseInt(e.target.value, 10))}
              disabled={loading}
            />
            <small>Students arriving after this many minutes will be marked as late</small>
          </div>
        </div>
        
        {/* Optional Fields */}
        <div className="form-section">
          <h3>Optional Settings</h3>
          
          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={useExitWindow}
                onChange={(e) => setUseExitWindow(e.target.checked)}
                disabled={loading}
              />
              Enable Exit Window
            </label>
            {useExitWindow && (
              <div className="nested-field">
                <label htmlFor="exitWindowMinutes">
                  Exit Window (minutes)
                </label>
                <input
                  id="exitWindowMinutes"
                  type="number"
                  min="1"
                  value={exitWindowMinutes}
                  onChange={(e) => setExitWindowMinutes(parseInt(e.target.value, 10))}
                  disabled={loading}
                />
                <small>Duration before session end when exit chains can be started</small>
              </div>
            )}
          </div>
        </div>
        
        {/* Constraints */}
        <div className="form-section">
          <h3>Location Constraints (Optional)</h3>
          
          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={useGeofence}
                onChange={(e) => setUseGeofence(e.target.checked)}
                disabled={loading}
              />
              Enable Geofence
            </label>
            {useGeofence && (
              <div className="nested-field">
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="get-location-button"
                  disabled={loading}
                >
                  Use Current Location
                </button>
                
                <label htmlFor="latitude">Latitude</label>
                <input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                  disabled={loading}
                />
                
                <label htmlFor="longitude">Longitude</label>
                <input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                  disabled={loading}
                />
                
                <label htmlFor="radiusMeters">Radius (meters)</label>
                <input
                  id="radiusMeters"
                  type="number"
                  min="1"
                  value={radiusMeters}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRadiusMeters(isNaN(val) ? 0 : val);
                  }}
                  disabled={loading}
                />
                <small>Students must be within this radius to scan QR codes</small>
              </div>
            )}
          </div>
          
          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={useWifi}
                onChange={(e) => setUseWifi(e.target.checked)}
                disabled={loading}
              />
              Enable Wi-Fi Allowlist
            </label>
            {useWifi && (
              <div className="nested-field">
                <label htmlFor="wifiSSIDs">Allowed Wi-Fi Networks (SSIDs)</label>
                <input
                  id="wifiSSIDs"
                  type="text"
                  value={wifiSSIDs}
                  onChange={(e) => setWifiSSIDs(e.target.value)}
                  placeholder="e.g., ClassroomWiFi, SchoolNet"
                  disabled={loading}
                />
                <small>Comma-separated list of allowed Wi-Fi network names</small>
              </div>
            )}
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Creating Session...' : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
};
