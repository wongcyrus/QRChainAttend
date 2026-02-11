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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to submit answer');
      }

      onSubmit();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">📝 Quiz Question</h2>
            <div className="flex items-center gap-4">
              {/* Countdown Timer */}
              <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                timeRemaining <= 10 ? 'bg-red-500 animate-pulse' : 
                timeRemaining <= 30 ? 'bg-yellow-500' : 
                'bg-green-500'
              } text-white`}>
                ⏱️ {timeRemaining}s
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
                disabled={submitting}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Slide Image */}
          {question.slideUrl && (
            <div className="mb-6">
              <img 
                src={question.slideUrl} 
                alt="Slide" 
                className="w-full rounded-lg border-2 border-gray-200 shadow-sm"
              />
            </div>
          )}

          {/* Question */}
          <div className="mb-6">
            <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-300 mb-6 shadow-sm">
              <p className="text-xl font-bold text-gray-900 leading-relaxed break-words">
                {question.question}
              </p>
            </div>
            
            {/* Options */}
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <label
                  key={index}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedAnswer === option
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={selectedAnswer === option}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    disabled={submitting}
                    className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  />
                  <span className="ml-3 text-base text-gray-900 leading-relaxed font-medium break-words">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700">
              <p className="font-medium">⚠️ {error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedAnswer || timeRemaining <= 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? '⏳ Submitting...' : '✓ Submit Answer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
