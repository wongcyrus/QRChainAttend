// Azure Static Web App (Frontend)
// Requirements: 19.1, 19.4

@description('Static Web App name')
param staticWebAppName string

@description('Location for the Static Web App')
param location string

@description('GitHub repository URL')
param repositoryUrl string

@description('GitHub repository branch')
param repositoryBranch string

@description('GitHub repository token')
@secure()
param repositoryToken string

@description('Azure AD Tenant ID')
param tenantId string

@description('Azure AD Client ID')
param aadClientId string

@description('Azure AD Client Secret')
@secure()
param aadClientSecret string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// STATIC WEB APP
// ============================================================================

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    repositoryUrl: repositoryUrl
    repositoryToken: repositoryToken
    branch: repositoryBranch
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''  // Empty - API is separate Azure Functions app
      outputLocation: 'out'
    }
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
  }
}

// ============================================================================
// STATIC WEB APP CONFIGURATION
// ============================================================================

// Configure Azure AD authentication
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    AAD_CLIENT_ID: aadClientId
    AAD_CLIENT_SECRET: aadClientSecret
    TENANT_ID: tenantId
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Static Web App name')
output staticWebAppName string = staticWebApp.name

@description('Static Web App ID')
output staticWebAppId string = staticWebApp.id

@description('Static Web App default hostname')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Static Web App principal ID (Managed Identity)')
output principalId string = staticWebApp.identity.principalId

@description('Static Web App deployment token')
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
