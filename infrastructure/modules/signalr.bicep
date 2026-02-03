// Azure SignalR Service
// Requirements: 19.2, 19.5

@description('SignalR Service name')
param signalRName string

@description('Location for the SignalR Service')
param location string

@description('Environment (dev, staging, prod)')
param environment string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// SIGNALR SERVICE
// ============================================================================

// Use Free tier for dev, Standard for staging/prod
var sku = environment == 'dev' ? {
  name: 'Free_F1'
  tier: 'Free'
  capacity: 1
} : {
  name: 'Standard_S1'
  tier: 'Standard'
  capacity: 1
}

resource signalR 'Microsoft.SignalRService/signalR@2023-02-01' = {
  name: signalRName
  location: location
  tags: tags
  sku: sku
  kind: 'SignalR'
  properties: {
    features: [
      {
        flag: 'ServiceMode'
        value: 'Serverless'
      }
      {
        flag: 'EnableConnectivityLogs'
        value: 'True'
      }
      {
        flag: 'EnableMessagingLogs'
        value: 'True'
      }
    ]
    cors: {
      allowedOrigins: [
        '*' // Will be restricted to specific domains in production
      ]
    }
    // Network ACLs only supported in Standard tier, not Free tier
    networkACLs: environment == 'dev' ? null : {
      defaultAction: 'Allow'
      publicNetwork: {
        allow: [
          'ServerConnection'
          'ClientConnection'
          'RESTAPI'
          'Trace'
        ]
      }
    }
    publicNetworkAccess: 'Enabled'
    tls: {
      clientCertEnabled: false
    }
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('SignalR Service name')
output signalRName string = signalR.name

@description('SignalR Service ID')
output signalRId string = signalR.id

@description('SignalR Service endpoint')
output endpoint string = signalR.properties.hostName

@description('SignalR Service connection string')
output connectionString string = 'Endpoint=https://${signalR.properties.hostName};AccessKey=${signalR.listKeys().primaryKey};Version=1.0;'

@description('SignalR Service primary key')
output primaryKey string = signalR.listKeys().primaryKey
