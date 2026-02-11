// Development Environment Parameters
using '../main.bicep'

param environment = 'dev'
param baseName = 'qrattendance'
param location = 'eastus2'  // Changed from eastus - Static Web Apps not available in eastus

// GitHub repository configuration
// These should be provided at deployment time or via environment variables
param repositoryUrl = ''
param repositoryBranch = 'main'
param repositoryToken = ''

// Deploy Static Web App (set to false to skip frontend deployment)
// Already deployed via direct module deployment - see swa-qrattendance-dev2
param deployStaticWebApp = false

// Azure AD configuration
// These should be provided at deployment time or via environment variables
param aadClientId = ''
param aadClientSecret = ''

// Optional: Deploy Azure OpenAI for AI insights and Live Quiz feature
param deployAzureOpenAI = true  // Changed to true for Live Quiz feature
param gpt4DeploymentName = 'gpt-4'
param gpt4ModelName = 'gpt-4'
param gpt4ModelVersion = '1106-Preview'  // Updated to latest version
param gpt4VisionDeploymentName = 'gpt-4-vision'
param gpt4VisionModelName = 'gpt-4'
param gpt4VisionModelVersion = 'vision-preview'
param deployVisionModel = true  // Required for Live Quiz slide analysis

// Tags
param tags = {
  Environment: 'Development'
  Application: 'QR Chain Attendance'
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
}
