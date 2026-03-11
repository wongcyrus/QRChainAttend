# QR Code Generation Sources - Complete Analysis

## Summary
Your application has **5 main sources** where QR codes are generated. Currently, some use JSON encoding and some use URL encoding. Here's the complete breakdown:

---

## 1. **QRDisplay Component** (frontend/src/components/QRDisplay.tsx)
**Status:** ✅ FIXED - Now generates URLs

**Purpose:** Reusable component for displaying QR codes with countdown timers

**What it does:**
- Takes QR data objects (ChainQRData, RotatingQRData, or URL strings)
- Converts data to URLs in format: `/attendee?sessionId=...&type=...&token=...`
- Displays QR code with expiration countdown

**Used by:**
- RotatingQRDisplay component (for late entry / early leave)

**Current format:** URL strings (after fix)

---

## 2. **Organizer Page** (frontend/src/pages/organizer.tsx)
**Status:** ✅ ALREADY CORRECT - Uses URLs

**Purpose:** Teacher/organizer dashboard for managing sessions

**QR Code Types Generated:**
1. **Entry QR** (line 289)
   - Fetches token from `/api/sessions/{sessionId}/entry-qr`
   - Creates URL: `{baseUrl}/attendee?sessionId={sessionId}&type=ENTRY&token={token}`
   - Encodes URL directly into QR code

2. **Exit QR** (line 361)
   - Fetches token from `/api/sessions/{sessionId}/exit-qr`
   - Creates URL: `{baseUrl}/attendee?sessionId={sessionId}&type=EXIT&token={token}`
   - Encodes URL directly into QR code

**Auto-refresh:** QR codes refresh every 10-25 seconds (based on backend token TTL)

**Current format:** URL strings ✓

---

## 3. **SimpleAttendeeView Component** (frontend/src/components/SimpleAttendeeView.tsx)
**Status:** ✅ ALREADY CORRECT - Uses URLs

**Purpose:** Student view showing their holder QR code

**What it does:**
- When student becomes chain holder, generates QR code (line 505)
- Fetches token from `/api/sessions/{sessionId}/tokens/{attendeeId}`
- Creates URL: `{baseUrl}/attendee?sessionId={sessionId}&chainId={chainId}&tokenId={token}&type=entry`
- Encodes URL directly into QR code

**Auto-refresh:** Polls every 5 seconds to get fresh tokens

**Current format:** URL strings ✓

---

## 4. **SessionCreationForm Component** (frontend/src/components/SessionCreationForm.tsx)
**Status:** ✅ ALREADY CORRECT - Uses URLs

**Purpose:** Form for creating new sessions

**What it does:**
- After session creation, displays success view with QR code (line 295)
- Takes `sessionQR` URL from backend response
- Encodes URL directly into QR code

**Current format:** URL strings ✓

---

## 5. **RotatingQRDisplay Component** (frontend/src/components/RotatingQRDisplay.tsx)
**Status:** ✅ USES QRDisplay (which is now fixed)

**Purpose:** Displays rotating QR codes for late entry and early leave

**What it does:**
- Fetches tokens from `/api/sessions/{sessionId}/late-qr` or `/api/sessions/{sessionId}/early-qr`
- Passes token data to QRDisplay component
- QRDisplay converts to URL format

**Current format:** Uses QRDisplay component (now generates URLs)

---

## Backend API Endpoints (Token Generation)

### Entry/Exit QR Endpoints
- **GET** `/api/sessions/{sessionId}/entry-qr` → Returns encrypted token
- **GET** `/api/sessions/{sessionId}/exit-qr` → Returns encrypted token

**Response format:**
```json
{
  "sessionId": "...",
  "type": "ENTRY" | "EXIT",
  "token": "encrypted_token_string",
  "expiresAt": 1234567890,
  "refreshInterval": 25000
}
```

### Chain Token Endpoint
- **GET** `/api/sessions/{sessionId}/tokens/{attendeeId}` → Returns holder token

**Response format:**
```json
{
  "isHolder": true,
  "token": "token_id",
  "chainId": "chain_id",
  "expiresAt": 1234567890
}
```

---

## QR Code URL Formats

### 1. Entry/Exit QR (Organizer)
```
https://your-domain.com/attendee?sessionId={sessionId}&type=ENTRY&token={encrypted_token}
https://your-domain.com/attendee?sessionId={sessionId}&type=EXIT&token={encrypted_token}
```

### 2. Chain Holder QR (Student)
```
https://your-domain.com/attendee?sessionId={sessionId}&chainId={chainId}&tokenId={token}&type=entry
```

### 3. Late Entry / Early Leave QR
```
https://your-domain.com/attendee?sessionId={sessionId}&type=LATE_ENTRY&token={token}
https://your-domain.com/attendee?sessionId={sessionId}&type=EARLY_LEAVE&token={token}
```

---

## QR Scanner (frontend/src/components/QRScanner.tsx)
**Status:** ✅ FIXED - Now expects URLs

**What it does:**
- Scans QR codes using device camera
- Expects URL format
- Opens the URL directly (navigates to `/attendee` page with query parameters)
- Has legacy JSON parsing support as fallback

---

## Summary of Changes Made

### ✅ Fixed Components:
1. **QRDisplay.tsx** - Now generates URLs from data objects instead of JSON
2. **QRScanner.tsx** - Now expects and handles URLs (with JSON fallback)

### ✅ Already Correct (No changes needed):
1. **organizer.tsx** - Already uses URLs
2. **SimpleAttendeeView.tsx** - Already uses URLs  
3. **SessionCreationForm.tsx** - Already uses URLs
4. **RotatingQRDisplay.tsx** - Uses QRDisplay (now fixed)

---

## Testing Checklist

- [ ] Entry QR from organizer page scans correctly
- [ ] Exit QR from organizer page scans correctly
- [ ] Chain holder QR from student view scans correctly
- [ ] Late entry QR scans correctly
- [ ] Early leave QR scans correctly
- [ ] QR codes refresh automatically with new tokens
- [ ] Expired QR codes show appropriate message

---

## Design Principle

**All QR codes should contain URLs, not JSON data.**

This is simpler, more standard, and allows:
- Direct navigation when scanned
- Better compatibility with external QR scanners
- Cleaner code without complex parsing
- Easier debugging (URLs are human-readable)
