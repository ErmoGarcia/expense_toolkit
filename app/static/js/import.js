class ImportManager {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.selectedFile = document.getElementById('selectedFile');
        this.fileName = document.getElementById('fileName');
        this.removeFileBtn = document.getElementById('removeFile');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadForm = document.getElementById('uploadForm');
        this.bankAccountSelect = document.getElementById('bankAccount');

        this.selectedFileData = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadBankAccounts();
        await this.loadImportHistory();
        await this.updateQueueCount();
    }

    setupEventListeners() {
        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        // Remove file
        this.removeFileBtn.addEventListener('click', () => this.clearFile());

        // Form submit
        this.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.setFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.setFile(files[0]);
        }
    }

    setFile(file) {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(fileExtension)) {
            showToast('Invalid file type. Please select an Excel (.xlsx, .xls) or CSV file.', 'warning');
            return;
        }

        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast('File is too large. Maximum size is 10MB.', 'warning');
            return;
        }

        this.selectedFileData = file;
        this.fileName.textContent = file.name;
        this.dropZone.style.display = 'none';
        this.selectedFile.style.display = 'flex';
        this.uploadBtn.disabled = false;
    }

    clearFile() {
        this.selectedFileData = null;
        this.fileInput.value = '';
        this.dropZone.style.display = 'block';
        this.selectedFile.style.display = 'none';
        this.uploadBtn.disabled = true;
    }

    async handleUpload(e) {
        e.preventDefault();

        if (!this.selectedFileData) {
            showToast('Please select a file first.', 'warning');
            return;
        }

        this.uploadBtn.disabled = true;
        this.uploadBtn.textContent = 'Processing...';

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFileData);

            const bankAccountId = this.bankAccountSelect.value;
            if (bankAccountId) {
                formData.append('bank_account_id', bankAccountId);
            }

            const response = await fetch('/api/import/xlsx', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || result.error || 'Upload failed');
            }

            // Show appropriate toast based on result status
            if (result.status === 'completed') {
                showToast(
                    `File processed successfully! ${result.records_imported} imported, ${result.records_skipped} skipped`,
                    'success'
                );
            } else if (result.status === 'failed') {
                showToast(`File uploaded but processing failed: ${result.error}`, 'error');
            } else {
                showToast(`File uploaded. Status: ${result.status}`, 'success');
            }

            this.clearFile();
            await this.loadImportHistory();
            await this.updateQueueCount();

        } catch (error) {
            console.error('Upload error:', error);
            showToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = 'Upload File';
        }
    }

    async loadBankAccounts() {
        try {
            const response = await fetch('/api/import/bank-accounts');
            if (!response.ok) {
                throw new Error('Failed to load bank accounts');
            }
            const accounts = await response.json();

            this.bankAccountSelect.innerHTML = '<option value="">Select account...</option>';
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.id;
                // textContent is safe from XSS
                option.textContent = `${account.name} (${account.bank_name || 'Unknown bank'})`;
                this.bankAccountSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading bank accounts:', error);
            showToast('Failed to load bank accounts', 'error');
        }
    }

    async loadImportHistory() {
        const container = document.getElementById('historyContent');

        try {
            const response = await fetch('/api/import/history');
            if (!response.ok) {
                throw new Error('Failed to load import history');
            }
            const history = await response.json();

            if (history.length === 0) {
                container.innerHTML = '<div class="empty-message">No imports yet</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'history-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Filename</th>
                        <th>Status</th>
                        <th>Records</th>
                        <th>Imported At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(item => this.renderHistoryRow(item)).join('')}
                </tbody>
            `;

            container.innerHTML = '';
            container.appendChild(table);

            // Add event listeners for action buttons using event delegation
            container.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-btn');

                if (deleteBtn) {
                    this.deleteImport(deleteBtn.dataset.id);
                }
            });

        } catch (error) {
            console.error('Error loading history:', error);
            container.innerHTML = '<div class="error-message">Failed to load import history</div>';
        }
    }

    renderHistoryRow(item) {
        const date = new Date(item.imported_at).toLocaleString();
        const statusClass = this.getStatusClass(item.status);
        const records = item.records_imported !== null
            ? `${item.records_imported} imported, ${item.records_skipped || 0} skipped`
            : '-';

        // Show error message if failed
        const errorInfo = item.status === 'failed' && item.error_message
            ? ` title="${escapeAttr(item.error_message)}"`
            : '';

        return `
            <tr>
                <td>${escapeHtml(item.filename)}</td>
                <td><span class="status-badge ${statusClass}"${errorInfo}>${escapeHtml(item.status)}</span></td>
                <td>${escapeHtml(records)}</td>
                <td>${escapeHtml(date)}</td>
                <td>
                    <button class="btn btn-danger btn-small delete-btn" data-id="${parseInt(item.id)}">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }

    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'status-success';
            case 'pending': return 'status-pending';
            case 'processing': return 'status-processing';
            case 'failed': return 'status-failed';
            default: return '';
        }
    }

    async deleteImport(id) {
        if (!confirm('Are you sure you want to delete this import record?')) {
            return;
        }

        try {
            const response = await fetch(`/api/import/history/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Delete failed');
            }

            showToast('Import record deleted', 'success');
            await this.loadImportHistory();
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete import record: ' + error.message, 'error');
        }
    }

    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            if (!response.ok) {
                throw new Error('Failed to load queue count');
            }
            const data = await response.json();
            const badge = document.getElementById('queueCount');
            if (badge) {
                badge.textContent = data.count || 0;
            }
        } catch (error) {
            console.error('Error updating queue count:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ImportManager();
});
