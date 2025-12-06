// Queue Processing JavaScript

class Autocomplete {
    constructor(input, options) {
        this.input = input;
        this.options = options;
        this.suggestions = [];
        this.selectedIndex = -1;
        this.container = null;
        this.onSelect = options.onSelect || (() => {});
        this.onCreate = options.onCreate || (() => {});
        this.allowCreate = options.allowCreate !== false;
        this.minLength = options.minLength || 1;
        this.debounceTimer = null;
        this.debounceDelay = 300;

        this.init();
    }

    init() {
        this.createContainer();
        this.bindEvents();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'autocomplete-container';
        this.container.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ced4da;
            border-top: none;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;
        this.input.parentNode.style.position = 'relative';
        this.input.parentNode.appendChild(this.container);
    }

    bindEvents() {
        this.input.addEventListener('input', (e) => this.onInput(e));
        this.input.addEventListener('keydown', (e) => this.onKeydown(e));
        this.input.addEventListener('blur', () => setTimeout(() => this.hide(), 150));
        this.input.addEventListener('focus', () => this.onInput({ target: this.input }));
    }

    async onInput(e) {
        const value = e.target.value.trim();
        this.selectedIndex = -1;

        if (value.length < this.minLength) {
            this.hide();
            return;
        }

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            await this.fetchSuggestions(value);
        }, this.debounceDelay);
    }

    async fetchSuggestions(query) {
        try {
            const response = await fetch(`${this.options.endpoint}?q=${encodeURIComponent(query)}`);
            this.suggestions = await response.json();
            this.renderSuggestions(query);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.suggestions = [];
            this.hide();
        }
    }

    renderSuggestions(query) {
        if (this.suggestions.length === 0 && !this.allowCreate) {
            this.hide();
            return;
        }

        this.container.innerHTML = '';

        // Existing suggestions
        this.suggestions.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = this.options.displayField ? item[this.options.displayField] : item.name || item.display_name;
            div.addEventListener('click', () => this.selectItem(item));
            div.addEventListener('mouseenter', () => this.setSelectedIndex(index));
            this.container.appendChild(div);
        });

        // Create new option
        if (this.allowCreate && query && !this.suggestions.some(item =>
            (item.name || item.display_name).toLowerCase() === query.toLowerCase()
        )) {
            const div = document.createElement('div');
            div.className = 'autocomplete-item create-new';
            div.innerHTML = `<em>Create "${query}"</em>`;
            div.addEventListener('click', () => this.createNew(query));
            div.addEventListener('mouseenter', () => this.setSelectedIndex(this.suggestions.length));
            this.container.appendChild(div);
        }

        this.show();
    }

    setSelectedIndex(index) {
        // Remove previous selection
        const items = this.container.querySelectorAll('.autocomplete-item');
        items.forEach(item => item.classList.remove('selected'));

        // Add new selection
        if (items[index]) {
            items[index].classList.add('selected');
            this.selectedIndex = index;
        }
    }

    onKeydown(e) {
        if (!this.container.style.display || this.container.style.display === 'none') return;

        const items = this.container.querySelectorAll('.autocomplete-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.setSelectedIndex(this.selectedIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.setSelectedIndex(this.selectedIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                    const isCreateNew = items[this.selectedIndex].classList.contains('create-new');
                    if (isCreateNew) {
                        this.createNew(this.input.value.trim());
                    } else {
                        this.selectItem(this.suggestions[this.selectedIndex]);
                    }
                }
                break;
            case 'Escape':
                this.hide();
                break;
        }
    }

    selectItem(item) {
        this.input.value = this.options.displayField ? item[this.options.displayField] : item.name || item.display_name;
        this.onSelect(item);
        this.hide();
    }

    async createNew(value) {
        try {
            const response = await fetch(this.options.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.options.createData(value))
            });

            if (response.ok) {
                const newItem = await response.json();
                this.input.value = this.options.displayField ? newItem[this.options.displayField] : newItem.name || newItem.display_name;
                this.onCreate(newItem);
                this.hide();
            } else {
                console.error('Failed to create new item');
            }
        } catch (error) {
            console.error('Error creating new item:', error);
        }
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
        this.selectedIndex = -1;
    }
}

class QueueProcessor {
    constructor() {
        this.queueItems = [];
        this.selectedIndex = 0;
        this.selectedIds = new Set(); // For multi-select
        this.currentItem = null;
        this.categories = [];
        this.tags = [];
        this.currentTags = [];
        this.viewMode = 'list'; // 'list', 'detail', or 'bulk'
        this.bulkTags = [];
        this.merchantAutocomplete = null;
        this.bulkMerchantAutocomplete = null;
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadAllItems();
        await this.updateQueueCount();
        this.setupKeyboardNavigation();
        this.setupButtonListeners();
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
            } else if (this.viewMode === 'bulk') {
                this.handleBulkKeyboard(e);
            }
        });
    }

    setupButtonListeners() {
        const toolsBtn = document.getElementById('toolsBtn');
        const rulesBtn = document.getElementById('rulesBtn');

        if (toolsBtn) {
            toolsBtn.addEventListener('click', () => this.openToolsModal());
        }
        if (rulesBtn) {
            rulesBtn.addEventListener('click', () => this.openRulesModal());
        }
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
            this.openBulkSaveModal();
        } else if (e.key === 't') {
            e.preventDefault();
            this.openToolsModal();
        } else if (e.key === 'r') {
            e.preventDefault();
            this.openRulesModal();
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
        } else if (e.key === 't') {
            e.preventDefault();
            this.openToolsModal();
        } else if (e.key === 'r') {
            e.preventDefault();
            this.openRulesModal();
        }
    }

    handleBulkKeyboard(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeBulkSaveModal();
        } else if (e.key === 't') {
            e.preventDefault();
            this.openToolsModal();
        } else if (e.key === 'r') {
            e.preventDefault();
            this.openRulesModal();
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
            
            // Update checkbox indicator
            const checkbox = item.querySelector('.checkbox-indicator');
            if (checkbox) {
                checkbox.textContent = this.selectedIds.has(itemId) ? '✓' : '';
            }
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
                    <button class="btn btn-primary btn-small" onclick="queueProcessor.openBulkSaveModal()">
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
        this.updateListUI();
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

    // Bulk Save Modal
    openBulkSaveModal() {
        if (this.selectedIds.size === 0) return;
        
        this.viewMode = 'bulk';
        this.bulkTags = [];
        
        const selectedItems = this.queueItems.filter(item => this.selectedIds.has(item.id));
        const totalAmount = selectedItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay" id="bulkModal" onclick="queueProcessor.handleModalClick(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Bulk Save ${this.selectedIds.size} Expense${this.selectedIds.size > 1 ? 's' : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeBulkSaveModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="bulk-summary">
                            <div class="bulk-summary-item">
                                <strong>Items:</strong> ${this.selectedIds.size}
                            </div>
                            <div class="bulk-summary-item">
                                <strong>Total:</strong> 
                                <span class="${totalAmount < 0 ? 'negative' : 'positive'}">
                                    ${totalAmount < 0 ? '-' : ''}£${Math.abs(totalAmount).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        
                        <div class="bulk-items-preview">
                            <strong>Selected Items:</strong>
                            <div class="bulk-items-list">
                                ${selectedItems.map(item => `
                                    <div class="bulk-item-row">
                                        <span class="bulk-item-date">${this.formatDate(item.transaction_date)}</span>
                                        <span class="bulk-item-merchant">${item.raw_merchant_name || 'Unknown'}</span>
                                        <span class="bulk-item-amount ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                                            ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <form id="bulkSaveForm" onsubmit="queueProcessor.processBulkSave(event)">
                            <div class="form-group">
                                <label for="bulkMerchantName">Merchant Alias (applied to all)</label>
                                <input type="text" id="bulkMerchantName" placeholder="Start typing to see suggestions..." required>
                            </div>

                            <div class="form-group">
                                <label for="bulkCategorySelect">Category (applied to all)</label>
                                <select id="bulkCategorySelect" required>
                                    <option value="">Select a category</option>
                                    ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="bulkDescription">Description (optional, applied to all)</label>
                                <input type="text" id="bulkDescription" placeholder="Add a description">
                            </div>

                             <div class="form-group">
                                 <label for="bulkTagInput">Tags (applied to all)</label>
                                 <input type="text" id="bulkTagInput" placeholder="Start typing to see existing tags..." autocomplete="off">
                                 <div class="tags-input" id="bulkTagsContainer">
                                     <!-- Tags will be added here -->
                                 </div>
                             </div>

                             <div class="form-group">
                                 <label class="switch-label">
                                     Periodic expenses (applied to all)
                                     <label class="switch">
                                         <input type="checkbox" id="bulkIsPeriodic">
                                         <span class="slider"></span>
                                     </label>
                                 </label>
                             </div>

                             <div class="form-group" id="bulkPeriodicExpenseGroup" style="display: none;">
                                 <label for="bulkPeriodicExpenseName">Periodic Expense Name (applied to all)</label>
                                 <input type="text" id="bulkPeriodicExpenseName" placeholder="Start typing to see suggestions..." autocomplete="off">
                             </div>
                         </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeBulkSaveModal()">
                            Cancel <kbd>Esc</kbd>
                        </button>
                        <button type="submit" form="bulkSaveForm" class="btn btn-primary" id="bulkSaveBtn">
                            Save All ${this.selectedIds.size} Items
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Append modal to body
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
        
        // Setup tag input
        this.setupBulkTagInput();
        
        // Focus merchant input
        document.getElementById('bulkMerchantName').focus();
    }

    setupBulkTagInput() {
        // Initialize autocomplete for bulk merchant
        const bulkMerchantInput = document.getElementById('bulkMerchantName');
        this.bulkMerchantAutocomplete = new Autocomplete(bulkMerchantInput, {
            endpoint: '/api/merchants',
            displayField: 'display_name',
            onSelect: (merchant) => {
                // Set default category if available
                if (merchant.default_category_id) {
                    document.getElementById('bulkCategorySelect').value = merchant.default_category_id;
                }
            },
            createData: (value) => ({
                raw_name: value,
                display_name: value
            })
        });

        // Initialize autocomplete for bulk tags
        const bulkTagInput = document.getElementById('bulkTagInput');
        new Autocomplete(bulkTagInput, {
            endpoint: '/api/tags',
            displayField: 'name',
            onSelect: (tag) => {
                this.addBulkTag(tag.name);
                bulkTagInput.value = '';
            },
            onCreate: (tag) => {
                this.addBulkTag(tag.name);
                bulkTagInput.value = '';
            },
            createData: (value) => ({
                name: value
            })
        });

        // Fallback for bulk tag input
        bulkTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = bulkTagInput.value.trim();
                if (value) {
                    this.addBulkTag(value);
                    bulkTagInput.value = '';
                }
            }
        });

        // Bulk periodic expense checkbox toggle
        document.getElementById('bulkIsPeriodic').addEventListener('change', (e) => {
            const periodicGroup = document.getElementById('bulkPeriodicExpenseGroup');
            periodicGroup.style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) {
                document.getElementById('bulkPeriodicExpenseName').value = '';
            }
        });

        // Initialize autocomplete for bulk periodic expense
        const bulkPeriodicInput = document.getElementById('bulkPeriodicExpenseName');
        new Autocomplete(bulkPeriodicInput, {
            endpoint: '/api/periodic-expenses',
            displayField: 'name',
            onSelect: (periodic) => {
                // Optional: do something on select
            },
            createData: (value) => ({
                name: value
            })
        });
    }

    addBulkTag(tagName) {
        if (!tagName || this.bulkTags.includes(tagName)) return;
        this.bulkTags.push(tagName);
        this.renderBulkTags();
    }

    removeBulkTag(tagName) {
        this.bulkTags = this.bulkTags.filter(tag => tag !== tagName);
        this.renderBulkTags();
    }

    renderBulkTags() {
        const container = document.getElementById('bulkTagsContainer');
        container.innerHTML = this.bulkTags.map(tag => `
            <div class="tag-item">
                #${tag}
                <button type="button" class="tag-remove" onclick="queueProcessor.removeBulkTag('${tag}')">×</button>
            </div>
        `).join('');
    }

    handleModalClick(event) {
        // Close modal if clicking on overlay
        if (event.target.id === 'bulkModal') {
            this.closeBulkSaveModal();
        } else if (event.target.id === 'toolsModal') {
            this.closeToolsModal();
        } else if (event.target.id === 'rulesModal') {
            this.closeRulesModal();
        } else if (event.target.id === 'createRuleModal') {
            this.closeCreateRuleModal();
        }
    }

    closeBulkSaveModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        this.viewMode = 'list';
        this.bulkTags = [];
    }

    // Tools Modal
    openToolsModal() {
        this.viewMode = 'tools';

        const modalHtml = `
            <div class="modal-overlay" id="toolsModal" onclick="queueProcessor.handleModalClick(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Tools</h2>
                        <button class="modal-close" onclick="queueProcessor.closeToolsModal()">&times;</button>
                    </div>

                    <div class="modal-body">
                        <div class="tools-options">
                            <button class="btn btn-primary btn-large" onclick="queueProcessor.applyAllRules()">
                                Apply All Active Rules
                                <div class="tool-description">Automatically process queue items using active rules</div>
                            </button>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeToolsModal()">
                            Close <kbd>Esc</kbd>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
    }

    closeToolsModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        this.viewMode = this.viewMode === 'tools' ? 'list' : this.viewMode;
    }

    async applyAllRules() {
        try {
            const response = await fetch('/api/queue/apply-rules', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Rules applied successfully!\n\nProcessed: ${result.processed}\nSaved: ${result.saved}\nDiscarded: ${result.discarded}`);
                this.closeToolsModal();
                await this.loadAllItems();
                await this.updateQueueCount();
            } else {
                alert('Error applying rules: ' + result.detail);
            }
        } catch (error) {
            console.error('Error applying rules:', error);
            alert('Error applying rules: ' + error.message);
        }
    }

    // Rules Modal
    async openRulesModal() {
        this.viewMode = 'rules';

        try {
            const response = await fetch('/api/rules');
            const rules = await response.json();

            const modalHtml = `
                <div class="modal-overlay" id="rulesModal" onclick="queueProcessor.handleModalClick(event)">
                    <div class="modal-content large-modal" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h2>Rules Management</h2>
                            <button class="modal-close" onclick="queueProcessor.closeRulesModal()">&times;</button>
                        </div>

                        <div class="modal-body">
                            <div class="rules-header">
                                <button class="btn btn-primary" onclick="queueProcessor.openCreateRuleModal()">
                                    Create New Rule
                                </button>
                            </div>

                            <div class="rules-list" id="rulesList">
                                ${this.renderRulesList(rules)}
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeRulesModal()">
                                Close <kbd>Esc</kbd>
                            </button>
                        </div>
                    </div>
                </div>
            `;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Setup periodic expense toggle for rules
        const saveIsPeriodic = document.getElementById('saveIsPeriodic');
        if (saveIsPeriodic) {
            saveIsPeriodic.addEventListener('change', (e) => {
                const periodicGroup = document.getElementById('savePeriodicExpenseGroup');
                periodicGroup.style.display = e.target.checked ? 'block' : 'none';
                if (!e.target.checked) {
                    document.getElementById('savePeriodicExpenseName').value = '';
                }
            });
        }

        // Initialize autocomplete for save periodic expense
        const savePeriodicInput = document.getElementById('savePeriodicExpenseName');
        if (savePeriodicInput) {
            new Autocomplete(savePeriodicInput, {
                endpoint: '/api/periodic-expenses',
                displayField: 'name',
                onSelect: (periodic) => {
                    // Optional: do something on select
                },
                createData: (value) => ({
                    name: value
                })
            });
        }

        } catch (error) {
            console.error('Error loading rules:', error);
            alert('Error loading rules: ' + error.message);
        }
    }

    renderRulesList(rules) {
        if (rules.length === 0) {
            return '<div class="no-rules">No rules created yet. Click "Create New Rule" to get started.</div>';
        }

        return rules.map(rule => `
            <div class="rule-item ${rule.active ? 'active' : 'inactive'}">
                <div class="rule-header">
                    <div class="rule-name">${rule.name}</div>
                    <div class="rule-actions">
                        <label class="switch">
                            <input type="checkbox" ${rule.active ? 'checked' : ''} onchange="queueProcessor.toggleRule(${rule.id}, this.checked)">
                            <span class="slider"></span>
                        </label>
                        <button class="btn btn-small btn-danger" onclick="queueProcessor.deleteRule(${rule.id})">Delete</button>
                    </div>
                </div>
                <div class="rule-details">
                    <div class="rule-condition">
                        <strong>Field:</strong> ${rule.field} |
                        <strong>Match:</strong> ${rule.match_type} "${rule.match_value}"
                    </div>
                    <div class="rule-action">
                        <strong>Action:</strong> ${rule.action}
                        ${rule.action === 'save' ? this.renderSaveDetails(rule.save_data) : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderSaveDetails(saveData) {
        return `
            <div class="save-details">
                <div><strong>Merchant:</strong> ${saveData.merchant_name}</div>
                <div><strong>Category ID:</strong> ${saveData.category_id}</div>
                ${saveData.description ? `<div><strong>Description:</strong> ${saveData.description}</div>` : ''}
                ${saveData.tags && saveData.tags.length > 0 ? `<div><strong>Tags:</strong> ${saveData.tags.join(', ')}</div>` : ''}
                ${saveData.periodic_expense_name ? `<div><strong>Periodic Expense:</strong> ${saveData.periodic_expense_name}</div>` : ''}
            </div>
        `;
    }

    closeRulesModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        this.viewMode = this.viewMode === 'rules' ? 'list' : this.viewMode;
    }

    async toggleRule(ruleId, active) {
        try {
            const response = await fetch(`/api/rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: active })
            });

            if (!response.ok) {
                const error = await response.json();
                alert('Error updating rule: ' + error.detail);
                // Revert checkbox
                event.target.checked = !active;
            }
        } catch (error) {
            console.error('Error updating rule:', error);
            alert('Error updating rule: ' + error.message);
            // Revert checkbox
            event.target.checked = !active;
        }
    }

    async deleteRule(ruleId) {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            const response = await fetch(`/api/rules/${ruleId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.openRulesModal(); // Refresh the modal
            } else {
                const error = await response.json();
                alert('Error deleting rule: ' + error.detail);
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            alert('Error deleting rule: ' + error.message);
        }
    }

    openCreateRuleModal() {
        // Close current modal and open create rule modal
        this.closeRulesModal();
        this.openCreateRuleForm();
    }

    openCreateRuleForm() {
        this.viewMode = 'create-rule';

        const modalHtml = `
            <div class="modal-overlay" id="createRuleModal" onclick="queueProcessor.handleModalClick(event)">
                <div class="modal-content large-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Create New Rule</h2>
                        <button class="modal-close" onclick="queueProcessor.closeCreateRuleModal()">&times;</button>
                    </div>

                    <div class="modal-body">
                        <form id="createRuleForm" onsubmit="queueProcessor.createRule(event)">
                            <div class="form-group">
                                <label for="ruleName">Rule Name</label>
                                <input type="text" id="ruleName" required placeholder="e.g., Discard Amazon subscriptions">
                            </div>

                            <div class="form-group">
                                <label for="ruleField">Field to Match</label>
                                <select id="ruleField" required>
                                    <option value="">Select field</option>
                                    <option value="raw_merchant_name">Merchant Name</option>
                                    <option value="raw_description">Description</option>
                                    <option value="amount">Amount</option>
                                    <option value="currency">Currency</option>
                                    <option value="source">Source</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="matchType">Match Type</label>
                                <select id="matchType" required>
                                    <option value="exact">Exact Match</option>
                                    <option value="regex">Regular Expression</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="matchValue">Match Value</label>
                                <input type="text" id="matchValue" required placeholder="Value to match against">
                            </div>

                            <div class="form-group">
                                <label for="ruleAction">Action</label>
                                <select id="ruleAction" required onchange="queueProcessor.toggleSaveFields(this.value)">
                                    <option value="discard">Discard</option>
                                    <option value="save">Save</option>
                                </select>
                            </div>

                             <div id="saveFields" style="display: none;">
                                 <div class="form-group">
                                     <label for="saveMerchant">Merchant Name</label>
                                     <input type="text" id="saveMerchant" placeholder="Merchant alias for saved expenses">
                                 </div>

                                 <div class="form-group">
                                     <label for="saveCategory">Category</label>
                                     <select id="saveCategory">
                                         <option value="">Select category</option>
                                         ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                                     </select>
                                 </div>

                                 <div class="form-group">
                                     <label for="saveDescription">Description (optional)</label>
                                     <input type="text" id="saveDescription" placeholder="Description for saved expenses">
                                 </div>

                                 <div class="form-group">
                                     <label for="saveTags">Tags (optional)</label>
                                     <input type="text" id="saveTags" placeholder="Comma-separated tags">
                                 </div>

                                 <div class="form-group">
                                     <label class="switch-label">
                                         Periodic expense
                                         <label class="switch">
                                             <input type="checkbox" id="saveIsPeriodic">
                                             <span class="slider"></span>
                                         </label>
                                     </label>
                                 </div>

                                 <div class="form-group" id="savePeriodicExpenseGroup" style="display: none;">
                                     <label for="savePeriodicExpenseName">Periodic Expense Name</label>
                                     <input type="text" id="savePeriodicExpenseName" placeholder="Start typing to see suggestions..." autocomplete="off">
                                 </div>
                             </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeCreateRuleModal()">
                            Cancel <kbd>Esc</kbd>
                        </button>
                        <button type="submit" form="createRuleForm" class="btn btn-primary">
                            Create Rule
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
    }

    toggleSaveFields(action) {
        const saveFields = document.getElementById('saveFields');
        const saveMerchant = document.getElementById('saveMerchant');
        const saveCategory = document.getElementById('saveCategory');

        if (action === 'save') {
            saveFields.style.display = 'block';
            saveMerchant.required = true;
            saveCategory.required = true;
        } else {
            saveFields.style.display = 'none';
            saveMerchant.required = false;
            saveCategory.required = false;
        }
    }

    closeCreateRuleModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        this.viewMode = this.viewMode === 'create-rule' ? 'list' : this.viewMode;
    }

    async createRule(event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById('ruleName').value,
            field: document.getElementById('ruleField').value,
            match_type: document.getElementById('matchType').value,
            match_value: document.getElementById('matchValue').value,
            action: document.getElementById('ruleAction').value
        };

        if (formData.action === 'save') {
            const tags = document.getElementById('saveTags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag);

            formData.save_data = {
                merchant_name: document.getElementById('saveMerchant').value,
                category_id: parseInt(document.getElementById('saveCategory').value),
                description: document.getElementById('saveDescription').value,
                tags: tags,
                periodic_expense_name: document.getElementById('saveIsPeriodic').checked ? document.getElementById('savePeriodicExpenseName').value : null
            };
        }

        try {
            const response = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.closeCreateRuleModal();
                this.openRulesModal(); // Re-open rules modal to show the new rule
            } else {
                const error = await response.json();
                alert('Error creating rule: ' + error.detail);
            }
        } catch (error) {
            console.error('Error creating rule:', error);
            alert('Error creating rule: ' + error.message);
        }
    }

    async processBulkSave(event) {
        event.preventDefault();
        
        const merchantName = document.getElementById('bulkMerchantName').value;
        const categoryId = parseInt(document.getElementById('bulkCategorySelect').value);
        const description = document.getElementById('bulkDescription').value;
        const periodicExpenseName = document.getElementById('bulkIsPeriodic').checked ? document.getElementById('bulkPeriodicExpenseName').value : null;
        
        if (!merchantName || !categoryId) {
            alert('Please fill in merchant name and category');
            return;
        }
        
        const idsToProcess = Array.from(this.selectedIds);
        let successCount = 0;
        let errorCount = 0;
        
        // Disable the save button
        const saveBtn = document.getElementById('bulkSaveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        for (const id of idsToProcess) {
            const formData = {
                raw_expense_id: id,
                merchant_name: merchantName,
                category_id: categoryId,
                description: description,
                tags: this.bulkTags,
                periodic_expense_name: periodicExpenseName
            };

            try {
                const response = await fetch('/api/queue/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to process item ${id}`);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error processing item ${id}:`, error);
            }
        }
        
        // Close modal
        this.closeBulkSaveModal();
        
        // Remove processed items from queue
        this.queueItems = this.queueItems.filter(item => !this.selectedIds.has(item.id));
        this.selectedIds.clear();
        
        // Adjust index if needed
        if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
            this.selectedIndex = this.queueItems.length - 1;
        }
        
        await this.updateQueueCount();
        
        // Show result
        if (errorCount > 0) {
            alert(`Saved ${successCount} items. ${errorCount} items failed.`);
        }
        
        if (this.queueItems.length === 0) {
            this.renderEmptyQueue();
        } else {
            this.renderListView();
        }
    }

    async suggestMerchant() {
        if (!this.currentItem?.raw_merchant_name) return;

        try {
            const response = await fetch(`/api/merchants/suggest?raw_name=${encodeURIComponent(this.currentItem.raw_merchant_name)}`);
            const suggestion = await response.json();

            if (suggestion.suggestion) {
                // Pre-fill the merchant input with the suggestion
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
                <div class="form-group">
                    <label for="merchantName">Merchant Alias</label>
                    <input type="text" id="merchantName" placeholder="Start typing to see suggestions..." required>
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
                    <input type="text" id="tagInput" placeholder="Start typing to see existing tags..." autocomplete="off">
                    <div class="tags-input" id="tagsContainer">
                        <!-- Tags will be added here -->
                    </div>
                </div>

                <div class="form-group">
                    <label class="switch-label">
                        Periodic expense
                        <label class="switch">
                            <input type="checkbox" id="isPeriodic">
                            <span class="slider"></span>
                        </label>
                    </label>
                </div>

                <div class="form-group" id="periodicExpenseGroup" style="display: none;">
                    <label for="periodicExpenseName">Periodic Expense Name</label>
                    <input type="text" id="periodicExpenseName" placeholder="Start typing to see suggestions..." autocomplete="off">
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-danger" onclick="queueProcessor.discardItem()">
                        Discard <kbd>X</kbd>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.goToPrevious()" ${this.selectedIndex === 0 ? 'disabled' : ''}>
                        ← Previous <kbd>P</kbd>
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="queueProcessor.goToNext()" ${this.selectedIndex >= this.queueItems.length - 1 ? 'disabled' : ''}>
                        Next → <kbd>N</kbd>
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

        // Initialize autocomplete for merchant
        const merchantInput = document.getElementById('merchantName');
        this.merchantAutocomplete = new Autocomplete(merchantInput, {
            endpoint: '/api/merchants',
            displayField: 'display_name',
            onSelect: (merchant) => {
                // Set default category if available
                if (merchant.default_category_id) {
                    document.getElementById('categorySelect').value = merchant.default_category_id;
                }
            },
            createData: (value) => ({
                raw_name: this.currentItem?.raw_merchant_name || value,
                display_name: value
            })
        });

        // Initialize autocomplete for tags
        const tagInput = document.getElementById('tagInput');
        new Autocomplete(tagInput, {
            endpoint: '/api/tags',
            displayField: 'name',
            onSelect: (tag) => {
                this.addTag(tag.name);
                tagInput.value = '';
            },
            onCreate: (tag) => {
                this.addTag(tag.name);
                tagInput.value = '';
            },
            createData: (value) => ({
                name: value
            })
        });

        // Tag input enter key (fallback)
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = tagInput.value.trim();
                if (value) {
                    this.addTag(value);
                    tagInput.value = '';
                }
            }
        });

        // Periodic expense checkbox toggle
        document.getElementById('isPeriodic').addEventListener('change', (e) => {
            const periodicGroup = document.getElementById('periodicExpenseGroup');
            periodicGroup.style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) {
                document.getElementById('periodicExpenseName').value = '';
            }
        });

        // Initialize autocomplete for periodic expense
        const periodicInput = document.getElementById('periodicExpenseName');
        new Autocomplete(periodicInput, {
            endpoint: '/api/periodic-expenses',
            displayField: 'name',
            onSelect: (periodic) => {
                // Optional: do something on select
            },
            createData: (value) => ({
                name: value
            })
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
            tags: this.currentTags,
            periodic_expense_name: document.getElementById('isPeriodic').checked ? document.getElementById('periodicExpenseName').value : null
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
