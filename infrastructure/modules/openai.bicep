// Azure OpenAI Service (Optional)
// Requirements: 19.3
// Updated: Support for Live Quiz feature with GPT-4 and GPT-4 Vision

@description('Azure OpenAI resource name')
param openAIName string

@description('Location for Azure OpenAI')
param location string

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
// GPT-4 DEPLOYMENT (for question generation and answer evaluation)
// ============================================================================

resource gpt4Deployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAI
  name: gpt4DeploymentName
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: gpt4ModelName
      version: gpt4ModelVersion
    }
    raiPolicyName: 'Microsoft.Default'
  }
}

// ============================================================================
// GPT-4 VISION DEPLOYMENT (for slide analysis)
// ============================================================================

resource gpt4VisionDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (deployVisionModel) {
  parent: openAI
  name: gpt4VisionDeploymentName
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: gpt4VisionModelName
      version: gpt4VisionModelVersion
    }
    raiPolicyName: 'Microsoft.Default'
  }
  dependsOn: [
    gpt4Deployment  // Deploy sequentially to avoid conflicts
  ]
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

@description('GPT-4 deployment name')
output gpt4DeploymentName string = gpt4Deployment.name

@description('GPT-4 Vision deployment name (if deployed)')
output gpt4VisionDeploymentName string = deployVisionModel ? gpt4VisionDeployment.name : ''
