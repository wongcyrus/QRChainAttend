// Azure Storage Account with Table Storage
// Requirements: 19.1, 19.4

@description('Storage Account name')
param storageAccountName string

@description('Location for the storage account')
param location string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// STORAGE ACCOUNT
// ============================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // Required for Table Storage
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    encryption: {
      services: {
        table: {
          enabled: true
          keyType: 'Account'
        }
        blob: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// ============================================================================
// TABLE SERVICE
// ============================================================================

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {}
}

// Create tables for the application
resource sessionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'Sessions'
}

resource attendanceTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'Attendance'
}

resource tokensTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'Tokens'
}

resource chainsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'Chains'
}

resource scanLogsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'ScanLogs'
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Storage Account name')
output storageAccountName string = storageAccount.name

@description('Storage Account ID')
output storageAccountId string = storageAccount.id

@description('Storage Account Table endpoint')
output tableEndpoint string = storageAccount.properties.primaryEndpoints.table

@description('Storage Account primary key')
output storageAccountKey string = storageAccount.listKeys().keys[0].value
