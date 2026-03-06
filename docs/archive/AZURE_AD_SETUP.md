# Azure AD App Registration Setup Guide

This guide walks you through creating and configuring Azure AD (Microsoft Entra ID) app registrations for the QR Chain Attendance System.

## Overview

The system requires an Azure AD app registration to enable authentication for:
- Teachers accessing the dashboard
- Students joining sessions
- Role-based access control (teacher vs student roles)

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed (version 2.50.0 or later)
- Owner or Application Administrator role in Azure AD
- Logged in to Azure CLI: `az login`

## Step 1: Create the App Registration

### Option A: Using Azure CLI (Recommended)

```bash
# Create the app registration
az ad app create \
  --display-name "QR Chain Attendance System" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://your-static-web-app.azurestaticapps.net/.auth/login/aad/callback" \
  --enable-id-token-issuance true

# Save the output - you'll need the appId (Client ID)
```

### Option B: Using Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** (or **Microsoft Entra ID**)
3. Select **App registrations** from the left menu
4. Click **+ New registration**
5. Fill in the details:
   - **Name**: `QR Chain Attendance System`
   - **Supported account types**: `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI**: 
     - Platform: `Web`
     - URI: `https://your-static-web-app.azurestaticapps.net/.auth/login/aad/callback`
6. Click **Register**

## Step 2: Note Important Values

After creating the app registration, save these values (you'll need them for deployment):

1. **Application (client) ID**: Found on the Overview page
2. **Directory (tenant) ID**: Found on the Overview page
3. **Client Secret**: You'll create this in the next step

## Step 3: Create a Client Secret

### Using Azure CLI

```bash
# Replace <app-id> with your Application (client) ID
az ad app credential reset \
  --id <app-id> \
  --append \
  --display-name "QR Attendance Secret" \
  --years 2

# Save the password (client secret) from the output
```

### Using Azure Portal

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add a description: `QR Attendance Secret`
4. Select expiration: `24 months` (recommended)
5. Click **Add**
6. **IMPORTANT**: Copy the secret **Value** immediately (it won't be shown again)

## Step 4: Configure API Permissions

The app needs permissions to read user profiles and sign in users.

### Using Azure CLI

```bash
# Add Microsoft Graph User.Read permission
az ad app permission add \
  --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Grant admin consent (requires admin privileges)
az ad app permission admin-consent --id <app-id>
```

### Using Azure Portal

1. In your app registration, go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and select:
   - `User.Read` (Sign in and read user profile)
6. Click **Add permissions**
7. Click **Grant admin consent for [Your Organization]**
8. Click **Yes** to confirm

## Step 5: Configure Authentication Settings

### Using Azure Portal

1. In your app registration, go to **Authentication**
2. Under **Implicit grant and hybrid flows**, enable:
   - ✅ **ID tokens** (used for implicit and hybrid flows)
3. Under **Advanced settings**:
   - **Allow public client flows**: `No`
   - **Supported account types**: `Accounts in this organizational directory only`
4. Click **Save**

## Step 7: Configure Optional Claims (Optional)

Add optional claims to include additional user information in tokens.

### Using Azure Portal

1. In your app registration, go to **Token configuration**
2. Click **+ Add optional claim**
3. Select **ID** token type
4. Add these claims:
   - `email`
   - `family_name`
   - `given_name`
   - `upn` (User Principal Name)
5. Click **Add**
6. If prompted, check **Turn on the Microsoft Graph email, profile permission**

**Note:** The application determines user roles based on email domain, not Azure AD app roles.

After deploying your Static Web App, you'll get the actual URL. Update the redirect URI:

### Using Azure CLI

```bash
# Update redirect URI with actual Static Web App URL
az ad app update \
  --id <app-id> \
  --web-redirect-uris \
    "https://your-actual-swa-url.azurestaticapps.net/.auth/login/aad/callback" \
    "http://localhost:3000/.auth/login/aad/callback"
```

### Using Azure Portal

1. In your app registration, go to **Authentication**
2. Under **Web** redirect URIs, add:
   - `https://your-actual-swa-url.azurestaticapps.net/.auth/login/aad/callback`
   - `http://localhost:3000/.auth/login/aad/callback` (for local development)
3. Click **Save**

## Step 9: Use Values in Deployment

Now use the values you collected in your infrastructure deployment:

```bash
# Set environment variables
export AAD_CLIENT_ID="<your-application-client-id>"
export AAD_CLIENT_SECRET="<your-client-secret>"
export AAD_TENANT_ID="<your-tenant-id>"

# Deploy infrastructure
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --repository-url "https://github.com/your-org/your-repo" \
  --token "ghp_your_github_token" \
  --client-id "$AAD_CLIENT_ID" \
  --client-secret "$AAD_CLIENT_SECRET"
```

## Verification

### Test Authentication Flow

1. Navigate to your Static Web App URL
2. You should be redirected to Microsoft login
3. Sign in with your organizational account
4. After successful login, you should be redirected back to the app
5. Verify your role is correctly assigned based on your email domain:
   - `@vtc.edu.hk` (not `@stu.vtc.edu.hk`) → Teacher
   - `@stu.vtc.edu.hk` → Student

### Check Token Claims

Use a tool like [jwt.ms](https://jwt.ms) to decode your ID token and verify:
- `aud` (audience) matches your Client ID
- `tid` (tenant ID) matches your Tenant ID
- `email` claim contains your email address
- Optional claims (name, upn, etc.) are present

**Note:** The `roles` claim in the token is not used. The application determines roles from the email domain.

## Security Best Practices

1. **Rotate Secrets Regularly**: Set client secret expiration to 24 months maximum
2. **Use Managed Identity**: Where possible, use managed identity instead of client secrets
3. **Limit Redirect URIs**: Only add necessary redirect URIs
4. **Monitor Sign-ins**: Review sign-in logs in Azure AD regularly
5. **Enable Conditional Access**: Consider adding conditional access policies for additional security
6. **Restrict Account Types**: Keep it single-tenant unless multi-tenant is required

## Troubleshooting

### Error: "AADSTS50011: The reply URL specified in the request does not match"

**Solution**: Ensure the redirect URI in your app registration exactly matches the URL used by your Static Web App.

### Error: "AADSTS700016: Application not found in the directory"

**Solution**: Verify the Client ID is correct and the app registration exists in the correct tenant.

### Users Can't Sign In

**Solution**: 
- Verify users have valid organizational email addresses
- Check that email domains match expected patterns (`@vtc.edu.hk` or `@stu.vtc.edu.hk`)
- Ensure the app is not restricted to specific users/groups

### Roles Not Working Correctly

**Solution**:
- Verify email address matches expected domain patterns
- Teachers: `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`)
- Students: `@stu.vtc.edu.hk`
- Check browser console for any errors
- Clear browser cache and try again

## Additional Resources

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/entra/identity/)
- [Azure Static Web Apps Authentication](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization)
- [App Roles Documentation](https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps)
- [Token Claims Reference](https://learn.microsoft.com/entra/identity-platform/access-tokens)

## Next Steps

After completing Azure AD setup:

1. ✅ Deploy infrastructure with Azure AD credentials
2. ✅ Configure Static Web App authentication
3. ✅ Test authentication flow
4. ✅ Verify email-based role assignment works correctly
5. ✅ Deploy application code
6. ✅ Verify role-based access control

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment process.
