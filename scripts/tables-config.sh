#!/bin/bash

# ============================================================================
# Azure Table Storage Configuration
# Single source of truth for all table names
# ============================================================================

# All tables used in the QR Chain Attendance system
# NOTE: ScanLogs and DeletionLog are optional/legacy tables
TABLES=(
  "Sessions"
  "Attendance"
  "Chains"
  "Tokens"
  "UserSessions"
  "AttendanceSnapshots"
  "ChainHistory"
  "ScanLogs"
  "DeletionLog"
  "QuizQuestions"
  "QuizResponses"
  "QuizMetrics"
)

# Export for use in other scripts
export TABLES
