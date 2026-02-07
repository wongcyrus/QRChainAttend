#!/bin/bash

# Reset Production Database Script
# This script deletes and recreates all tables in the production Azure Storage account

set -e

STORAGE_ACCOUNT="stqrattendancedev"
RESOURCE_GROUP="rg-qr-attendance-dev"

echo "=========================================="
echo "Reset Production Database"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in production!"
echo ""
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Resource Group: $RESOURCE_GROUP"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🗑️  Deleting tables..."

TABLES=("Sessions" "Attendance" "Chains" "Tokens" "ScanLogs")

for table in "${TABLES[@]}"; do
    echo -n "  Deleting $table... "
    if az storage table delete \
        --account-name "$STORAGE_ACCOUNT" \
        --name "$table" \
        --output none 2>/dev/null; then
        echo "✓"
    else
        echo "⚠️  (may not exist)"
    fi
done

echo ""
echo "⏳ Waiting 15 seconds for deletion to complete..."
sleep 15

echo ""
echo "📦 Creating tables..."

for table in "${TABLES[@]}"; do
    echo -n "  Creating $table... "
    if az storage table create \
        --account-name "$STORAGE_ACCOUNT" \
        --name "$table" \
        --output none 2>/dev/null; then
        echo "✓"
    else
        echo "❌ Failed"
        exit 1
    fi
done

echo ""
echo "✅ Production database reset complete!"
echo ""
echo "Tables created:"
az storage table list \
    --account-name "$STORAGE_ACCOUNT" \
    --query "[].name" \
    --output table 2>/dev/null

echo ""
echo "🎉 Done! The production database is now empty and ready for use."
