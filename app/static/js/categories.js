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

        // Update parent options when type changes
        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'categoryType') {
                this.updateParentOptions();
            }
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to load categories');
            }
            
            this.categories = await response.json();
            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.renderError('Failed to load categories: ' + escapeHtml(error.message));
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
                    No ${escapeHtml(this.activeTab)} categories found. Click "Add Category" to create one.
                </div>
            `;
            return;
        }

        // Organize into hierarchy
        const hierarchy = this.buildHierarchy(filteredCategories);

        const tableHTML = `
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Parent</th>
                        <th>Color</th>
                        <th>Icon</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.renderCategoryRows(hierarchy, 0)}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    buildHierarchy(categories) {
        // Separate parent and child categories
        const parents = categories.filter(cat => !cat.parent_id);
        const children = categories.filter(cat => cat.parent_id);
        
        // Build tree structure
        return parents.map(parent => ({
            ...parent,
            children: children.filter(child => child.parent_id === parent.id)
        }));
    }

    renderCategoryRows(categories, level) {
        let html = '';
        
        for (const category of categories) {
            const indent = level > 0 ? '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(level) + '&#8627; ' : '';
            const parentName = category.parent_id 
                ? this.categories.find(c => c.id === category.parent_id)?.name || '-'
                : '-';
            
            // Validate color is a valid hex color to prevent injection
            const safeColor = this.isValidHexColor(category.color) ? category.color : '#cccccc';
            
            html += `
                <tr>
                    <td>${indent}${escapeHtml(category.name)}</td>
                    <td>${escapeHtml(parentName)}</td>
                    <td>
                        ${category.color ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="width: 30px; height: 20px; background-color: ${safeColor}; border: 1px solid #ccc; border-radius: 4px;"></div>
                                <span style="color: #6c757d; font-size: 0.9rem;">${escapeHtml(category.color)}</span>
                            </div>
                        ` : '<span style="color: #6c757d;">-</span>'}
                    </td>
                    <td>${category.icon ? `<span style="font-size: 1.5rem;">${escapeHtml(category.icon)}</span>` : '<span style="color: #6c757d;">-</span>'}</td>
                    <td>${escapeHtml(this.formatDate(category.created_at))}</td>
                    <td>
                        <button class="btn btn-small btn-primary" onclick="categoryManager.editCategory(${parseInt(category.id)})">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="categoryManager.deleteCategory(${parseInt(category.id)})">Delete</button>
                    </td>
                </tr>
            `;
            
            // Render children
            if (category.children && category.children.length > 0) {
                html += this.renderCategoryRows(category.children, level + 1);
            }
        }
        
        return html;
    }

    isValidHexColor(color) {
        if (!color) return false;
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }

    renderError(message) {
        document.getElementById('categoriesContent').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545;">
                ${escapeHtml(message)}
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
            document.getElementById('categoryName').value = category.name || '';
            document.getElementById('categoryType').value = category.category_type || 'expense';
            document.getElementById('categoryColor').value = this.isValidHexColor(category.color) ? category.color : '#007bff';
            document.getElementById('categoryIcon').value = category.icon || '';
            
            // Update parent options first, then set value
            this.updateParentOptions();
            document.getElementById('categoryParent').value = category.parent_id || '';
        } else {
            // Add mode
            this.currentCategoryId = null;
            modalTitle.textContent = 'Add Category';
            form.reset();
            document.getElementById('categoryType').value = this.activeTab;
            document.getElementById('categoryColor').value = '#007bff';
            
            // Update parent options for the active tab
            this.updateParentOptions();
        }
        
        modal.style.display = 'flex';
        document.getElementById('categoryName').focus();
    }

    updateParentOptions() {
        const typeSelect = document.getElementById('categoryType');
        const parentSelect = document.getElementById('categoryParent');
        const selectedType = typeSelect.value;
        
        // Get categories of same type, excluding current category being edited
        const availableParents = this.categories.filter(cat => 
            cat.category_type === selectedType && 
            cat.id !== this.currentCategoryId &&
            !cat.parent_id  // Only show top-level categories as parents
        );
        
        // Rebuild parent options
        parentSelect.innerHTML = '<option value="">None (Top-level category)</option>';
        availableParents.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;  // textContent is safe from XSS
            parentSelect.appendChild(option);
        });
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
        const parentId = document.getElementById('categoryParent').value;
        const color = document.getElementById('categoryColor').value;
        const icon = document.getElementById('categoryIcon').value.trim();

        if (!name) {
            showToast('Please enter a category name', 'warning');
            return;
        }

        if (name.length > 100) {
            showToast('Category name must be 100 characters or less', 'warning');
            return;
        }

        const data = {
            name: name,
            category_type: categoryType,
            parent_id: parentId ? parseInt(parentId) : null,
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to save category');
            }

            this.hideModal();
            await this.loadCategories();
            showToast('Category saved successfully', 'success');
        } catch (error) {
            console.error('Error saving category:', error);
            showToast('Error saving category: ' + error.message, 'error');
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to delete category');
            }

            await this.loadCategories();
            showToast('Category deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('Error deleting category: ' + error.message, 'error');
        }
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
