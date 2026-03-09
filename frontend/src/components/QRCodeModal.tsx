import React, { useState, useEffect } from 'react';

interface QRCodeModalProps {
  sessionId: string;
  eventId: string;
  type: 'ENTRY' | 'EXIT';
  qrDataUrl: string;
  studentUrl?: string; // URL to copy
  expiresAt?: number; // Unix timestamp in seconds
  refreshIntervalMs?: number; // QR refresh interval
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  sessionId,
  eventId,
  type,
  qrDataUrl,
  studentUrl,
  expiresAt,
  refreshIntervalMs,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, expiresAt - now);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    console.log('QRCodeModal: handleCopy called');
    console.log('QRCodeModal: studentUrl prop:', studentUrl);
    console.log('QRCodeModal: studentUrl length:', studentUrl?.length);
    
    if (!studentUrl) {
      console.error('QRCodeModal: Cannot copy - studentUrl is missing');
      alert('Cannot copy URL - missing attendee URL data');
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(studentUrl);
      } else {
        // Fallback for browsers without clipboard API or non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = studentUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Failed to copy using fallback method');
        }
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Show user-friendly error message
      alert('Failed to copy URL. Please manually copy: ' + studentUrl);
    }
  };

  const handleOpenPopup = () => {
    const intervalMs = refreshIntervalMs ?? 10000;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    const token = localStorage.getItem('token') || '';
    
    const popupContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${type} QR Code - ${eventId}</title>
          <style>
            body {
              margin: 0;
              padding: 2rem;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: linear-gradient(135deg, ${type === 'ENTRY' ? '#e6ffed' : '#fff5e6'} 0%, white 100%);
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              text-align: center;
              background: white;
              padding: 2rem;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #2d3748; margin: 0 0 0.5rem 0; }
            h2 { color: #4a5568; margin: 0 0 1.5rem 0; font-weight: normal; }
            .qr-container {
              padding: 2rem;
              background: ${type === 'ENTRY' ? '#e6ffed' : '#fff5e6'};
              border-radius: 16px;
              border: 3px solid ${type === 'ENTRY' ? '#48bb78' : '#ed8936'};
              margin-bottom: 1rem;
            }
            img { display: block; border-radius: 8px; }
            .timer {
              padding: 1rem;
              border-radius: 12px;
              margin-top: 1rem;
            }
            .timer-label { font-size: 0.875rem; color: #4a5568; }
            .timer-value { 
              font-size: 2rem; 
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${type === 'ENTRY' ? '📥' : '📤'}</div>
            <h1>${type === 'ENTRY' ? 'Entry QR Code' : 'Exit QR Code'}</h1>
            <h2>${eventId}</h2>
            <div class="qr-container">
              <img id="qrImage" src="${qrDataUrl}" alt="${type} QR Code" />
            </div>
            <div class="timer" id="timerContainer">
              <div class="timer-label">Time Remaining</div>
              <div class="timer-value" id="timer">Loading...</div>
            </div>
          </div>
          <script>
            const sessionId = '${sessionId}';
            const type = '${type}';
            const apiUrl = '${apiUrl}';
            let intervalMs = ${intervalMs};
            const token = '${token}';
            let currentExpiresAt = ${expiresAt || 0};
            let refreshTimer = null;
            
            // Update timer display
            function updateTimer() {
              const now = Math.floor(Date.now() / 1000);
              const remaining = Math.max(0, currentExpiresAt - now);
              const mins = Math.floor(remaining / 60);
              const secs = remaining % 60;
              const timerEl = document.getElementById('timer');
              const containerEl = document.getElementById('timerContainer');
              
              if (remaining <= 0) {
                timerEl.textContent = 'Refreshing...';
                containerEl.style.background = '#e6f7ff';
                containerEl.style.border = '2px solid #1890ff';
                timerEl.style.color = '#1976d2';
              } else {
                timerEl.textContent = mins + ':' + secs.toString().padStart(2, '0');
                if (remaining <= 5) {
                  containerEl.style.background = '#fee';
                  containerEl.style.border = '2px solid #f44';
                  timerEl.style.color = '#d32f2f';
                } else if (remaining <= 10) {
                  containerEl.style.background = '#fff3cd';
                  containerEl.style.border = '2px solid #ffc107';
                  timerEl.style.color = '#f57c00';
                } else {
                  containerEl.style.background = '#e6f7ff';
                  containerEl.style.border = '2px solid #1890ff';
                  timerEl.style.color = '#1976d2';
                }
              }
            }
            
            // Refresh QR code
            async function refreshQR() {
              try {
                const headers = {};
                if (token) {
                  headers['Authorization'] = 'Bearer ' + token;
                }
                const endpoint = type === 'ENTRY' ? 'entry-qr' : 'exit-qr';
                const response = await fetch(apiUrl + '/sessions/' + sessionId + '/' + endpoint, {
                  credentials: 'include',
                  headers: headers
                });
                if (!response.ok) {
                  console.error('Failed to refresh QR: HTTP ' + response.status);
                  return;
                }
                const data = await response.json();
                if (data.token) {
                  // Generate QR code URL from token
                  const baseUrl = window.location.origin;
                  const studentUrl = baseUrl + '/attendee?sessionId=' + sessionId + '&type=' + type + '&token=' + data.token;
                  
                  // Use a QR code API service to generate the image
                  const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(studentUrl);
                  document.getElementById('qrImage').src = qrApiUrl;
                  
                  if (data.expiresAt) {
                    currentExpiresAt = data.expiresAt;
                  }
                  
                  // Update refresh interval if server provides it
                  if (data.refreshInterval && data.refreshInterval !== intervalMs) {
                    intervalMs = data.refreshInterval;
                    if (refreshTimer) clearInterval(refreshTimer);
                    refreshTimer = setInterval(refreshQR, intervalMs);
                  }
                }
              } catch (err) {
                console.error('Failed to refresh QR:', err);
              }
            }
            
            // Start timers
            setInterval(updateTimer, 1000);
            refreshTimer = setInterval(refreshQR, intervalMs);
            updateTimer();
          </script>
        </body>
      </html>
    `;
    
    const popup = window.open('', '_blank', 'width=600,height=800');
    if (popup) {
      popup.document.write(popupContent);
      popup.document.close();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2.5rem',
          borderRadius: '20px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          fontSize: '3rem',
          marginBottom: '1rem'
        }}>
          {type === 'ENTRY' ? '📥' : '📤'}
        </div>
        <h2 style={{ 
          color: '#2d3748',
          marginTop: 0,
          marginBottom: '0.5rem',
          fontSize: '1.75rem'
        }}>
          {type === 'ENTRY' ? 'Entry QR Code' : 'Exit QR Code'}
        </h2>
        <h3 style={{ 
          color: '#4a5568',
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.25rem'
        }}>
          {eventId}
        </h3>
        
        <div style={{
          display: 'inline-block',
          padding: '1.5rem',
          backgroundColor: type === 'ENTRY' ? '#e6ffed' : '#fff5e6',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          border: `3px solid ${type === 'ENTRY' ? '#48bb78' : '#ed8936'}`
        }}>
          <img src={qrDataUrl} alt={`${type} QR Code`} style={{
            display: 'block',
            borderRadius: '8px'
          }} />
        </div>
        
        {/* Countdown Timer */}
        {expiresAt && timeRemaining > 0 && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: timeRemaining <= 5 ? '#fee' : timeRemaining <= 10 ? '#fff3cd' : '#e6f7ff',
            borderRadius: '12px',
            border: `2px solid ${timeRemaining <= 5 ? '#f44' : timeRemaining <= 10 ? '#ffc107' : '#1890ff'}`
          }}>
            <div style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '0.25rem' }}>
              Time Remaining
            </div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold',
              color: timeRemaining <= 5 ? '#d32f2f' : timeRemaining <= 10 ? '#f57c00' : '#1976d2'
            }}>
              {formatTime(timeRemaining)}
            </div>
          </div>
        )}
        
        {/* Copy Button - Below QR Code */}
        {studentUrl ? (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: copied ? '#28a745' : 'white',
                border: '2px solid #4a5568',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.2s',
                color: copied ? 'white' : '#2d3748'
              }}
              onMouseOver={(e) => {
                if (!copied) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = type === 'ENTRY' ? '#48bb78' : '#ed8936';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseOut={(e) => {
                if (!copied) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = '#2d3748';
                }
              }}
              title={copied ? 'Copied to clipboard!' : 'Copy attendee URL to clipboard'}
            >
              {copied ? '✓ Copied' : '📋 Copy URL'}
            </button>
            <button
              onClick={handleOpenPopup}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                border: '2px solid #4a5568',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.2s',
                color: '#2d3748'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.backgroundColor = '#667eea';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#2d3748';
              }}
              title="Open in popup window for dual monitor"
            >
              🖥️ Popup
            </button>
          </div>
        ) : (
          <div style={{ 
            display: 'block', 
            marginBottom: '1.5rem',
            padding: '0.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            ⚠️ URL not available for copying
          </div>
        )}
        <p style={{ 
          fontSize: '0.95rem', 
          color: '#4a5568', 
          margin: '0 0 1.5rem 0',
          lineHeight: '1.6'
        }}>
          {type === 'ENTRY' 
            ? 'Students scan this QR code to mark their entry'
            : 'Students scan this QR code to mark their exit'}
        </p>
        <button
          onClick={onClose}
          style={{
            padding: '0.875rem 2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
