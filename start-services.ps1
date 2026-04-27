#!/usr/bin/env pwsh
# Clinic Application Docker Startup Script
# This script starts all services using Docker Compose

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Clinic Application - Docker Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
} catch {
    Write-Host "Error: Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Docker from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
} catch {
    Write-Host "Error: Docker Compose is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Docker Compose from https://docs.docker.com/compose/install/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker and Docker Compose are installed." -ForegroundColor Green
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
Write-Host ""

# Start services in detached mode
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start services" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Services are starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Waiting for services to be healthy..." -ForegroundColor Green
Write-Host ""

# Wait a few seconds for services to start
Start-Sleep -Seconds 5

Write-Host "Checking service status..." -ForegroundColor Green
docker-compose ps

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services are now running:" -ForegroundColor Green
Write-Host "  - Auth Service:    http://localhost:8080" -ForegroundColor Yellow
Write-Host "  - Submit Service:  http://localhost:8081" -ForegroundColor Yellow
Write-Host "  - Database:        localhost:3306" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Green
Write-Host "  View logs:         docker-compose logs -f" -ForegroundColor Yellow
Write-Host "  Stop services:     docker-compose down" -ForegroundColor Yellow
Write-Host "  View status:       docker-compose ps" -ForegroundColor Yellow
Write-Host ""

