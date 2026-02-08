# Complete Test Flow - QR Chain Attendance

## Prerequisites
```bash
# Start servers
./dev-tools.sh start --open

# Or manually
./dev-tools.sh start
# Then open: http://localhost:3000/dev-config
```

## Step-by-Step Test

### 1. Teacher: Create Session

**Tab 1 - Teacher**
1. Go to: `http://localhost:3000/dev-config`
2. Email: `teacher@vtc.edu.hk`
3. Click "Login"
4. Click "Teacher Dashboard"
5. Fill in form:
   - Class ID: `CS101`
   - Start time: (now)
   - End time: (1 hour later)
   - Late cutoff: `15`
6. Click "Create Session"
7. **Copy the session ID** (you'll see it in the success message or QR code)

### 2. Students: Join Session

**Tab 2 - Student 1**
1. Go to: `http://localhost:3000/dev-config`
2. Email: `student1@stu.vtc.edu.hk`
3. Click "Login"
4. Click "Student View"
5. Navigate to `/student?sessionId=<session-id>` or scan teacher's QR code
6. ✅ Should see: Session info, "How to Mark Attendance" instructions
7. ❌ Should NOT see: QR code yet (teacher hasn't seeded chains)

**Tab 3 - Student 2**
1. Go to: `http://localhost:3000/dev-config`
2. Email: `student2@stu.vtc.edu.hk`
3. Click "Login"
4. Click "Student View"
5. Navigate to `/student?sessionId=<session-id>` or scan teacher's QR code
6. ✅ Should see: Session info, instructions
7. ❌ Should NOT see: QR code yet

**Tab 4 - Student 3**
1. Go to: `http://localhost:3000/dev-config`
2. Email: `student3@stu.vtc.edu.hk`
3. Click "Login"
4. Click "Student View"
5. Navigate to `/student?sessionId=<session-id>` or scan teacher's QR code
6. ✅ Should see: Session info, instructions
7. ❌ Should NOT see: QR code yet

### 3. Teacher: Check Dashboard

**Tab 1 - Teacher**
1. Click "View Dashboard" on the session
2. ✅ Should see: 3 students in "Not Yet Marked" status
3. ✅ Should see: "Chain Management" section
4. ✅ Should see: "Seed Entry Chains" button

### 4. Teacher: Seed Entry Chains

**Tab 1 - Teacher**
1. Scroll to "Chain Management"
2. Set "Number of chains" to `2` (or keep default 3)
3. Click "Seed Entry Chains"
4. ✅ Should see: Success message like "Successfully seeded 2 entry chain(s) with holders: student1, student2"
5. ✅ Should see: Active Entry Chains list showing the chains

### 5. Students: Check for QR Codes

**Tabs 2-4 - All Students**
1. Wait 5-10 seconds (for SignalR update or polling)
2. **Holders (2 students)** should see:
   - 🟡 Yellow box
   - "🎯 You are the Chain Holder!"
   - Large QR code
   - "Show this QR code to another student"
3. **Non-holders (1 student)** should see:
   - Instructions: "Wait for the teacher to start the entry chain"
   - "When a peer becomes a holder, scan their QR code"

### 6. Verify QR Code Content

**Holder Tab**
1. Right-click on QR code → "Open image in new tab"
2. Or inspect the QR code URL in the component
3. ✅ Should be a URL like: `http://localhost:3000/student?sessionId=xxx&chainId=yyy&tokenId=zzz&type=entry`

### 7. Test Chain Transfer (Future)

**Non-holder Student**
1. Copy the QR code URL from a holder
2. Open in new tab (simulates scanning with phone)
3. Should process the scan and become new holder
4. Previous holder should be marked as present

## Expected Results

### After Step 2 (Students Join)
- ✅ All students see session information
- ✅ All students see "How to Mark Attendance" instructions
- ❌ NO students see QR codes yet
- ✅ Teacher dashboard shows 3 "Not Yet Marked" students

### After Step 4 (Teacher Seeds Chains)
- ✅ 2-3 students (holders) see QR codes
- ✅ Remaining students see waiting instructions
- ✅ Teacher dashboard shows active chains
- ✅ QR codes contain proper URLs

### Connection Status
- 🟢 "Live" = SignalR connected (instant updates)
- 🟡 "Connecting..." = Trying to connect
- ⚪ "Polling" = Fallback mode (updates every 10 seconds)

## Troubleshooting

### Students don't see QR codes after seeding
1. Check browser console for errors
2. Wait 10 seconds (polling interval)
3. Refresh the student page
4. Check backend logs: `tail -f backend.log`
5. Verify tokens were created:
   - Backend should log: "Created entry chain xxx with holder yyy"

### "Session not found" error
1. Verify session ID is correct
2. Check backend is running: `./dev-tools.sh status`
3. Check backend logs for errors

### Teacher can't seed chains
1. Check "No unmarked students available" error
2. Verify students have joined (check dashboard)
3. Check backend logs

### QR codes show but are wrong format
1. Should be URLs, not base64 data
2. Check `NEXT_PUBLIC_FRONTEND_URL` in `.env.local`
3. Should default to `window.location.origin`

## Reset and Try Again

```bash
# Clear database and restart
./dev-tools.sh reset-db
./dev-tools.sh restart

# Start fresh test
```

## Current Implementation Status

✅ **Working:**
- Teacher creates sessions
- Students join sessions
- Teacher seeds entry chains
- Holders are selected randomly
- Tokens are created with 20-second expiration
- Students can check if they're holders
- QR codes are generated as URLs
- SignalR connection with polling fallback

⏳ **Not Yet Implemented:**
- Chain scan processing (scanning holder's QR code)
- Chain transfer (scanner becomes new holder)
- Marking attendance (holder marked as present)
- Token expiration handling

## Next Steps

To complete the attendance flow:
1. Implement chain scan URL parameter handling
2. Create `scanChain` backend endpoint
3. Process scan: verify token, mark holder, create new token
4. Update chain with new holder
5. Send SignalR notifications
6. Test complete chain transfer

See [SEED_ENTRY_IMPLEMENTATION.md](SEED_ENTRY_IMPLEMENTATION.md) for details.
