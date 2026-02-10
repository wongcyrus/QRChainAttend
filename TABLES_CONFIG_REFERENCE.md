# Table Configuration Reference

## Single Source of Truth

All Azure Table Storage table names are now centralized in:

```
scripts/tables-config.sh
```

## Why This Matters

Previously, table names were duplicated across multiple scripts:
- `scripts/init-tables.sh`
- `scripts/delete-all-tables.sh`
- `scripts/reset-production-db.sh`
- `dev-tools.sh`

This led to inconsistencies and maintenance issues when adding or removing tables.

## Current Tables

The system uses these tables (defined in `scripts/tables-config.sh`):

1. **Sessions** - Active attendance sessions
2. **Attendance** - Student attendance records
3. **Chains** - QR chain state and holders
4. **Tokens** - Temporary QR code tokens
5. **UserSessions** - User authentication sessions
6. **AttendanceSnapshots** - Historical attendance snapshots
7. **ChainHistory** - Complete chain transfer history
8. **ScanLogs** - QR scan audit logs (optional/legacy)
9. **DeletionLog** - Deletion audit trail (optional/legacy)

## How Scripts Use It

All database scripts now source the centralized config:

```bash
# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source table configuration (single source of truth)
source "$SCRIPT_DIR/tables-config.sh"

# Now TABLES array is available
for table in "${TABLES[@]}"; do
    echo "Processing: $table"
done
```

## Adding a New Table

To add a new table to the system:

1. Edit `scripts/tables-config.sh`
2. Add the table name to the TABLES array
3. All scripts automatically use the new table

Example:
```bash
TABLES=(
  "Sessions"
  "Attendance"
  # ... existing tables ...
  "NewTableName"  # Add here
)
```

## Scripts That Use This Config

- ✅ `scripts/init-tables.sh` - Creates all tables
- ✅ `scripts/delete-all-tables.sh` - Deletes all tables (local)
- ✅ `scripts/reset-production-db.sh` - Resets production database

## Verification

Test that the config is working:

```bash
# Source the config and list tables
source scripts/tables-config.sh
echo "Tables: ${TABLES[@]}"

# Count tables
echo "Total: ${#TABLES[@]} tables"
```

## Benefits

1. **Consistency** - All scripts use the same table list
2. **Maintainability** - Update in one place, affects all scripts
3. **Documentation** - Clear list of all tables in the system
4. **Error Prevention** - No more missing tables in one script but not another
