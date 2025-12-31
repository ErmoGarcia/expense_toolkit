// Expense Management JavaScript

class ExpenseManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.filters = {
            category: '',
            tags: '',
            account: '',
            dateFrom: '',
            dateTo: '',
            search: ''
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadFilters();
        await this.loadExpenses();
        await this.updateQueueCount();
    }

    setupEventListeners() {
        // Filter changes
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.currentPage = 1;
            this.loadExpenses();
        });

        document.getElementById('tagsFilter').addEventListener('change', (e) => {
            this.filters.tags = e.target.value;
            this.currentPage = 1;
            this.loadExpenses();
        });

        document.getElementById('accountFilter').addEventListener('change', (e) => {
            this.filters.account = e.target.value;
            this.currentPage = 1;
            this.loadExpenses();
        });

        document.getElementById('dateFrom').addEventListener('change', (e) => {
            this.filters.dateFrom = e.target.value;
            this.currentPage = 1;
            this.loadExpenses();
        });

        document.getElementById('dateTo').addEventListener('change', (e) => {
            this.filters.dateTo = e.target.value;
            this.currentPage = 1;
            this.loadExpenses();
        });

        // Search with debounce
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filters.search = e.target.value;
                this.currentPage = 1;
                this.loadExpenses();
            }, 500);
        });

        // Pagination
        document.getElementById('prevBtn').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadExpenses();
            }
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            this.currentPage++;
            this.loadExpenses();
        });
    }

    async loadFilters() {
        try {
            const [categoriesRes, tagsRes] = await Promise.all([
                fetch('/api/categories'),
                fetch('/api/tags')
            ]);

            if (!categoriesRes.ok || !tagsRes.ok) {
                throw new Error('Failed to load filters');
            }

            const categories = await categoriesRes.json();
            const tags = await tagsRes.json();

            this.categories = categories;
            this.populateCategorySelect('categoryFilter', categories);
            this.populateSelect('tagsFilter', tags, 'id', 'name');
        } catch (error) {
            console.error('Error loading filters:', error);
            showToast('Failed to load filters', 'error');
        }
    }

    populateCategorySelect(selectId, categories) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        const firstOption = select.querySelector('option');

        // Clear existing options except the first one
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }

        // Sort categories: parents first, then children
        const parents = categories.filter(cat => !cat.parent_id);
        const children = categories.filter(cat => cat.parent_id);

        // Add parent categories
        parents.forEach(parent => {
            const option = document.createElement('option');
            option.value = parent.id;
            option.textContent = parent.name;  // textContent is safe from XSS
            select.appendChild(option);

            // Add children of this parent
            const parentChildren = children.filter(child => child.parent_id === parent.id);
            parentChildren.forEach(child => {
                const childOption = document.createElement('option');
                childOption.value = child.id;
                childOption.textContent = '  \u21B3 ' + child.name;  // Unicode arrow
                select.appendChild(childOption);
            });
        });

        select.value = currentValue;
    }

    populateSelect(selectId, items, valueField, textField) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        const firstOption = select.querySelector('option');

        // Clear existing options except the first one
        select.innerHTML = '';
        if (firstOption) {
            select.appendChild(firstOption);
        }

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];  // textContent is safe from XSS
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    async loadExpenses() {
        try {
            const params = new URLSearchParams({
                skip: (this.currentPage - 1) * this.pageSize,
                limit: this.pageSize,
                ...Object.fromEntries(Object.entries(this.filters).filter(([_, v]) => v))
            });

            const response = await fetch(`/api/expenses?${params}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to load expenses');
            }
            const data = await response.json();

            this.renderExpenses(data.expenses || []);
            this.updatePagination(data);
            this.updateTotal(data.expenses || []);
        } catch (error) {
            console.error('Error loading expenses:', error);
            this.renderError('Failed to load expenses: ' + error.message);
        }
    }

    renderExpenses(expenses) {
        const container = document.getElementById('expensesContent');

        if (expenses.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6c757d;">
                    No expenses found. Try adjusting your filters.
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Merchant</th>
                        <th style="width: 250px;">Description</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Tags</th>
                        <th style="width: 120px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(expense => this.renderExpenseRow(expense)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    renderExpenseRow(expense) {
        const merchantName = expense.merchant_alias?.display_name || 'Unknown';
        const description = expense.description || '';
        const categoryName = expense.category?.name || '';
        const amount = parseFloat(expense.amount);
        const isNegative = amount < 0;
        const expenseType = expense.type || '';

        // Safely render tags vertically
        const tagsHtml = (expense.tags || []).map(tag =>
            `<span class="expense-tag">#${escapeHtml(tag.name)}</span>`
        ).join('');

        // Determine type class for row border color
        let typeClass = '';
        if (expenseType === 'discretionary') {
            typeClass = 'expense-type-discretionary';
        } else if (expenseType === 'fixed') {
            typeClass = 'expense-type-fixed';
        } else if (expenseType === 'necessary variable') {
            typeClass = 'expense-type-necessary';
        }

        return `
            <tr class="${typeClass}">
                <td>${escapeHtml(this.formatDate(expense.transaction_date))}</td>
                <td>
                    ${escapeHtml(merchantName)}
                    ${expense.is_group ? `<span class="expense-group-indicator" title="Grouped expense - Click to view details" onclick="expenseManager.showGroupDetails(${parseInt(expense.id)})">&#128230;</span>` : ''}
                </td>
                <td>${escapeHtml(description)}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td class="expense-amount ${isNegative ? 'negative' : 'positive'}">
                    ${formatCurrency(amount, expense.currency || 'GBP')}
                </td>
                <td class="expense-tags-cell">${tagsHtml}</td>
                <td class="expense-actions">
                    <button class="action-icon-btn" onclick="expenseManager.requeueExpense(${parseInt(expense.id)}, ${expense.raw_expense_id ? parseInt(expense.raw_expense_id) : 'null'})" title="Send to Queue" aria-label="Send to Queue">
                        <span class="action-icon">&#8617;</span>
                    </button>
                    <button class="action-icon-btn" onclick="expenseManager.openEditModal(${parseInt(expense.id)})" title="Edit Expense" aria-label="Edit Expense">
                        <span class="action-icon">&#9998;</span>
                    </button>
                    <button class="action-icon-btn delete-btn" onclick="expenseManager.deleteExpense(${parseInt(expense.id)})" title="Delete Expense" aria-label="Delete Expense">
                        <span class="action-icon">&#128465;</span>
                    </button>
                </td>
            </tr>
        `;
    }

    renderError(message) {
        document.getElementById('expensesContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                ${escapeHtml(message)}
            </div>
        `;
    }

    updatePagination(data) {
        const totalPages = Math.ceil(data.total / this.pageSize);

        document.getElementById('pageInfo').textContent =
            `Page ${this.currentPage} of ${totalPages}`;

        document.getElementById('prevBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextBtn').disabled = this.currentPage >= totalPages;
    }

    updateTotal(expenses) {
        const total = expenses.reduce((sum, expense) =>
            sum + parseFloat(expense.amount), 0);

        document.getElementById('totalAmount').textContent =
            `Total: ${formatCurrency(total)}`;
    }

    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            if (!response.ok) {
                throw new Error('Failed to load queue count');
            }
            const data = await response.json();
            document.getElementById('queueCount').textContent = data.count || 0;
        } catch (error) {
            console.error('Error loading queue count:', error);
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB');
    }

    async showGroupDetails(expenseId) {
        try {
            const response = await fetch(`/api/expenses/${expenseId}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to load expense details');
            }

            const expense = await response.json();

            if (!expense.child_expenses || expense.child_expenses.length === 0) {
                showToast('No child expenses found for this group.', 'info');
                return;
            }

            this.renderGroupModal(expense);
        } catch (error) {
            console.error('Error loading group details:', error);
            showToast('Error loading group details: ' + error.message, 'error');
        }
    }

    renderGroupModal(expense) {
        const childExpenses = expense.child_expenses || [];
        const totalAmount = parseFloat(expense.amount);

        const modalHtml = `
            <div class="modal-overlay" id="groupDetailsModal" onclick="expenseManager.handleModalClick(event)">
                <div class="modal-content large-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Grouped Expense Details</h2>
                        <button class="modal-close" onclick="expenseManager.closeGroupModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="group-parent-info">
                            <h3>Parent Expense</h3>
                            <div class="group-parent-details">
                                <div class="detail-row">
                                    <span class="detail-label">Date:</span>
                                    <span class="detail-value">${escapeHtml(this.formatDate(expense.transaction_date))}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Merchant:</span>
                                    <span class="detail-value">${escapeHtml(expense.merchant_alias?.display_name || 'Unknown')}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Category:</span>
                                    <span class="detail-value">${escapeHtml(expense.category?.name || 'Uncategorized')}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Total Amount:</span>
                                    <span class="detail-value ${totalAmount < 0 ? 'negative' : 'positive'}">
                                        ${formatCurrency(totalAmount, expense.currency || 'GBP')}
                                    </span>
                                </div>
                                ${expense.description ? `
                                <div class="detail-row">
                                    <span class="detail-label">Description:</span>
                                    <span class="detail-value">${escapeHtml(expense.description)}</span>
                                </div>
                                ` : ''}
                                ${expense.tags && expense.tags.length > 0 ? `
                                <div class="detail-row">
                                    <span class="detail-label">Tags:</span>
                                    <span class="detail-value">
                                        ${expense.tags.map(tag => `<span class="expense-tag">#${escapeHtml(tag.name)}</span>`).join(' ')}
                                    </span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="group-children-section">
                            <h3>Child Expenses (${childExpenses.length})</h3>
                            <div class="group-children-table">
                                <table class="expenses-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Merchant</th>
                                            <th>Description</th>
                                            <th>Category</th>
                                            <th>Amount</th>
                                            <th>Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${childExpenses.map(child => this.renderChildExpenseRow(child)).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="expenseManager.closeGroupModal()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove any existing modal
        this.closeGroupModal();

        // Add modal to body
        const modalContainer = document.createElement('div');
        modalContainer.id = 'groupModalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Add keyboard listener for Escape
        document.addEventListener('keydown', this.handleModalKeydown);
    }

    renderChildExpenseRow(child) {
        const childAmount = parseFloat(child.amount);
        return `
            <tr>
                <td>${escapeHtml(this.formatDate(child.transaction_date))}</td>
                <td>${escapeHtml(child.merchant_alias?.display_name || 'Unknown')}</td>
                <td>${escapeHtml(child.description || '')}</td>
                <td>${escapeHtml(child.category?.name || '')}</td>
                <td class="expense-amount ${childAmount < 0 ? 'negative' : 'positive'}">
                    ${formatCurrency(childAmount, child.currency || 'GBP')}
                </td>
                <td>
                    ${(child.tags || []).map(tag =>
            `<span class="expense-tag">#${escapeHtml(tag.name)}</span>`
        ).join('')}
                </td>
            </tr>
        `;
    }

    handleModalClick(event) {
        if (event.target.id === 'groupDetailsModal') {
            this.closeGroupModal();
        }
    }

    handleModalKeydown = (event) => {
        if (event.key === 'Escape') {
            this.closeGroupModal();
        }
    }

    closeGroupModal() {
        const modalContainer = document.getElementById('groupModalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        document.removeEventListener('keydown', this.handleModalKeydown);
    }

    async openEditModal(expenseId) {
        try {
            const response = await fetch(`/api/expenses/${expenseId}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to load expense details');
            }

            const expense = await response.json();
            this.renderEditModal(expense);
        } catch (error) {
            console.error('Error loading expense for edit:', error);
            showToast('Error loading expense: ' + error.message, 'error');
        }
    }

    renderEditModal(expense) {
        const modalHtml = `
            <div class="modal-overlay" id="editExpenseModal" onclick="expenseManager.handleEditModalClick(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Expense</h2>
                        <button class="modal-close" onclick="expenseManager.closeEditModal()">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <form id="editExpenseForm">
                            <div class="form-group">
                                <label for="editMerchant">Merchant</label>
                                <input type="text" id="editMerchant" value="${escapeHtml(expense.merchant_alias?.display_name || '')}" disabled>
                            </div>
                            
                            <div class="form-group">
                                <label for="editDescription">Description</label>
                                <textarea id="editDescription" rows="2">${escapeHtml(expense.description || '')}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="editCategory">Category</label>
                                <select id="editCategory">
                                    <option value="">Select Category</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="editAmount">Amount</label>
                                <input type="number" id="editAmount" step="0.01" value="${parseFloat(expense.amount)}">
                            </div>
                            
                            <div class="form-group">
                                <label for="editDate">Date</label>
                                <input type="date" id="editDate" value="${expense.transaction_date}">
                            </div>
                        </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="expenseManager.closeEditModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" onclick="expenseManager.saveExpense(${parseInt(expense.id)})">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove any existing modal
        this.closeEditModal();

        // Add modal to body
        const modalContainer = document.createElement('div');
        modalContainer.id = 'editModalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Populate category dropdown
        this.populateCategorySelect('editCategory', this.categories);
        document.getElementById('editCategory').value = expense.category?.id || '';

        // Add keyboard listener for Escape
        document.addEventListener('keydown', this.handleEditModalKeydown);
    }

    handleEditModalClick(event) {
        if (event.target.id === 'editExpenseModal') {
            this.closeEditModal();
        }
    }

    handleEditModalKeydown = (event) => {
        if (event.key === 'Escape') {
            this.closeEditModal();
        }
    }

    closeEditModal() {
        const modalContainer = document.getElementById('editModalContainer');
        if (modalContainer) {
            modalContainer.remove();
        }
        document.removeEventListener('keydown', this.handleEditModalKeydown);
    }

    async saveExpense(expenseId) {
        try {
            const description = document.getElementById('editDescription').value;
            const categoryId = document.getElementById('editCategory').value;
            const amount = parseFloat(document.getElementById('editAmount').value);
            const date = document.getElementById('editDate').value;

            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: description,
                    category_id: categoryId ? parseInt(categoryId) : null,
                    amount: amount,
                    transaction_date: date
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to update expense');
            }

            showToast('Expense updated successfully!', 'success');
            this.closeEditModal();
            await this.loadExpenses();
        } catch (error) {
            console.error('Error updating expense:', error);
            showToast('Error: ' + error.message, 'error');
        }
    }

    async deleteExpense(expenseId) {
        if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to delete expense');
            }

            showToast('Expense deleted successfully!', 'success');
            await this.loadExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('Error: ' + error.message, 'error');
        }
    }

    async requeueExpense(expenseId, rawExpenseId) {
        if (!rawExpenseId) {
            showToast('This expense cannot be sent back to the queue because it has no associated raw expense.', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to send this expense back to the queue for reprocessing?')) {
            return;
        }

        try {
            const response = await fetch(`/api/expenses/${expenseId}/requeue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to requeue expense');
            }

            showToast('Expense sent back to queue successfully!', 'success');

            // Reload the expenses and update queue count
            await this.loadExpenses();
            await this.updateQueueCount();
        } catch (error) {
            console.error('Error requeuing expense:', error);
            showToast('Error: ' + error.message, 'error');
        }
    }
}

// Global instance for onclick handlers
let expenseManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    expenseManager = new ExpenseManager();
});
