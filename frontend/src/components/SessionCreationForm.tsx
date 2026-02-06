/**
 * Session Creation Form Component - Enhanced Design
 * 
 * Requirements: 2.1, 2.2, 2.5
 */

import React, { useState } from 'react';
import QRCode from 'qrcode';

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
  teacherId?: string;
  teacherEmail?: string;
}

export const SessionCreationForm: React.FC<SessionCreationFormProps> = ({
  onSessionCreated,
  teacherId,
  teacherEmail,
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

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

  const validateForm = (): string | null => {
    if (!classId.trim()) return 'Class ID is required';
    if (!startAt) return 'Start time is required';
    if (!endAt) return 'End time is required';
    if (lateCutoffMinutes < 0) return 'Late cutoff minutes must be non-negative';
    
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    
    if (isNaN(startDate.getTime())) return 'Invalid start time';
    if (isNaN(endDate.getTime())) return 'Invalid end time';
    if (endDate <= startDate) return 'End time must be after start time';
    
    if (useGeofence && radiusMeters <= 0) return 'Geofence radius must be positive';
    if (useWifi && !wifiSSIDs.trim()) return 'At least one Wi-Fi SSID is required';
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    
    try {
      const constraints: SessionConstraints | undefined = 
        (useGeofence || useWifi) ? {} : undefined;
      
      if (useGeofence && constraints) {
        constraints.geofence = { latitude, longitude, radiusMeters };
      }
      
      if (useWifi && constraints) {
        constraints.wifiAllowlist = wifiSSIDs
          .split(',')
          .map(ssid => ssid.trim())
          .filter(ssid => ssid.length > 0);
      }
      
      const request: CreateSessionRequest = {
        classId: classId.trim(),
        startAt,
        endAt,
        lateCutoffMinutes,
      };
      
      if (useExitWindow) request.exitWindowMinutes = exitWindowMinutes;
      if (constraints && (constraints.geofence || constraints.wifiAllowlist)) {
        request.constraints = constraints;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      // Get authentication info
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: teacherId || 'local-dev-teacher',
          userDetails: teacherEmail || 'teacher@vtc.edu.hk',
          userRoles: ['authenticated', 'teacher'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        // In production, get auth info from /.auth/me
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        
        if (authData.clientPrincipal) {
          // Forward the authentication to the backend
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        } else {
          throw new Error('Not authenticated');
        }
      }
      
      const response = await fetch(`${apiUrl}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to create session: ${response.statusText}`);
      }
      
      const data: CreateSessionResponse = await response.json();
      
      // If callback provided, call it immediately and skip success view
      if (onSessionCreated) {
        onSessionCreated(data.sessionId);
        return;
      }
      
      // Otherwise, show success view
      setCreatedSession(data);
      
      const qrDataUrl = await QRCode.toDataURL(data.sessionQR, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

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

  // Success view
  if (createdSession) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ 
          color: '#48bb78', 
          marginBottom: '1rem',
          fontSize: '1.75rem'
        }}>
          Session Created Successfully!
        </h2>
        <div style={{
          backgroundColor: '#f7fafc',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          display: 'inline-block'
        }}>
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#718096',
            margin: '0 0 0.5rem 0'
          }}>
            Session ID
          </p>
          <p style={{ 
            fontSize: '1.1rem',
            fontFamily: 'monospace',
            fontWeight: '700',
            color: '#2d3748',
            margin: 0
          }}>
            {createdSession.sessionId}
          </p>
        </div>
        
        <div style={{ 
          backgroundColor: '#f7fafc', 
          padding: '2rem', 
          borderRadius: '12px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ 
            marginBottom: '1rem',
            color: '#2d3748',
            fontSize: '1.25rem'
          }}>
            📱 Session QR Code
          </h3>
          <p style={{ 
            marginBottom: '1.5rem', 
            color: '#718096',
            fontSize: '0.95rem'
          }}>
            Students can scan this to join the session
          </p>
          {qrCodeDataUrl && (
            <div style={{ 
              display: 'inline-block',
              padding: '1.5rem',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
            }}>
              <img 
                src={qrCodeDataUrl} 
                alt="Session QR Code"
                style={{ display: 'block', borderRadius: '8px' }}
              />
            </div>
          )}
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'center', 
          flexWrap: 'wrap' 
        }}>
          <button 
            onClick={() => {
              setCreatedSession(null);
              setQrCodeDataUrl('');
            }}
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: '#e2e8f0',
              color: '#4a5568',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#cbd5e0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          >
            ← Back
          </button>
          
          <button 
            onClick={handleCreateAnother}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            ➕ Create Another
          </button>
          
          <button 
            onClick={() => onSessionCreated?.(createdSession.sessionId)}
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(72, 187, 120, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(72, 187, 120, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.3)';
            }}
          >
            View Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // Form view
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#2d3748',
    fontWeight: '600',
    fontSize: '0.95rem'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem',
    paddingBottom: '2rem',
    borderBottom: '1px solid #e2e8f0'
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#fff5f5',
          border: '2px solid #fc8181',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          color: '#c53030',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <span style={{ fontWeight: '500' }}>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Required Fields */}
        <div style={sectionStyle}>
          <h3 style={{ 
            color: '#2d3748',
            fontSize: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>📝</span> Required Information
          </h3>
          
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="classId" style={labelStyle}>
              Class ID <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              id="classId"
              type="text"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="e.g., CS101-A, MATH202-B"
              disabled={loading}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label htmlFor="startAt" style={labelStyle}>
                Start Time <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              />
            </div>
            
            <div>
              <label htmlFor="endAt" style={labelStyle}>
                End Time <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="lateCutoffMinutes" style={labelStyle}>
              Late Cutoff (minutes) <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              id="lateCutoffMinutes"
              type="number"
              min="0"
              value={lateCutoffMinutes}
              onChange={(e) => setLateCutoffMinutes(parseInt(e.target.value, 10))}
              disabled={loading}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <small style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
              Students arriving after this many minutes will be marked as late
            </small>
          </div>
        </div>
        
        {/* Optional Settings */}
        <div style={sectionStyle}>
          <h3 style={{ 
            color: '#2d3748',
            fontSize: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>⚙️</span> Optional Settings
          </h3>
          
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '2px solid #e2e8f0'
          }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              color: '#2d3748'
            }}>
              <input
                type="checkbox"
                checked={useExitWindow}
                onChange={(e) => setUseExitWindow(e.target.checked)}
                disabled={loading}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Enable Exit Window
            </label>
            
            {useExitWindow && (
              <div style={{ marginTop: '1rem', paddingLeft: '2rem' }}>
                <label htmlFor="exitWindowMinutes" style={labelStyle}>
                  Exit Window Duration (minutes)
                </label>
                <input
                  id="exitWindowMinutes"
                  type="number"
                  min="1"
                  value={exitWindowMinutes}
                  onChange={(e) => setExitWindowMinutes(parseInt(e.target.value, 10))}
                  disabled={loading}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <small style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                  Time before session end when exit chains can be started
                </small>
              </div>
            )}
          </div>
        </div>
        
        {/* Location Constraints */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ 
            color: '#2d3748',
            fontSize: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>📍</span> Location Constraints
          </h3>
          
          {/* Geofence */}
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '2px solid #e2e8f0',
            marginBottom: '1rem'
          }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              color: '#2d3748'
            }}>
              <input
                type="checkbox"
                checked={useGeofence}
                onChange={(e) => setUseGeofence(e.target.checked)}
                disabled={loading}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Enable Geofence
            </label>
            
            {useGeofence && (
              <div style={{ marginTop: '1rem', paddingLeft: '2rem' }}>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={loading}
                  style={{
                    padding: '0.625rem 1.25rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    marginBottom: '1rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5568d3'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
                >
                  📍 Use Current Location
                </button>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label htmlFor="latitude" style={labelStyle}>Latitude</label>
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(parseFloat(e.target.value))}
                      disabled={loading}
                      style={inputStyle}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="longitude" style={labelStyle}>Longitude</label>
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(parseFloat(e.target.value))}
                      disabled={loading}
                      style={inputStyle}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="radiusMeters" style={labelStyle}>Radius (meters)</label>
                  <input
                    id="radiusMeters"
                    type="number"
                    min="1"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10) || 0)}
                    disabled={loading}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                  <small style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                    Students must be within this radius to scan QR codes
                  </small>
                </div>
              </div>
            )}
          </div>
          
          {/* Wi-Fi */}
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '2px solid #e2e8f0'
          }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              color: '#2d3748'
            }}>
              <input
                type="checkbox"
                checked={useWifi}
                onChange={(e) => setUseWifi(e.target.checked)}
                disabled={loading}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Enable Wi-Fi Allowlist
            </label>
            
            {useWifi && (
              <div style={{ marginTop: '1rem', paddingLeft: '2rem' }}>
                <label htmlFor="wifiSSIDs" style={labelStyle}>
                  Allowed Wi-Fi Networks (SSIDs)
                </label>
                <input
                  id="wifiSSIDs"
                  type="text"
                  value={wifiSSIDs}
                  onChange={(e) => setWifiSSIDs(e.target.value)}
                  placeholder="e.g., ClassroomWiFi, SchoolNet"
                  disabled={loading}
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <small style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                  Comma-separated list of allowed Wi-Fi network names
                </small>
              </div>
            )}
          </div>
        </div>
        
        {/* Submit Button */}
        <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '1rem 3rem',
              background: loading 
                ? '#cbd5e0' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1.1rem',
              fontWeight: '700',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s',
              minWidth: '200px'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
              }
            }}
          >
            {loading ? '⏳ Creating...' : '✨ Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
};
