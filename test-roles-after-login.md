# Testing Roles After Login

## Current Issue
You're logged in but seeing "Roles: anonymous, authenticated" instead of "Roles: teacher"

## Why This Happened
1. The `rolesSource: "/roles"` configuration was preventing Azure AD app roles from being read automatically
2. You might have logged in with a personal Microsoft account instead of your Azure AD guest account

## Fix Applied
- Removed the `rolesSource` configuration
- Azure AD app roles will now be automatically included in the authentication token

## Steps to Test After Deployment

### 1. Log Out Completely
Navigate to: https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/logout

### 2. Clear Browser Data
- Clear cookies for `red-grass-0f8bc910f.4.azurestaticapps.net`
- Clear cookies for `login.microsoftonline.com`
- Or use incognito/private mode

### 3. Log In Again
1. Go to: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click "Login with Azure AD"
3. **IMPORTANT:** Make sure you log in with your organizational account, not personal Microsoft account
   - If you see multiple account options, choose the one that shows your organization
   - The correct account should be associated with `ivecyrus.onmicrosoft.com` tenant

### 4. Verify Roles
After login, you should see:
```
Logged in as: cyruswong@outlook.com (or your display name)
Roles: teacher, authenticated
```

### 5. Check /.auth/me Endpoint
Open browser developer tools and navigate to:
https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/me

You should see JSON like:
```json
{
  "clientPrincipal": {
    "userId": "...",
    "userDetails": "cyruswong@outlook.com",
    "userRoles": ["teacher", "authenticated"]
  }
}
```

## If Roles Still Don't Appear

### Option 1: Check Which Account You're Using
The role is assigned to your guest user account in the Azure AD tenant:
- **User ID:** `76407111-df2d-4199-b496-fd6b68c4bb91`
- **UPN:** `cyruswong_outlook.com#EXT#_triplecrownlabs.onmicrosoftQPLEE#EXT#@ivecyrus.onmicrosoft.com`

When logging in, make sure you're using the account that's part of the `ivecyrus.onmicrosoft.com` tenant.

### Option 2: Re-assign the Role
If needed, re-assign the role to ensure it's correct:
```bash
# First, find your user ID after login
az ad user show --id cyruswong@outlook.com --query "id" -o tsv

# Then assign the role
./scripts/assign-user-roles.sh cyruswong@outlook.com teacher
```

### Option 3: Check App Role Assignment
Verify the role assignment:
```bash
./check-and-assign-role.sh
```

## Troubleshooting

### "anonymous, authenticated" roles
This means you're logged in but the app role isn't being passed. Causes:
1. Logged in with wrong account (personal vs organizational)
2. Token cached before role was assigned
3. App role assignment not complete

**Solution:** Log out, clear cookies, log back in

### No roles at all
This means authentication isn't working properly.

**Solution:** Check Azure AD app settings:
```bash
az staticwebapp appsettings list --name swa-qrattendance-dev2
```

### "teacher" role not showing
The role might not be assigned to the account you're using.

**Solution:** Verify and re-assign:
```bash
./scripts/assign-user-roles.sh your-email@example.com teacher
```

## Expected Timeline
1. Deployment completes: ~2-3 minutes
2. Log out and clear cookies: ~1 minute
3. Log back in: ~1 minute
4. Roles should appear immediately after login

## Verification Command
After deployment completes, run:
```bash
gh run list --limit 1
```

When you see ✓ (checkmark), the deployment is complete and you can test.
