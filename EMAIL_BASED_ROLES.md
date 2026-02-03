# ✅ Email-Based Role Assignment

## Simple Solution

Instead of managing Azure AD app roles, we now automatically assign roles based on email domain:

- **@stu.vtc.edu.hk** → Student role
- **@vtc.edu.hk** → Teacher role  
- **Others** → Authenticated only

## How It Works

The `/api/auth/me` endpoint checks the user's email and assigns roles automatically:

```typescript
function getRoleFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  
  if (email.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  } else if (email.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}
```

## Benefits

✅ **No manual role assignment needed**  
✅ **Automatic based on email domain**  
✅ **Works for all VTC users**  
✅ **Simple to understand and maintain**  
✅ **No Azure AD app roles configuration needed**  

## Test Now

1. **Visit**: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. **Log out** (if logged in)
3. **Log in** with your VTC email

### Expected Results

**For cyruswong@outlook.com:**
- Roles: `authenticated` (no teacher/student role)
- Reason: Not a VTC email domain

**For user@vtc.edu.hk:**
- Roles: `teacher, authenticated` ✅
- Teacher Dashboard appears

**For student@stu.vtc.edu.hk:**
- Roles: `student, authenticated` ✅
- Student View appears

## Your Current Email

Your email `cyruswong@outlook.com` doesn't match VTC domains, so you'll only get `authenticated` role.

**To test as teacher**, you need to:
1. Log in with a `@vtc.edu.hk` email, OR
2. Add your email to the teacher list in the code

## Adding Exceptions

If you want to add specific emails as teachers/students, update the function:

```typescript
function getRoleFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  
  const emailLower = email.toLowerCase();
  
  // Specific email exceptions
  if (emailLower === 'cyruswong@outlook.com') {
    roles.push('teacher');
    return roles;
  }
  
  // Domain-based rules
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  } else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}
```

## Would You Like Me To:

1. **Add your email as an exception** so you get teacher role?
2. **Keep domain-based only** for production use?

Let me know and I'll update the code!

## Files Changed

- `backend/src/functions/getUserRoles.ts` - Email-based role logic
- Deployed to Azure Functions

## API Endpoint

**URL**: `/api/auth/me`  
**Method**: GET  
**Auth**: Required (Azure Static Web Apps)  

**Response**:
```json
{
  "userId": "...",
  "userDetails": "user@vtc.edu.hk",
  "userRoles": ["teacher", "authenticated"],
  "identityProvider": "aad"
}
```

## Next Steps

Choose one:
1. Add your email as exception for testing
2. Test with actual VTC email accounts
3. Modify domain rules as needed
