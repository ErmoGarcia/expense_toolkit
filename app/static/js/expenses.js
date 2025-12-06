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
            const [categories, tags] = await Promise.all([
                fetch('/api/categories').then(r => r.json()),
                fetch('/api/tags').then(r => r.json())
            ]);

            this.populateSelect('categoryFilter', categories, 'id', 'name');
            this.populateSelect('tagsFilter', tags, 'id', 'name');
        } catch (error) {
            console.error('Error loading filters:', error);
        }
    }

    populateSelect(selectId, items, valueField, textField) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        // Clear existing options except the first one
        select.innerHTML = select.querySelector('option').outerHTML;
        
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
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
            const data = await response.json();

            this.renderExpenses(data.expenses || []);
            this.updatePagination(data);
            this.updateTotal(data.expenses || []);
        } catch (error) {
            console.error('Error loading expenses:', error);
            this.renderError('Failed to load expenses');
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
                        <th>Description</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Tags</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(expense => `
                        <tr>
                            <td>${this.formatDate(expense.transaction_date)}</td>
                            <td>
                                ${expense.merchant_alias?.display_name || 'Unknown'}
                                ${expense.is_group ? `<span class="expense-group-indicator" title="Grouped expense - Click to view details" onclick="expenseManager.showGroupDetails(${expense.id})">📦</span>` : ''}
                            </td>
                            <td>${expense.description || ''}</td>
                            <td>${expense.category?.name || ''}</td>
                            <td class="expense-amount ${parseFloat(expense.amount) < 0 ? 'negative' : 'positive'}">
                                £${Math.abs(parseFloat(expense.amount)).toFixed(2)}
                            </td>
                            <td>
                                ${(expense.tags || []).map(tag =>
                                    `<span class="expense-tag">#${tag.name}</span>`
                                ).join('')}
                            </td>
                            <td class="expense-indicator">
                                ${expense.periodic_expense ? '<span class="periodic-icon" title="Periodic">↻</span>' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    renderError(message) {
        document.getElementById('expensesContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                ${message}
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
            `Total: £${Math.abs(total).toFixed(2)}`;
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

    formatDate(dateString) {
        return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB');
    }

    async showGroupDetails(expenseId) {
        try {
            const response = await fetch(`/api/expenses/${expenseId}`);
            if (!response.ok) {
                throw new Error('Failed to load expense details');
            }
            
            const expense = await response.json();
            
            if (!expense.child_expenses || expense.child_expenses.length === 0) {
                alert('No child expenses found for this group.');
                return;
            }
            
            this.renderGroupModal(expense);
        } catch (error) {
            console.error('Error loading group details:', error);
            alert('Error loading group details: ' + error.message);
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
                                    <span class="detail-value">${this.formatDate(expense.transaction_date)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Merchant:</span>
                                    <span class="detail-value">${expense.merchant_alias?.display_name || 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Category:</span>
                                    <span class="detail-value">${expense.category?.name || 'Uncategorized'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Total Amount:</span>
                                    <span class="detail-value ${totalAmount < 0 ? 'negative' : 'positive'}">
                                        ${totalAmount < 0 ? '-' : ''}£${Math.abs(totalAmount).toFixed(2)}
                                    </span>
                                </div>
                                ${expense.description ? `
                                <div class="detail-row">
                                    <span class="detail-label">Description:</span>
                                    <span class="detail-value">${expense.description}</span>
                                </div>
                                ` : ''}
                                ${expense.tags && expense.tags.length > 0 ? `
                                <div class="detail-row">
                                    <span class="detail-label">Tags:</span>
                                    <span class="detail-value">
                                        ${expense.tags.map(tag => `<span class="expense-tag">#${tag.name}</span>`).join(' ')}
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
                                        ${childExpenses.map(child => `
                                            <tr>
                                                <td>${this.formatDate(child.transaction_date)}</td>
                                                <td>${child.merchant_alias?.display_name || 'Unknown'}</td>
                                                <td>${child.description || ''}</td>
                                                <td>${child.category?.name || ''}</td>
                                                <td class="expense-amount ${parseFloat(child.amount) < 0 ? 'negative' : 'positive'}">
                                                    ${parseFloat(child.amount) < 0 ? '-' : ''}£${Math.abs(parseFloat(child.amount)).toFixed(2)}
                                                </td>
                                                <td>
                                                    ${(child.tags || []).map(tag => 
                                                        `<span class="expense-tag">#${tag.name}</span>`
                                                    ).join('')}
                                                </td>
                                            </tr>
                                        `).join('')}
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
}

// Global instance for onclick handlers
let expenseManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    expenseManager = new ExpenseManager();
});