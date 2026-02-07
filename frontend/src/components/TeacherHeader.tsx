import React from 'react';

interface TeacherHeaderProps {
  userDetails: string;
  onHome: () => void;
}

export const TeacherHeader: React.FC<TeacherHeaderProps> = ({ userDetails, onHome }) => {
  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 2px 20px rgba(0,0,0,0.1)',
      padding: '1.5rem 2rem',
      marginBottom: '2rem'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ 
            margin: '0 0 0.5rem 0',
            fontSize: '2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '700'
          }}>
            📚 Teacher Dashboard
          </h1>
          <p style={{ 
            margin: 0, 
            color: '#666',
            fontSize: '0.95rem'
          }}>
            Welcome back, <strong>{userDetails}</strong>
          </p>
        </div>
        <button 
          onClick={onHome}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'white',
            color: '#667eea',
            border: '2px solid #667eea',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#667eea';
            e.currentTarget.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#667eea';
          }}
        >
          🏠 Home
        </button>
      </div>
    </div>
  );
};
