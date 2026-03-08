/**
 * Batch Image Analysis Modal Component
 * 
 * Allows teachers to analyze captured images with a custom prompt.
 * Displays results and provides CSV download functionality.
 */

import React, { useState } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface BatchImageAnalysisModalProps {
  sessionId: string;
  captureRequestId: string;
  imageCount: number;
  onClose: () => void;
}

interface ImageAnalysisResult {
  attendeeId: string;
  imageUrl: string;
  analysis: string;
  timestamp: string;
}

interface AnalyzeImagesResponse {
  captureRequestId: string;
  sessionId: string;
  prompt: string;
  results: ImageAnalysisResult[];
  analyzedAt: string;
  totalImages: number;
}

export function BatchImageAnalysisModal({
  sessionId,
  captureRequestId,
  imageCount,
  onClose
}: BatchImageAnalysisModalProps) {
  const [prompt, setPrompt] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalyzeImagesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `/api/sessions/${sessionId}/capture/${captureRequestId}/analyze`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt: prompt.trim() })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Analysis failed');
      }

      const data: AnalyzeImagesResponse = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze images');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!results) return;

    // Generate CSV content
    const headers = ['Attendee ID', 'Analysis', 'Timestamp'];
    const rows = results.results.map(result => [
      result.attendeeId,
      `"${result.analysis.replace(/"/g, '""')}"`, // Escape quotes
      new Date(result.timestamp).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-analysis-${captureRequestId}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const examplePrompts = [
    'Are students wearing masks?',
    'Is the projector screen visible in the image?',
    'What objects are on the attendee\'s desk?',
    'Is the attendee looking at the camera?',
    'Describe the venue environment visible in the image'
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e2e8f0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#2d3748' }}>
            🔍 Batch Image Analysis
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#718096',
              padding: '0.25rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Info */}
        <div style={{
          padding: '1rem',
          backgroundColor: '#ebf8ff',
          border: '1px solid #90cdf4',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: '#2c5282'
        }}>
          <strong>📊 {imageCount} images</strong> will be analyzed in batches of 10.
          <br />
          Enter a question or prompt to analyze all images.
        </div>

        {!results ? (
          <>
            {/* Prompt Input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#2d3748'
              }}>
                Analysis Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Are the students wearing masks?"
                disabled={analyzing}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Example Prompts */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#718096',
                marginBottom: '0.5rem'
              }}>
                Example prompts:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {examplePrompts.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(example)}
                    disabled={analyzing}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f7fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      color: '#4a5568'
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#fff5f5',
                border: '1px solid #fc8181',
                borderRadius: '8px',
                color: '#c53030',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={analyzing}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#e2e8f0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  opacity: analyzing ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !prompt.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: analyzing || !prompt.trim() ? '#cbd5e0' : '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: analyzing || !prompt.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {analyzing ? '⏳ Analyzing...' : '🔍 Run Analysis'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Results */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#f0fff4',
              border: '1px solid #9ae6b4',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: '600', color: '#22543d', marginBottom: '0.5rem' }}>
                ✓ Analysis Complete
              </div>
              <div style={{ fontSize: '0.9rem', color: '#2f855a' }}>
                Analyzed {results.totalImages} images with prompt: "{results.prompt}"
              </div>
            </div>

            {/* Results Table */}
            <div style={{
              maxHeight: '400px',
              overflow: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f7fafc' }}>
                  <tr>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #e2e8f0',
                      fontWeight: '600',
                      color: '#2d3748'
                    }}>
                      Attendee ID
                    </th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #e2e8f0',
                      fontWeight: '600',
                      color: '#2d3748'
                    }}>
                      Analysis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((result, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#4a5568',
                        verticalAlign: 'top'
                      }}>
                        {result.attendeeId}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#2d3748'
                      }}>
                        {result.analysis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#e2e8f0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={handleDownloadCSV}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📥 Download CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
