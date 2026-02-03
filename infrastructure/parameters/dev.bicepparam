// Development Environment Parameters
using '../main.bicep'

param environment = 'dev'
param baseName = 'qrattendance'
param location = 'eastus'

// GitHub repository configuration
// These should be provided at deployment time or via environment variables
param repositoryUrl = ''
param repositoryBranch = 'main'
param repositoryToken = ''

// Azure AD configuration
// These should be provided at deployment time or via environment variables
param aadClientId = ''
param aadClientSecret = ''

// Optional: Deploy Azure OpenAI for AI insights
param deployAzureOpenAI = false
param openAIModelDeployment = 'gpt-4'
param openAIModelName = 'gpt-4'
param openAIModelVersion = '0613'

// Tags
param tags = {
  Environment: 'Development'
  Application: 'QR Chain Attendance'
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
}
