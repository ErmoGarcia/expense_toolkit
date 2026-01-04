// Queue Processing JavaScript

class Autocomplete {
    constructor(input, options) {
        this.input = input;
        this.options = options;
        this.suggestions = [];
        this.selectedIndex = -1;
        this.container = null;
        this.onSelect = options.onSelect || (() => { });
        this.onCreate = options.onCreate || (() => { });
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
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
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
            const em = document.createElement('em');
            em.textContent = `Create "${query}"`;
            div.appendChild(em);
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
        this.selectedIds = new Set();
        this.categories = [];
        this.viewMode = 'list'; // 'list', 'merge'
        this.mergeTags = [];
        this.duplicates = {};
        this.duplicateModalItems = [];
        this.duplicateModalFocusIndex = 0;
        this.duplicateModalKeyHandler = null;

        // Update mode state
        this.updateMode = false;
        this.categoryTypeCache = {};
        this.currentModalTags = [];

        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadAllItems();
        await this.updateQueueCount();
        await this.detectDuplicates();
        if (this.queueItems.length > 0) {
            this.renderListView();
        }
        this.setupKeyboardNavigation();
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.categories = await response.json();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = [];
        }
    }

    getFilteredCategories(amount) {
        const categoryType = parseFloat(amount) >= 0 ? 'income' : 'expense';
        return this.categories.filter(cat =>
            cat.category_type === categoryType || !cat.category_type
        );
    }

    getBulkCategories(items) {
        const hasNegative = items.some(item => parseFloat(item.amount) < 0);
        const hasPositive = items.some(item => parseFloat(item.amount) >= 0);

        if (hasNegative && hasPositive) {
            return this.categories;
        } else if (hasPositive) {
            return this.categories.filter(cat =>
                cat.category_type === 'income' || !cat.category_type
            );
        } else {
            return this.categories.filter(cat =>
                cat.category_type === 'expense' || !cat.category_type
            );
        }
    }

    buildCategoryOptionsHtml(categories) {
        const parents = categories.filter(cat => !cat.parent_id);
        const children = categories.filter(cat => cat.parent_id);

        let html = '';

        parents.forEach(parent => {
            html += `<option value="${parent.id}">${escapeHtml(parent.name)}</option>`;

            const parentChildren = children.filter(child => child.parent_id === parent.id);
            parentChildren.forEach(child => {
                html += `<option value="${child.id}">&nbsp;&nbsp;↳ ${escapeHtml(child.name)}</option>`;
            });
        });

        const orphans = children.filter(child => !parents.find(p => p.id === child.parent_id));
        orphans.forEach(orphan => {
            html += `<option value="${orphan.id}">${escapeHtml(orphan.name)}</option>`;
        });

        return html;
    }

    async loadAllItems() {
        try {
            const response = await fetch('/api/queue/all');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
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
            // Escape handling
            if (e.key === 'Escape') {
                e.preventDefault();

                if (document.getElementById('updateModal')) {
                    this.closeUpdateModal();
                } else if (this.viewMode === 'merge') {
                    this.closeMergeModal();
                } else if (document.getElementById('duplicateModal')) {
                    this.closeDuplicateModal();
                } else if (this.viewMode === 'list') {
                    // If there are selected items, clear them first (stay in update mode if active)
                    if (this.selectedIds.size > 0) {
                        this.clearSelection();
                    }
                    // If no items selected and in update mode, exit update mode
                    else if (this.updateMode) {
                        this.exitUpdateMode();
                    }
                }
                return;
            }

            // Ignore other keys if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // Ignore other keys if an update modal is open (except Escape, which is handled above)
            if (document.getElementById('updateModal')) {
                return;
            }

            if (this.viewMode === 'list') {
                this.handleListKeyboard(e);
            } else if (this.viewMode === 'merge') {
                this.handleMergeModalKeyboard(e);
            }
        });
    }

    handleListKeyboard(e) {
        // Update mode toggle - available even with no items or selection
        if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            this.toggleUpdateMode();
            return;
        }

        // Navigation requires items
        if (this.queueItems.length === 0) {
            return;
        }

        // Navigation - always available
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Down: Jump to last item
                this.selectedIndex = this.queueItems.length - 1;
                this.updateListUI();
                this.scrollToFocused();
            } else if (e.shiftKey) {
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
                this.moveSelection(1);
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
            } else {
                this.moveSelection(1);
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Up: Jump to first item
                this.selectedIndex = 0;
                this.updateListUI();
                this.scrollToFocused();
            } else if (e.shiftKey) {
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
                this.moveSelection(-1);
                this.toggleSelection(this.queueItems[this.selectedIndex].id, true);
            } else {
                this.moveSelection(-1);
            }
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Space: Select all
                this.toggleSelectAll(true);
            } else {
                // Regular Space: Toggle current item
                this.toggleSelection(this.queueItems[this.selectedIndex].id);
            }
            return;
        }

        // Update mode shortcuts
        if (this.updateMode) {
            if (e.key === 'c') {
                e.preventDefault();
                this.openCategoryModal();
                return;
            }
            if (e.key === 'm') {
                e.preventDefault();
                this.openMerchantModal();
                return;
            }
            if (e.key === 't') {
                e.preventDefault();
                this.openTagsModal();
                return;
            }
            if (e.key === 'e') {
                e.preventDefault();
                this.openTypeModal();
                return;
            }
            if (e.key === 'd') {
                e.preventDefault();
                this.openDescriptionModal();
                return;
            }
            return; // Don't process other keys in update mode
        }

        // Save action - works on focused item or selected items
        if (e.key === 's') {
            e.preventDefault();
            this.bulkSaveSelected();
            return;
        }

        // Discard action - works on focused item or selected items
        if (e.key === 'x') {
            e.preventDefault();
            this.discardSelected();
            return;
        }

        // Other bulk actions (require selection, not in update mode)
        if (this.selectedIds.size > 0) {
            if (e.key === 'a') {
                e.preventDefault();
                this.archiveSelected();
                return;
            }
            if (e.key === 'm' && this.selectedIds.size > 1) {
                e.preventDefault();
                this.openMergeModal();
                return;
            }
        }
    }

    handleMergeModalKeyboard(e) {
        // Escape is handled in setupKeyboardNavigation
    }

    // ==================== UPDATE MODE ====================

    toggleUpdateMode() {
        this.updateMode = !this.updateMode;
        this.renderListView();
    }

    exitUpdateMode() {
        this.updateMode = false;
        this.renderListView();
    }

    getTargetItems() {
        if (this.selectedIds.size > 0) {
            return this.queueItems.filter(item => this.selectedIds.has(item.id));
        }
        return [this.queueItems[this.selectedIndex]];
    }

    async updateRawExpense(id, updates) {
        try {
            const response = await fetch(`/api/queue/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update');
            }

            // Update local item
            const index = this.queueItems.findIndex(item => item.id === id);
            if (index !== -1) {
                Object.assign(this.queueItems[index], updates);

                // Update category object if category_id changed
                if (updates.category_id) {
                    const cat = this.categories.find(c => c.id === updates.category_id);
                    this.queueItems[index].category = cat ? { id: cat.id, name: cat.name } : null;
                }
            }

            return true;
        } catch (error) {
            console.error('Error updating raw expense:', error);
            alert('Error updating: ' + error.message);
            return false;
        }
    }

    async getTypeForCategory(categoryId) {
        if (this.categoryTypeCache[categoryId]) {
            return this.categoryTypeCache[categoryId];
        }

        try {
            const response = await fetch(`/api/queue/category-type/${categoryId}`);
            if (response.ok) {
                const data = await response.json();
                this.categoryTypeCache[categoryId] = data.type;
                return data.type;
            }
        } catch (error) {
            console.error('Error getting category type:', error);
        }

        return 'discretionary';
    }

    // ==================== UPDATE MODE MODALS ====================

    openCategoryModal() {
        const targets = this.getTargetItems();
        const firstItem = targets[0];
        const currentCategoryId = firstItem.category_id || firstItem.suggested_category_id || '';
        this.allCategories = this.getBulkCategories(targets);
        this.filteredCategoryList = [...this.allCategories];
        this.categoryModalFocusIndex = 0;

        // Find initial focus index
        if (currentCategoryId) {
            const idx = this.filteredCategoryList.findIndex(cat => cat.id === currentCategoryId);
            if (idx >= 0) this.categoryModalFocusIndex = idx;
        }

        const modalHtml = `
            <div class="modal-overlay" id="updateModal" onclick="queueProcessor.closeUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Update Category${targets.length > 1 ? ` (${targets.length} items)` : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeUpdateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="categorySearchInput">Search Categories</label>
                            <input type="text" id="categorySearchInput" placeholder="Type to filter..." autofocus>
                        </div>
                        <div class="category-list-container" id="categoryListContainer">
                            ${this.renderCategoryList()}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">↑↓ Navigate</span>
                            <span class="keyboard-hint">Enter Select</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const searchInput = document.getElementById('categorySearchInput');
        searchInput.addEventListener('input', (e) => this.filterCategories(e.target.value));
        searchInput.addEventListener('keydown', (e) => this.handleCategoryModalKeyboard(e));

        searchInput.focus();
    }

    renderCategoryList() {
        if (this.filteredCategoryList.length === 0) {
            return '<div class="empty-message">No categories found</div>';
        }

        const parents = this.filteredCategoryList.filter(cat => !cat.parent_id);
        const children = this.filteredCategoryList.filter(cat => cat.parent_id);

        let html = '<div class="selectable-list" id="categorySelectableList">';
        let index = 0;

        parents.forEach(parent => {
            const isFocused = index === this.categoryModalFocusIndex;
            html += `
                <div class="selectable-item ${isFocused ? 'focused' : ''}" data-index="${index}" data-category-id="${parent.id}" onclick="queueProcessor.selectCategoryFromList(${parent.id})">
                    ${escapeHtml(parent.name)}
                </div>
            `;
            index++;

            const parentChildren = children.filter(child => child.parent_id === parent.id);
            parentChildren.forEach(child => {
                const isFocused = index === this.categoryModalFocusIndex;
                html += `
                    <div class="selectable-item selectable-item-child ${isFocused ? 'focused' : ''}" data-index="${index}" data-category-id="${child.id}" onclick="queueProcessor.selectCategoryFromList(${child.id})">
                        ↳ ${escapeHtml(child.name)}
                    </div>
                `;
                index++;
            });
        });

        const orphans = children.filter(child => !parents.find(p => p.id === child.parent_id));
        orphans.forEach(orphan => {
            const isFocused = index === this.categoryModalFocusIndex;
            html += `
                <div class="selectable-item ${isFocused ? 'focused' : ''}" data-index="${index}" data-category-id="${orphan.id}" onclick="queueProcessor.selectCategoryFromList(${orphan.id})">
                    ${escapeHtml(orphan.name)}
                </div>
            `;
            index++;
        });

        html += '</div>';
        return html;
    }

    filterCategories(query) {
        if (!query.trim()) {
            this.filteredCategoryList = [...this.allCategories];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredCategoryList = this.allCategories.filter(cat =>
                cat.name.toLowerCase().includes(lowerQuery)
            );
        }
        this.categoryModalFocusIndex = 0;
        document.getElementById('categoryListContainer').innerHTML = this.renderCategoryList();
    }

    handleCategoryModalKeyboard(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.categoryModalFocusIndex < this.filteredCategoryList.length - 1) {
                this.categoryModalFocusIndex++;
                this.updateCategoryListUI();
                this.scrollToFocusedCategory();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.categoryModalFocusIndex > 0) {
                this.categoryModalFocusIndex--;
                this.updateCategoryListUI();
                this.scrollToFocusedCategory();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.filteredCategoryList.length > 0) {
                const category = this.filteredCategoryList[this.categoryModalFocusIndex];
                this.selectCategoryFromList(category.id);
            }
        }
    }

    updateCategoryListUI() {
        const items = document.querySelectorAll('#categorySelectableList .selectable-item');
        items.forEach((item, idx) => {
            item.classList.toggle('focused', idx === this.categoryModalFocusIndex);
        });
    }

    scrollToFocusedCategory() {
        const focused = document.querySelector('#categorySelectableList .selectable-item.focused');
        if (focused) {
            focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    async selectCategoryFromList(categoryId) {
        const targets = this.getTargetItems();
        const type = await this.getTypeForCategory(categoryId);

        for (const item of targets) {
            await this.updateRawExpense(item.id, {
                category_id: categoryId,
                type: type
            });
        }

        this.closeUpdateModal();
        this.renderListView();
    }

    async openMerchantModal() {
        const targets = this.getTargetItems();
        const firstItem = targets[0];
        const currentMerchant = firstItem.merchant_alias?.display_name ||
            firstItem.suggested_merchant_alias?.display_name ||
            firstItem.raw_merchant_name || '';

        // Fetch all merchants
        try {
            const response = await fetch('/api/merchants');
            this.allMerchants = await response.json();
        } catch (error) {
            console.error('Error loading merchants:', error);
            this.allMerchants = [];
        }

        this.filteredMerchantList = [...this.allMerchants];
        this.merchantModalFocusIndex = 0;
        this.merchantSearchQuery = '';

        const modalHtml = `
            <div class="modal-overlay" id="updateModal" onclick="queueProcessor.closeUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Update Merchant${targets.length > 1 ? ` (${targets.length} items)` : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeUpdateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="merchantSearchInput">Search Merchants</label>
                            <input type="text" id="merchantSearchInput" placeholder="Type to filter or create..." autofocus value="${escapeHtml(currentMerchant)}">
                        </div>
                        <div class="category-list-container" id="merchantListContainer">
                            ${this.renderMerchantList()}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">↑↓ Navigate</span>
                            <span class="keyboard-hint">Enter Select</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const searchInput = document.getElementById('merchantSearchInput');
        searchInput.addEventListener('input', (e) => this.filterMerchants(e.target.value));
        searchInput.addEventListener('keydown', (e) => this.handleMerchantModalKeyboard(e));

        // Initial filter if there's a current value
        if (currentMerchant) {
            this.filterMerchants(currentMerchant);
        }

        searchInput.focus();

        // Move cursor to end
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }

    renderMerchantList() {
        const query = this.merchantSearchQuery.trim();

        let html = '<div class="selectable-list" id="merchantSelectableList">';

        // Render filtered merchants
        this.filteredMerchantList.forEach((merchant, index) => {
            const isFocused = index === this.merchantModalFocusIndex;
            html += `
                <div class="selectable-item ${isFocused ? 'focused' : ''}" data-index="${index}" data-merchant-id="${merchant.id}" onclick="queueProcessor.selectMerchantFromList(${merchant.id}, false)">
                    ${escapeHtml(merchant.display_name)}
                </div>
            `;
        });

        // Add "Create new" option if query doesn't match exactly
        if (query && !this.filteredMerchantList.some(m => m.display_name.toLowerCase() === query.toLowerCase())) {
            const createIndex = this.filteredMerchantList.length;
            const isFocused = createIndex === this.merchantModalFocusIndex;
            html += `
                <div class="selectable-item selectable-item-create ${isFocused ? 'focused' : ''}" data-index="${createIndex}" onclick="queueProcessor.selectMerchantFromList(null, true)">
                    <em>Create "${escapeHtml(query)}"</em>
                </div>
            `;
        }

        html += '</div>';

        if (this.filteredMerchantList.length === 0 && !query) {
            return '<div class="empty-message">No merchants found</div>';
        }

        return html;
    }

    filterMerchants(query) {
        this.merchantSearchQuery = query;

        if (!query.trim()) {
            this.filteredMerchantList = [...this.allMerchants];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredMerchantList = this.allMerchants.filter(merchant =>
                merchant.display_name.toLowerCase().includes(lowerQuery)
            );
        }
        this.merchantModalFocusIndex = 0;
        document.getElementById('merchantListContainer').innerHTML = this.renderMerchantList();
    }

    handleMerchantModalKeyboard(e) {
        const query = this.merchantSearchQuery.trim();
        const hasCreateOption = query && !this.filteredMerchantList.some(m => m.display_name.toLowerCase() === query.toLowerCase());
        const totalItems = this.filteredMerchantList.length + (hasCreateOption ? 1 : 0);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.merchantModalFocusIndex < totalItems - 1) {
                this.merchantModalFocusIndex++;
                this.updateMerchantListUI();
                this.scrollToFocusedMerchant();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.merchantModalFocusIndex > 0) {
                this.merchantModalFocusIndex--;
                this.updateMerchantListUI();
                this.scrollToFocusedMerchant();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const isCreateOption = this.merchantModalFocusIndex === this.filteredMerchantList.length;
            if (isCreateOption) {
                this.selectMerchantFromList(null, true);
            } else if (this.filteredMerchantList.length > 0) {
                const merchant = this.filteredMerchantList[this.merchantModalFocusIndex];
                this.selectMerchantFromList(merchant.id, false);
            }
        }
    }

    updateMerchantListUI() {
        const items = document.querySelectorAll('#merchantSelectableList .selectable-item');
        items.forEach((item, idx) => {
            item.classList.toggle('focused', idx === this.merchantModalFocusIndex);
        });
    }

    scrollToFocusedMerchant() {
        const focused = document.querySelector('#merchantSelectableList .selectable-item.focused');
        if (focused) {
            focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    async selectMerchantFromList(merchantId, isCreate) {
        const targets = this.getTargetItems();
        let finalMerchantId = merchantId;
        let merchantName = '';

        if (isCreate) {
            // Create new merchant
            merchantName = this.merchantSearchQuery.trim();
            try {
                const response = await fetch('/api/merchants', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        raw_name: targets[0].raw_merchant_name || merchantName,
                        display_name: merchantName
                    })
                });
                if (response.ok) {
                    const merchant = await response.json();
                    finalMerchantId = merchant.id;
                } else {
                    throw new Error('Failed to create merchant');
                }
            } catch (error) {
                alert('Error creating merchant: ' + error.message);
                return;
            }
        } else {
            const merchant = this.allMerchants.find(m => m.id === merchantId);
            merchantName = merchant ? merchant.display_name : '';
        }

        for (const item of targets) {
            await this.updateRawExpense(item.id, { merchant_alias_id: finalMerchantId });
            item.merchant_alias = { id: finalMerchantId, display_name: merchantName };
        }

        this.closeUpdateModal();
        this.renderListView();
    }

    async openTagsModal() {
        const targets = this.getTargetItems();
        const firstItem = targets[0];
        this.currentModalTags = [...(firstItem.tags || [])];

        // Fetch all tags
        try {
            const response = await fetch('/api/tags');
            this.allTags = await response.json();
        } catch (error) {
            console.error('Error loading tags:', error);
            this.allTags = [];
        }

        this.filteredTagList = [...this.allTags];
        this.tagModalFocusIndex = 0;
        this.tagSearchQuery = '';

        const modalHtml = `
            <div class="modal-overlay" id="updateModal" onclick="queueProcessor.closeUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Update Tags${targets.length > 1 ? ` (${targets.length} items)` : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeUpdateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="tagSearchInput">Search Tags</label>
                            <input type="text" id="tagSearchInput" placeholder="Type to filter or create..." autofocus>
                        </div>
                        <div class="tags-input" id="modalTagsContainer">
                            ${this.renderModalTags()}
                        </div>
                        <div class="category-list-container" id="tagListContainer">
                            ${this.renderTagList()}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">↑↓ Navigate</span>
                            <span class="keyboard-hint">Enter Add</span>
                            <span class="keyboard-hint">Ctrl+Enter Save</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const searchInput = document.getElementById('tagSearchInput');
        searchInput.addEventListener('input', (e) => this.filterTags(e.target.value));
        searchInput.addEventListener('keydown', (e) => this.handleTagModalKeyboard(e));

        searchInput.focus();
    }

    renderTagList() {
        const query = this.tagSearchQuery.trim();

        // Filter out already selected tags
        const availableTags = this.filteredTagList.filter(tag =>
            !this.currentModalTags.includes(tag.name)
        );

        let html = '<div class="selectable-list" id="tagSelectableList">';

        // Render filtered tags
        availableTags.forEach((tag, index) => {
            const isFocused = index === this.tagModalFocusIndex;
            html += `
                <div class="selectable-item ${isFocused ? 'focused' : ''}" data-index="${index}" onclick="queueProcessor.selectTagFromList('${escapeJs(tag.name)}', false)">
                    #${escapeHtml(tag.name)}
                </div>
            `;
        });

        // Add "Create new" option if query doesn't match exactly
        if (query && !this.allTags.some(t => t.name.toLowerCase() === query.toLowerCase())) {
            const createIndex = availableTags.length;
            const isFocused = createIndex === this.tagModalFocusIndex;
            html += `
                <div class="selectable-item selectable-item-create ${isFocused ? 'focused' : ''}" data-index="${createIndex}" onclick="queueProcessor.selectTagFromList('${escapeJs(query)}', true)">
                    <em>Create "#${escapeHtml(query)}"</em>
                </div>
            `;
        }

        html += '</div>';

        if (availableTags.length === 0 && !query) {
            return '<div class="empty-message">No more tags available</div>';
        }

        return html;
    }

    filterTags(query) {
        this.tagSearchQuery = query;

        if (!query.trim()) {
            this.filteredTagList = [...this.allTags];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredTagList = this.allTags.filter(tag =>
                tag.name.toLowerCase().includes(lowerQuery)
            );
        }
        this.tagModalFocusIndex = 0;
        document.getElementById('tagListContainer').innerHTML = this.renderTagList();
    }

    handleTagModalKeyboard(e) {
        const query = this.tagSearchQuery.trim();
        const availableTags = this.filteredTagList.filter(tag =>
            !this.currentModalTags.includes(tag.name)
        );
        const hasCreateOption = query && !this.allTags.some(t => t.name.toLowerCase() === query.toLowerCase());
        const totalItems = availableTags.length + (hasCreateOption ? 1 : 0);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.tagModalFocusIndex < totalItems - 1) {
                this.tagModalFocusIndex++;
                this.updateTagListUI();
                this.scrollToFocusedTag();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.tagModalFocusIndex > 0) {
                this.tagModalFocusIndex--;
                this.updateTagListUI();
                this.scrollToFocusedTag();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Ctrl+Enter or Cmd+Enter saves and closes
            if (e.ctrlKey || e.metaKey) {
                this.saveTagsUpdate();
                return;
            }
            // Regular Enter adds the tag
            const isCreateOption = this.tagModalFocusIndex === availableTags.length;
            if (isCreateOption) {
                this.selectTagFromList(query, true);
            } else if (availableTags.length > 0) {
                const tag = availableTags[this.tagModalFocusIndex];
                this.selectTagFromList(tag.name, false);
            }
        }
    }

    updateTagListUI() {
        const items = document.querySelectorAll('#tagSelectableList .selectable-item');
        items.forEach((item, idx) => {
            item.classList.toggle('focused', idx === this.tagModalFocusIndex);
        });
    }

    scrollToFocusedTag() {
        const focused = document.querySelector('#tagSelectableList .selectable-item.focused');
        if (focused) {
            focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    async selectTagFromList(tagName, isCreate) {
        if (isCreate) {
            // Create new tag
            try {
                const response = await fetch('/api/tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: tagName })
                });
                if (!response.ok) {
                    throw new Error('Failed to create tag');
                }
                // Add to allTags for future filtering
                const newTag = await response.json();
                this.allTags.push(newTag);
            } catch (error) {
                console.error('Error creating tag:', error);
            }
        }

        // Add tag to current selection
        this.addModalTag(tagName);

        // Clear search and reset filter
        const searchInput = document.getElementById('tagSearchInput');
        searchInput.value = '';
        this.filterTags('');
        searchInput.focus();
    }

    addModalTag(tagName) {
        if (!tagName || this.currentModalTags.includes(tagName)) return;
        this.currentModalTags.push(tagName);
        document.getElementById('modalTagsContainer').innerHTML = this.renderModalTags();
        // Re-render tag list to exclude newly added tag
        document.getElementById('tagListContainer').innerHTML = this.renderTagList();
    }

    removeModalTag(tagName) {
        this.currentModalTags = this.currentModalTags.filter(t => t !== tagName);
        document.getElementById('modalTagsContainer').innerHTML = this.renderModalTags();
        // Re-render tag list to include removed tag
        document.getElementById('tagListContainer').innerHTML = this.renderTagList();
    }

    renderModalTags() {
        if (this.currentModalTags.length === 0) {
            return '<div class="empty-message" style="padding: 0.5rem; font-size: 0.9rem; color: #6c757d;">No tags selected</div>';
        }
        return this.currentModalTags.map(tag => `
            <div class="tag-item">
                #${escapeHtml(tag)}
                <button type="button" class="tag-remove" onclick="queueProcessor.removeModalTag('${escapeJs(tag)}')">×</button>
            </div>
        `).join('');
    }

    async saveTagsUpdate() {
        const targets = this.getTargetItems();

        for (const item of targets) {
            await this.updateRawExpense(item.id, { tags: this.currentModalTags });
        }

        this.currentModalTags = [];
        this.closeUpdateModal();
        this.renderListView();
    }

    openTypeModal() {
        const targets = this.getTargetItems();
        const firstItem = targets[0];
        const currentType = firstItem.type || firstItem.suggested_type || 'discretionary';

        this.typeOptions = [
            { value: 'fixed', label: 'Fixed' },
            { value: 'necessary variable', label: 'Necessary Variable' },
            { value: 'discretionary', label: 'Discretionary' }
        ];

        this.typeModalFocusIndex = this.typeOptions.findIndex(opt => opt.value === currentType);
        if (this.typeModalFocusIndex < 0) this.typeModalFocusIndex = 2; // Default to discretionary

        const modalHtml = `
            <div class="modal-overlay" id="updateModal" onclick="queueProcessor.closeUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Update Type${targets.length > 1 ? ` (${targets.length} items)` : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeUpdateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="selectable-list" id="typeSelectableList">
                            ${this.renderTypeList()}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">↑↓ Navigate</span>
                            <span class="keyboard-hint">Enter Select</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.addEventListener('keydown', this.typeModalKeyHandler = (e) => this.handleTypeModalKeyboard(e));
    }

    renderTypeList() {
        return this.typeOptions.map((option, index) => {
            const isFocused = index === this.typeModalFocusIndex;
            const typeClass = option.value.replace(' ', '-');
            return `
                <div class="selectable-item selectable-item-type ${isFocused ? 'focused' : ''}" data-index="${index}" onclick="queueProcessor.selectTypeFromList('${option.value}')">
                    <span class="type-badge ${typeClass}">${escapeHtml(option.label)}</span>
                </div>
            `;
        }).join('');
    }

    handleTypeModalKeyboard(e) {
        if (!document.getElementById('updateModal')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (this.typeModalFocusIndex < this.typeOptions.length - 1) {
                this.typeModalFocusIndex++;
                this.updateTypeListUI();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (this.typeModalFocusIndex > 0) {
                this.typeModalFocusIndex--;
                this.updateTypeListUI();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const type = this.typeOptions[this.typeModalFocusIndex].value;
            this.selectTypeFromList(type);
        }
    }

    updateTypeListUI() {
        const items = document.querySelectorAll('#typeSelectableList .selectable-item');
        items.forEach((item, idx) => {
            item.classList.toggle('focused', idx === this.typeModalFocusIndex);
        });
    }

    async selectTypeFromList(type) {
        const targets = this.getTargetItems();

        for (const item of targets) {
            await this.updateRawExpense(item.id, { type: type });
        }

        if (this.typeModalKeyHandler) {
            document.removeEventListener('keydown', this.typeModalKeyHandler);
            this.typeModalKeyHandler = null;
        }

        this.closeUpdateModal();
        this.renderListView();
    }

    openDescriptionModal() {
        const targets = this.getTargetItems();
        const firstItem = targets[0];
        const currentDescription = firstItem.description || firstItem.raw_description || '';

        const modalHtml = `
            <div class="modal-overlay" id="updateModal" onclick="queueProcessor.closeUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Update Description${targets.length > 1 ? ` (${targets.length} items)` : ''}</h2>
                        <button class="modal-close" onclick="queueProcessor.closeUpdateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="updateDescriptionInput">Description</label>
                            <textarea id="updateDescriptionInput" rows="3" autofocus>${escapeHtml(currentDescription)}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">Ctrl+Enter Save</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const textarea = document.getElementById('updateDescriptionInput');
        textarea.focus();

        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // Add Ctrl+Enter handler
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveDescriptionUpdate();
            }
        });
    }

    async saveDescriptionUpdate() {
        const description = document.getElementById('updateDescriptionInput').value.trim();
        const targets = this.getTargetItems();

        for (const item of targets) {
            await this.updateRawExpense(item.id, { description: description });
        }

        this.closeUpdateModal();
        this.renderListView();
    }

    closeUpdateModal() {
        const modal = document.getElementById('updateModal');
        if (modal) modal.remove();

        // Clean up type modal keyboard handler
        if (this.typeModalKeyHandler) {
            document.removeEventListener('keydown', this.typeModalKeyHandler);
            this.typeModalKeyHandler = null;
        }
    }

    // ==================== SELECTION HANDLING ====================

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

    handleCheckboxClick(event, itemId, index) {
        event.stopPropagation();
        event.preventDefault();

        if (event.shiftKey && this.selectedIndex !== null) {
            const start = Math.min(this.selectedIndex, index);
            const end = Math.max(this.selectedIndex, index);
            for (let i = start; i <= end; i++) {
                this.selectedIds.add(this.queueItems[i].id);
            }
            this.selectedIndex = index;
            this.updateListUI();
        } else {
            this.selectedIndex = index;
            this.toggleSelection(itemId);
        }
    }

    clearSelection() {
        this.selectedIds.clear();
        this.updateListUI();
    }

    toggleSelectAll(checked) {
        if (checked) {
            this.queueItems.forEach(item => {
                this.selectedIds.add(item.id);
            });
        } else {
            this.selectedIds.clear();
        }
        this.updateListUI();
    }

    updateListUI() {
        document.querySelectorAll('.queue-list-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const itemId = this.queueItems[index].id;
            const isUpdateTarget = this.updateMode && (
                index === this.selectedIndex || this.selectedIds.has(itemId)
            );

            item.classList.toggle('focused', index === this.selectedIndex);
            item.classList.toggle('selected', this.selectedIds.has(itemId));
            item.classList.toggle('update-mode-active', isUpdateTarget);

            const checkbox = item.querySelector('.checkbox-indicator');
            if (checkbox) {
                checkbox.textContent = this.selectedIds.has(itemId) ? '✓' : '';
            }
        });

        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox && this.queueItems.length > 0) {
            const allSelected = this.queueItems.every(item => this.selectedIds.has(item.id));
            const someSelected = this.queueItems.some(item => this.selectedIds.has(item.id));

            selectAllCheckbox.checked = allSelected;
            selectAllCheckbox.indeterminate = someSelected && !allSelected;
        }

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

    handleItemClick(event, index) {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.selectedIndex = index;
            this.toggleSelection(this.queueItems[index].id);
        } else if (event.shiftKey) {
            event.preventDefault();
            const start = Math.min(this.selectedIndex, index);
            const end = Math.max(this.selectedIndex, index);
            for (let i = start; i <= end; i++) {
                this.selectedIds.add(this.queueItems[i].id);
            }
            this.selectedIndex = index;
            this.updateListUI();
        } else {
            // Regular click: just move focus (no detail view)
            this.selectedIndex = index;
            this.updateListUI();
        }
    }

    // ==================== LIST VIEW ====================

    renderListView() {
        this.viewMode = 'list';
        document.getElementById('queueStatus').textContent = `${this.queueItems.length} items to process`;

        const listHtml = this.queueItems.map((item, index) => {
            const hasDuplicate = this.duplicates[item.id];
            const isUpdateTarget = this.updateMode && (
                index === this.selectedIndex || this.selectedIds.has(item.id)
            );

            // Determine merchant display
            let merchantDisplay, merchantClass = '';
            if (item.merchant_alias_id && item.merchant_alias) {
                merchantDisplay = item.merchant_alias.display_name;
            } else if (item.suggested_merchant_alias) {
                merchantDisplay = item.suggested_merchant_alias.display_name;
                merchantClass = 'suggested-value';
            } else {
                merchantDisplay = item.raw_merchant_name || 'Unknown';
                merchantClass = 'missing-alias';
            }

            // Determine description
            const description = item.description || item.raw_description || '';

            // Determine category display
            let categoryDisplay = '', categoryClass = '';
            if (item.category_id && item.category) {
                categoryDisplay = item.category.name;
            } else if (item.suggested_category_id) {
                const cat = this.categories.find(c => c.id === item.suggested_category_id);
                categoryDisplay = cat ? cat.name : '';
                categoryClass = 'suggested-value';
            } else {
                categoryDisplay = '—';
                categoryClass = 'empty';
            }

            // Determine type display
            const typeValue = item.type || item.suggested_type || '';
            const typeClass = typeValue.replace(' ', '-');

            // Determine tags display
            const tags = item.tags && item.tags.length > 0 ? item.tags : [];

            return `
            <div class="queue-list-item ${index === this.selectedIndex ? 'focused' : ''} ${this.selectedIds.has(item.id) ? 'selected' : ''} ${isUpdateTarget ? 'update-mode-active' : ''}" 
                 data-index="${index}"
                 onclick="queueProcessor.handleItemClick(event, ${index})">
                <div class="queue-item-checkbox" onclick="queueProcessor.handleCheckboxClick(event, ${item.id}, ${index})">
                    <span class="checkbox-indicator">${this.selectedIds.has(item.id) ? '✓' : ''}</span>
                </div>
                <div class="queue-item-date">${escapeHtml(this.formatDate(item.transaction_date))}</div>
                <div class="queue-item-merchant ${merchantClass}">
                    ${escapeHtml(merchantDisplay)}
                    ${hasDuplicate ? `<span class="duplicate-icon" onclick="event.stopPropagation(); queueProcessor.openDuplicateModal(${item.id})" title="Potential duplicate">⚠️</span>` : ''}
                </div>
                <div class="queue-item-description">${escapeHtml(description)}</div>
                <div class="queue-item-category ${categoryClass}">${escapeHtml(categoryDisplay)}</div>
                <div class="queue-item-type">
                    ${typeValue ? `<span class="type-badge ${typeClass}">${escapeHtml(this.formatType(typeValue))}</span>` : '—'}
                </div>
                <div class="queue-item-tags">
                    ${tags.map(tag => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join('')}
                </div>
                <div class="queue-item-amount ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                    ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                </div>
            </div>
            `;
        }).join('');

        // Update mode bar
        const updateModeBar = this.updateMode ? `
            <div class="update-mode-bar">
                <span class="mode-label">UPDATE MODE</span>
                <span class="shortcut"><kbd>M</kbd> Merchant</span>
                <span class="shortcut"><kbd>D</kbd> Description</span>
                <span class="shortcut"><kbd>C</kbd> Category</span>
                <span class="shortcut"><kbd>E</kbd> Type</span>
                <span class="shortcut"><kbd>T</kbd> Tags</span>
                <span class="shortcut"><kbd>Esc</kbd> Exit</span>
            </div>
        ` : '';

        document.getElementById('queueContent').innerHTML = `
            ${updateModeBar}
            <div class="queue-list-header">
                <div class="queue-header-checkbox">
                    <input type="checkbox" id="selectAllCheckbox" title="Select all" onchange="queueProcessor.toggleSelectAll(this.checked)">
                </div>
                <div>Date</div>
                <div>Merchant</div>
                <div>Description</div>
                <div>Category</div>
                <div>Type</div>
                <div>Tags</div>
                <div class="queue-header-amount">Amount</div>
            </div>
            <div class="queue-list" id="queueList" tabindex="0">
                ${listHtml}
            </div>
            <div class="queue-list-footer">
                <div class="bulk-actions" id="bulkActions" style="display: none;">
                    <span id="selectionCount">0 items selected</span>
                    <button class="btn btn-danger btn-small" onclick="queueProcessor.discardSelected()">
                        Discard <kbd>X</kbd>
                    </button>
                    <button class="btn btn-primary btn-small" onclick="queueProcessor.bulkSaveSelected()">
                        Save <kbd>S</kbd>
                    </button>
                    <button class="btn btn-warning btn-small" onclick="queueProcessor.archiveSelected()">
                        Archive <kbd>A</kbd>
                    </button>
                    <button class="btn btn-info btn-small" onclick="queueProcessor.openMergeModal()" ${this.selectedIds.size < 2 ? 'disabled' : ''}>
                        Merge <kbd>M</kbd>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="queueProcessor.clearSelection()">
                        Clear <kbd>Esc</kbd>
                    </button>
                </div>
                <div class="keyboard-hints">
                    <span class="keyboard-hint">↑↓ Navigate</span>
                    <span class="keyboard-hint">Space Select</span>
                    <span class="keyboard-hint">U Update Mode</span>
                    <span class="keyboard-hint">S Save</span>
                    <span class="keyboard-hint">X Discard</span>
                </div>
            </div>
        `;

        document.getElementById('queueList').focus({ preventScroll: true });
        this.updateListUI();
    }

    formatType(type) {
        if (type === 'necessary variable') return 'Necessary';
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    // ==================== BULK ACTIONS ====================

    async discardSelected() {
        // If nothing is selected, discard the focused item
        let idsToDelete;
        if (this.selectedIds.size === 0) {
            if (this.queueItems.length === 0) return;
            idsToDelete = new Set([this.queueItems[this.selectedIndex].id]);
        } else {
            idsToDelete = this.selectedIds;
        }

        const count = idsToDelete.size;
        if (!confirm(`Are you sure you want to discard ${count} transaction${count > 1 ? 's' : ''}?`)) return;

        try {
            for (const id of idsToDelete) {
                const response = await fetch(`/api/queue/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Failed to discard item ${id}`);
                }
            }

            this.queueItems = this.queueItems.filter(item => !idsToDelete.has(item.id));
            this.selectedIds.clear();

            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            await this.updateQueueCount();
            await this.detectDuplicates();

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

    async archiveSelected() {
        if (this.selectedIds.size === 0) return;

        const count = this.selectedIds.size;
        if (!confirm(`Are you sure you want to archive ${count} transaction${count > 1 ? 's' : ''}?`)) return;

        try {
            const idsToArchive = Array.from(this.selectedIds);

            const response = await fetch('/api/queue/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw_expense_ids: idsToArchive })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to archive items');
            }

            const result = await response.json();

            this.queueItems = this.queueItems.filter(item => !this.selectedIds.has(item.id));
            this.selectedIds.clear();

            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            await this.updateQueueCount();
            await this.detectDuplicates();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                this.renderListView();
            }

            alert(`Archived ${result.archived_count} transaction${result.archived_count > 1 ? 's' : ''}`);
        } catch (error) {
            console.error('Error archiving items:', error);
            alert('Error archiving items: ' + error.message);
        }
    }

    async bulkSaveSelected() {
        // If nothing is selected, save the focused item
        let idsToSave;
        if (this.selectedIds.size === 0) {
            if (this.queueItems.length === 0) return;
            idsToSave = new Set([this.queueItems[this.selectedIndex].id]);
        } else {
            idsToSave = this.selectedIds;
        }

        const selectedItems = this.queueItems.filter(item => idsToSave.has(item.id));

        // Check for items missing required fields
        const incomplete = selectedItems.filter(item => {
            const hasMerchant = item.merchant_alias_id || item.suggested_merchant_alias;
            const hasCategory = item.category_id || item.suggested_category_id;
            return !hasMerchant || !hasCategory;
        });

        if (incomplete.length > 0) {
            alert(`${incomplete.length} item(s) are missing category or merchant. Please update them first using Update Mode (U).`);
            return;
        }

        // Apply suggestions before saving
        for (const item of selectedItems) {
            if (!item.merchant_alias_id && item.suggested_merchant_alias) {
                await this.updateRawExpense(item.id, {
                    merchant_alias_id: item.suggested_merchant_alias.id
                });
            }
            if (!item.category_id && item.suggested_category_id) {
                await this.updateRawExpense(item.id, {
                    category_id: item.suggested_category_id,
                    type: item.type || item.suggested_type || 'discretionary'
                });
            }
        }

        const count = idsToSave.size;
        if (!confirm(`Save ${count} expense${count > 1 ? 's' : ''}?`)) return;

        try {
            const response = await fetch('/api/queue/bulk-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw_expense_ids: Array.from(idsToSave) })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Bulk save failed');
            }

            const result = await response.json();

            this.queueItems = this.queueItems.filter(item => !idsToSave.has(item.id));
            this.selectedIds.clear();

            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            await this.updateQueueCount();
            await this.detectDuplicates();

            if (result.failed_count > 0) {
                alert(`Saved ${result.saved_count} expense(s). ${result.failed_count} failed:\n${result.errors.join('\n')}`);
            } else {
                alert(`Saved ${result.saved_count} expense(s) successfully!`);
            }

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                this.renderListView();
            }
        } catch (error) {
            console.error('Error in bulk save:', error);
            alert('Error saving expenses: ' + error.message);
        }
    }

    // ==================== DUPLICATE DETECTION ====================

    async detectDuplicates() {
        try {
            const response = await fetch('/api/queue/find-duplicates');
            const duplicatesData = await response.json();

            if (response.ok) {
                this.duplicates = duplicatesData;
                console.log(`Detected ${Object.keys(duplicatesData).length} item(s) with potential duplicates`);
            }
        } catch (error) {
            console.error('Error detecting duplicates:', error);
        }
    }

    openDuplicateModal(rawExpenseId) {
        const duplicateInfo = this.duplicates[rawExpenseId];
        if (!duplicateInfo) return;

        const rawExpense = duplicateInfo.raw_expense;
        const duplicates = duplicateInfo.duplicates;

        this.duplicateModalItems = [
            { ...rawExpense, type: 'raw', isCurrentTransaction: true }
        ];

        duplicates.forEach(dup => {
            this.duplicateModalItems.push(dup);
        });

        this.duplicateModalFocusIndex = 0;

        const modalHtml = `
            <div class="modal-overlay" id="duplicateModal" onclick="queueProcessor.handleDuplicateModalClick(event)">
                <div class="modal-content large-modal duplicate-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Potential Duplicate Transaction</h2>
                        <button class="modal-close" onclick="queueProcessor.closeDuplicateModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <p class="duplicate-warning">
                            The following transactions have the same amount and date. Use <kbd>←</kbd> <kbd>→</kbd> to navigate, <kbd>X</kbd> to discard.
                        </p>

                        <div class="duplicate-scroll-container" id="duplicateScrollContainer">
                            <div class="duplicate-scroll-track" id="duplicateScrollTrack">
                                ${this.renderDuplicateCards()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">←→ Navigate</span>
                            <span class="keyboard-hint">X Discard</span>
                            <span class="keyboard-hint">Esc Close</span>
                        </div>
                        <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeDuplicateModal()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'duplicateModalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        this.duplicateModalKeyHandler = (e) => this.handleDuplicateModalKeyboard(e);
        document.addEventListener('keydown', this.duplicateModalKeyHandler);

        this.scrollToFocusedDuplicate();
    }

    renderDuplicateCards() {
        return this.duplicateModalItems.map((item, index) => {
            const isSaved = item.type === 'saved';
            const isRaw = item.type === 'raw';
            const isFocused = index === this.duplicateModalFocusIndex;
            const isCurrentTransaction = item.isCurrentTransaction;

            let cardClass = 'duplicate-card';
            if (isFocused) cardClass += ' focused';
            if (isSaved) cardClass += ' saved-transaction';
            if (isCurrentTransaction) cardClass += ' current-transaction';

            let headerText = '';
            if (isCurrentTransaction) {
                headerText = 'Current Transaction';
            } else if (isSaved) {
                headerText = item.archived ? 'Saved (Archived)' : 'Saved Expense';
            } else {
                headerText = 'Unprocessed';
            }

            return `
                <div class="${cardClass}" data-index="${index}" onclick="queueProcessor.focusDuplicateCard(${index})">
                    <div class="duplicate-card-header">
                        <span class="duplicate-card-type">${escapeHtml(headerText)}</span>
                        ${isFocused ? '<span class="focus-indicator">●</span>' : ''}
                    </div>
                    <div class="duplicate-card-body">
                        <div class="detail-row">
                            <span class="detail-label">Date:</span>
                            <span class="detail-value">${escapeHtml(this.formatDate(item.transaction_date))}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Amount:</span>
                            <span class="detail-value ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                                ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Merchant:</span>
                            <span class="detail-value">${escapeHtml(isSaved ? (item.merchant_alias || 'N/A') : (item.raw_merchant_name || 'Unknown'))}</span>
                        </div>
                        ${isSaved && item.category ? `
                        <div class="detail-row">
                            <span class="detail-label">Category:</span>
                            <span class="detail-value">${escapeHtml(item.category)}</span>
                        </div>
                        ` : ''}
                        ${(isSaved ? item.description : item.raw_description) ? `
                        <div class="detail-row">
                            <span class="detail-label">Description:</span>
                            <span class="detail-value">${escapeHtml(isSaved ? item.description : item.raw_description)}</span>
                        </div>
                        ` : ''}
                        ${isRaw ? `
                        <div class="detail-row">
                            <span class="detail-label">Source:</span>
                            <span class="detail-value">${escapeHtml(item.source)}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="duplicate-card-actions">
                        ${isRaw ? `
                            <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); queueProcessor.discardFromDuplicateModal(${item.id})">
                                Discard
                            </button>
                        ` : `
                            <span class="saved-badge">Already Saved</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    focusDuplicateCard(index) {
        this.duplicateModalFocusIndex = index;
        this.updateDuplicateCardsUI();
        this.scrollToFocusedDuplicate();
    }

    updateDuplicateCardsUI() {
        const track = document.getElementById('duplicateScrollTrack');
        if (track) {
            track.innerHTML = this.renderDuplicateCards();
        }
    }

    scrollToFocusedDuplicate() {
        const container = document.getElementById('duplicateScrollContainer');
        const focusedCard = document.querySelector('.duplicate-card.focused');

        if (container && focusedCard) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = focusedCard.getBoundingClientRect();
            const scrollLeft = focusedCard.offsetLeft - (containerRect.width / 2) + (cardRect.width / 2);
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }

    handleDuplicateModalKeyboard(e) {
        if (!document.getElementById('duplicateModal')) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeDuplicateModal();
            return;
        }

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (this.duplicateModalFocusIndex > 0) {
                this.duplicateModalFocusIndex--;
                this.updateDuplicateCardsUI();
                this.scrollToFocusedDuplicate();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (this.duplicateModalFocusIndex < this.duplicateModalItems.length - 1) {
                this.duplicateModalFocusIndex++;
                this.updateDuplicateCardsUI();
                this.scrollToFocusedDuplicate();
            }
        } else if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            const focusedItem = this.duplicateModalItems[this.duplicateModalFocusIndex];
            if (focusedItem && focusedItem.type === 'raw') {
                this.discardFromDuplicateModal(focusedItem.id);
            }
        }
    }

    handleDuplicateModalClick(event) {
        if (event.target.id === 'duplicateModal') {
            this.closeDuplicateModal();
        }
    }

    closeDuplicateModal() {
        const modalContainer = document.getElementById('duplicateModalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }

        if (this.duplicateModalKeyHandler) {
            document.removeEventListener('keydown', this.duplicateModalKeyHandler);
            this.duplicateModalKeyHandler = null;
        }

        this.duplicateModalItems = [];
        this.duplicateModalFocusIndex = 0;
    }

    async discardFromDuplicateModal(rawExpenseId) {
        if (!confirm('Are you sure you want to discard this transaction?')) return;

        try {
            const response = await fetch(`/api/queue/${rawExpenseId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to discard item');
            }

            this.queueItems = this.queueItems.filter(item => item.id !== rawExpenseId);
            delete this.duplicates[rawExpenseId];

            for (const key in this.duplicates) {
                this.duplicates[key].duplicates = this.duplicates[key].duplicates.filter(
                    dup => !(dup.type === 'raw' && dup.id === rawExpenseId)
                );

                if (this.duplicates[key].duplicates.length === 0) {
                    delete this.duplicates[key];
                }
            }

            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            await this.updateQueueCount();
            this.closeDuplicateModal();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                this.renderListView();
            }
        } catch (error) {
            console.error('Error discarding item:', error);
            alert('Error discarding item: ' + error.message);
        }
    }

    // ==================== MERGE FUNCTIONALITY ====================

    openMergeModal() {
        if (this.selectedIds.size < 2) {
            alert('Please select at least 2 expenses to merge');
            return;
        }

        this.viewMode = 'merge';
        this.mergeTags = [];

        const selectedItems = this.queueItems.filter(item => this.selectedIds.has(item.id));
        const totalAmount = selectedItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const earliestDate = selectedItems.reduce((earliest, item) => {
            const date = new Date(item.transaction_date);
            return !earliest || date < earliest ? date : earliest;
        }, null);

        const modalHtml = `
            <div class="modal-overlay" id="mergeModal" onclick="queueProcessor.handleMergeModalClick(event)">
                <div class="modal-content large-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Merge ${this.selectedIds.size} Expenses</h2>
                        <button class="modal-close" onclick="queueProcessor.closeMergeModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="group-summary">
                            <div class="group-summary-item">
                                <strong>Items:</strong> ${this.selectedIds.size}
                            </div>
                            <div class="group-summary-item">
                                <strong>Total Amount:</strong> 
                                <span class="${totalAmount < 0 ? 'negative' : 'positive'}">
                                    ${totalAmount < 0 ? '-' : ''}£${Math.abs(totalAmount).toFixed(2)}
                                </span>
                            </div>
                            <div class="group-summary-item">
                                <strong>Date (earliest):</strong> ${this.formatDate(earliestDate.toISOString().split('T')[0])}
                            </div>
                        </div>

                        <div class="group-section">
                            <h3>Merged Expense Details</h3>
                            <p class="section-description">The selected expenses will be merged into a single expense. Original expenses will be archived.</p>
                            
                            <form id="mergeForm">
                                <div class="form-group">
                                    <label for="mergeMerchantName">Merchant Alias</label>
                                    <input type="text" id="mergeMerchantName" placeholder="Start typing..." required>
                                </div>

                                <div class="form-group">
                                    <label for="mergeCategorySelect">Category</label>
                                    <select id="mergeCategorySelect" required>
                                        <option value="">Select a category</option>
                                        ${this.buildCategoryOptionsHtml(this.getBulkCategories(selectedItems))}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="mergeDescription">Description (optional)</label>
                                    <input type="text" id="mergeDescription" placeholder="Add a description">
                                </div>

                                <div class="form-group">
                                    <label for="mergeTagInput">Tags</label>
                                    <input type="text" id="mergeTagInput" placeholder="Start typing..." autocomplete="off">
                                    <div class="tags-input" id="mergeTagsContainer"></div>
                                </div>

                                <div class="form-group">
                                    <label for="mergeExpenseType">Expense Type</label>
                                    <select id="mergeExpenseType">
                                        <option value="">None</option>
                                        <option value="fixed">Fixed</option>
                                        <option value="necessary variable">Necessary Variable</option>
                                        <option value="discretionary">Discretionary</option>
                                    </select>
                                </div>
                            </form>
                        </div>

                        <div class="group-section">
                            <h3>Expenses to Merge</h3>
                            <div class="group-children-list">
                                ${selectedItems.map(item => `
                                    <div class="group-child-row">
                                        <div class="group-child-info">
                                            <span class="group-child-date">${escapeHtml(this.formatDate(item.transaction_date))}</span>
                                            <span class="group-child-merchant">${escapeHtml(item.raw_merchant_name || 'Unknown')}</span>
                                            <span class="group-child-amount ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                                                ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="queueProcessor.closeMergeModal()">
                            Cancel <kbd>Esc</kbd>
                        </button>
                        <button type="button" class="btn btn-primary" onclick="queueProcessor.saveMergedExpense()">
                            Merge Expenses
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        this.setupMergeFormEvents();
        document.getElementById('mergeMerchantName').focus();
    }

    setupMergeFormEvents() {
        const mergeMerchantInput = document.getElementById('mergeMerchantName');
        new Autocomplete(mergeMerchantInput, {
            endpoint: '/api/merchants',
            displayField: 'display_name',
            onSelect: (merchant) => {
                if (merchant.default_category_id) {
                    document.getElementById('mergeCategorySelect').value = merchant.default_category_id;
                }
            },
            createData: (value) => ({
                raw_name: value,
                display_name: value
            })
        });

        const mergeTagInput = document.getElementById('mergeTagInput');
        new Autocomplete(mergeTagInput, {
            endpoint: '/api/tags',
            displayField: 'name',
            onSelect: (tag) => {
                this.addMergeTag(tag.name);
                mergeTagInput.value = '';
            },
            onCreate: (tag) => {
                this.addMergeTag(tag.name);
                mergeTagInput.value = '';
            },
            createData: (value) => ({ name: value })
        });

        mergeTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = mergeTagInput.value.trim();
                if (value) {
                    this.addMergeTag(value);
                    mergeTagInput.value = '';
                }
            }
        });
    }

    addMergeTag(tagName) {
        if (!tagName || this.mergeTags.includes(tagName)) return;
        this.mergeTags.push(tagName);
        this.renderMergeTags();
    }

    removeMergeTag(tagName) {
        this.mergeTags = this.mergeTags.filter(tag => tag !== tagName);
        this.renderMergeTags();
    }

    renderMergeTags() {
        const container = document.getElementById('mergeTagsContainer');
        container.innerHTML = this.mergeTags.map(tag => `
            <div class="tag-item">
                #${escapeHtml(tag)}
                <button type="button" class="tag-remove" onclick="queueProcessor.removeMergeTag('${escapeJs(tag)}')">x</button>
            </div>
        `).join('');
    }

    handleMergeModalClick(event) {
        if (event.target.id === 'mergeModal') {
            this.closeMergeModal();
        }
    }

    closeMergeModal() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        this.viewMode = 'list';
        this.mergeTags = [];
    }

    async saveMergedExpense() {
        const merchantName = document.getElementById('mergeMerchantName').value.trim();
        const categoryId = document.getElementById('mergeCategorySelect').value;
        const description = document.getElementById('mergeDescription').value.trim();
        const expenseType = document.getElementById('mergeExpenseType').value || null;

        if (!merchantName) {
            alert('Please enter a merchant name');
            document.getElementById('mergeMerchantName').focus();
            return;
        }

        if (!categoryId) {
            alert('Please select a category');
            document.getElementById('mergeCategorySelect').focus();
            return;
        }

        const rawExpenseIds = Array.from(this.selectedIds);

        const payload = {
            raw_expense_ids: rawExpenseIds,
            expense_data: {
                merchant_name: merchantName,
                category_id: parseInt(categoryId),
                description: description,
                tags: this.mergeTags,
                type: expenseType
            }
        };

        try {
            const response = await fetch('/api/queue/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to merge expenses');
            }

            const result = await response.json();

            this.queueItems = this.queueItems.filter(item => !this.selectedIds.has(item.id));
            this.selectedIds.clear();

            if (this.selectedIndex >= this.queueItems.length && this.queueItems.length > 0) {
                this.selectedIndex = this.queueItems.length - 1;
            }

            this.closeMergeModal();
            await this.updateQueueCount();
            await this.detectDuplicates();

            if (this.queueItems.length === 0) {
                this.renderEmptyQueue();
            } else {
                this.renderListView();
            }

            alert(`Expenses merged successfully! ID: ${result.expense_id}`);
        } catch (error) {
            console.error('Error merging expenses:', error);
            alert('Error merging expenses: ' + error.message);
        }
    }

    // ==================== UTILITY METHODS ====================

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

    renderError(message) {
        document.getElementById('queueContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>Error</h3>
                <p>${escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            document.getElementById('queueCount').textContent = data.count || 0;
        } catch (error) {
            console.error('Error loading queue count:', error);
        }
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
