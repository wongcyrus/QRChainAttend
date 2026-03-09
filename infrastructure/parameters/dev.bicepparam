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

// Enable GPT-5.4 deployment for dev (latest model)
param gpt54DeploymentName = 'gpt-5.4'
param gpt54ModelName = 'gpt-5.4'
param gpt54ModelVersion = '2026-03-05'
param deployGpt54Model = true

// Single deployment with adequate capacity for dev
param gpt54Capacity = 2000  // 2000K TPM for dev

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
  Environment: 'Development'
  Application: 'ProvePresent'
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
}
