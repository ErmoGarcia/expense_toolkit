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

        // Duplicates page state
        this.duplicatesViewMode = false;
        this.currentDuplicateSetIndex = 0;
        this.duplicateSets = [];
        this.focusedDuplicateItemIndex = 0;
        this.duplicatesPageKeyHandler = null;

        // Update mode state
        this.updateMode = false;
        this.categoryTypeCache = {};
        this.currentModalTags = [];

        // Filter mode state
        this.filterMode = false;
        this.activeFilters = {
            dateFrom: null,
            dateTo: null,
            merchant: null,
            amountMin: null,
            amountMax: null
        };
        this.originalQueueItems = [];
        this.filterModalKeyHandler = null;

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
                this.originalQueueItems = [...data];
                this.queueItems = [...data];
                this.selectedIndex = 0;
                this.selectedIds.clear();
                // Apply any existing filters
                if (this.hasActiveFilters()) {
                    this.applyFilters();
                } else {
                    this.renderListView();
                }
            } else {
                this.originalQueueItems = [];
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
                } else if (document.getElementById('filterModal')) {
                    this.closeFilterModal();
                } else if (this.viewMode === 'merge') {
                    this.closeMergeModal();
                } else if (document.getElementById('duplicateModal')) {
                    this.closeDuplicateModal();
                } else if (this.viewMode === 'list') {
                    // If there are selected items, clear them first (stay in update/filter mode if active)
                    if (this.selectedIds.size > 0) {
                        this.clearSelection();
                    }
                    // If no items selected and in update mode, exit update mode
                    else if (this.updateMode) {
                        this.exitUpdateMode();
                    }
                    // If no items selected and in filter mode, exit filter mode
                    else if (this.filterMode) {
                        this.exitFilterMode();
                    }
                    // If not in any mode but filters are active, clear all filters
                    else if (this.hasActiveFilters()) {
                        this.clearAllFilters();
                    }
                }
                return;
            }

            // Ignore other keys if typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // Ignore other keys if a modal is open (except Escape, which is handled above)
            if (document.getElementById('updateModal') || document.getElementById('filterModal')) {
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
        // Update mode toggle - available even with no items or selection (but not in filter mode)
        if ((e.key === 'u' || e.key === 'U') && !this.filterMode) {
            e.preventDefault();
            this.toggleUpdateMode();
            return;
        }

        // Filter mode toggle - available even with no items or selection (but not in update mode)
        if ((e.key === 'f' || e.key === 'F') && !this.updateMode) {
            e.preventDefault();
            this.toggleFilterMode();
            return;
        }

        // Ctrl+D to open duplicates page (not in update or filter mode)
        if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && !this.updateMode && !this.filterMode) {
            e.preventDefault();
            if (this.hasDuplicates()) {
                this.openDuplicatesPage();
            }
            return;
        }

        // Navigation requires items
        if (this.queueItems.length === 0) {
            // Filter mode shortcuts work even with no items (to allow clearing filters)
            if (this.filterMode) {
                if (e.key === 'd') {
                    e.preventDefault();
                    this.openDateFilterModal();
                    return;
                }
                if (e.key === 'm') {
                    e.preventDefault();
                    this.openMerchantFilterModal();
                    return;
                }
                if (e.key === 'a') {
                    e.preventDefault();
                    this.openAmountFilterModal();
                    return;
                }
            }
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

        // Filter mode shortcuts
        if (this.filterMode) {
            if (e.key === 'd') {
                e.preventDefault();
                this.openDateFilterModal();
                return;
            }
            if (e.key === 'm') {
                e.preventDefault();
                this.openMerchantFilterModal();
                return;
            }
            if (e.key === 'a') {
                e.preventDefault();
                this.openAmountFilterModal();
                return;
            }
            return; // Don't process other keys in filter mode
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

    // ==================== FILTER MODE ====================

    toggleFilterMode() {
        this.filterMode = !this.filterMode;
        this.renderListView();
    }

    exitFilterMode() {
        this.filterMode = false;
        this.renderListView();
    }

    hasActiveFilters() {
        return this.activeFilters.dateFrom !== null ||
            this.activeFilters.dateTo !== null ||
            this.activeFilters.merchant !== null ||
            this.activeFilters.amountMin !== null ||
            this.activeFilters.amountMax !== null;
    }

    clearAllFilters() {
        this.activeFilters = {
            dateFrom: null,
            dateTo: null,
            merchant: null,
            amountMin: null,
            amountMax: null
        };
        this.queueItems = [...this.originalQueueItems];
        this.selectedIndex = 0;
        this.selectedIds.clear();
        this.renderListView();
    }

    clearFilter(filterType) {
        if (filterType === 'date') {
            this.activeFilters.dateFrom = null;
            this.activeFilters.dateTo = null;
        } else if (filterType === 'merchant') {
            this.activeFilters.merchant = null;
        } else if (filterType === 'amount') {
            this.activeFilters.amountMin = null;
            this.activeFilters.amountMax = null;
        }
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.originalQueueItems];

        // Date filter
        if (this.activeFilters.dateFrom) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.transaction_date);
                return itemDate >= this.activeFilters.dateFrom;
            });
        }
        if (this.activeFilters.dateTo) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.transaction_date);
                return itemDate <= this.activeFilters.dateTo;
            });
        }

        // Merchant filter
        if (this.activeFilters.merchant) {
            filtered = filtered.filter(item => {
                const merchant = item.merchant_alias?.display_name || item.raw_merchant_name;
                return merchant === this.activeFilters.merchant;
            });
        }

        // Amount filter (use absolute values so -22 is in range 20-30)
        if (this.activeFilters.amountMin !== null) {
            filtered = filtered.filter(item =>
                Math.abs(parseFloat(item.amount)) >= this.activeFilters.amountMin
            );
        }
        if (this.activeFilters.amountMax !== null) {
            filtered = filtered.filter(item =>
                Math.abs(parseFloat(item.amount)) <= this.activeFilters.amountMax
            );
        }

        this.queueItems = filtered;
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.queueItems.length - 1));

        // Clear selection of items no longer in filtered list
        const filteredIds = new Set(filtered.map(item => item.id));
        this.selectedIds = new Set([...this.selectedIds].filter(id => filteredIds.has(id)));

        this.renderListView();
    }

    getUniqueMerchants() {
        const merchants = new Set();
        this.originalQueueItems.forEach(item => {
            if (item.merchant_alias?.display_name) {
                merchants.add(item.merchant_alias.display_name);
            } else if (item.raw_merchant_name) {
                merchants.add(item.raw_merchant_name);
            }
        });
        return Array.from(merchants).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    closeFilterModal() {
        const modal = document.getElementById('filterModal');
        if (modal) modal.remove();

        if (this.filterModalKeyHandler) {
            document.removeEventListener('keydown', this.filterModalKeyHandler);
            this.filterModalKeyHandler = null;
        }
    }

    // ==================== DATE FILTER MODAL ====================

    openDateFilterModal() {
        // Initialize date input states
        this.dateFromDigits = this.activeFilters.dateFrom
            ? this.convertDateToDigits(this.activeFilters.dateFrom)
            : '';
        this.dateToInputDigits = this.activeFilters.dateTo
            ? this.convertDateToDigits(this.activeFilters.dateTo)
            : '';
        this.dateFocusedField = 'from'; // 'from' or 'to'

        const modalHtml = `
            <div class="modal-overlay" id="filterModal" onclick="queueProcessor.closeFilterModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Filter by Date Range</h2>
                        <button class="modal-close" onclick="queueProcessor.closeFilterModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>From Date</label>
                            <div class="date-input-container ${this.dateFocusedField === 'from' ? 'focused' : ''}" id="dateFromContainer" onclick="queueProcessor.focusDateField('from')">
                                ${this.renderDateInput(this.dateFromDigits)}
                            </div>
                        </div>
                        <div class="form-group">
                            <label>To Date</label>
                            <div class="date-input-container ${this.dateFocusedField === 'to' ? 'focused' : ''}" id="dateToContainer" onclick="queueProcessor.focusDateField('to')">
                                ${this.renderDateInput(this.dateToInputDigits)}
                            </div>
                        </div>
                        <p class="form-hint">Format: DD-MM-YY or DD-MM-YYYY</p>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">Up/Down Navigate</span>
                            <span class="keyboard-hint">Enter Apply</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                        <button class="btn btn-primary" onclick="queueProcessor.applyDateFilter()">Apply</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        this.filterModalKeyHandler = (e) => this.handleDateModalKeyboard(e);
        document.addEventListener('keydown', this.filterModalKeyHandler);
    }

    convertDateToDigits(date) {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear());
        return day + month + year;
    }

    digitsToDate(digits) {
        if (digits.length < 6) return null;
        const day = parseInt(digits.substring(0, 2), 10);
        const month = parseInt(digits.substring(2, 4), 10);
        let year = parseInt(digits.substring(4), 10);

        // Handle 2-digit year
        if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }

        // Validate
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;

        const date = new Date(year, month - 1, day);
        // Check if date is valid (e.g., Feb 30 would roll over)
        if (date.getDate() !== day || date.getMonth() !== month - 1) return null;

        return date;
    }

    renderDateInput(digits) {
        const day = digits.substring(0, 2).padEnd(2, '_');
        const month = digits.substring(2, 4).padEnd(2, '_');
        const year = digits.substring(4).padEnd(digits.length > 6 ? 4 : 2, '_');

        return `
            <span class="date-segment">${escapeHtml(day)}</span>
            <span class="date-separator">-</span>
            <span class="date-segment">${escapeHtml(month)}</span>
            <span class="date-separator">-</span>
            <span class="date-segment">${escapeHtml(year || '__')}</span>
        `;
    }

    focusDateField(field) {
        this.dateFocusedField = field;
        this.updateDateModalUI();
    }

    updateDateModalUI() {
        const fromContainer = document.getElementById('dateFromContainer');
        const toContainer = document.getElementById('dateToContainer');

        if (fromContainer) {
            fromContainer.classList.toggle('focused', this.dateFocusedField === 'from');
            fromContainer.innerHTML = this.renderDateInput(this.dateFromDigits);
        }
        if (toContainer) {
            toContainer.classList.toggle('focused', this.dateFocusedField === 'to');
            toContainer.innerHTML = this.renderDateInput(this.dateToInputDigits);
        }
    }

    handleDateModalKeyboard(e) {
        if (!document.getElementById('filterModal')) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.dateFocusedField = 'from';
            this.updateDateModalUI();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.dateFocusedField = 'to';
            this.updateDateModalUI();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.applyDateFilter();
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            if (this.dateFocusedField === 'from' && this.dateFromDigits.length > 0) {
                this.dateFromDigits = this.dateFromDigits.slice(0, -1);
            } else if (this.dateFocusedField === 'to' && this.dateToInputDigits.length > 0) {
                this.dateToInputDigits = this.dateToInputDigits.slice(0, -1);
            }
            this.updateDateModalUI();
        } else if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const maxLen = 8; // DD-MM-YYYY
            if (this.dateFocusedField === 'from' && this.dateFromDigits.length < maxLen) {
                this.dateFromDigits += e.key;
            } else if (this.dateFocusedField === 'to' && this.dateToInputDigits.length < maxLen) {
                this.dateToInputDigits += e.key;
            }
            this.updateDateModalUI();
        }
    }

    applyDateFilter() {
        let fromDate = null;
        let toDate = null;

        if (this.dateFromDigits.length >= 6) {
            fromDate = this.digitsToDate(this.dateFromDigits);
            if (!fromDate) {
                alert('Invalid "From" date. Please use DD-MM-YY or DD-MM-YYYY format.');
                return;
            }
        }

        if (this.dateToInputDigits.length >= 6) {
            toDate = this.digitsToDate(this.dateToInputDigits);
            if (!toDate) {
                alert('Invalid "To" date. Please use DD-MM-YY or DD-MM-YYYY format.');
                return;
            }
        }

        // Validate from <= to
        if (fromDate && toDate && fromDate > toDate) {
            alert('"From" date must be before or equal to "To" date.');
            return;
        }

        this.activeFilters.dateFrom = fromDate;
        this.activeFilters.dateTo = toDate;

        this.closeFilterModal();
        this.applyFilters();
    }

    // ==================== MERCHANT FILTER MODAL ====================

    openMerchantFilterModal() {
        this.allFilterMerchants = this.getUniqueMerchants();
        this.filteredMerchantFilterList = [...this.allFilterMerchants];
        this.merchantFilterFocusIndex = 0;
        this.merchantFilterSearchQuery = '';

        // Pre-select current filter if set
        if (this.activeFilters.merchant) {
            const idx = this.filteredMerchantFilterList.indexOf(this.activeFilters.merchant);
            if (idx >= 0) this.merchantFilterFocusIndex = idx;
        }

        const modalHtml = `
            <div class="modal-overlay" id="filterModal" onclick="queueProcessor.closeFilterModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Filter by Merchant</h2>
                        <button class="modal-close" onclick="queueProcessor.closeFilterModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="merchantFilterSearchInput">Search Merchants</label>
                            <input type="text" id="merchantFilterSearchInput" placeholder="Type to filter..." autofocus>
                        </div>
                        <div class="category-list-container" id="merchantFilterListContainer">
                            ${this.renderMerchantFilterList()}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">Up/Down Navigate</span>
                            <span class="keyboard-hint">Enter Select</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const searchInput = document.getElementById('merchantFilterSearchInput');
        searchInput.addEventListener('input', (e) => this.filterMerchantFilterList(e.target.value));
        searchInput.addEventListener('keydown', (e) => this.handleMerchantFilterModalKeyboard(e));
        searchInput.focus();
    }

    renderMerchantFilterList() {
        if (this.filteredMerchantFilterList.length === 0) {
            return '<div class="empty-message">No merchants found</div>';
        }

        let html = '<div class="selectable-list" id="merchantFilterSelectableList">';

        // Add "Clear filter" option at the top if a filter is active
        if (this.activeFilters.merchant) {
            const isFocused = this.merchantFilterFocusIndex === -1;
            html += `
                <div class="selectable-item selectable-item-clear ${isFocused ? 'focused' : ''}" data-index="-1" onclick="queueProcessor.selectMerchantFilter(null)">
                    <em>Clear merchant filter</em>
                </div>
            `;
        }

        this.filteredMerchantFilterList.forEach((merchant, index) => {
            const isFocused = index === this.merchantFilterFocusIndex;
            const isCurrentFilter = merchant === this.activeFilters.merchant;
            html += `
                <div class="selectable-item ${isFocused ? 'focused' : ''} ${isCurrentFilter ? 'current-filter' : ''}" data-index="${index}" onclick="queueProcessor.selectMerchantFilter('${escapeJs(merchant)}')">
                    ${escapeHtml(merchant)}
                    ${isCurrentFilter ? '<span class="filter-active-indicator">active</span>' : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    filterMerchantFilterList(query) {
        this.merchantFilterSearchQuery = query;

        if (!query.trim()) {
            this.filteredMerchantFilterList = [...this.allFilterMerchants];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredMerchantFilterList = this.allFilterMerchants.filter(merchant =>
                merchant.toLowerCase().includes(lowerQuery)
            );
        }
        this.merchantFilterFocusIndex = 0;
        document.getElementById('merchantFilterListContainer').innerHTML = this.renderMerchantFilterList();
    }

    handleMerchantFilterModalKeyboard(e) {
        const hasClearOption = this.activeFilters.merchant !== null;
        const totalItems = this.filteredMerchantFilterList.length + (hasClearOption ? 1 : 0);
        const minIndex = hasClearOption ? -1 : 0;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.merchantFilterFocusIndex < this.filteredMerchantFilterList.length - 1) {
                this.merchantFilterFocusIndex++;
                this.updateMerchantFilterListUI();
                this.scrollToFocusedMerchantFilter();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.merchantFilterFocusIndex > minIndex) {
                this.merchantFilterFocusIndex--;
                this.updateMerchantFilterListUI();
                this.scrollToFocusedMerchantFilter();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.merchantFilterFocusIndex === -1) {
                this.selectMerchantFilter(null);
            } else if (this.filteredMerchantFilterList.length > 0) {
                const merchant = this.filteredMerchantFilterList[this.merchantFilterFocusIndex];
                this.selectMerchantFilter(merchant);
            }
        }
    }

    updateMerchantFilterListUI() {
        const items = document.querySelectorAll('#merchantFilterSelectableList .selectable-item');
        const hasClearOption = this.activeFilters.merchant !== null;

        items.forEach((item, idx) => {
            const itemIndex = hasClearOption ? idx - 1 : idx;
            item.classList.toggle('focused', itemIndex === this.merchantFilterFocusIndex);
        });
    }

    scrollToFocusedMerchantFilter() {
        const focused = document.querySelector('#merchantFilterSelectableList .selectable-item.focused');
        if (focused) {
            focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    selectMerchantFilter(merchant) {
        this.activeFilters.merchant = merchant;
        this.closeFilterModal();
        this.applyFilters();
    }

    // ==================== AMOUNT FILTER MODAL ====================

    openAmountFilterModal() {
        this.amountMinValue = this.activeFilters.amountMin !== null
            ? this.activeFilters.amountMin.toFixed(2)
            : '';
        this.amountMaxValue = this.activeFilters.amountMax !== null
            ? this.activeFilters.amountMax.toFixed(2)
            : '';
        this.amountFocusedField = 'min'; // 'min' or 'max'

        const modalHtml = `
            <div class="modal-overlay" id="filterModal" onclick="queueProcessor.closeFilterModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Filter by Amount Range</h2>
                        <button class="modal-close" onclick="queueProcessor.closeFilterModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Min Amount</label>
                            <div class="amount-input-wrapper ${this.amountFocusedField === 'min' ? 'focused' : ''}" id="amountMinContainer" onclick="queueProcessor.focusAmountField('min')">
                                <span class="currency-symbol">£</span>
                                <input type="text" class="amount-input" id="amountMinInput" value="${escapeHtml(this.amountMinValue)}" placeholder="0.00">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Max Amount</label>
                            <div class="amount-input-wrapper ${this.amountFocusedField === 'max' ? 'focused' : ''}" id="amountMaxContainer" onclick="queueProcessor.focusAmountField('max')">
                                <span class="currency-symbol">£</span>
                                <input type="text" class="amount-input" id="amountMaxInput" value="${escapeHtml(this.amountMaxValue)}" placeholder="0.00">
                            </div>
                        </div>
                        <p class="form-hint">Leave empty for no limit. Filters by absolute value (e.g., 20-30 matches both £25 and -£25).</p>
                    </div>
                    <div class="modal-footer">
                        <div class="keyboard-hints">
                            <span class="keyboard-hint">Up/Down Navigate</span>
                            <span class="keyboard-hint">Enter Apply</span>
                            <span class="keyboard-hint">Esc Cancel</span>
                        </div>
                        <button class="btn btn-primary" onclick="queueProcessor.applyAmountFilter()">Apply</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const minInput = document.getElementById('amountMinInput');
        const maxInput = document.getElementById('amountMaxInput');

        minInput.addEventListener('focus', () => this.focusAmountField('min'));
        maxInput.addEventListener('focus', () => this.focusAmountField('max'));

        // Allow only valid amount characters (positive numbers only since we filter by absolute value)
        const validateAmountInput = (e) => {
            const input = e.target;
            let value = input.value;

            // Remove invalid characters (only allow digits and decimal point)
            value = value.replace(/[^0-9.]/g, '');

            // Ensure only one decimal point
            const parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }

            // Limit decimal places to 2
            if (parts.length === 2 && parts[1].length > 2) {
                value = parts[0] + '.' + parts[1].substring(0, 2);
            }

            input.value = value;
        };

        minInput.addEventListener('input', validateAmountInput);
        maxInput.addEventListener('input', validateAmountInput);

        this.filterModalKeyHandler = (e) => this.handleAmountModalKeyboard(e);
        document.addEventListener('keydown', this.filterModalKeyHandler);

        minInput.focus();
    }

    focusAmountField(field) {
        this.amountFocusedField = field;
        const minContainer = document.getElementById('amountMinContainer');
        const maxContainer = document.getElementById('amountMaxContainer');

        if (minContainer) minContainer.classList.toggle('focused', field === 'min');
        if (maxContainer) maxContainer.classList.toggle('focused', field === 'max');

        if (field === 'min') {
            document.getElementById('amountMinInput')?.focus();
        } else {
            document.getElementById('amountMaxInput')?.focus();
        }
    }

    handleAmountModalKeyboard(e) {
        if (!document.getElementById('filterModal')) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.focusAmountField('min');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.focusAmountField('max');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.applyAmountFilter();
        }
    }

    applyAmountFilter() {
        const minInput = document.getElementById('amountMinInput');
        const maxInput = document.getElementById('amountMaxInput');

        let minValue = null;
        let maxValue = null;

        if (minInput.value.trim() !== '') {
            minValue = parseFloat(minInput.value);
            if (isNaN(minValue)) {
                alert('Invalid min amount. Please enter a valid number.');
                return;
            }
        }

        if (maxInput.value.trim() !== '') {
            maxValue = parseFloat(maxInput.value);
            if (isNaN(maxValue)) {
                alert('Invalid max amount. Please enter a valid number.');
                return;
            }
        }

        // Validate min <= max
        if (minValue !== null && maxValue !== null && minValue > maxValue) {
            alert('Min amount must be less than or equal to max amount.');
            return;
        }

        this.activeFilters.amountMin = minValue;
        this.activeFilters.amountMax = maxValue;

        this.closeFilterModal();
        this.applyFilters();
    }

    // ==================== FILTER DISPLAY HELPERS ====================

    formatDateFilterDisplay(date) {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    }

    getActiveFiltersHtml() {
        if (!this.hasActiveFilters()) return '';

        let badges = [];

        // Date filter badge
        if (this.activeFilters.dateFrom || this.activeFilters.dateTo) {
            let dateText = 'Date: ';
            if (this.activeFilters.dateFrom && this.activeFilters.dateTo) {
                dateText += `${this.formatDateFilterDisplay(this.activeFilters.dateFrom)} to ${this.formatDateFilterDisplay(this.activeFilters.dateTo)}`;
            } else if (this.activeFilters.dateFrom) {
                dateText += `from ${this.formatDateFilterDisplay(this.activeFilters.dateFrom)}`;
            } else {
                dateText += `to ${this.formatDateFilterDisplay(this.activeFilters.dateTo)}`;
            }
            badges.push(`
                <span class="filter-badge">
                    ${escapeHtml(dateText)}
                    <button type="button" onclick="queueProcessor.clearFilter('date')" title="Clear date filter">x</button>
                </span>
            `);
        }

        // Merchant filter badge
        if (this.activeFilters.merchant) {
            badges.push(`
                <span class="filter-badge">
                    Merchant: ${escapeHtml(this.activeFilters.merchant)}
                    <button type="button" onclick="queueProcessor.clearFilter('merchant')" title="Clear merchant filter">x</button>
                </span>
            `);
        }

        // Amount filter badge
        if (this.activeFilters.amountMin !== null || this.activeFilters.amountMax !== null) {
            let amountText = 'Amount: ';
            if (this.activeFilters.amountMin !== null && this.activeFilters.amountMax !== null) {
                amountText += `£${this.activeFilters.amountMin.toFixed(2)} to £${this.activeFilters.amountMax.toFixed(2)}`;
            } else if (this.activeFilters.amountMin !== null) {
                amountText += `min £${this.activeFilters.amountMin.toFixed(2)}`;
            } else {
                amountText += `max £${this.activeFilters.amountMax.toFixed(2)}`;
            }
            badges.push(`
                <span class="filter-badge">
                    ${escapeHtml(amountText)}
                    <button type="button" onclick="queueProcessor.clearFilter('amount')" title="Clear amount filter">x</button>
                </span>
            `);
        }

        return `
            <div class="active-filters-bar">
                <span class="filters-label">Active Filters:</span>
                ${badges.join('')}
                <button type="button" class="btn btn-secondary btn-small" onclick="queueProcessor.clearAllFilters()">Clear All</button>
            </div>
        `;
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

        // Update queue status with filter info
        let statusText = `${this.queueItems.length} items to process`;
        if (this.hasActiveFilters() && this.queueItems.length !== this.originalQueueItems.length) {
            statusText = `Showing ${this.queueItems.length} of ${this.originalQueueItems.length} items`;
        }
        document.getElementById('queueStatus').textContent = statusText;

        const listHtml = this.queueItems.map((item, index) => {
            const hasDuplicate = this.duplicates[item.id];
            const isDuplicateRow = hasDuplicate ? 'has-duplicate' : '';
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
            <div class="queue-list-item ${isDuplicateRow} ${index === this.selectedIndex ? 'focused' : ''} ${this.selectedIds.has(item.id) ? 'selected' : ''} ${isUpdateTarget ? 'update-mode-active' : ''}" 
                 data-index="${index}"
                 onclick="queueProcessor.handleItemClick(event, ${index})">
                <div class="queue-item-checkbox" onclick="queueProcessor.handleCheckboxClick(event, ${item.id}, ${index})">
                    <span class="checkbox-indicator">${this.selectedIds.has(item.id) ? '✓' : ''}</span>
                </div>
                <div class="queue-item-date">${escapeHtml(this.formatDate(item.transaction_date))}</div>
                <div class="queue-item-merchant ${merchantClass}">
                    ${escapeHtml(merchantDisplay)}
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

        // Filter mode bar
        const filterModeBar = this.filterMode ? `
            <div class="filter-mode-bar">
                <span class="mode-label">FILTER MODE</span>
                <span class="shortcut"><kbd>D</kbd> Date</span>
                <span class="shortcut"><kbd>M</kbd> Merchant</span>
                <span class="shortcut"><kbd>A</kbd> Amount</span>
                <span class="shortcut"><kbd>Esc</kbd> Exit</span>
            </div>
        ` : '';

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

        // Active filters bar (shown even when not in filter mode)
        const activeFiltersBar = this.getActiveFiltersHtml();

        // Duplicates banner (shown when duplicates exist)
        const duplicatesBanner = this.hasDuplicates() ? `
            <div class="duplicates-banner">
                <div class="duplicates-banner-content">
                    <span class="duplicates-banner-icon">⚠️</span>
                    <span class="duplicates-banner-text">
                        ${Object.keys(this.duplicates).length} duplicate set${Object.keys(this.duplicates).length > 1 ? 's' : ''} detected
                    </span>
                </div>
                <button class="btn btn-warning duplicates-banner-button" onclick="queueProcessor.openDuplicatesPage()">
                    Fix Duplicates <kbd>Ctrl+D</kbd>
                </button>
            </div>
        ` : '';

        // Empty state for filtered results
        const emptyFilteredHtml = this.queueItems.length === 0 && this.hasActiveFilters() ? `
            <div class="empty-filtered-message">
                <p>No items match the current filters.</p>
                <button class="btn btn-secondary btn-small" onclick="queueProcessor.clearAllFilters()">Clear All Filters</button>
            </div>
        ` : '';

        document.getElementById('queueContent').innerHTML = `
            ${filterModeBar}
            ${updateModeBar}
            ${activeFiltersBar}
            ${duplicatesBanner}
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
                ${emptyFilteredHtml}
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
                    <span class="keyboard-hint">F Filter Mode</span>
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

    // ==================== DUPLICATES PAGE ====================

    hasDuplicates() {
        return Object.keys(this.duplicates).length > 0;
    }

    openDuplicatesPage() {
        if (!this.hasDuplicates()) return;

        // Build duplicate sets array and sort by oldest date first
        this.duplicateSets = Object.values(this.duplicates).sort((a, b) => {
            const dateA = new Date(a.raw_expense.transaction_date);
            const dateB = new Date(b.raw_expense.transaction_date);
            return dateA - dateB;
        });

        this.duplicatesViewMode = true;
        this.currentDuplicateSetIndex = 0;
        this.focusedDuplicateItemIndex = 0;

        this.renderDuplicatesView();

        // Set up keyboard handler for duplicates page
        this.duplicatesPageKeyHandler = (e) => this.handleDuplicatesPageKeyboard(e);
        document.addEventListener('keydown', this.duplicatesPageKeyHandler);
    }

    closeDuplicatesPage(showSuccess = false) {
        this.duplicatesViewMode = false;
        this.duplicateSets = [];
        this.currentDuplicateSetIndex = 0;
        this.focusedDuplicateItemIndex = 0;

        if (this.duplicatesPageKeyHandler) {
            document.removeEventListener('keydown', this.duplicatesPageKeyHandler);
            this.duplicatesPageKeyHandler = null;
        }

        // Reload queue data to refresh duplicate detection
        this.loadAllItems().then(() => {
            this.detectDuplicates().then(() => {
                if (showSuccess) {
                    alert('All duplicates resolved!');
                }
            });
        });
    }

    renderDuplicatesView() {
        if (this.duplicateSets.length === 0) {
            // All duplicates resolved - return to queue
            this.closeDuplicatesPage(true);
            return;
        }

        const currentSet = this.duplicateSets[this.currentDuplicateSetIndex];
        const allItems = [
            { ...currentSet.raw_expense, type: 'raw', isMain: true },
            ...currentSet.duplicates
        ];

        const html = `
            <div class="duplicates-page">
                <div class="duplicates-page-header">
                    <h1 class="duplicates-page-title">Resolve Duplicates</h1>
                    <p class="duplicates-page-subtitle">
                        Review and resolve transactions with matching amounts and dates
                    </p>
                </div>
                
                <div class="duplicate-set-container">
                    <div class="duplicate-set-header">
                        <div class="duplicate-set-title">
                            Duplicate Set ${this.currentDuplicateSetIndex + 1} of ${this.duplicateSets.length}
                        </div>
                        <div class="duplicate-set-navigation">
                            ${this.duplicateSets.length > 1 ? 'Use ← → to navigate between sets' : ''}
                        </div>
                    </div>
                    
                    <div class="duplicate-set-list">
                        ${allItems.map((item, index) => this.renderDuplicateTransactionCard(item, index)).join('')}
                    </div>
                </div>
                
                <div class="duplicates-page-footer">
                    <div class="keyboard-hints">
                        <span class="keyboard-hint">↑↓ Navigate Items</span>
                        ${this.duplicateSets.length > 1 ? '<span class="keyboard-hint">←→ Navigate Sets</span>' : ''}
                        <span class="keyboard-hint">X Discard</span>
                        <span class="keyboard-hint">S Save</span>
                        <span class="keyboard-hint">Esc Return to Queue</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('queueContent').innerHTML = html;
    }

    renderDuplicateTransactionCard(item, index) {
        const isFocused = index === this.focusedDuplicateItemIndex;
        const isSaved = item.type === 'saved';
        const isRaw = item.type === 'raw';

        let cardClass = 'duplicate-transaction-card';
        if (isFocused) cardClass += ' focused';
        if (isSaved) cardClass += ' saved-expense';

        return `
            <div class="${cardClass}" data-index="${index}" onclick="queueProcessor.focusDuplicateTransaction(${index})">
                <div class="duplicate-transaction-header">
                    <span class="duplicate-transaction-type ${isSaved ? 'saved' : 'raw'}">
                        ${isSaved ? 'Saved Expense' : 'Unprocessed'}
                    </span>
                    ${isFocused ? '<span style="color: #007bff; font-weight: 600;">● Focused</span>' : ''}
                </div>
                
                <div class="duplicate-transaction-details">
                    <div class="duplicate-detail-row">
                        <span class="duplicate-detail-label">Date:</span>
                        <span class="duplicate-detail-value">${escapeHtml(this.formatDate(item.transaction_date))}</span>
                    </div>
                    <div class="duplicate-detail-row">
                        <span class="duplicate-detail-label">Amount:</span>
                        <span class="duplicate-detail-value ${parseFloat(item.amount) < 0 ? 'negative' : 'positive'}">
                            ${parseFloat(item.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(item.amount)).toFixed(2)}
                        </span>
                    </div>
                    <div class="duplicate-detail-row">
                        <span class="duplicate-detail-label">Merchant:</span>
                        <span class="duplicate-detail-value">
                            ${escapeHtml(isSaved ? (item.merchant_alias || 'N/A') : (item.raw_merchant_name || 'Unknown'))}
                        </span>
                    </div>
                    ${isSaved && item.category ? `
                    <div class="duplicate-detail-row">
                        <span class="duplicate-detail-label">Category:</span>
                        <span class="duplicate-detail-value">${escapeHtml(item.category)}</span>
                    </div>
                    ` : ''}
                    ${(isSaved ? item.description : item.raw_description) ? `
                    <div class="duplicate-detail-row">
                        <span class="duplicate-detail-label">Description:</span>
                        <span class="duplicate-detail-value">${escapeHtml(isSaved ? item.description : item.raw_description)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="duplicate-transaction-actions">
                    ${isRaw ? `
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); queueProcessor.discardFromDuplicatesPage(${item.id})">
                            Discard <kbd>X</kbd>
                        </button>
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); queueProcessor.saveFromDuplicatesPage(${item.id})">
                            Save <kbd>S</kbd>
                        </button>
                    ` : `
                        <span class="saved-badge">Already Saved${item.archived ? ' (Archived)' : ''}</span>
                    `}
                </div>
            </div>
        `;
    }

    focusDuplicateTransaction(index) {
        this.focusedDuplicateItemIndex = index;
        this.renderDuplicatesView();
    }

    handleDuplicatesPageKeyboard(e) {
        if (!this.duplicatesViewMode) return;

        // Escape - return to queue
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeDuplicatesPage(false);
            return;
        }

        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        const currentSet = this.duplicateSets[this.currentDuplicateSetIndex];
        const allItems = [
            { ...currentSet.raw_expense, type: 'raw' },
            ...currentSet.duplicates
        ];

        // Up/Down - navigate within current set
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.focusedDuplicateItemIndex < allItems.length - 1) {
                this.focusedDuplicateItemIndex++;
                this.renderDuplicatesView();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.focusedDuplicateItemIndex > 0) {
                this.focusedDuplicateItemIndex--;
                this.renderDuplicatesView();
            }
        }

        // Left/Right - navigate between sets
        else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (this.currentDuplicateSetIndex > 0) {
                this.currentDuplicateSetIndex--;
                this.focusedDuplicateItemIndex = 0;
                this.renderDuplicatesView();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (this.currentDuplicateSetIndex < this.duplicateSets.length - 1) {
                this.currentDuplicateSetIndex++;
                this.focusedDuplicateItemIndex = 0;
                this.renderDuplicatesView();
            }
        }

        // X - discard focused item
        else if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            const focusedItem = allItems[this.focusedDuplicateItemIndex];
            if (focusedItem && focusedItem.type === 'raw') {
                this.discardFromDuplicatesPage(focusedItem.id);
            }
        }

        // S - save focused item
        else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            const focusedItem = allItems[this.focusedDuplicateItemIndex];
            if (focusedItem && focusedItem.type === 'raw') {
                this.saveFromDuplicatesPage(focusedItem.id);
            }
        }
    }

    async discardFromDuplicatesPage(rawExpenseId) {
        if (!confirm('Are you sure you want to discard this transaction?')) return;

        try {
            const response = await fetch(`/api/queue/${rawExpenseId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to discard item');
            }

            // Remove from queue items
            this.queueItems = this.queueItems.filter(item => item.id !== rawExpenseId);

            // Update duplicate sets - remove this item from current set
            const currentSet = this.duplicateSets[this.currentDuplicateSetIndex];

            // Check if this is the main raw_expense or a duplicate
            if (currentSet.raw_expense.id === rawExpenseId) {
                // Main item discarded - remove entire set
                this.duplicateSets.splice(this.currentDuplicateSetIndex, 1);

                // Adjust current index if needed
                if (this.currentDuplicateSetIndex >= this.duplicateSets.length && this.duplicateSets.length > 0) {
                    this.currentDuplicateSetIndex = this.duplicateSets.length - 1;
                }
            } else {
                // Remove from duplicates array
                currentSet.duplicates = currentSet.duplicates.filter(
                    dup => !(dup.type === 'raw' && dup.id === rawExpenseId)
                );

                // If only main item left (or only saved items), remove the set
                const rawDuplicatesLeft = currentSet.duplicates.filter(d => d.type === 'raw').length;
                if (rawDuplicatesLeft === 0) {
                    this.duplicateSets.splice(this.currentDuplicateSetIndex, 1);
                    if (this.currentDuplicateSetIndex >= this.duplicateSets.length && this.duplicateSets.length > 0) {
                        this.currentDuplicateSetIndex = this.duplicateSets.length - 1;
                    }
                }
            }

            this.focusedDuplicateItemIndex = 0;
            await this.updateQueueCount();

            // Re-render or close if done
            this.renderDuplicatesView();

        } catch (error) {
            console.error('Error discarding item:', error);
            alert('Error discarding item: ' + error.message);
        }
    }

    async saveFromDuplicatesPage(rawExpenseId) {
        // Find the item in queue
        const item = this.queueItems.find(i => i.id === rawExpenseId);
        if (!item) {
            alert('Error: Item not found');
            return;
        }

        // Check for required fields
        const hasMerchant = item.merchant_alias_id || item.suggested_merchant_alias;
        const hasCategory = item.category_id || item.suggested_category_id;

        if (!hasMerchant || !hasCategory) {
            alert('This item is missing category or merchant. Please process it from the main queue first.');
            return;
        }

        // Apply suggestions if needed
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

        if (!confirm('Save this expense?')) return;

        try {
            const response = await fetch('/api/queue/bulk-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw_expense_ids: [rawExpenseId] })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Save failed');
            }

            const result = await response.json();

            if (result.failed_count > 0) {
                alert(`Save failed: ${result.errors.join(', ')}`);
                return;
            }

            // Remove from queue items
            this.queueItems = this.queueItems.filter(i => i.id !== rawExpenseId);

            // Update duplicate sets
            const currentSet = this.duplicateSets[this.currentDuplicateSetIndex];

            if (currentSet.raw_expense.id === rawExpenseId) {
                this.duplicateSets.splice(this.currentDuplicateSetIndex, 1);
                if (this.currentDuplicateSetIndex >= this.duplicateSets.length && this.duplicateSets.length > 0) {
                    this.currentDuplicateSetIndex = this.duplicateSets.length - 1;
                }
            } else {
                currentSet.duplicates = currentSet.duplicates.filter(
                    dup => !(dup.type === 'raw' && dup.id === rawExpenseId)
                );

                const rawDuplicatesLeft = currentSet.duplicates.filter(d => d.type === 'raw').length;
                if (rawDuplicatesLeft === 0) {
                    this.duplicateSets.splice(this.currentDuplicateSetIndex, 1);
                    if (this.currentDuplicateSetIndex >= this.duplicateSets.length && this.duplicateSets.length > 0) {
                        this.currentDuplicateSetIndex = this.duplicateSets.length - 1;
                    }
                }
            }

            this.focusedDuplicateItemIndex = 0;
            await this.updateQueueCount();

            this.renderDuplicatesView();

        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Error saving expense: ' + error.message);
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
                <a href="/" class="btn btn-primary" style="margin-top: 2rem;">View Expenses</a>
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
