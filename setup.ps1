# Setup Script for tool-live project
# This script installs Node.js, npm, project dependencies, and runs dev server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  tool-live Project Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some installations may require elevated privileges" -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Step 1: Check Node.js installation
Write-Host "Step 1: Checking Node.js installation..." -ForegroundColor Green

if (Test-CommandExists node) {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is already installed: $nodeVersion" -ForegroundColor Green
    
    # Check if version is at least v18
    $versionNumber = $nodeVersion -replace 'v', ''
    $majorVersion = [int]($versionNumber.Split('.')[0])
    
    if ($majorVersion -lt 18) {
        Write-Host "⚠️  Warning: Node.js version is below 18. Recommended to upgrade." -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installing Node.js via winget..." -ForegroundColor Yellow
    
    # Check if winget is available
    if (Test-CommandExists winget) {
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            Write-Host "✓ Node.js installed successfully!" -ForegroundColor Green
            Write-Host "⚠️  Please restart your terminal/PowerShell to use node commands" -ForegroundColor Yellow
            Write-Host "   After restarting, run this script again." -ForegroundColor Yellow
            Write-Host ""
            Read-Host "Press Enter to exit"
            exit
        } catch {
            Write-Host "✗ Failed to install Node.js via winget" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ winget not available" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Node.js manually:" -ForegroundColor Yellow
        Write-Host "1. Visit: https://nodejs.org/" -ForegroundColor Cyan
        Write-Host "2. Download the LTS version (v20.x or later)" -ForegroundColor Cyan
        Write-Host "3. Run the installer" -ForegroundColor Cyan
        Write-Host "4. Restart your terminal and run this script again" -ForegroundColor Cyan
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit
    }
}

Write-Host ""

# Step 2: Check npm installation
Write-Host "Step 2: Checking npm installation..." -ForegroundColor Green

if (Test-CommandExists npm) {
    $npmVersion = npm --version
    Write-Host "✓ npm is already installed: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "✗ npm is not installed (should come with Node.js)" -ForegroundColor Red
    Write-Host "   Please reinstall Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""

# Step 3: Verify project directory
Write-Host "Step 3: Verifying project directory..." -ForegroundColor Green

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$projectDir\package.json") {
    Write-Host "✓ Found package.json in project directory" -ForegroundColor Green
} else {
    Write-Host "✗ package.json not found!" -ForegroundColor Red
    Write-Host "   Please run this script from the project root directory" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""

# Step 4: Install project dependencies
Write-Host "Step 4: Installing project dependencies..." -ForegroundColor Green
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

try {
    Set-Location $projectDir
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
    } else {
        throw "npm install failed"
    }
} catch {
    Write-Host ""
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""

# Step 5: Create necessary directories
Write-Host "Step 5: Setting up project directories..." -ForegroundColor Green

$directories = @("data", "logs")

foreach ($dir in $directories) {
    if (-not (Test-Path "$projectDir\$dir")) {
        New-Item -ItemType Directory -Path "$projectDir\$dir" -Force | Out-Null
        Write-Host "✓ Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "✓ Directory exists: $dir" -ForegroundColor Green
    }
}

Write-Host ""

# Step 6: Check configuration files
Write-Host "Step 6: Checking configuration files..." -ForegroundColor Green

if (-not (Test-Path "$projectDir\config\proxies.json")) {
    if (Test-Path "$projectDir\config\proxies.example.json") {
        Copy-Item "$projectDir\config\proxies.example.json" "$projectDir\config\proxies.json"
        Write-Host "✓ Created proxies.json from example" -ForegroundColor Green
    } elseif (Test-Path "$projectDir\config\proxies-sample.json") {
        Copy-Item "$projectDir\config\proxies-sample.json" "$projectDir\config\proxies.json"
        Write-Host "✓ Created proxies.json from sample" -ForegroundColor Green
    } else {
        Write-Host "⚠️  proxies.json not found - you may need to configure proxies manually" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ proxies.json exists" -ForegroundColor Green
}

Write-Host ""

# Step 7: Display system information
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  System Information" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Node.js version: $(node --version)" -ForegroundColor White
Write-Host "npm version:     v$(npm --version)" -ForegroundColor White
Write-Host "Project path:    $projectDir" -ForegroundColor White
Write-Host ""

# Step 8: Ask to run dev server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$runDev = Read-Host "Do you want to start the development server now? (Y/n)"

if ($runDev -eq "" -or $runDev -eq "Y" -or $runDev -eq "y") {
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    npm run dev
} else {
    Write-Host ""
    Write-Host "To start the development server later, run:" -ForegroundColor Cyan
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
}
