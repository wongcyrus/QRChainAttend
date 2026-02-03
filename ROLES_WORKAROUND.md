# Azure AD App Roles Workaround

## The Problem

Azure Static Web Apps **does not automatically read Azure AD app roles** from tokens. Even though:
- ✅ App roles are configured in Azure AD
- ✅ Roles are assigned to users
- ✅ `groupMembershipClaims` is set to `ApplicationGroup`

The roles don't appear in the `userRoles` array that Static Web Apps provides.

## Why This Happens

Azure Static Web Apps uses a simplified authentication model that:
1. Only reads basic claims (userId, userDetails, identityProvider)
2. Doesn't parse the `roles` claim from Azure AD tokens
3. Only provides `anonymous` and `authenticated` as default roles

## Solution Options

### Option 1: Use Azure Functions (Recommended)

Create an API endpoint that reads roles from Azure AD and returns them to the frontend.

**Pros:**
- Works with current setup
- No infrastructure changes needed
- Can cache roles for performance

**Cons:**
- Requires API call on every page load
- Slight performance overhead

### Option 2: Use Custom Authentication

Implement custom authentication using MSAL.js directly in the frontend.

**Pros:**
- Full control over authentication
- Can read all token claims

**Cons:**
- More complex implementation
- Need to manage token refresh
- Loses Static Web Apps built-in auth benefits

### Option 3: Use Azure API Management

Put Azure API Management in front of Static Web Apps to transform tokens.

**Pros:**
- Centralized authentication logic
- Can transform claims

**Cons:**
- Additional cost
- More complex architecture
- Overkill for this use case

## Recommended Approach: Frontend Role Check

Since the backend Azure Functions already have proper authentication and can read the user's roles from Azure AD, the simplest solution is:

1. **Frontend**: Call a backend API to get user roles
2. **Backend**: Read roles from Azure AD token claims
3. **Frontend**: Store roles in state and use for UI decisions

### Implementation

I'll create a simple solution that:
1. Adds an API endpoint `/api/auth/me` that returns user info with roles
2. Updates the frontend to call this endpoint instead of `/.auth/me`
3. The backend reads roles from the Azure AD token properly

This way:
- ✅ Backend APIs are protected (they can read roles from tokens)
- ✅ Frontend shows correct UI based on roles
- ✅ No infrastructure changes needed
- ✅ Works with existing Azure AD setup

## Next Steps

Would you like me to:
1. Implement the API endpoint solution?
2. Or try a different approach?

The API endpoint approach is the most straightforward and will work immediately.
