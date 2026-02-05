#!/bin/bash

# Initialize Azurite Tables
# Creates all required tables for the QR Chain Attendance system

echo "🔧 Initializing Azurite Tables"
echo "=============================="
echo ""

# Connection string for local Azurite
CONNECTION_STRING="AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"

# Tables to create
TABLES=(
  "Sessions"
  "Attendance"
  "Chains"
  "Tokens"
  "UserSessions"
)

# Check if Azure CLI or az-storage-table is available
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
echo "🔍 View tables in Azure Storage Explorer:"
echo "   Connection: http://127.0.0.1:10002"
echo "   Account: devstoreaccount1"
echo ""
