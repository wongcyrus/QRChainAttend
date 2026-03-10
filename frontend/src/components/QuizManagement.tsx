/**
 * Quiz Management Component
 * View questions, answers, and attendee responses
 * Download quiz report
 */

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface QuizQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  slideId?: string;
  createdAt: number;
}

interface QuizResponse {
  attendeeId: string;
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  answeredAt: number;
}

interface QuizManagementProps {
  sessionId: string;
  onError?: (error: string) => void;
}

export function QuizManagement({ sessionId, onError }: QuizManagementProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  useEffect(() => {
    loadQuizData();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuizData = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers = await getAuthHeaders();

      // Load questions
      const qResponse = await fetch(`${apiUrl}/sessions/${sessionId}/quiz/questions`, {
        credentials: 'include',
        headers
      });

      if (qResponse.ok) {
        const qData = await qResponse.json();
        setQuestions(qData.questions || []);
      }

      // Load responses
      const rResponse = await fetch(`${apiUrl}/sessions/${sessionId}/quiz/responses`, {
        credentials: 'include',
        headers
      });

      if (rResponse.ok) {
        const rData = await rResponse.json();
        setResponses(rData.responses || []);
      }

    } catch (error: any) {
      onError?.('Failed to load quiz data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this quiz question and all responses?\n\nThis action cannot be undone.')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/quiz/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error?.message || 'Failed to delete question');
      }

      await loadQuizData();
    } catch (error: any) {
      onError?.('Error: ' + error.message);
    }
  };

  const downloadQuizReport = () => {
    // Generate CSV report
    const lines: string[] = [];
    
    // Header
    lines.push('Question,Correct Answer,Difficulty,Total Responses,Correct Responses,Accuracy');
    
    // Question data
    questions.forEach(q => {
      const qResponses = responses.filter(r => r.questionId === q.questionId);
      const correctCount = qResponses.filter(r => r.isCorrect).length;
      const accuracy = qResponses.length > 0 ? ((correctCount / qResponses.length) * 100).toFixed(1) : '0';
      
      lines.push([
        `"${q.questionText.replace(/"/g, '""')}"`,
        q.options[q.correctAnswer],
        q.difficulty,
        qResponses.length,
        correctCount,
        `${accuracy}%`
      ].join(','));
    });

    // Attendee responses
    lines.push('');
    lines.push('Attendee Responses');
    lines.push('Attendee,Question,Selected Answer,Correct,Answered At');
    
    responses.forEach(r => {
      const question = questions.find(q => q.questionId === r.questionId);
      if (question) {
        lines.push([
          r.attendeeId,
          `"${question.questionText.substring(0, 50).replace(/"/g, '""')}..."`,
          question.options[r.selectedAnswer] || 'N/A',
          r.isCorrect ? 'Yes' : 'No',
          new Date(r.answeredAt * 1000).toLocaleString()
        ].join(','));
      }
    });

    // Download
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-report-${sessionId}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getQuestionResponses = (questionId: string) => {
    return responses.filter(r => r.questionId === questionId);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
        Loading quiz data...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        backgroundColor: '#f7fafc',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#718096'
      }}>
        No quiz questions yet for this session.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#2d3748' }}>
          📝 Quiz Questions & Responses
        </h3>
        <button
          onClick={downloadQuizReport}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#48bb78',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#38a169'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
        >
          📥 Download Report
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {questions.map((question, index) => {
          const qResponses = getQuestionResponses(question.questionId);
          const correctCount = qResponses.filter(r => r.isCorrect).length;
          const accuracy = qResponses.length > 0 ? ((correctCount / qResponses.length) * 100).toFixed(0) : '0';
          const isExpanded = selectedQuestion === question.questionId;

          return (
            <div
              key={question.questionId}
              style={{
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}
            >
              {/* Question Header */}
              <div
                onClick={() => setSelectedQuestion(isExpanded ? null : question.questionId)}
                style={{
                  padding: '1rem',
                  backgroundColor: isExpanded ? '#f7fafc' : 'white',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => !isExpanded && (e.currentTarget.style.backgroundColor = '#f7fafc')}
                onMouseOut={(e) => !isExpanded && (e.currentTarget.style.backgroundColor = 'white')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '0.5rem' }}>
                      Q{index + 1}: {question.questionText}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                      {new Date(question.createdAt * 1000).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(question.questionId);
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: '#fed7d7',
                        color: '#742a2a',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fc8181'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fed7d7'}
                    >
                      🗑️ Delete
                    </button>
                    <span style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#e0f2fe',
                      color: '#075985',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {question.difficulty}
                    </span>
                    <span style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#f0fdf4',
                      color: '#166534',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {qResponses.length} responses
                    </span>
                    <span style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: parseInt(accuracy) >= 70 ? '#dcfce7' : parseInt(accuracy) >= 50 ? '#fef3c7' : '#fee2e2',
                      color: parseInt(accuracy) >= 70 ? '#166534' : parseInt(accuracy) >= 50 ? '#92400e' : '#991b1b',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {accuracy}% correct
                    </span>
                    <span style={{ fontSize: '1.25rem', color: '#718096' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{ padding: '1rem', borderTop: '2px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                  {/* Answer Options */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>
                      Answer Options:
                    </div>
                    {question.options.map((option, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: idx === question.correctAnswer ? '#dcfce7' : 'white',
                          border: `2px solid ${idx === question.correctAnswer ? '#22c55e' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <span style={{ fontWeight: '600', color: '#718096' }}>
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <span style={{ color: '#2d3748' }}>{option}</span>
                        {idx === question.correctAnswer && (
                          <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: '600' }}>
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Attendee Responses */}
                  {qResponses.length > 0 && (
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>
                        Attendee Responses ({qResponses.length}):
                      </div>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {qResponses.map((response, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.75rem',
                              marginBottom: '0.5rem',
                              backgroundColor: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span style={{ color: '#2d3748', fontWeight: '500' }}>
                              {response.attendeeId}
                            </span>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <span style={{ color: '#718096', fontSize: '0.875rem' }}>
                                Answer: {String.fromCharCode(65 + response.selectedAnswer)}
                              </span>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: response.isCorrect ? '#dcfce7' : '#fee2e2',
                                color: response.isCorrect ? '#166534' : '#991b1b',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                              }}>
                                {response.isCorrect ? '✓ Correct' : '✗ Wrong'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
