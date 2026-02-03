// Azure OpenAI Service (Optional)
// Requirements: 19.3

@description('Azure OpenAI resource name')
param openAIName string

@description('Location for Azure OpenAI')
param location string

@description('Model deployment name')
param modelDeploymentName string

@description('Model name')
param modelName string

@description('Model version')
param modelVersion string

@description('Tags to apply to the resource')
param tags object

// ============================================================================
// AZURE OPENAI ACCOUNT
// ============================================================================

resource openAI 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAIName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAIName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

// ============================================================================
// MODEL DEPLOYMENT
// ============================================================================

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAI
  name: modelDeploymentName
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
    raiPolicyName: 'Microsoft.Default'
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('Azure OpenAI name')
output openAIName string = openAI.name

@description('Azure OpenAI ID')
output openAIId string = openAI.id

@description('Azure OpenAI endpoint')
output endpoint string = openAI.properties.endpoint

@description('Azure OpenAI primary key')
output primaryKey string = openAI.listKeys().key1

@description('Model deployment name')
output deploymentName string = deployment.name
