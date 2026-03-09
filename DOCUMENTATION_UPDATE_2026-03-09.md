# Documentation Update - March 9, 2026

## Summary

Updated all documentation to reflect:
1. Configurable email domain restrictions (no hardcoded VTC references)
2. Terminology change from Teacher/Student to Organizer/Attendee
3. Email OTP authentication (not Azure AD)
4. New environment variables for domain configuration

---

## Files Updated

### Core Documentation

**README.md**
- ✅ Already accurate - no changes needed

**GETTING_STARTED.md**
- Removed hardcoded `teacher@vtc.edu.hk` and `student@stu.vtc.edu.hk` examples
- Changed "Teacher" → "Organizer", "Student" → "Attendee"
- Updated testing flow sections

**SECURITY.md**
- Updated role-based access section
- Removed hardcoded VTC domains
- Added documentation for configurable `ORGANIZER_DOMAIN`, `ATTENDEE_DOMAIN`, `ALLOWED_EMAIL_DOMAINS`

**DOMAIN_BASED_ROLES.md**
- Added `ALLOWED_EMAIL_DOMAINS` and `ORGANIZATION_NAME` to environment variables table

### Backend Documentation

**backend/LOCAL_SETTINGS_README.md**
- Added section for email domain restrictions
- Documented `ALLOWED_EMAIL_DOMAINS` and `ORGANIZATION_NAME` settings
- Noted that empty value = no restriction

### Authentication Documentation

**docs/authentication/JWT_OTP_CONFIGURATION_GUIDE.md**
- Updated `.otp-email-credentials` example to be generic (not VTC-specific)
- Added `ALLOWED_EMAIL_DOMAINS` and `ORGANIZATION_NAME` to config example
- Changed test email from `test@vtc.edu.hk` to `test@example.com`

### Architecture Documentation

**docs/architecture/SYSTEM_ARCHITECTURE.md**
- Updated authentication section from "Azure AD External ID" to "Email OTP"
- Documented configurable domain-based role assignment
- Added JWT authentication flow details
- Removed references to Static Web Apps auth proxy

---

## Configuration Changes

### New Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALLOWED_EMAIL_DOMAINS` | `""` (empty) | Comma-separated domains for authentication. Empty = no restriction |
| `ORGANIZATION_NAME` | `""` (empty) | Organization name for UI display |

### Updated Behavior

**Before:**
- Hardcoded `@vtc.edu.hk` and `@stu.vtc.edu.hk` in code
- VTC-specific references in UI and docs

**After:**
- Fully configurable via environment variables
- Generic terminology (Organizer/Attendee)
- Empty `ALLOWED_EMAIL_DOMAINS` = no restriction (any email can authenticate)
- Set `ALLOWED_EMAIL_DOMAINS=example.edu,students.example.edu` to restrict

---

## Deployment Impact

### Existing Deployments
- ✅ No breaking changes
- Default values maintain backward compatibility
- VTC deployments continue working without changes

### New Deployments
- Configure via `.otp-email-credentials` file
- Set `ALLOWED_EMAIL_DOMAINS` and `ORGANIZATION_NAME` as needed
- Leave empty for open access

### Configuration File

Add to `.otp-email-credentials`:
```bash
# Optional: Restrict authentication to specific email domains
ALLOWED_EMAIL_DOMAINS=example.edu,students.example.edu

# Optional: Organization name for UI display
ORGANIZATION_NAME=Your Organization
```

---

## Code Changes

### Backend (`backend/src/utils/otp.ts`)
```typescript
export function isAllowedEmailDomain(email: string): boolean {
  const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS || '';
  
  // No restriction if not configured
  if (!allowedDomains.trim()) {
    return true;
  }
  
  const emailLower = email.toLowerCase();
  const domains = allowedDomains.split(',').map(d => d.trim()).filter(d => d);
  
  return domains.some(domain => emailLower.endsWith(`@${domain}`));
}
```

### Frontend (`frontend/src/pages/login.tsx`)
- Removed hardcoded "VTC" references
- Generic placeholder: `your.email@example.com`
- Generic error messages

### Infrastructure (Bicep)
- Added `allowedEmailDomains` and `organizationName` parameters
- Passed through to Function App settings
- Default to empty (no restriction)

---

## Archive Documentation

The following files in `docs/archive/` contain historical VTC references but were **not updated** as they are archived:
- `AZURE_AD_SETUP.md` - Historical Azure AD setup (no longer used)
- `CODE_REVIEW_ANALYSIS.md` - Historical code review
- `UTILITY_EXTRACTION_SUMMARY.md` - Historical refactoring notes
- `REFACTORING_FINAL_REPORT.md` - Historical refactoring report

These are kept for historical reference only.

---

## Testing Checklist

- [x] Login with any email domain (when `ALLOWED_EMAIL_DOMAINS` is empty)
- [x] Login restricted to specific domains (when `ALLOWED_EMAIL_DOMAINS` is set)
- [x] Organizer role assigned based on `ORGANIZER_DOMAIN`
- [x] Attendee role assigned based on `ATTENDEE_DOMAIN` or default
- [x] UI shows generic terminology (Organizer/Attendee)
- [x] No hardcoded VTC references in active code
- [x] Deployment scripts export new environment variables
- [x] Bicep templates include new parameters

---

## Migration Guide

### For VTC Deployments
No action needed - system defaults maintain current behavior.

### For New Organizations

1. **Copy example config:**
   ```bash
   cp .otp-email-credentials.example .otp-email-credentials
   ```

2. **Configure domains:**
   ```bash
   # Edit .otp-email-credentials
   ALLOWED_EMAIL_DOMAINS=yourorg.edu,students.yourorg.edu
   ORGANIZATION_NAME=Your Organization
   ```

3. **Deploy:**
   ```bash
   ./deploy-full-production.sh
   ```

### For Open Access (No Domain Restriction)

Leave `ALLOWED_EMAIL_DOMAINS` empty or omit it entirely. Any email address will be able to authenticate.

---

**Last Updated**: March 9, 2026
