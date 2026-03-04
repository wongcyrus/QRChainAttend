// Development Environment Parameters
using '../main.bicep'

param environment = 'dev'
param baseName = 'qrattendance'
param location = 'eastus2'  // Changed from eastus - Static Web Apps not available in eastus

// Frontend URLs for CORS configuration
param frontendUrls = [
  'http://localhost:3000'  // For local development
  'https://localhost:3000' // For HTTPS local development
]

// Optional: Deploy Azure OpenAI for AI insights and Live Quiz feature
param deployAzureOpenAI = true

// Optional: Deploy SignalR Service for real-time features
param deploySignalR = true  // Enable SignalR for development

// Primary model deployment for quiz + vision fallback
param gpt4DeploymentName = 'gpt-4.1'
param gpt4ModelName = 'gpt-4.1'
param gpt4ModelVersion = '2025-04-14'
param gpt4VisionDeploymentName = 'gpt-4.1-vision'
param gpt4VisionModelName = 'gpt-4.1'
param gpt4VisionModelVersion = '2025-04-14'
param deployVisionModel = false
param deployGpt4Model = true

// Disable GPT-5.2-chat deployment for dev
param gpt52ChatDeploymentName = 'gpt-5.2-chat'
param gpt52ChatModelName = 'gpt-5.2-chat'
param gpt52ChatModelVersion = '2026-02-10'
param deployGpt52ChatModel = false

// Single deployment with adequate capacity for dev
param gpt4Capacity = 50
param gpt4VisionCapacity = 1
param gpt52ChatCapacity = 50

// Tags
param tags = {
  Environment: 'Development'
  Application: 'QR Chain Attendance'
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
}
