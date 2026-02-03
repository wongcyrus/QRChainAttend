// Azure Functions (Backend API)
// Requirements: 19.1, 19.2, 19.3, 19.4, 19.5

@description('Function App name')
param functionAppName string

@description('App Service Plan name')
param appServicePlanName string

@description('Location for the Function App')
param location string

@description('Storage Account name for Function App')
param storageAccountName string

@description('Storage Account Table URI')
param storageAccountUri string

@description('SignalR Service connection string')
@secure()
param signalRConnectionString string

@description('Application Insights connection string')
@secure()
param appInsightsConnectionString string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// APP SERVICE PLAN (Consumption)
// ============================================================================

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
  }
  properties: {
    reserved: true // Required for Linux
  }
  kind: 'functionapp'
}

// ============================================================================
// FUNCTION APP
// ============================================================================

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        // Application-specific settings
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'STORAGE_ACCOUNT_URI'
          value: storageAccountUri
        }
        {
          name: 'SIGNALR_CONNECTION_STRING'
          value: signalRConnectionString
        }
        {
          name: 'LATE_ROTATION_SECONDS'
          value: '60'
        }
        {
          name: 'EARLY_LEAVE_ROTATION_SECONDS'
          value: '60'
        }
        {
          name: 'CHAIN_TOKEN_TTL_SECONDS'
          value: '20'
        }
        {
          name: 'OWNER_TRANSFER'
          value: 'true'
        }
        {
          name: 'WIFI_SSID_ALLOWLIST'
          value: ''
        }
        {
          name: 'AOAI_ENDPOINT'
          value: ''
        }
        {
          name: 'AOAI_KEY'
          value: ''
        }
        {
          name: 'AOAI_DEPLOYMENT'
          value: ''
        }
      ]
      cors: {
        allowedOrigins: [
          '*' // Will be restricted to Static Web App domain in production
        ]
        supportCredentials: false
      }
      use32BitWorkerProcess: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Function App name')
output functionAppName string = functionApp.name

@description('Function App ID')
output functionAppId string = functionApp.id

@description('Function App default hostname')
output defaultHostname string = functionApp.properties.defaultHostName

@description('Function App principal ID (Managed Identity)')
output principalId string = functionApp.identity.principalId
