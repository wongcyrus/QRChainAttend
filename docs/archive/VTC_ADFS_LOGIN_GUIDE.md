# VTC ADFS Login Configuration

## Issue
When trying to login, you're redirected to `login.vtc.edu.hk/adfs` which is unreachable. This indicates VTC uses **ADFS (Active Directory Federation Services)** for authentication.

## What Was Changed

### Azure AD App Registration
Changed the sign-in audience from single-tenant to multi-tenant:

```bash
# Before: AzureADMyOrg (only ivecyrus.onmicrosoft.com)
# After: AzureADMultipleOrgs (any Azure AD organization)
```

This allows users from VTC's Azure AD tenant to authenticate.

## How VTC ADFS Works

```
User clicks "Login"
    ↓
Redirect to Azure AD (login.microsoftonline.com)
    ↓
Azure AD detects user's domain (@vtc.edu.hk)
    ↓
Redirect to VTC's ADFS (login.vtc.edu.hk/adfs)
    ↓
User authenticates with VTC credentials
    ↓
ADFS sends token back to Azure AD
    ↓
Azure AD sends token to your app
    ↓
User is logged in
```

## Testing the Fix

### Option 1: Test with Your Personal Microsoft Account
Since the app is now multi-tenant, you can test with your personal Microsoft account first:

1. Visit: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click "Login with Azure AD"
3. Use your personal Microsoft account (cyruswong@outlook.com)
4. Should work without issues

### Option 2: Test with VTC Account
If VTC's ADFS server (`login.vtc.edu.hk`) is accessible from your network:

1. Visit: https://red-grass-0f8bc910f.4.azurestaticapps.net
2. Click "Login with Azure AD"
3. Enter your VTC email (cywong@vtc.edu.hk)
4. You'll be redirected to VTC's ADFS login page
5. Enter your VTC credentials
6. Should redirect back to the app

## Troubleshooting

### Issue: "login.vtc.edu.hk is unreachable"

**Possible Causes:**
1. **VTC's ADFS server is only accessible from VTC network**
   - Solution: Connect to VTC VPN or test from VTC campus
   
2. **VTC's ADFS server is down or misconfigured**
   - Solution: Contact VTC IT support

3. **Your VTC account is not properly federated with Azure AD**
   - Solution: Contact VTC IT support to verify federation setup

### Issue: "AADSTS50020: User account from identity provider does not exist in tenant"

**Cause:** VTC's Azure AD tenant is not properly configured for federation

**Solution:** VTC IT needs to:
1. Set up Azure AD Connect or ADFS federation
2. Sync user accounts from on-premises AD to Azure AD
3. Configure federation trust between VTC ADFS and Azure AD

### Issue: "AADSTS700016: Application not found in the directory"

**Cause:** The app is not registered in VTC's Azure AD tenant

**Solution:** Either:
1. Use multi-tenant mode (already configured)
2. OR have VTC IT admin consent to the app

## Alternative: Use Local Development Mode

If VTC's ADFS is not accessible, use local development mode for testing:

1. **Start local development**:
   ```bash
   npm run dev
   ```

2. **Visit**: http://localhost:3000

3. **Use mock login**: Click "Login" and use the dev-config page

4. **Test all features** without needing real authentication

## Production Deployment Options

### Option 1: Multi-Tenant (Current Setup)
- ✅ Works with any Azure AD organization
- ✅ Works with personal Microsoft accounts
- ✅ No VTC IT involvement needed
- ⚠️ Requires VTC's ADFS to be publicly accessible
- ⚠️ Users must have Azure AD accounts

### Option 2: VTC-Specific Tenant
If VTC has their own Azure AD tenant, you can:

1. **Create app registration in VTC's tenant**:
   - VTC IT admin creates the app registration
   - Provides you with Client ID and Tenant ID
   
2. **Update your configuration**:
   ```json
   {
     "auth": {
       "identityProviders": {
         "azureActiveDirectory": {
           "registration": {
             "openIdIssuer": "https://login.microsoftonline.com/{VTC-TENANT-ID}/v2.0",
             "clientIdSettingName": "AAD_CLIENT_ID",
             "clientSecretSettingName": "AAD_CLIENT_SECRET"
           }
         }
       }
     }
   }
   ```

### Option 3: Custom Authentication
Implement custom authentication that works with VTC's systems:
- SAML 2.0 integration
- OAuth 2.0 with VTC's identity provider
- Custom login page that calls VTC's authentication API

## Recommended Approach

### For Development/Testing
Use **local development mode** with mock authentication:
- No dependency on VTC's infrastructure
- Fast iteration and testing
- All features work identically

### For Production
Work with VTC IT to:
1. **Verify ADFS accessibility**: Ensure `login.vtc.edu.hk` is publicly accessible
2. **Confirm federation setup**: Verify VTC accounts are synced to Azure AD
3. **Test with VTC account**: Have a VTC user test the login flow
4. **Get admin consent**: If needed, have VTC IT admin consent to the app

## Current Configuration

### Azure AD App Registration
```
App ID: dc482c34-ebaa-4239-aca3-2810a4f51728
Tenant ID: 8ff7db19-435d-4c3c-83d3-ca0a46234f51
Sign-in Audience: AzureADMultipleOrgs (Multi-tenant)
Redirect URI: https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback
```

### Static Web App Settings
```
AAD_CLIENT_ID: dc482c34-ebaa-4239-aca3-2810a4f51728
TENANT_ID: 8ff7db19-435d-4c3c-83d3-ca0a46234f51
```

## Testing Checklist

- [ ] Test with personal Microsoft account (should work)
- [ ] Test from VTC network with VTC account
- [ ] Verify ADFS server is accessible
- [ ] Contact VTC IT if federation issues persist
- [ ] Use local development mode as fallback

## Next Steps

1. **Test with personal account** to verify the app works
2. **Contact VTC IT** to verify:
   - Is `login.vtc.edu.hk` publicly accessible?
   - Are VTC accounts federated with Azure AD?
   - Do you need admin consent for the app?
3. **Use local development** for testing until VTC access is resolved

---

**Status**: Multi-tenant authentication configured

**Test URL**: https://red-grass-0f8bc910f.4.azurestaticapps.net

**Recommendation**: Use local development mode (`npm run dev`) for testing until VTC ADFS access is confirmed
