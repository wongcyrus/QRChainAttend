// Production Environment Parameters
using '../main.bicep'

param environment = 'prod'
param baseName = 'qrattendance'
param location = 'eastus2'

// GitHub repository configuration
// Leave empty for manual deployment (no CI/CD)
param repositoryUrl = ''
param repositoryBranch = 'main'
param repositoryToken = ''

// Deploy Static Web App (frontend) - will be deployed manually
param deployStaticWebApp = true

// Azure AD configuration
// These should be provided at deployment time or via environment variables
param aadClientId = ''
param aadClientSecret = ''

// Deploy Azure OpenAI for Live Quiz feature
param deployAzureOpenAI = true
param gpt4DeploymentName = 'gpt-4o'
param gpt4ModelName = 'gpt-4o'
param gpt4ModelVersion = '2024-08-06'  // Latest GPT-4o version
param gpt4VisionDeploymentName = 'gpt-4o-vision'
param gpt4VisionModelName = 'gpt-4o'
param gpt4VisionModelVersion = '2024-08-06'  // GPT-4o has built-in vision
param deployVisionModel = true

// Tags
param tags = {
  Environment: 'Production'
  Application: 'QR Chain Attendance'
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
}
