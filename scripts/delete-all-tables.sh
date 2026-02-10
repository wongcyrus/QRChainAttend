#!/bin/bash

# Delete All Tables from Azurite
# WARNING: This will delete ALL data!

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source table configuration (single source of truth)
source "$SCRIPT_DIR/tables-config.sh"

echo "🗑️  Deleting All Tables from Azurite"
echo "======================================"
echo ""

CONNECTION_STRING="AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"

# Check if Azure CLI is available
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please install Azure CLI to delete tables."
    echo ""
    echo "Alternative: Use Azure Storage Explorer to manually delete tables:"
    echo "   Connection: http://127.0.0.1:10002"
    echo "   Account: devstoreaccount1"
    exit 1
fi

echo "⚠️  WARNING: This will delete ALL tables and data!"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting tables..."
echo ""

for table in "${TABLES[@]}"; do
    echo "Deleting table: $table"
    az storage table delete \
      --name "$table" \
      --connection-string "$CONNECTION_STRING" \
      2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Deleted: $table"
    else
        echo "⚠️  Table may not exist: $table"
    fi
    echo ""
done

echo ""
echo "✅ All tables deleted!"
echo ""
echo "💡 To recreate tables, run:"
echo "   ./scripts/init-tables.sh"
echo ""
