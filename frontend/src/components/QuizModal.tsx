/**
 * Quiz Modal Component
 * Displays quiz questions to students and handles answer submission
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface QuizQuestion {
  questionId: string;
  responseId: string;
  question: string;
  options: string[];
  slideUrl?: string;
  sentAt: number;
  expiresAt: number;
}

interface QuizModalProps {
  sessionId: string;
  question: QuizQuestion;
  onClose: () => void;
  onSubmit: () => void;
}

export function QuizModal({ sessionId, question, onClose, onSubmit }: QuizModalProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer('');
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, [question.responseId]);

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, question.expiresAt - now);
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        setError('Time limit exceeded');
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [question.expiresAt, onClose]);

  const handleSubmit = async () => {
    if (!selectedAnswer) {
      setError('Please select an answer');
      return;
    }

    console.log('[Quiz] Submitting answer:', {
      responseId: question.responseId,
      answer: selectedAnswer
    });

    setSubmitting(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers = await getAuthHeaders();

      const response = await fetch(`${apiUrl}/sessions/${sessionId}/quiz/submit-answer`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          responseId: question.responseId,
          answer: selectedAnswer
        })
      });

      console.log('[Quiz] Submit response:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Quiz] Submit error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to submit answer');
      }

      const result = await response.json();
      console.log('[Quiz] Submit result:', result);

      // Show feedback for 3 seconds before closing
      setResult({
        isCorrect: result.isCorrect,
        feedback: result.feedback
      });
      
      setTimeout(() => {
        onSubmit();
        onClose();
      }, 3000);
      
    } catch (err: any) {
      console.error('[Quiz] Submit failed:', err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const getTimerColor = () => {
    if (timeRemaining <= 10) return '#dc3545';
    if (timeRemaining <= 30) return '#ffc107';
    return '#28a745';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        fontFamily: 'system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
          padding: '1.5rem',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>📝 Quiz Question</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Countdown Timer */}
              <div style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                backgroundColor: getTimerColor(),
                color: 'white',
                animation: timeRemaining <= 10 ? 'pulse 1s infinite' : 'none'
              }}>
                ⏱️ {timeRemaining}s
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '1.5rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.5 : 1
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Slide Image */}
          {question.slideUrl && (
            <div style={{ marginBottom: '1.5rem' }}>
              <img 
                src={question.slideUrl} 
                alt="Slide" 
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          )}

          {/* Question */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              backgroundColor: '#eff6ff',
              padding: '1.5rem',
              borderRadius: '8px',
              border: '2px solid #93c5fd',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#1f2937',
                lineHeight: '1.6',
                margin: 0,
                wordWrap: 'break-word'
              }}>
                {question.question}
              </p>
            </div>
            
            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {question.options.map((option, index) => (
                <label
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '1rem',
                    border: selectedAnswer === option ? '2px solid #2563eb' : '2px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    backgroundColor: selectedAnswer === option ? '#eff6ff' : 'white',
                    boxShadow: selectedAnswer === option ? '0 4px 6px rgba(37, 99, 235, 0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting && selectedAnswer !== option) {
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting && selectedAnswer !== option) {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={selectedAnswer === option}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    disabled={submitting}
                    style={{
                      width: '20px',
                      height: '20px',
                      marginTop: '2px',
                      marginRight: '12px',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      accentColor: '#2563eb'
                    }}
                  />
                  <span style={{
                    fontSize: '1rem',
                    color: '#1f2937',
                    lineHeight: '1.5',
                    fontWeight: '500',
                    wordWrap: 'break-word',
                    flex: 1
                  }}>
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              borderLeft: '4px solid #dc2626',
              borderRadius: '4px',
              color: '#991b1b'
            }}>
              <p style={{ margin: 0, fontWeight: '500' }}>⚠️ {error}</p>
            </div>
          )}

          {/* Result Feedback */}
          {result && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: result.isCorrect ? '#f0fdf4' : '#fef2f2',
              borderLeft: `4px solid ${result.isCorrect ? '#16a34a' : '#dc2626'}`,
              borderRadius: '4px',
              color: result.isCorrect ? '#166534' : '#991b1b'
            }}>
              <p style={{ margin: 0, fontWeight: '600', fontSize: '1.1rem' }}>
                {result.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              <p style={{ margin: '0.5rem 0 0 0' }}>{result.feedback}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '0.625rem 1.5rem',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#374151',
                fontWeight: '500',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                fontSize: '1rem'
              }}
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedAnswer || timeRemaining <= 0 || result !== null}
              style={{
                padding: '0.625rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: (submitting || !selectedAnswer || timeRemaining <= 0 || result !== null) ? '#9ca3af' : '#2563eb',
                color: 'white',
                fontWeight: '500',
                cursor: (submitting || !selectedAnswer || timeRemaining <= 0 || result !== null) ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                fontSize: '1rem'
              }}
            >
              {submitting ? '⏳ Submitting...' : result ? '✓ Submitted' : '✓ Submit Answer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
