/**
 * Local Development Configuration Page
 * Only available when NEXT_PUBLIC_ENVIRONMENT=local
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DevConfig() {
  const router = useRouter();
  const [email, setEmail] = useState('teacher@vtc.edu.hk');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    const local = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
    setIsLocal(local);
    
    if (!local) {
      router.push('/');
    }
  }, [router]);

  const handleSetUser = async () => {
    const mockUser = {
      clientPrincipal: {
        userId: `local-dev-${role}-${Date.now()}`,
        userDetails: email,
        identityProvider: 'aad',
        userRoles: ['authenticated', role]
      }
    };

    // Set cookie via API
    const response = await fetch('/api/auth/mock-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockUser)
    });

    if (response.ok) {
      router.push('/');
    }
  };

  if (!isLocal) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🛠️ Local Development Configuration</h1>
      <p style={{ color: '#666' }}>Configure your mock user for local testing</p>

      <div style={{ marginTop: '2rem' }}>
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
              borderRadius: '4px'
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
                value="teacher"
                checked={role === 'teacher'}
                onChange={(e) => setRole(e.target.value as 'teacher')}
                style={{ marginRight: '0.5rem' }}
              />
              Teacher
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="student"
                checked={role === 'student'}
                onChange={(e) => setRole(e.target.value as 'student')}
                style={{ marginRight: '0.5rem' }}
              />
              Student
            </label>
          </div>
        </div>

        <button
          onClick={handleSetUser}
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
          Set User & Login
        </button>
      </div>

      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        fontSize: '0.875rem'
      }}>
        <h3 style={{ marginTop: 0 }}>Quick Presets:</h3>
        <button
          onClick={() => {
            setEmail('teacher@vtc.edu.hk');
            setRole('teacher');
          }}
          style={{
            padding: '0.5rem 1rem',
            marginRight: '0.5rem',
            marginBottom: '0.5rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          👨‍🏫 Teacher
        </button>
        <button
          onClick={() => {
            setEmail('student@stu.vtc.edu.hk');
            setRole('student');
          }}
          style={{
            padding: '0.5rem 1rem',
            marginBottom: '0.5rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          👨‍🎓 Student
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
