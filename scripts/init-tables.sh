#!/bin/bash

# Initialize Tables for ProvePresent System
# Works for both local (Azurite) and Azure environments

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source table configuration (single source of truth)
source "$SCRIPT_DIR/tables-config.sh"

echo "🔧 Initializing Tables"
echo "=============================="
echo ""

# Determine environment and get connection string
if [ -n "$AZURE_STORAGE_CONNECTION_STRING" ]; then
    echo "📍 Environment: Azure (using AZURE_STORAGE_CONNECTION_STRING)"
    CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING"
elif [ -n "$1" ]; then
    echo "📍 Environment: Azure (using provided resource group)"
    RESOURCE_GROUP="$1"
    STORAGE_ACCOUNT="${2:-stqrattendancedev}"
    
    echo "   Resource Group: $RESOURCE_GROUP"
    echo "   Storage Account: $STORAGE_ACCOUNT"
    echo ""
    
    echo "Getting storage account connection string..."
    CONNECTION_STRING=$(az storage account show-connection-string \
      --name "$STORAGE_ACCOUNT" \
      --resource-group "$RESOURCE_GROUP" \
      --query connectionString \
      --output tsv)
    
    if [ -z "$CONNECTION_STRING" ]; then
        echo "❌ Failed to get connection string"
        exit 1
    fi
    echo "✓ Got connection string"
else
    echo "📍 Environment: Local (Azurite)"
    CONNECTION_STRING="AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
fi

echo ""

# Check if Azure CLI is available
if ! command -v az &> /dev/null; then
    echo "⚠️  Azure CLI not found. Using curl to create tables..."
    echo ""
    
    for table in "${TABLES[@]}"; do
        echo "Creating table: $table"
        
        # Create table using REST API
        curl -X POST "http://127.0.0.1:10002/devstoreaccount1/Tables" \
          -H "Content-Type: application/json" \
          -H "Accept: application/json;odata=nometadata" \
          -H "x-ms-version: 2019-02-02" \
          -H "x-ms-date: $(date -u '+%a, %d %b %Y %H:%M:%S GMT')" \
          -d "{\"TableName\":\"$table\"}" \
          2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Created: $table"
        else
            echo "⚠️  Table may already exist: $table"
        fi
        echo ""
    done
else
    echo "Using Azure CLI to create tables..."
    echo ""
    
    for table in "${TABLES[@]}"; do
        echo "Creating table: $table"
        az storage table create \
          --name "$table" \
          --connection-string "$CONNECTION_STRING" \
          2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Created: $table"
        else
            echo "⚠️  Table may already exist: $table"
        fi
        echo ""
    done
fi

echo ""
echo "✅ Table initialization complete!"
echo ""
echo "📝 Tables created:"
for table in "${TABLES[@]}"; do
    echo "   - $table"
done
echo ""

# Show usage info
if [ -z "$AZURE_STORAGE_CONNECTION_STRING" ] && [ -z "$1" ]; then
    echo "💡 Usage:"
    echo "   Local (Azurite):  ./scripts/init-tables.sh"
    echo "   Azure:            ./scripts/init-tables.sh <resource-group> [storage-account]"
    echo "   Azure (env var):  AZURE_STORAGE_CONNECTION_STRING=<conn-string> ./scripts/init-tables.sh"
    echo ""
    echo "🔍 View tables in Azure Storage Explorer:"
    echo "   Connection: http://127.0.0.1:10002"
    echo "   Account: devstoreaccount1"
    echo ""
fi
