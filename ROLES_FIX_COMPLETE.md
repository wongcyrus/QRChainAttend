# ✅ Roles Configuration Fixed

## What Was Fixed

1. ✅ **App Roles Added** - Teacher and Student roles configured
2. ✅ **Role Assigned** - Teacher role assigned to cyruswong@outlook.com
3. ✅ **Group Claims Enabled** - `groupMembershipClaims` set to `ApplicationGroup`

## Current Configuration

### App Roles
- ✅ **Teacher** (ID: 61945743-8797-4e30-9803-f56618f67c16)
- ✅ **Student** (ID: e9f73927-0344-4059-92bf-53d855ffb85f)

### Your Role Assignment
- **User**: cyruswong@outlook.com
- **Role**: Teacher ✅
- **Status**: Assigned

## Why You're Seeing "anonymous, authenticated"

You're currently logged in with an **old token** that was issued before:
1. App roles were added
2. Group membership claims were enabled
3. Your role was assigned

The token doesn't include your role information yet.

## Fix: Get a Fresh Token

### Step 1: Log Out Completely

1. Visit: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click **"Logout"**
3. Wait for logout to complete

### Step 2: Clear Browser Data (Important!)

**Chrome/Edge:**
1. Press `Ctrl+Shift+Delete`
2. Select "All time"
3. Check:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
4. Click "Clear data"

**Firefox:**
1. Press `Ctrl+Shift+Delete`
2. Select "Everything"
3. Check:
   - ✅ Cookies
   - ✅ Cache
4. Click "Clear Now"

### Step 3: Log In Again

1. Visit: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click **"Login with Azure AD"**
3. Authenticate with your credentials
4. **Expected Result**:
   ```
   Logged in as: cyruswong@outlook.com
   Roles: teacher, authenticated
   ```

### Step 4: Verify

You should now see:
- ✅ **"Teacher Dashboard"** button appears
- ✅ Roles show: `teacher, authenticated`
- ✅ No "No roles assigned" warning

## Technical Details

### What Changed in Azure AD

**Before:**
```json
{
  "appRoles": [],
  "groupMembershipClaims": null
}
```

**After:**
```json
{
  "appRoles": [
    {"value": "teacher", "displayName": "Teacher"},
    {"value": "student", "displayName": "Student"}
  ],
  "groupMembershipClaims": "ApplicationGroup"
}
```

### Token Claims

**Old Token (what you have now):**
```json
{
  "roles": ["anonymous", "authenticated"]
}
```

**New Token (after re-login):**
```json
{
  "roles": ["teacher", "authenticated"]
}
```

## Assigning Roles to Other Users

### For Teachers

```bash
# Get user ID
USER_ID=$(az ad user show --id user@domain.com --query id -o tsv)

# Assign teacher role
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/fc431d20-c83a-4e48-a2bc-00802044b5a0/appRoleAssignedTo" \
  --headers "Content-Type=application/json" \
  --body "{
    \"principalId\": \"$USER_ID\",
    \"resourceId\": \"fc431d20-c83a-4e48-a2bc-00802044b5a0\",
    \"appRoleId\": \"61945743-8797-4e30-9803-f56618f67c16\"
  }"
```

### For Students

```bash
# Get user ID
USER_ID=$(az ad user show --id student@domain.com --query id -o tsv)

# Assign student role
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/fc431d20-c83a-4e48-a2bc-00802044b5a0/appRoleAssignedTo" \
  --headers "Content-Type=application/json" \
  --body "{
    \"principalId\": \"$USER_ID\",
    \"resourceId\": \"fc431d20-c83a-4e48-a2bc-00802044b5a0\",
    \"appRoleId\": \"e9f73927-0344-4059-92bf-53d855ffb85f\"
  }"
```

### Using the Script

Or use the existing script:

```bash
./check-and-assign-role.sh user@domain.com teacher
./check-and-assign-role.sh student@domain.com student
```

## Troubleshooting

### Still seeing "anonymous, authenticated" after re-login

**Check:**
1. Did you clear browser cache completely?
2. Did you log out first?
3. Try incognito/private mode

**Verify in Azure:**
```bash
# Check role assignment
az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/fc431d20-c83a-4e48-a2bc-00802044b5a0/appRoleAssignedTo" \
  --query "value[?principalId=='76407111-df2d-4199-b496-fd6b68c4bb91']"
```

### External Users (Guest Users)

If you're a guest user (like cyruswong@outlook.com), the UPN will be:
```
cyruswong_outlook.com#EXT#@ivecyrus.onmicrosoft.com
```

This is normal and roles work the same way.

## Verification Checklist

After re-login, verify:

- [ ] Roles show: `teacher, authenticated` (not just `anonymous, authenticated`)
- [ ] "Teacher Dashboard" button is visible
- [ ] No "No roles assigned" warning
- [ ] Can access teacher features
- [ ] Auth state updates without hard refresh (from previous fix)

## Summary

✅ **App Roles**: Configured  
✅ **Your Role**: Teacher assigned  
✅ **Group Claims**: Enabled  
✅ **Next Step**: Log out, clear cache, log back in  

After re-login, you'll have full teacher access! 🎉

## Related Documentation

- `AUTHENTICATION_SETUP_COMPLETE.md` - Full auth setup
- `LOGIN_GUIDE.md` - Login instructions
- `AUTH_STATE_FIX.md` - Auth state management fix
- `check-and-assign-role.sh` - Role assignment script
