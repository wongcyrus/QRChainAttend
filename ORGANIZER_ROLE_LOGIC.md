# Organizer Role Assignment Logic

## Overview

After the conversion, **organizers are defined by email whitelist** stored in the `ExternalOrganizers` Azure Table Storage table. There is **no automatic domain-based assignment**.

---

## How It Works

### 1. Email Lookup
When a user logs in, the system checks if their email exists in the `ExternalOrganizers` table:

```typescript
// Check if email is an organizer
if (await isExternalOrganizer(email)) {
  return ['organizer'];
}
// Otherwise, default to attendee
return ['attendee'];
```

### 2. Table Structure

**Table Name**: `ExternalOrganizers`

| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | Always `'ORGANIZER'` |
| RowKey | string | Email (lowercase) |
| email | string | Email (original case) |
| addedBy | string | Admin who added this organizer |
| addedAt | string | ISO timestamp |
| name | string | Optional display name |

### 3. Caching

- Organizer list is cached for **60 seconds** to minimize database lookups
- Cache is automatically refreshed when expired
- Cache is cleared when organizers are added/removed

---

## How to Add Organizers

### Method 1: API Endpoint

**Add an organizer:**
```bash
curl -X POST https://your-app.azurewebsites.net/api/admin/external-organizers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "name": "John Doe"
  }'
```

**List all organizers:**
```bash
curl https://your-app.azurewebsites.net/api/admin/external-organizers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Remove an organizer:**
```bash
curl -X DELETE https://your-app.azurewebsites.net/api/admin/external-organizers/organizer@example.com \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Method 2: Azure Portal

1. Go to **Azure Portal** → Your Storage Account
2. Navigate to **Tables** → `ExternalOrganizers`
3. Click **Add Entity**
4. Fill in:
   - **PartitionKey**: `ORGANIZER`
   - **RowKey**: `user@example.com` (lowercase)
   - **email**: `user@example.com` (any case)
   - **addedBy**: `admin@example.com`
   - **addedAt**: `2026-03-07T15:00:00Z`
   - **name**: `User Name` (optional)

### Method 3: Azure CLI

```bash
az storage entity insert \
  --account-name YOUR_STORAGE_ACCOUNT \
  --table-name ExternalOrganizers \
  --entity PartitionKey=ORGANIZER RowKey=user@example.com \
    email=user@example.com \
    addedBy=admin@example.com \
    addedAt=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
    name="User Name"
```

---

## Role Assignment Flow

```
User logs in with email
         ↓
Check ExternalOrganizers table
         ↓
    ┌────────────┐
    │ Email      │
    │ found?     │
    └────────────┘
         ↓
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    ↓         ↓
Organizer  Attendee
```

---

## Security Notes

### Who Can Manage Organizers?

Only users who are **already organizers** can add/remove other organizers via the API.

```typescript
// Require Organizer role to manage organizers
if (!await hasRoleAsync(principal, 'organizer')) {
  return { status: 403, error: 'Organizer role required' };
}
```

### Bootstrap Problem

**Q: How do I add the first organizer if only organizers can add organizers?**

**A: Use Azure Portal or Azure CLI** to manually add the first organizer to the table. After that, they can add others via the API.

---

## Code Locations

### Backend
- **Auth logic**: `backend/src/utils/auth.ts`
  - `isExternalOrganizer()` - Check if email is organizer
  - `getRolesFromEmailAsync()` - Get roles for email
  
- **Management API**: `backend/src/functions/manageExternalOrganizers.ts`
  - `POST /api/admin/external-organizers` - Add organizer
  - `GET /api/admin/external-organizers` - List organizers
  - `DELETE /api/admin/external-organizers/{email}` - Remove organizer

### Frontend
- **Role check**: `frontend/src/pages/api/auth/roles.ts`
  - Fetches organizer list and assigns roles

---

## Migration from Old System

If you had VTC domain-based roles before:

```bash
# Run the migration script
export AZURE_STORAGE_ACCOUNT="your-account"
export AZURE_STORAGE_KEY="your-key"
./migrate-organizers-table.sh
```

This will:
1. Export data from `ExternalTeachers` table
2. Create `ExternalOrganizers` table
3. Import all data
4. Create backup

---

## Example: Adding First Organizer

### Using Azure Portal (Easiest)

1. Open Azure Portal
2. Go to your Storage Account
3. Click **Tables** → **+ Table** → Create `ExternalOrganizers`
4. Click **ExternalOrganizers** → **+ Add Entity**
5. Enter:
   ```
   PartitionKey: ORGANIZER
   RowKey: admin@example.com
   email: admin@example.com
   addedBy: system
   addedAt: 2026-03-07T15:00:00Z
   name: System Admin
   ```
6. Click **Insert**

Now `admin@example.com` can log in as an organizer and add others via the API!

---

## Testing

```bash
# Check if email is recognized as organizer
curl https://your-app.azurewebsites.net/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return:
{
  "email": "admin@example.com",
  "roles": ["authenticated", "organizer"]
}
```

---

## Summary

- ✅ **No automatic domain-based assignment**
- ✅ **Whitelist-based**: Only emails in `ExternalOrganizers` table are organizers
- ✅ **All other users**: Default to attendee role
- ✅ **Self-service**: Organizers can add other organizers via API
- ✅ **Bootstrap**: Add first organizer manually via Azure Portal
