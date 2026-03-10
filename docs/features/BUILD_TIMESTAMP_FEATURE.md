# Build Timestamp Feature - March 9, 2026

## Purpose
Display build timestamp on all pages to verify deployments are actually updating.

## Implementation

### 1. BuildInfo Component
**File**: `frontend/src/components/BuildInfo.tsx`

Shows build timestamp and environment in bottom-right corner:
- Build time (UTC)
- Environment (dev/production/local-test)

### 2. Added to App
**File**: `frontend/src/pages/_app.tsx`

BuildInfo component added to all pages via `_app.tsx`.

### 3. Deployment Scripts Updated

**Development**: `deploy-full-development.sh`
```bash
NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
NEXT_PUBLIC_BUILD_ENV=development
```

**Production**: `deploy-full-production.sh`
```bash
NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
NEXT_PUBLIC_BUILD_ENV=production
```

## Usage

### Verify Deployment
1. Deploy to dev: `./deploy-full-development.sh`
2. Open dev site in browser
3. Check bottom-right corner for build timestamp
4. If timestamp doesn't change after deployment, deployment didn't update

### Local Testing
```bash
cd frontend
cat > .env.production << EOF
NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
NEXT_PUBLIC_BUILD_ENV=local-test
EOF
npm run build
```

## Troubleshooting

### Build timestamp not showing
- Check browser console for errors
- Verify `.env.production` has `NEXT_PUBLIC_BUILD_TIME`
- Clear browser cache

### Timestamp not updating after deployment
- Deployment may have failed
- Static Web App may be caching old version
- Check Azure Portal for deployment status
- Try force refresh (Ctrl+Shift+R)

### Router.isReady Fix
Also fixed QR code join issue by checking `router.isReady` before reading query parameters in `attendee.tsx`.

---

**Status**: ✅ Implemented
**Files Modified**: 4
**Deployment Scripts Updated**: 2
