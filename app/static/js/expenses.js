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
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(expense => `
                        <tr>
                            <td>${this.formatDate(expense.transaction_date)}</td>
                            <td>${expense.merchant_alias?.display_name || 'Unknown'}</td>
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseManager();
});