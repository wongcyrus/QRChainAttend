// Production Environment Parameters
using '../main.bicep'

param environment = 'prod'
param baseName = 'qrattendance'
param location = 'eastus2'

// Frontend URLs for CORS configuration.
// Leave empty by default for production; deployment scripts configure SWA linkage/CORS.
param frontendUrls = []

// Deploy Azure OpenAI for Live Quiz feature
param deployAzureOpenAI = true

// Deploy SignalR Service with Standard S1 tier for production
param deploySignalR = true

// Enable GPT-5.4 deployment for production (latest model)
param gpt54DeploymentName = 'gpt-5.4'
param gpt54ModelName = 'gpt-5.4'
param gpt54ModelVersion = '2026-03-05'
param deployGpt54Model = true

// Production capacity settings
param gpt54Capacity = 2000  // 2M TPM for production (matches your screenshot)

// OTP SMTP settings (read from environment; no secrets committed)
param otpSmtpHost = readEnvironmentVariable('OTP_SMTP_HOST', 'smtp.gmail.com')
param otpSmtpPort = readEnvironmentVariable('OTP_SMTP_PORT', '465')
param otpSmtpSecure = readEnvironmentVariable('OTP_SMTP_SECURE', 'true')
param otpSmtpUsername = readEnvironmentVariable('OTP_SMTP_USERNAME', '')
param otpSmtpPassword = readEnvironmentVariable('OTP_SMTP_PASSWORD', '')
param otpFromEmail = readEnvironmentVariable('OTP_FROM_EMAIL', '')
param otpFromName = readEnvironmentVariable('OTP_FROM_NAME', 'VTC Attendance')
param otpEmailSubject = readEnvironmentVariable('OTP_EMAIL_SUBJECT', 'Your verification code')
param otpAppName = readEnvironmentVariable('OTP_APP_NAME', 'ProvePresent')
param allowedEmailDomains = readEnvironmentVariable('ALLOWED_EMAIL_DOMAINS', '')
param organizationName = readEnvironmentVariable('ORGANIZATION_NAME', '')

// Domain-based role assignment
param organizerDomain = 'vtc.edu.hk'
// param attendeeDomain = 'stu.vtc.edu.hk'  // Uncomment to restrict attendees to specific domain

// Tags
param tags = {
  Environment: 'Production'
  Application: 'ProvePresent'
  ManagedBy: 'Bicep'
  DeploymentMethod: 'Hybrid'  // Bicep for backend + CLI for Static Web App
  CostCenter: 'Engineering'
}
