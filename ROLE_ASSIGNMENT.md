# Role Assignment - Email Domain Based

## Overview

The QR Chain Attendance System uses **email domain-based role assignment** instead of Azure AD app roles. This approach is simpler, more maintainable, and doesn't require manual role assignment in Azure AD.

## How It Works

### Automatic Role Assignment

When a user logs in, the system automatically determines their role based on their email domain:

| Email Domain | Role | Permissions |
|--------------|------|-------------|
| `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`) | **Teacher** | Create sessions, view attendance, export data |
| `@stu.vtc.edu.hk` | **Student** | Join sessions, scan QR codes |

### Implementation

#### Frontend (`frontend/src/pages/index.tsx`)

```typescript
function getRolesFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  
  if (!email) return roles;
  
  const emailLower = email.toLowerCase();
  
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  } else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}
```

#### Backend (`backend/src/functions/*/index.ts`)

```typescript
function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  // Check VTC domain-based roles
  if (role.toLowerCase() === 'teacher' && 
      emailLower.endsWith('@vtc.edu.hk') && 
      !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && 
      emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array (not used in production)
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}
```

## Why Email Domain Based?

### Advantages

1. **No Manual Assignment**: Users automatically get the correct role when they log in
2. **Simpler Setup**: No need to configure Azure AD app roles or assign users
3. **Easier Maintenance**: No need to manage role assignments as users join/leave
4. **Institutional Alignment**: Roles match the organization's email structure
5. **Consistent Logic**: Same role determination in frontend and backend

### Disadvantages

1. **Less Flexible**: Can't assign custom roles to specific users
2. **Email Dependent**: Requires consistent email domain structure
3. **No Azure AD Integration**: Can't use Azure AD groups or app roles

## Azure AD Configuration

### What You Need

The Azure AD app registration only needs:

1. **Basic Authentication**: Sign-in capability
2. **User Profile Access**: Read user email address
3. **Optional Claims**: Include email in token

### What You DON'T Need

- ❌ App roles definition
- ❌ Enterprise application role assignments
- ❌ Group claims configuration
- ❌ Role assignment scripts

## Testing

### Local Development

In local development, the mock authentication allows you to choose any role:

```typescript
// Mock login endpoint returns
{
  clientPrincipal: {
    userId: "mock-user-id",
    userDetails: "test@vtc.edu.hk",  // or test@stu.vtc.edu.hk
    userRoles: ["authenticated"]
  }
}
```

The frontend then computes the role from the email.

### Production

In production, Azure AD provides the authenticated user's email:

```typescript
// /.auth/me returns
{
  clientPrincipal: {
    userId: "azure-user-id",
    userDetails: "realuser@vtc.edu.hk",
    userRoles: ["authenticated"]  // Azure AD roles ignored
  }
}
```

The application computes the role from the email domain.

## Troubleshooting

### User Has Wrong Role

**Problem**: User with `@vtc.edu.hk` email is getting student role

**Solution**: Check if their email is `@stu.vtc.edu.hk` - this takes precedence

### User Has No Role

**Problem**: User logs in but sees "No roles assigned"

**Solution**: 
- Verify their email domain matches `@vtc.edu.hk` or `@stu.vtc.edu.hk`
- Check browser console for errors
- Verify the email is being returned from `/.auth/me`

### Role Not Updating

**Problem**: Changed email but role didn't update

**Solution**:
- Log out completely
- Clear browser cache and cookies
- Log back in
- The role is computed fresh on each login

## Migration from Azure AD App Roles

If you previously used Azure AD app roles, the system now ignores them. The `hasRole()` function has a fallback that checks `userRoles` array, but this is not used in production.

To fully migrate:

1. ✅ Code already updated to use email domain logic
2. ✅ Frontend uses `getRolesFromEmail()`
3. ✅ Backend uses `hasRole()` with email checks
4. ⚠️ Azure AD app roles can be left in place (they're ignored)
5. ⚠️ User role assignments in Enterprise Applications are not needed

## Future Enhancements

If you need more flexible role assignment in the future:

1. **Database-Based Roles**: Store role overrides in Azure Table Storage
2. **Azure AD Groups**: Map Azure AD groups to roles
3. **Hybrid Approach**: Use email domain as default, with database overrides
4. **Admin Interface**: Build UI for managing role assignments

## Related Documentation

- [LOGIN_GUIDE.md](LOGIN_GUIDE.md) - How to login and verify roles
- [docs/AZURE_AD_SETUP.md](docs/AZURE_AD_SETUP.md) - Azure AD configuration
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment verification
- [README.md](README.md) - Project overview

