/**
 * Login Page
 * Email OTP authentication flow
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getAuthEndpoint } from '../utils/authHeaders';

type LoginStep = 'email' | 'otp';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>();

  // Show error message if redirected with error parameter
  useEffect(() => {
    if (router.query.error === 'no_role') {
      setError('Your account has no assigned role. Please contact your administrator to assign you an "organizer" or "attendee" role.');
    }
  }, [router.query.error]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authEndpoint = getAuthEndpoint();
        const response = await fetch(authEndpoint, {
          credentials: 'include',
          cache: 'no-store'
        });
        
        const data = await response.json();
        if (data.clientPrincipal) {
          // Already authenticated, redirect based on role
          const roles = data.clientPrincipal.userRoles || [];
          if (roles.includes('organizer')) {
            router.push('/organizer');
          } else if (roles.includes('attendee')) {
            router.push('/attendee');
          }
          // If no role, stay on login page
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    
    checkAuth();
  }, [router]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.error?.retryAfter || 900;
          setError(`Too many requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`);
        } else if (response.status === 403) {
          setError('This email domain is not authorized. Please contact your administrator.');
        } else {
          setError(data.error?.message || 'Failed to send verification code');
        }
        return;
      }

      // Success - move to OTP step
      setStep('otp');
      setCountdown(data.expiresIn || 300); // 5 minutes default
      setOtp('');
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Important for cookie
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const attemptsLeft = data.error?.attemptsRemaining;
          setAttemptsRemaining(attemptsLeft);
          
          if (data.error?.code === 'OTP_EXPIRED') {
            setError('Verification code has expired. Please request a new one.');
            setStep('email');
          } else if (data.error?.code === 'MAX_ATTEMPTS_EXCEEDED') {
            setError('Too many failed attempts. Please request a new code.');
            setStep('email');
          } else {
            const attemptsMsg = attemptsLeft !== undefined 
              ? ` (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining)`
              : '';
            setError(`Invalid verification code${attemptsMsg}`);
          }
        } else {
          setError(data.error?.message || 'Failed to verify code');
        }
        return;
      }

      // Success - redirect based on role
      const user = data.user;
      
      // Wait a moment for cookie to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect based on role
      if (user.userRoles.includes('organizer')) {
        await router.push('/organizer');
      } else if (user.userRoles.includes('attendee')) {
        await router.push('/attendee');
      } else {
        // No role assigned - show error
        setError('Your account has no assigned role. Please contact your administrator.');
      }
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    setStep('email');
    setOtp('');
    setError('');
    setAttemptsRemaining(undefined);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Head>
        <title>Login - ProvePresent</title>
      </Head>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem 1rem'
      }}>
        <div style={{
          display: 'flex',
          gap: '2rem',
          maxWidth: '1000px',
          width: '100%',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {/* Left Side - Branding & Info */}
          <div style={{
            flex: '1 1 400px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🔗✓</div>
            <h1 style={{ 
              fontSize: '3rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              ProvePresent
            </h1>
            <p style={{ 
              fontSize: '1.25rem', 
              marginBottom: '2rem',
              opacity: 0.95
            }}>
              Peer-Verified Event Attendance
            </p>
            
            {/* Feature Highlights */}
            <div style={{
              textAlign: 'left',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>🔗</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Chain Verification</strong>
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    Pass tokens peer-to-peer to prove physical presence
                  </span>
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>📊</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Real-time Dashboard</strong>
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    Track attendance as verification chains progress
                  </span>
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>🧠</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>AI-Powered Quizzes</strong>
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    Generate questions from presentation slides
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>📍</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Location Validation</strong>
                  <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    Optional geofencing with configurable radius
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div style={{
            backgroundColor: 'white',
            padding: '2.5rem',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            width: '100%',
            maxWidth: '420px',
            flex: '0 0 auto'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '0.5rem',
              textAlign: 'center',
              color: '#2d3748'
            }}>
              Welcome Back
            </h2>
            <p style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              marginBottom: '2rem'
            }}>
              Sign in to manage or join events
            </p>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleRequestOtp}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="email" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem'
                }}>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: loading || !email ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: loading || !email ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>

              <p style={{
                marginTop: '1.5rem',
                fontSize: '0.875rem',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                A verification code will be sent to your email address
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginBottom: '1rem'
                }}>
                  Enter the 6-digit code sent to:<br />
                  <strong>{email}</strong>
                </p>

                <label htmlFor="otp" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem'
                }}>
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                  disabled={loading}
                  maxLength={6}
                  pattern="\d{6}"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '1.5rem',
                    letterSpacing: '0.5rem',
                    textAlign: 'center'
                  }}
                />

                {countdown > 0 && (
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    textAlign: 'center'
                  }}>
                    Code expires in {formatTime(countdown)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: loading || otp.length !== 6 ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                  marginBottom: '0.5rem'
                }}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Use Different Email
              </button>
            </form>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
