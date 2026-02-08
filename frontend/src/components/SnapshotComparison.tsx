/**
 * Snapshot Comparison Component
 * Shows differences between two snapshots (new students, absent students, etc.)
 */

import React, { useState } from 'react';
import { SnapshotComparison as SnapshotComparisonType } from '../types/shared';

interface SnapshotComparisonProps {
  comparison: SnapshotComparisonType;
  className?: string;
}

export function SnapshotComparison({
  comparison,
  className = ''
}: SnapshotComparisonProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'new' | 'absent' | 'duplicates'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', count: null },
    { id: 'new', label: 'New Students', icon: '✨', count: comparison.differences.newStudents.length },
    { id: 'absent', label: 'Absent Students', icon: '👤', count: comparison.differences.absentStudents.length },
    { id: 'duplicates', label: 'Duplicate Scans', icon: '🔄', count: comparison.differences.duplicateScans.length }
  ];

  return (
    <div className={`snapshot-comparison ${className}`} style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem'
    }}>
      <h3 style={{ marginBottom: '1.5rem', color: '#2d3748' }}>Snapshot Comparison</h3>

      {/* Snapshot Info Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <SnapshotInfoCard
          label="Snapshot 1"
          snapshotId={comparison.snapshot1.snapshotId}
          capturedAt={comparison.snapshot1.capturedAt}
          totalScans={comparison.snapshot1.totalScans}
          studentsCount={comparison.snapshot1.studentsAppeared.length}
        />
        <SnapshotInfoCard
          label="Snapshot 2"
          snapshotId={comparison.snapshot2.snapshotId}
          capturedAt={comparison.snapshot2.capturedAt}
          totalScans={comparison.snapshot2.totalScans}
          studentsCount={comparison.snapshot2.studentsAppeared.length}
        />
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#f0f4f8',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
            Time Difference
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0078d4' }}>
            {Math.round(comparison.differences.timeDifference / 60)} min
          </div>
          <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
            Attendance Growth: {comparison.differences.newStudents.length - comparison.differences.absentStudents.length > 0 ? '+' : ''}{comparison.differences.newStudents.length - comparison.differences.absentStudents.length}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.5rem',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: selectedTab === tab.id ? '600' : '500',
              color: selectedTab === tab.id ? '#0078d4' : '#718096',
              borderBottom: selectedTab === tab.id ? '3px solid #0078d4' : '3px solid transparent',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span style={{
                backgroundColor: '#e8f4f8',
                color: '#0078d4',
                padding: '0.25rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'overview' && (
          <OverviewTab comparison={comparison} />
        )}
        {selectedTab === 'new' && (
          <StudentListTab
            students={comparison.differences.newStudents}
            title="New Students"
            icon="✨"
            emptyMessage="No new students"
            color="#107c10"
          />
        )}
        {selectedTab === 'absent' && (
          <StudentListTab
            students={comparison.differences.absentStudents}
            title="Absent Students"
            icon="👤"
            emptyMessage="No absent students"
            color="#d13438"
          />
        )}
        {selectedTab === 'duplicates' && (
          <StudentListTab
            students={comparison.differences.duplicateScans}
            title="Students in Both Snapshots"
            icon="🔄"
            emptyMessage="No duplicate scans"
            color="#0078d4"
          />
        )}
      </div>

      <style>{`
        .snapshot-comparison {
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

interface SnapshotInfoCardProps {
  label: string;
  snapshotId: string;
  capturedAt: number;
  totalScans: number;
  studentsCount: number;
}

function SnapshotInfoCard({
  label,
  snapshotId,
  capturedAt,
  totalScans,
  studentsCount
}: SnapshotInfoCardProps) {
  return (
    <div style={{
      padding: '1.25rem',
      backgroundColor: '#f0f4f8',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ fontSize: '0.875rem', color: '#2d3748', fontWeight: '600', marginBottom: '0.75rem' }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: '#718096',
        marginBottom: '0.75rem',
        fontFamily: 'monospace'
      }}>
        {snapshotId.substring(0, 8)}...
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        fontSize: '0.875rem'
      }}>
        <div>
          <div style={{ color: '#718096' }}>Captured At</div>
          <div style={{ fontWeight: '600', color: '#2d3748' }}>
            {new Date(capturedAt * 1000).toLocaleTimeString()}
          </div>
        </div>
        <div>
          <div style={{ color: '#718096' }}>Students</div>
          <div style={{ fontWeight: '600', color: '#2d3748' }}>
            {studentsCount}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  comparison: SnapshotComparisonType;
}

function OverviewTab({ comparison }: OverviewTabProps) {
  const newCount = comparison.differences.newStudents.length;
  const absentCount = comparison.differences.absentStudents.length;
  const dupCount = comparison.differences.duplicateScans.length;

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MetricCard
          label="New Students"
          value={newCount}
          icon="✨"
          color="#107c10"
          description="Appeared in snapshot 2 but not in snapshot 1"
        />
        <MetricCard
          label="Absent Students"
          value={absentCount}
          icon="👤"
          color="#d13438"
          description="Were in snapshot 1 but not in snapshot 2"
        />
        <MetricCard
          label="Returning Students"
          value={dupCount}
          color="#0078d4"
          icon="🔄"
          description="Present in both snapshots"
        />
        <MetricCard
          label="Net Change"
          value={newCount - absentCount}
          icon={newCount - absentCount > 0 ? "📈" : "📉"}
          color={newCount - absentCount > 0 ? "#107c10" : "#d13438"}
          description="Attendance growth/decline"
        />
      </div>

      <div style={{
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: '#718096'
      }}>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Summary:</strong> Between these two snapshots, {newCount} new student(s) appeared in attendance, 
          {absentCount > 0 ? ` ${absentCount} student(s) were absent, ` : ' no students were absent, '}
          and {dupCount} student(s) appeared in both snapshots.
        </p>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  description: string;
}

function MetricCard({ label, value, icon, color, description }: MetricCardProps) {
  return (
    <div style={{
      padding: '1.25rem',
      backgroundColor: '#f0f4f8',
      borderRadius: '8px',
      border: `2px solid ${color}`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#718096' }}>
        {description}
      </div>
    </div>
  );
}

interface StudentListTabProps {
  students: string[];
  title: string;
  icon: string;
  emptyMessage: string;
  color: string;
}

function StudentListTab({
  students,
  title,
  icon,
  emptyMessage,
  color
}: StudentListTabProps) {
  if (students.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#718096'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{icon}</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem'
      }}>
        {students.map((student) => (
          <div
            key={student}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: `${color}15`,
              border: `1px solid ${color}40`,
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: color,
              borderRadius: '50%'
            }}></span>
            {student}
          </div>
        ))}
      </div>
    </div>
  );
}
