// Navigation functionality for desktop dropdown and mobile sidebar

(function() {
    // Desktop Dropdown
    const dropdown = document.querySelector('.nav-dropdown');
    const dropdownToggle = document.querySelector('.nav-dropdown-toggle');
    const dropdownMenu = document.querySelector('.nav-dropdown-menu');

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        // Prevent dropdown from closing when clicking inside the menu
        if (dropdownMenu) {
            dropdownMenu.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    }

    // Mobile Navigation
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileSidebarClose = document.getElementById('mobileSidebarClose');
    const mobileOverlay = document.getElementById('mobileOverlay');

    function openMobileNav() {
        mobileSidebar.classList.add('open');
        mobileOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileNav() {
        mobileSidebar.classList.remove('open');
        mobileOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (mobileNavToggle) {
        mobileNavToggle.addEventListener('click', openMobileNav);
    }

    if (mobileSidebarClose) {
        mobileSidebarClose.addEventListener('click', closeMobileNav);
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeMobileNav);
    }

    // Close mobile nav when pressing Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileSidebar && mobileSidebar.classList.contains('open')) {
            closeMobileNav();
        }
    });

    // Update queue count for both desktop and mobile
    async function updateQueueCount() {
        try {
            const response = await fetch('/api/queue/count');
            if (response.ok) {
                const data = await response.json();
                const count = data.count || 0;
                
                const queueBadge = document.getElementById('queueCount');
                const queueBadgeMobile = document.getElementById('queueCountMobile');
                
                if (queueBadge) {
                    queueBadge.textContent = count;
                    queueBadge.style.display = count > 0 ? 'inline-block' : 'none';
                }
                
                if (queueBadgeMobile) {
                    queueBadgeMobile.textContent = count;
                    queueBadgeMobile.style.display = count > 0 ? 'inline-block' : 'none';
                }
            }
        } catch (error) {
            console.error('Failed to fetch queue count:', error);
        }
    }

    // Update queue count on page load
    updateQueueCount();

    // Update queue count every 30 seconds
    setInterval(updateQueueCount, 30000);
})();
