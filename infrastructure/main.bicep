// QR Chain Attendance System - Main Infrastructure Template
// This template orchestrates all Azure resources for the QR Chain Attendance System
// Requirements: 19.1, 19.2, 19.3, 19.4, 19.5

targetScope = 'resourceGroup'

// ============================================================================
// PARAMETERS
// ============================================================================

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Base name for all resources (will be suffixed with environment)')
@minLength(3)
@maxLength(20)
param baseName string = 'qrattendance'

@description('GitHub repository URL for Static Web App')
param repositoryUrl string = ''

@description('GitHub repository branch')
param repositoryBranch string = 'main'

@description('GitHub repository token for Static Web App deployment')
@secure()
param repositoryToken string = ''

@description('Azure AD Tenant ID for authentication')
param tenantId string = subscription().tenantId

@description('Azure AD Client ID for authentication')
param aadClientId string = ''

@description('Azure AD Client Secret for authentication')
@secure()
param aadClientSecret string = ''

@description('Deploy Azure OpenAI resource (optional)')
param deployAzureOpenAI bool = false

@description('Deploy SignalR Service (optional, system works with polling fallback)')
param deploySignalR bool = false

@description('Deploy Azure Static Web App (optional, requires GitHub repo)')
param deployStaticWebApp bool = true

@description('GPT-4 model deployment name')
param gpt4DeploymentName string = 'gpt-4'

@description('GPT-4 model name')
param gpt4ModelName string = 'gpt-4'

@description('GPT-4 model version')
param gpt4ModelVersion string = '0613'

@description('GPT-4 Vision model deployment name')
param gpt4VisionDeploymentName string = 'gpt-4-vision'

@description('GPT-4 Vision model name')
param gpt4VisionModelName string = 'gpt-4'

@description('GPT-4 Vision model version')
param gpt4VisionModelVersion string = 'vision-preview'

@description('Deploy GPT-4 Vision model (required for Live Quiz feature)')
param deployVisionModel bool = true

@description('Tags to apply to all resources')
param tags object = {
  Environment: environment
  Application: 'QR Chain Attendance'
  ManagedBy: 'Bicep'
}

// ============================================================================
// VARIABLES
// ============================================================================

var resourceSuffix = '${baseName}-${environment}'
var storageAccountName = replace('st${resourceSuffix}', '-', '')
var signalRName = 'signalr-${resourceSuffix}'
var staticWebAppName = 'swa-${resourceSuffix}2'  // Added '2' to avoid conflict with pending deletion
var functionAppName = 'func-${resourceSuffix}'
var appServicePlanName = 'asp-${resourceSuffix}'
var appInsightsName = 'appi-${resourceSuffix}'
var openAIName = 'openai-${resourceSuffix}'

// ============================================================================
// MODULES
// ============================================================================

// Storage Account with Table Storage
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: storageAccountName
    location: location
    tags: tags
  }
}

// Azure SignalR Service (Optional)
module signalr 'modules/signalr.bicep' = {
  name: 'signalr-deployment'
  params: {
    signalRName: signalRName
    location: location
    environment: environment
    deploySignalR: deploySignalR
    tags: tags
  }
}

// Application Insights
module appInsights 'modules/appinsights.bicep' = {
  name: 'appinsights-deployment'
  params: {
    appInsightsName: appInsightsName
    location: location
    tags: tags
  }
}

// Azure OpenAI (Optional) - Must be deployed before Functions
module openai 'modules/openai.bicep' = if (deployAzureOpenAI) {
  name: 'openai-deployment'
  params: {
    openAIName: openAIName
    location: location
    gpt4DeploymentName: gpt4DeploymentName
    gpt4ModelName: gpt4ModelName
    gpt4ModelVersion: gpt4ModelVersion
    gpt4VisionDeploymentName: gpt4VisionDeploymentName
    gpt4VisionModelName: gpt4VisionModelName
    gpt4VisionModelVersion: gpt4VisionModelVersion
    deployVisionModel: deployVisionModel
    tags: tags
  }
}

// Azure Functions (Backend API)
module functions 'modules/functions.bicep' = {
  name: 'functions-deployment'
  params: {
    functionAppName: functionAppName
    appServicePlanName: appServicePlanName
    location: location
    storageAccountName: storage.outputs.storageAccountName
    storageAccountUri: storage.outputs.tableEndpoint
    signalRConnectionString: signalr.outputs.connectionString
    appInsightsConnectionString: appInsights.outputs.connectionString
    azureOpenAIEndpoint: deployAzureOpenAI ? openai.outputs.endpoint : ''
    azureOpenAIKey: deployAzureOpenAI ? openai.outputs.primaryKey : ''
    azureOpenAIDeployment: deployAzureOpenAI ? openai.outputs.gpt4DeploymentName : ''
    azureOpenAIVisionDeployment: deployAzureOpenAI ? openai.outputs.gpt4VisionDeploymentName : ''
    tags: tags
  }
}

// Azure Static Web App (Frontend) - Optional
// Use GitHub CI/CD module if repository URL provided, otherwise manual deployment
module staticWebApp 'modules/staticwebapp.bicep' = if (deployStaticWebApp && repositoryUrl != '') {
  name: 'staticwebapp-deployment'
  params: {
    staticWebAppName: staticWebAppName
    location: location
    repositoryUrl: repositoryUrl
    repositoryBranch: repositoryBranch
    repositoryToken: repositoryToken
    tenantId: tenantId
    aadClientId: aadClientId
    aadClientSecret: aadClientSecret
    tags: tags
  }
}

// Azure Static Web App (Manual Deployment) - No GitHub CI/CD
module staticWebAppManual 'modules/staticwebapp-manual.bicep' = if (deployStaticWebApp && repositoryUrl == '') {
  name: 'staticwebapp-manual-deployment'
  params: {
    staticWebAppName: staticWebAppName
    location: location
    tenantId: tenantId
    aadClientId: aadClientId
    aadClientSecret: aadClientSecret
    tags: tags
  }
}

// RBAC Role Assignments
module rbac 'modules/rbac.bicep' = {
  name: 'rbac-deployment'
  params: {
    storageAccountName: storage.outputs.storageAccountName
    signalRName: signalr.outputs.signalRName
    staticWebAppPrincipalId: deployStaticWebApp ? (repositoryUrl != '' ? staticWebApp.outputs.principalId : staticWebAppManual.outputs.principalId) : ''
    functionAppPrincipalId: functions.outputs.principalId
    deployAzureOpenAI: deployAzureOpenAI
    openAIName: deployAzureOpenAI ? openai.outputs.openAIName : ''
  }
  dependsOn: [
    storage
    signalr
    functions
  ]
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Storage Account name')
output storageAccountName string = storage.outputs.storageAccountName

@description('Storage Account Table endpoint')
output storageTableEndpoint string = storage.outputs.tableEndpoint

@description('SignalR Service name')
output signalRName string = signalr.outputs.signalRName

@description('SignalR Service endpoint')
output signalREndpoint string = signalr.outputs.endpoint

@description('Static Web App name (if deployed)')
output staticWebAppName string = deployStaticWebApp ? (repositoryUrl != '' ? staticWebApp.outputs.staticWebAppName : staticWebAppManual.outputs.staticWebAppName) : ''

@description('Static Web App default hostname (if deployed)')
output staticWebAppUrl string = deployStaticWebApp ? (repositoryUrl != '' ? staticWebApp.outputs.defaultHostname : staticWebAppManual.outputs.defaultHostname) : ''

@description('Static Web App deployment token (for manual deployment)')
output staticWebAppDeploymentToken string = deployStaticWebApp && repositoryUrl == '' ? staticWebAppManual.outputs.deploymentToken : ''

@description('Function App name')
output functionAppName string = functions.outputs.functionAppName

@description('Function App default hostname')
output functionAppUrl string = functions.outputs.defaultHostname

@description('Application Insights name')
output appInsightsName string = appInsights.outputs.appInsightsName

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.outputs.instrumentationKey

@description('Azure OpenAI name (if deployed)')
output openAIName string = deployAzureOpenAI ? openai.outputs.openAIName : ''

@description('Azure OpenAI endpoint (if deployed)')
output openAIEndpoint string = deployAzureOpenAI ? openai.outputs.endpoint : ''

@description('GPT-4 deployment name (if deployed)')
output gpt4DeploymentName string = deployAzureOpenAI ? openai.outputs.gpt4DeploymentName : ''

@description('GPT-4 Vision deployment name (if deployed)')
output gpt4VisionDeploymentName string = deployAzureOpenAI ? openai.outputs.gpt4VisionDeploymentName : ''

@description('Deployment summary')
output deploymentSummary object = {
  environment: environment
  location: location
  storageAccount: storage.outputs.storageAccountName
  signalR: signalr.outputs.signalRName
  staticWebApp: deployStaticWebApp ? (repositoryUrl != '' ? staticWebApp.outputs.staticWebAppName : staticWebAppManual.outputs.staticWebAppName) : 'Not deployed'
  functionApp: functions.outputs.functionAppName
  appInsights: appInsights.outputs.appInsightsName
  openAI: deployAzureOpenAI ? openai.outputs.openAIName : 'Not deployed'
}
