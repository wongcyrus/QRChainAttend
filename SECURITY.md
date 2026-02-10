# Security Guidelines

## Secrets Management

### ✅ Files That Should NEVER Be Committed

The following files contain sensitive information and must NEVER be committed to Git:

```
.deployment-config       # Deployment credentials
*.secret                 # Any secret files
credential.json          # Azure credentials
github-token.txt         # GitHub personal access token
ad-apps.json            # Azure AD app details
azure-ad-summary.md     # May contain sensitive IDs
deploy-now.sh           # May contain hardcoded secrets
test-swa-deploy.sh      # May contain hardcoded secrets
roles.json              # Temporary file with UUIDs
local.settings.json     # Local Azure Functions settings
.env                    # Environment variables
.env.local              # Local environment variables
deployment.log          # May contain secrets in output
```

### ⚠️ SWA_DEPLOYMENT_TOKEN Security

**The Static Web App deployment token is automatically fetched from Azure:**

```bash
# Scripts automatically fetch the token:
az staticwebapp secrets list \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev \
  --query 'properties.apiKey' -o tsv
```

**No need to set environment variables - just ensure you're logged in:**
```bash
az login
```

**If token is exposed (committed to Git), reset it immediately:**
```bash
az staticwebapp secrets reset-api-key \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev
```

**All deployment scripts now automatically fetch fresh tokens on each run.**

### ✅ Safe to Commit (Local Development Only)

**These are safe because they're for local Azurite emulator only:**
- Azurite connection strings (well-known public key: `Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==`)
- Local development configuration templates
- Template files with placeholder values

### ✅ Verify .gitignore

Before committing, always verify these files are in `.gitignore`:

```bash
# Check if sensitive files are ignored
git check-ignore .deployment-config credential.json github-token.txt

# Should output the filenames if properly ignored
```

### ✅ Check for Accidentally Committed Secrets

```bash
# Search for potential secrets in tracked files
git ls-files | xargs grep -l "github_pat_\|ghp_\|password\|secret\|key" 2>/dev/null

# If any files are found, remove them from Git history
```

## Removing Secrets from Git History

If you accidentally committed secrets:

### Option 1: Using BFG Repo-Cleaner (Recommended)

```bash
# Install BFG
# macOS: brew install bfg
# Linux: Download from https://rtyley.github.io/bfg-repo-cleaner/

# Remove file from history
bfg --delete-files credential.json
bfg --delete-files github-token.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: Rewrites history)
git push --force
```

### Option 2: Using git filter-branch

```bash
# Remove specific file from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch credential.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: Rewrites history)
git push --force
```

### Option 3: Rotate Secrets (Safest)

If secrets were exposed:

1. **Immediately rotate all secrets:**
   ```bash
   # Rotate Azure AD client secret
   az ad app credential reset --id <app-id>
   
   # Revoke and create new GitHub token
   # Go to https://github.com/settings/tokens
   ```

2. **Update deployment configuration**
3. **Redeploy with new secrets**

## Secure Configuration Management

### Using Environment Variables

```bash
# Create secure configuration file
cat > .deployment-config << 'EOF'
export AAD_CLIENT_ID="your-client-id"
export AAD_CLIENT_SECRET="your-client-secret"
export AAD_TENANT_ID="your-tenant-id"
export GITHUB_TOKEN="your-github-token"
EOF

# Secure the file (owner read/write only)
chmod 600 .deployment-config

# Load when needed
source .deployment-config
```

### Using Azure Key Vault (Production)

```bash
# Store secrets in Key Vault
az keyvault secret set \
  --vault-name "kv-qrattendance" \
  --name "AAD-CLIENT-SECRET" \
  --value "your-secret"

# Retrieve when needed
AAD_CLIENT_SECRET=$(az keyvault secret show \
  --vault-name "kv-qrattendance" \
  --name "AAD-CLIENT-SECRET" \
  --query value -o tsv)
```

## Security Best Practices

### ✅ DO

- ✅ Use `.deployment-config` for local secrets
- ✅ Use Azure Key Vault for production secrets
- ✅ Use managed identities where possible
- ✅ Rotate secrets every 6-12 months
- ✅ Use `chmod 600` on configuration files
- ✅ Review `.gitignore` before every commit
- ✅ Use GitHub secret scanning
- ✅ Enable Azure AD Conditional Access
- ✅ Monitor sign-in logs regularly
- ✅ Use HTTPS only
- ✅ Enable Application Insights
- ✅ Set up budget alerts

### ❌ DON'T

- ❌ Commit secrets to Git
- ❌ Share secrets via email/chat
- ❌ Use the same secret across environments
- ❌ Hardcode secrets in code
- ❌ Store secrets in plain text files
- ❌ Disable authentication
- ❌ Grant admin rights to all users
- ❌ Ignore security updates
- ❌ Use weak passwords
- ❌ Share Azure AD credentials

## GitHub Security Features

### Enable Secret Scanning

1. Go to repository Settings → Security → Code security and analysis
2. Enable **Secret scanning**
3. Enable **Push protection**

### Use GitHub Secrets for CI/CD

```yaml
# .github/workflows/deploy.yml
env:
  AAD_CLIENT_ID: ${{ secrets.AAD_CLIENT_ID }}
  AAD_CLIENT_SECRET: ${{ secrets.AAD_CLIENT_SECRET }}
```

## Azure Security Features

### Enable Managed Identity

Already configured in Bicep templates:
- Function App uses managed identity for Storage
- Function App uses managed identity for SignalR
- No connection strings in code

### Enable Application Insights

Already configured - monitors:
- Failed authentication attempts
- API errors
- Performance issues
- Security events

### Review Access Regularly

```bash
# List role assignments
az role assignment list \
  --resource-group rg-qr-attendance-dev \
  --output table

# Review Azure AD sign-ins
az ad user list --query "[].{Name:displayName, Email:userPrincipalName}"
```

## Incident Response

### If Secrets Are Exposed

1. **Immediately rotate all secrets**
2. **Review access logs** for unauthorized access
3. **Check Application Insights** for suspicious activity
4. **Notify affected users** if data was accessed
5. **Update security procedures** to prevent recurrence

### If Unauthorized Access Detected

1. **Revoke compromised credentials**
2. **Review Azure AD sign-in logs**
3. **Check Application Insights for API calls**
4. **Review Storage Account access logs**
5. **Reset affected user passwords**
6. **Enable MFA if not already enabled**

## Compliance

### Data Protection

- User data stored in Azure Table Storage (encrypted at rest)
- HTTPS only (TLS 1.2+)
- Azure AD authentication required
- Role-based access control (RBAC)
- Audit logs in Application Insights

### GDPR Compliance

- User consent required for data collection
- Right to access: Users can view their data
- Right to deletion: Admins can delete user data
- Data minimization: Only necessary data collected
- Audit trail: All access logged

## Security Checklist

Before going to production:

- [ ] All secrets removed from Git
- [ ] `.gitignore` properly configured
- [ ] Secrets stored in Azure Key Vault
- [ ] Managed identities enabled
- [ ] HTTPS only enforced
- [ ] Azure AD authentication required
- [ ] Role-based access control configured
- [ ] Application Insights enabled
- [ ] Secret scanning enabled on GitHub
- [ ] Budget alerts configured
- [ ] Backup strategy in place
- [ ] Incident response plan documented
- [ ] Security review completed
- [ ] Penetration testing performed (if required)

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** disclose publicly
3. Email security concerns to: [your-security-email]
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Resources

- [Azure Security Best Practices](https://docs.microsoft.com/azure/security/fundamentals/best-practices-and-patterns)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Azure AD Security](https://docs.microsoft.com/azure/active-directory/fundamentals/security-operations-introduction)

---

**Last Updated**: February 3, 2026  
**Review Frequency**: Quarterly
