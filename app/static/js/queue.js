// Queue Processing JavaScript

class QueueProcessor {
    constructor() {
        this.currentItem = null;
        this.categories = [];
        this.tags = [];
        this.currentTags = [];
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadNextItem();
        await this.updateQueueCount();
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

    async loadNextItem() {
        try {
            const response = await fetch('/api/queue');
            const data = await response.json();

            if (data.message) {
                this.renderEmptyQueue();
                return;
            }

            this.currentItem = data;
            this.renderProcessingForm();
            await this.suggestMerchant();
        } catch (error) {
            console.error('Error loading queue item:', error);
            this.renderError('Failed to load queue item');
        }
    }

    async suggestMerchant() {
        if (!this.currentItem?.raw_merchant_name) return;

        try {
            const response = await fetch(`/api/merchants/suggest?raw_name=${encodeURIComponent(this.currentItem.raw_merchant_name)}`);
            const suggestion = await response.json();

            if (suggestion.suggestion) {
                document.getElementById('merchantSuggestion').textContent = 
                    `💡 Suggested: "${suggestion.suggestion}" (${suggestion.confidence}% match)`;
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
                <h2>🎉 Queue is empty!</h2>
                <p>No raw expenses to process at the moment.</p>
                <a href="/" class="btn btn-primary">View Expenses</a>
            </div>
        `;
    }

    renderProcessingForm() {
        const item = this.currentItem;
        document.getElementById('queueStatus').textContent = 'Processing raw transaction';

        document.getElementById('queueContent').innerHTML = `
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
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.discardItem()">Discard</button>
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.skipItem()">Skip</button>
                    <button type="submit" class="btn btn-primary">✓ Save & Next</button>
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

            // Reset for next item
            this.currentTags = [];
            await this.loadNextItem();
            await this.updateQueueCount();
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

            this.currentTags = [];
            await this.loadNextItem();
            await this.updateQueueCount();
        } catch (error) {
            console.error('Error discarding item:', error);
            alert('Error discarding item: ' + error.message);
        }
    }

    skipItem() {
        // For now, skip just moves to next item without processing
        // In a real implementation, you might want to mark items as skipped
        alert('Skip functionality would be implemented here');
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