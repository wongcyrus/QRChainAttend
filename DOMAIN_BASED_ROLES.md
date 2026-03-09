# Domain-Based Role Assignment

## Overview

The system now supports **configurable domain-based role assignment** via environment variables, with `vtc.edu.hk` as the default organizer domain.

---

## Configuration

### Bicep Parameters

```bicep
@description('Email domain for automatic organizer role assignment')
param organizerDomain string = 'vtc.edu.hk'

@description('Email domain restriction for attendee role. If set, ONLY this domain can be attendee.')
param attendeeDomain string = ''
```

### Environment Variables

Set in Azure Function App settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_EMAIL_DOMAINS` | `` (empty) | Comma-separated domains for authentication. Empty = no restriction |
| `ORGANIZATION_NAME` | `` (empty) | Organization name for UI display |
| `ORGANIZER_DOMAIN` | `vtc.edu.hk` | Email domain for auto organizer role |
| `ATTENDEE_DOMAIN` | `` (empty) | **Restriction**: If set, ONLY this domain can be attendee |

---

## Role Assignment Logic

### Priority Order

1. **Organizer Domain** (if configured)
   - Check `ORGANIZER_DOMAIN` (e.g., `@vtc.edu.hk`)
   - Exclude `ATTENDEE_DOMAIN` if specified

2. **External Organizers Table**
   - Check `ExternalOrganizers` table

3. **Attendee Domain Restriction** (if configured)
   - If `ATTENDEE_DOMAIN` is set: ONLY that domain → Attendee
   - If `ATTENDEE_DOMAIN` is empty: Any email → Attendee

4. **No Role**
   - If attendee domain is set and email doesn't match → No role (access denied)

### Example Scenarios

#### Scenario 1: Open Attendees (Default)
```bash
ORGANIZER_DOMAIN=vtc.edu.hk
ATTENDEE_DOMAIN=  # Empty
```

Results:
- `teacher@vtc.edu.hk` → **Organizer** ✓
- `student@stu.vtc.edu.hk` → **Attendee** ✓
- `anyone@example.com` → **Attendee** ✓

#### Scenario 2: Restricted Attendees
```bash
ORGANIZER_DOMAIN=vtc.edu.hk
ATTENDEE_DOMAIN=stu.vtc.edu.hk
```

Results:
- `teacher@vtc.edu.hk` → **Organizer** ✓
- `student@stu.vtc.edu.hk` → **Attendee** ✓
- `external@example.com` → **No Role** ❌ (access denied)

#### Scenario 3: Single Domain Organization
```bash
ORGANIZER_DOMAIN=company.com
ATTENDEE_DOMAIN=
```

Results:
- `manager@company.com` → **Organizer** ✓
- `user@example.com` → **Attendee** ✓ (any email allowed)

#### Scenario 4: No Domain Rules
```bash
ORGANIZER_DOMAIN=
ATTENDEE_DOMAIN=
```

Results:
- All users check `ExternalOrganizers` table only
- Not in table → **Attendee** ✓ (any email allowed)

---

## Deployment

### Option 1: Use Default (VTC)

Deploy without parameters - uses `vtc.edu.hk` as default:

```bash
./deploy-full-production.sh
```

### Option 2: Custom Domain

Create parameter file `infrastructure/parameters/prod.parameters.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "organizerDomain": {
      "value": "mycompany.com"
    },
    "attendeeDomain": {
      "value": ""
    }
  }
}
```

Deploy with parameters:

```bash
az deployment group create \
  --resource-group your-rg \
  --template-file infrastructure/main.bicep \
  --parameters infrastructure/parameters/prod.parameters.json
```

### Option 3: Disable Domain Rules

Set empty values:

```json
{
  "organizerDomain": { "value": "" },
  "attendeeDomain": { "value": "" }
}
```

---

## Code Implementation

### Backend (auth.ts)

```typescript
export async function getRolesFromEmailAsync(email: string): Promise<string[]> {
  const emailLower = email.toLowerCase();
  
  // Check domain-based assignment
  const organizerDomain = process.env.ORGANIZER_DOMAIN?.toLowerCase();
  const attendeeDomain = process.env.ATTENDEE_DOMAIN?.toLowerCase();
  
  // Check organizer domain
  if (organizerDomain && emailLower.endsWith(`@${organizerDomain}`)) {
    // Exclude attendee domain if specified
    if (!attendeeDomain || !emailLower.endsWith(`@${attendeeDomain}`)) {
      return ['organizer'];
    }
  }
  
  // Check attendee domain
  if (attendeeDomain && emailLower.endsWith(`@${attendeeDomain}`)) {
    return ['attendee'];
  }
  
  // Fallback to ExternalOrganizers table
  if (await isExternalOrganizer(emailLower)) {
    return ['organizer'];
  }
  
  return [];
}
```

### Frontend (roles.ts)

Same logic applied in Next.js API route for Static Web Apps.

---

## Testing

### Local Development

Set in `backend/local.settings.json`:

```json
{
  "Values": {
    "ORGANIZER_DOMAIN": "vtc.edu.hk",
    "ATTENDEE_DOMAIN": "stu.vtc.edu.hk"
  }
}
```

### Verify Configuration

```bash
# Check Function App settings
az functionapp config appsettings list \
  --name your-function-app \
  --resource-group your-rg \
  --query "[?name=='ORGANIZER_DOMAIN' || name=='ATTENDEE_DOMAIN']"
```

### Test Role Assignment

```bash
# Login and check assigned role
curl https://your-app.azurewebsites.net/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return:
{
  "email": "user@vtc.edu.hk",
  "roles": ["authenticated", "organizer"]
}
```

---

## Migration Guide

### From Pure Table-Based to Domain-Based

1. **Deploy with domain parameters**
   ```bash
   # Existing organizers in table will still work
   ./deploy-full-production.sh
   ```

2. **No data migration needed**
   - Domain rules work alongside ExternalOrganizers table
   - Existing table entries remain valid

3. **Optional: Clean up table**
   - Remove domain-based emails from ExternalOrganizers table
   - Keep only external (non-domain) organizers

### From Domain-Based to Pure Table

1. **Export domain-based organizers**
   ```bash
   # List all @vtc.edu.hk organizers
   # Add them to ExternalOrganizers table
   ```

2. **Deploy with empty domains**
   ```json
   {
     "organizerDomain": { "value": "" },
     "attendeeDomain": { "value": "" }
   }
   ```

---

## Benefits

✅ **Flexible**: Works for any organization  
✅ **Backward Compatible**: VTC setup works by default  
✅ **Configurable**: Change domains without code changes  
✅ **Hybrid**: Domain rules + table-based exceptions  
✅ **No Breaking Changes**: Existing deployments continue working

---

## Summary

- **Default**: `vtc.edu.hk` as organizer domain
- **Configurable**: Set via Bicep parameters or environment variables
- **Priority**: Domain rules → Table lookup → Default (attendee)
- **Flexible**: Can disable domain rules entirely
