# Changelog

## [Unreleased] - 2026-03-07

### Added
- **Image Analysis Agent**: New AI agent for custom image analysis with teacher prompts
- **Batch Image Analysis Feature**: Teachers can analyze captured images with custom questions
- **Agent Setup Documentation**: Comprehensive guide in `docs/deployment/AGENT_SETUP.md`
- **CSV Export**: Download analysis results as CSV files

### Fixed
- **Image Upload CORS**: Updated storage.bicep to allow uploads from Azure Static Web Apps
- **Image Retrieval**: Fixed partition key query in `listCaptureUploads` (captureRequestId vs sessionId)
- **SAS URL Generation**: Fixed to use full blob URL instead of blob name
- **TypeScript Error**: Fixed parameter name in `gptPositionEstimation.ts` (userMessage → userPrompt)

### Removed
- **Unused Azure Functions** (6 total):
  - `getEarlyQR` - Stub function
  - `testDurableOrchestrator` - Test function
  - `negotiate` - Replaced by specific negotiate functions
  - `negotiateStudent` - Replaced by `studentNegotiate`
  - `registerSession` - Not used in frontend
  - `requestChallenge` - Legacy challenge flow

### Changed
- **Function Count**: Reduced from 64 to 58 Azure Functions (9% reduction)
- **Agent Creation Script**: Updated `create-agents.ts` to create 3 agents (was 2)
- **Deployment Scripts**: Updated to configure image analysis agent
- **Documentation**: Consolidated root-level docs into `docs/` folder structure

### Documentation
- Moved `AGENT_SETUP_COMPLETE.md` → `docs/deployment/AGENT_SETUP.md`
- Moved `BATCH_IMAGE_ANALYSIS_IMPLEMENTATION.md` → `docs/features/BATCH_IMAGE_ANALYSIS.md`
- Updated `DOCUMENTATION_INDEX.md` with new structure
- Added "Recent Fixes" section to batch image analysis docs

## Files Modified

### Backend
- `backend/src/functions/analyzeCaptureImages.ts` - Fixed SAS URL generation
- `backend/src/utils/captureStorage.ts` - Fixed partition key query
- `backend/src/utils/gptPositionEstimation.ts` - Fixed parameter name
- `backend/src/utils/blobStorage.ts` - (no changes, but referenced in fixes)

### Infrastructure
- `infrastructure/modules/storage.bicep` - Fixed CORS configuration

### Deployment
- `create-agents.ts` - Added ImageAnalysisAgent
- `deploy-full-development.sh` - Added analysis agent variables
- `deploy-full-production.sh` - Added analysis agent variables

### Documentation
- `docs/deployment/AGENT_SETUP.md` - New comprehensive agent guide
- `docs/features/BATCH_IMAGE_ANALYSIS.md` - Updated with fixes
- `DOCUMENTATION_INDEX.md` - Updated structure
- `CHANGELOG.md` - This file

### Deleted
- `AGENT_SETUP_COMPLETE.md` - Consolidated into docs
- `BATCH_IMAGE_ANALYSIS_IMPLEMENTATION.md` - Consolidated into docs
- `backend/src/functions/getEarlyQR.ts` - Unused stub
- `backend/src/functions/testDurableOrchestrator.ts` - Test function
- `backend/src/functions/negotiate.ts` - Replaced
- `backend/src/functions/negotiateStudent.ts` - Replaced
- `backend/src/functions/registerSession.ts` - Unused
- `backend/src/functions/requestChallenge.ts` - Legacy

## Deployment Notes

To apply all changes:

```bash
# Full redeployment (recommended)
./deploy-full-production.sh

# Or just rebuild backend
cd backend && npm run build
```

## Breaking Changes

None - all changes are backward compatible.

## Migration Guide

No migration needed. Existing deployments will continue to work. To use new features:

1. Redeploy infrastructure for CORS fix
2. Run `create-agents.ts` to create ImageAnalysisAgent
3. Rebuild and deploy backend

## Known Issues

None

---

**Version**: 3.0.1  
**Date**: March 7, 2026  
**Status**: ✅ Ready for Deployment
