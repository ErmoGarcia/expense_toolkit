// Queue Processing JavaScript

class QueueProcessor {
    constructor() {
        this.queueItems = [];
        this.selectedIndex = 0;
        this.selectedIds = new Set(); // For multi-select
        this.currentItem = null;
        this.categories = [];
        this.tags = [];
        this.currentTags = [];
        this.viewMode = 'list'; // 'list' or 'detail'
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadAllItems();
        await this.updateQueueCount();
        this.setupKeyboardNavigation();
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            this.categories = await response.json();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = [];
        }
    }

    async loadAllItems() {
        try {
            const response = await fetch('/api/queue/all');
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                this.queueItems = data;
                this.selectedIndex = 0;
                this.selectedIds.clear();
                this.renderListView();
            } else {
                this.queueItems = [];
                this.renderEmptyQueue();
            }
        } catch (error) {
            console.error('Error loading queue items:', error);
            this.renderError('Failed to load queue items');
        }
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            if (this.viewMode === 'list') {
                this.handleListKeyboard(e);
            } else if (this.viewMode === 'detail') {
                this.handleDetailKeyboard(e);
            }
        });
    }

    handleListKeyboard(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (e.shiftKey) {
                // Shift+Down: select current and move down
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
                this.moveSelection(1);
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
            } else {
                this.moveSelection(1);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (e.shiftKey) {
                // Shift+Up: select current and move up
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
                this.moveSelection(-1);
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
            } else {
                this.moveSelection(-1);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.openDetailView();
        } else if (e.key === ' ') {
            e.preventDefault();
            // Space: toggle selection of current item
            this.toggleSelection(this.queueItems[this.selectedIndex].id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.clearSelection();
        } else if (e.key === 'x' && this.selectedIds.size > 0) {
            e.preventDefault();
            this.discardSelected();
        } else if (e.key === 's' && this.selectedIds.size > 0) {
            e.preventDefault();
            this.saveSelected();
        }
    }

    handleDetailKeyboard(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.backToList();
        } else if (e.key === 'x') {
            e.preventDefault();
            this.discardItem();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            // Ctrl+Enter to save (regular Enter might be used in form)
            e.preventDefault();
            this.processItem();
        } else if (e.key === 'n') {
            e.preventDefault();
            this.goToNext();
        } else if (e.key === 'p') {
            e.preventDefault();
            this.goToPrevious();
        }
    }

    toggleSelection(itemId, forceAdd = false) {
        if (forceAdd) {
            this.selectedIds.add(itemId);
        } else {
            if (this.selectedIds.has(itemId)) {
                this.selectedIds.delete(itemId);
            } else {
                this.selectedIds.add(itemId);
            }
        }
        this.updateListUI();
    }

    clearSelection() {
        this.selectedIds.clear();
        this.updateListUI();
    }

    updateListUI() {
        // Update item classes
        document.querySelectorAll('.queue-list-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const itemId = this.queueItems[index].id;

            item.classList.toggle('focused', index === this.selectedIndex);
            item.classList.toggle('selected', this.selectedIds.has(itemId));
        });

        // Update bulk actions visibility
        const bulkActions = document.getElementById('bulkActions');
        if (bulkActions) {
            if (this.selectedIds.size > 0) {
                bulkActions.style.display = 'flex';
                document.getElementById('selectionCount').textContent =
                    `${this.selectedIds.size} item${this.selectedIds.size > 1 ? 's' : ''} selected`;
            } else {
                bulkActions.style.display = 'none';
            }
        }
    }

    moveSelection(delta) {
        const newIndex = this.selectedIndex + delta;
        if (newIndex >= 0 && newIndex < this.queueItems.length) {
            this.selectedIndex = newIndex;
            this.updateListUI();
            this.scrollToFocused();
        }
    }

    scrollToFocused() {
        const focusedItem = document.querySelector('.queue-list-item.focused');
        if (focusedItem) {
            focusedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    openDetailView(index = null) {
        if (index !== null) {
            this.selectedIndex = index;
        }

        if (this.queueItems.length === 0) return;

        this.currentItem = this.queueItems[this.selectedIndex];
        this.viewMode = 'detail';
        this.currentTags = [];
        this.renderProcessingForm();
        this.suggestMerchant();
    }

    backToList() {
        this.viewMode = 'list';
        this.currentTags = [];
        this.renderListView();
    }

    renderListView() {
        this.viewMode = 'list';
        document.getElementById('queueStatus').textContent = `${this.queueItems.length} items to process`;

        const listHtml = this.queueItems.map((item, index) => `
            <div class="queue-list-item ${index === this.selectedIndex ? 'focused' : ''} ${this.selectedIds.has(item.id) ? 'selected' : ''}" 
                 data-index="${index}"
                 onclick="queueProcessor.handleItemClick(event, ${index})">
                <div class="queue-item-checkbox">
                    <span class="checkbox-indicator">${this.selectedIds.has(item.id) ? '✓' : ''}</span>
                </div>
                <div class="queue-item-date">${this.formatDate(item.transaction_date)}</div>
                <div class="queue-item-merchant">${item.raw_merchant_name || 'Unknown'}</div>
                <div class="queue-item-amount ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                    ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                </div>
                <div class="queue-item-source">${item.source}</div>
            </div>
        `).join('');

        document.getElementById('queueContent').innerHTML = `
            <div class="queue-list-header">
                <div></div>
                <div>Date</div>
                <div>Merchant</div>
                <div>Amount</div>
                <div>Source</div>
            </div>
            <div class="queue-list" id="queueList" tabindex="0">
                ${listHtml}
            </div>
            <div class="queue-list-footer">
                <div class="bulk-actions" id="bulkActions" style="display: none;">
                    <span id="selectionCount">0 items selected</span>
                    <button class="btn btn-danger btn-small" onclick="queueProcessor.discardSelected()">
                        Discard Selected <kbd>X</kbd>
                    </button>
                    <button class="btn btn-primary btn-small" onclick="queueProcessor.saveSelected()">
                        Save Selected <kbd>S</kbd>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="queueProcessor.clearSelection()">
                        Clear Selection <kbd>Esc</kbd>
                    </button>
                </div>
                <div class="keyboard-hints">
                    <span class="keyboard-hint">↑↓ Navigate</span>
                    <span class="keyboard-hint">Enter Open</span>
                    <span class="keyboard-hint">Space Select</span>
                    <span class="keyboard-hint">Shift+↑↓ Multi-select</span>
                </div>
            </div>
        `;

        // Focus the list for keyboard navigation
        document.getElementById('queueList').focus();
    }

    handleItemClick(event, index) {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+Click: toggle selection
            this.selectedIndex = index;
            this.toggleSelection(this.queueItems[index].id);
        } else if (event.shiftKey) {
            // Shift+Click: select range
            const start = Math.min(this.selectedIndex, index);
            const end = Math.max(this.selectedIndex, index);
            for (let i = start; i <= end; i++) {
                this.selectedIds.add(this.queueItems[i].id);
            }
            this.selectedIndex = index;
            this.updateListUI();
        } else {
            // Regular click: open detail view
            this.openDetailView(index);
        }
    }

    async discardSelected() {
        if (this.selectedIds.size === 0) return;

        const count = this.selectedIds.size;
        if (!confirm(`Are you sure you want to discard ${count} transaction${count > 1 ? 's' : ''}?`)) return;

        try {
            const idsToDelete = Array.from(this.selectedIds);

            for (const id of idsToDelete) {
                const response = await fetch(`/api/queue/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Failed to discard item ${id}`);
                }
            }

            // Remove discarded items from queue
            this.queueItems = this.queueItems.filter(item => !this.selectedIds.has(item.id));
            this.selectedIds.clear();

            // Adjust index if needed
            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            await this.updateQueueCount();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                this.renderListView();
            }
        } catch (error) {
            console.error('Error discarding items:', error);
            alert('Error discarding items: ' + error.message);
        }
    }

    async saveSelected() {
        if (this.selectedIds.size === 0) return;

        // For bulk save, we need merchant suggestions - this opens a modal or processes with defaults
        alert('Bulk save requires merchant and category information. Please process items individually or implement a bulk processing modal.');
    }

    async suggestMerchant() {
        if (!this.currentItem?.raw_merchant_name) return;

        try {
            const response = await fetch(`/api/merchants/suggest?raw_name=${encodeURIComponent(this.currentItem.raw_merchant_name)}`);
            const suggestion = await response.json();

            if (suggestion.suggestion) {
                document.getElementById('merchantSuggestion').textContent =
                    `Suggested: "${suggestion.suggestion}" (${suggestion.confidence}% match)`;
                document.getElementById('merchantName').value = suggestion.suggestion;

                if (suggestion.merchant?.default_category_id) {
                    document.getElementById('categorySelect').value = suggestion.merchant.default_category_id;
                }
            }
        } catch (error) {
            console.error('Error getting merchant suggestion:', error);
        }
    }

    renderEmptyQueue() {
        document.getElementById('queueStatus').textContent = 'All caught up!';
        document.getElementById('queueContent').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #28a745;">
                <h2>Queue is empty!</h2>
                <p>No raw expenses to process at the moment.</p>
                <a href="/" class="btn btn-primary">View Expenses</a>
            </div>
        `;
    }

    renderProcessingForm() {
        const item = this.currentItem;
        const currentPosition = this.selectedIndex + 1;
        const totalItems = this.queueItems.length;

        document.getElementById('queueStatus').textContent = `Processing item ${currentPosition} of ${totalItems}`;

        document.getElementById('queueContent').innerHTML = `
            <!-- Back button -->
            <div class="detail-nav-top">
                <button type="button" class="btn btn-back" onclick="queueProcessor.backToList()">
                    ← Back to list <kbd>Esc</kbd>
                </button>
                <span class="position-indicator">${currentPosition} / ${totalItems}</span>
            </div>

            <!-- Raw Transaction -->
            <div class="raw-transaction">
                <h3>Raw Transaction</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div><strong>Date:</strong> ${this.formatDate(item.transaction_date)}</div>
                    <div><strong>Amount:</strong> <span class="expense-amount ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">£${Math.abs(parseFloat(item.amount)).toFixed(2)}</span></div>
                    <div><strong>Merchant:</strong> ${item.raw_merchant_name || 'Unknown'}</div>
                    <div><strong>Source:</strong> ${item.source}</div>
                </div>
                ${item.raw_description ? `<div style="margin-top: 1rem;"><strong>Raw Description:</strong> ${item.raw_description}</div>` : ''}
            </div>

            <!-- Processing Form -->
            <form class="process-form" id="processForm">
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.goToPrevious()" ${this.selectedIndex === 0 ? 'disabled' : ''}>
                        ← Previous <kbd>P</kbd>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.goToNext()" ${this.selectedIndex >= this.queueItems.length - 1 ? 'disabled' : ''}>
                        Next → <kbd>N</kbd>
                    </button>
                </div>
                <div class="form-group">
                    <label for="merchantName">Merchant Alias</label>
                    <input type="text" id="merchantName" placeholder="Enter merchant name (e.g., Amazon)" required>
                    <div class="suggestion" id="merchantSuggestion"></div>
                </div>

                <div class="form-group">
                    <label for="categorySelect">Category</label>
                    <select id="categorySelect" required>
                        <option value="">Select a category</option>
                        ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="description">Description</label>
                    <input type="text" id="description" placeholder="Add a description for this expense">
                </div>

                <div class="form-group">
                    <label for="tagInput">Tags</label>
                    <input type="text" id="tagInput" placeholder="Add a tag and press Enter">
                    <div class="tags-input" id="tagsContainer">
                        <!-- Tags will be added here -->
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-danger" onclick="queueProcessor.discardItem()">
                        Discard <kbd>X</kbd>
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Save <kbd>Ctrl+Enter</kbd>
                    </button>
                </div>
            </form>
        `;

        this.setupFormEvents();
    }

    setupFormEvents() {
        // Form submission
        document.getElementById('processForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processItem();
        });

        // Tag input
        const tagInput = document.getElementById('tagInput');
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag(tagInput.value.trim());
                tagInput.value = '';
            }
        });
    }

    addTag(tagName) {
        if (!tagName || this.currentTags.includes(tagName)) return;

        this.currentTags.push(tagName);
        this.renderTags();
    }

    removeTag(tagName) {
        this.currentTags = this.currentTags.filter(tag => tag !== tagName);
        this.renderTags();
    }

    renderTags() {
        const container = document.getElementById('tagsContainer');
        container.innerHTML = this.currentTags.map(tag => `
            <div class="tag-item">
                #${tag}
                <button type="button" class="tag-remove" onclick="queueProcessor.removeTag('${tag}')">×</button>
            </div>
        `).join('');
    }

    goToPrevious() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.currentItem = this.queueItems[this.selectedIndex];
            this.currentTags = [];
            this.renderProcessingForm();
            this.suggestMerchant();
        }
    }

    goToNext() {
        if (this.selectedIndex < this.queueItems.length - 1) {
            this.selectedIndex++;
            this.currentItem = this.queueItems[this.selectedIndex];
            this.currentTags = [];
            this.renderProcessingForm();
            this.suggestMerchant();
        }
    }

    async processItem() {
        const formData = {
            raw_expense_id: this.currentItem.id,
            merchant_name: document.getElementById('merchantName').value,
            category_id: parseInt(document.getElementById('categorySelect').value),
            description: document.getElementById('description').value,
            tags: this.currentTags
        };

        try {
            const response = await fetch('/api/queue/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to process item');
            }

            // Remove processed item from queue
            this.queueItems.splice(this.selectedIndex, 1);

            // Adjust index if needed
            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            // Reset tags and update UI
            this.currentTags = [];
            await this.updateQueueCount();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                // Stay in detail view with the next item
                this.currentItem = this.queueItems[this.selectedIndex];
                this.renderProcessingForm();
                this.suggestMerchant();
            }
        } catch (error) {
            console.error('Error processing item:', error);
            alert('Error processing item: ' + error.message);
        }
    }

    async discardItem() {
        if (!confirm('Are you sure you want to discard this transaction?')) return;

        try {
            const response = await fetch(`/api/queue/${this.currentItem.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to discard item');
            }

            // Remove discarded item from queue
            this.queueItems.splice(this.selectedIndex, 1);

            // Adjust index if needed
            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            this.currentTags = [];
            await this.updateQueueCount();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                // Stay in detail view with the next item
                this.currentItem = this.queueItems[this.selectedIndex];
                this.renderProcessingForm();
                this.suggestMerchant();
            }
        } catch (error) {
            console.error('Error discarding item:', error);
            alert('Error discarding item: ' + error.message);
        }
    }

    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            const data = await response.json();
            document.getElementById('queueCount').textContent = data.count || 0;
        } catch (error) {
            console.error('Error loading queue count:', error);
        }
    }

    renderError(message) {
        document.getElementById('queueContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    formatDate(dateString) {
        return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB');
    }
}

// Global instance for onclick handlers
let queueProcessor;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    queueProcessor = new QueueProcessor();
});
