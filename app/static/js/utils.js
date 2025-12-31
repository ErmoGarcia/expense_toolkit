/**
 * Shared utility functions for the Expense Toolkit frontend.
 * This module provides common functionality used across all pages.
 */

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Use this function whenever displaying user-generated content.
 * 
 * @param {string|null|undefined} str - The string to escape
 * @returns {string} The escaped string, or empty string if input is null/undefined
 */
function escapeHtml(str) {
    if (str === null || str === undefined) {
        return '';
    }
    // Convert to string if not already
    const text = String(str);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape a string for use in HTML attributes (e.g., onclick handlers).
 * This escapes both HTML entities and quotes for safe attribute use.
 * 
 * @param {string|null|undefined} str - The string to escape
 * @returns {string} The escaped string safe for use in attributes
 */
function escapeAttr(str) {
    if (str === null || str === undefined) {
        return '';
    }
    const text = String(str);
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escape a string for use in JavaScript string literals.
 * Use when embedding values in onclick handlers or similar.
 * 
 * @param {string|null|undefined} str - The string to escape
 * @returns {string} The escaped string safe for JS strings
 */
function escapeJs(str) {
    if (str === null || str === undefined) {
        return '';
    }
    const text = String(str);
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Make an API request with proper error handling.
 * Checks response.ok and throws an error with the response message if not ok.
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} The parsed JSON response
 * @throws {Error} If the response is not ok or network error occurs
 */
async function apiFetch(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    const mergedOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };
    
    // Don't set Content-Type for FormData (browser sets it automatically with boundary)
    if (options.body instanceof FormData) {
        delete mergedOptions.headers['Content-Type'];
    }
    
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' 
                    ? errorData.detail 
                    : JSON.stringify(errorData.detail);
            }
        } catch (e) {
            // Response wasn't JSON, use status text
            errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
    }
    
    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    
    return null;
}

/**
 * Format a number as currency.
 * 
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code (default: GBP)
 * @returns {string} The formatted currency string
 */
function formatCurrency(amount, currency = 'GBP') {
    const symbols = {
        'GBP': '£',
        'EUR': '€',
        'USD': '$',
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
}

/**
 * Format a date string for display.
 * 
 * @param {string} dateStr - The date string in YYYY-MM-DD format
 * @returns {string} The formatted date string
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Debounce a function call.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show a toast notification (non-blocking alternative to alert).
 * Creates a temporary notification that fades out.
 * 
 * @param {string} message - The message to display
 * @param {string} type - The type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms before auto-hide (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 24px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    if (type === 'warning') {
        toast.style.color = '#212529';
    }
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.remove();
    });
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add toast animations to document
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);
