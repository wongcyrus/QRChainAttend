# Progressive Web App (PWA) Implementation

## Overview

The QR Chain Attendance system is implemented as a Progressive Web App (PWA), providing native app-like experience on mobile devices with offline capabilities.

**Requirements Satisfied:**
- **20.1**: PWA installability with valid manifest.json and service worker
- **20.2**: Offline capability for cached resources
- **20.3**: "Add to Home Screen" functionality
- **20.4**: Static asset caching for faster loading
- **20.5**: Offline message for network-dependent operations

## Files

### 1. manifest.json
The Web App Manifest defines how the app appears when installed:

**Key Features:**
- App name and description
- Display mode: `standalone` (full-screen, no browser UI)
- Theme color: `#0078d4` (Microsoft blue)
- Icons: 192x192 and 512x512 PNG files
- Orientation: `portrait-primary` (optimized for mobile)
- Shortcuts: Quick access to Student and Teacher views
- Categories: Education and Productivity

**Installation Triggers:**
- Valid manifest with required fields
- Service worker registered
- Served over HTTPS (or localhost for development)
- User engagement signals (visits, time spent)

### 2. sw.js (Service Worker)
The service worker enables offline functionality and caching:

**Caching Strategies:**

1. **Static Assets (Cache-First)**
   - Serves from cache immediately
   - Updates cache in background
   - Assets: HTML, CSS, JS, images, fonts
   - Provides instant loading

2. **API Requests (Network-First)**
   - Always tries network first
   - Falls back to cache if offline
   - Returns custom offline response if no cache
   - Ensures fresh data when online

3. **Runtime Caching**
   - Dynamically caches visited pages
   - Caches successful API responses
   - Automatic cache cleanup on activation

**Cache Names:**
- `qr-attendance-v1`: Static assets
- `qr-attendance-runtime-v1`: Runtime cached resources

**Lifecycle:**
1. **Install**: Cache core static assets
2. **Activate**: Clean up old caches
3. **Fetch**: Intercept requests and apply caching strategies

### 3. offline.html
Fallback page displayed when offline:

**Features:**
- Attractive, user-friendly design
- Connection status indicator
- Auto-reload when connection restored
- Helpful troubleshooting tips
- Responsive layout

### 4. Icons
App icons for home screen and splash screen:

**Files:**
- `icon-192.png`: 192x192 pixels (home screen, app drawer)
- `icon-512.png`: 512x512 pixels (splash screen, high-res displays)
- `icon.svg`: Source SVG for regenerating icons

**Design:**
- Blue background (#0078d4)
- QR code pattern
- Chain link symbol
- Purpose: `any maskable` (works on all platforms)

## Installation

### Mobile Devices

**Android (Chrome, Edge, Samsung Internet):**
1. Visit the app in browser
2. Tap menu (⋮) → "Add to Home screen" or "Install app"
3. Confirm installation
4. App icon appears on home screen

**iOS (Safari):**
1. Visit the app in Safari
2. Tap Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Confirm and name the app
5. App icon appears on home screen

**Desktop (Chrome, Edge):**
1. Visit the app in browser
2. Look for install icon in address bar
3. Click "Install" button
4. App opens in standalone window

### Installation Criteria

The browser will offer installation when:
- ✅ Valid manifest.json with required fields
- ✅ Service worker registered and active
- ✅ Served over HTTPS (production) or localhost (dev)
- ✅ User has engaged with the site (multiple visits)
- ✅ Icons provided in manifest

## Testing PWA Features

### 1. Test Service Worker Registration

Open browser DevTools → Application → Service Workers

**Expected:**
- Status: "activated and is running"
- Source: `/sw.js`
- No errors in console

### 2. Test Offline Functionality

**Steps:**
1. Load the app while online
2. Open DevTools → Network tab
3. Check "Offline" checkbox
4. Refresh the page
5. Navigate to different pages

**Expected:**
- Cached pages load successfully
- Offline page shown for uncached pages
- API calls show offline error message

### 3. Test Manifest

Open DevTools → Application → Manifest

**Expected:**
- All fields populated correctly
- Icons load without errors
- "Add to Home Screen" link available

### 4. Test Caching

Open DevTools → Application → Cache Storage

**Expected:**
- `qr-attendance-v1` cache exists
- Contains static assets
- `qr-attendance-runtime-v1` cache exists
- Contains runtime cached resources

### 5. Test Installation

**Desktop:**
- Install icon appears in address bar
- Click to install
- App opens in standalone window

**Mobile:**
- "Add to Home Screen" prompt appears
- Install and verify icon on home screen
- Open app - should feel native

## Lighthouse PWA Audit

Run Lighthouse audit in Chrome DevTools:

```bash
# Or use CLI
npm install -g lighthouse
lighthouse https://your-app-url --view
```

**Target Scores:**
- ✅ PWA: 100/100
- ✅ Performance: 90+/100
- ✅ Accessibility: 90+/100
- ✅ Best Practices: 90+/100

**PWA Checklist:**
- ✅ Registers a service worker
- ✅ Responds with 200 when offline
- ✅ Contains valid manifest
- ✅ Uses HTTPS
- ✅ Redirects HTTP to HTTPS
- ✅ Configured for custom splash screen
- ✅ Sets theme color
- ✅ Content sized correctly for viewport
- ✅ Has maskable icon

## Updating the PWA

### Updating Service Worker

When you update `sw.js`:

1. Change `CACHE_NAME` version:
   ```javascript
   const CACHE_NAME = 'qr-attendance-v2'; // Increment version
   ```

2. Update `STATIC_ASSETS` if needed

3. Deploy changes

4. Users will get update on next visit:
   - Old service worker continues serving
   - New service worker installs in background
   - New service worker activates on next page load
   - Old caches cleaned up

### Updating Manifest

Changes to `manifest.json` take effect immediately on next visit.

### Updating Icons

1. Update `icon.svg` with new design
2. Regenerate PNG files (see ICONS_README.md)
3. Deploy new icons
4. Users see new icons after reinstalling or clearing cache

## Troubleshooting

### Service Worker Not Registering

**Check:**
- HTTPS enabled (or using localhost)
- No JavaScript errors in console
- Service worker file accessible at `/sw.js`
- Browser supports service workers

**Fix:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
// Then reload page
```

### Offline Mode Not Working

**Check:**
- Service worker activated
- Assets cached (check Cache Storage in DevTools)
- Network tab shows requests served from service worker

**Fix:**
- Clear cache and reload
- Unregister service worker and re-register
- Check service worker console for errors

### Install Prompt Not Showing

**Check:**
- All PWA criteria met (see Installation Criteria)
- User has visited site multiple times
- Not already installed
- Browser supports installation

**Fix:**
- Wait for user engagement signals
- Test on different browser
- Check manifest validity

### Icons Not Displaying

**Check:**
- PNG files exist and are valid
- Correct paths in manifest.json
- Correct sizes (192x192, 512x512)
- Served with correct MIME type

**Fix:**
- Regenerate icons
- Clear browser cache
- Verify file paths

## Browser Support

### Full PWA Support:
- ✅ Chrome 67+ (Android, Desktop)
- ✅ Edge 79+ (Desktop, Android)
- ✅ Samsung Internet 8.2+
- ✅ Firefox 79+ (Android)
- ✅ Opera 54+

### Partial Support:
- ⚠️ Safari 11.1+ (iOS, macOS)
  - Supports service workers and Add to Home Screen
  - Limited manifest support
  - No install prompt

### No Support:
- ❌ Internet Explorer
- ❌ Older mobile browsers

## Performance Optimization

### Service Worker Best Practices:

1. **Cache Selectively**
   - Only cache essential assets
   - Use runtime caching for dynamic content
   - Set cache size limits

2. **Update Strategy**
   - Version cache names
   - Clean up old caches on activate
   - Use stale-while-revalidate for non-critical assets

3. **Network Strategy**
   - Network-first for API calls (fresh data)
   - Cache-first for static assets (fast loading)
   - Offline fallback for navigation

4. **Monitoring**
   - Log service worker events
   - Track cache hit rates
   - Monitor offline usage

## Security Considerations

1. **HTTPS Required**
   - Service workers only work over HTTPS
   - Prevents man-in-the-middle attacks
   - Ensures content integrity

2. **Scope Limitation**
   - Service worker scope limited to `/`
   - Cannot access parent directories
   - Isolated from other origins

3. **Cache Security**
   - Don't cache sensitive data
   - Clear cache on logout
   - Use appropriate cache headers

4. **Update Mechanism**
   - Service worker updates automatically
   - Byte-diff detection
   - Safe rollback if update fails

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Workbox](https://developers.google.com/web/tools/workbox) - Advanced service worker library
