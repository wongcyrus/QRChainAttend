#!/bin/bash

# Reset Local Azurite Database
# This script clears all data from the local Azure Storage Emulator (Azurite)

echo "🗑️  Resetting Local Database (Azurite)..."
echo ""

# Azurite is running at /workspace
AZURITE_DATA_DIR="/workspace"

# Check if Azurite is running
if pgrep -f azurite > /dev/null; then
    echo "⚠️  Azurite is currently running"
    echo "   You may need to restart it after clearing data"
    echo ""
fi

# Remove Azurite data files
echo "📁 Clearing Azurite data from: $AZURITE_DATA_DIR"

# Remove table storage data
if [ -f "$AZURITE_DATA_DIR/__azurite_db_table__.json" ]; then
    rm -f "$AZURITE_DATA_DIR/__azurite_db_table__.json"
    echo "   ✓ Removed table storage data"
fi

# Remove blob storage data
if [ -d "$AZURITE_DATA_DIR/__blobstorage__" ]; then
    rm -rf "$AZURITE_DATA_DIR/__blobstorage__"
    echo "   ✓ Removed blob storage data"
fi

# Remove queue storage data
if [ -d "$AZURITE_DATA_DIR/__queuestorage__" ]; then
    rm -rf "$AZURITE_DATA_DIR/__queuestorage__"
    echo "   ✓ Removed queue storage data"
fi

# Remove table storage directory
if [ -d "$AZURITE_DATA_DIR/__tablestorage__" ]; then
    rm -rf "$AZURITE_DATA_DIR/__tablestorage__"
    echo "   ✓ Removed table storage directory"
fi

echo ""
echo "✅ Local database reset complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart your backend: cd backend && npm start"
echo "   2. Create a new session from the teacher dashboard"
echo "   3. Students can join the fresh session"
echo ""
