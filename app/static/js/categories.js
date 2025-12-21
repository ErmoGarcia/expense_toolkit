// Category Management JavaScript

class CategoryManager {
    constructor() {
        this.categories = [];
        this.currentCategoryId = null;
        this.activeTab = 'expense';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCategories();
        await this.updateQueueCount();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.type);
            });
        });

        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.showModal();
        });

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        // Close modal on overlay click
        document.getElementById('categoryModal').addEventListener('click', (e) => {
            if (e.target.id === 'categoryModal') {
                this.hideModal();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    }

    switchTab(type) {
        this.activeTab = type;
        
        // Update tab UI
        document.querySelectorAll('.category-tab').forEach(tab => {
            if (tab.dataset.type === type) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        this.renderCategories();
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) {
                throw new Error('Failed to load categories');
            }
            
            this.categories = await response.json();
            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.renderError('Failed to load categories');
        }
    }

    renderCategories() {
        const container = document.getElementById('categoriesContent');
        
        // Filter categories by active tab
        const filteredCategories = this.categories.filter(cat => 
            cat.category_type === this.activeTab
        );
        
        if (filteredCategories.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #6c757d;">
                    No ${this.activeTab} categories found. Click "Add Category" to create one.
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Color</th>
                        <th>Icon</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredCategories.map(category => `
                        <tr>
                            <td>${category.name}</td>
                            <td>
                                ${category.color ? `
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div style="width: 30px; height: 20px; background-color: ${category.color}; border: 1px solid #ccc; border-radius: 4px;"></div>
                                        <span style="color: #6c757d; font-size: 0.9rem;">${category.color}</span>
                                    </div>
                                ` : '<span style="color: #6c757d;">-</span>'}
                            </td>
                            <td>${category.icon ? `<span style="font-size: 1.5rem;">${category.icon}</span>` : '<span style="color: #6c757d;">-</span>'}</td>
                            <td>${this.formatDate(category.created_at)}</td>
                            <td>
                                <button class="btn btn-small btn-primary" onclick="categoryManager.editCategory(${category.id})">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="categoryManager.deleteCategory(${category.id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    renderError(message) {
        document.getElementById('categoriesContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                ${message}
            </div>
        `;
    }

    showModal(category = null) {
        const modal = document.getElementById('categoryModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('categoryForm');
        
        if (category) {
            // Edit mode
            this.currentCategoryId = category.id;
            modalTitle.textContent = 'Edit Category';
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryType').value = category.category_type || 'expense';
            document.getElementById('categoryColor').value = category.color || '#007bff';
            document.getElementById('categoryIcon').value = category.icon || '';
        } else {
            // Add mode
            this.currentCategoryId = null;
            modalTitle.textContent = 'Add Category';
            form.reset();
            document.getElementById('categoryType').value = this.activeTab;
            document.getElementById('categoryColor').value = '#007bff';
        }
        
        modal.style.display = 'flex';
        document.getElementById('categoryName').focus();
    }

    hideModal() {
        const modal = document.getElementById('categoryModal');
        modal.style.display = 'none';
        document.getElementById('categoryForm').reset();
        this.currentCategoryId = null;
    }

    async saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const categoryType = document.getElementById('categoryType').value;
        const color = document.getElementById('categoryColor').value;
        const icon = document.getElementById('categoryIcon').value.trim();

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        const data = {
            name: name,
            category_type: categoryType,
            color: color,
            icon: icon || null
        };

        try {
            let response;
            
            if (this.currentCategoryId) {
                // Update existing category
                response = await fetch(`/api/categories/${this.currentCategoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            } else {
                // Create new category
                response = await fetch('/api/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to save category');
            }

            this.hideModal();
            await this.loadCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error saving category: ' + error.message);
        }
    }

    editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
            this.showModal(category);
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete category');
            }

            await this.loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error deleting category: ' + error.message);
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

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Global instance for onclick handlers
let categoryManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    categoryManager = new CategoryManager();
});
