# Login Guide - QR Chain Attendance System

## How to Login

### Option 1: Use the Login Button (Recommended)
1. Navigate to https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click the **"Login with Azure AD"** button in the top right
3. Sign in with your Azure AD credentials
4. You'll be redirected back to the app with your role displayed

### Option 2: Direct Login URL
Navigate directly to: https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad

### Option 3: Access a Protected Route
Try to access any protected API endpoint (e.g., `/api/sessions`) and you'll be automatically redirected to login

## After Login

Once logged in, you'll see:
- Your username displayed in the top right
- Your assigned roles (teacher or student)
- Quick action buttons based on your role:
  - **Teachers**: "Teacher Dashboard" button
  - **Students**: "Student View" button
- A logout button

## How Roles Are Assigned

Roles are **automatically assigned based on your email domain**:

- **Teachers**: Email addresses ending with `@vtc.edu.hk` (but NOT `@stu.vtc.edu.hk`)
- **Students**: Email addresses ending with `@stu.vtc.edu.hk`

**No manual role assignment is needed.** The system automatically determines your role when you log in.

## Troubleshooting

### "No roles assigned" message after login
This means your email address doesn't match the expected domain patterns:
- Teachers must use `@vtc.edu.hk` email addresses (not `@stu.vtc.edu.hk`)
- Students must use `@stu.vtc.edu.hk` email addresses

Contact your administrator if you believe your email should grant you access.

### Login button doesn't redirect
1. Check browser console for errors
2. Verify Azure AD app settings:
   ```bash
   az staticwebapp appsettings list --name swa-qrattendance-dev2
   ```
3. Ensure redirect URI is correct:
   ```bash
   az ad app show --id dc482c34-ebaa-4239-aca3-2810a4f51728 --query "web.redirectUris"
   ```

### Roles not showing after login
1. Verify your email address matches the expected domain:
   - Teachers: `@vtc.edu.hk` (not `@stu.vtc.edu.hk`)
   - Students: `@stu.vtc.edu.hk`
2. Clear browser cache and cookies
3. Log out and log back in
4. Check browser console for any errors

## Configuration Details

### Azure AD App Registration
- **App ID:** `dc482c34-ebaa-4239-aca3-2810a4f51728`
- **Tenant ID:** `8ff7db19-435d-4c3c-83d3-ca0a46234f51`
- **Redirect URI:** `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback`

### Role Assignment
Roles are automatically determined by email domain:
- **teacher** - Users with `@vtc.edu.hk` email (excluding `@stu.vtc.edu.hk`)
  - Can create sessions and view attendance
- **student** - Users with `@stu.vtc.edu.hk` email
  - Can join sessions and scan QR codes

**Note:** Azure AD app roles are NOT used. Role assignment is handled by the application based on email domain.

## Testing Authentication

After deployment completes, test the authentication flow:

1. **Test Login:**
   ```bash
   curl -I https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad
   ```
   Should return a 302 redirect to Microsoft login

2. **Check User Info (after login in browser):**
   Navigate to: `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/me`
   
   Should return JSON with:
   ```json
   {
     "clientPrincipal": {
       "userId": "...",
       "userDetails": "your-email@example.com",
       "userRoles": ["authenticated"]
     }
   }
   ```
   
   **Note:** The `userRoles` array from Azure AD is not used. The application computes roles from your email domain.

3. **Test Protected Route:**
   Try accessing: `https://red-grass-0f8bc910f.4.azurestaticapps.net/api/sessions`
   - Without login: Should redirect to login
   - With login and `@vtc.edu.hk` email: Should work (teacher access)
   - With login but wrong email domain: Should return 403

## Next Steps

After successful login:
- **Teachers:** Click "Teacher Dashboard" to create and manage attendance sessions
- **Students:** Click "Student View" to join sessions and scan QR codes
