/**
 * Capture Tab - Photo capture and seating verification
 */

import React from 'react';
import { TeacherCaptureControl, type UploadCompleteEvent, type CaptureExpiredEvent, type CaptureResultsEvent } from '../OrganizerCaptureControl';
import { SnapshotManager } from '../SnapshotManager';
import { CaptureHistory } from '../CaptureHistory';

interface CaptureTabProps {
  sessionId: string;
  sessionStatus: string;
  onlineStudentCount: number;
  onError: (error: string) => void;
  uploadCompleteHandlerRef: React.MutableRefObject<((event: UploadCompleteEvent) => void) | null>;
  captureExpiredHandlerRef: React.MutableRefObject<((event: CaptureExpiredEvent) => void) | null>;
  captureResultsHandlerRef: React.MutableRefObject<((event: CaptureResultsEvent) => void) | null>;
}

export const CaptureTab: React.FC<CaptureTabProps> = ({
  sessionId,
  sessionStatus,
  onlineStudentCount,
  onError,
  uploadCompleteHandlerRef,
  captureExpiredHandlerRef,
  captureResultsHandlerRef,
}) => {
  const [historyRefresh, setHistoryRefresh] = React.useState(0);

  return (
    <div>
      {/* Organizer Capture Control */}
      <div style={{ marginBottom: '2rem' }}>
        <TeacherCaptureControl
          sessionId={sessionId}
          sessionStatus={sessionStatus as any}
          onlineStudentCount={onlineStudentCount}
          onError={onError}
          ref={(instance) => {
            if (instance) {
              uploadCompleteHandlerRef.current = instance.handleUploadComplete;
              captureExpiredHandlerRef.current = instance.handleCaptureExpired;
              
              const originalHandler = instance.handleCaptureResults;
              captureResultsHandlerRef.current = (event) => {
                originalHandler(event);
                setHistoryRefresh(prev => prev + 1);
              };
            }
          }}
        />
      </div>

      {/* Snapshot Manager */}
      <div style={{ marginBottom: '2rem' }}>
        <SnapshotManager
          sessionId={sessionId}
          onError={onError}
        />
      </div>

      {/* Capture History */}
      <div style={{ marginBottom: '2rem' }}>
        <CaptureHistory
          sessionId={sessionId}
          onError={onError}
          refreshTrigger={historyRefresh}
        />
      </div>
    </div>
  );
};
