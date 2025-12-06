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
        this.processAllBtn = document.getElementById('processAllBtn');
        
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
        
        // Process all button
        this.processAllBtn.addEventListener('click', () => this.processAllImports());
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
            alert('Invalid file type. Please select an Excel (.xlsx, .xls) or CSV file.');
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
            alert('Please select a file first.');
            return;
        }
        
        this.uploadBtn.disabled = true;
        this.uploadBtn.textContent = 'Uploading...';
        
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
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
            
            const result = await response.json();
            alert(`File uploaded successfully!\nStored as: ${result.stored_filename}\nStatus: ${result.status}`);
            
            this.clearFile();
            await this.loadImportHistory();
            
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = 'Upload File';
        }
    }
    
    async loadBankAccounts() {
        try {
            const response = await fetch('/api/import/bank-accounts');
            const accounts = await response.json();
            
            this.bankAccountSelect.innerHTML = '<option value="">Select account...</option>';
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = `${account.name} (${account.bank_name || 'Unknown bank'})`;
                this.bankAccountSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading bank accounts:', error);
        }
    }
    
    async loadImportHistory() {
        const container = document.getElementById('historyContent');
        
        try {
            const response = await fetch('/api/import/history');
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
            
            // Add event listeners for action buttons
            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.deleteImport(e.target.dataset.id));
            });
            
            container.querySelectorAll('.process-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.processImport(e.target.dataset.id));
            });
            
            // Show/hide process all button based on pending imports
            const hasPending = history.some(item => item.status === 'pending');
            this.processAllBtn.style.display = hasPending ? 'inline-block' : 'none';
            
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
        
        const processBtn = item.status === 'pending' 
            ? `<button class="btn btn-primary btn-small process-btn" data-id="${item.id}">Process</button>`
            : '';
        
        return `
            <tr>
                <td>${item.filename}</td>
                <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                <td>${records}</td>
                <td>${date}</td>
                <td>
                    ${processBtn}
                    <button class="btn btn-danger btn-small delete-btn" data-id="${item.id}">
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
                throw new Error('Delete failed');
            }
            
            await this.loadImportHistory();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete import record');
        }
    }
    
    async processImport(id) {
        try {
            const btn = document.querySelector(`.process-btn[data-id="${id}"]`);
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Processing...';
            }
            
            const response = await fetch(`/api/import/process/${id}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Processing failed');
            }
            
            const result = await response.json();
            alert(`Import processed successfully!\nBank: ${result.bank_name}\nRecords imported: ${result.records_imported}\nRecords skipped: ${result.records_skipped}`);
            
            await this.loadImportHistory();
            await this.updateQueueCount();
            
        } catch (error) {
            console.error('Process error:', error);
            alert(`Processing failed: ${error.message}`);
            await this.loadImportHistory();
        }
    }
    
    async processAllImports() {
        if (!confirm('Process all pending imports?')) {
            return;
        }
        
        try {
            this.processAllBtn.disabled = true;
            this.processAllBtn.textContent = 'Processing...';
            
            const response = await fetch('/api/import/process-all', {
                method: 'POST'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Processing failed');
            }
            
            const result = await response.json();
            
            let message = `Processed ${result.results.length} imports:\n\n`;
            result.results.forEach(r => {
                if (r.status === 'completed') {
                    message += `${r.filename}: ${r.records_imported} imported, ${r.records_skipped} skipped\n`;
                } else {
                    message += `${r.filename}: ERROR - ${r.error}\n`;
                }
            });
            
            alert(message);
            
            await this.loadImportHistory();
            await this.updateQueueCount();
            
        } catch (error) {
            console.error('Process all error:', error);
            alert(`Processing failed: ${error.message}`);
        } finally {
            this.processAllBtn.disabled = false;
            this.processAllBtn.textContent = 'Process All Pending';
        }
    }
    
    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
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
