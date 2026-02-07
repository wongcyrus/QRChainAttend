import React, { useState } from 'react';

interface Session {
  sessionId: string;
  classId: string;
  startAt: string;
  endAt?: string;
  status: string;
  isRecurring?: boolean;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrenceEndDate?: string;
  parentSessionId?: string;
  occurrenceNumber?: number;
  lateCutoffMinutes?: number;
  exitWindowMinutes?: number;
}

interface SessionsListProps {
  sessions: Session[];
  onDashboard: (session: Session) => void;
  onEntryQR: (session: Session) => void;
  onExitQR: (session: Session) => void;
  onEdit: (session: Session) => void;
  onDelete: (session: Session) => void;
}

export const SessionsList: React.FC<SessionsListProps> = ({
  sessions,
  onDashboard,
  onEntryQR,
  onExitQR,
  onEdit,
  onDelete
}) => {
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'ongoing' | 'past'>('ongoing');

  const now = new Date();
  
  // Upcoming: sessions that haven't started yet
  const upcomingSessions = sessions.filter(session => {
    const sessionStart = new Date(session.startAt);
    return sessionStart > now;
  });

  // Ongoing: sessions that have started but not ended
  const ongoingSessions = sessions.filter(session => {
    const sessionStart = new Date(session.startAt);
    const sessionEnd = session.endAt ? new Date(session.endAt) : null;
    return sessionStart <= now && (!sessionEnd || sessionEnd > now);
  });

  // Past: sessions that have ended
  const pastSessions = sessions.filter(session => {
    const sessionEnd = session.endAt ? new Date(session.endAt) : null;
    return sessionEnd && sessionEnd <= now;
  });

  const displaySessions = 
    selectedTab === 'upcoming' ? upcomingSessions :
    selectedTab === 'ongoing' ? ongoingSessions :
    pastSessions; 
  const hasUpcoming = upcomingSessions.length > 0;
  const hasOngoing = ongoingSessions.length > 0;
  const hasPast = pastSessions.length > 0;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ 
          color: 'white',
          fontSize: '1.75rem',
          marginBottom: '1rem',
          fontWeight: '700',
          textShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          📋 Sessions
        </h2>
        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasUpcoming && (
            <button
              onClick={() => setSelectedTab('upcoming')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: selectedTab === 'upcoming' ? '#667eea' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: selectedTab === 'upcoming' ? 'none' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedTab !== 'upcoming') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedTab !== 'upcoming') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
            >
              ⏱️ Upcoming {upcomingSessions.length > 0 && `(${upcomingSessions.length})`}
            </button>
          )}
          {hasOngoing && (
            <button
              onClick={() => setSelectedTab('ongoing')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: selectedTab === 'ongoing' ? '#48bb78' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: selectedTab === 'ongoing' ? 'none' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedTab !== 'ongoing') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedTab !== 'ongoing') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
            >
              🔴 Ongoing {ongoingSessions.length > 0 && `(${ongoingSessions.length})`}
            </button>
          )}
          {hasPast && (
            <button
              onClick={() => setSelectedTab('past')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: selectedTab === 'past' ? '#ed8936' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: selectedTab === 'past' ? 'none' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedTab !== 'past') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedTab !== 'past') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
            >
              ✅ Past {pastSessions.length > 0 && `(${pastSessions.length})`}
            </button>
          )}
        </div>
      </div>
      {displaySessions.length === 0 ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📚</div>
          <h3 style={{ 
            color: '#2d3748',
            fontSize: '1.5rem',
            marginBottom: '0.5rem'
          }}>
            {selectedTab === 'upcoming' && 'No upcoming sessions'}
            {selectedTab === 'ongoing' && 'No sessions happening now'}
            {selectedTab === 'past' && 'No past sessions'}
          </h3>
          <p style={{ 
            color: '#718096',
            fontSize: '1.1rem',
            margin: 0
          }}>
            {selectedTab === 'upcoming' && 'Create your first session to get started!'}
            {selectedTab === 'ongoing' && 'Check upcoming or past sessions.'}
            {selectedTab === 'past' && 'No sessions have been completed yet.'}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
        }}>
          {displaySessions.map(session => (
            <div
              key={session.sessionId}
              style={{
                padding: '2rem',
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                transition: 'all 0.3s',
                border: '2px solid transparent',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 48px rgba(0,0,0,0.12)';
                e.currentTarget.style.borderColor = '#667eea';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {/* Status Badge */}
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'flex-end'
              }}>
                <span
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: session.status === 'ACTIVE' ? '#48bb78' : '#a0aec0',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: session.status === 'ACTIVE' 
                      ? '0 4px 12px rgba(72, 187, 120, 0.4)' 
                      : '0 4px 12px rgba(160, 174, 192, 0.4)'
                  }}
                >
                  {session.status === 'ACTIVE' ? '🟢 Active' : '⚫ Ended'}
                </span>
                
                {/* Recurring Badge */}
                {(session.isRecurring || session.parentSessionId) && (
                  <span
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#667eea',
                      color: 'white',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    🔄 Recurring{session.occurrenceNumber ? ` #${session.occurrenceNumber}` : ''}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem', paddingRight: '120px' }}>
                {/* Class Title */}
                <h3 style={{ 
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.4rem',
                  color: '#2d3748',
                  fontWeight: '700'
                }}>
                  {session.classId}
                </h3>
                
                {/* Session Details */}
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  {/* Start Time */}
                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.9rem', 
                    color: '#2d3748',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: '500'
                  }}>
                    <span>📅</span>
                    <span>{new Date(session.startAt).toLocaleDateString()}</span>
                  </p>

                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.9rem', 
                    color: '#4a5568',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>⏰</span>
                    <span>{new Date(session.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {session.endAt && <span>- {new Date(session.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>

                  {session.lateCutoffMinutes !== undefined && (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.9rem', 
                      color: '#4a5568',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>⏱️</span>
                      <span>Late marks after {session.lateCutoffMinutes} min</span>
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => onDashboard(session)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.875rem 1.25rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
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
                  📊 Dashboard
                </button>
                
                <button
                  onClick={() => onEntryQR(session)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.875rem 1.25rem',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(72, 187, 120, 0.3)'
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
                  📥 Entry QR
                </button>
                
                <button
                  onClick={() => onExitQR(session)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.875rem 1.25rem',
                    backgroundColor: '#ed8936',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(237, 137, 54, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(237, 137, 54, 0.3)';
                  }}
                >
                  📤 Exit QR
                </button>

                <button
                  onClick={() => onEdit(session)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.875rem 1.25rem',
                    backgroundColor: '#3182ce',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(49, 130, 206, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(49, 130, 206, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(49, 130, 206, 0.3)';
                  }}
                >
                  ✏️ Edit
                </button>

                <button
                  onClick={() => onDelete(session)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.875rem 1.25rem',
                    backgroundColor: '#e53e3e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(229, 62, 62, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(229, 62, 62, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(229, 62, 62, 0.3)';
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
