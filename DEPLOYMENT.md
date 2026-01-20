# 🚀 Production Deployment Guide

Complete guide for deploying Expense Toolkit to production on an LXC container.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [LXC Container Setup](#lxc-container-setup)
- [Application Installation](#application-installation)
- [Systemd Service Setup](#systemd-service-setup)
- [Database Backups](#database-backups)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Upgrading](#upgrading)
- [Restoring from Backup](#restoring-from-backup)

---

## Overview

This deployment guide configures Expense Toolkit to run as a production service with:

- **Gunicorn** with Uvicorn workers (2 workers for 2 CPU cores)
- **Systemd** for process management and auto-start
- **Journald** for centralized logging
- **Automated daily backups** with retention policy
- **Health check endpoint** for monitoring
- **Security hardening** for production environment

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+ (other Linux distributions should work)
- **CPU**: 2 cores minimum
- **RAM**: 512MB minimum, 1GB recommended
- **Disk**: 2GB minimum (more for database growth and backups)
- **Python**: 3.8 or higher
- **SQLite**: 3.31.0 or higher

### Required Packages

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv sqlite3 git
```

---

## LXC Container Setup

### 1. Create LXC Container

If you're creating a new LXC container:

```bash
# On your Proxmox/LXC host
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname expense-toolkit \
  --cores 2 \
  --memory 1024 \
  --swap 512 \
  --storage local-lvm \
  --rootfs 8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp

# Start the container
pct start 100

# Enter the container
pct enter 100
```

### 2. Create User

Create a dedicated user for running the application:

```bash
# Create user 'expenses'
sudo useradd -m -s /bin/bash expenses

# Set password (optional, for SSH access)
sudo passwd expenses

# Add to necessary groups (optional)
sudo usermod -aG sudo expenses  # Only if you need sudo access
```

### 3. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  sqlite3 \
  git \
  build-essential \
  python3-dev
```

---

## Application Installation

### 1. Clone/Copy the Repository

```bash
# Switch to expenses user
sudo su - expenses

# Clone from git (if using git)
git clone https://github.com/yourusername/expense_toolkit.git
cd expense_toolkit

# OR copy from local machine
# From your dev machine: scp -r /path/to/expense_toolkit expenses@container-ip:/home/expenses/
```

### 2. Set Up Virtual Environment

```bash
cd /home/expenses/expense_toolkit

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

Configure your `.env` file:

```bash
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
```

### 4. Update Backup Script Path

Edit the backup script to match your installation path:

```bash
nano scripts/backup_database.sh
```

Update the `PROJECT_DIR` variable:

```bash
PROJECT_DIR="/home/expenses/expense_toolkit"
```

### 5. Test the Application

Before setting up systemd, test that the application runs:

```bash
# Development mode (with auto-reload)
python run.py

# Or production mode
python run_production.py
```

Visit `http://container-ip:8000` to verify it works. Press Ctrl+C to stop.

### 6. Initialize Database (if needed)

If this is a new installation, set up demo data:

```bash
python scripts/setup_demo.py
```

---

## Systemd Service Setup

### 1. Copy Service Files

```bash
# Copy main service file
sudo cp expense-toolkit.service /etc/systemd/system/

# Copy backup service files
sudo cp expense-toolkit-backup.service /etc/systemd/system/
sudo cp expense-toolkit-backup.timer /etc/systemd/system/
```

### 2. Verify Service Configuration

Ensure the paths in the service files match your installation:

```bash
sudo nano /etc/systemd/system/expense-toolkit.service
```

Verify these paths:
- `User=expenses`
- `Group=expenses`
- `WorkingDirectory=/home/expenses/expense_toolkit`
- `Environment="PATH=/home/expenses/expense_toolkit/.venv/bin:..."`
- `ExecStart=/home/expenses/expense_toolkit/.venv/bin/python ...`

### 3. Reload Systemd

```bash
sudo systemctl daemon-reload
```

### 4. Enable and Start Service

```bash
# Enable service to start on boot
sudo systemctl enable expense-toolkit.service

# Start the service
sudo systemctl start expense-toolkit.service

# Check status
sudo systemctl status expense-toolkit.service
```

### 5. Verify Application is Running

```bash
# Check if service is active
sudo systemctl is-active expense-toolkit.service

# Check health endpoint
curl http://localhost:8000/health

# View logs
sudo journalctl -u expense-toolkit.service -f
```

---

## Database Backups

### 1. Enable Backup Timer

```bash
# Enable timer to start on boot
sudo systemctl enable expense-toolkit-backup.timer

# Start the timer
sudo systemctl start expense-toolkit-backup.timer

# Check timer status
sudo systemctl status expense-toolkit-backup.timer

# List all timers to verify it's scheduled
sudo systemctl list-timers
```

### 2. Test Backup Manually

```bash
# Run backup service manually
sudo systemctl start expense-toolkit-backup.service

# Check backup logs
sudo journalctl -u expense-toolkit-backup.service -n 50

# Verify backup was created
ls -lh /home/expenses/expense_toolkit/backups/
```

### 3. Backup Configuration

Backups are configured to:
- Run **daily at 3:00 AM** (randomized ±15 minutes)
- Keep backups for **30 days**
- Store in `/home/expenses/expense_toolkit/backups/`
- Compress with gzip
- Log to journald

To change backup time, edit the timer:

```bash
sudo nano /etc/systemd/system/expense-toolkit-backup.timer

# Modify OnCalendar line, for example:
# OnCalendar=*-*-* 02:00:00  # Run at 2 AM instead

sudo systemctl daemon-reload
sudo systemctl restart expense-toolkit-backup.timer
```

---

## Monitoring & Maintenance

### Viewing Logs

```bash
# View application logs (live)
sudo journalctl -u expense-toolkit.service -f

# View last 100 lines
sudo journalctl -u expense-toolkit.service -n 100

# View logs since today
sudo journalctl -u expense-toolkit.service --since today

# View backup logs
sudo journalctl -u expense-toolkit-backup.service -n 50
```

### Health Check Endpoint

The application provides a health check endpoint at `/health`:

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "Expense Toolkit",
  "version": "1.0.0",
  "environment": "production",
  "database": "connected"
}
```

You can monitor this endpoint with tools like:
- **Uptime Kuma** (self-hosted monitoring)
- **Prometheus + Grafana**
- **Simple cron script**

Example monitoring script:

```bash
#!/bin/bash
# /home/expenses/check_health.sh

HEALTH_URL="http://localhost:8000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" != "200" ]; then
    echo "ERROR: Expense Toolkit health check failed (HTTP $RESPONSE)"
    # Add notification here (email, webhook, etc.)
fi
```

### Service Management Commands

```bash
# Start service
sudo systemctl start expense-toolkit.service

# Stop service
sudo systemctl stop expense-toolkit.service

# Restart service
sudo systemctl restart expense-toolkit.service

# Check status
sudo systemctl status expense-toolkit.service

# View resource usage
sudo systemctl show expense-toolkit.service --property=MemoryCurrent,CPUUsageNSec
```

### Database Maintenance

```bash
# Check database size
du -h /home/expenses/expense_toolkit/data/expenses.db

# Vacuum database (optimize and reclaim space)
sqlite3 /home/expenses/expense_toolkit/data/expenses.db "VACUUM;"

# Check database integrity
sqlite3 /home/expenses/expense_toolkit/data/expenses.db "PRAGMA integrity_check;"
```

---

## Troubleshooting

### Service Won't Start

1. **Check logs for errors:**
   ```bash
   sudo journalctl -u expense-toolkit.service -n 50
   ```

2. **Verify paths in service file:**
   ```bash
   sudo cat /etc/systemd/system/expense-toolkit.service
   ```

3. **Test running manually:**
   ```bash
   sudo su - expenses
   cd /home/expenses/expense_toolkit
   source .venv/bin/activate
   python run_production.py
   ```

4. **Check permissions:**
   ```bash
   ls -la /home/expenses/expense_toolkit/
   # Ensure 'expenses' user owns all files
   sudo chown -R expenses:expenses /home/expenses/expense_toolkit/
   ```

### Database Locked Errors

SQLite can have issues with concurrent writes:

1. **Check if multiple instances are running:**
   ```bash
   ps aux | grep expense_toolkit
   ```

2. **Ensure only systemd service is running:**
   ```bash
   sudo systemctl restart expense-toolkit.service
   ```

3. **Check database permissions:**
   ```bash
   ls -la /home/expenses/expense_toolkit/data/
   ```

### High Memory Usage

1. **Check current memory usage:**
   ```bash
   sudo systemctl status expense-toolkit.service
   ```

2. **Adjust worker count in gunicorn_conf.py** (if needed):
   ```bash
   nano /home/expenses/expense_toolkit/gunicorn_conf.py
   # Change workers = 2 to workers = 1
   sudo systemctl restart expense-toolkit.service
   ```

### Port Already in Use

```bash
# Check what's using port 8000
sudo lsof -i :8000

# Change port in .env file
nano /home/expenses/expense_toolkit/.env
# Set PORT=8001

# Restart service
sudo systemctl restart expense-toolkit.service
```

---

## Upgrading

### Upgrading the Application

```bash
# Stop the service
sudo systemctl stop expense-toolkit.service

# Switch to expenses user
sudo su - expenses
cd /home/expenses/expense_toolkit

# Backup current installation (optional but recommended)
tar -czf ~/expense_toolkit_backup_$(date +%Y%m%d).tar.gz .

# Pull latest changes (if using git)
git pull origin main

# Activate virtual environment
source .venv/bin/activate

# Update dependencies
pip install --upgrade -r requirements.txt

# Run database migrations (automatic on startup, but can run manually)
.venv/bin/python -m alembic upgrade head

# Exit expenses user
exit

# Start the service
sudo systemctl start expense-toolkit.service

# Verify it's running
sudo systemctl status expense-toolkit.service
curl http://localhost:8000/health
```

### Upgrading Python Version

```bash
# Install new Python version
sudo apt-get update
sudo apt-get install python3.11 python3.11-venv python3.11-dev

# Recreate virtual environment
sudo su - expenses
cd /home/expenses/expense_toolkit
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Restart service
exit
sudo systemctl restart expense-toolkit.service
```

---

## Restoring from Backup

### Restore Database from Backup

```bash
# Stop the service
sudo systemctl stop expense-toolkit.service

# Switch to expenses user
sudo su - expenses
cd /home/expenses/expense_toolkit

# List available backups
ls -lh backups/

# Choose a backup to restore
BACKUP_FILE="backups/expenses_20240105_030000.db.gz"

# Decompress backup
gunzip -c "$BACKUP_FILE" > /tmp/expenses_restore.db

# Backup current database (just in case)
cp data/expenses.db data/expenses.db.before_restore

# Restore database
cp /tmp/expenses_restore.db data/expenses.db

# Set correct permissions
chown expenses:expenses data/expenses.db

# Clean up
rm /tmp/expenses_restore.db

# Exit expenses user
exit

# Start the service
sudo systemctl start expense-toolkit.service

# Verify restoration
sudo systemctl status expense-toolkit.service
curl http://localhost:8000/health
```

### Full System Restore

If you need to restore the entire application:

```bash
# Extract backup
cd /home/expenses
tar -xzf expense_toolkit_backup_20240105.tar.gz -C expense_toolkit/

# Set permissions
sudo chown -R expenses:expenses /home/expenses/expense_toolkit/

# Reinstall dependencies
sudo su - expenses
cd /home/expenses/expense_toolkit
source .venv/bin/activate
pip install -r requirements.txt
exit

# Restart service
sudo systemctl restart expense-toolkit.service
```

---

## Security Considerations

### Firewall Configuration

If you're using a firewall, allow access to port 8000:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 8000/tcp

# Or restrict to specific IP/network
sudo ufw allow from 192.168.1.0/24 to any port 8000

# iptables
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
```

### SSL/HTTPS (Optional)

For HTTPS, you can:

1. **Use a reverse proxy** (nginx/caddy) - Recommended
2. **Configure Gunicorn with SSL certificates** - See gunicorn_conf.py

Example nginx configuration (not included in base setup):

```nginx
server {
    listen 443 ssl http2;
    server_name expenses.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/expenses.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/expenses.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backups Off-Site

Consider backing up to a remote location:

```bash
# Example: rsync backups to another server
rsync -avz /home/expenses/expense_toolkit/backups/ \
  user@backup-server:/path/to/backups/expense_toolkit/
```

---

## Additional Resources

- **Project README**: See `README.md` for application features and usage
- **Development Guide**: See `AGENTS.md` for development setup
- **API Documentation**: http://your-server:8000/docs

---

## Support

If you encounter issues:

1. Check the logs: `sudo journalctl -u expense-toolkit.service -n 100`
2. Verify health endpoint: `curl http://localhost:8000/health`
3. Review this troubleshooting guide
4. Check GitHub issues (if open source)

---

**Happy expense tracking!** 💰📊
