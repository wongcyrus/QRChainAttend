import React from 'react';

interface QRCodeModalProps {
  sessionId: string;
  classId: string;
  type: 'ENTRY' | 'EXIT';
  qrDataUrl: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  sessionId,
  classId,
  type,
  qrDataUrl,
  onClose
}) => {
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
          marginBottom: '0.5rem',
          fontSize: '1.25rem'
        }}>
          {classId}
        </h3>
        <p style={{ 
          fontSize: '0.875rem', 
          color: '#718096', 
          marginBottom: '1rem',
          fontFamily: 'monospace',
          backgroundColor: '#f7fafc',
          padding: '0.5rem',
          borderRadius: '6px',
          wordBreak: 'break-all'
        }}>
          Session: {sessionId.substring(0, 8)}...
        </p>
        
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
