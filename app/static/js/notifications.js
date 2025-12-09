// Notifications Parser JavaScript

class NotificationManager {
    constructor() {
        this.parsedExpenses = [];
        this.editedExpenses = new Map(); // Track edits by notification_id
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateQueueCount();
    }

    bindEvents() {
        document.getElementById('parseAllBtn').addEventListener('click', () => this.parseAllNotifications());
        document.getElementById('acceptAllBtn').addEventListener('click', () => this.acceptAllExpenses());
    }

    async updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            const data = await response.json();
            const badge = document.getElementById('queueCount');
            if (badge) {
                badge.textContent = data.count;
                badge.style.display = data.count > 0 ? 'inline-block' : 'none';
            }
        } catch (error) {
            console.error('Error fetching queue count:', error);
        }
    }

    async parseAllNotifications() {
        const btn = document.getElementById('parseAllBtn');
        const statusEl = document.getElementById('notificationStatus');
        
        btn.disabled = true;
        btn.textContent = 'Parsing...';
        statusEl.textContent = 'Parsing notifications...';

        try {
            const response = await fetch('/api/notifications/parse-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to parse notifications');
            }

            const data = await response.json();
            this.parsedExpenses = data.parsed_expenses;
            this.editedExpenses.clear();

            this.displayResults(data);
            
            statusEl.textContent = `Parsed ${data.parsed_count} expenses from ${data.total_notifications} notifications`;
            
        } catch (error) {
            console.error('Error parsing notifications:', error);
            alert('Failed to parse notifications: ' + error.message);
            statusEl.textContent = 'Error parsing notifications';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Parse All Notifications';
        }
    }

    displayResults(data) {
        // Update stats
        document.getElementById('totalNotifications').textContent = data.total_notifications;
        document.getElementById('parsedCount').textContent = data.parsed_count;
        document.getElementById('discardedCount').textContent = data.discarded_count;
        document.getElementById('alreadyProcessedCount').textContent = data.already_processed_count;

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';

        // Show accept button if there are parsed expenses
        const acceptBtn = document.getElementById('acceptAllBtn');
        if (data.parsed_count > 0) {
            acceptBtn.style.display = 'block';
        } else {
            acceptBtn.style.display = 'none';
        }

        // Render expenses list
        this.renderExpensesList();
    }

    renderExpensesList() {
        const container = document.getElementById('parsedExpensesList');
        container.innerHTML = '';

        if (this.parsedExpenses.length === 0) {
            container.innerHTML = '<p>No expenses to display</p>';
            return;
        }

        this.parsedExpenses.forEach(expense => {
            const card = this.createExpenseCard(expense);
            container.appendChild(card);
        });
    }

    createExpenseCard(expense) {
        const card = document.createElement('div');
        card.className = 'expense-card';
        card.style.cssText = `
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        `;

        // Get edited values if they exist
        const edited = this.editedExpenses.get(expense.notification_id) || {};
        const merchantName = edited.merchant_name || expense.merchant_name;
        const amount = edited.amount !== undefined ? edited.amount : expense.amount;
        const transactionDate = edited.transaction_date || expense.transaction_date;

        card.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Merchant</label>
                    <input type="text" class="merchant-input" value="${this.escapeHtml(merchantName)}" 
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px;"
                           data-notification-id="${expense.notification_id}">
                </div>
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Amount</label>
                    <input type="number" class="amount-input" value="${amount}" step="0.01"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px;"
                           data-notification-id="${expense.notification_id}">
                </div>
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Date</label>
                    <input type="date" class="date-input" value="${transactionDate}"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px;"
                           data-notification-id="${expense.notification_id}">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Bank Account</label>
                    <input type="text" class="bank-input" value="${this.escapeHtml(expense.bank_account_name)}" readonly
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; background: #f8f9fa;">
                </div>
                <div>
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Currency</label>
                    <input type="text" value="${expense.currency}" readonly
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; background: #f8f9fa;">
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Description</label>
                <textarea readonly style="width: 100%; padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; background: #f8f9fa; resize: vertical;" rows="2">${this.escapeHtml(expense.raw_description)}</textarea>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.875rem; color: #6c757d;">
                    Pattern: ${expense.pattern_matched}
                    ${expense.latitude && expense.longitude ? ` | Location: ${expense.latitude.toFixed(6)}, ${expense.longitude.toFixed(6)}` : ''}
                </div>
                <button class="btn btn-danger btn-sm remove-expense-btn" data-notification-id="${expense.notification_id}">
                    Remove
                </button>
            </div>
        `;

        // Bind edit events
        const merchantInput = card.querySelector('.merchant-input');
        const amountInput = card.querySelector('.amount-input');
        const dateInput = card.querySelector('.date-input');

        merchantInput.addEventListener('input', (e) => this.onExpenseEdit(expense.notification_id, 'merchant_name', e.target.value));
        amountInput.addEventListener('input', (e) => this.onExpenseEdit(expense.notification_id, 'amount', parseFloat(e.target.value)));
        dateInput.addEventListener('input', (e) => this.onExpenseEdit(expense.notification_id, 'transaction_date', e.target.value));

        // Bind remove button
        const removeBtn = card.querySelector('.remove-expense-btn');
        removeBtn.addEventListener('click', () => this.removeExpense(expense.notification_id));

        return card;
    }

    onExpenseEdit(notificationId, field, value) {
        if (!this.editedExpenses.has(notificationId)) {
            this.editedExpenses.set(notificationId, {});
        }
        this.editedExpenses.get(notificationId)[field] = value;
    }

    async removeExpense(notificationId) {
        if (!confirm('Mark this notification as not an expense?')) {
            return;
        }

        try {
            // Mark the notification as discarded in the database
            const response = await fetch(`/api/notifications/discard/${notificationId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to discard notification');
            }

            // Remove from UI
            this.parsedExpenses = this.parsedExpenses.filter(e => e.notification_id !== notificationId);
            this.editedExpenses.delete(notificationId);
            this.renderExpensesList();
            
            // Update counts
            document.getElementById('parsedCount').textContent = this.parsedExpenses.length;
            const discardedCount = parseInt(document.getElementById('discardedCount').textContent);
            document.getElementById('discardedCount').textContent = discardedCount + 1;
            
            // Hide accept button if no expenses left
            if (this.parsedExpenses.length === 0) {
                document.getElementById('acceptAllBtn').style.display = 'none';
            }
        } catch (error) {
            console.error('Error discarding notification:', error);
            alert('Failed to discard notification: ' + error.message);
        }
    }

    async acceptAllExpenses() {
        if (this.parsedExpenses.length === 0) {
            alert('No expenses to accept');
            return;
        }

        const btn = document.getElementById('acceptAllBtn');
        const statusEl = document.getElementById('notificationStatus');

        btn.disabled = true;
        btn.textContent = 'Accepting...';
        statusEl.textContent = 'Saving expenses...';

        try {
            // Prepare expenses with edited values
            const expensesToAccept = this.parsedExpenses.map(expense => {
                const edited = this.editedExpenses.get(expense.notification_id) || {};
                return {
                    notification_id: expense.notification_id,
                    merchant_name: edited.merchant_name || expense.merchant_name,
                    amount: edited.amount !== undefined ? edited.amount : expense.amount,
                    currency: expense.currency,
                    transaction_date: edited.transaction_date || expense.transaction_date,
                    raw_description: expense.raw_description,
                    bank_account_name: expense.bank_account_name,
                    latitude: expense.latitude,
                    longitude: expense.longitude
                };
            });

            const response = await fetch('/api/notifications/accept-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expensesToAccept)
            });

            if (!response.ok) {
                throw new Error('Failed to accept expenses');
            }

            const data = await response.json();
            
            statusEl.textContent = data.message;
            
            // Clear the list
            this.parsedExpenses = [];
            this.editedExpenses.clear();
            this.renderExpensesList();
            
            // Hide results section after a delay
            setTimeout(() => {
                document.getElementById('resultsSection').style.display = 'none';
                document.getElementById('acceptAllBtn').style.display = 'none';
                statusEl.textContent = 'Expenses saved successfully! Click "Parse All" to process more notifications.';
            }, 2000);

            // Update queue count
            this.updateQueueCount();

        } catch (error) {
            console.error('Error accepting expenses:', error);
            alert('Failed to accept expenses: ' + error.message);
            statusEl.textContent = 'Error saving expenses';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Accept All Expenses';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NotificationManager();
});
