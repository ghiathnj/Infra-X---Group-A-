@echo off
REM Clinic Application Docker Startup Script
REM This script starts all services using Docker Compose

echo ========================================
echo Clinic Application - Docker Startup
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed or not in PATH
    echo Please install Docker from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker Compose is not installed or not in PATH
    echo Please install Docker Compose from https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

echo Docker and Docker Compose are installed.
echo.
echo Starting services...
echo.

REM Start services in detached mode
docker-compose up -d

if errorlevel 1 (
    echo Error: Failed to start services
    pause
    exit /b 1
)

echo.
echo ========================================
echo Services are starting...
echo ========================================
echo.
echo Waiting for services to be healthy...
echo.

REM Wait a few seconds for services to start
timeout /t 5 /nobreak

echo.
echo Checking service status...
docker-compose ps

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Services are now running:
echo   - Auth Service:    http://localhost:8080
echo   - Submit Service:  http://localhost:8081
echo   - Database:        localhost:3306
echo.
echo To view logs:
echo   docker-compose logs -f
echo.
echo To stop services:
echo   docker-compose down
echo.
pause

