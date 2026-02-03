#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy QR Chain Attendance System infrastructure to Azure

.DESCRIPTION
    This script deploys all Azure resources for the QR Chain Attendance System
    using Bicep templates. It supports multiple environments (dev, staging, prod)
    and handles parameter validation.

.PARAMETER Environment
    The environment to deploy to (dev, staging, prod)

.PARAMETER ResourceGroup
    The name of the resource group to deploy to

.PARAMETER Location
    The Azure region to deploy to (default: eastus)

.PARAMETER RepositoryUrl
    GitHub repository URL for Static Web App

.PARAMETER RepositoryBranch
    GitHub repository branch (default: main)

.PARAMETER RepositoryToken
    GitHub personal access token for deployment

.PARAMETER AadClientId
    Azure AD application client ID

.PARAMETER AadClientSecret
    Azure AD application client secret

.PARAMETER DeployOpenAI
    Deploy Azure OpenAI service (default: false for dev, true for staging/prod)

.PARAMETER WhatIf
    Show what would be deployed without actually deploying

.EXAMPLE
    .\deploy.ps1 -Environment dev -ResourceGroup rg-qr-attendance-dev

.EXAMPLE
    .\deploy.ps1 -Environment prod -ResourceGroup rg-qr-attendance-prod -DeployOpenAI $true

.NOTES
    Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $false)]
    [string]$Location = 'eastus',

    [Parameter(Mandatory = $false)]
    [string]$RepositoryUrl = '',

    [Parameter(Mandatory = $false)]
    [string]$RepositoryBranch = 'main',

    [Parameter(Mandatory = $false)]
    [string]$RepositoryToken = '',

    [Parameter(Mandatory = $false)]
    [string]$AadClientId = '',

    [Parameter(Mandatory = $false)]
    [string]$AadClientSecret = '',

    [Parameter(Mandatory = $false)]
    [bool]$DeployOpenAI = $false,

    [Parameter(Mandatory = $false)]
    [switch]$WhatIf
)

# Set error action preference
$ErrorActionPreference = 'Stop'

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QR Chain Attendance System Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment:     $Environment" -ForegroundColor Yellow
Write-Host "Resource Group:  $ResourceGroup" -ForegroundColor Yellow
Write-Host "Location:        $Location" -ForegroundColor Yellow
Write-Host "Deploy OpenAI:   $DeployOpenAI" -ForegroundColor Yellow
Write-Host ""

# Check if Azure CLI is installed
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "✓ Azure CLI version: $($azVersion.'azure-cli')" -ForegroundColor Green
}
catch {
    Write-Error "Azure CLI is not installed. Please install it from https://aka.ms/azure-cli"
    exit 1
}

# Check if logged in to Azure
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "✓ Logged in as: $($account.user.name)" -ForegroundColor Green
    Write-Host "✓ Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
}
catch {
    Write-Error "Not logged in to Azure. Please run 'az login' first."
    exit 1
}

Write-Host ""

# Create resource group if it doesn't exist
Write-Host "Checking resource group..." -ForegroundColor Cyan
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq 'false') {
    Write-Host "Creating resource group: $ResourceGroup" -ForegroundColor Yellow
    if ($PSCmdlet.ShouldProcess($ResourceGroup, "Create resource group")) {
        az group create --name $ResourceGroup --location $Location --output none
        Write-Host "✓ Resource group created" -ForegroundColor Green
    }
}
else {
    Write-Host "✓ Resource group exists" -ForegroundColor Green
}

Write-Host ""

# Prepare parameters
$parametersFile = Join-Path $ScriptDir "parameters" "$Environment.bicepparam"
if (-not (Test-Path $parametersFile)) {
    Write-Error "Parameters file not found: $parametersFile"
    exit 1
}

Write-Host "Using parameters file: $parametersFile" -ForegroundColor Cyan

# Build parameter overrides
$parameterOverrides = @()

if ($RepositoryUrl) {
    $parameterOverrides += "repositoryUrl='$RepositoryUrl'"
}
if ($RepositoryBranch) {
    $parameterOverrides += "repositoryBranch='$RepositoryBranch'"
}
if ($RepositoryToken) {
    $parameterOverrides += "repositoryToken='$RepositoryToken'"
}
if ($AadClientId) {
    $parameterOverrides += "aadClientId='$AadClientId'"
}
if ($AadClientSecret) {
    $parameterOverrides += "aadClientSecret='$AadClientSecret'"
}
if ($DeployOpenAI) {
    $parameterOverrides += "deployAzureOpenAI=$DeployOpenAI"
}

# Deploy infrastructure
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Infrastructure" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$deploymentName = "qr-attendance-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

if ($WhatIf) {
    Write-Host "Running in WhatIf mode - no changes will be made" -ForegroundColor Yellow
    Write-Host ""
    
    $whatIfArgs = @(
        'deployment', 'group', 'what-if',
        '--resource-group', $ResourceGroup,
        '--name', $deploymentName,
        '--parameters', $parametersFile
    )
    
    if ($parameterOverrides.Count -gt 0) {
        $whatIfArgs += '--parameters'
        $whatIfArgs += $parameterOverrides -join ' '
    }
    
    & az @whatIfArgs
}
else {
    Write-Host "Starting deployment: $deploymentName" -ForegroundColor Yellow
    Write-Host "This may take 10-15 minutes..." -ForegroundColor Yellow
    Write-Host ""
    
    $deployArgs = @(
        'deployment', 'group', 'create',
        '--resource-group', $ResourceGroup,
        '--name', $deploymentName,
        '--parameters', $parametersFile,
        '--output', 'json'
    )
    
    if ($parameterOverrides.Count -gt 0) {
        $deployArgs += '--parameters'
        $deployArgs += $parameterOverrides -join ' '
    }
    
    try {
        $deployment = & az @deployArgs | ConvertFrom-Json
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Deployment Successful!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        # Display outputs
        Write-Host "Deployment Outputs:" -ForegroundColor Cyan
        Write-Host ""
        
        $outputs = $deployment.properties.outputs
        foreach ($key in $outputs.PSObject.Properties.Name) {
            $value = $outputs.$key.value
            if ($value -is [string] -and $value.Length -gt 0) {
                Write-Host "  $key : $value" -ForegroundColor White
            }
            elseif ($value -is [PSCustomObject]) {
                Write-Host "  $key :" -ForegroundColor White
                foreach ($prop in $value.PSObject.Properties) {
                    Write-Host "    $($prop.Name): $($prop.Value)" -ForegroundColor Gray
                }
            }
        }
        
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Update your GitHub repository secrets with the deployment token" -ForegroundColor White
        Write-Host "2. Push your code to trigger the GitHub Actions workflow" -ForegroundColor White
        Write-Host "3. Verify the deployment at the Static Web App URL" -ForegroundColor White
        Write-Host "4. Run the verification script: .\scripts\verify-managed-identity.sh" -ForegroundColor White
        Write-Host ""
    }
    catch {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "Deployment Failed!" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Error $_.Exception.Message
        exit 1
    }
}

Write-Host "Deployment script completed." -ForegroundColor Cyan
