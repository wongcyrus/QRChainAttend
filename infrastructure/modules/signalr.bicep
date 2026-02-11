// Azure SignalR Service
// Requirements: 19.2, 19.5
// Production: Uses Standard S1 tier (1000 connections, 1M messages/day)
// Development: Uses Free tier (20 connections, 20K messages/day)

@description('SignalR Service name')
param signalRName string

@description('Location for the SignalR Service')
param location string

@description('Environment (dev, staging, prod)')
param environment string

@description('Deploy SignalR Service (optional, can use polling fallback)')
param deploySignalR bool = false

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// SIGNALR SERVICE (OPTIONAL)
// ============================================================================

// Use Free tier for dev, Standard S1 for prod/staging
// Free tier: 20 concurrent connections, 20K messages/day
// Standard S1: 1000 concurrent connections, 1M messages/day (~$50/month)
var sku = environment == 'dev' ? {
  name: 'Free_F1'
  tier: 'Free'
  capacity: 1
} : {
  name: 'Standard_S1'
  tier: 'Standard'
  capacity: 1  // Can scale up to 100 units if needed
}

resource signalR 'Microsoft.SignalRService/signalR@2023-02-01' = if (deploySignalR) {
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
output signalRName string = deploySignalR ? signalR.name : ''

@description('SignalR Service ID')
output signalRId string = deploySignalR ? signalR.id : ''

@description('SignalR Service endpoint')
output endpoint string = deploySignalR ? signalR.properties.hostName : ''

@description('SignalR Service connection string (use dummy value if not deployed)')
output connectionString string = deploySignalR ? 'Endpoint=https://${signalR.properties.hostName};AccessKey=${signalR.listKeys().primaryKey};Version=1.0;' : 'Endpoint=https://dummy.service.signalr.net;AccessKey=dummykey;Version=1.0;'

@description('SignalR Service primary key')
output primaryKey string = deploySignalR ? signalR.listKeys().primaryKey : ''
