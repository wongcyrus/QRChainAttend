import React from 'react';

interface Session {
  sessionId: string;
  classId: string;
  status: string;
  isRecurring?: boolean;
  parentSessionId?: string;
}

interface DeleteConfirmModalProps {
  session: Session;
  scope: 'this' | 'future' | 'all';
  onScopeChange: (scope: 'this' | 'future' | 'all') => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  session,
  scope,
  onScopeChange,
  onConfirm,
  onCancel
}) => {
  const isRecurring = session.isRecurring || session.parentSessionId;

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
        zIndex: 1001,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2.5rem',
          borderRadius: '20px',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>🗑️</div>
        <h2 style={{ 
          color: '#2d3748',
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.5rem',
          textAlign: 'center'
        }}>
          Delete "{session.classId}"?
        </h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          {isRecurring ? (
            <>
              <p style={{ 
                color: '#4a5568',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                This is a recurring session. How would you like to delete it?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  backgroundColor: scope === 'this' ? '#edf2f7' : '#f7fafc',
                  border: `2px solid ${scope === 'this' ? '#667eea' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="deleteScope"
                    value="this"
                    checked={scope === 'this'}
                    onChange={() => onScopeChange('this')}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <div>
                    <strong>This session only</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                      Delete only this occurrence
                    </p>
                  </div>
                </label>
                
                <label style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  backgroundColor: scope === 'future' ? '#edf2f7' : '#f7fafc',
                  border: `2px solid ${scope === 'future' ? '#667eea' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="deleteScope"
                    value="future"
                    checked={scope === 'future'}
                    onChange={() => onScopeChange('future')}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <div>
                    <strong>This & future sessions</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                      Delete this and all future occurrences
                    </p>
                  </div>
                </label>
                
                <label style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  backgroundColor: scope === 'all' ? '#edf2f7' : '#f7fafc',
                  border: `2px solid ${scope === 'all' ? '#667eea' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="deleteScope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => onScopeChange('all')}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <div>
                    <strong>All sessions</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                      Delete all occurrences in this recurring series
                    </p>
                  </div>
                </label>
              </div>
            </>
          ) : (
            <p style={{ 
              color: '#4a5568',
              fontSize: '0.95rem',
              marginBottom: '1rem'
            }}>
              This will delete:<br/>
              • Attendance records<br/>
              • Chains<br/>
              • Tokens<br/>
              • Scan logs<br/><br/>
              <strong>This action cannot be undone.</strong>
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
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
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: '#e53e3e',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(229, 62, 62, 0.3)',
              transition: 'all 0.2s'
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
