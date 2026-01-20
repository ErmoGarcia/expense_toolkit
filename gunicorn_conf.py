"""
Gunicorn configuration file for Expense Toolkit production deployment.

This configuration is optimized for running on an LXC container with 2 CPU cores.
For personal use on a home server with moderate traffic.
"""
import multiprocessing
import os

# Server socket
# Bind to all interfaces on port 8000
bind = "0.0.0.0:8000"

# The maximum number of pending connections
backlog = 2048

# Worker processes
# 2 workers for 2 CPU cores (1 worker per core is recommended for I/O bound apps)
workers = 2

# The type of workers to use
# UvicornWorker provides async support required by FastAPI
worker_class = "uvicorn.workers.UvicornWorker"

# The maximum number of simultaneous clients per worker
worker_connections = 1000

# Workers silent for more than this many seconds are killed and restarted
# 30 seconds is reasonable for expense tracking operations
timeout = 30

# The number of seconds to wait for requests on a Keep-Alive connection
keepalive = 2

# Logging configuration
# Log to stdout/stderr (captured by systemd journald)
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Access log format with response time
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "expense_toolkit"

# Server mechanics
# Don't daemonize (systemd manages the process)
daemon = False

# No PID file (systemd tracks the process)
pidfile = None

# File mode creation mask
umask = 0

# User and group to run workers as (None = inherit from parent process)
user = None
group = None

# Directory for temporary uploaded files
tmp_upload_dir = None

# Preload application code before worker processes are forked
# This can save RAM but may cause issues with some code
# Set to False for safety with SQLite
preload_app = False

# Restart workers after this many requests (helps prevent memory leaks)
# 0 = disabled, set to a value like 1000 if you experience memory issues
max_requests = 0
max_requests_jitter = 0

# Graceful timeout for worker shutdown
graceful_timeout = 30

# SSL/TLS configuration (currently disabled)
# Can be enabled later if you want HTTPS directly on gunicorn
# keyfile = None
# certfile = None
