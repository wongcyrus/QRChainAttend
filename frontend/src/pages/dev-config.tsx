/**
 * Local Development Configuration Page
 * Only available when NEXT_PUBLIC_ENVIRONMENT=local
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DevConfig() {
  const router = useRouter();
  const [email, setEmail] = useState('organizer@vtc.edu.hk');
  const [role, setRole] = useState<'organizer' | 'attendee'>('organizer');
  const [isLocal, setIsLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-configured test users
  const testUsers = [
    { email: 'teacher1@vtc.edu.hk', role: 'organizer' as const, label: 'Organizer 1' },
    { email: 'teacher2@vtc.edu.hk', role: 'organizer' as const, label: 'Organizer 2' },
    { email: 'teacher3@vtc.edu.hk', role: 'organizer' as const, label: 'Organizer 3' },
    { email: 'teacher4@vtc.edu.hk', role: 'organizer' as const, label: 'Organizer 4' },
    { email: 'student1@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 1' },
    { email: 'student2@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 2' },
    { email: 'student3@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 3' },
    { email: 'student4@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 4' },
    { email: 'student5@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 5' },
    { email: 'student6@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 6' },
    { email: 'student7@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 7' },
    { email: 'student8@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 8' },
    { email: 'student9@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 9' },
    { email: 'student10@stu.vtc.edu.hk', role: 'attendee' as const, label: 'Attendee 10' },
  ];

  useEffect(() => {
    const local = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
    setIsLocal(local);
    
    if (!local) {
      // Redirect to home in production
      router.push('/');
    }
  }, [router]);

  const handleSetUser = async (userEmail?: string, userRole?: 'organizer' | 'attendee') => {
    setError(null);
    
    // Use provided values or fall back to state
    const finalEmail = userEmail || email;
    const finalRole = userRole || role;
    
    const mockUser = {
      clientPrincipal: {
        userId: `local-dev-${finalRole}-${Date.now()}`,
        userDetails: finalEmail,
        identityProvider: 'aad',
        userRoles: ['authenticated', finalRole]
      }
    };

    // Set cookie via API
    const response = await fetch('/api/auth/mock-login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockUser)
    });

    if (response.ok) {
      router.push('/');
    } else {
      const data = await response.json();
      setError(data.message || 'Login failed');
    }
  };

  if (!isLocal) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '700px', margin: '0 auto' }}>
      <h1>🛠️ Local Development Configuration</h1>
      <p style={{ color: '#666' }}>Configure your mock user for local testing</p>

      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#fef0f0',
          border: '1px solid #d13438',
          borderRadius: '4px',
          color: '#d13438'
        }}>
          <strong>⚠️ Login Failed:</strong> {error}
        </div>
      )}

      {/* Quick Login Section */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f7fafc',
        borderRadius: '12px',
        border: '2px solid #e2e8f0'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>⚡ Quick Login</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Click to instantly login as a test user
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#0078d4' }}>
            👨‍🏫 Teachers
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {testUsers.filter(u => u.role === 'organizer').map(user => (
              <button
                key={user.email}
                onClick={() => handleSetUser(user.email, user.role)}
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#f0f0f0',
                  border: '2px solid #0078d4',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#0078d4';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.color = 'black';
                }}
              >
                {user.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#107c10' }}>
            👨‍🎓 Students
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {testUsers.filter(u => u.role === 'attendee').map(user => (
              <button
                key={user.email}
                onClick={() => handleSetUser(user.email, user.role)}
                style={{
                  padding: '0.75rem 0.5rem',
                  backgroundColor: '#f0f0f0',
                  border: '2px solid #107c10',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#107c10';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.color = 'black';
                }}
              >
                {user.label.replace('Attendee ', 'S')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Configuration */}
      <div style={{
        marginTop: '2rem',
        paddingTop: '2rem',
        borderTop: '2px solid #e0e0e0'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>✏️ Manual Configuration</h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
            placeholder="user@vtc.edu.hk"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Role
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="organizer"
                checked={role === 'organizer'}
                onChange={(e) => setRole(e.target.value as 'organizer')}
                style={{ marginRight: '0.5rem' }}
              />
              Organizer
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="attendee"
                checked={role === 'attendee'}
                onChange={(e) => setRole(e.target.value as 'attendee')}
                style={{ marginRight: '0.5rem' }}
              />
              Attendee
            </label>
          </div>
        </div>

        <button
          onClick={() => handleSetUser()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          Set Mock User
        </button>
      </div>

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>
          <strong>Note:</strong> This page is only available in local development mode.
          In production, real Azure AD authentication is used.
        </p>
      </div>
    </div>
  );
}
