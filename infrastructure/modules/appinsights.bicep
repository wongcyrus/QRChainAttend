// Application Insights for monitoring and logging

@description('Application Insights name')
param appInsightsName string

@description('Location for Application Insights')
param location string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// LOG ANALYTICS WORKSPACE
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${appInsightsName}-workspace'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// APPLICATION INSIGHTS
// ============================================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 30
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Application Insights name')
output appInsightsName string = appInsights.name

@description('Application Insights ID')
output appInsightsId string = appInsights.id

@description('Application Insights instrumentation key')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights connection string')
output connectionString string = appInsights.properties.ConnectionString

@description('Log Analytics Workspace ID')
output workspaceId string = logAnalyticsWorkspace.id
