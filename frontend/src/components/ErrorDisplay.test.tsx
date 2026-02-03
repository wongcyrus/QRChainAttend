/**
 * Error Display Component Tests
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorDisplay } from './ErrorDisplay';
import type { FormattedError } from '../utils/errorHandling';

describe('ErrorDisplay', () => {
  const mockError: FormattedError = {
    title: 'Test Error',
    message: 'This is a test error message',
    type: 'error',
    canRetry: false,
  };

  test('should not render when error is null', () => {
    const { container } = render(<ErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('should render error message', () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('This is a test error message')).toBeInTheDocument();
  });

  test('should render error type icon', () => {
    const { rerender } = render(<ErrorDisplay error={{ ...mockError, type: 'error' }} />);
    expect(screen.getByText('❌')).toBeInTheDocument();

    rerender(<ErrorDisplay error={{ ...mockError, type: 'warning' }} />);
    expect(screen.getByText('⚠️')).toBeInTheDocument();

    rerender(<ErrorDisplay error={{ ...mockError, type: 'info' }} />);
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  test('should apply correct styling based on error type', () => {
    const { container, rerender } = render(<ErrorDisplay error={{ ...mockError, type: 'error' }} />);
    expect(container.querySelector('.error-display.error')).toBeInTheDocument();

    rerender(<ErrorDisplay error={{ ...mockError, type: 'warning' }} />);
    expect(container.querySelector('.error-display.warning')).toBeInTheDocument();

    rerender(<ErrorDisplay error={{ ...mockError, type: 'info' }} />);
    expect(container.querySelector('.error-display.info')).toBeInTheDocument();
  });

  test('should render guidance when provided', () => {
    const errorWithGuidance: FormattedError = {
      ...mockError,
      guidance: 'Please ensure you are in the classroom.',
    };

    render(<ErrorDisplay error={errorWithGuidance} />);
    expect(screen.getByText('What to do:')).toBeInTheDocument();
    expect(screen.getByText('Please ensure you are in the classroom.')).toBeInTheDocument();
  });

  test('should render retry button when canRetry is true', () => {
    const onRetry = jest.fn();
    const retryableError: FormattedError = {
      ...mockError,
      canRetry: true,
    };

    render(<ErrorDisplay error={retryableError} onRetry={onRetry} />);
    
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  test('should not render retry button when canRetry is false', () => {
    const onRetry = jest.fn();
    render(<ErrorDisplay error={mockError} onRetry={onRetry} />);
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  test('should not render retry button when in cooldown', () => {
    const onRetry = jest.fn();
    const retryableError: FormattedError = {
      ...mockError,
      canRetry: true,
    };

    render(
      <ErrorDisplay 
        error={retryableError} 
        onRetry={onRetry}
        isInCooldown={true}
        cooldownSeconds={30}
      />
    );
    
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  test('should render cooldown timer when in cooldown', () => {
    render(
      <ErrorDisplay 
        error={mockError}
        isInCooldown={true}
        cooldownSeconds={45}
      />
    );
    
    expect(screen.getByText(/Please wait 45 seconds before trying again/)).toBeInTheDocument();
  });

  test('should render cooldown progress bar', () => {
    const { container } = render(
      <ErrorDisplay 
        error={mockError}
        isInCooldown={true}
        cooldownSeconds={30}
      />
    );
    
    const progressBar = container.querySelector('.cooldown-bar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '50%' }); // 30/60 * 100
  });

  test('should handle singular second in cooldown text', () => {
    render(
      <ErrorDisplay 
        error={mockError}
        isInCooldown={true}
        cooldownSeconds={1}
      />
    );
    
    expect(screen.getByText(/Please wait 1 second before trying again/)).toBeInTheDocument();
  });

  test('should render dismiss button by default', () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
  });

  test('should not render dismiss button when showDismiss is false', () => {
    render(<ErrorDisplay error={mockError} showDismiss={false} />);
    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });

  test('should call onDismiss when dismiss button is clicked', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    
    render(<ErrorDisplay error={mockError} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);

    // Wait for animation
    jest.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  test('should apply custom className', () => {
    const { container } = render(<ErrorDisplay error={mockError} className="custom-class" />);
    expect(container.querySelector('.error-display.custom-class')).toBeInTheDocument();
  });

  test('should animate in when error appears', async () => {
    jest.useFakeTimers();
    const { container } = render(<ErrorDisplay error={mockError} />);
    
    // Initially not visible
    const errorDisplay = container.querySelector('.error-display');
    expect(errorDisplay).not.toHaveClass('visible');

    // After animation delay
    jest.advanceTimersByTime(20);
    
    await waitFor(() => {
      expect(errorDisplay).toHaveClass('visible');
    });

    jest.useRealTimers();
  });

  test('should handle multiline messages', () => {
    const multilineError: FormattedError = {
      ...mockError,
      message: 'Line 1\nLine 2\nLine 3',
    };

    const { container } = render(<ErrorDisplay error={multilineError} />);
    const messageElement = container.querySelector('.error-message');
    expect(messageElement).toBeInTheDocument();
    expect(messageElement?.textContent).toBe('Line 1\nLine 2\nLine 3');
  });

  test('should render all components together', () => {
    const complexError: FormattedError = {
      title: 'Location Verification Failed',
      message: 'You must be in the classroom',
      type: 'warning',
      canRetry: false,
      guidance: 'Please ensure you are connected to the classroom Wi-Fi network.',
    };

    const onDismiss = jest.fn();

    render(
      <ErrorDisplay 
        error={complexError}
        isInCooldown={true}
        cooldownSeconds={30}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Location Verification Failed')).toBeInTheDocument();
    expect(screen.getByText('You must be in the classroom')).toBeInTheDocument();
    expect(screen.getByText('What to do:')).toBeInTheDocument();
    expect(screen.getByText(/Please ensure you are connected/)).toBeInTheDocument();
    expect(screen.getByText(/Please wait 30 seconds/)).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
  });

  test('should handle zero cooldown seconds', () => {
    const { container } = render(
      <ErrorDisplay 
        error={mockError}
        isInCooldown={true}
        cooldownSeconds={0}
      />
    );
    
    // Should not render cooldown timer when seconds is 0
    expect(container.querySelector('.cooldown-timer')).not.toBeInTheDocument();
  });
});
