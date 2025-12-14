/**
 * StudioPulse - Class Management System
 * 
 * @version 1.0.0
 * @copyright 2025 28CarParts. All rights reserved.
 * @license Proprietary - Unauthorized copying or distribution is strictly prohibited.
 * 
 * Designed & Powered by 28CarParts
 * Contact: sales@28carparts.com / +852 9228 0948
 */

document.addEventListener('DOMContentLoaded', function() {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace with your actual Firebase project configuration
    const firebaseConfig = {
      apiKey: "AIzaSyDId4lvouSXLSOa5RNcJjyXssAlh9jjE_A",
      authDomain: "perryapptest.firebaseapp.com",
      databaseURL: "https://perryapptest-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "perryapptest",
      storageBucket: "perryapptest.firebasestorage.app",
      messagingSenderId: "1089572265674",
      appId: "1:1089572265674:web:a9b27ebee2ee0885e61e33"
    };

    // --- Firebase Initialization ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = firebase.database();

    // --- App State & Constants ---
    const MEMBER_PAST_DAYS = 0; 
    const CLS_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#FF007F', '#00BFFF', '#32CD32', '#FFD700', '#8A2BE2', '#FF4500', '#20B2AA', '#DAA520', '#4682B4', '#FF69B4', '#7CFC00', '#ADFF2F', '#DC143C', '#BA55D3'];
    const EYE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const EYE_SLASH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;

    let appState = { 
        classes: [],  
        tutors: [], 
        sportTypes: [], 
        users: [],
        branches: [], 
        salaryFormulas: [], 
        selectedScheduleBranch: null, 
        activePage: 'schedule', 
        currentUser: null,
        currentLanguage: 'en',
        studioSettings: {
            clsDefaults: {
                time: '09:00',
                duration: 60,
                credits: 1,
                maxParticipants: 10,
                cancellationCutoff: 2,
                defaultEstAttendance: 8
            }
        },
        selectedFilters: {
            salaryTutorId: null,
            salaryPeriod: null, 
            classesPeriod: null,
            incomePeriod: null,
            classesSportTypeId: 'all',
            classesTutorId: 'all',
            memberSportType: 'all',
            memberTutor: 'all',
            memberDay: 'all',
            statsPeriod: -7
        },
        ownerPastDaysVisible: 0,
        scheduleScrollDate: null,
        scrollToDateOnNextLoad: null,
        copyMode: { 
            active: false,
            type: null, 
            sourceId: null, 
            targetDate: null,
            targetBranchId: null
        },
        pagination: {
            classes: { page: 1 },
            sports: { page: 1 },
            tutors: { page: 1 },
            members: { page: 1 },
            salary: { page: 1 },
            income: { page: 1 },
            memberHistory: { page: 1 },
            accountBookings: { page: 1 }
        },
        searchTerms: {
            sports: '',
            tutors: ''
        },
        itemsPerPage: {
            classes: 10,
            sports: 10,
            tutors: 6,
            members: 10,
            salary: 10,
            income: 10
        },
        highlightBookingId: null,
        membersSort: { 
            key: 'name', 
            direction: 'asc' 
        },
        salarySort: {
            key: 'date',
            direction: 'asc'
        },
        classesSort: {
            key: 'date',
            direction: 'asc'
        },
        incomeSort: {
            key: 'date',
            direction: 'asc'
        },
        currentAnnouncement: null,
        scheduleStatus: {} 
    };
    let emblaApi = null;
    let navEmblaApi = null;
    let onConfirmCallback = null;
    let dataListeners = {}; // To hold references to our listeners
    let memberCheckInListeners = {};
    let activeClassesRef = null;
    let ownerPlanQuery = null;

    // --- START: WALLET & CREDIT SYSTEM HELPERS ---

    /**
     * Retrieves the user's wallet, converting legacy single-credit data 
     * into the new multi-wallet format on the fly if necessary.
     */
    const getMemberWallet = (user) => {
        if (!user) return {};

        // 1. If the user already has the new wallet structure, return it.
        if (user.wallet && Object.keys(user.wallet).length > 0) {
            return user.wallet;
        }

        // 2. Backward Compatibility: 
        // If no wallet exists, but 'credits' exists, map it to a "Legacy/General" type.
        if ((user.credits !== undefined && user.credits > 0) || user.initialCredits > 0) {
            return {
                'general': {
                    balance: parseFloat(user.credits || 0),
                    initialCredits: parseFloat(user.initialCredits || 0), // <--- RESTORED THIS FIELD
                    expiryDate: user.expiryDate || null,
                    name: 'General Credits',
                    isLegacy: true
                }
            };
        }

        return {};
    };

    const checkAccessValidity = (member, clsBranchId, configItem) => {
        // 1. Check Global Access Flag (Default to true for legacy compatibility)
        const isGlobal = configItem?.allowGlobalAccess !== false;
        if (isGlobal) return true;

        // 2. Resolve IDs (Handle nulls by defaulting to the first branch if available)
        const branches = appState.branches || [];
        const defaultBranchId = branches.length > 0 ? branches[0].id : null;

        const memberHomeId = member.homeBranchId || defaultBranchId;
        const targetClassBranchId = clsBranchId || defaultBranchId;

        // 3. Strict Comparison
        // If IDs are missing entirely (no branches setup), assume valid
        if (!memberHomeId || !targetClassBranchId) return true;

        return memberHomeId === targetClassBranchId;
    };

    /**
     * specificBalanceHelper: Gets the balance for a SPECIFIC credit type.
     * Useful for checking if a user can afford a specific class.
     */
    const getCreditBalance = (user, creditTypeId) => {
        const wallet = getMemberWallet(user);
        // Handle legacy mapping: if requesting 'general', return legacy credits
        if (creditTypeId === 'general' && wallet['general']) {
            return wallet['general'].balance;
        }
        return wallet[creditTypeId]?.balance || 0;
    };

    const getWalletStatus = (user) => {
        const wallet = getMemberWallet(user);
        const today = new Date();
        today.setHours(0,0,0,0);
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);

        let totalBalance = 0;
        let isCritical = false;
        let isWarning = false;
        let statusMessages = []; 

        // 1. Calculate Total Wallet Balance
        Object.values(wallet).forEach(data => {
            totalBalance += (data.balance || 0);
        });

        // 2. CHECK MONTHLY PLAN STATUS (If Active)
        if (user.monthlyPlan && user.paymentDueDate) {
            const dueDate = new Date(user.paymentDueDate);
            
            if (dueDate < today) {
                isCritical = true;
                statusMessages.push(_('status_overdue'));
            } else if (dueDate <= sevenDaysFromNow) {
                isWarning = true;
                const diffTime = dueDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusMessages.push(_('status_due_soon').replace('{days}', Math.max(0, diffDays)));
            }
        }

        // 3. CHECK CREDIT WALLET STATUS (Always Check)
        // Iterate through ALL active wallet entries
        Object.entries(wallet).forEach(([typeId, data]) => {
            const balance = data.balance || 0;
            const initial = data.initialCredits || 0;

            // Skip empty/inactive slots
            if (balance === 0 && initial === 0) return;

            // Resolve Name for Clarity
            let typeName = _('label_credits');
            if (appState.creditTypes) {
                const typeDef = appState.creditTypes.find(ct => ct.id === typeId);
                if (typeDef) typeName = getCreditTypeName(typeDef);
            } else if (typeId === 'general') {
                typeName = _('label_general');
            }

            // A. Expiry Check
            if (balance > 0 && data.expiryDate) {
                const expDate = new Date(data.expiryDate);
                if (expDate < today) {
                    isCritical = true;
                    statusMessages.push(_('status_credits_expired').replace('{type}', typeName)); 
                } else if (!isCritical && expDate <= sevenDaysFromNow) {
                    isWarning = true; // Only warn if not already critical
                    const diffTime = expDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    statusMessages.push(_('status_expiring_soon').replace('{days}', Math.max(0, diffDays)));
                }
            }

            // B. Low Balance Check (< 5)
            if (balance > 0 && balance < 5) {
                if (!isCritical) isWarning = true; 
                const msg = _('status_low_credits')
                    .replace('{balance}', formatCredits(balance))
                    .replace('{type}', typeName);
                if (!statusMessages.includes(msg)) statusMessages.push(msg);
            }
        });

        // 4. Global Empty Check (Only if NO plan and NO credits)
        if (!user.monthlyPlan && totalBalance <= 0 && !isCritical && !isWarning) {
            isCritical = true;
            statusMessages.push(_('status_no_credits'));
        }

        return { 
            isCritical, 
            isWarning, 
            statusText: statusMessages.join('\n'), 
            totalBalance 
        };
    };

    // --- END: WALLET HELPERS ---

    // --- DOM Element Cache ---
    const DOMElements = {
        authPage: document.getElementById('authPage'),
        appWrapper: document.getElementById('appWrapper'),
        logoutBtn: document.getElementById('logoutBtn'),
        mainNav: document.getElementById('mainNav'),
        messageBox: document.getElementById('messageBox'),
        navButtons: document.querySelectorAll('.nav-btn'),
        pages: document.querySelectorAll('.page'),
        clsModal: document.getElementById('clsModal'),
        bookingModal: document.getElementById('bookingModal'),
        joinedMembersModal: document.getElementById('joinedMembersModal'),
        sportTypeModal: document.getElementById('sportTypeModal'),
        tutorModal: document.getElementById('tutorModal'),
        memberModal: document.getElementById('memberModal'),
        editMemberAccountModal: document.getElementById('editMemberAccountModal'),
        changePasswordModal: document.getElementById('changePasswordModal'),
        confirmationModal: document.getElementById('confirmationModal'),
        memberBookingHistoryModal: document.getElementById('memberBookingHistoryModal'),
        deleteClsNotifyModal: document.getElementById('deleteClsNotifyModal'),
        filterModal: document.getElementById('filterModal'),
        goToDateModal: document.getElementById('goToDateModal'),
        numericDialModal: document.getElementById('numericDialModal'),
        cancelCopyBtn: document.getElementById('cancelCopyBtn'),
        checkInModal: document.getElementById('checkInModal'),
        announcementBanner: document.getElementById('announcementBanner'), // ADD THIS LINE
        announcementModal: document.getElementById('announcementModal') // ADD THIS LINE
    };

    // --- START: NEW LANGUAGE FUNCTIONS ---
    const _ = (key) => {
        // This now correctly references LANG_PACK from the i18n.js file
        return LANG_PACK[appState.currentLanguage]?.[key] || LANG_PACK['en'][key] || key;
    };

    const updateUIText = () => {
        const langKeyElements = document.querySelectorAll('[data-lang-key]');
        langKeyElements.forEach(el => {
            const key = el.dataset.langKey;
            const translation = _(key);
    
            if (el.hasAttribute('placeholder')) {
                el.placeholder = translation;
            } else {
                el.textContent = translation;
            }
        });
    };

    const setLanguage = (lang, saveToDb = true) => {
        if (!LANG_PACK[lang]) lang = 'en'; // Fallback to English
        
        // Check if the language is actually changing to prevent infinite render loops
        const previousLang = appState.currentLanguage;
        const hasChanged = previousLang !== lang;

        appState.currentLanguage = lang;
        localStorage.setItem('studioPulseLanguage', lang);
        
        // 1. Update static elements (data-lang-key) immediately
        updateUIText();
        
        // 2. Update Password Strength UI if the registration form is visible
        const registerFormContainer = document.getElementById('register-form-container');
        if (registerFormContainer && !registerFormContainer.classList.contains('hidden')) {
            const form = document.getElementById('registerForm');
            if (form) updatePasswordStrengthUI(form);
        }
    
        // 3. Update active state styling on language selectors (UI update only)
        document.querySelectorAll('.lang-selector').forEach(selector => {
            if (selector.dataset.lang === lang) {
                selector.classList.remove('text-slate-400');
                selector.classList.add('text-indigo-600', 'underline', 'decoration-2', 'underline-offset-2');
            } else {
                selector.classList.add('text-slate-400');
                selector.classList.remove('text-indigo-600', 'underline', 'decoration-2', 'underline-offset-2');
            }
        });
    
        // 4. Save preference to Database
        if (saveToDb && appState.currentUser?.id) {
            database.ref(`/users/${appState.currentUser.id}/language`).set(lang)
              .catch(error => console.error("Could not save language preference:", error));
        }

        // 5. Re-render Application Content
        if (appState.currentUser) {
            // CRITICAL FIX: Only re-render if the language actually changed.
            // This ensures dynamic content (Admin lists, Schedule headers) updates instantly
            // without causing loops when pages initialize and call setLanguage(current).
            if (hasChanged) {
                renderNav();
                renderCurrentPage();
            }
        }
    };

    // --- Utility & Helper Functions ---
    const validateForm = (formElement) => {
        const requiredInputs = formElement.querySelectorAll('input[required]');
        for (const input of requiredInputs) {
            if (!input.value.trim()) {
                return false;
            }
        }
        return true;
    };
    
    const checkPasswordStrength = (password) => {
        if (!password) return null;

        // 1. Length Check is the highest priority
        if (password.length < 6) {
            return { color: 'bg-red-500', width: '20%', textKey: 'password_strength_very_weak' };
        }

        // 2. Count character types for passwords that meet the length requirement
        let types = 0;
        if (/\d/.test(password)) types++; // Numbers
        if (/[a-z]/.test(password)) types++; // Lowercase letters
        if (/[A-Z]/.test(password)) types++; // Uppercase letters
        if (/[^A-Za-z0-9]/.test(password)) types++; // Special characters

        // 3. Categorize based on the number of character types used
        switch (types) {
            case 1: // Weak (e.g., "password" or "1234567")
                return { color: 'bg-orange-500', width: '40%', textKey: 'password_strength_weak' };
            case 2: // Fair (e.g., "password123" or "Password")
                return { color: 'bg-yellow-400', width: '60%', textKey: 'password_strength_fair' };
            case 3: // Good (e.g., "Password123")
                return { color: 'bg-lime-500', width: '80%', textKey: 'password_strength_good' };
            case 4: // Excellent (e.g., "Password123!")
                return { color: 'bg-green-500', width: '100%', textKey: 'password_strength_excellent' };
            default: // This case should not be reached but serves as a safe fallback
                return { color: 'bg-red-500', width: '20%', textKey: 'password_strength_very_weak' };
        }
    };

    // --- Subscription Access Helper ---
    const checkSubscriptionAccess = (featureId) => {
        // Prioritize the global studio plan (set by listeners), fallback to currentUser (if owner), default to basic
        const plan = (appState.studioPlan || appState.currentUser?.subscriptionStatus || 'basic').toLowerCase();

        // Premium and Pro plans have access to everything
        if (plan === 'pro' || plan === 'premium') {
            return true;
        }

        // --- BASIC PLAN RESTRICTIONS ---
        if (featureId === 'check-in') return false;

        const user = appState.currentUser;
        if (user && (user.role === 'owner' || user.role === 'manager' || user.role === 'staff')) {
            const restrictedPages = ['filter', 'income', 'salary', 'statistics'];
            const restrictedAdminCards = ['admin_defaults', 'admin_announcements', 'admin_formulas'];

            if (restrictedPages.includes(featureId)) return false;
            if (restrictedAdminCards.includes(featureId)) return false;
        }

        return true;
    };

    // Replace the old updatePasswordStrengthUI function with this new one.
    const updatePasswordStrengthUI = (formElement) => {
        // Exit if the form doesn't exist.
        if (!formElement) return;

        // Find the indicator elements *within the specified form*.
        const container = formElement.querySelector('.password-strength-container');
        const passwordInput = formElement.querySelector('.password-strength-input');

        // Exit if the indicator elements aren't in this form.
        if (!container || !passwordInput) return;

        const bar = container.querySelector('.password-strength-bar');
        const text = container.querySelector('.password-strength-text');
        const password = passwordInput.value;

        const strength = checkPasswordStrength(password);
        
        bar.className = 'password-strength-bar h-full rounded-full transition-all duration-300'; // Reset classes
        const textColors = {
            'bg-red-500': 'text-red-500',
            'bg-orange-500': 'text-orange-500',
            'bg-yellow-400': 'text-yellow-500',
            'bg-lime-500': 'text-lime-600',
            'bg-green-500': 'text-green-600'
        };

        if (strength) {
            bar.style.width = strength.width;
            bar.classList.add(strength.color);
            text.textContent = _(strength.textKey);
            text.className = `password-strength-text text-xs font-bold ${textColors[strength.color] || 'text-slate-500'}`;
        }
    };

    const setupPasswordToggle = (inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        const toggleBtn = input.nextElementSibling;
        if (!toggleBtn || !toggleBtn.classList.contains('password-toggle-btn')) return;
        
        // Set initial state
        toggleBtn.innerHTML = EYE_ICON_SVG;

        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = EYE_SLASH_ICON_SVG;
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = EYE_ICON_SVG;
            }
        });
    };

    const showMessageBox = (message, type = 'success', duration = 3000) => {
        DOMElements.messageBox.textContent = message;
        const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-sky-500' };
        
        // Combined fix:
        // 1. Z-index is now z-[100] to be above all modals.
        // 2. Responsive classes added: full-width on mobile, toast on desktop.
        const responsiveClasses = 'left-6 right-6 text-center sm:left-auto sm:w-auto sm:max-w-md sm:text-left';
        
        DOMElements.messageBox.className = `fixed bottom-6 text-white px-6 py-3 rounded-lg shadow-xl z-[100] animate-bounce ${responsiveClasses} ${colors[type] || colors.info}`;

        DOMElements.messageBox.classList.remove('hidden');
        setTimeout(() => DOMElements.messageBox.classList.add('hidden'), duration);
    };

    const showBookingNotification = (bookingDetails) => {
        const { memberName, clsName, clsTime, duration } = bookingDetails;
        const timeRange = getTimeRange(clsTime, duration);

        // --- Replace the original 'templates' array with this ---
        const templateKeys = [
            'notification_booking_1',
            'notification_booking_2',
            'notification_booking_3',
            'notification_booking_4',
            'notification_booking_5'
        ];
        const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];
        const message = _(randomKey)
            .replace('{name}', memberName)
            .replace('{class}', clsName)
            .replace('{time}', timeRange);
        // --- The rest of the function remains the same ---

        // We use the existing showMessageBox but with custom HTML
        const messageBox = DOMElements.messageBox;
        messageBox.innerHTML = message; // Use innerHTML to render the <strong> tags
        
        // Combined fix:
        // 1. Z-index is now z-[100] to be above all modals.
        // 2. Responsive classes added: full-width on mobile, toast on desktop.
        const responsiveClasses = 'left-6 right-6 text-center sm:left-auto sm:w-auto sm:max-w-md sm:text-left';
        messageBox.className = `fixed bottom-6 text-white px-6 py-3 rounded-lg shadow-xl z-[100] animate-bounce bg-sky-500 ${responsiveClasses}`;
        
        messageBox.classList.remove('hidden');
        setTimeout(() => messageBox.classList.add('hidden'), 5000); // Show for 5 seconds
    };

    const firebaseObjectToArray = (obj) => {
        if (!obj) return [];
        const arr = Object.entries(obj).map(([id, value]) => ({ id, ...value }));
        
        // Sort by 'order' property. 
        // Items with no 'order' (legacy) get Infinity to push them to the bottom.
        // If orders are equal, fall back to name for deterministic sorting.
        return arr.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : Infinity;
            const orderB = typeof b.order === 'number' ? b.order : Infinity;
            
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // Fallback to name comparison if orders are missing or equal
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });
    };

    // --- NEW HELPER: Fast Object-to-Array (No Sorting) ---
    // Use this for large datasets like Users or Classes where order is handled by the UI
    const firebaseObjectToArrayFast = (obj) => {
        if (!obj) return [];
        return Object.entries(obj).map(([id, value]) => ({ id, ...value }));
    };

    const getIsoDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const formatTime = (date) => date.toTimeString().slice(0, 5);

    const getLocalDateForFilename = () => {
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTimeRange = (startTime, duration) => {
        if (!startTime || !duration) return 'Invalid Time';
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(start.getTime() + duration * 60000);
        return `${formatTime(start)} - ${formatTime(end)}`;
    };
    
    const getLocale = () => {
        // Provides the correct locale string for Intl (Date/Number formatting)
        return appState.currentLanguage === 'zh-TW' ? 'zh-TW' : 'en-US';
    };

    const getSportTypeName = (sportType) => {
        // Handle cases where the sportType object is missing.
        if (!sportType) {
            return _('unknown_type');
        }

        // Determine the preferred and fallback names based on the current language.
        const preferredName = (appState.currentLanguage === 'zh-TW') ? sportType.name_zh : sportType.name;
        const fallbackName = (appState.currentLanguage === 'zh-TW') ? sportType.name : sportType.name_zh;
        
        // Return the first available name: preferred, then fallback, then the generic error message.
        // The '||' operator elegantly handles empty or null values.
        return preferredName || fallbackName || _('unknown_type');
    };

    // --- NEW HELPER: Get Branch Name (Bilingual) ---
    const getBranchName = (branch) => {
        if (!branch) return _('label_legacy_branch'); // Fallback for old data
        
        const preferred = (appState.currentLanguage === 'zh-TW') ? branch.name_zh : branch.name;
        const fallback = (appState.currentLanguage === 'zh-TW') ? branch.name : branch.name_zh;
        
        return preferred || fallback || _('label_legacy_branch');
    };

    // --- NEW HELPER: Check Write Permission ---
    const canManageBranch = (user, targetBranchId) => {
        // 1. Only Owners have unrestricted access
        if (user.role === 'owner') return true;
        
        // 2. Staff & Managers: Check Global Write Access
        if (user.staffAccessLevel === 'global_write') return true;

        // 3. Staff & Managers: Specific Branch Access
        // If targetBranchId is null (Legacy), we treat it as the first branch or allow if home matches
        const branches = appState.branches || [];
        const resolvedBranchId = targetBranchId || (branches.length > 0 ? branches[0].id : null);
        
        // Check Allowed Branches Map
        if (user.allowedBranches && user.allowedBranches[resolvedBranchId]) return true;
        
        // Check Home Branch
        const homeId = user.homeBranchId || (branches.length > 0 ? branches[0].id : null);
        return resolvedBranchId === homeId;
    };

    // --- NEW HELPER: Get Effective Branches (Permission Logic) ---
    const getEffectiveBranches = (user, allBranches) => {
        // 1. Owners see everything
        if (user.role === 'owner') return allBranches;

        // 2. Check Access Level
        const staffAccessLevel = user.staffAccessLevel || 'home_only';

        // 3. 'Home Only' users are restricted in Dropdowns/Views
        // Global Read/Write users see ALL branches in lists (Dropdowns)
        if (staffAccessLevel === 'home_only') {
            let allowedIds = [];
            if (user.allowedBranches && Object.keys(user.allowedBranches).length > 0) {
                allowedIds = Object.keys(user.allowedBranches);
            } else {
                // Fallback to homeBranchId
                const defaultId = user.homeBranchId || (allBranches.length > 0 ? allBranches[0].id : null);
                if (defaultId) allowedIds.push(defaultId);
            }
            return allBranches.filter(b => allowedIds.includes(b.id));
        }

        return allBranches;
    };

    // --- NEW HELPER: Centralized Branch Filtering ---
    const filterClassesByBranchContext = (classesToFilter, allBranches, effectiveBranches, selectedUiBranchId = 'all') => {
        let filtered = classesToFilter;

        // 1. Security/Permission Filter
        // If the user's effective access is restricted (subset of all branches), filter strictly.
        if (effectiveBranches.length < allBranches.length) {
            const allowedIds = effectiveBranches.map(b => b.id);
            filtered = filtered.filter(c => {
                const cBranch = c.branchId || (allBranches.length > 0 ? allBranches[0].id : null);
                return allowedIds.includes(cBranch);
            });
        }

        // 2. UI Selection Filter (Dropdown)
        if (selectedUiBranchId && selectedUiBranchId !== 'all') {
            filtered = filtered.filter(c => {
                const cBranch = c.branchId || (allBranches.length > 0 ? allBranches[0].id : null);
                return cBranch === selectedUiBranchId;
            });
        }

        return filtered;
    };

    const getCreditTypeName = (creditType) => {
        if (!creditType) return 'Credits';
        
        const preferredName = (appState.currentLanguage === 'zh-TW') ? creditType.name_zh : creditType.name;
        const fallbackName = (appState.currentLanguage === 'zh-TW') ? creditType.name : creditType.name_zh;
        
        // Return preferred, fallback, or original name
        return preferredName || fallbackName || creditType.name || 'Credits';
    };

    const getMonthlyPlanName = (tier) => {
        if (!tier) return _('label_legacy_tier');
        
        const preferredName = (appState.currentLanguage === 'zh-TW') ? tier.name_zh : tier.name;
        const fallbackName = (appState.currentLanguage === 'zh-TW') ? tier.name : tier.name_zh;
        
        return preferredName || fallbackName || tier.name || _('label_legacy_tier');
    };

    const formatCurrency = (amount) => {
        // Use the dynamic locale for number/currency formatting
        return (amount || 0).toLocaleString(getLocale(), { 
            style: 'currency', 
            currency: 'USD', 
            currencyDisplay: 'narrowSymbol', // This is the fix
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
        });
    };

    const formatBookingAuditText = (bookingInfo) => {
        if (!bookingInfo || !bookingInfo.bookedAt) {
            return '';
        }

        const formattedDate = formatShortDateWithYear(bookingInfo.bookedAt);

        // Case 1: Booking was made by an owner/staff
        if (bookingInfo.bookedBy && bookingInfo.bookedBy !== 'member') {
            return _('audit_booked_by_on')
                .replace('{name}', `<strong>${bookingInfo.bookedBy}</strong>`)
                .replace('{date}', formattedDate);
        }
        
        // Case 2 (Default): Member self-booking
        return _('audit_booked_on').replace('{date}', formattedDate);
    };

    // --- START: Add this new function here ---
    const formatCredits = (credits) => {
        const num = parseFloat(credits);
        if (isNaN(num)) return '0'; // Handle cases where credits might not be a number
        // Check if the number is an integer
        if (num % 1 === 0) {
            return num.toString();
        }
        // Otherwise, return it with one decimal place
        return num.toFixed(1);
    };
    // --- END: Add this new function here ---

    /**
     * Centralized logic for calculating tutor payout.
     * Used by: Class Modal, Salary Page, Income Page, Statistics Page.
     */
    const calculateTutorPayout = (cls, grossRevenue, attendeesCount, salaryFormulas) => {
        if (!cls.payoutDetails) return 0;

        const { salaryType, salaryValue, salaryFormulaId } = cls.payoutDetails;
        
        if (salaryType === 'perCls') {
            return parseFloat(salaryValue) || 0;
        } 
        else if (salaryType === 'percentage') {
            return grossRevenue * (parseFloat(salaryValue) / 100);
        } 
        else if (salaryType === 'perHeadcount') {
            return attendeesCount * (parseFloat(salaryValue) || 0);
        } 
        else if (salaryType === 'custom') {
            const formula = salaryFormulas ? salaryFormulas.find(f => f.id === salaryFormulaId) : null;
            if (formula && formula.script) {
                const context = {
                    attendees: attendeesCount,
                    revenue: grossRevenue,
                    duration: cls.duration || 60,
                    credits: cls.credits || 0
                };
                return executeSalaryScript(formula.script, context);
            }
        }
        return 0;
    };

    function calculateClsRevenueAndPayout(cls, allUsers, allTutors, allClasses) {
        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        const relevantMemberIds = new Set(bookedMemberIds);

        // --- FIX: CONTEXTUAL HISTORY RECONSTRUCTION ---
        // To accurately calculate revenue using the FIFO (First-In-First-Out) credit depletion model,
        // we cannot calculate the class in isolation. We must replay the booking history for the
        // involved members so that the system knows exactly WHICH credit package (and thus which cost basis)
        // is being used for this specific class.
        
        const comprehensiveBookings = [];
        
        if (allClasses && allClasses.length > 0) {
            allClasses.forEach(c => {
                if (c.bookedBy) {
                    Object.keys(c.bookedBy).forEach(mId => {
                        // Check if this booking belongs to one of the members in our target class
                        if (relevantMemberIds.has(mId)) {
                            const member = allUsers.find(u => u.id === mId);
                            if (member) {
                                comprehensiveBookings.push({ member, cls: c });
                            }
                        }
                    });
                }
            });
        } else {
            // Fallback: If full history isn't available, calculate in isolation
            // (This avoids a crash, though the value might be less accurate regarding depletion order)
             bookedMemberIds.forEach(id => {
                const member = allUsers.find(u => u.id === id);
                if (member) comprehensiveBookings.push({ member, cls });
            });
        }
        
        // We use 'projected' mode here to force the calculator to process all classes in the list,
        // regardless of whether they are in the past or future. This ensures the depletion logic
        // runs continuously up to our target class.
        const { revenueByClsId } = calculateRevenueForBookings(comprehensiveBookings, 'projected');
        
        const grossRevenue = revenueByClsId.get(cls.id) || 0;

        // Calculate Payout using the centralized helper
        const tutorPayout = calculateTutorPayout(cls, grossRevenue, bookedMemberIds.length, appState.salaryFormulas);
        
        const netRevenue = grossRevenue - tutorPayout;
        
        return { grossRevenue, tutorPayout, netRevenue };
    }

    /**
     * Executes a stored string script safely using dynamic Function.
     * @param {string} scriptBody - The JS code (body of the function).
     * @param {object} context - Data passed to script: { attendees, revenue, duration, credits }
     */
    const executeSalaryScript = (scriptBody, context) => {
        try {
            // Create a function that takes 'context' as an argument
            // The scriptBody is the code inside the curly braces
            const func = new Function('context', scriptBody);
            const result = func(context);
            return parseFloat(result) || 0;
        } catch (e) {
            console.error("Custom Formula Execution Error:", e);
            return 0; // Fail safe
        }
    };

    const formatShortDateWithYear = (isoString) => {
        if (!isoString) return _('label_na');
        
        // Heuristic: Check if it's a simple date string (dd/mm/yyyy, 10 chars)
        // vs a full ISO timestamp (e.g., 2023-11-28T14:30:00.000Z)
        const isDateOnly = isoString.length === 10;
        
        const date = new Date(isoString); 
        if (isNaN(date)) return 'Invalid Date';

        const options = {
            year: '2-digit',
            month: 'short',
            day: 'numeric'
        };

        // If it is a Date-Only string (Class Date, Expiry Date), force UTC
        // to prevent the day from shifting due to local timezone offsets.
        // If it is a full Timestamp (Audit Log, Booking Time), allow the default 
        // behavior (Local Time) so the user sees the date relative to their location.
        if (isDateOnly) {
            options.timeZone = 'UTC';
        }

        return new Intl.DateTimeFormat(getLocale(), options).format(date);
    };

    const getOrdinalSuffix = (day) => {
        // Add a guard to prevent applying English suffixes to other languages
        if (appState.currentLanguage !== 'en') return '';
        
        const j = day % 10,
              k = day % 100;
        if (j == 1 && k != 11) {
            return "st";
        }
        if (j == 2 && k != 12) {
            return "nd";
        }
        if (j == 3 && k != 13) {
            return "rd";
        }
        return "th";
    };

    const exportToCsv = (filename, rows) => {
        if (!rows || rows.length === 0) {
            showMessageBox(_('info_no_data_to_export'), 'info');
            return;
        }

        // 1. Get headers from the first data object's keys
        const headers = Object.keys(rows[0]);

        // 2. Convert the array of objects into a CSV string
        const csvContent = [
            headers.join(','), // Header row
            ...rows.map(row => headers.map(header => {
                let cell = row[header];
                cell = cell === null || cell === undefined ? '' : String(cell);

                // To handle values containing commas, quotes, or newlines, we wrap them in double quotes.
                // Any existing double quotes inside the value must be escaped by doubling them.
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(','))
        ].join('\n');

        // 3. Create a Blob and trigger the download
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is the BOM for Excel
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}_${getLocalDateForFilename()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showMessageBox(_('success_export_started'), 'success');
    }

    const formatDateWithWeekday = (isoString) => {
        if (!isoString) return _('label_na');
        const date = new Date(isoString + 'T12:00:00Z');
        
        // Use the dynamic locale for date formatting
        return new Intl.DateTimeFormat(getLocale(), { 
            weekday: 'short', 
            year: '2-digit',
            month: 'short', 
            day: 'numeric', 
            timeZone: 'UTC' 
        }).format(date);
    };

    const formatDisplayPhoneNumber = (fullPhoneNumber) => {
        if (!fullPhoneNumber) return '';
        const parts = fullPhoneNumber.split(' ');
        if (parts.length > 1) {
            const countryCode = parts[0];
            const digitsOnly = parts.slice(1).join('').replace(/\D/g, '');
            return `${countryCode} ${digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ')}`;
        }
        return fullPhoneNumber;
    };

    const formatDigitsWithSpaces = (digitsString) => {
        if (!digitsString) return '';
        const cleanedDigits = digitsString.replace(/\D/g, '');
        return cleanedDigits.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const parsePhoneNumber = (fullPhoneNumber) => {
        const phone = fullPhoneNumber || '';
        const parts = phone.split(' ');
        if (parts.length > 1 && parts[0].startsWith('+')) {
            const countryCode = parts[0].substring(1);
            const number = formatDigitsWithSpaces(parts.slice(1).join(''));
            return { countryCode, number };
        }
        return { countryCode: '', number: formatDigitsWithSpaces(phone) };
    };

    const constructPhoneNumber = (countryCode, number) => {
        const digits = (number || '').replace(/\D/g, '');
        const code = (countryCode || '').replace(/\D/g, '');
        if (!digits) return '';
        return code ? `+${code} ${digits}` : digits;
    };

    const saveSchedulePosition = () => {
        if (emblaApi) {
            const currentIndex = emblaApi.selectedScrollSnap();
            const currentSlideNode = emblaApi.slideNodes()[currentIndex];
            if (currentSlideNode) {
                // Find the date from the data attribute within the slide
                const classesContainer = currentSlideNode.querySelector('.classes-container[data-date]');
                if (classesContainer) {
                    appState.scheduleScrollDate = classesContainer.dataset.date;
                }
            }
        }
    };

    const getInitialScheduleIndex = (datesArray, defaultIndex) => {
        // --- START: COMPLETE AND CORRECTED LOGIC ---

        // Priority 1: Handle a one-time navigation jump (e.g., from "Go To Date" or booking).
        if (appState.scrollToDateOnNextLoad !== null) {
            const targetDate = appState.scrollToDateOnNextLoad;
            const index = datesArray.indexOf(targetDate);
            
            // IMPORTANT: Consume the state immediately after reading it.
            // This ensures it is only used for this one, specific render action.
            appState.scrollToDateOnNextLoad = null;
            
            if (index !== -1) {
                // We found the date, so we jump to it. Also, update the persistent
                // scroll memory to this new date.
                appState.scheduleScrollDate = targetDate;
                return index;
            }
            // If the target date wasn't found (should be rare), we proceed to the next priority.
        } 
        
        // Priority 2: Use the persistent scroll memory if no one-time jump is requested.
        if (appState.scheduleScrollDate !== null) {
            const index = datesArray.indexOf(appState.scheduleScrollDate);
            if (index !== -1) {
                return index;
            }
        }
        
        // Priority 3: Fallback to the default index (e.g., "today") if no other state is valid.
        return defaultIndex;

        // --- END: COMPLETE AND CORRECTED LOGIC ---
    };

    const checkTutorConflict = (tutorId, date, time, duration, excludeClassId = null) => {
        if (!tutorId || !date || !time) return null;

        const newStart = new Date(`${date}T${time}`);
        const newEnd = new Date(newStart.getTime() + duration * 60000);

        // Scan ALL classes in memory (appState.classes contains data for ALL branches)
        const conflict = appState.classes.find(c => {
            // Skip the class being edited
            if (c.id === excludeClassId) return false;
            
            // Skip different days or tutors
            if (c.date !== date || c.tutorId !== tutorId) return false;

            const cStart = new Date(`${c.date}T${c.time}`);
            const cEnd = new Date(cStart.getTime() + (c.duration || 60) * 60000);

            // Overlap Calculation
            return (newStart < cEnd && newEnd > cStart);
        });

        if (conflict) {
            const branch = appState.branches.find(b => b.id === conflict.branchId);
            const branchName = branch ? branch.name : _('label_legacy_branch');
            const sportType = appState.sportTypes.find(st => st.id === conflict.sportTypeId);
            const className = getSportTypeName(sportType);
            const timeRange = getTimeRange(conflict.time, conflict.duration);

            return {
                branchName,
                className,
                timeRange
            };
        }

        return null;
    };
    
    // --- Auth & UI Visibility ---
    const handleLogin = (email, password) => {
        const loginForm = document.getElementById('loginForm');
        if (!validateForm(loginForm)) {
            showMessageBox(_('error_required_field'), 'error');
            return;
        }

        const loginButton = loginForm.querySelector('button[type="submit"]');
        loginButton.disabled = true;
        loginButton.textContent = _('status_logging_in');

        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                console.error("Login Error:", error);

                // Check for common authentication failure codes or specific error text
                // 'auth/invalid-credential' is the modern standard, others are legacy/specific
                if (
                    error.code === 'auth/invalid-credential' || 
                    error.code === 'auth/user-not-found' || 
                    error.code === 'auth/wrong-password' || 
                    (error.message && error.message.includes('INVALID_LOGIN_CREDENTIALS'))
                ) {
                    showMessageBox(_('error_auth_invalid_credentials'), 'error');
                } else {
                    // Fallback for other errors (network issues, too many requests, etc.)
                    showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
                }
            })
            .finally(() => {
                loginButton.disabled = false;
                loginButton.textContent = _('auth_login_button');
            });
    };

    const handleRegistration = (formData) => {
        const { name, email, password, confirmPassword, phone, homeBranchId } = formData;
        const registerForm = document.getElementById('registerForm');
        const registerButton = registerForm.querySelector('button[type="submit"]');

        registerButton.disabled = true;
        registerButton.textContent = _('status_checking');

        if (!validateForm(registerForm)) {
            showMessageBox(_('error_required_field'), 'error');
            registerButton.disabled = false;
            registerButton.textContent = _('auth_register_button');
            return;
        }
        if (password.length < 6) {
            showMessageBox(_('error_password_length'), 'error');
            registerButton.disabled = false;
            registerButton.textContent = _('auth_register_button');
            return;
        }
        if (password !== confirmPassword) {
            showMessageBox(_('error_password_mismatch'), 'error');
            registerButton.disabled = false;
            registerButton.textContent = _('auth_register_button');
            return;
        }

        registerButton.textContent = _('status_registering');

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const user = userCredential.user;
                const newUserProfile = {
                    name: name,
                    email: user.email,
                    phone: phone,
                    role: 'member', // Default role is member
                    // credits: 0,        <-- REMOVE
                    // initialCredits: 0, <-- REMOVE
                    monthlyPlan: false,
                    joinDate: new Date().toISOString(),
                    lastBooking: null,
                    expiryDate: null,
                    language: appState.currentLanguage,
                    purchaseHistory: {},
                    // subscriptionStatus: 'basic',  <-- REMOVED. Members don't need this.
                    homeBranchId: homeBranchId || null 
                };
                return firebase.database().ref('users/' + user.uid).set(newUserProfile);
            })
            .then(() => {
                showMessageBox(_('success_registration'), 'success')
                document.getElementById('register-form-container').classList.add('hidden');
                document.getElementById('login-form-container').classList.remove('hidden');
                document.getElementById('loginEmail').value = email;
            })
            .catch(error => {
                showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
            })
            .finally(() => {
                registerButton.disabled = false;
                registerButton.textContent = _('auth_register_button');
            });
    };

    const handleLogout = () => {
        auth.signOut();
    };

    const renderNav = () => {
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isManager || isStaff;
        // Helper for "Owner-level" access
        const isOwnerOrManager = isOwner || isManager;

        if (navEmblaApi) {
            navEmblaApi.destroy();
            navEmblaApi = null;
        }

        DOMElements.mainNav.innerHTML = `
            <div id="nav-carousel-mobile" class="lg:hidden">
                <div class="embla-nav">
                    <div class="embla-nav__container"></div>
                </div>
            </div>
            <div id="nav-static-desktop" class="hidden lg:flex items-center gap-2 sm:gap-6 px-4 py-2"></div>
        `;
        
        DOMElements.mainNav.classList.add('flex-grow', 'lg:flex-grow-0', 'min-w-0');
        
        const mobileNavContainer = DOMElements.mainNav.querySelector('#nav-carousel-mobile .embla-nav__container');
        const desktopNavContainer = DOMElements.mainNav.querySelector('#nav-static-desktop');
        
        const { memberSportType, memberTutor, memberDay } = appState.selectedFilters;
        const activeFilterCount = (memberSportType !== 'all' ? 1 : 0) + (memberTutor !== 'all' ? 1 : 0) + (memberDay !== 'all' ? 1 : 0);
        const filterDotHTML = activeFilterCount > 0 ? `<span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500"></span>` : '';

        let navButtonsHTML = [];

        if (isAdmin) {
            navButtonsHTML.push(`<button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_schedule')}</button>`);

            if (checkSubscriptionAccess('check-in')) {
                navButtonsHTML.push(`<button id="navCheckInBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_check_in')}</button>`);
            }

            if (checkSubscriptionAccess('filter')) {
                navButtonsHTML.push(`<button id="navFilterBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base flex items-center gap-2 relative">
                    ${_('nav_filter')}
                    ${filterDotHTML}
                </button>`);
            }

            navButtonsHTML.push(`<button id="navGoToBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_goto')}</button>`);
            navButtonsHTML.push(`<button data-page="classes" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_classes')}</button>`);

            // Manager inherits access to these pages
            if (isOwnerOrManager && checkSubscriptionAccess('income')) {
                navButtonsHTML.push(`<button data-page="income" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_income')}</button>`);
            }
            if (isOwnerOrManager && checkSubscriptionAccess('salary')) {
                navButtonsHTML.push(`<button data-page="salary" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_salary')}</button>`);
            }
            if (isOwnerOrManager && checkSubscriptionAccess('statistics')) {
                navButtonsHTML.push(`<button data-page="statistics" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_statistics')}</button>`);
            }

            navButtonsHTML.push(`<button data-page="members" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_members')}</button>`);
            navButtonsHTML.push(`<button data-page="admin" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_admin')}</button>`);
            navButtonsHTML.push(`<button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">${_('nav_logout')}</button>`);

        } else { 
            navButtonsHTML.push(`<button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_schedule')}</button>`);
            navButtonsHTML.push(`<button id="navFilterBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base flex items-center gap-2 relative">
                ${_('nav_filter')}
                ${filterDotHTML}
            </button>`);
            navButtonsHTML.push(`<button data-page="account" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_account')}</button>`);
            
            if (checkSubscriptionAccess('check-in')) {
                navButtonsHTML.push(`<button data-page="check-in" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_check_in')}</button>`);
            }

            navButtonsHTML.push(`<button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">${_('nav_logout')}</button>`);
        }

        mobileNavContainer.innerHTML = navButtonsHTML.map(btn => `<div class="embla-nav__slide">${btn}</div>`).join('');
        desktopNavContainer.innerHTML = navButtonsHTML.join('');

        const initNavCarousel = () => {
            if (window.innerWidth < 1024 && !navEmblaApi) {
                const navCarouselNode = DOMElements.mainNav.querySelector('#nav-carousel-mobile .embla-nav');
                if (navCarouselNode) {
                    const activeIndex = navButtonsHTML.findIndex(html => html.includes(`data-page="${appState.activePage}"`));
                    const startIndex = activeIndex >= 0 ? activeIndex : 0;
                    navEmblaApi = EmblaCarousel(navCarouselNode, { align: 'start', dragFree: true, startIndex: startIndex });
                }
            } else if (window.innerWidth >= 1024 && navEmblaApi) {
                navEmblaApi.destroy(); navEmblaApi = null;
            }
        };
        initNavCarousel();
        window.addEventListener('resize', initNavCarousel);

        DOMElements.mainNav.querySelectorAll('button').forEach(btn => {
            if (btn.id === 'logoutBtn') btn.onclick = handleLogout;
            else if (btn.id === 'navFilterBtn') btn.onclick = () => { if (appState.activePage !== 'schedule') switchPage('schedule'); openFilterModal(); };
            else if (btn.id === 'navCheckInBtn') btn.onclick = openCheckInModal;
            else if (btn.id === 'navGoToBtn') btn.onclick = openGoToDateModal;
            else if (btn.dataset.page) btn.onclick = () => switchPage(btn.dataset.page);
            if (btn.dataset.page) btn.classList.toggle('active', btn.dataset.page === appState.activePage);
        });
    };

    const renderSubscriptionBadge = () => {
        // 1. Find the Logo container (the <a> tag inside the header)
        const headerLink = DOMElements.appWrapper.querySelector('header a');
        if (!headerLink) return;

        // --- NEW: Redirect to Schedule on Click ---
        headerLink.onclick = (e) => {
            e.preventDefault(); // Prevent page reload
            switchPage('schedule'); // Use internal SPA routing
        };
        // ------------------------------------------

        // 2. Clean up any existing badge to prevent duplicates
        const existingBadge = headerLink.querySelector('.plan-badge');
        if (existingBadge) existingBadge.remove();

        // 3. Only show for Owners AND Managers
        if (appState.currentUser?.role !== 'owner' && appState.currentUser?.role !== 'manager') return;

        // 4. Get the plan (Prioritize studioPlan which is synced for Managers)
        const plan = (appState.studioPlan || appState.currentUser.subscriptionStatus || 'basic').toLowerCase();
        
        // 5. Create the Badge
        const badge = document.createElement('span');
        badge.className = 'plan-badge ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider align-middle select-none';
        
        if (plan === 'premium') {
            // --- Premium "Shimmering Gold" Badge ---
            if (!document.getElementById('premium-shimmer-style')) {
                const style = document.createElement('style');
                style.id = 'premium-shimmer-style';
                style.innerHTML = `
                    @keyframes shimmerGold {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 200% 50%; }
                    }
                    .premium-gold-shimmer {
                        background: linear-gradient(110deg, #854d0e 10%, #ca8a04 30%, #fef08a 50%, #ca8a04 70%, #854d0e 90%);
                        background-size: 200% auto;
                        animation: shimmerGold 3s linear infinite;
                        color: white;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                        border: 1px solid rgba(254, 240, 138, 0.4);
                    }
                `;
                document.head.appendChild(style);
            }
            badge.classList.add('premium-gold-shimmer', 'shadow-md', 'shadow-amber-500/20');
            badge.textContent = 'PREMIUM';

        } else if (plan === 'pro') {
            // Gold/Orange Gradient for PRO
            badge.classList.add('bg-gradient-to-r', 'from-amber-400', 'to-orange-500', 'text-white', 'shadow-sm');
            badge.textContent = 'PRO';
        } else {
            // Subtle Gray for BASIC
            badge.classList.add('bg-slate-200', 'text-slate-500');
            badge.textContent = 'BASIC';
        }

        // 6. Adjust the container layout to align them nicely
        headerLink.classList.add('flex', 'items-center');
        
        // 7. Inject
        headerLink.appendChild(badge);
    };

    const updateUIVisibility = () => {
        const body = document.body;
        // Expanded isAdmin definition to include Manager
        const isAdmin = appState.currentUser?.role === 'owner' || appState.currentUser?.role === 'manager' || appState.currentUser?.role === 'staff';

        if (appState.currentUser) {
            if (isAdmin) {
                body.classList.add('admin-view');
                body.classList.remove('member-view');
            } else {
                body.classList.add('member-view');
                body.classList.remove('admin-view');
            }
        }

        // Render the navigation bar
        renderNav();
        
        // --- NEW: Render the Plan Badge ---
        renderSubscriptionBadge(); 
        // ---------------------------------

        // Render the current page content
        renderCurrentPage();
    };
    
    // --- Page Navigation & Rendering ---
    const switchPage = (pageId) => {
        // --- CLEANUP: Stop Camera if leaving Check-In page ---
        if (appState.activePage === 'check-in' && pageId !== 'check-in') {
            if (window.memberScanner) {
                window.memberScanner.stop().then(() => {
                    window.memberScanner.clear();
                    window.memberScanner = null;
                }).catch(err => console.error("Error stopping scanner on nav:", err));
            }
        }
        // ----------------------------------------------------

        appState.activePage = pageId;
        renderCurrentPage();
    };

    const renderCurrentPage = () => {
        if (!appState.currentUser) return;

        DOMElements.pages.forEach(p => p.classList.add('hidden'));
        
        DOMElements.mainNav.querySelectorAll('button[data-page]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === appState.activePage)
        });

        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        const isStaff = appState.currentUser?.role === 'staff';
        let pageIdToRender = appState.activePage;

        const ownerOnlyPages = ['statistics', 'salary', 'income'];
        const adminPages = ['members', 'admin', 'classes'];
        const memberOnlyPages = ['account', 'check-in'];

        // --- 1. Role & Plan-Based Access Control ---
        
        // Define Plan
        const plan = (appState.studioPlan || appState.currentUser?.subscriptionStatus || 'basic').toLowerCase();

        // Rule A: Basic Plan = No Admin Access for Staff/Managers
        // (Owners can always access to upgrade/manage)
        // FIX: Added 'classes', 'members', and 'admin' to allow basic management on Basic plan.
        if (plan === 'basic' && !isOwner) {
            const allowedBasicPages = ['schedule', 'check-in', 'account', 'filter', 'classes', 'members', 'admin'];
            if (!allowedBasicPages.includes(pageIdToRender)) {
                pageIdToRender = 'schedule';
            }
        }

        // Rule B: Staff Restrictions (Standard)
        // If a Staff member tries to access an owner-only page (Manager is EXEMPT)
        if (isStaff && !isManager && ownerOnlyPages.includes(pageIdToRender)) {
            pageIdToRender = 'schedule';
        }
        
        // Rule C: Non-Admin Guard
        // If a non-admin user tries to access any admin page
        if (!isOwner && !isManager && !isStaff && (ownerOnlyPages.includes(pageIdToRender) || adminPages.includes(pageIdToRender))) {
            pageIdToRender = 'schedule';
        }
        
        // Rule D: Member Guard
        // If an admin user tries to access a member-only page (Except Check-in)
        if ((isOwner || isManager || isStaff) && memberOnlyPages.includes(pageIdToRender)) {
            pageIdToRender = 'schedule';
        }

        // --- 2. Subscription-Based Feature Control ---
        // If the page itself is restricted by the plan (e.g. Statistics on Basic)
        if (!checkSubscriptionAccess(pageIdToRender)) {
            pageIdToRender = 'schedule';
        }
        
        if(appState.activePage !== pageIdToRender) {
             appState.activePage = pageIdToRender;
             showMessageBox(_('error_access_denied'), 'error');
             DOMElements.mainNav.querySelectorAll('button[data-page]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.page === appState.activePage)
             });
        }

        const pageElement = document.getElementById(`page-${pageIdToRender}`);
        if (!pageElement) return;
        pageElement.classList.remove('hidden');

        // Render Page Content
        if (pageIdToRender === 'schedule') {
            if (isOwner || isManager || isStaff) {
                renderOwnerSchedule(pageElement);
            } else {
                renderMemberSchedulePage(pageElement);
            }
        } else if (pageIdToRender === 'check-in') {
            renderCheckInPage(pageElement);
        } else if (pageIdToRender === 'account') {
            renderAccountPage(pageElement);
        } else if (pageIdToRender === 'admin') {
            // Check if studioSettings are loaded. If not, fetch them.
            if (!appState.studioSettings.clsDefaults.time) { 
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_admin_settings')}</p>`;
                database.ref('/studioSettings').once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        appState.studioSettings = { ...appState.studioSettings, ...snapshot.val() };
                    }
                    renderAdminPage(pageElement); 
                });
            } else {
                renderAdminPage(pageElement);
            }
        } else if (pageIdToRender === 'members') {
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_member_list')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    renderMembersPage(pageElement); 
                });
            } else {
                renderMembersPage(pageElement);
            }
        } else if (pageIdToRender === 'salary') {
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_required_data')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    renderSalaryPage(pageElement);
                });
            } else {
                renderSalaryPage(pageElement);
            }
        } else if (pageIdToRender === 'statistics' || pageIdToRender === 'classes' || pageIdToRender === 'income') { 
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_required_data')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                    if (pageIdToRender === 'classes') renderClassesPage(pageElement);
                    if (pageIdToRender === 'income') renderIncomePage(pageElement); 
                });
            } else {
                if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                if (pageIdToRender === 'classes') renderClassesPage(pageElement);
                if (pageIdToRender === 'income') renderIncomePage(pageElement);
            }
        }
    };
    
    // --- Generic Modal Handling ---
    const openModal = (modal) => {
        modal.classList.remove('hidden');
        setTimeout(() => modal.querySelector('.modal-content').classList.add('open'), 10);
    };
    const closeModal = (modal) => {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.remove('open');
            setTimeout(() => modal.classList.add('hidden'), 300);
        } else {
            modal.classList.add('hidden');
        }
    };
    
    // --- Confirmation & Deletion Modals ---
    const showConfirmation = (title, message, onConfirm) => {
        DOMElements.confirmationModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-4 text-center">${title}</h2>
                <p class="text-slate-600 text-center mb-6">${message}</p>
                <div class="flex justify-center gap-4">
                    <button type="button" class="cancel-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg">${_('btn_cancel')}</button>
                    <button type="button" class="confirm-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">${_('btn_confirm')}</button>
                </div>
            </div>`;
        onConfirmCallback = onConfirm;
        openModal(DOMElements.confirmationModal);

        DOMElements.confirmationModal.querySelector('.cancel-btn').onclick = () => {
            closeModal(DOMElements.confirmationModal);
        };
        DOMElements.confirmationModal.querySelector('.confirm-btn').onclick = () => { 
            if (onConfirmCallback) onConfirmCallback(); 
            closeModal(DOMElements.confirmationModal); 
        };
    };

    function handleDeleteClsRequest(cls) {
        // --- SECURITY CHECK ---
        if (!canManageBranch(appState.currentUser, cls.branchId)) {
            showMessageBox(_('error_access_denied'), 'error');
            return;
        }
        // ----------------------

        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        const hasBookings = bookedMemberIds.length > 0;

        // --- Calculate Date Context ---
        const now = new Date();
        const classDateTime = new Date(`${cls.date}T${cls.time}`);
        // We consider a class "Past" if the start time has passed.
        const isPast = classDateTime < now;

        // --- CASE 1: Past Class with Bookings (BLOCK ACTION via Modal) ---
        if (isPast && hasBookings) {
            const title = _('title_cannot_delete_past_class');
            const message = _('error_past_class_history_locked');

            DOMElements.confirmationModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <div class="text-center">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 class="text-xl font-bold text-slate-800 mb-3">${title}</h2>
                        <p class="text-slate-600 mb-6 text-sm leading-relaxed">${message}</p>
                        <button type="button" class="close-blocked-btn bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg w-full transition shadow-md">${_('btn_understood')}</button>
                    </div>
                </div>`;
            
            openModal(DOMElements.confirmationModal);
            
            const close = () => closeModal(DOMElements.confirmationModal);
            DOMElements.confirmationModal.querySelector('.close-blocked-btn').onclick = close;
            DOMElements.confirmationModal.querySelector('.modal-close-btn').onclick = close;
            return;
        }

        // --- CASE 2: Past Class without Bookings (WARN ACTION via Modal) ---
        if (isPast && !hasBookings) {
            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
            const title = _('title_delete_past_class'); 
            const message = _('confirm_delete_past_class_no_bookings').replace('{name}', getSportTypeName(sportType));

            showConfirmation(title, message, () => {
                saveSchedulePosition();
                database.ref('/classes/' + cls.id).remove().then(() => {
                    closeModal(DOMElements.clsModal);
                    showMessageBox(_('info_class_deleted'), 'info');
                    if (appState.activePage === 'classes') {
                        renderCurrentPage();
                    }
                });
            });
            return;
        }

        // --- CASE 3: Future Class (Standard Logic) ---
        if (hasBookings) {
            openDeleteClsNotifyModal(cls);
        } else {
            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
            const title = _('title_delete_class');
            const message = _('confirm_delete_class_message').replace('{name}', getSportTypeName(sportType));
            
            showConfirmation(title, message, () => {
                saveSchedulePosition();
                database.ref('/classes/' + cls.id).remove().then(() => {
                    closeModal(DOMElements.clsModal);
                    showMessageBox(_('info_class_deleted'), 'info');
                    if (appState.activePage === 'classes') {
                        renderCurrentPage();
                    }
                });
            });
        }
    }

    function openDeleteClsNotifyModal(cls) {
        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        const bookedMembers = bookedMemberIds.map(id => appState.users.find(u => u.id === id)).filter(Boolean);

        DOMElements.deleteClsNotifyModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-slate-800">${_('title_notify_members')}</h2>
                    <p class="text-slate-500 mt-2 mb-6">${_('notify_members_instructions').replace('{count}', bookedMembers.length)}</p>
                </div>
                <div id="notify-members-list" class="space-y-3 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                    ${bookedMembers.map(member => {
                        const phoneDigits = member.phone ? member.phone.replace(/\D/g, '').slice(-8) : '';
                        return `
                        <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm" data-member-id="${member.id}">
                            <div class="flex-grow">
                                <span class="font-semibold text-slate-700 member-name">${member.name}</span>
                                <span class="copy-phone-number text-sm text-slate-500 cursor-pointer hover:text-indigo-600 transition" 
                                      data-phone-digits="${phoneDigits}" 
                                      title="${_('tooltip_copy_number')}">
                                    ${formatDisplayPhoneNumber(member.phone)}
                                </span>
                            </div>
                            <button class="copy-notify-msg-btn bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-3 rounded-full transition">${_('btn_copy_whatsapp')}</button>
                        </div>
                    `}).join('')}
                </div>
                <div class="flex justify-center mt-8">
                    <button type="button" id="final-delete-btn" class="bg-red-600 text-white font-bold py-3 px-8 rounded-lg transition opacity-50 cursor-not-allowed" disabled>${_('title_delete_class')}</button>
                </div>
            </div>`;
        
        const modal = DOMElements.deleteClsNotifyModal;
        modal.querySelectorAll('.copy-notify-msg-btn').forEach(btn => {
            btn.onclick = () => {
                const memberItem = btn.closest('[data-member-id]');
                const memberId = memberItem.dataset.memberId;
                const member = appState.users.find(u => u.id === memberId);
                
                const message = createWhatsAppMessage(member, cls);
                copyTextToClipboard(message, _('success_text_copied').replace('{text}', _('label_whatsapp_message')));

                memberItem.querySelector('.member-name').classList.add('notified-member');
                btn.textContent = _('btn_copied');
                btn.disabled = true;
                btn.classList.remove('bg-green-500', 'hover:bg-green-600');
                btn.classList.add('bg-slate-300', 'cursor-default');

                const allNotified = modal.querySelectorAll('.copy-notify-msg-btn:not(:disabled)').length === 0;
                if (allNotified) {
                    const finalDeleteBtn = modal.querySelector('#final-delete-btn');
                    finalDeleteBtn.disabled = false;
                    finalDeleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            };
        });
        
        modal.querySelectorAll('.copy-phone-number').forEach(span => {
            span.onclick = (e) => {
                e.stopPropagation();
                const phoneNumber = span.dataset.phoneDigits;
                copyTextToClipboard(phoneNumber, _('success_text_copied').replace('{text}', phoneNumber.replace(/(\d{4})(?=\d)/g, '$1 ')));
            };
        });

        modal.querySelector('#final-delete-btn').onclick = () => {
            const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];

            const refundPromises = bookedMemberIds.map(memberId => {
                const member = appState.users.find(u => u.id === memberId);
                const bookingDetails = cls.bookedBy[memberId];
                
                // --- UPDATED REFUND LOGIC ---
                // We removed the `!attended` check because past attended classes are now blocked from deletion.
                // If we are here, it is a Future class, so we assume no one has attended yet.
                
                const isExplicitCredit = bookingDetails.paymentMethod === 'credit';
                const isLegacyPotential = !bookingDetails.paymentMethod && bookingDetails.creditsPaid > 0;
                const isLegacyMonthly = !bookingDetails.paymentMethod && member.monthlyPlan;

                const isCreditBooking = isExplicitCredit || (isLegacyPotential && !isLegacyMonthly);

                if (member && isCreditBooking) {
                    const creditsToRefund = parseFloat(bookingDetails.creditsPaid || 0);
                    const refundTypeId = bookingDetails.creditTypeId || cls.costCreditTypeId || 'general';
                    
                    return database.ref(`/users/${memberId}/wallet/${refundTypeId}/balance`)
                        .transaction(currentBalance => (currentBalance || 0) + creditsToRefund)
                        .then(() => {
                            if (member.credits !== undefined) {
                                return database.ref(`/users/${memberId}/credits`).remove();
                            }
                        });
                }
                
                return Promise.resolve(); 
            });

            Promise.all(refundPromises).then(() => {
                saveSchedulePosition();

                const updates = {};
                updates[`/classes/${cls.id}`] = null;

                bookedMemberIds.forEach(memberId => {
                    updates[`/memberBookings/${memberId}/${cls.id}`] = null;
                });

                database.ref().update(updates).then(() => {
                    closeModal(modal);
                    closeModal(DOMElements.clsModal);
                    showMessageBox(_('success_class_deleted_with_cleanup'), 'success');
                    if (appState.activePage === 'classes') {
                        renderCurrentPage();
                    }
                });
            });
        };

        openModal(modal);
    }

    function handleDeleteDay(dateIso) {
        if (!dateIso) return;

        // 1. Identify Context (Which branch are we looking at?)
        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;
        const currentBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : 'legacy');

        // 2. Filter classes for this date AND this branch
        const classesOnDay = appState.classes.filter(c => {
            // Must match date
            if (c.date !== dateIso) return false;
            
            // Must match branch (Handle legacy null as main branch)
            const cBranch = c.branchId || (branches.length > 0 ? branches[0].id : 'legacy');
            return cBranch === currentBranchId;
        });

        if (classesOnDay.length === 0) {
            showMessageBox(_('info_no_data_to_display'), 'info');
            return;
        }

        // 3. Validation: Check for existing bookings
        const classesWithBookings = classesOnDay.filter(c => c.bookedBy && Object.keys(c.bookedBy).length > 0);

        if (classesWithBookings.length > 0) {
            // BLOCKING STATE: Bookings exist.
            // We hijack the confirmation modal to show a custom error list.
            
            const listHtml = classesWithBookings.map(c => {
                const sportType = appState.sportTypes.find(st => st.id === c.sportTypeId);
                const bookingCount = Object.keys(c.bookedBy).length;
                const timeRange = getTimeRange(c.time, c.duration);
                return `
                    <li class="flex justify-between items-center bg-red-50 p-2 rounded border border-red-100 text-sm">
                        <span class="font-bold text-slate-700">${getSportTypeName(sportType)} <span class="font-normal text-slate-500">(${timeRange})</span></span>
                        <span class="bg-white text-red-600 font-bold px-2 py-0.5 rounded border border-red-200 text-xs">${bookingCount}</span>
                    </li>
                `;
            }).join('');

            DOMElements.confirmationModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <div class="text-center">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-800 mb-2">${_('error_delete_day_has_bookings_title')}</h2>
                        <p class="text-slate-600 mb-4 text-sm">${_('error_delete_day_has_bookings_desc')}</p>
                    </div>
                    <ul class="space-y-2 mb-6 max-h-48 overflow-y-auto">
                        ${listHtml}
                    </ul>
                    <div class="flex justify-center">
                        <button type="button" class="close-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg transition">${_('btn_understood')}</button>
                    </div>
                </div>`;
            
            openModal(DOMElements.confirmationModal);
            
            // Bind close buttons
            const close = () => closeModal(DOMElements.confirmationModal);
            DOMElements.confirmationModal.querySelector('.close-btn').onclick = close;
            DOMElements.confirmationModal.querySelector('.modal-close-btn').onclick = close;
            return;
        }

        // 4. Happy Path: No bookings, confirm deletion
        const formattedDate = formatDateWithWeekday(dateIso);
        const title = _('confirm_delete_day_title');
        let message = '';

        // --- NEW: Branch Specific Message Logic ---
        if (hasMultipleBranches) {
            const branchObj = branches.find(b => b.id === currentBranchId);
            const branchName = branchObj 
                ? ((appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name) 
                : _('label_legacy_branch');

            message = _('confirm_delete_day_branch_desc')
                .replace('{count}', classesOnDay.length)
                .replace('{date}', formattedDate)
                .replace('{branch}', branchName);
        } else {
            message = _('confirm_delete_day_desc')
                .replace('{count}', classesOnDay.length)
                .replace('{date}', formattedDate);
        }
        // ------------------------------------------

        showConfirmation(title, message, () => {
            saveSchedulePosition();
            
            // Create atomic updates to remove all classes found
            const updates = {};
            classesOnDay.forEach(cls => {
                updates[`/classes/${cls.id}`] = null;
            });

            database.ref().update(updates)
                .then(() => {
                    showMessageBox(_('info_class_deleted'), 'success'); // Reusing generic delete message
                    // The UI will update automatically via Firebase listeners
                })
                .catch(error => {
                    showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
                });
        });
    }

    function openCreditChangeNotifyModal(cls, newCredits, onConfirm) {
        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        const bookedMembers = bookedMemberIds.map(id => {
            const member = appState.users.find(u => u.id === id);
            const booking = cls.bookedBy[id];
            return { ...member, ...booking };
        }).filter(m => m.id);

        const isPriceIncrease = newCredits > cls.credits;
        const diff = Math.abs(newCredits - cls.credits);
        
        const titleText = _('title_credit_change_detected');
        const descText = _('desc_credit_change')
            .replace('{old}', cls.credits)
            .replace('{new}', newCredits);
        const instructionText = _('instruction_credit_change_manual');

        DOMElements.deleteClsNotifyModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div class="text-center mt-4">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                        <svg class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800">${titleText}</h2>
                    <p class="text-slate-600 mt-2">${descText}</p>
                    <p class="text-sm text-red-600 mt-1 font-semibold bg-red-50 inline-block px-3 py-1 rounded-full border border-red-100">${instructionText}</p>
                </div>
                <div class="mt-6 space-y-2 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-lg border border-slate-200">
                    ${bookedMembers.map(m => {
                        // --- NEW: Resolve Credit Type Pill ---
                        const typeId = m.creditTypeId || cls.costCreditTypeId || 'general';
                        const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                        const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                        const typeColor = typeDef?.color || '#64748b';
                        
                        const typePill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${typeColor}26; color: ${typeColor}">${typeName}</span>`;
                        // -------------------------------------

                        return `
                        <div class="flex justify-between items-center bg-white p-3 rounded shadow-sm border-l-4 ${isPriceIncrease ? 'border-red-400' : 'border-yellow-400'}">
                            <div>
                                <span class="font-bold text-slate-700">${m.name}</span>
                                <div class="text-xs text-slate-500 mt-0.5 flex items-center">
                                    ${_('label_paid')}: ${m.creditsPaid} ${typePill}
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="block text-xs font-bold ${isPriceIncrease ? 'text-red-600' : 'text-yellow-600'}">
                                    ${isPriceIncrease ? '-' : '+'}${parseFloat(diff.toFixed(1))} ${_('label_diff')}
                                </span>
                                <span class="text-xs text-slate-400">${_('label_new_price')}: ${newCredits}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
                <div class="flex justify-center gap-4 mt-8">
                    <button type="button" class="modal-cancel-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg transition">${_('btn_cancel')}</button>
                    <button type="button" id="confirm-credit-change-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">${_('btn_confirm')}</button>
                </div>
            </div>`;

        const modal = DOMElements.deleteClsNotifyModal;
        
        modal.querySelector('#confirm-credit-change-btn').onclick = () => onConfirm();

        const closeIconBtn = modal.querySelector('.modal-close-btn');
        if (closeIconBtn) closeIconBtn.onclick = () => closeModal(modal);

        const cancelBtn = modal.querySelector('.modal-cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => closeModal(modal);

        openModal(modal);
    }

    function createWhatsAppMessage(member, cls) {
        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === cls.tutorId);
        
        // --- NEW: Branch Logic ---
        const branches = appState.branches || [];
        let branchLine = "";
        
        if (branches.length > 1) {
            // Resolve branch (fallback to first if legacy)
            const branchId = cls.branchId || (branches[0] ? branches[0].id : null);
            const branch = branches.find(b => b.id === branchId);
            if (branch) {
                const bName = (appState.currentLanguage === 'zh-TW' && branch.name_zh) ? branch.name_zh : branch.name;
                // Add a new line for the branch
                branchLine = `*${_('label_location_item')}:* ${bName}\n`;
            }
        }
        // -------------------------

        const dynamicOrigin = window.location.origin;
        const bookingLink = `${dynamicOrigin}/fightingape`;

        const message = `
${_('whatsapp_greeting').replace('{name}', member.name)}

${_('whatsapp_body_1')}

*${_('whatsapp_class')}:* ${getSportTypeName(sportType)}
${branchLine}*${_('whatsapp_date')}:* ${formatDateWithWeekday(cls.date)}
*${_('whatsapp_time')}:* ${getTimeRange(cls.time, cls.duration)}
*${_('whatsapp_tutor')}:* ${tutor.name}

${_('whatsapp_apology')} ${_('whatsapp_refund_info')}

${_('whatsapp_cta')}
${bookingLink}

${_('whatsapp_closing')}
        `.trim();
        return message;
    }

    function copyTextToClipboard(text, successMessage) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showMessageBox(successMessage, 'success');
            } else {
                showMessageBox(_('error_copy_text_failed'), 'error');
            }
        } catch (err) {
            showMessageBox(_('error_copy_text_failed'), 'error');
        }
        document.body.removeChild(textArea);
    }
    
    function createUpdateWhatsAppMessage(member, originalCls, newClsData) {
        const sportType = appState.sportTypes.find(st => st.id === originalCls.sportTypeId);
        const originalTutor = appState.tutors.find(t => t.id === originalCls.tutorId);
        
        // --- NEW: Branch Logic (For Context) ---
        // We show the branch of the *original* class to identify it clearly
        const branches = appState.branches || [];
        let branchLine = "";
        if (branches.length > 1) {
            const branchId = originalCls.branchId || (branches[0] ? branches[0].id : null);
            const branch = branches.find(b => b.id === branchId);
            if (branch) {
                const bName = (appState.currentLanguage === 'zh-TW' && branch.name_zh) ? branch.name_zh : branch.name;
                branchLine = `*${_('label_location_item')}:* ${bName}\n`;
            }
        }
        // ---------------------------------------
        
        let changesSummary = '';

        // Check if time changed
        if (newClsData.time && newClsData.time !== originalCls.time) {
            const originalTime = getTimeRange(originalCls.time, originalCls.duration);
            const newTime = getTimeRange(newClsData.time, newClsData.duration || originalCls.duration);
            changesSummary += `*${_('whatsapp_time')}:* ~${originalTime}~ -> *${newTime}*\n`;
        }

        // Check if tutor changed
        if (newClsData.tutorId && newClsData.tutorId !== originalCls.tutorId) {
            const newTutor = appState.tutors.find(t => t.id === newClsData.tutorId);
            changesSummary += `*${_('whatsapp_tutor')}:* ~${originalTutor.name}~ -> *${newTutor.name}*\n`;
        }

        const bookingLink = `${window.location.origin}/fightingape`;

        const message = `${_('whatsapp_greeting').replace('{name}', member.name)}

${_('whatsapp_body_update')}

*${_('whatsapp_class')}:* ${getSportTypeName(sportType)}
${branchLine}*${_('whatsapp_date')}:* ${formatDateWithWeekday(originalCls.date)}

${_('whatsapp_changes_header')}
${changesSummary.trim()}

${_('whatsapp_apology')} ${_('whatsapp_cancellation_option')}

${_('whatsapp_cta')}
${bookingLink}

${_('whatsapp_closing')}
        `.trim();
        return message;
    }

    function openUpdateNotifyModal(originalCls, newClsData, onConfirm, onCancel = null) {
        const bookedMemberIds = originalCls.bookedBy ? Object.keys(originalCls.bookedBy) : [];
        const bookedMembers = bookedMemberIds.map(id => appState.users.find(u => u.id === id)).filter(Boolean);

        DOMElements.deleteClsNotifyModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-slate-800">${_('title_notify_members_update')}</h2>
                    <p class="text-slate-500 mt-2 mb-6">${_('notify_members_update_instructions').replace('{count}', bookedMembers.length)}</p>
                </div>
                <div id="notify-members-list" class="space-y-3 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                    ${bookedMembers.map(member => `
                        <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm" data-member-id="${member.id}">
                            <div class="flex-grow">
                                <span class="font-semibold text-slate-700 member-name">${member.name}</span>
                                <span class="copy-phone-number text-sm text-slate-500 cursor-pointer hover:text-indigo-600 transition" 
                                      data-phone-digits="${member.phone ? member.phone.replace(/\D/g, '').slice(-8) : ''}" 
                                      title="${_('tooltip_copy_number')}">
                                    ${formatDisplayPhoneNumber(member.phone)}
                                </span>
                            </div>
                            <button class="copy-notify-msg-btn bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-3 rounded-full transition">${_('btn_copy_whatsapp')}</button>
                        </div>
                    `).join('')}
                </div>
                <div class="flex justify-center mt-8">
                    <button type="button" id="final-confirm-btn" class="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg transition opacity-50 cursor-not-allowed" disabled>${_('btn_confirm_update')}</button>
                </div>
            </div>`;

        const modal = DOMElements.deleteClsNotifyModal;
        
        modal.querySelectorAll('.copy-notify-msg-btn').forEach(btn => {
            btn.onclick = () => {
                const memberItem = btn.closest('[data-member-id]');
                const memberId = memberItem.dataset.memberId;
                const member = appState.users.find(u => u.id === memberId);
                
                const message = createUpdateWhatsAppMessage(member, originalCls, newClsData);
                copyTextToClipboard(message, _('success_text_copied').replace('{text}', 'WhatsApp message'));

                memberItem.querySelector('.member-name').classList.add('notified-member');
                btn.textContent = _('btn_copied');
                btn.disabled = true;
                btn.classList.remove('bg-green-500', 'hover:bg-green-600');
                btn.classList.add('bg-slate-300', 'cursor-default');

                const allNotified = modal.querySelectorAll('.copy-notify-msg-btn:not(:disabled)').length === 0;
                if (allNotified) {
                    const finalConfirmBtn = modal.querySelector('#final-confirm-btn');
                    finalConfirmBtn.disabled = false;
                    finalConfirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            };
        });

        // --- THIS IS THE FIX ---
        // Add the missing event listener to all phone number spans in the modal.
        modal.querySelectorAll('.copy-phone-number').forEach(span => {
            span.onclick = (e) => {
                e.stopPropagation(); // Prevents other click events from firing
                const phoneNumber = span.dataset.phoneDigits;
                if (phoneNumber) {
                    copyTextToClipboard(phoneNumber, _('success_text_copied').replace('{text}', formatDigitsWithSpaces(phoneNumber)));
                }
            };
        });
        // --- END OF FIX ---
        
        modal.querySelector('#final-confirm-btn').onclick = onConfirm;
    
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                // Execute the onCancel callback if it was provided
                if (onCancel) {
                    onCancel();
                }
                closeModal(modal); // Then close the modal as usual
            };
        }
        openModal(modal);
    }

    function handleClsUpdateRequest(originalCls, newClsData, onCancel = null) {
        const bookedMemberIds = originalCls.bookedBy ? Object.keys(originalCls.bookedBy) : [];

        const hasRelevantChanges = (newClsData.time && newClsData.time !== originalCls.time) || 
                                   (newClsData.tutorId && newClsData.tutorId !== originalCls.tutorId);

        const performUpdate = () => {
            const finalClsData = { ...originalCls, ...newClsData };
            database.ref(`/classes/${originalCls.id}`).set(finalClsData) // Use set() to ensure a clean update
                .then(() => {
                    showMessageBox(_('success_class_updated'), 'success');
                    closeModal(DOMElements.clsModal);
                    closeModal(DOMElements.deleteClsNotifyModal);
                }).catch(error => {
                    showMessageBox(_('error_update_failed').replace('{error}', error.message), 'error');
                });
        };

        if (bookedMemberIds.length === 0 || !hasRelevantChanges) {
            performUpdate();
        } else {
            // We need to slightly modify the openUpdateNotifyModal logic.
            // The modal's 'X' button needs to trigger our new onCancel callback.
            openUpdateNotifyModal(originalCls, newClsData, performUpdate, onCancel); // Pass onCancel through
        }
    }

    async function openJoinedMembersModal(cls) {
        if (appState.copyMode.active) return;

        const freshClsSnapshot = await database.ref('/classes/' + cls.id).once('value');
        let currentCls = { id: freshClsSnapshot.key, ...freshClsSnapshot.val() };

        const bookedMemberIds = currentCls.bookedBy ? Object.keys(currentCls.bookedBy) : [];
        
        // --- UPDATED: Allow Manager to see Revenue ---
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        const canViewRevenue = isOwner || isManager;
        // ---------------------------------------------

        const sportType = appState.sportTypes.find(st => st.id === currentCls.sportTypeId);
        const translatedSubtitle = _('template_class_on_date')
            .replace('{class}', getSportTypeName(sportType))
            .replace('{date}', formatShortDateWithYear(currentCls.date));

        // --- NEW: Generate Requirements Pills (Credit + Monthly Tiers) ---
        const reqCreditId = currentCls.costCreditTypeId || 'general';
        const reqCreditDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === reqCreditId) : null;
        const reqCreditName = reqCreditDef ? getCreditTypeName(reqCreditDef) : (reqCreditId === 'general' ? _('label_general') : _('label_credits'));
        const reqCreditColor = reqCreditDef?.color || '#64748b';
        
        // 1. Credit Pill
        let requirementsHtml = `<span class="text-sm font-bold px-2 py-0.5 rounded-full whitespace-nowrap border" style="background-color: ${reqCreditColor}15; color: ${reqCreditColor}; border-color: ${reqCreditColor}30;">${reqCreditName}</span>`;

        // 2. Monthly Plan Pills
        if (!currentCls.notForMonthly && appState.monthlyPlanTiers) {
            // Logic: If allowedPlanTiers has keys, it's restricted. If empty/null, it's open to ALL.
            const isRestricted = currentCls.allowedPlanTiers && Object.keys(currentCls.allowedPlanTiers).length > 0;

            appState.monthlyPlanTiers.forEach(tier => {
                if (!isRestricted || currentCls.allowedPlanTiers[tier.id]) {
                    const tName = getMonthlyPlanName(tier);
                    requirementsHtml += `<span class="text-sm font-bold px-2 py-0.5 rounded-full whitespace-nowrap border" style="background-color: ${tier.color}15; color: ${tier.color}; border-color: ${tier.color}30;">${tName}</span>`;
                }
            });
        }
        // ---------------------------------------------------------------

        DOMElements.joinedMembersModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${_('title_class_details')}</h2>
                
                <p class="text-center text-slate-500 mb-2">${translatedSubtitle}</p>
                <div class="flex flex-wrap justify-center gap-2 mb-6 select-none">${requirementsHtml}</div>

                ${canViewRevenue ? `
                <div id="clsRevenueDetails" class="mb-6 p-4 bg-slate-50 rounded-lg text-center"><p class="text-slate-500">${_('status_calculating_revenue')}</p></div>
                ` : ''}
                <h3 class="text-xl font-bold text-slate-700 mb-4">${_('header_booked_members')}</h3>
                <div id="joinedMembersList" class="space-y-3 max-h-60 overflow-y-auto">
                    <p class="text-center text-slate-500 p-4">${_('status_loading_members')}</p>
                </div>
                
                <div class="mt-8 border-t pt-6">
                    <h3 class="text-xl font-bold text-slate-700 mb-4">${_('header_add_walk_in')}</h3>
                    <div class="relative">
                        <input type="text" id="addMemberSearchInput" placeholder="${_('placeholder_search_members_to_add')}" class="form-input w-full">
                        <div id="addMemberSearchResults" class="absolute w-full bg-white border border-slate-300 rounded-lg mt-1 z-20 max-h-64 overflow-y-auto shadow-lg hidden"></div>
                    </div>
                </div>
            </div>`;
        openModal(DOMElements.joinedMembersModal);

        const listEl = DOMElements.joinedMembersModal.querySelector('#joinedMembersList');
        
        let bookedMembers = [];
        if (bookedMemberIds.length > 0) {
            const memberPromises = bookedMemberIds.map(memberId =>
                database.ref('/users/' + memberId).once('value')
            );
            const memberSnapshots = await Promise.all(memberPromises);
            
            bookedMembers = memberSnapshots
                .map(snap => ({ id: snap.key, ...snap.val() }))
                .filter(member => member.name);
        }
        
        const usersCache = new Map(appState.users.map(u => [u.id, u]));
        bookedMembers.forEach(member => usersCache.set(member.id, member));
        appState.users = Array.from(usersCache.values());

        const renderRevenueDetails = (clsForRevenue, allClassesForCalc) => {
            if (!canViewRevenue) return; // Check updated flag
            const revenueEl = DOMElements.joinedMembersModal.querySelector('#clsRevenueDetails');
            if (!revenueEl) return;
            
            const { grossRevenue, tutorPayout, netRevenue } = calculateClsRevenueAndPayout(clsForRevenue, appState.users, appState.tutors, allClassesForCalc);
            const netRevenueColor = netRevenue >= 0 ? 'text-green-600' : 'text-red-600';
            revenueEl.innerHTML = `
                <div class="flex justify-center gap-4">
                    <div><p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-green-600">${formatCurrency(grossRevenue)}</p></div>
                    <div><p class="text-sm text-slate-500">${_('label_tutor_payout')}</p><p class="text-2xl font-bold text-red-600">(${formatCurrency(tutorPayout)})</p></div>
                    <div><p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(netRevenue)}</p></div>
                </div>`;
        };

        const allClassesSnapshot = await database.ref('/classes').once('value');
        const allClassesForCalc = firebaseObjectToArray(allClassesSnapshot.val());

        renderRevenueDetails(currentCls, allClassesForCalc);
        
        if (bookedMembers.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center">${_('status_no_bookings_yet')}</p>`;
        } else {
            listEl.innerHTML = bookedMembers.map(member => {
                const isAttended = currentCls.attendedBy && currentCls.attendedBy[member.id];
                return `<div class="bg-slate-100 p-3 rounded-lg flex justify-between items-center">
                    <div class="flex items-center">
                       <input type="checkbox" data-member-id="${member.id}" class="h-5 w-5 rounded text-indigo-600 mr-4 attendance-checkbox" ${isAttended ? 'checked' : ''}>
                       <div>
                            <p class="font-semibold text-slate-800">${member.name}</p>
                            <p class="text-sm text-slate-500">${member.email}</p>
                       </div>
                    </div>
                    <p class="text-sm text-slate-600">${formatDisplayPhoneNumber(member.phone)}</p>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.attendance-checkbox').forEach(checkbox => {
                checkbox.onchange = (e) => {
                    const memberId = e.target.dataset.memberId;
                    const isChecked = e.target.checked;
                    const attendedRef = database.ref(`/classes/${currentCls.id}/attendedBy/${memberId}`);
                    
                    if (isChecked) {
                        if (!currentCls.attendedBy) currentCls.attendedBy = {};
                        currentCls.attendedBy[memberId] = true;
                        attendedRef.set(true);
                    } else {
                        if (currentCls.attendedBy) delete currentCls.attendedBy[memberId];
                        attendedRef.remove();
                    }
                    
                    const indexInAllClasses = allClassesForCalc.findIndex(c => c.id === currentCls.id);
                    if (indexInAllClasses > -1) allClassesForCalc[indexInAllClasses] = currentCls;
                    
                    renderRevenueDetails(currentCls, allClassesForCalc);
                };
            });
        }
        
        const addMemberSearchInput = DOMElements.joinedMembersModal.querySelector('#addMemberSearchInput');
        const addMemberSearchResults = DOMElements.joinedMembersModal.querySelector('#addMemberSearchResults');

        // Optimization: Debounce timer variable
        let searchDebounce;

        addMemberSearchInput.oninput = () => {
            // 1. Clear previous timer to stop execution while typing
            clearTimeout(searchDebounce);

            // 2. Set new timer (wait 300ms)
            searchDebounce = setTimeout(async () => {
                if (appState.users.length < 50) {
                    addMemberSearchResults.innerHTML = `<p class="p-3 text-slate-500 text-center">${_('status_loading_members')}</p>`;
                    addMemberSearchResults.classList.remove('hidden');
                    // Ensure smooth scrolling on iOS
                    addMemberSearchResults.style.webkitOverflowScrolling = 'touch'; 
                    const usersSnapshot = await database.ref('/users').once('value');
                    appState.users = firebaseObjectToArray(usersSnapshot.val());
                }

                const searchTerm = addMemberSearchInput.value.toLowerCase().trim();
                if (searchTerm.length < 1) {
                    addMemberSearchResults.innerHTML = '';
                    addMemberSearchResults.classList.add('hidden');
                    return;
                }

                const unbookedMembers = appState.users.filter(u => 
                    u.role !== 'owner' && u.role !== 'manager' && u.role !== 'staff' && !u.isDeleted &&
                    (!currentCls.bookedBy || !currentCls.bookedBy[u.id]) && (
                        u.name.toLowerCase().includes(searchTerm) ||
                        u.email.toLowerCase().includes(searchTerm) ||
                        (u.phone && u.phone.includes(searchTerm)))
                ).slice(0, 50); // <--- PERFORMANCE FIX: Limit to 50 results

                if (unbookedMembers.length > 0) {
                    addMemberSearchResults.innerHTML = unbookedMembers.map(member => {
                        // --- PILL GENERATION LOGIC ---
                        const wallet = getMemberWallet(member);
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        let pillsHTML = '';

                        // 1. Credit Pills
                        Object.entries(wallet).forEach(([typeId, data]) => {
                            if ((data.balance || 0) > 0) {
                                const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                                const name = typeDef ? getCreditTypeName(typeDef) : (data.isLegacy ? _('label_general') : _('label_credits'));
                                const color = typeDef?.color || '#64748b';
                                const initial = data.initialCredits || data.balance;
                                
                                let label = `${formatCredits(data.balance)}/${formatCredits(initial)} ${name}`;
                                let pillClass = '';
                                
                                // Style: Text matches color, BG is light transparent version
                                let style = `background-color: ${color}26; color: ${color};`;
                                
                                // Check Expiry
                                if (data.expiryDate && new Date(data.expiryDate) < today) {
                                    label = `${_('label_expired')} – ${label}`;
                                    pillClass = `border border-red-200 bg-red-50 text-red-600`;
                                    style = ''; 
                                }

                                pillsHTML += `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${pillClass}" style="${style}">${label}</span>`;
                            }
                        });

                        // 2. Monthly Plan Pill
                        if (member.monthlyPlan) {
                            const tierId = member.monthlyPlanTierId;
                            const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                            const tierName = getMonthlyPlanName(tier);
                            const tierColor = tier ? tier.color : '#166534';
                            
                            let label = `${formatCurrency(member.monthlyPlanAmount)}${_('label_mo')} ${tierName}`;
                            let pillClass = '';
                            let style = `background-color: ${tierColor}26; color: ${tierColor};`;

                            // Check Due Date
                            if (member.paymentDueDate) {
                                const dueDate = new Date(member.paymentDueDate);
                                if (dueDate < today) {
                                    const overdueLabel = appState.currentLanguage === 'zh-TW' ? '已逾期' : 'Past Due';
                                    label = `${overdueLabel} – ${label}`;
                                    pillClass = `border border-red-200 bg-red-50 text-red-600`;
                                    style = '';
                                }
                            }

                            pillsHTML += `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${pillClass}" style="${style}">${label}</span>`;
                        }

                        return `
                        <div class="p-3 hover:bg-slate-100 cursor-pointer flex justify-between items-center add-member-result-item border-b border-slate-50 last:border-0" data-member-id="${member.id}">
                            <div class="flex-grow min-w-0 pr-2">
                                <div class="flex flex-wrap items-center gap-2 mb-1">
                                    <span class="font-bold text-slate-800 text-sm">${member.name}</span>
                                    ${pillsHTML}
                                </div>
                                <p class="text-sm text-slate-500 font-mono font-bold">${formatDisplayPhoneNumber(member.phone)}</p>
                            </div>
                            <button class="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg pointer-events-none flex-shrink-0 shadow-sm transition-transform active:scale-95">${_('btn_add')}</button>
                        </div>
                    `}).join('');
                    addMemberSearchResults.classList.remove('hidden');
                } else {
                    addMemberSearchResults.innerHTML = `<p class="p-3 text-slate-500 text-center">${_('status_no_members_found')}</p>`;
                    addMemberSearchResults.classList.remove('hidden');
                }
            }, 300); // 300ms Delay
        };

        addMemberSearchResults.onclick = (e) => {
            const target = e.target.closest('.add-member-result-item');
            if (target) {
                const memberId = target.dataset.memberId;
                const memberToAdd = appState.users.find(u => u.id === memberId);
                const currentBookings = currentCls.bookedBy ? Object.keys(currentCls.bookedBy).length : 0;

                if (currentBookings >= currentCls.maxParticipants) {
                    showMessageBox(_('error_class_is_full'), 'error');
                    return;
                }
                
                // --- HYBRID WALKIN LOGIC WITH DATE & BRANCH VALIDATION ---
                const today = new Date();
                today.setHours(0,0,0,0);

                let paymentMethod = 'none';
                let failureReason = '';
                
                // 1. Check Monthly Plan
                if (memberToAdd.monthlyPlan) {
                    // A. Check Expiry/Due Date First
                    const dueDate = memberToAdd.paymentDueDate ? new Date(memberToAdd.paymentDueDate) : null;
                    const isPlanOverdue = dueDate && dueDate < today;

                    if (isPlanOverdue) {
                        failureReason = 'plan_expired';
                        // Fall through to try credits
                    } else {
                        const tierId = memberToAdd.monthlyPlanTierId;
                        const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                        const tierConfig = tier || { allowGlobalAccess: true };

                        if (currentCls.notForMonthly) {
                            // Method none, fall to credits
                        } else if (currentCls.allowedPlanTiers && Object.keys(currentCls.allowedPlanTiers).length > 0) {
                            const userTierId = memberToAdd.monthlyPlanTierId || 'legacy';
                            if (currentCls.allowedPlanTiers[userTierId]) {
                                // Tier OK, Check Branch
                                if (checkAccessValidity(memberToAdd, currentCls.branchId, tierConfig)) {
                                    paymentMethod = 'monthly';
                                    failureReason = ''; // Clear reason
                                } else {
                                    failureReason = 'branch_restricted';
                                }
                            }
                        } else {
                            // No Tier restrictions, Check Branch
                            if (checkAccessValidity(memberToAdd, currentCls.branchId, tierConfig)) {
                                paymentMethod = 'monthly';
                                failureReason = ''; // Clear reason
                            } else {
                                failureReason = 'branch_restricted';
                            }
                        }
                    }
                }

                // 2. Check Credit Wallet (Fallback)
                const requiredTypeId = currentCls.costCreditTypeId || 'general';
                const creditTypeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === requiredTypeId) : null;
                const creditConfig = creditTypeDef || { allowGlobalAccess: true };
                const typeName = creditTypeDef ? getCreditTypeName(creditTypeDef) : 'Credits';
                
                const classCost = parseFloat(currentCls.credits);
                const currentBalance = getCreditBalance(memberToAdd, requiredTypeId);
                
                // Get Specific Wallet Data for Expiry Check
                const wallet = getMemberWallet(memberToAdd);
                const walletData = wallet[requiredTypeId];
                const creditExpiry = walletData?.expiryDate ? new Date(walletData.expiryDate) : null;
                const isCreditExpired = creditExpiry && creditExpiry < today;

                if (paymentMethod === 'none') {
                    if (isCreditExpired) {
                        // Mark as expired. If logic fell through from Plan Expired, this confirms both are unusable.
                        failureReason = 'credits_expired';
                    } else if (currentBalance >= classCost) {
                        if (checkAccessValidity(memberToAdd, currentCls.branchId, creditConfig)) {
                            paymentMethod = 'credit';
                            failureReason = ''; // Success
                        } else {
                            failureReason = 'branch_restricted';
                        }
                    } else if (!failureReason) {
                        // CRITICAL FIX: Only set 'insufficient' if we don't already have a specific reason (like 'plan_expired')
                        // This prevents overwriting the specific plan error with a generic credit error
                        failureReason = 'insufficient';
                    }
                }

                // 3. Execution or Error
                if (paymentMethod === 'none') {
                    if (failureReason === 'plan_expired') {
                        // Specific message: Plan is overdue AND credits are insufficient/expired
                        showMessageBox(_('error_plan_overdue_no_credits'), 'error');
                    } else if (failureReason === 'credits_expired') {
                        showMessageBox(_('status_credits_expired').replace('{type}', typeName), 'error');
                    } else if (failureReason === 'branch_restricted') {
                        showMessageBox(`Cannot add member: Plan/Credits are restricted to their Home Branch.`, 'error');
                    } else if (memberToAdd.monthlyPlan) {
                        // Only show Tier Restriction if the plan wasn't expired/overdue
                        showMessageBox(`${_('error_tier_restricted')} & ${_('error_member_insufficient_credits')} (${typeName})`, 'error');
                    } else {
                        showMessageBox(`${_('error_member_insufficient_credits')} (${typeName})`, 'error');
                    }
                    return;
                }

                const updates = {};
                let creditsPaid = 0;

                if (paymentMethod === 'credit') {
                    creditsPaid = classCost;
                    updates[`/users/${memberId}/wallet/${requiredTypeId}/balance`] = currentBalance - classCost;
                    if (memberToAdd.credits !== undefined) updates[`/users/${memberId}/credits`] = null;
                }

                updates[`/classes/${currentCls.id}/bookedBy/${memberId}`] = {
                    bookedAt: new Date().toISOString(),
                    bookedBy: appState.currentUser.name, 
                    paymentMethod: paymentMethod, 
                    monthlyCreditValue: memberToAdd.monthlyCreditValue || 0,
                    creditsPaid: creditsPaid,
                    creditTypeId: requiredTypeId 
                };
                updates[`/memberBookings/${memberId}/${currentCls.id}`] = true;
                
                database.ref().update(updates).then(() => {
                    showMessageBox(_('success_walk_in_added'), 'success');
                    closeModal(DOMElements.joinedMembersModal);
                });
            }
        };
    }

    function openBookingModal(cls) {
        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === cls.tutorId);
        const currentUser = appState.currentUser;

        // --- NEW: Branch/Location Display Logic ---
        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;
        let branchRowHtml = '';

        if (hasMultipleBranches) {
            const branchId = cls.branchId || (branches[0] ? branches[0].id : null);
            const branch = branches.find(b => b.id === branchId);
            
            if (branch) {
                const bName = (appState.currentLanguage === 'zh-TW' && branch.name_zh) ? branch.name_zh : branch.name;
                const bColor = branch.color || '#64748b';
                const pillHtml = `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-full border" style="background-color: ${bColor}15; color: ${bColor}; border-color: ${bColor}30;">${bName}</span>`;
                branchRowHtml = `<div class="flex justify-between items-center"><span class="text-slate-500">${_('label_location_item')}:</span><div>${pillHtml}</div></div>`;
            }
        }
        // ------------------------------------------

        // 1. Setup Credit Info
        const requiredTypeId = cls.costCreditTypeId || 'general'; 
        const creditTypeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === requiredTypeId) : null;
        const creditTypeName = creditTypeDef ? getCreditTypeName(creditTypeDef) : (requiredTypeId === 'general' ? _('label_general') : _('label_credits'));
        const creditColor = creditTypeDef?.color || '#64748b';
        const creditPillStyle = `background-color: ${creditColor}26; color: ${creditColor}`;
        
        // Get Wallet Data directly to check expiry
        const wallet = getMemberWallet(currentUser);
        const userWalletData = wallet[requiredTypeId] || { balance: 0, expiryDate: null };
        const userBalance = userWalletData.balance;
        const classCost = parseFloat(cls.credits);
        const today = new Date();
        today.setHours(0,0,0,0);

        // 2. WATERFALL LOGIC: Determine Payment Method
        let paymentMethod = 'none'; 
        let planIneligibilityReason = null; 
        let creditIneligibilityReason = null; 

        // Check A: Monthly Plan Eligibility
        if (currentUser.monthlyPlan) {
            // --- NEW: Expiry Check for Monthly Plan ---
            const planDueDate = currentUser.paymentDueDate ? new Date(currentUser.paymentDueDate) : null;
            const isPlanExpired = planDueDate && planDueDate < today;

            if (isPlanExpired) {
                planIneligibilityReason = 'plan_expired';
            } else {
                const tierId = currentUser.monthlyPlanTierId;
                const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;

                if (cls.notForMonthly) {
                    planIneligibilityReason = 'not_for_monthly';
                } else if (cls.allowedPlanTiers && Object.keys(cls.allowedPlanTiers).length > 0) {
                    const userTierId = tierId || 'legacy';
                    if (!cls.allowedPlanTiers[userTierId]) {
                        planIneligibilityReason = 'tier_restricted';
                    }
                }
                
                if (!planIneligibilityReason) {
                    const tierConfig = tier || { allowGlobalAccess: true };
                    if (!checkAccessValidity(currentUser, cls.branchId, tierConfig)) {
                        planIneligibilityReason = 'branch_restricted';
                    }
                }

                if (!planIneligibilityReason) {
                    paymentMethod = 'monthly';
                }
            }
        }

        // Check B: Credit Wallet (Fallback)
        if (paymentMethod === 'none') {
            // --- NEW: Expiry Check for Credits ---
            const creditExpiry = userWalletData.expiryDate ? new Date(userWalletData.expiryDate) : null;
            const isCreditExpired = creditExpiry && creditExpiry < today;

            if (isCreditExpired) {
                creditIneligibilityReason = 'credits_expired';
            } else if (userBalance >= classCost) {
                const creditConfig = creditTypeDef || { allowGlobalAccess: true };
                if (checkAccessValidity(currentUser, cls.branchId, creditConfig)) {
                    paymentMethod = 'credit';
                } else {
                    creditIneligibilityReason = 'branch_restricted';
                }
            } else {
                creditIneligibilityReason = 'insufficient';
            }
        }

        // 3. Build UI Elements
        let paymentMethodHtml = '';
        let costHtml = '';
        let balanceHtml = '';
        let noteHtml = '';

        if (paymentMethod === 'monthly') {
            // -- MONTHLY MODE --
            const tierId = currentUser.monthlyPlanTierId;
            const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
            const tierName = getMonthlyPlanName(tier);
            const tierColor = tier ? tier.color : '#166534';
            const mpPillStyle = tier ? `background-color: ${tier.color}26; color: ${tier.color};` : 'background-color: #dcfce7; color: #166534;';

            paymentMethodHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${mpPillStyle}">${_('label_method_monthly')} (${tierName})</span>`;
            costHtml = `<span class="font-bold text-green-600">${_('label_cost_included')}</span>`;   
            balanceHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${creditPillStyle}">${formatCredits(userBalance)} ${creditTypeName}</span>`;

        } else {
            // -- CREDIT MODE (or Error) --
            // Updated to display: [ Credit Plan ({creditType}) ]
            paymentMethodHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${creditPillStyle}">${_('label_credit_plan')} (${creditTypeName})</span>`;
            
            costHtml = `<span class="font-bold text-slate-700">${_('label_cost_credits').replace('{count}', classCost)}</span>`;
            
            // Determine visual state based on failure reason
            if (creditIneligibilityReason === 'credits_expired') {
                // --- UPDATE START: Use Credit Color Pill + Type Name + Red Expired Text ---
                balanceHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${creditPillStyle}" title="${_('status_credits_expired').replace('{type}', creditTypeName)}">
                    <span class="text-red-600 font-extrabold">${_('label_expired')}</span> – ${formatCredits(userBalance)} ${creditTypeName}
                </span>`;
                // --- UPDATE END ---
            } else if (creditIneligibilityReason === 'insufficient') {
                balanceHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-600 border border-red-200">${formatCredits(userBalance)} ${creditTypeName}</span>`;
            } else if (creditIneligibilityReason === 'branch_restricted') {
                balanceHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${creditPillStyle}" title="${_('error_branch_restricted_credits')}">
                    <span class="text-orange-600 font-extrabold">${_('label_home_only')}</span> – ${formatCredits(userBalance)} ${creditTypeName}
                </span>`;
            } else {
                balanceHtml = `<span class="inline-block text-sm font-bold px-3 py-1 rounded-full" style="${creditPillStyle}">${formatCredits(userBalance)} ${creditTypeName}</span>`;
            }

            // --- REPLACEMENT START: Detailed error notes with Scenario Logic ---
            if (currentUser.monthlyPlan && planIneligibilityReason) {
                let reasonText = '';
                let noteColorClass = 'text-orange-600 bg-orange-50 border-orange-100'; // Default Warning style

                if (planIneligibilityReason === 'plan_expired') {
                    // Scenario 1: Plan expired, but successfully fell back to credits
                    if (paymentMethod === 'credit') {
                        reasonText = _('info_plan_overdue_using_credits');
                        noteColorClass = 'text-blue-600 bg-blue-50 border-blue-100'; // Info/Reminder style
                    } 
                    // Scenario 2: Plan expired AND cannot afford with credits (paymentMethod is 'none')
                    else {
                        reasonText = _('error_plan_overdue_no_credits');
                        noteColorClass = 'text-red-600 bg-red-50 border-red-100'; // Error style
                    }
                }
                else if (planIneligibilityReason === 'not_for_monthly') reasonText = _('info_class_not_in_plan');
                else if (planIneligibilityReason === 'tier_restricted') reasonText = _('info_tier_restricted');
                else if (planIneligibilityReason === 'branch_restricted') reasonText = _('error_branch_restricted_plan');

                if (reasonText) {
                    noteHtml = `<div class="mt-2 text-xs ${noteColorClass} p-2 rounded border flex items-center gap-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                        ${reasonText}
                    </div>`;
                }
            }
            // --- REPLACEMENT END ---
        }

        // --- NEW: Conditionally render the Balance Row ---
        // If the payment method is 'monthly', the cost is included, so the credit balance is hidden to avoid confusion.
        let balanceRowHtml = '';
        if (paymentMethod !== 'monthly') {
            balanceRowHtml = `
            <div class="flex justify-between items-center">
                <span class="text-slate-500">${_('label_your_balance')}:</span>
                <div class="text-right">${balanceHtml}</div>
            </div>`;
        }

        DOMElements.bookingModal.innerHTML = `
            <div class="bg-white p-0 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content overflow-hidden">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="p-8 bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-center">
                    <div class="mb-4 inline-block p-3 bg-white/20 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 class="text-3xl font-bold mb-1">${_('title_confirm_spot')}</h2>
                    <p class="opacity-80">${_('subtitle_about_to_book')}</p>
                </div>
                <div class="p-8 space-y-4">
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_class')}:</span><strong class="text-slate-800">${getSportTypeName(sportType)}</strong></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_tutor')}:</span><strong class="text-slate-800">${tutor.name}</strong></div>
                    
                    ${branchRowHtml}
                    
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_time')}:</span><strong class="text-slate-800">${formatDateWithWeekday(cls.date)}, ${getTimeRange(cls.time, cls.duration)}</strong></div>
                    <hr class="my-4">
                    
                    <div class="flex justify-between items-center">
                        <span class="text-slate-500">${_('label_payment_method')}:</span>
                        <div class="text-right">${paymentMethodHtml}</div>
                    </div>
                    ${noteHtml}

                    <div class="flex justify-between items-center mt-2">
                        <span class="text-slate-500">${_('label_credits_required')}:</span>
                        <div class="text-right">${costHtml}</div>
                    </div>
                    ${balanceRowHtml}
                </div>
                <div class="p-6 bg-slate-50">
                    <button id="confirmBookingBtn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105">${_('btn_book_now')}</button>
                </div>
            </div>`;
        
        const confirmBtn = DOMElements.bookingModal.querySelector('#confirmBookingBtn');
        confirmBtn.onclick = () => {
            const memberId = currentUser.id;
            const currentBookings = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;

            if (cls.bookedBy && cls.bookedBy[memberId]) {
                showMessageBox(_('error_already_booked'), 'error');
            } else if (currentBookings >= cls.maxParticipants) {
                showMessageBox(_('error_class_full'), 'error');
            } else if (paymentMethod === 'none') {
                // --- Detailed Error Handling ---
                
                // 1. Monthly Plan Expired (Overdue)
                if (currentUser.monthlyPlan && planIneligibilityReason === 'plan_expired') {
                    // CHANGED: Use the specific "Overdue + No Credits" message for the popup
                    showMessageBox(_('error_plan_overdue_no_credits'), 'error');
                }
                // 2. Credits Expired
                else if (creditIneligibilityReason === 'credits_expired') {
                    showMessageBox(_('status_credits_expired').replace('{type}', creditTypeName), 'error');
                } 
                // 3. Branch Restricted
                else if (creditIneligibilityReason === 'branch_restricted' || planIneligibilityReason === 'branch_restricted') {
                    // Prioritize showing the restriction reason based on what they *tried* to use
                    const restrictionMsg = currentUser.monthlyPlan 
                        ? _('error_branch_restricted_plan') 
                        : `${_('error_branch_restricted_credits')} (${creditTypeName})`;
                    showMessageBox(restrictionMsg, 'error');
                } 
                // 4. Default: Insufficient Balance
                else {
                    showMessageBox(_('error_insufficient_credits'), 'error');
                }
            } else {
                confirmBtn.disabled = true;
                
                let updates = {};
                const bookingData = {
                    bookedAt: new Date().toISOString(),
                    bookedBy: 'member',
                    paymentMethod: paymentMethod,
                    creditsPaid: 0,
                    creditTypeId: requiredTypeId 
                };

                if (paymentMethod === 'monthly') {
                    bookingData.monthlyCreditValue = currentUser.monthlyCreditValue || 0;
                    bookingData.creditsPaid = 0; 
                } else {
                    bookingData.creditsPaid = classCost;
                    const newBalance = userBalance - classCost;
                    updates[`/users/${memberId}/wallet/${requiredTypeId}/balance`] = newBalance;
                    
                    if (currentUser.credits !== undefined) updates[`/users/${memberId}/credits`] = null;
                }

                updates[`/classes/${cls.id}/bookedBy/${memberId}`] = bookingData;
                updates[`/memberBookings/${memberId}/${cls.id}`] = true;
                updates[`/users/${memberId}/lastBooking`] = new Date().toISOString();

                database.ref().update(updates).then(() => {
                    appState.highlightBookingId = cls.id;
                    appState.scrollToDateOnNextLoad = cls.date;
                    showMessageBox(_('success_booking'), 'success');
                    closeModal(DOMElements.bookingModal);
                    switchPage('account');
                }).catch(error => {
                    showMessageBox(_('error_booking_failed').replace('{error}', error.message), 'error');
                }).finally(() => {
                    confirmBtn.disabled = false;
                });
            }
        };
        openModal(DOMElements.bookingModal);
    }

    function handleCancelBooking(cls, memberIdToUpdate = null) {
        const title = _('title_cancel_booking');
        const message = _('confirm_cancel_booking');

        showConfirmation(title, message, () => {
            const memberId = memberIdToUpdate || appState.currentUser.id;
            
            // Fetch member to update wallet
            const memberToUpdate = memberIdToUpdate 
                ? appState.users.find(u => u.id === memberId) 
                : appState.currentUser;

            if (!memberToUpdate) {
                showMessageBox(_('error_member_not_found'), 'error');
                return;
            }

            const bookingDetails = cls.bookedBy[memberId];
            if (!bookingDetails) {
                showMessageBox(_('error_booking_not_found'), 'error');
                return;
            }

            const updates = {};

            // --- REFUND LOGIC (UPDATED FOR LEGACY MONTHLY) ---
            
            // 1. Check for explicit 'credit' tag (New System)
            const isExplicitCredit = bookingDetails.paymentMethod === 'credit';

            // 2. Check Legacy Logic (Old System had no paymentMethod)
            // If paymentMethod is missing, we check if they paid credits.
            // FIX: If they are currently a Monthly Member, assume the legacy booking was 
            // part of their plan (don't refund), unless explicitly tagged otherwise.
            const isLegacyPotential = !bookingDetails.paymentMethod && bookingDetails.creditsPaid > 0;
            const isLegacyMonthly = !bookingDetails.paymentMethod && memberToUpdate.monthlyPlan;

            // Only refund if it is explicitly a credit booking, 
            // OR it's a legacy booking for a user who is NOT currently on a monthly plan.
            const isCreditBooking = isExplicitCredit || (isLegacyPotential && !isLegacyMonthly);

            if (isCreditBooking) {
                const creditsToRefund = parseFloat(bookingDetails.creditsPaid || 0);
                
                // Identify Wallet
                const refundTypeId = bookingDetails.creditTypeId || cls.costCreditTypeId || 'general';
                
                const currentBalance = getCreditBalance(memberToUpdate, refundTypeId);
                const newBalance = currentBalance + creditsToRefund;
                
                updates[`/users/${memberId}/wallet/${refundTypeId}/balance`] = newBalance;
                
                // Cleanup Legacy if exists
                if (memberToUpdate.credits !== undefined) updates[`/users/${memberId}/credits`] = null;
            }

            updates[`/classes/${cls.id}/bookedBy/${memberId}`] = null;
            updates[`/memberBookings/${memberId}/${cls.id}`] = null;

            database.ref().update(updates).then(() => {
                if (memberIdToUpdate) {
                    // Admin view update
                    const updatedMember = { ...memberToUpdate }; 
                    openMemberBookingHistoryModal(updatedMember);
                } 
                else {
                    // Member view update
                    const clsIndex = appState.classes.findIndex(c => c.id === cls.id);
                    if (clsIndex > -1 && appState.classes[clsIndex].bookedBy) {
                        delete appState.classes[clsIndex].bookedBy[appState.currentUser.id];
                    }
                    renderCurrentPage();
                }

                showMessageBox(_('info_booking_cancelled'), 'info');
            }).catch(error => {
                showMessageBox(_('error_cancellation_failed').replace('{error}', error.message), 'error');
            });
        });
    }

    function openClsModal(dateIso, clsToEdit = null) {
        // --- 1. Determine Context (Branch) ---
        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;
        let targetBranchId = null;
        let targetBranchName = "";
        let targetBranchColor = "#64748b"; // Default Gray

        if (clsToEdit) {
            targetBranchId = clsToEdit.branchId || (branches.length > 0 ? branches[0].id : null);
        } else {
            // Creating new: Use selected branch, or default to first
            targetBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : null);
        }

        if (targetBranchId) {
            const b = branches.find(br => br.id === targetBranchId);
            if (b) {
                // Localization Logic
                targetBranchName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                // Color Logic
                targetBranchColor = b.color || "#64748b";
            } else {
                targetBranchName = _('label_legacy_branch');
            }
        }

        // --- 2. Filter Tutors & Sports based on Branch ---
        const validTutors = appState.tutors.filter(t => 
            !t.homeBranchId || t.homeBranchId === targetBranchId
        );

        const validSportTypeIds = new Set();
        validTutors.forEach(t => {
            if (t.skills) {
                t.skills.forEach(s => validSportTypeIds.add(s.sportTypeId));
            }
        });
        const validSportTypes = appState.sportTypes.filter(st => validSportTypeIds.has(st.id));

        // --- 3. Build HTML ---
        // New Pill Style using the branch color
        const branchPillHTML = hasMultipleBranches 
            ? `<div class="text-center mb-6">
                 <span class="text-xs font-bold px-3 py-1 rounded-full border" 
                       style="background-color: ${targetBranchColor}26; color: ${targetBranchColor}; border-color: ${targetBranchColor}40;">
                    ${_('info_class_branch')}: ${targetBranchName}
                 </span>
               </div>` 
            : '<div class="mb-6"></div>';

        DOMElements.clsModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="clsModalTitle" class="text-3xl font-bold text-slate-800 mb-2 text-center"></h2>
                
                ${branchPillHTML}

                <form id="clsForm">
                    <input type="hidden" id="clsModalId">
                    <!-- Store Branch ID -->
                    <input type="hidden" id="clsBranchId" value="${targetBranchId || ''}">

                    <div class="space-y-4">
                        <div>
                            <label for="clsSportType" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_sport_type')}</label>
                            <select id="clsSportType" name="sportTypeId" required class="form-select"></select>
                        </div>
                        <div>
                            <label for="clsTutor" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_tutor')}</label>
                            <select id="clsTutor" name="tutorId" required class="form-select"></select>
                        </div>
                        
                        <div>
                            <label for="clsCreditType" data-lang-key="label_required_credit_type" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <select id="clsCreditType" name="costCreditTypeId" required class="form-select"></select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="clsDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_date')}</label>
                                <input type="date" id="clsDate" name="date" required class="form-input">
                            </div>
                            <div>
                                <label for="clsTime" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_start_time')}</label>
                                <input type="text" id="clsTime" name="time" required class="form-input" pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" title="Enter time in 24-hour HH:MM format">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="clsDuration" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_duration')}</label>
                                <input type="number" id="clsDuration" name="duration" required min="15" max="240" step="5" class="form-input">
                            </div>
                            <div>
                                <label for="clsCredits" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_credits')}</label>
                                <input type="number" id="clsCredits" name="credits" required min="0" max="20" step="0.01" class="form-input">
                            </div>
                        </div>
                        <div>
                            <label for="clsMaxParticipants" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_max_participants')}</label>
                            <input type="number" id="clsMaxParticipants" name="maxParticipants" required min="1" max="100" class="form-input">
                        </div>
                        
                        <div class="pt-4 border-t space-y-4">
                            <div>
                                <label class="flex items-center cursor-pointer">
                                    <input type="checkbox" id="notForMonthlyCheckbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500">
                                    <span class="ml-3 text-slate-700 font-semibold">${_('label_not_for_monthly')}</span>
                                </label>
                                <p class="text-xs text-slate-500 ml-7">${_('desc_not_for_monthly')}</p>
                            </div>

                            <!-- Monthly Restriction UI -->
                            <div id="monthlyTierRestrictions" class="hidden ml-7">
                                <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_monthly_access')}</label>
                                <div class="flex gap-4 mb-2">
                                    <label class="flex items-center">
                                        <input type="radio" name="tierAccessType" value="all" checked class="text-indigo-600">
                                        <span class="ml-2 text-sm">${_('option_access_all')}</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="tierAccessType" value="restricted" class="text-indigo-600">
                                        <span class="ml-2 text-sm">${_('option_access_restricted')}</span>
                                    </label>
                                </div>
                                <div id="tierCheckboxes" class="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 hidden"></div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-center items-center gap-4 mt-8">
                        <button type="button" class="delete-btn bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-5 rounded-lg transition hidden">${_('btn_delete')}</button>
                        <button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg flex-grow"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.clsModal;
        const form = modal.querySelector('form');
        form.reset();
        
        // Populate Sport Types (Filtered)
        populateDropdown(form.querySelector('#clsSportType'), validSportTypes, true);
        
        const creditTypeSelect = form.querySelector('#clsCreditType');
        const creditTypes = appState.creditTypes || [];
        
        let ctOptions = '';

        if (creditTypes.length > 0) {
            // Add Placeholder if multiple types exist
            ctOptions += `<option value="" disabled selected>${_('placeholder_select_credit_type')}</option>`;
            ctOptions += creditTypes.map(ct => `<option value="${ct.id}">${getCreditTypeName(ct)}</option>`).join('');
        } else {
            // Fallback for legacy/single type
            ctOptions = `<option value="general">${_('label_general_credits_default')}</option>`;
        }
        
        creditTypeSelect.innerHTML = ctOptions;

        const deleteBtn = form.querySelector('.delete-btn');
        deleteBtn.classList.add('hidden');
        
        // --- Monthly Tier Restriction Logic ---
        const tiersContainer = form.querySelector('#monthlyTierRestrictions');
        const tierCheckboxesContainer = form.querySelector('#tierCheckboxes');
        const monthlyTiers = appState.monthlyPlanTiers || [];
        
        if (monthlyTiers.length > 0) {
            tiersContainer.classList.remove('hidden');
            
            const hasLegacyMembers = appState.users.some(u => u.role === 'member' && !u.isDeleted && u.monthlyPlan && !u.monthlyPlanTierId);
            let checksHTML = '';
            if (hasLegacyMembers) {
                checksHTML += `
                <label class="flex items-center">
                    <input type="checkbox" value="legacy" class="tier-checkbox h-4 w-4 text-indigo-600 rounded">
                    <span class="ml-2 text-sm text-slate-600">${_('label_legacy_tier')}</span>
                </label>`;
            }
            
            checksHTML += monthlyTiers.map(t => `
                <label class="flex items-center">
                    <input type="checkbox" value="${t.id}" class="tier-checkbox h-4 w-4 text-indigo-600 rounded">
                    <span class="ml-2 text-sm text-slate-600" style="color:${t.color}">${getMonthlyPlanName(t)}</span>
                </label>
            `).join('');
            
            tierCheckboxesContainer.innerHTML = checksHTML;

            const radios = form.querySelectorAll('input[name="tierAccessType"]');
            radios.forEach(r => {
                r.onchange = () => {
                    if (r.value === 'restricted') {
                        tierCheckboxesContainer.classList.remove('hidden');
                    } else {
                        tierCheckboxesContainer.classList.add('hidden');
                    }
                };
            });
        } else {
            tiersContainer.classList.add('hidden');
        }

        const notForMonthlyCheckbox = form.querySelector('#notForMonthlyCheckbox');
        notForMonthlyCheckbox.onchange = () => {
            if (notForMonthlyCheckbox.checked) {
                tiersContainer.classList.add('opacity-50', 'pointer-events-none');
            } else {
                tiersContainer.classList.remove('opacity-50', 'pointer-events-none');
            }
        };

        const updateTutorDropdown = () => {
            const selectedSportId = form.querySelector('#clsSportType').value;
            const skilledTutors = validTutors.filter(tutor => 
                tutor.skills && tutor.skills.some(skill => skill.sportTypeId === selectedSportId)
            );
            populateDropdown(form.querySelector('#clsTutor'), skilledTutors);
        };

        form.querySelector('#clsSportType').onchange = updateTutorDropdown;

        if (clsToEdit) {
            modal.querySelector('#clsModalTitle').textContent = _('title_edit_class');
            modal.querySelector('.submit-btn').textContent = _('btn_save_changes');
            form.querySelector('#clsModalId').value = clsToEdit.id;
            
            form.querySelector('#clsSportType').value = clsToEdit.sportTypeId;
            
            updateTutorDropdown();
            form.querySelector('#clsTutor').value = clsToEdit.tutorId;
            
            form.querySelector('#clsDuration').value = clsToEdit.duration;
            form.querySelector('#clsTime').value = clsToEdit.time;
            form.querySelector('#clsCredits').value = clsToEdit.credits;
            form.querySelector('#clsMaxParticipants').value = clsToEdit.maxParticipants;
            form.querySelector('#clsDate').value = clsToEdit.date;
            form.querySelector('#notForMonthlyCheckbox').checked = clsToEdit.notForMonthly || false;
            notForMonthlyCheckbox.dispatchEvent(new Event('change'));
            creditTypeSelect.value = clsToEdit.costCreditTypeId || 'general';
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => handleDeleteClsRequest(clsToEdit);

            if (monthlyTiers.length > 0) {
                const allowed = clsToEdit.allowedPlanTiers;
                if (allowed) {
                    form.querySelector('input[name="tierAccessType"][value="restricted"]').checked = true;
                    tierCheckboxesContainer.classList.remove('hidden');
                    form.querySelectorAll('.tier-checkbox').forEach(cb => {
                        cb.checked = !!allowed[cb.value];
                    });
                } else {
                    form.querySelector('input[name="tierAccessType"][value="all"]').checked = true;
                    tierCheckboxesContainer.classList.add('hidden');
                }
            }

        } else {
            modal.querySelector('#clsModalTitle').textContent = _('title_add_class');
            modal.querySelector('.submit-btn').textContent = _('btn_add_class');
            form.querySelector('#clsModalId').value = '';
            
            updateTutorDropdown();
            
            const defaultDate = dateIso || new Date().toISOString().split('T')[0];
            form.querySelector('#clsDate').value = defaultDate;
            const defaults = appState.studioSettings.clsDefaults;
            form.querySelector('#clsDuration').value = defaults.duration;
            form.querySelector('#clsCredits').value = defaults.credits;
            form.querySelector('#clsMaxParticipants').value = defaults.maxParticipants;
            
            const classesOnDay = appState.classes.filter(c => c.date === defaultDate).sort((a, b) => a.time.localeCompare(b.time));
            if (classesOnDay.length > 0) {
                const lastCls = classesOnDay[classesOnDay.length - 1];
                const [hours, minutes] = lastCls.time.split(':').map(Number);
                const lastClsStartTime = new Date();
                lastClsStartTime.setHours(hours, minutes, 0, 0);
                const nextAvailableTime = new Date(lastClsStartTime.getTime() + lastCls.duration * 60000);
                const defaultHours = String(nextAvailableTime.getHours()).padStart(2, '0');
                const defaultMinutes = String(nextAvailableTime.getMinutes()).padStart(2, '0');
                form.querySelector('#clsTime').value = `${defaultHours}:${defaultMinutes}`;
            } else {
                form.querySelector('#clsTime').value = defaults.time;
            }
        }
        form.onsubmit = handleClsFormSubmit;
        openModal(modal);
        updateUIText();
    }

    function openNumericDialModal(title, currentValue, min, max, onConfirm) {
        const modalContainer = DOMElements.numericDialModal;
        if (!modalContainer) return;

        // --- The spacer logic from before is still correct ---
        let optionsHTML = '';
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';

        for (let i = min; i <= max; i++) {
            const isSelected = (i === currentValue);
            optionsHTML += `<div class="dial-option ${isSelected ? 'selected' : ''}" data-value="${i}">${i}</div>`;
        }
        
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';
        optionsHTML += '<div class="dial-option dial-spacer"> </div>';

        modalContainer.innerHTML = `
            <div class="numeric-dial-modal-content modal-content">
                <div class="dial-header">
                    <button type="button" class="cancel-btn text-lg text-slate-500 hover:text-slate-700 font-semibold">${_('btn_cancel')}</button>
                    <h3 class="text-lg font-bold text-slate-800">${title}</h3>
                    <button type="button" class="confirm-btn text-lg text-indigo-600 hover:text-indigo-800 font-bold">${_('btn_done')}</button>
                </div>
                <div class="dial-options-container">
                    ${optionsHTML}
                </div>
            </div>`;
            
        const optionsContainer = modalContainer.querySelector('.dial-options-container');
        let selectedValue = currentValue;
        let debounceTimer;

        optionsContainer.addEventListener('scroll', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const containerRect = optionsContainer.getBoundingClientRect();
                const containerCenter = containerRect.top + (containerRect.height / 2);

                let closestElement = null;
                let minDistance = Infinity;

                optionsContainer.querySelectorAll('.dial-option[data-value]').forEach(option => {
                    const optionRect = option.getBoundingClientRect();
                    const optionCenter = optionRect.top + (optionRect.height / 2);
                    const distance = Math.abs(containerCenter - optionCenter);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestElement = option;
                    }
                });

                if (closestElement) {
                    selectedValue = parseInt(closestElement.dataset.value);
                    if (!closestElement.classList.contains('selected')) {
                        optionsContainer.querySelector('.selected')?.classList.remove('selected');
                        closestElement.classList.add('selected');
                        // --- THIS LINE IS THE FIX: Remove the programmatic scroll ---
                        // By removing this, we no longer fight the user's native scroll.
                        // closestElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 150);
        });

        optionsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.dial-option[data-value]');
            // The click handler *should* still scroll the item to the center.
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        modalContainer.querySelector('.confirm-btn').onclick = () => {
            onConfirm(selectedValue);
            closeModal(modalContainer);
        };
        modalContainer.querySelector('.cancel-btn').onclick = () => {
            closeModal(modalContainer);
        };

        openModal(modalContainer);
        const initialSelected = optionsContainer.querySelector('.selected');
        if (initialSelected) {
            initialSelected.scrollIntoView({ block: 'center' });
        }
    }

    function handleClsFormSubmit(e) {
        e.preventDefault();
        saveSchedulePosition();
        const form = e.target;
        const clsId = form.querySelector('#clsModalId').value;
        const branchId = form.querySelector('#clsBranchId').value; // The branch this class belongs to
        
        // --- SECURITY CHECK ---
        if (!canManageBranch(appState.currentUser, branchId)) {
            showMessageBox(_('error_access_denied'), 'error');
            return;
        }
        // ----------------------

        const submitBtn = form.querySelector('.submit-btn');
        
        // Extract values for conflict check
        const tutorId = form.querySelector('#clsTutor').value;
        const date = form.querySelector('#clsDate').value;
        const time = form.querySelector('#clsTime').value;
        const duration = parseInt(form.querySelector('#clsDuration').value);
        
        // --- 1. Conflict Check ---
        const conflict = checkTutorConflict(tutorId, date, time, duration, clsId);
        
        // Define the core save logic as a reusable function
        const proceedWithSave = () => {
            submitBtn.disabled = true;
            const newCredits = parseFloat(form.querySelector('#clsCredits').value);

            // Calculate Restrictions
            let allowedPlanTiers = null;
            const tierAccessType = form.querySelector('input[name="tierAccessType"]:checked')?.value;
            
            if (tierAccessType === 'restricted') {
                allowedPlanTiers = {};
                form.querySelectorAll('.tier-checkbox:checked').forEach(cb => {
                    allowedPlanTiers[cb.value] = true;
                });
            }

            const newClsDataFromForm = {
                sportTypeId: form.querySelector('#clsSportType').value,
                tutorId: tutorId,
                duration: duration,
                time: time,
                credits: newCredits, 
                costCreditTypeId: form.querySelector('#clsCreditType').value, 
                maxParticipants: parseInt(form.querySelector('#clsMaxParticipants').value),
                date: date,
                notForMonthly: form.querySelector('#notForMonthlyCheckbox').checked,
                allowedPlanTiers: allowedPlanTiers,
                branchId: branchId || null 
            };

            const tutor = appState.tutors.find(t => t.id === newClsDataFromForm.tutorId);
            if (tutor) {
                const skill = tutor.skills.find(s => s.sportTypeId === newClsDataFromForm.sportTypeId);
                if (skill) {
                    newClsDataFromForm.payoutDetails = {
                        salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                        salaryValue: (tutor.isEmployee || skill.salaryType === 'custom') ? 0 : skill.salaryValue,
                        salaryFormulaId: (tutor.isEmployee ? null : skill.salaryFormulaId) || null 
                    };
                }
            }

            if (clsId) {
                const originalCls = appState.classes.find(c => c.id === clsId);
                if (!originalCls) {
                    showMessageBox(_('error_could_not_find_original_class'), 'error');
                    submitBtn.disabled = false;
                    return;
                }

                const creditsChanged = originalCls.credits !== newCredits;
                const hasBookings = originalCls.bookedBy && Object.keys(originalCls.bookedBy).length > 0;

                if (creditsChanged && hasBookings) {
                    openCreditChangeNotifyModal(originalCls, newCredits, () => {
                        closeModal(DOMElements.deleteClsNotifyModal);
                        handleClsUpdateRequest(originalCls, newClsDataFromForm);
                    });
                    submitBtn.disabled = false; 
                    return; 
                }
                
                handleClsUpdateRequest(originalCls, newClsDataFromForm);
                submitBtn.disabled = false;
                
            } else {
                const updates = {};
                const monthIndexKey = newClsDataFromForm.date.substring(0, 7);
                const newClsKey = database.ref('/classes').push().key;
                newClsDataFromForm.bookedBy = {};
                newClsDataFromForm.attendedBy = {};
                
                updates[`/classes/${newClsKey}`] = newClsDataFromForm;
                updates[`/clsMonths/${monthIndexKey}`] = true;
                
                database.ref().update(updates).then(() => {
                    showMessageBox(_('success_class_added'), 'success');
                    closeModal(DOMElements.clsModal);
                }).catch(error => {
                    showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
                }).finally(() => {
                    submitBtn.disabled = false;
                });
            }
        };

        if (conflict) {
            const tutor = appState.tutors.find(t => t.id === tutorId);
            const warningMsg = _('warning_tutor_conflict')
                .replace('{tutor}', tutor.name)
                .replace('{class}', conflict.className)
                .replace('{branch}', conflict.branchName)
                .replace('{time}', conflict.timeRange);
                
            showConfirmation(
                _('title_tutor_conflict'),
                `${warningMsg}<br><br>${_('confirm_ignore_conflict')}`,
                proceedWithSave
            );
        } else {
            proceedWithSave();
        }
    }

    function createParticipantCounter(current, max, isEditable = false) {
        const fillRate = max > 0 ? current / max : 0;
        const spotsRemaining = max - current;
        
        let statusCls = 'status-low';
        let urgencyText = '';

        if (fillRate >= 1) {
            statusCls = 'status-full';
        } else if (spotsRemaining === 1) {
            statusCls = 'status-high'; // Use orange for urgency
            urgencyText = `<span class="urgency-indicator-text">${_('label_last_spot')}</span>`;
        } else if (spotsRemaining === 2) {
            statusCls = 'status-high'; // Use orange for urgency
            urgencyText = `<span class="urgency-indicator-text">${_('label_few_spots_left')}</span>`;
        } else if (fillRate >= 0.5) { // Medium is now the fallback for >50%
            statusCls = 'status-medium';
        }
        
        const editableCls = isEditable ? 'participant-counter-editable' : '';

        const tooltipText = _('tooltip_spots_filled').replace('{current}', current).replace('{max}', max);

        // The inner HTML now includes the urgency text when applicable
        return `
            <div class="participant-counter ${statusCls} ${editableCls}" title="${tooltipText}">
                ${urgencyText}${current}/${max}
            </div>
        `;
    }

    function openAnnouncementModal() {
        const modal = DOMElements.announcementModal;
        const current = appState.currentAnnouncement;

        modal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-6 text-center">${_('announcement_modal_title')}</h2>
                <form id="announcementForm" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="announcementTitleEn" class="block text-slate-600 text-sm font-semibold mb-2">${_('announcement_title_label_en')}</label>
                            <input type="text" id="announcementTitleEn" class="form-input" placeholder="e.g., Holiday Notice" value="${current?.title?.en || ''}">
                        </div>
                        <div>
                            <label for="announcementTitleZh" class="block text-slate-600 text-sm font-semibold mb-2">${_('announcement_title_label_zh')}</label>
                            <input type="text" id="announcementTitleZh" class="form-input" placeholder="例如：假期通知" value="${current?.title?.zh || ''}">
                        </div>
                    </div>
                    <div>
                        <label for="announcementMessageEn" class="block text-slate-600 text-sm font-semibold mb-2">${_('announcement_message_label_en')}</label>
                        <textarea id="announcementMessageEn" class="form-input" rows="3" placeholder="Enter the English announcement details here...">${current?.message?.en || ''}</textarea>
                    </div>
                    <div>
                        <label for="announcementMessageZh" class="block text-slate-600 text-sm font-semibold mb-2">${_('announcement_message_label_zh')}</label>
                        <textarea id="announcementMessageZh" class="form-input" rows="3" placeholder="在此輸入中文公告內容...">${current?.message?.zh || ''}</textarea>
                    </div>
                    
                    <!-- NEW: Color Picker Section -->
                    <div>
                        <label data-lang-key="label_color" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_color') || 'Color'}</label>
                        <div id="announceColorPickerContainer" class="color-swatch-container"></div>
                        <input type="hidden" id="announceColor">
                    </div>

                    <div class="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                        <button type="button" id="clearAnnouncementBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition ${!current ? 'hidden' : ''}">${_('btn_clear_announcement')}</button>
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">${_('btn_publish_announcement')}</button>
                    </div>
                </form>
            </div>
        `;

        const form = modal.querySelector('#announcementForm');
        
        // --- Initialize Color Picker ---
        const colorInput = form.querySelector('#announceColor');
        // Default to Indigo (#6366f1) if no color exists
        colorInput.value = current?.color || '#6366f1'; 
        renderColorPicker(form.querySelector('#announceColorPickerContainer'), colorInput);
        // -------------------------------

        form.onsubmit = handleAnnouncementFormSubmit;

        modal.querySelector('#clearAnnouncementBtn').onclick = () => {
            database.ref('/announcements/current').remove().then(() => {
                showMessageBox(_('success_announcement_cleared'), 'success');
                closeModal(modal);
            });
        };

        openModal(modal);
    }

    function handleAnnouncementFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        // --- START: MODIFIED VALIDATION LOGIC ---
        const messageEn = form.querySelector('#announcementMessageEn').value.trim();
        const messageZh = form.querySelector('#announcementMessageZh').value.trim();

        if (!messageEn && !messageZh) {
            showMessageBox(_('error_announcement_message_required'), 'error');
            return;
        }
        // --- END: MODIFIED VALIDATION LOGIC ---

        const newAnnouncement = {
            id: new Date().getTime(),
            title: {
                en: form.querySelector('#announcementTitleEn').value.trim(),
                zh: form.querySelector('#announcementTitleZh').value.trim()
            },
            message: {
                en: messageEn,
                zh: messageZh
            },
            // --- NEW: Save Selected Color ---
            color: form.querySelector('#announceColor').value, 
            // --------------------------------
            postedBy: appState.currentUser.name,
            postedAt: new Date().toISOString()
        };

        database.ref('/announcements/current').set(newAnnouncement).then(() => {
            showMessageBox(_('success_announcement_published'), 'success');
            closeModal(DOMElements.announcementModal);
        });
    }

    function displayAnnouncement() {
        const banner = DOMElements.announcementBanner;
        const announcement = appState.currentAnnouncement;

        if (!announcement || !banner) {
            if (banner) banner.classList.add('hidden');
            return;
        }

        const dismissedId = localStorage.getItem('dismissedAnnouncementId');
        if (String(announcement.id) === dismissedId) {
            banner.classList.add('hidden');
            return;
        }
        
        // Helper to get the correct text with the new flexible fallback logic
        const getTranslatedText = (field) => {
            if (!field) return ''; // Handles cases where the title/message object might not exist
            
            const preferredText = (appState.currentLanguage === 'zh-TW') ? field.zh : field.en;
            const fallbackText = (appState.currentLanguage === 'zh-TW') ? field.en : field.zh;

            // Return the first available text: preferred or fallback.
            return preferredText || fallbackText || '';
        };

        const title = getTranslatedText(announcement.title);
        const message = getTranslatedText(announcement.message);

        // If after checking both languages the message is still empty, don't show the banner.
        if (!message) {
             banner.classList.add('hidden');
             return;
        }

        banner.innerHTML = `
            <div class="announcement-content">
                ${title ? `<p class="announcement-title">${title}</p>` : ''}
                <p>${message}</p>
            </div>
            <button class="announcement-dismiss-btn" aria-label="Dismiss announcement">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        `;

        banner.classList.remove('hidden');

        banner.style.backgroundColor = announcement.color || '#6366f1';

        banner.querySelector('.announcement-dismiss-btn').onclick = () => {
            banner.classList.add('hidden');
            localStorage.setItem('dismissedAnnouncementId', announcement.id);
        };
    }

    function createClsElement(cls) {
        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === cls.tutorId);
        const el = document.createElement('div');
        el.id = cls.id; 
        
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isManager || isStaff;
        
        const currentBookings = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
        
        // --- STAFF PERMISSION LOGIC ---
        let hasWritePermission = true;
        if (isStaff || isManager) {
            const user = appState.currentUser;
            const staffLevel = user.staffAccessLevel || 'home_only';
            if (staffLevel !== 'global_write') {
                const branches = appState.branches || [];
                const defaultBranchId = branches.length > 0 ? branches[0].id : null;
                const classBranchId = cls.branchId || defaultBranchId;
                let writeAllowedIds = [];
                if (user.allowedBranches && Object.keys(user.allowedBranches).length > 0) {
                    writeAllowedIds = Object.keys(user.allowedBranches);
                } else {
                    writeAllowedIds = [user.homeBranchId || defaultBranchId];
                }
                if (!writeAllowedIds.includes(classBranchId)) {
                    hasWritePermission = false;
                }
            }
        }

        const isEndedToday = !isAdmin && cls.date === getIsoDate(new Date()) && (() => {
            const now = new Date();
            const [hours, minutes] = cls.time.split(':').map(Number);
            const classEndTime = new Date(); 
            classEndTime.setHours(hours, minutes, 0, 0);
            classEndTime.setMinutes(classEndTime.getMinutes() + (cls.duration || 0));
            return now > classEndTime;
        })();

        // --- PERFORMANCE UPDATE: CSS Class Assignment Only ---
        el.className = `cls-block text-white ${isEndedToday ? 'cls-block-ended' : ''}`;

        // --- PERFORMANCE UPDATE: CSS Variables instead of Inline Styles ---
        const baseColor = sportType?.color || '#64748b';
        el.style.setProperty('--base-color', baseColor);

        // --- Filter Logic ---
        const { memberSportType, memberTutor } = appState.selectedFilters;
        const sportMatch = memberSportType === 'all' || cls.sportTypeId === memberSportType;
        const tutorMatch = memberTutor === 'all' || cls.tutorId === memberTutor;
        if (!sportMatch || !tutorMatch) {
            el.classList.add('filtered-out');
        }
        
        let actionButton = '';
        const isBookedByCurrentUser = !isAdmin && appState.currentUser && cls.bookedBy && cls.bookedBy[appState.currentUser.id];
        const isAttendedByCurrentUser = !isAdmin && appState.currentUser && cls.attendedBy && cls.attendedBy[appState.currentUser.id];
        const isFull = currentBookings >= cls.maxParticipants;
        
        const isMonthlyMember = !isAdmin && appState.currentUser.monthlyPlan;
        const isRestrictedForMonthly = cls.notForMonthly;

        let isTierRestricted = false;
        if (isMonthlyMember && !isRestrictedForMonthly && cls.allowedPlanTiers) {
            const userTierId = appState.currentUser.monthlyPlanTierId || 'legacy';
            if (!cls.allowedPlanTiers[userTierId]) {
                isTierRestricted = true;
            }
        }

        let canAffordWithCredits = false;
        if (!isAdmin && appState.currentUser) {
            const requiredTypeId = cls.costCreditTypeId || 'general';
            const userBalance = getCreditBalance(appState.currentUser, requiredTypeId);
            canAffordWithCredits = userBalance >= parseFloat(cls.credits);
        }

        const isPlanRestricted = isMonthlyMember && (isRestrictedForMonthly || isTierRestricted);
        const isTrulyBlocked = isPlanRestricted && !canAffordWithCredits && !isBookedByCurrentUser;

        if (isAdmin) {
            if (hasWritePermission) {
                el.classList.add('cursor-pointer');
                actionButton = `<button class="edit-cls-btn absolute top-2 right-2 opacity-60 hover:opacity-100 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>`;
            } else {
                el.classList.add('cursor-default');
            }
        } 
        else if (isTrulyBlocked) {
            el.classList.add('cls-block-restricted', 'cursor-pointer');
        } 
        else if (isBookedByCurrentUser) {
            el.classList.add('booked-by-member');
        } else if (appState.currentUser && !isFull) {
            el.classList.add('cursor-pointer');
        }

        const requiredTypeId = cls.costCreditTypeId || 'general';
        const creditTypeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === requiredTypeId) : null;
        let creditDisplayName;
        if (creditTypeDef) {
            creditDisplayName = getCreditTypeName(creditTypeDef);
        } else {
            creditDisplayName = _(cls.credits === 1 ? 'label_credit_single' : 'label_credit_plural');
        }
        const creditText = `${cls.credits} ${creditDisplayName}`;

        let memberActionHTML;
        if (isBookedByCurrentUser) {
            const now = new Date();
            const classStartDateTime = new Date(`${cls.date}T${cls.time}`);
            const hasClassStarted = now > classStartDateTime;

            const settings = appState.studioSettings.clsDefaults || {};
            const cutoffHours = settings.cancellationCutoff || 0;
            const cutoffTime = new Date(classStartDateTime.getTime() - (cutoffHours * 60 * 60 * 1000));
            
            const isCancellationClosed = (now > cutoffTime) && !hasClassStarted;
            
            if (isAttendedByCurrentUser) {
                memberActionHTML = `<span class="bg-white/90 text-green-600 font-bold text-xs px-2 py-1 rounded-full shadow-sm">${_('status_completed')}</span>`;
            } else if (hasClassStarted) {
                memberActionHTML = `<span class="bg-white/90 text-slate-500 font-bold text-xs px-3 py-1 rounded-full shadow-sm">${_('status_no_show')}</span>`;
            } else if (isCancellationClosed) {
                const tooltipText = _('tooltip_cancellation_closed').replace('{hours}', cutoffHours);
                memberActionHTML = `<span class="bg-white/90 text-indigo-600 font-bold text-xs px-3 py-1 rounded-full shadow-sm opacity-80 cursor-not-allowed" title="${tooltipText}">${_('status_booked')}</span>`;
            } else {
                memberActionHTML = `<button class="cancel-booking-btn-toggle bg-white/90 text-indigo-600 font-bold text-xs px-3 py-1 rounded-full shadow-sm transition-all duration-200 hover:bg-red-600 hover:text-white" data-booked-text="${_('status_booked')}" data-cancel-text="${_('status_cancel_prompt')}">${_('status_booked')}</button>`;
            }
        } 
        else if (isTrulyBlocked) {
            memberActionHTML = `<span class="bg-white/90 text-slate-600 font-bold text-xs px-3 py-1 rounded-full shadow-sm">${_('status_not_available')}</span>`;
        } 
        else if (isFull) {
            memberActionHTML = `<span class="bg-white/90 text-red-600 font-bold text-xs px-3 py-1 rounded-full shadow-sm">${_('status_full')}</span>`;
        } else {
            memberActionHTML = `<span class="font-bold text-white drop-shadow-md">${creditText}</span>`;
        }
        
        const renderEditableInputs = isAdmin && hasWritePermission;

        const participantCounterHTML = isAdmin
            ? (renderEditableInputs && window.matchMedia('(any-pointer: fine)').matches
                ? createParticipantCounter(currentBookings, cls.maxParticipants, true)
                : (renderEditableInputs 
                    ? `<div class="participant-dial-trigger">${createParticipantCounter(currentBookings, cls.maxParticipants, false)}</div>`
                    : createParticipantCounter(currentBookings, cls.maxParticipants, false))
            )
            : createParticipantCounter(currentBookings, cls.maxParticipants, false);

        // --- PERFORMANCE UPDATE: Using .cls-time-slot instead of tailwind utility string ---
        el.innerHTML = `
            <div>
                <p class="font-bold text-lg leading-tight pr-6 drop-shadow-sm">${getSportTypeName(sportType)}</p>
                ${actionButton}
            </div>
            <div class="text-sm mt-1.5 flex justify-between items-center">
                <span class="flex items-center gap-1.5 drop-shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                    ${tutor?.name || _('unknown_tutor')}
                </span>
                ${participantCounterHTML}
            </div>
            <div class="mt-2 flex justify-between items-center">
                ${isAdmin
                    ? (renderEditableInputs && window.matchMedia('(any-pointer: fine)').matches
                        ? `<p class="cls-time-slot time-slot-editable">${getTimeRange(cls.time, cls.duration)}</p>`
                        : (renderEditableInputs
                            ? `<div class="relative inline-block">
                                   <p class="cls-time-slot">${getTimeRange(cls.time, cls.duration)}</p>
                                   <input type="time" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value="${cls.time}" />
                               </div>`
                            : `<p class="cls-time-slot">${getTimeRange(cls.time, cls.duration)}</p>`)
                    )
                    : `<p class="cls-time-slot">${getTimeRange(cls.time, cls.duration)}</p>`
                }
                <div class="member-action-container">
                    ${isAdmin 
                        ? (isFull 
                            ? `<span class="bg-white/90 text-red-600 font-bold text-xs px-3 py-1 rounded-full shadow-sm">${_('status_full')}</span>` 
                            : `<span class="font-bold text-white drop-shadow-md">${creditText}</span>`) 
                        : memberActionHTML
                    }
                </div>
            </div>`;

        // Interaction Logic: Delegated to global listener in init(), except for Wheel events
        
        if (isAdmin && hasWritePermission) {
            
            const timeSlotEl = el.querySelector('.time-slot-editable');
            if (timeSlotEl) {
                let localClsTime = cls.time;
                
                timeSlotEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.time-slot-editable.editing, .participant-counter-editable.editing').forEach(otherEl => {
                        if (otherEl !== timeSlotEl) otherEl.classList.remove('editing');
                    });
                    timeSlotEl.classList.toggle('editing');
                });

                let timeChangeDebounce;
                timeSlotEl.addEventListener('wheel', (e) => {
                    if (!timeSlotEl.classList.contains('editing')) return;
                    e.preventDefault();
                    
                    const [hours, minutes] = localClsTime.split(':').map(Number);
                    let totalMinutes = hours * 60 + minutes;
                    
                    if (e.deltaY < 0) totalMinutes -= 15; else totalMinutes += 15;
                    if (totalMinutes < 0) totalMinutes = 24 * 60 - 15; if (totalMinutes >= 24 * 60) totalMinutes = 0;

                    const newHours = Math.floor(totalMinutes / 60); const newMinutes = totalMinutes % 60;
                    localClsTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                    timeSlotEl.textContent = getTimeRange(localClsTime, cls.duration);

                    clearTimeout(timeChangeDebounce);
                    timeChangeDebounce = setTimeout(() => {
                        saveSchedulePosition();
                        const revertUICallback = () => { timeSlotEl.textContent = getTimeRange(cls.time, cls.duration); };
                        handleClsUpdateRequest(cls, { time: localClsTime }, revertUICallback);
                    }, 1500);
                });
            }

            const timeInput = el.querySelector('input[type="time"]');
            if (timeInput) {
                timeInput.addEventListener('click', (e) => e.stopPropagation());
                timeInput.addEventListener('change', () => {
                    let timeChangeDebounce;
                    clearTimeout(timeChangeDebounce);
                    timeChangeDebounce = setTimeout(() => {
                        saveSchedulePosition();
                        const revertUICallback = () => { timeInput.value = cls.time; };
                        handleClsUpdateRequest(cls, { time: timeInput.value }, revertUICallback);
                    }, 1500);
                });
            }

            const participantCounterEl = el.querySelector('.participant-counter-editable');
            if (participantCounterEl) {
                participantCounterEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.time-slot-editable.editing, .participant-counter-editable.editing').forEach(otherEl => { if (otherEl !== participantCounterEl) otherEl.classList.remove('editing'); });
                    participantCounterEl.classList.toggle('editing');
                });
                let maxPartChangeDebounce;
                participantCounterEl.addEventListener('wheel', (e) => {
                    if (!participantCounterEl.classList.contains('editing')) return;
                    e.preventDefault();
                    let localMaxParticipants = parseInt(participantCounterEl.textContent.split('/')[1]);
                    if (e.deltaY < 0) { localMaxParticipants++; } else { localMaxParticipants = Math.max(1, localMaxParticipants - 1); }
                    participantCounterEl.textContent = `${currentBookings}/${localMaxParticipants}`;
                    clearTimeout(maxPartChangeDebounce);
                    maxPartChangeDebounce = setTimeout(() => { saveSchedulePosition(); database.ref(`/classes/${cls.id}/maxParticipants`).set(localMaxParticipants); }, 1500);
                });
            }

            const participantDialTrigger = el.querySelector('.participant-dial-trigger');
            if (participantDialTrigger) {
                participantDialTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNumericDialModal(
                        _('title_set_max_participants'),
                        cls.maxParticipants,
                        1, 50,
                        (newMax) => {
                            saveSchedulePosition();
                            database.ref(`/classes/${cls.id}/maxParticipants`).set(newMax);
                        }
                    );
                });
            }

        } else if (isBookedByCurrentUser && !isAttendedByCurrentUser) {
            const cancelButton = el.querySelector('.cancel-booking-btn-toggle');
            if (cancelButton) {
                // Click handled by global listener
                cancelButton.onmouseenter = () => cancelButton.textContent = cancelButton.dataset.cancelText;
                cancelButton.onmouseleave = () => cancelButton.textContent = cancelButton.dataset.bookedText;
            }
        }
        
        return el;
    }

    function handlePublishToggle(date, isCurrentlyPublished) {
        // 1. Identify Context
        const branches = appState.branches || [];
        // Fallback to first branch if no specific selection (Legacy mode)
        const currentBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : 'legacy');
        // We assume the first branch created is the "Main/Legacy" one for migration purposes
        const mainBranchId = branches.length > 0 ? branches[0].id : 'legacy';

        const newStatus = !isCurrentlyPublished;

        const performUpdate = () => {
            // Use a transaction to safely migrate boolean -> object if necessary
            database.ref(`/scheduleStatus/${date}`).transaction((currentData) => {
                if (currentData === null) {
                    // No data exists yet, create object for this branch
                    return { [currentBranchId]: newStatus };
                } 
                else if (typeof currentData === 'boolean') {
                    // Legacy boolean exists. Convert to object.
                    // 1. Preserve legacy value for Main Branch
                    // 2. Set new value for Current Branch
                    const newData = {};
                    if (mainBranchId) newData[mainBranchId] = currentData;
                    newData[currentBranchId] = newStatus;
                    return newData;
                } 
                else {
                    // Already an object, just update/add key for this branch
                    // We must clone it to avoid mutating the local reference directly inside the transaction function
                    const newData = { ...currentData };
                    newData[currentBranchId] = newStatus;
                    return newData;
                }
            }).catch(error => {
                console.error("Failed to update schedule status:", error);
                showMessageBox("Error updating status. Please check console.", "error");
            });
        };

        // If we are un-publishing (Published -> Draft), show warning
        if (isCurrentlyPublished) {
            showConfirmation(
                _('confirm_unpublish_day_title'),
                _('confirm_unpublish_day_desc'),
                performUpdate 
            );
        } else {
            performUpdate();
        }
    }

    function _reSortDayColumn(dateIso) {
        const dayContainer = document.querySelector(`.classes-container[data-date="${dateIso}"]`);
        if (!dayContainer) return; // Do nothing if the day is not visible

        // 1. Get all classes for this specific day
        let dailyClasses = appState.classes.filter(c => c.date === dateIso);
        
        // --- START FIX: Apply Branch Filtering ---
        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;
        const selectedBranch = appState.selectedScheduleBranch;

        // If filtering is active, filter the daily classes before rendering
        if (hasMultipleBranches && selectedBranch) {
            dailyClasses = dailyClasses.filter(c => {
                const cBranch = c.branchId;
                if (cBranch) {
                    // Standard Match
                    return cBranch === selectedBranch;
                } else {
                    // Legacy Handling: If class has no branch, assume it belongs to the first branch
                    return branches[0].id === selectedBranch;
                }
            });
        }
        // --- END FIX ---

        // 2. Sort them by time
        dailyClasses.sort((a, b) => a.time.localeCompare(b.time));

        // 3. Clear only this day's container
        dayContainer.innerHTML = '';

        // 4. Re-append using DocumentFragment (Batched Render)
        const fragment = document.createDocumentFragment();
        dailyClasses.forEach(cls => {
            fragment.appendChild(createClsElement(cls));
        });
        dayContainer.appendChild(fragment);
    }

    function _renderScheduleCarousel(container, startDate, endDate, datesArray, initialScrollIndex, showAddButton, filteredClasses = null) {
        container.innerHTML = `
            <div class="relative">
                <div class="embla overflow-hidden card p-4 md:p-6">
                    <div class="embla__viewport"><div class="embla__container flex -mx-2"></div></div>
                </div>
                <button class="embla__button embla__button--prev absolute left-[-28px] top-0 h-full bg-white/80 backdrop-blur-sm text-slate-700 px-2 rounded-none shadow-lg border border-slate-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 z-10 hidden lg:block transition flex items-center" type="button"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
                <button class="embla__button embla__button--next absolute right-[-28px] top-0 h-full bg-white/80 backdrop-blur-sm text-slate-700 px-2 rounded-none shadow-lg border border-slate-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 z-10 hidden lg:block transition flex items-center" type="button"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button>
            </div>`;
        
        const emblaContainer = container.querySelector('.embla__container');
        emblaContainer.innerHTML = '';
        let content = '';

        const scheduleStatus = appState.scheduleStatus || {};
        const todayIso = getIsoDate(new Date());
        const headerDateFormatter = new Intl.DateTimeFormat(getLocale(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

        // --- Branch Context Resolution ---
        const branches = appState.branches || [];
        const currentBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : 'legacy');
        const mainBranchId = branches.length > 0 ? branches[0].id : 'legacy';

        datesArray.forEach(dateIso => {
            const date = new Date(dateIso + 'T12:00:00Z');
            const isToday = (dateIso === todayIso);
            const todayBadge = isToday ? `<span class="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">${_('label_today')}</span>` : '';
            const headerClasses = `day-header p-2 rounded-t-xl ${isToday ? 'bg-indigo-50' : 'hover:bg-slate-100'}`;

            // --- Independent Publish Status Logic ---
            let isPublished = false;
            const statusRaw = scheduleStatus[dateIso];

            if (typeof statusRaw === 'boolean') {
                if (currentBranchId === mainBranchId) {
                    isPublished = statusRaw;
                } else {
                    isPublished = false;
                }
            } else if (statusRaw && typeof statusRaw === 'object') {
                isPublished = statusRaw[currentBranchId] === true;
            }

            const statusClass = isPublished ? 'status-published' : 'status-draft';
            const statusTooltip = isPublished ? _('status_published') : _('status_draft');
            const draftClass = isPublished ? '' : 'is-draft';

            const publishToggleHTML = showAddButton ? `
                <div class="publish-toggle-container">
                    <div class="publish-toggle ${statusClass}" data-date="${dateIso}" title="${statusTooltip}">
                        <span class="publish-toggle-handle"></span>
                        <span class="publish-toggle-text"></span>
                    </div>
                </div>
            ` : '';

            // --- NEW: Check if the day has classes before showing Delete button ---
            // We use the filtered list to ensure we only check classes for the current branch
            const dayHasClasses = (filteredClasses || appState.classes).some(c => c.date === dateIso);

            const deleteButtonHTML = dayHasClasses ? `
                <button data-date="${dateIso}" class="delete-day-btn w-full flex items-center justify-center py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-dashed border-red-200 text-red-400 hover:text-red-600 text-xs transition-all" title="${_('btn_delete_day')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    ${_('btn_delete_day')}
                </button>` : '';

            const copyButtonsHTML = showAddButton ? `
                <div class="mt-2 space-y-2">
                    <div class="grid grid-cols-2 gap-2">
                        <button data-date="${dateIso}" class="copy-class-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">${_('btn_copy_class')}</button>
                        <button data-date="${dateIso}" class="copy-day-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">${_('btn_copy_day')}</button>
                    </div>
                    ${deleteButtonHTML}
                </div>
            ` : '';

            content += `
                <div class="embla__slide px-2">
                    <div class="day-column bg-slate-50/50 rounded-xl flex flex-col ${draftClass}">
                        <div class="${headerClasses} relative" data-date="${dateIso}">
                            ${publishToggleHTML}
                            <div class="flex items-center justify-center font-semibold text-slate-700">
                                <span>${headerDateFormatter.format(date)}</span>
                                ${todayBadge}
                            </div>
                        </div>
                        <div data-date="${dateIso}" class="classes-container px-1 py-1 flex-grow"></div>
                        <div class="add-controls-wrapper mt-auto p-2">
                            ${showAddButton ? `<button data-date="${dateIso}" class="add-cls-button w-full flex items-center justify-center py-3 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 transition-all"><svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>${_('btn_add_class')}</button>${copyButtonsHTML}` : ''}
                        </div>
                    </div>
                </div>`;
        });
        emblaContainer.innerHTML = content;

        const sourceClasses = filteredClasses || appState.classes;
        const classesByDate = sourceClasses.reduce((acc, cls) => { (acc[cls.date] = acc[cls.date] || []).push(cls); return acc; }, {});
        
        container.querySelectorAll('.classes-container').forEach(cont => {
            const date = cont.dataset.date;
            const dailyClasses = classesByDate[date] || [];
            
            cont.innerHTML = '';
            
            // Optimization: Build off-DOM to prevent layout thrashing
            const fragment = document.createDocumentFragment();
            dailyClasses.sort((a, b) => a.time.localeCompare(b.time)).forEach(cls => {
                fragment.appendChild(createClsElement(cls));
            });
            cont.appendChild(fragment);
        });

        const emblaNode = container.querySelector('.embla__viewport');
        emblaApi = EmblaCarousel(emblaNode, { loop: false, align: "start", dragFree: true, startIndex: initialScrollIndex });
        
        const prevBtn = container.querySelector(".embla__button--prev");
        const nextBtn = container.querySelector(".embla__button--next");
        
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager'; // Added Manager
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isManager || isStaff; // Included Manager in Admin check
        
        const scrollPrev = () => {
            if (isAdmin && !emblaApi.canScrollPrev()) {
                if (appState.ownerPastDaysVisible < 30) {
                    saveSchedulePosition();
                    appState.ownerPastDaysVisible += 7;
                    detachDataListeners();
                    initDataListeners();
                }
            } else {
                emblaApi.scrollPrev();
            }
        };

        const updateButtons = () => { 
            if(!emblaApi) return;
            const canScrollPrev = emblaApi.canScrollPrev();
            const canScrollNext = emblaApi.canScrollNext();
            
            prevBtn.disabled = !canScrollPrev && !(isAdmin && appState.ownerPastDaysVisible < 30);
            nextBtn.disabled = !canScrollNext;
        };
        
        emblaApi.on('select', updateButtons);
        emblaApi.on('reInit', updateButtons);
        emblaApi.on('select', saveSchedulePosition);
        
        prevBtn.onclick = scrollPrev;
        nextBtn.onclick = () => emblaApi.scrollNext();
        updateButtons();
        
        container.querySelectorAll('.copy-class-btn').forEach(btn => {
            btn.onclick = (e) => startCopy('class', e.currentTarget.dataset.date);
        });
        container.querySelectorAll('.copy-day-btn').forEach(btn => {
            btn.onclick = (e) => startCopy('day', e.currentTarget.dataset.date);
        });
        
        // Attach listener for the new delete button
        container.querySelectorAll('.delete-day-btn').forEach(btn => {
            btn.onclick = (e) => handleDeleteDay(e.currentTarget.dataset.date);
        });
    }

    function renderOwnerSchedule(container) {
        // 1. Prepare Branch Logic
        const branches = appState.branches || [];
        let branchSwitcherHTML = '';

        const user = appState.currentUser;
        const isOwner = user.role === 'owner';
        
        // --- REFACTORED: Use Helper ---
        const effectiveBranches = getEffectiveBranches(user, branches);

        // Initialize selection if needed (or if current selection is invalid for this user)
        if (effectiveBranches.length > 0) {
            const currentSel = appState.selectedScheduleBranch;
            const isCurrentValid = currentSel && effectiveBranches.some(b => b.id === currentSel);
            
            if (!isCurrentValid) {
                // Prioritize Home Branch if valid, otherwise first available
                const homeId = user.homeBranchId;
                if (homeId && effectiveBranches.some(b => b.id === homeId)) {
                    appState.selectedScheduleBranch = homeId;
                } else {
                    appState.selectedScheduleBranch = effectiveBranches[0].id;
                }
            }
        }

        // --- OPTIMIZATION TRIGGER ---
        if (appState.selectedScheduleBranch && appState.selectedScheduleBranch !== currentSubscribedBranchId) {
            setupClassSubscription(appState.selectedScheduleBranch);
            container.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            return;
        }

        // 2. Build Switcher UI using EFFECTIVE Branches
        const hasMultipleOptions = effectiveBranches.length > 1;

        if (hasMultipleOptions) {
            if (effectiveBranches.length <= 3) {
                const buttonsHtml = effectiveBranches.map(b => {
                    const isActive = b.id === appState.selectedScheduleBranch;
                    // --- REFACTORED: Use Helper ---
                    const bName = getBranchName(b);
                    const activeStyle = isActive ? `background-color: #ffffff; color: ${b.color || '#6366f1'}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` : '';
                    const baseClass = 'branch-switch-btn flex-1 py-1.5 px-3 text-sm font-bold rounded-md transition-all';
                    const stateClass = isActive ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50';

                    return `<button class="${baseClass} ${stateClass}" style="${activeStyle}" data-branch-id="${b.id}">${bName}</button>`;
                }).join('');
                
                branchSwitcherHTML = `
                    <div class="mb-4 flex justify-center">
                        <div class="bg-slate-100 p-1 rounded-lg inline-flex w-full max-w-md">
                            ${buttonsHtml}
                        </div>
                    </div>`;
            } else {
                const optionsHtml = effectiveBranches.map(b => {
                    // --- REFACTORED: Use Helper ---
                    const bName = getBranchName(b);
                    return `<option value="${b.id}" ${b.id === appState.selectedScheduleBranch ? 'selected' : ''}>${bName}</option>`;
                }).join('');
                branchSwitcherHTML = `
                    <div class="mb-4 flex justify-center items-center gap-2">
                        <label class="text-sm font-bold text-slate-600">${_('label_switching_branch')}</label>
                        <select id="scheduleBranchSelect" class="form-select w-auto py-1 pl-3 pr-8 text-sm font-semibold">
                            ${optionsHtml}
                        </select>
                    </div>`;
            }
        } else if (effectiveBranches.length === 1 && branches.length > 1) {
            // Case: Multi-branch studio, but Staff is restricted to exactly 1.
            const currentB = effectiveBranches[0];
            // --- REFACTORED: Use Helper ---
            const bName = getBranchName(currentB);
            const bColor = currentB.color || '#6366f1';
            const activeStyle = `background-color: #ffffff; color: ${bColor}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); cursor: default;`;
            const baseClass = 'flex-1 py-1.5 px-6 text-sm font-bold rounded-md transition-all text-center';

            branchSwitcherHTML = `
                <div class="mb-4 flex justify-center">
                    <div class="bg-slate-100 p-1 rounded-lg inline-flex">
                        <div class="${baseClass}" style="${activeStyle}">
                            ${bName}
                        </div>
                    </div>
                </div>`;
        }

        // 3. Inject Container Structure
        container.innerHTML = `
            <div id="schedule-branch-switcher">${branchSwitcherHTML}</div>
            <div id="owner-schedule-carousel"></div>
        `;

        // 4. Attach Event Listeners
        if (hasMultipleOptions) {
            if (effectiveBranches.length <= 3) {
                container.querySelectorAll('.branch-switch-btn').forEach(btn => {
                    btn.onclick = () => {
                        const newBranchId = btn.dataset.branchId;
                        if (appState.selectedScheduleBranch !== newBranchId) {
                            appState.selectedScheduleBranch = newBranchId;
                            renderOwnerSchedule(container); 
                        }
                    };
                });
            } else {
                const select = container.querySelector('#scheduleBranchSelect');
                if (select) {
                    select.onchange = () => {
                        appState.selectedScheduleBranch = select.value;
                        renderOwnerSchedule(container);
                    };
                }
            }
        }

        // 5. Render Carousel
        const carouselContainer = container.querySelector('#owner-schedule-carousel');
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        const daysToLookBack = appState.ownerPastDaysVisible;
        const ownerStartDate = new Date(today.getTime());
        ownerStartDate.setDate(today.getDate() - daysToLookBack);

        const ownerEndDate = new Date();
        ownerEndDate.setUTCHours(0,0,0,0);
        ownerEndDate.setUTCDate(today.getUTCDate() + 30); // Default view

        // --- FIX: Extend view if jumping to a future date ---
        if (appState.scrollToDateOnNextLoad) {
            const targetDate = new Date(appState.scrollToDateOnNextLoad);
            // If target is beyond default range, extend to Target + 7 days buffer
            if (targetDate > ownerEndDate) {
                ownerEndDate.setTime(targetDate.getTime());
                ownerEndDate.setUTCDate(ownerEndDate.getUTCDate() + 7);
            }
        }

        const filterDay = appState.selectedFilters.memberDay;
        const datesArray = [];
        for (let d = new Date(ownerStartDate); d <= ownerEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            if (filterDay !== 'all') {
                const currentDayIndex = d.getDay(); 
                if (String(currentDayIndex) !== filterDay) continue; 
            }
            datesArray.push(getIsoDate(d));
        }

        const filteredClasses = filterClassesByBranchContext(appState.classes, branches, effectiveBranches, appState.selectedScheduleBranch);

        const initialScrollIndex = getInitialScheduleIndex(datesArray, daysToLookBack);
        
        // --- ADD BUTTON VISIBILITY LOGIC ---
        let showAddButton = true;
        if (!isOwner) {
            const staffAccessLevel = user.staffAccessLevel || 'home_only';
            
            // Only apply restrictions if NOT 'global_write'
            if (staffAccessLevel !== 'global_write') {
                let writeAllowedIds = [];
                if (user.allowedBranches && Object.keys(user.allowedBranches).length > 0) {
                    writeAllowedIds = Object.keys(user.allowedBranches);
                } else {
                    writeAllowedIds = [user.homeBranchId || (branches.length > 0 ? branches[0].id : null)];
                }

                if (!writeAllowedIds.includes(appState.selectedScheduleBranch)) {
                    showAddButton = false;
                }
            }
        }

        _renderScheduleCarousel(carouselContainer, ownerStartDate, ownerEndDate, datesArray, initialScrollIndex, showAddButton, filteredClasses);
        updateCopyUI();
    }
    
    function renderMemberSchedulePage(container) {
        // 1. Prepare Branch Logic
        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;
        let branchSwitcherHTML = '';

        // Initialize selection if needed
        if (!appState.selectedScheduleBranch && branches.length > 0) {
            // Prefer user's home branch, fallback to first
            appState.selectedScheduleBranch = appState.currentUser.homeBranchId || branches[0].id;
        }

        // --- OPTIMIZATION TRIGGER (Added for Members) ---
        // If the selected branch differs from what we are currently listening to, switch it!
        if (appState.selectedScheduleBranch && appState.selectedScheduleBranch !== currentSubscribedBranchId) {
            setupClassSubscription(appState.selectedScheduleBranch);
            // Return early to let the new data load and trigger a re-render via the listener
            container.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            return;
        }
        // -----------------------------------------------

        // 2. Build Switcher UI
        if (hasMultipleBranches) {
            if (branches.length <= 3) {
                const buttonsHtml = branches.map(b => {
                    const isActive = b.id === appState.selectedScheduleBranch;
                    const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                    
                    // --- CHANGED: Dynamic Color Logic ---
                    // If active, use white bg + branch color text + shadow
                    // If inactive, use standard gray text
                    const activeStyle = isActive ? `background-color: #ffffff; color: ${b.color || '#6366f1'}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` : '';
                    const baseClass = 'branch-switch-btn flex-1 py-1.5 px-3 text-sm font-bold rounded-md transition-all';
                    const stateClass = isActive ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50';

                    return `<button class="${baseClass} ${stateClass}" style="${activeStyle}" data-branch-id="${b.id}">${bName}</button>`;
                }).join('');
                
                branchSwitcherHTML = `
                    <div class="mb-4 flex justify-center">
                        <div class="bg-slate-100 p-1 rounded-lg inline-flex w-full max-w-md">
                            ${buttonsHtml}
                        </div>
                    </div>`;
            } else {
                const optionsHtml = branches.map(b => {
                    const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                    return `<option value="${b.id}" ${b.id === appState.selectedScheduleBranch ? 'selected' : ''}>${bName}</option>`;
                }).join('');
                branchSwitcherHTML = `
                    <div class="mb-4 flex justify-center items-center gap-2">
                        <label class="text-sm font-bold text-slate-600">${_('label_switching_branch')}</label>
                        <select id="scheduleBranchSelect" class="form-select w-auto py-1 pl-3 pr-8 text-sm font-semibold">
                            ${optionsHtml}
                        </select>
                    </div>`;
            }
        }

        container.innerHTML = `
            <div id="schedule-branch-switcher">${branchSwitcherHTML}</div>
            <div id="member-schedule-carousel"></div>
        `;

        // 3. Attach Events
        if (hasMultipleBranches) {
            if (branches.length <= 3) {
                container.querySelectorAll('.branch-switch-btn').forEach(btn => {
                    btn.onclick = () => {
                        const newBranchId = btn.dataset.branchId;
                        if (appState.selectedScheduleBranch !== newBranchId) {
                            appState.selectedScheduleBranch = newBranchId;
                            renderMemberSchedulePage(container); // Re-render triggers optimization
                        }
                    };
                });
            } else {
                const select = container.querySelector('#scheduleBranchSelect');
                if (select) {
                    select.onchange = () => {
                        appState.selectedScheduleBranch = select.value;
                        renderMemberSchedulePage(container); // Re-render triggers optimization
                    };
                }
            }
        }

        // 4. Render Carousel
        const carouselContainer = container.querySelector('#member-schedule-carousel');
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        const memberStartDate = new Date(today.getTime());
        memberStartDate.setDate(today.getDate() - MEMBER_PAST_DAYS); 

        let memberEndDate = new Date(today.getTime());

        // Note: Members effectively have "Global" access permissions in this context, 
        // so we pass 'branches' as the 3rd argument to skip the permission check and only apply the UI filter.
        const filteredClasses = filterClassesByBranchContext(appState.classes, branches, branches, appState.selectedScheduleBranch);

        // Calculate End Date based on available classes
        const futureClasses = filteredClasses.filter(c => new Date(c.date) >= memberStartDate);
        if (futureClasses.length > 0) {
            const latestClsDate = new Date(Math.max(...futureClasses.map(c => new Date(c.date).getTime())));
            if (latestClsDate > memberEndDate) {
                memberEndDate = latestClsDate;
            }
        }
        
        const filterDay = appState.selectedFilters.memberDay; 
        const datesArray = [];
        for (let d = new Date(memberStartDate); d <= memberEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            if (filterDay !== 'all') {
                const currentDayIndex = d.getDay(); 
                if (String(currentDayIndex) !== filterDay) continue; 
            }
            datesArray.push(getIsoDate(d));
        }

        let initialScrollIndex = 0;
        if (datesArray.length > 0) {
             initialScrollIndex = getInitialScheduleIndex(datesArray, 0);
        }

        if (datesArray.length === 0) {
            carouselContainer.innerHTML = `<div class="text-center p-8 text-slate-500">${_('info_no_classes_match_filters')}</div>`;
        } else {
            _renderScheduleCarousel(carouselContainer, memberStartDate, memberEndDate, datesArray, initialScrollIndex, false, filteredClasses);
        }
    }

    function openFilterModal() {
        const { memberSportType, memberTutor, memberDay } = appState.selectedFilters;
        const isFilterActive = memberSportType !== 'all' || memberTutor !== 'all' || memberDay !== 'all';
        const isAdmin = appState.currentUser?.role === 'owner' || appState.currentUser?.role === 'staff';

        // --- NEW LOGIC: Define 'availableClasses' based on role ---
        let availableClasses = [];
        if (isAdmin) {
            // Admins see whatever is currently loaded in appState (visible date range)
            availableClasses = appState.classes;
        } else {
            // Members only see future classes for filtering purposes
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const memberStartDate = new Date(today.getTime());
            availableClasses = appState.classes.filter(c => new Date(c.date) >= memberStartDate);
        }
        // ----------------------------------------------------------

        let dayOptionsHTML = `<option value="all">${_('filter_all_time')}</option>`;
        const dateFormatter = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' });
        const refDate = new Date('2023-01-01T12:00:00Z'); 
        for (let i = 0; i < 7; i++) {
            const dayName = dateFormatter.format(refDate);
            dayOptionsHTML += `<option value="${i}">${dayName}</option>`;
            refDate.setUTCDate(refDate.getUTCDate() + 1);
        }

        DOMElements.filterModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-6 text-center">${_('title_filter_schedule')}</h2>
                <form id="filterForm" class="space-y-4">
                    <div>
                        <label for="modalDayFilter" class="block text-slate-600 text-sm font-semibold mb-2">${_('table_header_datetime')}</label>
                        <select id="modalDayFilter" class="form-select w-full">
                            ${dayOptionsHTML}
                        </select>
                    </div>
                    <div>
                        <label for="modalSportTypeFilter" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_sport_type')}</label>
                        <select id="modalSportTypeFilter" class="form-select w-full"></select>
                    </div>
                    <div>
                        <label for="modalTutorFilter" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_tutor')}</label>
                        <select id="modalTutorFilter" class="form-select w-full"></select>
                    </div>
                    <div class="pt-4 space-y-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition">${_('btn_apply_filters')}</button>
                        <button type="button" id="modalClearFiltersBtn" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg transition ${!isFilterActive ? 'hidden' : ''}">${_('btn_clear_filters')}</button>
                    </div>
                </form>
            </div>
        `;

        const modal = DOMElements.filterModal;
        const form = modal.querySelector('#filterForm');
        const dayFilter = modal.querySelector('#modalDayFilter');
        const sportTypeFilter = modal.querySelector('#modalSportTypeFilter');
        const tutorFilter = modal.querySelector('#modalTutorFilter');
        const clearBtn = modal.querySelector('#modalClearFiltersBtn');

        dayFilter.value = memberDay;

        const updateFilterDependencies = () => {
            const selectedDay = dayFilter.value;
            const selectedSport = sportTypeFilter.value;
            const selectedTutor = tutorFilter.value;

            const dayFilteredClasses = availableClasses.filter(c => {
                if (selectedDay === 'all') return true;
                const dayIndex = new Date(c.date + 'T12:00:00Z').getUTCDay();
                return String(dayIndex) === selectedDay;
            });

            const relevantSportTypeIds = new Set(dayFilteredClasses.map(c => c.sportTypeId));
            const availableSportTypes = appState.sportTypes.filter(st => relevantSportTypeIds.has(st.id));
            
            const relevantTutorIds = new Set(dayFilteredClasses.map(c => c.tutorId));
            const availableTutors = appState.tutors.filter(t => relevantTutorIds.has(t.id));

            populateSportTypeFilter(sportTypeFilter, availableSportTypes);
            
            if (selectedSport !== 'all' && relevantSportTypeIds.has(selectedSport)) {
                sportTypeFilter.value = selectedSport;
            } else {
                sportTypeFilter.value = 'all';
            }

            populateTutorFilter(tutorFilter, sportTypeFilter.value, availableTutors);

            let isTutorValid = false;
            for (let i = 0; i < tutorFilter.options.length; i++) {
                if (tutorFilter.options[i].value === selectedTutor) {
                    isTutorValid = true;
                    break;
                }
            }
            if (isTutorValid) {
                tutorFilter.value = selectedTutor;
            } else {
                tutorFilter.value = 'all';
            }
        };

        updateFilterDependencies();

        dayFilter.onchange = updateFilterDependencies;
        sportTypeFilter.onchange = updateFilterDependencies; 

        form.onsubmit = (e) => {
            e.preventDefault();
            appState.selectedFilters.memberDay = dayFilter.value;
            appState.selectedFilters.memberSportType = sportTypeFilter.value;
            appState.selectedFilters.memberTutor = tutorFilter.value;
            closeModal(modal);
            updateUIVisibility();
        };
        
        clearBtn.onclick = () => {
            appState.selectedFilters.memberSportType = 'all';
            appState.selectedFilters.memberTutor = 'all';
            appState.selectedFilters.memberDay = 'all';
            closeModal(modal);
            updateUIVisibility();
        };

        openModal(modal);
    }

    function openGoToDateModal() {
        DOMElements.goToDateModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-xs transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-6 text-center">${_('title_goto_date')}</h2>
                <form id="goToDateForm" class="space-y-2">
                    <div>
                        <label for="goToDatePicker" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_select_date')}</label>
                        <input type="date" id="goToDatePicker" class="form-input w-full" value="${getIsoDate(new Date())}">
                    </div>
                    <div class="pt-2 space-y-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition">${_('btn_go')}</button>
                        
                        <!-- START: New Button Added -->
                        <button type="button" id="jumpToTodayBtn" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg transition">${_('btn_jump_to_today')}</button>
                        <!-- END: New Button Added -->

                    </div>
                </form>
            </div>
        `;

        const modal = DOMElements.goToDateModal;
        const form = modal.querySelector('#goToDateForm');
        const jumpToTodayBtn = modal.querySelector('#jumpToTodayBtn'); // Get the new button

        // Logic for the original "Go" button
        form.onsubmit = (e) => {
            e.preventDefault();
            const targetDateIso = form.querySelector('#goToDatePicker').value;

            if (!targetDateIso) {
                showMessageBox(_('error_invalid_date_selected'), 'error');
                return;
            }

            appState.scrollToDateOnNextLoad = targetDateIso;

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const targetDate = new Date(targetDateIso);
            const daysAgo = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));

            if (daysAgo > appState.ownerPastDaysVisible) {
                appState.ownerPastDaysVisible = daysAgo + 7;
                detachDataListeners();
                initDataListeners();
            }
            
            switchPage('schedule');
            closeModal(DOMElements.goToDateModal);
        };

        // --- START: New Logic for the "Jump to Today" button ---
        jumpToTodayBtn.onclick = () => {
            const todayIso = getIsoDate(new Date());
            
            // Set the scroll target for the next schedule render
            appState.scrollToDateOnNextLoad = todayIso;
            
            // Switch to the schedule page (if not already there)
            switchPage('schedule');
            
            // Close the modal
            closeModal(DOMElements.goToDateModal);
        };
        // --- END: New Logic for the "Jump to Today" button ---

        openModal(DOMElements.goToDateModal);
    }

    function startCopy(type, targetDate) {
        if (appState.copyMode.active) {
            cancelCopy();
            return;
        }
        appState.copyMode.active = true;
        appState.copyMode.type = type;
        appState.copyMode.targetDate = targetDate;
        
        // --- NEW: Capture the Target Branch ID ---
        // We capture the branch ID of the schedule where the user clicked "Copy".
        // This ensures that even if they switch branches to find a source, 
        // we remember where they wanted to paste it.
        const branches = appState.branches || [];
        appState.copyMode.targetBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : null);
        // ----------------------------------------

        DOMElements.cancelCopyBtn.classList.remove('hidden');
        updateCopyUI();
    }

    function cancelCopy() {
        appState.copyMode.active = false;
        appState.copyMode.type = null;
        appState.copyMode.sourceId = null;
        appState.copyMode.targetDate = null;
        appState.copyMode.targetBranchId = null; // Clean up
        
        DOMElements.cancelCopyBtn.classList.add('hidden');
        updateCopyUI();
    }

    function performCopy(type, sourceData, targetDate) {
        // 1. Save the current visual position immediately.
        // This sets appState.scheduleScrollDate, which renderOwnerSchedule uses to restore the view.
        saveSchedulePosition();

        const targetBranchId = appState.copyMode.targetBranchId;

        // --- Helper: Redirect & Scroll Logic ---
        const finalizeCopy = () => {
            // Check if we need to switch branches (Cross-branch copy)
            if (appState.selectedScheduleBranch !== targetBranchId) {
                appState.selectedScheduleBranch = targetBranchId;

                // Case A: Different Branch.
                // We MUST jump to the Target Date because the Source Date might not exist
                // or be relevant in the target branch's view.
                appState.scrollToDateOnNextLoad = targetDate; 

                const pageContainer = document.getElementById('page-schedule');
                if (pageContainer) {
                    // Slight delay allows Firebase updates to sync locally
                    setTimeout(() => {
                        renderOwnerSchedule(pageContainer);
                        showMessageBox(_('info_redirected_to_target'), 'info'); 
                    }, 300);
                }
            } else {
                // Case B: Same Branch (The Fix)
                // We do NOT set appState.scrollToDateOnNextLoad.
                // By leaving it null, the render engine will automatically use the 
                // 'scheduleScrollDate' we saved at the top of this function.
                // This ensures the view stays exactly on the column you are working on.
                
                if(appState.activePage === 'schedule') {
                     renderOwnerSchedule(document.getElementById('page-schedule'));
                }
            }
            cancelCopy();
        };

        if (type === 'day') {
            const sourceDate = sourceData;
            const classesToCopy = appState.classes.filter(c => c.date === sourceDate);
            
            if (classesToCopy.length === 0) {
                showMessageBox(_('error_copy_source_day_empty'), 'error');
                cancelCopy();
                return;
            } else {
                const copyPromises = classesToCopy.map(cls => {
                    const { id, bookedBy, attendedBy, payoutDetails, ...restOfCls } = cls;
                    
                    const newCls = {
                        ...restOfCls, 
                        date: targetDate,
                        bookedBy: {},
                        attendedBy: {},
                        branchId: targetBranchId 
                    };

                    const tutor = appState.tutors.find(t => t.id === newCls.tutorId);
                    if (tutor) {
                        const skill = tutor.skills.find(s => s.sportTypeId === newCls.sportTypeId);
                        if (skill) {
                            newCls.payoutDetails = {
                                salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                                salaryValue: tutor.isEmployee ? 0 : skill.salaryValue,
                                // --- FIX: Add this line ---
                                salaryFormulaId: (tutor.isEmployee ? null : skill.salaryFormulaId) || null
                            };
                        }
                    }

                    return database.ref('/classes').push(newCls);
                });
                Promise.all(copyPromises).then(() => {
                    finalizeCopy();
                    showMessageBox(_('success_day_copied').replace('{count}', classesToCopy.length).replace('{sourceDate}', formatDateWithWeekday(sourceDate)).replace('{targetDate}', formatDateWithWeekday(targetDate)), 'success');
                });
            }
        } else if (type === 'class') {
            const { id, bookedBy, attendedBy, payoutDetails, ...restOfCls } = sourceData;
            const newCls = {
                ...restOfCls, 
                date: targetDate,
                bookedBy: {},
                attendedBy: {},
                branchId: targetBranchId
            };

            const tutor = appState.tutors.find(t => t.id === newCls.tutorId);
            if (tutor) {
                const skill = tutor.skills.find(s => s.sportTypeId === newCls.sportTypeId);
                if (skill) {
                    newCls.payoutDetails = {
                        salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                        salaryValue: tutor.isEmployee ? 0 : skill.salaryValue,
                        // --- FIX: Add this line ---
                        salaryFormulaId: (tutor.isEmployee ? null : skill.salaryFormulaId) || null
                    };
                }
            }

            database.ref('/classes').push(newCls).then(() => {
                finalizeCopy();
                const sportTypeName = appState.sportTypes.find(st => st.id === newCls.sportTypeId).name;
                showMessageBox(_('success_class_copied').replace('{name}', sportTypeName).replace('{date}', formatDateWithWeekday(targetDate)), 'success');
            });
        }
    }

    function updateCopyUI() {
        const schedulePage = document.getElementById('page-schedule');
        if (!schedulePage) return;

        const { active, type, targetDate, targetBranchId } = appState.copyMode;

        // 1. CLEANUP: Remove visual cues from ALL elements immediately
        schedulePage.querySelectorAll('.copy-mode-source, .copy-mode-source-class, .copy-mode-paste-zone').forEach(el => {
            el.classList.remove('copy-mode-source', 'copy-mode-source-class', 'copy-mode-paste-zone');
            el.style.cursor = '';
        });

        if (!active) return;

        // Determine context to identify if we are looking at the Target Branch
        const branches = appState.branches || [];
        const currentViewBranchId = appState.selectedScheduleBranch || (branches[0] ? branches[0].id : null);
        const isViewingTargetBranch = currentViewBranchId === targetBranchId;

        // 2. APPLY: Add visual cues (Excluding the Target Day itself)
        if (type === 'day') {
            showMessageBox(_('info_copy_day_prompt'), 'info');
            schedulePage.querySelectorAll('.day-header').forEach(headerEl => {
                const headerDate = headerEl.dataset.date;
                
                // CRITICAL FIX: Do not highlight the Target Date as a source candidate
                if (isViewingTargetBranch && headerDate === targetDate) {
                    return; 
                }

                headerEl.classList.add('copy-mode-source');
                headerEl.style.cursor = 'copy';
            });
        } else if (type === 'class') {
            showMessageBox(_('info_copy_class_prompt'), 'info');
            schedulePage.querySelectorAll('.cls-block').forEach(clsEl => {
                const cls = appState.classes.find(c => c.id === clsEl.id);
                if (cls) {
                    // CRITICAL FIX: Do not highlight classes on the Target Date as source candidates
                    // (Prevents self-duplication confusion during visual selection)
                    if (isViewingTargetBranch && cls.date === targetDate) {
                        return;
                    }
                    
                    clsEl.classList.add('copy-mode-source-class');
                    clsEl.style.cursor = 'copy';
                }
            });
        }

        // 3. HIGHLIGHT TARGET: Show where we are pasting TO (The Paste Zone)
        if (isViewingTargetBranch) {
             const targetDayEl = schedulePage.querySelector(`.day-column .classes-container[data-date="${targetDate}"]`)?.closest('.day-column');
             if (targetDayEl) {
                 targetDayEl.classList.add('copy-mode-paste-zone');
             }
        }
    }

    function renderCheckInPage(container) {
        const member = appState.currentUser;
        if (!member) {
            container.innerHTML = '<p>Loading details...</p>';
            return;
        }

        // Clean up previous state
        if (window.memberScanner) {
            window.memberScanner.stop().then(() => window.memberScanner.clear()).catch(err => console.error(err));
            window.memberScanner = null;
        }
        Object.values(memberCheckInListeners).forEach(({ ref, listener }) => ref.off('value', listener));
        memberCheckInListeners = {};

        // --- Layout Shell with Tabs ---
        container.innerHTML = `
            <div class="w-full max-w-sm mx-auto">
                <div class="card p-6">
                    <div class="flex border-b border-slate-200 mb-4">
                        <button id="tabScanStudio" class="flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors">
                            ${_('tab_scan_studio')}
                        </button>
                        <button id="tabMyCode" class="flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors">
                            ${_('tab_my_code')}
                        </button>
                    </div>
                    
                    <!-- Content Area -->
                    <div id="checkInTabContent" class="text-center min-h-[300px]"></div>
                </div>
            </div>`;

        const contentArea = container.querySelector('#checkInTabContent');
        const tabMyCode = container.querySelector('#tabMyCode');
        const tabScanStudio = container.querySelector('#tabScanStudio');

        // --- HELPER: Render Upcoming List (Shared between tabs) ---
        const renderUpcomingList = (targetContainerId) => {
            const upcomingSection = contentArea.querySelector(`#${targetContainerId}`);
            if (!upcomingSection) return;

            const today = getIsoDate(new Date());
            const todaysUnattendedBookings = appState.classes.filter(cls =>
                cls.date === today &&
                cls.bookedBy && cls.bookedBy[member.id] &&
                !(cls.attendedBy && cls.attendedBy[member.id])
            );

            // Bind Firebase Listeners for Auto-Success (Background Logic)
            if (Object.keys(memberCheckInListeners).length === 0) {
                let checkInDebounceTimer = null;
                const newlyCheckedInIds = new Set();
                
                const processCheckIns = () => {
                    const resultContainer = document.getElementById('qrCodeResultContainer') || document.getElementById('memberScanResult');
                    if (!resultContainer || newlyCheckedInIds.size === 0) return;
                    
                    playSuccessSound();
                    if (navigator.vibrate) navigator.vibrate(200);
                    
                    if (window.memberScanner && window.memberScanner.isScanning) {
                        window.memberScanner.pause();
                    }

                    const message = _('success_check_in_complete');
                    resultContainer.innerHTML = `<div class="check-in-result-banner check-in-success">${message}</div>`;
                    
                    newlyCheckedInIds.forEach(id => document.querySelectorAll(`[data-checkin-cls-id="${id}"]`).forEach(el => el.remove()));
                    
                    database.ref(`/users/${member.id}/selectedCheckInClassId`).set(null);
                    
                    setTimeout(() => { 
                        if (resultContainer) resultContainer.innerHTML = ''; 
                        if (window.memberScanner && window.memberScanner.getState() === 2) { 
                            window.memberScanner.resume();
                        }
                    }, 3000);
                    
                    newlyCheckedInIds.clear();
                };

                todaysUnattendedBookings.forEach(cls => {
                    const checkInRef = database.ref(`/classes/${cls.id}/attendedBy/${member.id}`);
                    const listener = (snapshot) => {
                        if (snapshot.val() === true) {
                            checkInRef.off('value', listener);
                            delete memberCheckInListeners[cls.id];
                            newlyCheckedInIds.add(cls.id);
                            clearTimeout(checkInDebounceTimer);
                            checkInDebounceTimer = setTimeout(processCheckIns, 150);
                        }
                    };
                    memberCheckInListeners[cls.id] = { ref: checkInRef, listener: listener };
                    checkInRef.on('value', listener);
                });
            }

            // Render HTML List
            if (todaysUnattendedBookings.length > 0) {
                // 1. Determine which message to show based on the tab
                const preSelectMsg = todaysUnattendedBookings.length > 1 
                    ? `<p class="text-center text-sm text-orange-600 font-bold mb-3 px-2">${_(targetContainerId === 'upcomingCheckInSectionScan' ? 'check_in_preselect_prompt_scan' : 'check_in_preselect_prompt')}</p>` 
                    : '';

                // 2. Build HTML: Header -> Message -> List
                upcomingSection.innerHTML = 
                    `<h5 class="text-center font-semibold text-slate-600 mb-2 pt-3 border-t border-slate-100">${_('header_upcoming_checkins')}</h5>` +
                    preSelectMsg +
                    todaysUnattendedBookings.sort((a,b) => a.time.localeCompare(b.time)).map(cls => {
                        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                        const isSelected = member.selectedCheckInClassId === cls.id;
                        const branches = appState.branches || [];
                        const clsBranchId = cls.branchId || (branches.length > 0 ? branches[0].id : null);
                        const clsBranch = branches.find(b => b.id === clsBranchId);
                        
                        let branchName = '';
                        let branchColor = '#64748b';
                        if (branches.length > 1 && clsBranch) {
                            branchName = (appState.currentLanguage === 'zh-TW' && clsBranch.name_zh) ? clsBranch.name_zh : clsBranch.name;
                            branchColor = clsBranch.color || '#64748b';
                        }
                        
                        const branchBadge = branchName ? `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border align-middle" style="background-color: ${branchColor}15; color: ${branchColor}; border-color: ${branchColor}30;">${_('info_class_branch')}: ${branchName}</span>` : '';
    
                        const baseClass = "w-full p-3 rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center border";
                        const selectedClass = isSelected 
                            ? "ring-2 ring-indigo-600 bg-white border-indigo-600 shadow-md transform scale-[1.02]" 
                            : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-300 hover:shadow-sm";
    
                        return `
                        <button class="${baseClass} ${selectedClass} class-selection-btn" data-checkin-cls-id="${cls.id}">
                            <div class="text-lg font-bold text-slate-800 leading-tight mb-0.5">${getSportTypeName(sportType)}</div>
                            <div class="text-sm font-medium text-slate-500">
                                ${branchBadge}
                                <span class="align-middle ml-1">${_('label_at_time')} ${getTimeRange(cls.time, cls.duration)}</span>
                            </div>
                        </button>`;
                    }).join('');
                
                // Bind Click Event
                upcomingSection.addEventListener('click', (e) => {
                    const clickedButton = e.target.closest('button[data-checkin-cls-id]');
                    if (!clickedButton) return;
                    
                    const clsId = clickedButton.dataset.checkinClsId;
                    const newSelectionId = (appState.currentUser.selectedCheckInClassId === clsId) ? null : clsId;
                    appState.currentUser.selectedCheckInClassId = newSelectionId;
                    
                    // Update UI classes manually
                    upcomingSection.querySelectorAll('.class-selection-btn').forEach(btn => {
                        const isBtnSelected = btn.dataset.checkinClsId === newSelectionId;
                        if (isBtnSelected) {
                            btn.className = "w-full p-4 rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ring-2 ring-indigo-600 bg-white border-indigo-600 shadow-md transform scale-[1.02] class-selection-btn";
                        } else {
                            btn.className = "w-full p-4 rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border bg-slate-50 border-transparent hover:bg-white hover:border-slate-300 hover:shadow-sm class-selection-btn";
                        }
                    });

                    // Save to DB
                    database.ref(`/users/${member.id}/selectedCheckInClassId`).set(newSelectionId);

                    // Clear error and Resume Scanner
                    const resultContainer = document.getElementById('memberScanResult');
                    if (resultContainer) resultContainer.innerHTML = '';
                    
                    if (window.memberScanner) {
                        try {
                            window.memberScanner.resume();
                        } catch (err) {
                            // Scanner likely wasn't paused, ignore.
                        }
                    }
                });
            } else {
                upcomingSection.innerHTML = `<p class="text-center text-slate-500 mt-4 pt-4 border-t border-slate-100">${_('info_no_booked_class_today')}</p>`;
            }
        };

        // --- SUB-FUNCTION: Render "My Code" ---
        const renderMyCodeTab = () => {
            tabMyCode.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabScanStudio.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";
            
            // --- FIX START: Safe Cleanup Logic ---
            if (window.memberScanner) {
                // Check isScanning state to prevent freeze on desktop
                const stopPromise = (window.memberScanner.isScanning) 
                    ? window.memberScanner.stop() 
                    : Promise.resolve();

                stopPromise
                    .catch(err => console.warn("Scanner stop warning:", err))
                    .finally(() => {
                        try { window.memberScanner.clear(); } catch(e){}
                        window.memberScanner = null;
                    });
            }
            // --- FIX END ---

            contentArea.innerHTML = `
                <h4 class="text-xl font-bold text-slate-800 mb-4">${_('title_qr_code')}</h4>
                <div id="qrCodeContainer" class="w-48 h-48 mx-auto"></div>
                <div id="qrCodeResultContainer" class="mt-4"></div>
                <div id="upcomingCheckInSection" class="mt-4 space-y-2"></div>
            `;
            // ... rest of the function remains the same ...
            new QRCode(contentArea.querySelector('#qrCodeContainer'), {
                text: member.id,
                width: 192,
                height: 192,
                colorDark: "#1e293b",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            renderUpcomingList('upcomingCheckInSection');
        };

        // --- SUB-FUNCTION: Render "Scan Studio" ---
        const renderScanStudioTab = () => {
            tabScanStudio.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabMyCode.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";
            
            contentArea.innerHTML = `
                <div class="relative w-full max-w-[280px] mx-auto">
                    <div id="member-qr-reader" class="w-full aspect-square bg-slate-900 rounded-lg overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover"></div>
                </div>

                <div id="memberScanResult" class="mt-2 min-h-[1.5rem]"></div>
                
                <div id="upcomingCheckInSectionScan" class="space-y-2"></div>
            `;

            // --- FIX START: Safe Cleanup Logic ---
            if (window.memberScanner) {
                // Only attempt to stop if it is currently scanning to prevent freezing
                const stopPromise = (window.memberScanner.isScanning) 
                    ? window.memberScanner.stop() 
                    : Promise.resolve();

                stopPromise
                    .catch(err => console.warn("Scanner stop warning:", err))
                    .finally(() => {
                        try { window.memberScanner.clear(); } catch(e){}
                        window.memberScanner = null;
                        startMemberCamera(); // Restart after safe cleanup
                    });
            } else {
                startMemberCamera();
            }
            // --- FIX END ---

            function startMemberCamera() {
                window.memberScanner = new Html5Qrcode("member-qr-reader");
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };
                
                window.memberScanner.start({ facingMode: "environment" }, config, (decodedText) => {
                    if (window.memberScanner && window.memberScanner.isScanning) {
                        window.memberScanner.pause();
                        handleMemberScanningStudio(decodedText, () => {
                            setTimeout(() => {
                                if (window.memberScanner && window.memberScanner.getState() === 2) { 
                                    window.memberScanner.resume();
                                }
                            }, 2000);
                        });
                    }
                }).catch(err => {
                    console.error("Camera error", err);
                    const resultDiv = contentArea.querySelector('#memberScanResult');
                    if(resultDiv) resultDiv.innerHTML = `<p class="text-red-500 text-sm">${_('check_in_error_camera_start_failed')}</p>`;
                    
                    // --- FIX: Nullify scanner on failure so other tabs don't try to stop it ---
                    try { window.memberScanner.clear(); } catch(e){}
                    window.memberScanner = null; 
                });
            }

            renderUpcomingList('upcomingCheckInSectionScan');
        };

        // Event Listeners
        tabMyCode.onclick = renderMyCodeTab;
        tabScanStudio.onclick = renderScanStudioTab;

        // Initialize Default Tab (Scan Studio)
        renderScanStudioTab();
    }

    async function renderAccountPage(container) {
        const member = appState.currentUser;
        if (!member) {
            container.innerHTML = '<p>Loading account details...</p>';
            return;
        };
        
        // Display Loading State immediately
        container.innerHTML = `<div class="card p-6 text-center"><p class="text-slate-500">${_('status_loading')}...</p></div>`;

        if (!appState.pagination.accountBookings) appState.pagination.accountBookings = { page: 1 };
        
        Object.values(memberCheckInListeners).forEach(({ ref, listener }) => ref.off('value', listener));
        memberCheckInListeners = {};
        
        // --- 1. Prepare Base Data (Fetch Complete History) ---
        let memberBookings = [];
        try {
            const bookingsSnapshot = await database.ref(`/memberBookings/${member.id}`).once('value');
            const bookingIdsObj = bookingsSnapshot.val() || {};
            const bookingIds = Object.keys(bookingIdsObj);

            if (bookingIds.length > 0) {
                const promises = bookingIds.map(async (clsId) => {
                    const cachedCls = appState.classes.find(c => c.id === clsId);
                    if (cachedCls) return cachedCls;
                    const snap = await database.ref(`/classes/${clsId}`).once('value');
                    return { id: snap.key, ...snap.val() };
                });

                const results = await Promise.all(promises);
                // FIX: Sort by Date Descending, then Time Descending (b.time vs a.time)
                memberBookings = results.filter(c => c && c.date).sort((a, b) => {
                    const dateComparison = b.date.localeCompare(a.date);
                    if (dateComparison !== 0) return dateComparison;
                    return b.time.localeCompare(a.time); // Changed from a.time.localeCompare(b.time)
                });
            }
        } catch (error) {
            console.error("Error loading complete history:", error);
            // Fallback: Local state sorting
            memberBookings = appState.classes
                .filter(c => c.bookedBy && c.bookedBy[member.id])
                .sort((a, b) => {
                    const dateComparison = b.date.localeCompare(a.date);
                    if (dateComparison !== 0) return dateComparison;
                    return b.time.localeCompare(a.time); // Changed here as well
                });
        }

        // 2. Prepare History Data
        const purchaseList = firebaseObjectToArray(member.purchaseHistory)
            .filter(p => p.status !== 'deleted')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const paymentList = firebaseObjectToArray(member.paymentHistory)
            .filter(p => p.status !== 'deleted')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const purchaseCount = purchaseList.length;
        const paymentCount = paymentList.length;

        // 3. Init State & Constants
        const branches = appState.branches || [];
        const defaultBranchId = branches.length > 0 ? branches[0].id : 'legacy';

        // Filter State
        let selectedCreditFilter = 'all';
        let selectedBranchFilter = 'all';

        // 4. Render Bookings List
        const renderBookingList = () => {
            const listContainer = container.querySelector('#accountBookingList');
            const paginationContainer = container.querySelector('#accountBookingPagination');
            if (!listContainer) return;

            // --- FILTER LOGIC ---
            const filteredBookings = memberBookings.filter(cls => {
                const booking = cls.bookedBy[member.id];
                if (!booking) return false;

                // 1. Branch Check (Primary)
                const branchId = cls.branchId || defaultBranchId;
                const branchMatch = (selectedBranchFilter === 'all') || (branchId === selectedBranchFilter);

                // 2. Credit Type Check (Secondary)
                const typeId = booking.creditTypeId || cls.costCreditTypeId || 'general';
                const creditMatch = (selectedCreditFilter === 'all') || (typeId === selectedCreditFilter);

                return branchMatch && creditMatch;
            });

            const countEl = container.querySelector('#accountBookingCount');
            if (countEl) countEl.textContent = `(${filteredBookings.length})`;

            if (filteredBookings.length === 0) {
                listContainer.innerHTML = `<p class="text-slate-500 text-center py-4">${_('no_booking_history')}</p>`;
                paginationContainer.innerHTML = '';
                return;
            }

            const itemsPerPage = 10;
            const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
            let page = appState.pagination.accountBookings.page;
            if (page > totalPages) page = totalPages;
            const paginatedBookings = filteredBookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);

            listContainer.innerHTML = paginatedBookings.map(cls => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                const isAttended = cls.attendedBy && cls.attendedBy[member.id];
                const isHighlighted = cls.id === appState.highlightBookingId;
                const bookingDetails = cls.bookedBy[member.id];
                const creditsUsed = bookingDetails ? bookingDetails.creditsPaid : 0;
                
                const isMonthlyPayment = bookingDetails && bookingDetails.paymentMethod === 'monthly';
                const monthlyNote = isMonthlyPayment ? ` <span class="text-slate-500 font-normal ml-1">(${_('info_monthly_plan_coverage')})</span>` : '';

                const now = new Date();
                const classStartDateTime = new Date(`${cls.date}T${cls.time}`); 
                const hasClassStarted = now > classStartDateTime;
                const settings = appState.studioSettings.clsDefaults || {};
                const cutoffHours = settings.cancellationCutoff || 0;
                const cutoffTime = new Date(classStartDateTime.getTime() - (cutoffHours * 60 * 60 * 1000));
                const isCancellationClosed = (now > cutoffTime) && !hasClassStarted;
                
                const typeId = bookingDetails ? (bookingDetails.creditTypeId || cls.costCreditTypeId || 'general') : 'general';
                const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                const typeColor = typeDef?.color || '#64748b';
                const typePill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${typeColor}26; color: ${typeColor}">${typeName}</span>`;

                // Branch Badge
                let branchBadge = '';
                if (branches.length > 1) {
                    const bId = cls.branchId || defaultBranchId;
                    const branchObj = branches.find(b => b.id === bId);
                    if (branchObj) {
                        const bName = (appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name;
                        const bColor = branchObj.color || '#64748b';
                        branchBadge = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border align-middle ml-2" style="background-color: ${bColor}15; color: ${bColor}; border-color: ${bColor}30;">${bName}</span>`;
                    }
                }

                return `<div class="${isHighlighted ? 'booking-highlight' : 'bg-slate-100'} p-4 rounded-lg flex justify-between items-center" data-cls-id="${cls.id}">
                    <div>
                        <p class="font-bold text-slate-800">${getSportTypeName(sportType)}${branchBadge}</p>
                        <p class="text-sm text-slate-500">${_('template_datetime_at').replace('{date}', formatDateWithWeekday(cls.date)).replace('{time}', getTimeRange(cls.time, cls.duration))}</p>
                        <div class="text-xs text-slate-600 mt-1 flex items-center">
                            ${_('label_credits_used')} ${creditsUsed} ${typePill}${monthlyNote}
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">${formatBookingAuditText(bookingDetails)}</p>
                    </div>
                    ${(() => {
                        if (isAttended) return `<span class="text-sm font-semibold text-green-600">${_('status_completed')}</span>`;
                        if (hasClassStarted) return `<span class="text-sm font-semibold text-slate-500">${_('status_no_show')}</span>`;
                        if (isCancellationClosed) return `<span class="text-sm font-semibold text-indigo-600 opacity-70 cursor-not-allowed" title="${_('tooltip_cancellation_closed').replace('{hours}', cutoffHours)}">${_('status_booked')}</span>`;
                        return `<button class="cancel-booking-btn-dash text-sm font-semibold text-red-600 hover:text-red-800" data-cls-id="${cls.id}">${_('btn_cancel')}</button>`;
                    })()}
                </div>`;
            }).join('');

            renderPaginationControls(paginationContainer, page, totalPages, filteredBookings.length, itemsPerPage, (newPage) => {
                appState.pagination.accountBookings.page = newPage; renderBookingList();
            });
            listContainer.querySelectorAll('.cancel-booking-btn-dash').forEach(btn => {
                btn.onclick = () => { const cls = memberBookings.find(c => c.id === btn.dataset.clsId); handleCancelBooking(cls); };
            });
        };

        // 5. Render Filter Pills (DYNAMIC WATERFALL)
        const renderFilterPills = () => {
            const pillsContainer = container.querySelector('#bookingFilterPills');
            if (!pillsContainer || memberBookings.length === 0) return; 
            
            // --- CALCULATION STEP ---
            const usedBranchIds = new Set();
            const branchClassCountMap = { 'all': 0 };
            
            const usedCreditTypeIds = new Set();
            const creditUsageMap = { 'all': 0 };

            memberBookings.forEach(cls => {
                const booking = cls.bookedBy[member.id];
                if (!booking) return;

                const bId = cls.branchId || defaultBranchId;
                const typeId = booking.creditTypeId || cls.costCreditTypeId || 'general';
                const creditsUsed = parseFloat(booking.creditsPaid || 0);

                // A. Branch Stats (Absolute)
                usedBranchIds.add(bId);
                branchClassCountMap['all']++;
                if (!branchClassCountMap[bId]) { branchClassCountMap[bId] = 0; }
                branchClassCountMap[bId]++;

                // B. Credit Stats (Waterfall)
                const branchMatch = (selectedBranchFilter === 'all') || (bId === selectedBranchFilter);
                if (branchMatch) {
                    usedCreditTypeIds.add(typeId);
                    creditUsageMap['all'] += creditsUsed;
                    if (!creditUsageMap[typeId]) { creditUsageMap[typeId] = 0; }
                    creditUsageMap[typeId] += creditsUsed;
                }
            });

            // --- HTML GENERATION STEP ---

            // Row 1: Branch Filters
            let branchPillsHTML = '';
            if (usedBranchIds.size > 1) {
                branchPillsHTML = `<div class="flex flex-wrap gap-2 justify-end mb-1">`;
                const allBranchActive = selectedBranchFilter === 'all';
                const allBranchClass = allBranchActive ? 'bg-slate-700 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200';
                const countLabel = branchClassCountMap['all'];
                branchPillsHTML += `<button class="filter-pill-branch px-3 py-1 text-xs font-bold rounded-full transition-all ${allBranchClass}" data-filter-branch="all">${_('filter_all_branches')} (${countLabel})</button>`;

                usedBranchIds.forEach(bId => {
                    const branchObj = branches.find(b => b.id === bId);
                    const bName = branchObj ? ((appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name) : _('label_legacy_branch');
                    const bColor = branchObj ? (branchObj.color || '#64748b') : '#64748b';
                    const isActive = selectedBranchFilter === bId;
                    const bCount = branchClassCountMap[bId] || 0;
                    // No border, match credit pill height
                    let style = isActive ? `background-color: ${bColor}; color: white; box-shadow: 0 4px 6px -1px ${bColor}66;` : `background-color: ${bColor}15; color: ${bColor};`;
                    let className = 'filter-pill-branch px-3 py-1 text-xs font-bold rounded-full transition-all ' + (isActive ? '' : 'hover:opacity-80');
                    branchPillsHTML += `<button class="${className}" style="${style}" data-filter-branch="${bId}">${bName} (${bCount})</button>`;
                });
                branchPillsHTML += `</div>`;
            }

            // Row 2: Credit Filters
            let creditPillsHTML = `<div class="flex flex-wrap gap-2 justify-end">`;
            const allCreditActive = selectedCreditFilter === 'all';
            const allCreditClass = allCreditActive ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            creditPillsHTML += `<button class="filter-pill-credit px-3 py-1 text-xs font-bold rounded-full transition-all ${allCreditClass}" data-filter-type="all">${_('filter_all')} ${_('label_used_credits_suffix').replace('{count}', formatCredits(creditUsageMap['all'] || 0))}</button>`;
            
            if (usedCreditTypeIds.size > 1) {
                usedCreditTypeIds.forEach(typeId => {
                    const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                    const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                    const baseColor = typeDef?.color || '#64748b';
                    const isActive = selectedCreditFilter === typeId;
                    const usageText = _('label_used_credits_suffix').replace('{count}', formatCredits(creditUsageMap[typeId] || 0));
                    let style = isActive ? `background-color: ${baseColor}; color: white; box-shadow: 0 4px 6px -1px ${baseColor}66;` : `background-color: ${baseColor}15; color: ${baseColor};`;
                    let className = 'filter-pill-credit px-3 py-1 text-xs font-bold rounded-full transition-all ' + (isActive ? '' : 'hover:opacity-80');
                    creditPillsHTML += `<button class="${className}" style="${style}" data-filter-type="${typeId}">${typeName} ${usageText}</button>`;
                });
            }
            creditPillsHTML += `</div>`;

            pillsContainer.innerHTML = branchPillsHTML + creditPillsHTML;

            // Bind Events
            pillsContainer.querySelectorAll('.filter-pill-credit').forEach(btn => {
                btn.onclick = () => {
                    selectedCreditFilter = btn.dataset.filterType;
                    appState.pagination.accountBookings.page = 1;
                    renderFilterPills(); // Re-render to update active state
                    renderBookingList();
                };
            });
            
            pillsContainer.querySelectorAll('.filter-pill-branch').forEach(btn => {
                btn.onclick = () => {
                    selectedBranchFilter = btn.dataset.filterBranch;
                    
                    // --- WATERFALL RESET ---
                    selectedCreditFilter = 'all'; 
                    
                    appState.pagination.accountBookings.page = 1;
                    renderFilterPills(); // Re-render to recalculate numbers
                    renderBookingList();
                };
            });
        };

        // 6. Combined Profile Content
        const getProfileContent = () => {
            const joinDateHtml = `<div class="flex items-center gap-2"><span data-lang-key="label_join_date" class="font-bold text-slate-700"></span><span class="text-slate-600">${formatShortDateWithYear(member.joinDate)}</span></div>`;
            
            let branchHtml = '';
            if (branches.length > 1) {
                const branchId = member.homeBranchId || defaultBranchId;
                const branch = branches.find(b => b.id === branchId);
                if (branch) {
                    const bName = (appState.currentLanguage === 'zh-TW' && branch.name_zh) ? branch.name_zh : branch.name;
                    const bColor = branch.color || '#64748b';
                    const pillHtml = `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-full border" style="background-color: ${bColor}15; color: ${bColor}; border-color: ${bColor}30;">${bName}</span>`;
                    branchHtml = `<div class="flex items-center gap-2 mt-2"><span data-lang-key="label_home_branch" class="font-bold text-slate-700"></span>${pillHtml}</div>`;
                }
            }

            let content = joinDateHtml + branchHtml;

            // Section A: Monthly Plan
            if (member.monthlyPlan) {
                const tierId = member.monthlyPlanTierId;
                const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                const pillStyle = tier ? `background-color: ${tier.color}26; color: ${tier.color};` : 'background-color: #dcfce7; color: #166534;';
                const tierLabel = tier ? ` ${getMonthlyPlanName(tier)}` : '';
                
                const dueDate = member.paymentDueDate ? new Date(member.paymentDueDate) : null;
                const today = new Date(); today.setHours(0,0,0,0);
                const isOverdue = dueDate && dueDate < today;
                const dateStyle = isOverdue ? 'text-red-600 font-bold' : 'text-slate-800 font-bold';
                const nextDue = member.paymentDueDate ? formatShortDateWithYear(member.paymentDueDate) : _('label_na');
                
                let renewsText = _('label_na');
                if (member.planStartDate) {
                    const day = parseInt(member.planStartDate.split('-')[2]);
                    renewsText = _('label_on_the_day').replace('{day}', day).replace('{suffix}', getOrdinalSuffix(day));
                }

                content += `
                <div class="mt-4 pt-4 border-t border-slate-100">
                    <div class="flex items-center gap-2 mb-3">
                        <span data-lang-key="label_plan" class="font-bold text-slate-700"></span>
                        <span class="text-sm font-bold px-2.5 py-1 rounded-full" style="${pillStyle}">${formatCurrency(member.monthlyPlanAmount)}${_('label_mo')}${tierLabel}</span>
                    </div>
                    <div class="mt-2"><p data-lang-key="label_renews_every_month" class="text-sm text-slate-500"></p><p class="font-bold text-sm text-slate-800">${renewsText}</p></div>
                    <div class="mt-2"><p data-lang-key="label_next_payment_due" class="text-sm text-slate-500"></p><p class="${dateStyle} text-sm">${nextDue}</p></div>
                </div>`;
            }

            // Section B: Wallet List
            const wallet = getMemberWallet(member);
            const activeWalletEntries = Object.entries(wallet).filter(([_, data]) => (data.balance || 0) > 0 || (data.initialCredits || 0) > 0);
            
            let creditsListHtml = '';
            if (activeWalletEntries.length === 0 && !member.monthlyPlan) {
                creditsListHtml = `<div class="mb-3"><div class="mb-1"><span class="font-bold text-sm px-2.5 py-1 rounded-full inline-block" style="background-color: #94a3b826; color: #94a3b8;">0 ${_('label_credits')}</span></div></div>`;
            } else if (activeWalletEntries.length > 0) {
                creditsListHtml = activeWalletEntries.map(([typeId, data]) => {
                    const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                    const color = typeDef?.color || '#64748b';
                    const name = typeDef ? getCreditTypeName(typeDef) : (data.isLegacy ? _('label_general') : _('label_credits'));
                    const initial = data.initialCredits || data.balance;
                    const isExpired = data.expiryDate && new Date(data.expiryDate) < new Date();
                    const expiryText = data.expiryDate ? formatShortDateWithYear(data.expiryDate) : _('label_na');
                    const statusLabel = isExpired ? _('label_expired') : _('label_expires');
                    
                    return `<div class="mb-3 last:mb-0">
                        <div class="mb-1" title="${name}">
                            <span class="font-bold text-sm px-2.5 py-1 rounded-full inline-block" style="background-color: ${color}26; color: ${color};">
                                ${formatCredits(data.balance)} / ${formatCredits(initial)} ${name}
                            </span>
                        </div>
                        <div class="text-sm text-slate-700 font-semibold ml-1">
                            <span class="${isExpired ? 'text-red-600 font-bold' : ''}">${statusLabel}: ${expiryText}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            if (creditsListHtml) {
                content += `<div class="mt-4 pt-4 border-t border-slate-100"><p data-lang-key="label_credits_remaining" class="font-bold text-slate-700 mb-3"></p>${creditsListHtml}</div>`;
            }

            return content;
        };

        const settings = appState.studioSettings.clsDefaults || {};
        const cutoffHours = settings.cancellationCutoff || 0;
        let cancellationBannerHTML = '';
        if (cutoffHours > 0) {
            cancellationBannerHTML = `<div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 flex items-start gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p class="text-sm text-indigo-700">${_('info_cancellation_policy_banner').replace('{hours}', cutoffHours)}</p></div>`;
        }

        container.innerHTML = `
            <div class="w-full max-w-screen-lg mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- Left Column: Profile & Status -->
                <div class="md:col-span-1 space-y-8">
                    <div class="card p-6 text-center">
                        <h2 class="text-2xl font-bold text-slate-800">${member.name}</h2>
                        <p class="text-slate-500 break-all">${member.email}</p>
                        <hr class="my-6">
                        <div class="space-y-4 text-left">${getProfileContent()}</div>
                        <div class="mt-8 space-y-4">
                            <button id="editProfileBtn" data-lang-key="btn_edit_profile" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition"></button>
                            <button id="changePasswordBtn" data-lang-key="btn_change_password" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition"></button>
                        </div>
                        <hr class="my-6">
                        <div class="flex justify-between items-center">
                            <h4 data-lang-key="label_language" class="font-semibold text-slate-600"></h4>
                            <div class="text-base">
                                <a href="#" class="lang-selector font-semibold" data-lang="zh-TW" data-lang-key="lang_selector_zh"></a> | 
                                <a href="#" class="lang-selector font-semibold" data-lang="en" data-lang-key="lang_selector_en"></a>
                            </div>
                        </div>
                    </div>
                    
                    <!-- History Tabbed Card -->
                    <div class="card p-6">
                        <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">${_('header_transaction_history')}</h4>
                        <div class="flex border-b border-slate-200 mb-4">
                            <button id="tabPurchases" class="flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors">
                                ${_('tab_credits')} (${purchaseCount})
                            </button>
                            <button id="tabPayments" class="flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors">
                                ${_('tab_monthly')} (${paymentCount})
                            </button>
                        </div>
                        <div id="purchaseHistoryContent" class="space-y-2 text-sm max-h-40 overflow-y-auto"></div>
                        <div id="paymentHistoryContent" class="space-y-2 text-sm max-h-40 overflow-y-auto hidden"></div>
                    </div>
                </div>
                
                <!-- Right Column: Bookings -->
                <div class="md:col-span-2">
                    <div class="card p-6">
                        <div class="flex flex-wrap justify-between items-start mb-4 gap-2">
                            <h3 class="text-xl font-bold text-slate-800 whitespace-nowrap mt-1">${_('header_my_bookings')} <span id="accountBookingCount"></span></h3>
                            <div id="bookingFilterPills" class="flex flex-col items-end gap-1"></div>
                        </div>
                        ${cancellationBannerHTML}
                        <div id="accountBookingList" class="space-y-3 min-h-[100px]"></div>
                        <div id="accountBookingPagination" class="flex justify-between items-center mt-4"></div>
                    </div>
                </div>
            </div>`;

        // Render History Lists
        const renderHistoryLists = () => {
            const purchContent = container.querySelector('#purchaseHistoryContent');
            if (purchContent) {
                if (purchaseList.length > 0) {
                    purchContent.innerHTML = purchaseList.map(p => {
                        const creditsUnit = p.credits === 1 ? _('label_credit_single') : _('label_credit_plural');
                        const entryText = _('history_purchase_entry').replace('{amount}', formatCurrency(p.amount)).replace('{quantity}', p.credits).replace('{unit}', creditsUnit);
                        const typeId = p.creditTypeId || 'general';
                        const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                        const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                        const typeColor = typeDef?.color || '#64748b';
                        const typePill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${typeColor}26; color: ${typeColor}">${typeName}</span>`;
                        let auditMessage = '';
                        if (p.lastModifiedBy) {
                            const actionKey = (p.date === p.lastModifiedAt ? 'audit_added_by' : 'audit_edited_by');
                            auditMessage = `<span class="text-xs text-slate-500 mt-1 block">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</span>`;
                        }
                        return `<div class="text-slate-600 bg-slate-50 p-2 rounded-md"><div><strong>${formatShortDateWithYear(p.date)}:</strong> ${entryText} ${typePill}</div>${auditMessage}</div>`;
                    }).join('');
                } else {
                    purchContent.innerHTML = `<p class="text-sm text-slate-500 text-center">${_('no_purchase_history')}</p>`;
                }
            }

            const payContent = container.querySelector('#paymentHistoryContent');
            if (payContent) {
                if (paymentList.length > 0) {
                    payContent.innerHTML = paymentList.map(p => {
                        const monthUnit = p.monthsPaid === 1 ? _('label_month_singular') : _('label_month_plural');
                        const entryText = _('history_payment_entry').replace('{amount}', formatCurrency(p.amount)).replace('{quantity}', p.monthsPaid).replace('{unit}', monthUnit);
                        const tierId = p.monthlyPlanTierId;
                        const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                        let tierPill = '';
                        if (tier) {
                            tierPill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${tier.color}26; color: ${tier.color}">${getMonthlyPlanName(tier)}</span>`;
                        }
                        let auditMessage = '';
                        if (p.lastModifiedBy) {
                            const actionKey = (p.date === p.lastModifiedAt ? 'audit_added_by' : 'audit_edited_by');
                            auditMessage = `<span class="text-xs text-slate-500 mt-1 block">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</span>`;
                        }
                        return `<div class="text-slate-600 bg-slate-50 p-2 rounded-md"><div><strong>${formatShortDateWithYear(p.date)}:</strong> ${entryText} ${tierPill}</div>${auditMessage}</div>`;
                    }).join('');
                } else {
                    payContent.innerHTML = `<p class="text-sm text-slate-500 text-center">${_('no_payment_history')}</p>`;
                }
            }
        };
        renderHistoryLists();

        // Tab Switching Logic
        const tabPurchases = container.querySelector('#tabPurchases');
        const tabPayments = container.querySelector('#tabPayments');
        const purchaseContent = container.querySelector('#purchaseHistoryContent');
        const paymentContent = container.querySelector('#paymentHistoryContent');

        tabPurchases.onclick = () => {
            purchaseContent.classList.remove('hidden');
            paymentContent.classList.add('hidden');
            tabPurchases.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabPayments.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";
        };
        tabPayments.onclick = () => {
            purchaseContent.classList.add('hidden');
            paymentContent.classList.remove('hidden');
            tabPayments.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabPurchases.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";
        };

        setupLanguageToggles();
        updateUIText();
        setLanguage(appState.currentLanguage, false);
        
        renderBookingList();
        renderFilterPills();

        if (appState.highlightBookingId) {
            const elementToScrollTo = container.querySelector(`[data-cls-id="${appState.highlightBookingId}"]`);
            if (elementToScrollTo) elementToScrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            appState.highlightBookingId = null;
        }

        container.querySelector('#editProfileBtn').onclick = () => openEditMemberAccountModal(member);
        container.querySelector('#changePasswordBtn').onclick = () => openChangePasswordModal();
    }

    function openEditMemberAccountModal(member) {
        DOMElements.editMemberAccountModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-6 text-center">${_('title_edit_profile')}</h2>
                <form id="editMemberAccountForm" class="space-y-4">
                    <div>
                        <label for="editMemberName" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_full_name')}</label>
                        <input type="text" id="editMemberName" required class="form-input" value="${member.name}" placeholder="${_('placeholder_name')}">
                    </div>
                    <div>
                        <label for="editMemberEmail" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_email')}</label>
                        <input type="email" id="editMemberEmail" required class="form-input" value="${member.email}" disabled>
                    </div>
                    <div>
                        <label for="editMemberPhone" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_mobile_number')}</label>
                        <div class="flex gap-2">
                            <input type="text" id="editMemberCountryCode" class="form-input w-24" placeholder="${_('placeholder_country_code')}">
                            <input type="tel" id="editMemberPhone" required class="form-input flex-grow" placeholder="${_('placeholder_phone')}">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">${_('btn_save_changes')}</button>
                    </div>
                </form>
            </div>
        `;
        const form = DOMElements.editMemberAccountModal.querySelector('#editMemberAccountForm');
        const editMemberCountryCodeInput = form.querySelector('#editMemberCountryCode');
        const editMemberPhoneInput = form.querySelector('#editMemberPhone');

        const { countryCode, number } = parsePhoneNumber(member.phone);
        editMemberCountryCodeInput.value = countryCode;
        editMemberPhoneInput.value = number;

        editMemberPhoneInput.oninput = (e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '');
            e.target.value = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ');
        };

        form.onsubmit = handleEditMemberAccountSubmit;
        openModal(DOMElements.editMemberAccountModal);
    }

    function handleEditMemberAccountSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const name = form.querySelector('#editMemberName').value;
        const countryCode = form.querySelector('#editMemberCountryCode').value.trim();
        const phoneNumber = form.querySelector('#editMemberPhone').value;
        const phone = constructPhoneNumber(countryCode, phoneNumber);
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const updates = { name, phone };
        
        database.ref('users/' + appState.currentUser.id).update(updates)
            .then(() => {
                showMessageBox(_('success_profile_updated'), 'success');
                closeModal(DOMElements.editMemberAccountModal);
            })
            .catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'))
            .finally(() => submitBtn.disabled = false);
    }

    function openChangePasswordModal() {
        DOMElements.changePasswordModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-6 text-center">${_('title_change_password')}</h2>
                <form id="changePasswordForm" class="space-y-4">
                    <div>
                        <label for="currentPassword" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_current_password')}</label>
                        <div class="relative">
                            <input type="password" id="currentPassword" required class="form-input pr-10">
                            <button type="button" class="password-toggle-btn" aria-label="Show password"></button>
                        </div>
                    </div>
                    <div>
                        <label for="newPassword" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_new_password')}</label>
                        <div class="relative">
                            <!-- ADDED 'password-strength-input' class -->
                            <input type="password" id="newPassword" required class="form-input pr-10 password-strength-input">
                            <button type="button" class="password-toggle-btn" aria-label="Show password"></button>
                        </div>
                        <!-- START: INJECTED PASSWORD STRENGTH INDICATOR HTML -->
                        <div class="password-strength-container mt-2 h-7 hidden">
                            <div class="h-2 bg-slate-200 rounded-full mb-1">
                                <div class="password-strength-bar h-full rounded-full transition-all duration-300"></div>
                            </div>
                            <div class="flex justify-between items-center">
                                <span data-lang-key="auth_password_strength" class="text-xs font-semibold text-slate-500"></span>
                                <span class="password-strength-text text-xs font-bold"></span>
                            </div>
                        </div>
                        <!-- END: INJECTED HTML -->
                    </div>
                    <div>
                        <label for="confirmNewPassword" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_confirm_new_password')}</label>
                        <div class="relative">
                            <input type="password" id="confirmNewPassword" required class="form-input pr-10">
                            <button type="button" class="password-toggle-btn" aria-label="Show password"></button>
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">${_('btn_change_password')}</button>
                    </div>
                </form>
            </div>
        `;
        const form = DOMElements.changePasswordModal.querySelector('#changePasswordForm');
        form.onsubmit = handleChangePasswordSubmit;
        
        // Initialize toggles after the modal content is created
        setupPasswordToggle('currentPassword');
        setupPasswordToggle('newPassword');
        setupPasswordToggle('confirmNewPassword');
        
        // START: ADDED EVENT LISTENERS FOR THE MODAL'S INDICATOR
        const newPasswordInput = form.querySelector('#newPassword');
        const confirmNewPasswordInput = form.querySelector('#confirmNewPassword');
        const strengthContainer = form.querySelector('.password-strength-container');
        
        newPasswordInput.addEventListener('input', () => {
            if (strengthContainer) {
                strengthContainer.classList.toggle('hidden', !newPasswordInput.value);
                updatePasswordStrengthUI(form);
            }
        });
        
        confirmNewPasswordInput.addEventListener('focus', () => {
            if (strengthContainer) strengthContainer.classList.add('hidden');
        });

        newPasswordInput.addEventListener('focus', () => {
            if (strengthContainer && newPasswordInput.value) {
                strengthContainer.classList.remove('hidden');
            }
        });
        // END: ADDED EVENT LISTENERS

        openModal(DOMElements.changePasswordModal);
        updateUIText(); // Translate the newly added text
    }

    function handleChangePasswordSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const currentPassword = form.querySelector('#currentPassword').value;
        const newPassword = form.querySelector('#newPassword').value;
        const confirmNewPassword = form.querySelector('#confirmNewPassword').value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (newPassword !== confirmNewPassword) {
            showMessageBox(_('error_passwords_no_match'), 'error');
            return;
        }
        if (newPassword.length < 6) {
            showMessageBox(_('error_password_too_short'), 'error');
            return;
        }

        submitBtn.disabled = true;
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        user.reauthenticateWithCredential(credential)
            .then(() => user.updatePassword(newPassword))
            .then(() => {
                showMessageBox(_('success_password_changed'), 'success');
                closeModal(DOMElements.changePasswordModal);
            })
            .catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'))
            .finally(() => submitBtn.disabled = false);
    }

    function renderMembersPage(container) {
        const memberCount = appState.users.filter(u => u.role === 'member' && !u.isDeleted).length;
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        // Helper to allow Manager to see owner-level features like Export
        const isOwnerOrManager = isOwner || isManager;

        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;

        // --- NEW: Check if any monthly members exist to conditionally show the section ---
        const hasMonthlyMembers = appState.users.some(u => u.role === 'member' && !u.isDeleted && u.monthlyPlan);
        
        const autoAdjustSectionHTML = hasMonthlyMembers ? `
            <div class="w-full mt-4 mb-6 p-4 bg-slate-50 border rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h4 class="font-semibold text-slate-800">${_('header_auto_adjust_plans')}</h4>
                    <p class="text-sm text-slate-600">${_('desc_auto_adjust_plans')}</p>
                </div>
                <button id="recalculatePlansBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition w-full sm:w-auto flex-shrink-0">${_('btn_recalculate_all')}</button>
            </div>` : '';

        // --- NEW: Prepare Branch Filter HTML ---
        let branchFilterHTML = '';
        if (hasMultipleBranches) {
            let options = `<option value="all">${_('filter_all_branches')}</option>`;
            options += branches.map(b => {
                const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                return `<option value="${b.id}">${bName}</option>`;
            }).join('');
            // Added margin-right to spacing it from the search bar
            branchFilterHTML = `<select id="memberBranchFilter" class="form-select w-48 mr-2">${options}</select>`;
        }

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_manage_members')} <span id="memberCountDisplay">(${memberCount})</span></h2>
                    <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                        
                        <!-- 1. Branch Filter (New) -->
                        ${branchFilterHTML}

                        <!-- 2. Search Bar -->
                        <div class="relative w-64">
                            <input type="text" id="memberSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-full pr-10">
                            <button id="clearSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" style="display: none;">
                                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <!-- 3. Export Button -->
                        ${isOwnerOrManager ? `
                        <div class="relative" id="exportMenuContainer">
                            <button id="exportMembersBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                                ${_('btn_export')}
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </button>
                            <div id="exportMembersDropdown" class="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 hidden" role="menu" aria-orientation="vertical" aria-labelledby="exportMembersBtn">
                                <div class="p-1" role="none">
                                    <a href="#" id="exportSummaryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <span class="font-medium">${_('export_member_summary')}</span>
                                    </a>
                                    <a href="#" id="exportBookingHistoryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span class="font-medium">${_('export_booking_history')}</span>
                                    </a>
                                    <a href="#" id="exportFinancialHistoryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        <span class="font-medium">${_('export_financial_history')}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                ${autoAdjustSectionHTML}

                <!-- Added min-w-[900px] to table and whitespace-nowrap to headers -->
                <div class="overflow-x-auto pb-2">
                    <table class="w-full text-left min-w-[900px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="name">${_('table_header_name')}<span class="sort-icon"></span></th>
                                <!-- NEW: Branch Column Header -->
                                ${hasMultipleBranches ? `<th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="homeBranchId">${_('label_home_branch')}<span class="sort-icon"></span></th>` : ''}
                                
                                <th class="p-2 whitespace-nowrap">${_('table_header_contact')}</th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="joinDate">${_('table_header_join')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="credits">${_('table_header_credits_plan')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="expiryDate">${_('table_header_expiry_due')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="lastBooking">${_('table_header_last_active')}<span class="sort-icon"></span></th>
                                <th class="p-2"></th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody"></tbody>
                    </table>
                </div>
                <div id="membersPagination" class="flex justify-between items-center mt-4"></div>
            </div>`;
        
        const searchInput = container.querySelector('#memberSearchInput');
        const branchFilter = container.querySelector('#memberBranchFilter'); // New Reference
        const clearBtn = container.querySelector('#clearSearchBtn');
        const tableBody = container.querySelector('#membersTableBody');
        const paginationContainer = container.querySelector('#membersPagination');

        const exportMenuContainer = container.querySelector('#exportMenuContainer');
        const exportBtn = container.querySelector('#exportMembersBtn');
        const exportDropdown = container.querySelector('#exportMembersDropdown');
        if (exportBtn) {
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                exportDropdown.classList.toggle('hidden');
            };
            document.addEventListener('click', (e) => {
                if (exportMenuContainer && !exportMenuContainer.contains(e.target)) {
                    exportDropdown.classList.add('hidden');
                }
            }, { once: true });
        }

        // --- Helper: Open Quick Date Edit Modal ---
        const openQuickDateModal = (title, currentDate, onConfirm) => {
            // Re-purpose the existing confirmation modal structure for a date input
            DOMElements.confirmationModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <h2 class="text-xl font-bold text-slate-800 mb-4 text-center">${title}</h2>
                    <form id="quickDateForm">
                        <input type="date" id="quickDateInput" class="form-input w-full mb-6" value="${currentDate}" required>
                        <div class="flex justify-center gap-4">
                            <button type="button" class="cancel-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg">${_('btn_cancel')}</button>
                            <button type="submit" class="confirm-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg">${_('btn_save_changes')}</button>
                        </div>
                    </form>
                </div>`;
            
            const modal = DOMElements.confirmationModal;
            const form = modal.querySelector('#quickDateForm');
            const input = modal.querySelector('#quickDateInput');

            openModal(modal);

            // Bind Actions
            modal.querySelector('.cancel-btn').onclick = () => closeModal(modal);
            modal.querySelector('.modal-close-btn').onclick = () => closeModal(modal);
            
            form.onsubmit = (e) => {
                e.preventDefault();
                if (onConfirm) onConfirm(input.value);
                closeModal(modal);
            };
        };

        // Helper to get branch name safely
        const getBranchName = (u) => {
            const bId = u.homeBranchId || (branches[0] ? branches[0].id : null);
            const b = branches.find(br => br.id === bId);
            return (appState.currentLanguage === 'zh-TW' && b?.name_zh) ? b.name_zh : (b?.name || _('label_legacy_branch'));
        };

        const updateTable = (searchTerm = '') => {
            const { key, direction } = appState.membersSort;
            
            // Handle Filter Values
            const selectedBranchId = branchFilter ? branchFilter.value : 'all';

            container.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
                icon.className = 'sort-icon';
            });
            const activeHeader = container.querySelector(`th[data-sort-key="${key}"] .sort-icon`);
            if (activeHeader) {
                activeHeader.classList.add(direction);
            }
            
            // 1. Filter Logic (Search + Branch)
            const filteredUsers = appState.users.filter(u => {
                // Base check
                if (u.role === 'owner' || u.role === 'staff' || u.role === 'manager' || u.isDeleted) return false;

                // Branch Check
                if (selectedBranchId !== 'all') {
                    const uBranch = u.homeBranchId || (branches[0] ? branches[0].id : null);
                    if (uBranch !== selectedBranchId) return false;
                }

                // Search Check
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return u.name.toLowerCase().includes(term) ||
                           u.email.toLowerCase().includes(term) ||
                           (u.phone && u.phone.includes(term));
                }

                return true;
            });

            if (container.querySelector('#memberCountDisplay')) container.querySelector('#memberCountDisplay').textContent = `(${filteredUsers.length})`;
            
            // 2. Sorting Logic
            const sortedUsers = filteredUsers.sort((a, b) => {
                let valA, valB;

                if (key === 'credits') {
                    valA = a.monthlyPlan ? 999999 : getWalletStatus(a).totalBalance;
                    valB = b.monthlyPlan ? 999999 : getWalletStatus(b).totalBalance;
                } else if (key === 'expiryDate') {
                    const getExpirationTimestamp = (u) => {
                        let dates = [];
                        if (u.monthlyPlan && u.paymentDueDate) dates.push(new Date(u.paymentDueDate).getTime());
                        const wallet = getMemberWallet(u);
                        Object.values(wallet).forEach(w => {
                            if (w.expiryDate) dates.push(new Date(w.expiryDate).getTime());
                        });
                        if (dates.length === 0) return 0;
                        return direction === 'asc' ? Math.min(...dates) : Math.max(...dates);
                    };
                    valA = getExpirationTimestamp(a);
                    valB = getExpirationTimestamp(b);
                } else if (key === 'lastBooking' || key === 'joinDate') {
                    valA = a[key] ? new Date(a[key]).getTime() : 0;
                    valB = b[key] ? new Date(b[key]).getTime() : 0;
                } else if (key === 'homeBranchId') {
                    valA = getBranchName(a).toLowerCase();
                    valB = getBranchName(b).toLowerCase();
                } else {
                    valA = a[key];
                    valB = b[key];
                }

                // Generic string sort fix
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            const { itemsPerPage } = appState;
            const totalPages = Math.ceil(sortedUsers.length / itemsPerPage.members) || 1;
            let page = appState.pagination.members.page;
            if (page > totalPages) page = totalPages;

            const paginatedUsers = sortedUsers.slice((page - 1) * itemsPerPage.members, page * itemsPerPage.members);

            tableBody.innerHTML = paginatedUsers.map(member => {
                const wallet = getMemberWallet(member);
                const today = new Date();
                today.setHours(0,0,0,0);

                // --- 1. Prepare Data Rows ---
                const displayRows = [];

                // A. Monthly Plan
                if (member.monthlyPlan) {
                    const tierId = member.monthlyPlanTierId;
                    const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                    const pillStyle = tier ? `background-color: ${tier.color}26; color: ${tier.color};` : 'background-color: #dcfce7; color: #166534;';
                    const tierLabel = tier ? ` ${getMonthlyPlanName(tier)}` : '';
                    
                    const dueDate = member.paymentDueDate ? new Date(member.paymentDueDate) : null;
                    const isOverdue = dueDate && dueDate < today;
                    const dateText = member.paymentDueDate ? formatShortDateWithYear(member.paymentDueDate) : _('label_na');
                    const dateStyle = isOverdue ? 'text-red-600 font-bold' : 'text-slate-900';

                    // --- ADDED: Quick Edit Button Logic for Monthly ---
                    const rawDate = member.paymentDueDate || '';
                    const dateHtml = `<button class="quick-edit-date-btn text-sm ${dateStyle} hover:text-indigo-600 border-b border-dashed border-slate-300 hover:border-indigo-600 transition-colors" data-id="${member.id}" data-context="monthly" data-current="${rawDate}" title="${_('btn_edit')}">${dateText}</button>`;

                    displayRows.push({
                        planHtml: `<span class="text-xs font-bold px-2 py-1 rounded-full inline-block" style="${pillStyle}">${formatCurrency(member.monthlyPlanAmount)}${_('label_mo')}${tierLabel}</span>`,
                        expiryHtml: dateHtml
                    });
                }

                // B. Credit Wallets
                const walletEntries = Object.entries(wallet);
                
                // SIMPLIFIED LOGIC: Show everything except absolute 0/0 state.
                // 1. Balance != 0 (Positive Credit OR Negative Debt)
                // 2. Initial > 0 (Exhausted History like 0/3)
                const entriesToShow = walletEntries.filter(([_, data]) => {
                    const bal = parseFloat(data.balance || 0);
                    const init = parseFloat(data.initialCredits || 0);
                    return bal !== 0 || init > 0;
                });

                if (entriesToShow.length > 0) {
                    entriesToShow.forEach(([typeId, data]) => {
                        const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                        const color = typeDef?.color || '#64748b'; 
                        const name = typeDef ? getCreditTypeName(typeDef) : (data.isLegacy ? _('label_general') : _('label_credits'));
                        
                        const currentBalance = parseFloat(data.balance || 0);
                        const initial = parseFloat(data.initialCredits || 0);

                        let dateText = '-';
                        let dateStyle = 'text-slate-400';
                        let rawDate = data.expiryDate || '';

                        if (data.expiryDate) {
                            const expDate = new Date(data.expiryDate);
                            // Expiry check logic
                            const todayStart = new Date();
                            todayStart.setHours(0,0,0,0);
                            const isExpired = expDate < todayStart;
                            
                            dateText = formatShortDateWithYear(data.expiryDate);
                            // Highlight red if expired AND balance is positive
                            dateStyle = (isExpired && currentBalance > 0) ? 'text-red-600 font-bold' : 'text-slate-900';
                        } else if (rawDate === '') {
                            dateText = _('label_na'); 
                        }

                        // Style adjustment for Debt
                        let pillStyle = `background-color: ${color}26; color: ${color};`;
                        let pillTextClass = '';
                        if (currentBalance < 0) {
                            pillTextClass = 'text-red-600 font-extrabold'; // Make debt stand out
                        }

                        const dateHtml = `<button class="quick-edit-date-btn text-sm ${dateStyle} hover:text-indigo-600 border-b border-dashed border-slate-300 hover:border-indigo-600 transition-colors" data-id="${member.id}" data-context="wallet" data-type-id="${typeId}" data-current="${rawDate}" title="${_('btn_edit')}">${dateText}</button>`;

                        displayRows.push({
                            planHtml: `<span class="font-bold text-xs px-2.5 py-1 rounded-full inline-block ${pillTextClass}" style="${pillStyle}" title="${name}">${formatCredits(currentBalance)} / ${formatCredits(initial)} ${name}</span>`,
                            expiryHtml: dateHtml
                        });
                    });
                } else if (!member.monthlyPlan) {
                    // Default Empty State (0/0) -> Grey Pill
                    const neutralColor = '#94a3b8';
                    displayRows.push({
                        planHtml: `<span class="font-bold text-xs px-2.5 py-1 rounded-full inline-block" style="background-color: ${neutralColor}26; color: ${neutralColor};">0 ${_('label_credits')}</span>`,
                        expiryHtml: `<span class="text-sm text-slate-400">-</span>`
                    });
                }

                const planColumnHtml = displayRows.map(row => `<div class="h-7 flex items-center">${row.planHtml}</div>`).join('');
                const expiryColumnHtml = displayRows.map(row => `<div class="h-7 flex items-center">${row.expiryHtml}</div>`).join('');

                // --- 3. Status Indicators ---
                const { isCritical, isWarning, statusText } = getWalletStatus(member);
                let statusIndicatorHTML = '';
                let memberNotes = member.notes ? member.notes.trim() : '';
                
                if (isCritical) {
                    statusIndicatorHTML = `<span class="status-indicator-dot bg-red-500"></span>`;
                } else if (isWarning) {
                    statusIndicatorHTML = `<span class="status-indicator-dot bg-yellow-400"></span>`;
                } else if (memberNotes) {
                    statusIndicatorHTML = `<span class="status-indicator-dot bg-blue-500"></span>`;
                }

                let tooltipContent = '';
                if (isCritical || isWarning) tooltipContent = statusText;
                if (memberNotes) {
                    if (tooltipContent) tooltipContent += '\n\n';
                    const adminLabelShort = _('label_admin_notes').split(' (')[0];
                    tooltipContent += `${adminLabelShort}: ${memberNotes}`;
                }

                if (member.monthlyPlan) {
                    const payments = firebaseObjectToArray(member.paymentHistory).filter(p => p.status !== 'deleted').sort((a, b) => new Date(b.date) - new Date(a.date));
                    if (payments.length > 0) {
                        const p = payments[0];
                        const monthUnit = p.monthsPaid === 1 ? _('label_month_singular') : _('label_month_plural');
                        const details = _('history_payment_entry').replace('{amount}', formatCurrency(p.amount)).replace('{quantity}', p.monthsPaid).replace('{unit}', monthUnit);
                        tooltipContent += `\n\n${_('tooltip_header_payment_history')}\n- ${formatShortDateWithYear(p.date)}: ${details}`;
                    }
                }
                const purchases = firebaseObjectToArray(member.purchaseHistory).filter(p => p.status !== 'deleted').sort((a, b) => new Date(b.date) - new Date(a.date));
                if (purchases.length > 0) {
                    const p = purchases[0];
                    const creditUnit = p.credits === 1 ? _('label_credit_single') : _('label_credit_plural');
                    const details = _('history_purchase_entry').replace('{amount}', formatCurrency(p.amount)).replace('{quantity}', p.credits).replace('{unit}', creditUnit);
                    tooltipContent += `\n\n${_('tooltip_header_purchase_history')}\n- ${formatShortDateWithYear(p.date)}: ${details}`;
                }

                const hasDot = statusIndicatorHTML !== '';
                const tooltipHTML = (hasDot && tooltipContent) ? `<span class="member-tooltip">${tooltipContent}</span>` : '';
                const hasTooltip = (hasDot && !!tooltipContent);

                // --- NEW: Branch Row Data ---
                let branchRowHtml = '';
                if (hasMultipleBranches) {
                    const bName = getBranchName(member);
                    branchRowHtml = `<td class="p-2 whitespace-nowrap text-slate-600 font-medium">${bName}</td>`;
                }

                return `
                <tr class="border-b border-slate-100 align-middle">
                    <td class="p-2 font-semibold whitespace-nowrap" ${hasTooltip ? `data-tooltip-content` : ''}>
                        ${statusIndicatorHTML}<button class="text-indigo-600 hover:underline member-name-btn" data-id="${member.id}">${member.name}</button>${tooltipHTML}
                    </td>
                    
                    <!-- Branch Column -->
                    ${branchRowHtml}

                    <td class="p-2 text-sm whitespace-nowrap">
                        <div>${member.email}</div>
                        <div>${formatDisplayPhoneNumber(member.phone)}</div>
                    </td>
                    <td class="p-2 text-sm whitespace-nowrap">${member.joinDate ? formatShortDateWithYear(member.joinDate) : 'N/A'}</td>
                    <td class="p-2">${planColumnHtml}</td>
                    <td class="p-2">${expiryColumnHtml}</td>
                    <td class="p-2 text-sm whitespace-nowrap">${formatShortDateWithYear(member.lastBooking)}</td>
                    <td class="p-2 text-right space-x-2 whitespace-nowrap">
                        <button class="edit-member-btn font-semibold text-indigo-600" data-id="${member.id}">${_('btn_edit')}</button>
                        <button class="delete-member-btn font-semibold text-red-600" data-id="${member.id}" data-name="${member.name}">${_('btn_delete')}</button>
                    </td>
                </tr>
                `}).join('');

            renderPaginationControls(paginationContainer, page, totalPages, sortedUsers.length, itemsPerPage.members, (newPage) => {
                appState.pagination.members.page = newPage;
                updateTable(searchInput.value);
            });

            // Re-attach listeners
            tableBody.querySelectorAll('.edit-member-btn').forEach(btn => {
                btn.onclick = () => openMemberModal(appState.users.find(u => u.id === btn.dataset.id));
            });
            tableBody.querySelectorAll('.delete-member-btn').forEach(btn => {
                btn.onclick = () => {
                    const memberId = btn.dataset.id;
                    const memberName = btn.dataset.name;
                    const memberToDelete = appState.users.find(u => u.id === memberId);
                    if (!memberToDelete) return;
                    
                    const title = _('confirm_anonymize_member_title');
                    const message = _('confirm_anonymize_member_desc').replace('{name}', memberName);
                    showConfirmation(title, message, () => {
                        handleMemberDeletion(memberToDelete);
                    });
                };
            });
            tableBody.querySelectorAll('.member-name-btn').forEach(btn => {
                btn.onclick = () => {
                    const member = appState.users.find(u => u.id === btn.dataset.id);
                    openMemberBookingHistoryModal(member);
                };
            });

            // --- ADDED: Listener for Quick Date Edit Buttons ---
            tableBody.onclick = (e) => {
                const btn = e.target.closest('.quick-edit-date-btn');
                if (!btn) return;
                
                const memberId = btn.dataset.id;
                const context = btn.dataset.context; // 'monthly' or 'wallet'
                const currentValue = btn.dataset.current;
                
                let title = '';
                if (context === 'monthly') title = _('label_payment_due_date');
                else title = _('label_expiry_date');

                openQuickDateModal(title, currentValue, (newDate) => {
                    if (!newDate) return; 
                    const updates = {};
                    
                    if (context === 'monthly') {
                        updates[`/users/${memberId}/paymentDueDate`] = newDate;
                    } else if (context === 'wallet') {
                        const typeId = btn.dataset.typeId;
                        updates[`/users/${memberId}/wallet/${typeId}/expiryDate`] = newDate;
                        
                        // Clean up legacy fields to ensure consistency
                        updates[`/users/${memberId}/expiryDate`] = null;
                    }

                    database.ref().update(updates).then(() => {
                        showMessageBox(_('success_member_updated'), 'success');
                    }).catch(error => {
                        showMessageBox(_('error_update_failed').replace('{error}', error.message), 'error');
                    });
                });
            };
        };

        // --- Event Listeners ---
        container.querySelectorAll('th.sortable').forEach(header => {
            header.onclick = () => {
                const newKey = header.dataset.sortKey;
                const { key, direction } = appState.membersSort;
                if (key === newKey) {
                    appState.membersSort.direction = direction === 'asc' ? 'desc' : 'asc';
                } else {
                    appState.membersSort.key = newKey;
                    appState.membersSort.direction = 'asc';
                }
                updateTable(searchInput.value);
            };
        });

        // Optimization: Debounce variable for member search
        let memberSearchDebounce;

        searchInput.oninput = () => {
            clearTimeout(memberSearchDebounce);
            
            // Wait 300ms before processing the search to prevent UI freezing
            memberSearchDebounce = setTimeout(() => {
                appState.pagination.members.page = 1; 
                updateTable(searchInput.value);
                clearBtn.style.display = searchInput.value ? 'flex' : 'none';
            }, 300);
        };

        clearBtn.onclick = () => {
            searchInput.value = '';
            appState.pagination.members.page = 1; 
            updateTable('');
            clearBtn.style.display = 'none';
            searchInput.focus();
        };

        if (branchFilter) {
            branchFilter.onchange = () => {
                appState.pagination.members.page = 1;
                updateTable(searchInput.value);
            };
        }

        // --- Recalculate Plans Logic ---
        const recalcBtn = container.querySelector('#recalculatePlansBtn');
        if (recalcBtn) {
            recalcBtn.onclick = () => {
                showConfirmation(
                    _('confirm_recalculate_title'),
                    _('confirm_recalculate_desc'),
                    recalculateMonthlyPlans
                );
            };
        }

        if (isOwnerOrManager) {
            container.querySelector('#exportSummaryBtn').onclick = (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox(_('info_generating_summary'), 'info', 2000);
                
                // Get Current Filter State
                const searchTerm = searchInput.value.toLowerCase();
                const selectedBranchId = branchFilter ? branchFilter.value : 'all';

                // Re-apply Filters for Export
                let filteredUsers = appState.users.filter(u => {
                    if (u.role === 'owner' || u.role === 'staff' || u.role === 'manager' || u.isDeleted) return false;
                    
                    if (selectedBranchId !== 'all') {
                        const uBranch = u.homeBranchId || (branches[0] ? branches[0].id : null);
                        if (uBranch !== selectedBranchId) return false;
                    }

                    if (searchTerm) {
                        return u.name.toLowerCase().includes(searchTerm) ||
                               u.email.toLowerCase().includes(searchTerm) ||
                               (u.phone && u.phone.includes(searchTerm));
                    }
                    return true;
                });
    
                filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
    
                const exportData = filteredUsers.map(member => {
                    let planTypeParts = [];
                    let creditsStringParts = [];
                    let expiryStringParts = [];

                    if (member.monthlyPlan) {
                        const tierId = member.monthlyPlanTierId;
                        const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                        const tierName = getMonthlyPlanName(tier);
                        planTypeParts.push(`${_('export_value_monthly')} - ${tierName}`);
                        creditsStringParts.push(`${_('export_value_monthly')}: ${formatCurrency(member.monthlyPlanAmount)}`);
                        expiryStringParts.push(`${_('export_value_monthly')}: ${member.paymentDueDate || 'N/A'}`);
                    }

                    const wallet = getMemberWallet(member);
                    const entries = Object.entries(wallet);
                    const activeCreditTypes = entries
                        .filter(([_, data]) => (data.balance || 0) > 0 || (data.initialCredits || 0) > 0)
                        .map(([typeId, data]) => {
                            const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                            const name = typeDef ? getCreditTypeName(typeDef) : (data.isLegacy ? _('label_general') : _('label_unknown'));
                            const initial = data.initialCredits || data.balance;
                            creditsStringParts.push(`${name}: ${data.balance}/${initial}`);
                            expiryStringParts.push(`${name}: ${data.expiryDate || 'N/A'}`);
                            return name;
                        });
                    
                    if (activeCreditTypes.length > 0) {
                        planTypeParts.push(`${_('export_value_credits')} - ${activeCreditTypes.join(', ')}`);
                    }

                    if (planTypeParts.length === 0) planTypeParts.push(_('label_na'));
                    if (creditsStringParts.length === 0) creditsStringParts.push("0");
                    if (expiryStringParts.length === 0) expiryStringParts.push(_('label_na'));

                    const rowData = {
                        [_('export_header_name')]: member.name,
                    };

                    // --- NEW: Include Branch in Export ---
                    if (hasMultipleBranches) {
                        rowData[_('label_home_branch')] = getBranchName(member);
                    }

                    Object.assign(rowData, {
                        [_('export_header_email')]: member.email,
                        [_('export_header_phone')]: member.phone,
                        [_('export_header_join_date')]: member.joinDate ? member.joinDate.slice(0, 10) : '',
                        [_('export_header_plan_type')]: planTypeParts.join(' & '),
                        [_('export_header_monthly_amount')]: member.monthlyPlan ? member.monthlyPlanAmount : 0,
                        [_('export_header_credits_remaining')]: creditsStringParts.join('; '),
                        [_('export_header_expiry_date')]: expiryStringParts.join('; '),
                        [_('export_header_last_active')]: member.lastBooking ? member.lastBooking.slice(0, 10) : ''
                    });

                    return rowData;
                });
                
                exportToCsv('member-summary', exportData);
            };
    
            container.querySelector('#exportBookingHistoryBtn').onclick = async (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox(_('info_generating_bookings'), 'info', 5000);
                try {
                    const usersSnapshot = await database.ref('/users').once('value');
                    const classesSnapshot = await database.ref('/classes').once('value');
                    const allUsers = firebaseObjectToArray(usersSnapshot.val());
                    const allClasses = firebaseObjectToArray(classesSnapshot.val());
                    const exportData = [];
                    const members = allUsers.filter(u => u.role === 'member' && !u.isDeleted);
                    
                    members.forEach(member => {
                        allClasses.forEach(cls => {
                            if (cls.bookedBy && cls.bookedBy[member.id]) {
                                const bookingInfo = cls.bookedBy[member.id];
                                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                                const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                                const typeId = bookingInfo.creditTypeId || cls.costCreditTypeId || 'general';
                                const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                                const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_unknown'));

                                // --- NEW: Resolve Branch Name for CSV ---
                                const branches = appState.branches || [];
                                // Fallback to first branch if legacy/null
                                const bId = cls.branchId || (branches[0] ? branches[0].id : null);
                                const branchObj = branches.find(b => b.id === bId);
                                const branchName = branchObj 
                                    ? ((appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name) 
                                    : _('label_legacy_branch');
                                // ----------------------------------------

                                exportData.push({
                                    [_('export_header_name')]: member.name,
                                    [_('export_header_email')]: member.email,
                                    [_('label_branch')]: branchName, // <--- ADDED COLUMN
                                    [_('export_header_booking_date')]: cls.date,
                                    [_('export_header_class_name')]: getSportTypeName(sportType),
                                    [_('export_header_tutor_name')]: tutor?.name || _('unknown_tutor'),
                                    [_('export_header_credits_used')]: cls.credits,
                                    [_('label_credit_type')]: typeName, 
                                    [_('export_header_attended')]: (cls.attendedBy && cls.attendedBy[member.id]) ? _('export_value_yes') : _('export_value_no'),
                                    [_('export_header_booked_on')]: bookingInfo.bookedAt ? bookingInfo.bookedAt.slice(0, 10) : '',
                                    [_('export_header_booked_by')]: bookingInfo.bookedBy === 'member' ? (appState.currentLanguage === 'zh-TW' ? '會員' : 'Member') : (bookingInfo.bookedBy || _('export_value_unknown'))
                                });
                            }
                        });
                    });
                    
                    exportData.sort((a, b) => {
                        const nameKey = _('export_header_name');
                        const dateKey = _('export_header_booking_date');
                        const nameComparison = a[nameKey].localeCompare(b[nameKey]);
                        if (nameComparison !== 0) return nameComparison;
                        return a[dateKey].localeCompare(b[dateKey]);
                    });
                    
                    exportToCsv('member-full-booking-history', exportData);
                } catch (error) {
                    console.error("Error generating booking history export:", error);
                    showMessageBox(_('error_generate_booking_history_failed'), 'error');
                }
            };
    
            container.querySelector('#exportFinancialHistoryBtn').onclick = async (e) => {
                // ... (Original logic for Financial History Export) ...
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox(_('info_generating_financials'), 'info', 5000);
                try {
                    const usersSnapshot = await database.ref('/users').once('value');
                    const allUsers = firebaseObjectToArray(usersSnapshot.val());
                    const exportData = [];
                    const members = allUsers.filter(u => u.role === 'member' && !u.isDeleted);
                    
                    members.forEach(member => {
                        if (member.purchaseHistory) {
                            firebaseObjectToArray(member.purchaseHistory).filter(p => p.status !== 'deleted').forEach(p => {
                                    const typeId = p.creditTypeId || 'general';
                                    const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                                    const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                                    exportData.push({
                                        [_('export_header_name')]: member.name,
                                        [_('export_header_email')]: member.email,
                                        [_('export_header_transaction_date')]: p.date ? p.date.slice(0, 10) : '',
                                        [_('export_header_transaction_type')]: `${_('export_value_credit_purchase')} (${typeName})`,
                                        [_('export_header_description')]: _('export_desc_credits').replace('{count}', p.credits),
                                        [_('export_header_amount')]: p.amount,
                                        [_('export_header_modified_by')]: p.lastModifiedBy || '',
                                        [_('export_header_modified_date')]: p.lastModifiedAt ? p.lastModifiedAt.slice(0, 10) : ''
                                    });
                                });
                        }
                        if (member.paymentHistory) {
                            firebaseObjectToArray(member.paymentHistory).filter(p => p.status !== 'deleted').forEach(p => {
                                    const tierId = p.monthlyPlanTierId;
                                    const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                                    const tierName = getMonthlyPlanName(tier);
                                    exportData.push({
                                        [_('export_header_name')]: member.name,
                                        [_('export_header_email')]: member.email,
                                        [_('export_header_transaction_date')]: p.date ? p.date.slice(0, 10) : '',
                                        [_('export_header_transaction_type')]: `${_('export_value_monthly_payment')} (${tierName})`,
                                        [_('export_header_description')]: _('export_desc_months').replace('{count}', p.monthsPaid),
                                        [_('export_header_amount')]: p.amount,
                                        [_('export_header_modified_by')]: p.lastModifiedBy || '',
                                        [_('export_header_modified_date')]: p.lastModifiedAt ? p.lastModifiedAt.slice(0, 10) : ''
                                    });
                                });
                        }
                    });

                    exportData.sort((a, b) => {
                        const nameKey = _('export_header_name');
                        const dateKey = _('export_header_transaction_date');
                        const nameComparison = a[nameKey].localeCompare(b[nameKey]);
                        if (nameComparison !== 0) return nameComparison;
                        return new Date(a[dateKey]) - new Date(b[dateKey]);
                    });
                    
                    exportToCsv('member-financial-history', exportData);
                } catch (error) {
                    console.error("Error generating financial history export:", error);
                    showMessageBox(_('error_generate_financial_history_failed'), 'error');
                }
            };
        }
        
        // Tooltips logic
        let activeTooltip = null;
        const hideAllTooltips = () => {
            if (activeTooltip) {
                activeTooltip.classList.remove('tooltip-visible');
                activeTooltip = null;
            }
        };

        tableBody.addEventListener('mouseenter', (e) => {
            const cell = e.target.closest('td[data-tooltip-content]');
            if (!cell) return;
            hideAllTooltips();
            const tooltip = cell.querySelector('.member-tooltip');
            if (tooltip) {
                activeTooltip = tooltip;
                const cellRect = cell.getBoundingClientRect();
                const tooltipHeight = tooltip.offsetHeight;
                const viewportHeight = window.innerHeight;
                tooltip.style.left = `${cellRect.left + 8}px`;
                if (cellRect.bottom + tooltipHeight + 8 > viewportHeight) {
                    tooltip.style.top = `${cellRect.top - tooltipHeight - 8}px`;
                } else {
                    tooltip.style.top = `${cellRect.bottom + 8}px`;
                }
                tooltip.classList.add('tooltip-visible');
            }
        }, true);

        tableBody.addEventListener('mouseleave', (e) => {
            if (e.target.closest('td[data-tooltip-content]')) hideAllTooltips();
        }, true);
        
        updateTable();
        updateUIText(); 
    }

    function handleMemberDeletion(member) {
        const memberId = member.id;
        const updates = {};
        let upcomingCancellations = 0;

        // --- 1. Cancel all upcoming, non-attended bookings ---
        const memberBookings = appState.classes.filter(c => c.bookedBy && c.bookedBy[memberId]);
        memberBookings.forEach(cls => {
            const isAttended = cls.attendedBy && cls.attendedBy[memberId];
            if (!isAttended) {
                updates[`/classes/${cls.id}/bookedBy/${memberId}`] = null;
                updates[`/memberBookings/${memberId}/${cls.id}`] = null;
                upcomingCancellations++;
            }
        });

        // --- 2. Anonymize and Archive Personally Identifiable Information (PII) ---
        // Archive Name
        updates[`/users/${memberId}/name`] = 'Deleted Member';
        updates[`/users/${memberId}/originalName`] = member.name;

        // Archive Email
        updates[`/users/${memberId}/email`] = `deleted.${memberId}@fightingape.app`;
        updates[`/users/${memberId}/originalEmail`] = member.email;

        // Archive Phone
        updates[`/users/${memberId}/phone`] = ''; // Clear the active phone field
        updates[`/users/${memberId}/originalPhone`] = member.phone; // Archive it

        // --- 3. Finalize the user's account status ---
        updates[`/users/${memberId}/credits`] = 0;
        updates[`/users/${memberId}/isDeleted`] = true;
        
        // --- 4. Commit all changes to the database atomically ---
        database.ref().update(updates)
            .then(() => {
                showMessageBox(_('success_member_anonymized').replace('{name}', member.name).replace('{count}', upcomingCancellations), 'success');
            })
            .catch(error => {
                showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
            });
    }

    function _renderMemberPurchaseHistory(member, container, historyIdInput, purchaseAmountInput, creditsInput, onEditStart, creditTypeSelect, expiryDateInput) {
        container.innerHTML = ''; 
        const purchaseHistory = firebaseObjectToArray(member.purchaseHistory);
        
        if (purchaseHistory.length > 0) {
            const sortedHistory = purchaseHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            const totalCount = sortedHistory.length;
            const deletedCount = sortedHistory.filter(p => p.status === 'deleted').length;
            
            // --- NEW: Calculate Total Expense (Excluding Deleted) ---
            const totalExpense = sortedHistory
                .filter(p => p.status !== 'deleted')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            // --------------------------------------------------------

            let countsText = '';
            if (deletedCount > 0) {
                countsText = _('label_history_counts').replace('{total}', totalCount).replace('{deleted}', deletedCount);
            } else {
                countsText = _('label_history_counts_clean').replace('{total}', totalCount);
            }
            
            // --- UPDATED: Append Expense to Header ---
            const fullText = `${_('header_purchase_history')} - ${countsText} | ${_('label_total_expense')}: ${formatCurrency(totalExpense)}`;

            container.innerHTML = `<div class="text-xs text-slate-400 mb-2 text-right font-medium">${fullText}</div>` + sortedHistory.map(p => {
                const isDeleted = p.status === 'deleted';
                const costPerCreditText = p.costPerCredit ? _('label_cost_per_credit').replace('{cost}', formatCurrency(p.costPerCredit)) : _('label_na');
                const creditsUnit = p.credits === 1 ? _('label_credit_single') : _('label_credit_plural');
                
                const entryText = _('history_purchase_entry')
                    .replace('{amount}', formatCurrency(p.amount))
                    .replace('{quantity}', p.credits)
                    .replace('{unit}', creditsUnit);

                const typeId = p.creditTypeId || 'general';
                const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                const typeColor = typeDef?.color || '#64748b';

                const typePill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${typeColor}26; color: ${typeColor}">${typeName}</span>`;

                let auditMessage = '';
                if (p.lastModifiedBy) {
                    let actionKey = 'audit_edited_by';
                    if (isDeleted) { actionKey = 'audit_deleted_by'; } 
                    else if (p.date === p.lastModifiedAt) { actionKey = 'audit_added_by'; }
                    auditMessage = `<div class="text-[10px] text-slate-400 mt-1">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</div>`;
                }

                return `
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-md transition ${isDeleted ? 'opacity-50' : ''}" data-history-item-id="${p.id}">
                        <div class="flex-grow cursor-pointer hover:bg-slate-200 p-1 rounded-md">
                            <div class="flex flex-col">
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong>
                                <span class="text-sm text-slate-700">${entryText} ${typePill}</span>
                                <span class="text-xs text-slate-500">${costPerCreditText}</span>
                                ${auditMessage}
                            </div>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none ${isDeleted ? 'hidden' : ''}" data-history-id="${p.id}" title="Remove entry">×</button>
                    </div>`;
            }).join('');
        } else {
             container.innerHTML = `<p class="text-sm text-slate-500 text-center py-4">${_('no_purchase_history')}</p>`;
        }
        
        container.onclick = (e) => {
            const editTarget = e.target.closest('[data-history-item-id] .flex-grow');
            const removeTarget = e.target.closest('.remove-history-btn');

            container.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            
            if (removeTarget) {
                const historyId = removeTarget.dataset.historyId;
                const entryToUpdate = purchaseHistory.find(p => p.id === historyId);
                const memberId = member.id;
                if (entryToUpdate.status === 'deleted') {
                    showMessageBox(_('info_entry_already_deleted'), 'info');
                    return;
                }

                showConfirmation(
                    _('confirm_delete_purchase_title'), 
                    _('confirm_delete_purchase_desc').replace('{count}', entryToUpdate.credits), 
                    () => {
                    const updates = {};
                    updates[`/users/${memberId}/purchaseHistory/${historyId}/status`] = 'deleted';
                    updates[`/users/${memberId}/purchaseHistory/${historyId}/lastModifiedBy`] = appState.currentUser.name;
                    updates[`/users/${memberId}/purchaseHistory/${historyId}/lastModifiedAt`] = new Date().toISOString();

                    // --- CLEANUP LOGIC FOR DELETION ---
                    const typeId = entryToUpdate.creditTypeId || 'general';
                    const wallet = getMemberWallet(member);
                    const currentBalance = wallet[typeId]?.balance || 0;
                    const currentInitial = wallet[typeId]?.initialCredits || 0; 
                    
                    // FIX: Allow negative balance (Debt) calculation
                    // If they had 0 and we remove 1, they now have -1.
                    const newBalance = currentBalance - entryToUpdate.credits;
                    
                    // Initial credits logic: 
                    // We prevent Initial from going negative because "Total Purchased" concept can't be < 0.
                    const newInitial = Math.max(0, currentInitial - entryToUpdate.credits);

                    // If essentially empty (0/0), remove node.
                    // If debt exists (-1/0), keep node.
                    if (newBalance === 0 && newInitial === 0) {
                        updates[`/users/${memberId}/wallet/${typeId}`] = null;
                    } else {
                        updates[`/users/${memberId}/wallet/${typeId}/balance`] = newBalance;
                        updates[`/users/${memberId}/wallet/${typeId}/initialCredits`] = newInitial;
                    }
                    // ---------------------------------

                    database.ref().update(updates)
                        .then(() => {
                            database.ref(`/users/${memberId}`).once('value', snapshot => {
                                const updatedMember = { id: snapshot.key, ...snapshot.val() };
                                _renderMemberPurchaseHistory(updatedMember, container, historyIdInput, purchaseAmountInput, creditsInput, onEditStart, creditTypeSelect, expiryDateInput);
                                showMessageBox(_('info_purchase_entry_deleted'), 'info');
                            });
                        })
                        .catch(error => {
                            showMessageBox(_('error_deleting_entry').replace('{error}', error.message), 'error');
                        });
                });
            }
            else if (editTarget) {
                const parentItem = editTarget.closest('[data-history-item-id]');
                const id = parentItem.dataset.historyItemId;
                const historyEntry = purchaseHistory.find(p => p.id === id);
                
                if (historyEntry) {
                    purchaseAmountInput.value = historyEntry.amount;
                    creditsInput.value = historyEntry.credits;
                    historyIdInput.value = id;
                    
                    const typeId = historyEntry.creditTypeId || 'general';
                    if (creditTypeSelect) {
                        creditTypeSelect.value = typeId;
                    }

                    if (expiryDateInput) {
                        const wallet = getMemberWallet(member);
                        if (wallet[typeId] && wallet[typeId].expiryDate) {
                            // --- FIX: Force type='date' BEFORE setting value to prevent visual glitch ---
                            expiryDateInput.type = 'date'; 
                            expiryDateInput.value = wallet[typeId].expiryDate;
                        } else {
                            expiryDateInput.value = ''; 
                        }
                    }

                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(_('info_editing_purchase_from').replace('{date}', formatShortDateWithYear(historyEntry.date)), 'info');
                    onEditStart();
                }
            }
        };
    }
    
    function _renderMemberPaymentHistory(member, container, historyIdInput, monthsPaidInput, paymentAmountInput, onEditStart, monthlyTierSelect) {
        container.innerHTML = ''; 
        const paymentHistory = firebaseObjectToArray(member.paymentHistory);
        
        if (paymentHistory.length > 0) {
            const sortedHistory = paymentHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            const totalCount = sortedHistory.length;
            const deletedCount = sortedHistory.filter(p => p.status === 'deleted').length;
            
            // --- NEW: Calculate Total Expense (Excluding Deleted) ---
            const totalExpense = sortedHistory
                .filter(p => p.status !== 'deleted')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            // --------------------------------------------------------

            let countsText = '';
            if (deletedCount > 0) {
                countsText = _('label_history_counts').replace('{total}', totalCount).replace('{deleted}', deletedCount);
            } else {
                countsText = _('label_history_counts_clean').replace('{total}', totalCount);
            }

            // --- UPDATED: Append Expense to Header ---
            const fullText = `${_('header_payment_history')} - ${countsText} | ${_('label_total_expense')}: ${formatCurrency(totalExpense)}`;

            container.innerHTML = `<div class="text-xs text-slate-400 mb-2 text-right font-medium">${fullText}</div>` + sortedHistory.map(p => {
                const isDeleted = p.status === 'deleted';
                const monthUnit = p.monthsPaid === 1 ? _('label_month_singular') : _('label_month_plural');
                
                const entryText = _('history_payment_entry')
                    .replace('{amount}', formatCurrency(p.amount))
                    .replace('{quantity}', p.monthsPaid)
                    .replace('{unit}', monthUnit);

                // --- Monthly Tier Pill Logic ---
                const tierId = p.monthlyPlanTierId;
                const tier = appState.monthlyPlanTiers ? appState.monthlyPlanTiers.find(t => t.id === tierId) : null;
                let tierPill = '';
                
                if (tier) {
                    const name = getMonthlyPlanName(tier);
                    tierPill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${tier.color}26; color: ${tier.color}">${name}</span>`;
                }

                let auditMessage = '';
                if (p.lastModifiedBy) {
                    let actionKey = 'audit_edited_by';
                    if (isDeleted) { actionKey = 'audit_deleted_by'; }
                    else if (p.date === p.lastModifiedAt) { actionKey = 'audit_added_by'; }
                    auditMessage = `<span class="text-xs text-slate-500 mt-1">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</span>`;
                }

                return `
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-md transition ${isDeleted ? 'opacity-50' : ''}" data-history-item-id="${p.id}">
                        <div class="flex-grow cursor-pointer hover:bg-slate-200 p-1 rounded-md">
                            <div class="flex flex-col">
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong> 
                                <span class="text-sm text-slate-700">${entryText} ${tierPill}</span>
                                ${auditMessage}
                            </div>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none ${isDeleted ? 'hidden' : ''}" data-history-id="${p.id}" title="Remove entry">×</button>
                    </div>`;
            }).join('');
        } else {
             container.innerHTML = `<p class="text-sm text-slate-500 text-center">${_('no_payment_history')}</p>`;
        }

        container.onclick = (e) => {
            const editTarget = e.target.closest('[data-history-item-id] .flex-grow');
            const removeTarget = e.target.closest('.remove-history-btn');

            container.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            
            if (removeTarget) {
                const historyId = removeTarget.dataset.historyId;
                const entryToUpdate = paymentHistory.find(p => p.id === historyId);
                const memberId = member.id;

                if (entryToUpdate.status === 'deleted') {
                    showMessageBox(_('info_entry_already_deleted'), 'info');
                    return;
                }

                showConfirmation(
                    _('confirm_delete_payment_title'), 
                    _('confirm_delete_payment_desc'), 
                    () => {
                    const updates = {
                        status: 'deleted',
                        lastModifiedBy: appState.currentUser.name,
                        lastModifiedAt: new Date().toISOString()
                    };

                    database.ref(`/users/${memberId}/paymentHistory/${historyId}`).update(updates)
                        .then(() => {
                            database.ref(`/users/${memberId}`).once('value', snapshot => {
                                const updatedMember = { id: snapshot.key, ...snapshot.val() };
                                // Pass monthlyTierSelect here as well
                                _renderMemberPaymentHistory(updatedMember, container, historyIdInput, monthsPaidInput, paymentAmountInput, onEditStart, monthlyTierSelect);
                                showMessageBox(_('info_payment_entry_deleted'), 'info');
                            });
                        })
                        .catch(error => {
                            showMessageBox(_('error_deleting_entry').replace('{error}', error.message), 'error');
                        });
                });
            }
            else if (editTarget) {
                const parentItem = editTarget.closest('[data-history-item-id]');
                const id = parentItem.dataset.historyItemId;
                const historyEntry = paymentHistory.find(p => p.id === id);
                if (historyEntry) {
                    monthsPaidInput.value = historyEntry.monthsPaid;
                    monthsPaidInput.dispatchEvent(new Event('input'));
                    historyIdInput.value = id;
                    
                    // --- UPDATE DROPDOWN TO MATCH HISTORY ---
                    if (monthlyTierSelect) {
                        monthlyTierSelect.value = historyEntry.monthlyPlanTierId || "";
                    }
                    
                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(_('info_editing_payment_from').replace('{date}', formatShortDateWithYear(historyEntry.date)), 'info');
                    onEditStart();
                }
            }
        };
    }

    function openMemberModal(memberToEdit) {
        // --- 1. Construct HTML ---
        DOMElements.memberModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="memberModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">${_('title_edit_member')}</h2>
                <form id="memberForm" class="space-y-4">
                    <input type="hidden" id="memberModalId">
                    <input type="hidden" id="purchaseHistoryId">
                    <input type="hidden" id="paymentHistoryId">
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberName" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_member_name')}</label><input type="text" id="memberName" required class="form-input" placeholder="${_('placeholder_name')}"></div>
                        <div><label for="memberEmail" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_email_address')}</label><input type="email" id="memberEmail" required class="form-input" disabled></div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="memberPhone" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_mobile_number')}</label>
                            <div class="flex gap-2">
                                <input type="text" id="memberCountryCode" class="form-input w-24" placeholder="${_('placeholder_country_code')}">
                                <input type="tel" id="memberPhone" required class="form-input flex-grow" placeholder="${_('placeholder_phone')}">
                            </div>
                        </div>
                        <div><label class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_password')}</label><button type="button" id="resetPasswordBtn" class="form-input text-left text-indigo-600 hover:bg-slate-100">${_('label_reset_password')}</button></div>
                    </div>

                    <!-- NEW: Home Branch Select (Hidden by default, shown if branches > 1) -->
                    <div id="memberBranchContainer" class="hidden">
                        <label for="memberBranchSelect" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_home_branch')}</label>
                        <select id="memberBranchSelect" class="form-select w-full"></select>
                    </div>

                    <div class="mb-4">
                        <label for="adminNotes" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_admin_notes')}</label>
                        <textarea id="adminNotes" class="form-input w-full" rows="3" placeholder="${_('placeholder_admin_notes')}"></textarea>
                    </div>
                    <div class="pt-4 border-t">
                        <!-- VIEW SETTINGS LABEL -->
                        <label class="block text-slate-600 text-sm font-bold mb-2">${_('label_view_settings') || 'View Settings'}</label>
                        
                        <!-- Segmented Control (View Switcher Only) -->
                        <div class="flex bg-slate-100 p-1 rounded-lg mb-4 select-none">
                            <button type="button" id="btnPlanCredit" class="flex-1 py-2 text-sm font-semibold rounded-md transition-all">${_('label_credit_plan') || 'Credit Plan'}</button>
                            <button type="button" id="btnPlanMonthly" class="flex-1 py-2 text-sm font-semibold rounded-md transition-all">${_('label_monthly_plan')}</button>
                        </div>
                        
                        <!-- CREDIT FIELDS SECTION -->
                        <div id="creditFields" class="space-y-4">
                            <!-- Credit Type Dropdown -->
                            <div>
                                <label for="creditTypeSelect" data-lang-key="label_credit_type" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                <select id="creditTypeSelect" class="form-select w-full"></select>
                            </div>

                            <div class="flex items-end gap-2">
                                <div class="flex-grow"><label for="purchaseAmount" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_top_up_amount')}</label><input type="number" id="purchaseAmount" class="form-input" min="0" placeholder="${_('placeholder_eg_800')}"></div>
                                <div class="flex-grow"><label for="creditsToAdd" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_credits_to_add_edit')}</label><input type="number" id="creditsToAdd" class="form-input" min="0" placeholder="${_('placeholder_eg_10')}"></div>
                            </div>
                            
                            <!-- Expiry Date Section -->
                            <div>
                                <label for="expiryDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_expiry_date')}</label>
                                <div class="flex gap-2 mb-2">
                                    <button type="button" data-years="1" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_1_year')}</button>
                                    <button type="button" data-years="2" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_2_years')}</button>
                                    <button type="button" data-years="3" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_3_years')}</button>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="date" id="expiryDate" class="form-input flex-grow">
                                    <button type="button" id="creditActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                    <button type="button" id="cancelCreditEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">${_('btn_cancel')}</button>
                                </div>
                            </div>

                            <div id="purchaseHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1 mt-2"></div>
                        </div>

                        <!-- MONTHLY PLAN FIELDS -->
                        <div id="monthlyPlanFields" class="hidden space-y-4">
                            <!-- Standard Tailwind Toggle for Active Subscription -->
                            <div class="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4">
                                <label class="relative inline-flex items-center cursor-pointer w-full">
                                    <input type="checkbox" id="enableMonthlySubscription" class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    <span class="ml-3 text-sm font-bold text-slate-700 flex-grow">${_('label_enable_subscription') || 'Enable Monthly Subscription'}</span>
                                </label>
                            </div>

                            <div id="monthlyInputsContainer" class="space-y-4 transition-opacity duration-300">
                                <!-- Monthly Plan Tier Dropdown -->
                                <div>
                                    <label for="monthlyTierSelect" data-lang-key="label_monthly_tier" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                    <select id="monthlyTierSelect" class="form-select w-full"></select>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label for="planStartDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_plan_start_date')}</label>
                                        <input type="date" id="planStartDate" class="form-input">
                                    </div>
                                    <div>
                                        <label for="monthlyPlanAmount" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_monthly_amount')}</label>
                                        <input type="number" id="monthlyPlanAmount" class="form-input" min="0">
                                    </div>
                                </div>

                                <div class="space-y-4">
                                    <!-- Payment Inputs -->
                                    <div class="flex items-end gap-2">
                                        <div class="flex-grow">
                                            <label for="monthsPaid" class="block text-slate-600 text-sm font-semibold mb-1">${_('label_months_paid')}</label>
                                            <input type="number" id="monthsPaid" class="form-input" min="1" step="1" placeholder="${_('placeholder_eg_1')}">
                                        </div>
                                        <div class="flex-grow">
                                            <label for="paymentAmount" class="block text-slate-600 text-sm font-semibold mb-1">${_('label_payment_amount')}</label>
                                            <input type="number" id="paymentAmount" class="form-input" min="0" step="0.01" placeholder="${_('placeholder_eg_1500')}">
                                        </div>
                                    </div>

                                    <!-- Quick Selects -->
                                    <div class="flex gap-2">
                                        <button type="button" data-months="3" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_3_months')}</button>
                                        <button type="button" data-months="6" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_6_months')}</button>
                                        <button type="button" data-months="12" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_1_year')}</button>
                                    </div>

                                    <!-- Due Date / Attendance / Buttons -->
                                    <div class="flex items-end gap-2">
                                        <div class="flex-1">
                                            <label for="paymentDueDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_payment_due_date')}</label>
                                            <input type="date" id="paymentDueDate" class="form-input w-full">
                                        </div>
                                        <div class="flex-1">
                                            <label for="monthlyPlanEstimatedAttendance" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_est_monthly_attendance')}</label>
                                            <input type="number" id="monthlyPlanEstimatedAttendance" class="form-input w-full" min="1" step="1" placeholder="e.g., 8">
                                        </div>
                                        <button type="button" id="paymentActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                        <button type="button" id="cancelPaymentEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">${_('btn_cancel')}</button>
                                    </div>

                                    <!-- History -->
                                    <div id="paymentHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1 mt-2"></div>
                                </div>
                                
                                <div id="calculatedCreditValueContainer" class="bg-slate-100 p-3 rounded-lg text-center mt-4">
                                    <p class="text-sm text-slate-500">${_('label_calculated_credit_value')}</p>
                                    <p id="calculatedCreditValueDisplay" class="text-xl font-bold text-indigo-600"></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">${_('btn_save_changes')}</button></div>
                </form>
            </div>`;
        
        const modal = DOMElements.memberModal;
        const form = modal.querySelector('form');
        const submitBtn = form.querySelector('.submit-btn');

        // Inputs
        const purchaseAmountInput = form.querySelector('#purchaseAmount');
        const creditsInput = form.querySelector('#creditsToAdd');
        const creditTypeSelect = form.querySelector('#creditTypeSelect'); 
        const memberCountryCodeInput = form.querySelector('#memberCountryCode');
        const memberPhoneInput = form.querySelector('#memberPhone');
        const expiryDateInput = form.querySelector('#expiryDate');
        const planStartDateInput = form.querySelector('#planStartDate');
        const paymentDueDateInput = form.querySelector('#paymentDueDate');
        const historyContainer = form.querySelector('#purchaseHistoryContainer');
        const historyIdInput = form.querySelector('#purchaseHistoryId');
        const creditActionBtn = form.querySelector('#creditActionBtn');
        const cancelCreditEditBtn = form.querySelector('#cancelCreditEditBtn');

        const paymentHistoryContainer = form.querySelector('#paymentHistoryContainer');
        const paymentHistoryIdInput = form.querySelector('#paymentHistoryId');
        const monthsPaidInput = form.querySelector('#monthsPaid');
        const paymentAmountInput = form.querySelector('#paymentAmount');
        const paymentActionBtn = form.querySelector('#paymentActionBtn');
        const cancelPaymentEditBtn = form.querySelector('#cancelPaymentEditBtn');
        const monthlyPlanAmountInput = form.querySelector('#monthlyPlanAmount');
        const estimatedAttendanceInput = form.querySelector('#monthlyPlanEstimatedAttendance');
        
        const calculatedCreditValueContainer = form.querySelector('#calculatedCreditValueContainer');
        const calculatedCreditValueDisplay = form.querySelector('#calculatedCreditValueDisplay');
        
        const monthlyTierSelect = form.querySelector('#monthlyTierSelect');
        const enableMonthlyCheckbox = form.querySelector('#enableMonthlySubscription');
        const monthlyInputsContainer = form.querySelector('#monthlyInputsContainer');

        // --- NEW: Branch Select Logic ---
        const memberBranchSelect = form.querySelector('#memberBranchSelect');
        const memberBranchContainer = form.querySelector('#memberBranchContainer');
        const branches = appState.branches || [];

        if (branches.length > 1) {
            memberBranchContainer.classList.remove('hidden');
            let branchOptions = `<option value="" disabled>${_('placeholder_select_branch')}</option>`;
            branches.forEach(b => {
                // Localization Logic
                const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                branchOptions += `<option value="${b.id}">${bName}</option>`;
            });
            memberBranchSelect.innerHTML = branchOptions;
            
            // Pre-select current
            if (memberToEdit.homeBranchId) {
                memberBranchSelect.value = memberToEdit.homeBranchId;
            } else {
                // Default to first branch if none selected, or leave empty
                memberBranchSelect.value = branches[0].id;
            }
        } else {
            memberBranchContainer.classList.add('hidden');
        }
        // --------------------------------

        const monthlyTiers = appState.monthlyPlanTiers || [];
        const hasLegacyMembers = appState.users.some(u => u.role === 'member' && !u.isDeleted && u.monthlyPlan && !u.monthlyPlanTierId);
        const showLegacyOption = hasLegacyMembers || (memberToEdit.monthlyPlan && !memberToEdit.monthlyPlanTierId);

        // Responsive Date Helpers (iOS Fix)
        const setupResponsiveDateInput = (input) => {
            const refreshType = () => {
                if (input.value) { input.type = 'date'; } else { input.type = 'text'; input.placeholder = 'dd/mm/yyyy'; }
            };
            input.addEventListener('focus', () => { input.type = 'date'; });
            input.addEventListener('blur', refreshType);
            refreshType();
            return refreshType;
        };
        const updateExpiryUI = setupResponsiveDateInput(expiryDateInput);
        const updatePlanStartUI = setupResponsiveDateInput(planStartDateInput);
        const updatePaymentDueUI = setupResponsiveDateInput(paymentDueDateInput);

        // Tier Dropdown
        let tierOptionsHTML = `<option value="" disabled selected>${_('placeholder_select_monthly_tier')}</option>`;
        if (showLegacyOption) { tierOptionsHTML += `<option value="" data-is-legacy="true">${_('label_legacy_tier')}</option>`; }
        if (monthlyTiers.length > 0) { tierOptionsHTML += monthlyTiers.map(t => `<option value="${t.id}">${getMonthlyPlanName(t)}</option>`).join(''); }
        monthlyTierSelect.innerHTML = tierOptionsHTML;
        if (monthlyTiers.length === 0) monthlyTierSelect.parentElement.classList.add('hidden');
        
        if (memberToEdit.monthlyPlanTierId) {
            monthlyTierSelect.value = memberToEdit.monthlyPlanTierId;
        } else if (showLegacyOption) {
            const legacyOpt = monthlyTierSelect.querySelector('option[data-is-legacy="true"]');
            if (legacyOpt) legacyOpt.selected = true;
        }

        monthlyTierSelect.onchange = () => {
            // "Gatekeeper" Logic:
            // When a tier is selected/changed, assume the user might want to add a payment entry.
            // Lock the main form to prevent accidental saves before the transaction is handled.
            if (monthlyTierSelect.value) {
                // Disable the main modal "Save Changes" button
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

                // Show the "Cancel" button next to the payment "+" button
                cancelPaymentEditBtn.classList.remove('hidden');
            }
        };

        // Credit Type Dropdown
        const creditTypes = appState.creditTypes || [];
        let optionsHTML = `<option value="" disabled selected>${_('placeholder_select_credit_type')}</option>`;
        const hasGeneralCredits = appState.users.some(u => !u.isDeleted && ((u.credits !== undefined && u.credits > 0) || (u.wallet?.general?.balance > 0)));
        const memberHasGeneral = memberToEdit.credits !== undefined || memberToEdit.wallet?.general;
        if (hasGeneralCredits || memberHasGeneral) { optionsHTML += `<option value="general">${_('label_general_credits_default')}</option>`; }
        if (creditTypes.length > 0) { optionsHTML += creditTypes.map(ct => `<option value="${ct.id}">${getCreditTypeName(ct)}</option>`).join(''); }
        creditTypeSelect.innerHTML = optionsHTML;

        // Quick Select Buttons
        form.querySelectorAll('.expiry-quick-select-btn').forEach(btn => {
            btn.onclick = () => {
                const yearsToAdd = parseInt(btn.dataset.years);
                if (!isNaN(yearsToAdd)) {
                    const today = new Date(); today.setFullYear(today.getFullYear() + yearsToAdd);
                    expiryDateInput.value = getIsoDate(today); updateExpiryUI();
                }
            };
        });
        form.querySelectorAll('.due-date-quick-select-btn').forEach(btn => {
            btn.onclick = () => {
                const planStartDateString = planStartDateInput.value;
                const baseDateString = memberToEdit.paymentDueDate || planStartDateString;
                if (!baseDateString) { showMessageBox(_('info_set_plan_start_date_first'), 'info'); return; }
                const baseDate = new Date(baseDateString + 'T12:00:00Z');
                if (isNaN(baseDate.getTime())) { showMessageBox(_('error_invalid_base_date'), 'error'); return; }
                const monthsToAdd = parseInt(btn.dataset.months);
                if (!isNaN(monthsToAdd)) {
                    const newDueDate = new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + monthsToAdd, baseDate.getUTCDate());
                    paymentDueDateInput.value = getIsoDate(newDueDate); updatePaymentDueUI();
                }
            };
        });

        const plusIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>`;
        const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;

        // Helpers for Credit/Payment Actions
        const setCreditButtonToAddMode = () => {
            creditActionBtn.innerHTML = plusIconSVG; creditActionBtn.title = _('tooltip_add_entry');
            creditActionBtn.className = 'creditActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            purchaseAmountInput.value = ''; creditsInput.value = ''; historyIdInput.value = ''; expiryDateInput.value = ''; updateExpiryUI();
            creditTypeSelect.value = ""; creditTypeSelect.disabled = false;
            historyContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelCreditEditBtn.classList.add('hidden'); submitBtn.disabled = false; submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        };
        const setCreditButtonToEditMode = () => {
            creditActionBtn.innerHTML = checkIconSVG; creditActionBtn.title = _('tooltip_save_entry');
            creditActionBtn.className = 'creditActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelCreditEditBtn.classList.remove('hidden'); creditTypeSelect.disabled = false; submitBtn.disabled = true; submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        };
        setCreditButtonToAddMode(); cancelCreditEditBtn.onclick = setCreditButtonToAddMode;

        // --- HELPER: Refresh Member Data after Credit Update ---
        const refreshMemberData = () => {
            const currentTypeId = creditTypeSelect.value;

            database.ref(`/users/${memberToEdit.id}`).once('value', snapshot => {
                // 1. Update the local member object with fresh data from DB
                memberToEdit = { id: snapshot.key, ...snapshot.val() };

                // 2. Re-render the Purchase History List with new data
                _renderMemberPurchaseHistory(
                    memberToEdit,
                    historyContainer,
                    historyIdInput,
                    purchaseAmountInput,
                    creditsInput,
                    setCreditButtonToEditMode,
                    creditTypeSelect,
                    expiryDateInput
                );

                // 3. Reset the form inputs to "Add" mode
                setCreditButtonToAddMode();

                // 4. Update the Expiry Date input to reflect the new wallet state
                if (currentTypeId) {
                    creditTypeSelect.value = currentTypeId;
                    const updatedWallet = getMemberWallet(memberToEdit);
                    
                    if (updatedWallet[currentTypeId] && updatedWallet[currentTypeId].expiryDate) {
                        expiryDateInput.value = updatedWallet[currentTypeId].expiryDate;
                        updateExpiryUI(); 
                    }
                }
            });
        };

        // --- Credit Action Handler (Use existing logic) ---
        // (Existing Credit Transaction Logic embedded here is unchanged, omitted for brevity but part of function)
        creditActionBtn.onclick = async () => {
             const historyId = historyIdInput.value;
             let memberId = memberToEdit.id; 
             const amount = parseFloat(purchaseAmountInput.value);
             const credits = parseFloat(creditsInput.value);
             const selectedTypeId = creditTypeSelect.value;
             const expiryDate = expiryDateInput.value;

             if (!selectedTypeId) {
                 showMessageBox(_('error_select_credit_type'), 'error');
                 return;
             }

             if (isNaN(amount) || isNaN(credits) || amount < 0 || credits < 0) { 
                 showMessageBox(_('error_invalid_amount_and_credits'), 'error'); 
                 return; 
             }
             if (!expiryDate) {
                 showMessageBox(_('error_expiry_date_required'), 'error');
                 return;
             }

             creditActionBtn.disabled = true;
             const originalBtnContent = creditActionBtn.innerHTML;
             creditActionBtn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

             try {
                 const snapshot = await database.ref(`/users/${memberId}`).once('value');
                 const freshMember = { id: snapshot.key, ...snapshot.val() };
                 const wallet = getMemberWallet(freshMember);
                 const freshPurchaseHistory = firebaseObjectToArray(freshMember.purchaseHistory);

                 // --- FIX: SEPARATE PAYLOAD TO PRESERVE ORIGINAL DATE ON EDIT ---
                 const basePurchaseData = { 
                     amount, 
                     credits, 
                     creditTypeId: selectedTypeId, 
                     costPerCredit: credits > 0 ? amount / credits : 0, 
                     status: 'active', 
                     lastModifiedBy: appState.currentUser.name, 
                     lastModifiedAt: new Date().toISOString() 
                 };
                 const updates = {};

                 if(historyId) {
                     // --- UPDATE MODE ---
                     const originalEntry = freshPurchaseHistory.find(p => p.id === historyId);
                     if (!originalEntry || originalEntry.status === 'deleted') { 
                         throw new Error("This entry no longer exists or was deleted."); 
                     }
                     const oldTypeId = originalEntry.creditTypeId || 'general';
                     const newTypeId = selectedTypeId;
                     const originalEntryCredits = parseFloat(originalEntry.credits || 0);
                     
                     // Preserve original transaction date
                     updates[`/users/${memberId}/purchaseHistory/${historyId}`] = { ...originalEntry, ...basePurchaseData }; 

                     if (oldTypeId === newTypeId) {
                        const currentWallet = wallet[oldTypeId] || { balance: 0, initialCredits: 0 };
                        const currentBal = parseFloat(currentWallet.balance || 0);
                        const currentInit = parseFloat(currentWallet.initialCredits !== undefined ? currentWallet.initialCredits : currentBal);
                        const diff = credits - originalEntryCredits;
                        
                        updates[`/users/${memberId}/wallet/${oldTypeId}/balance`] = currentBal + diff;
                        updates[`/users/${memberId}/wallet/${oldTypeId}/initialCredits`] = currentInit + diff;
                        updates[`/users/${memberId}/wallet/${oldTypeId}/expiryDate`] = expiryDate;
                     } else {
                        const oldWallet = wallet[oldTypeId] || { balance: 0, initialCredits: 0 };
                        const newWallet = wallet[newTypeId] || { balance: 0, initialCredits: 0 };
                        const oldBal = parseFloat(oldWallet.balance || 0);
                        const oldInit = parseFloat(oldWallet.initialCredits !== undefined ? oldWallet.initialCredits : oldBal);
                        const newBal = parseFloat(newWallet.balance || 0);
                        const newInit = parseFloat(newWallet.initialCredits !== undefined ? newWallet.initialCredits : newBal);

                        const theoreticalOldBal = oldBal - originalEntryCredits;
                        const usedCreditsDeficit = theoreticalOldBal < 0 ? Math.abs(theoreticalOldBal) : 0;
                        const finalOldBal = Math.max(0, theoreticalOldBal);
                        const finalOldInit = Math.max(0, oldInit - originalEntryCredits);
                        
                        if (finalOldBal === 0 && finalOldInit === 0) {
                            updates[`/users/${memberId}/wallet/${oldTypeId}`] = null;
                        } else {
                            updates[`/users/${memberId}/wallet/${oldTypeId}/balance`] = finalOldBal;
                            updates[`/users/${memberId}/wallet/${oldTypeId}/initialCredits`] = finalOldInit;
                        }

                        const finalNewBal = Math.max(0, newBal + credits - usedCreditsDeficit);
                        const finalNewInit = (newBal === 0 && newInit === 0) ? credits : (newInit + credits);

                        updates[`/users/${memberId}/wallet/${newTypeId}/balance`] = finalNewBal;
                        updates[`/users/${memberId}/wallet/${newTypeId}/initialCredits`] = finalNewInit;
                        updates[`/users/${memberId}/wallet/${newTypeId}/expiryDate`] = expiryDate;
                     }
                 } else { 
                     // --- CREATE MODE ---
                     const newRef = database.ref(`/users/${memberId}/purchaseHistory`).push();
                     // Add new transaction date
                     updates[`/users/${memberId}/purchaseHistory/${newRef.key}`] = { ...basePurchaseData, date: new Date().toISOString() };
                     
                     const targetWallet = wallet[selectedTypeId] || { balance: 0, initialCredits: 0 };
                     const currentBalance = parseFloat(targetWallet.balance || 0);
                     const currentInitial = parseFloat(targetWallet.initialCredits !== undefined ? targetWallet.initialCredits : currentBalance);
                     updates[`/users/${memberId}/wallet/${selectedTypeId}/balance`] = currentBalance + credits;
                     updates[`/users/${memberId}/wallet/${selectedTypeId}/initialCredits`] = (currentBalance === 0 ? credits : currentInitial + credits);
                     updates[`/users/${memberId}/wallet/${selectedTypeId}/expiryDate`] = expiryDate;
                 }
                 
                 if (freshMember.credits !== undefined) {
                     updates[`/users/${memberId}/credits`] = null;
                     updates[`/users/${memberId}/initialCredits`] = null;
                     updates[`/users/${memberId}/expiryDate`] = null;
                 }

                 await database.ref().update(updates);
                 showMessageBox(historyId ? _('success_purchase_entry_updated') : _('success_credit_entry_added'), 'success');
                 refreshMemberData(); 
             } catch (error) {
                 console.error("Transaction Error:", error);
                 showMessageBox(_('error_update_failed').replace('{error}', error.message), 'error');
             } finally {
                 creditActionBtn.innerHTML = originalBtnContent;
                 creditActionBtn.disabled = false;
             }
        };

        const autoCalculatePayment = () => {
            const months = parseInt(monthsPaidInput.value) || 0;
            const monthlyAmount = parseFloat(monthlyPlanAmountInput.value) || 0;
            paymentAmountInput.value = (months * monthlyAmount).toFixed(2);
        };
        monthsPaidInput.oninput = autoCalculatePayment; monthlyPlanAmountInput.addEventListener('input', autoCalculatePayment);

        const setPaymentButtonToAddMode = () => {
            paymentActionBtn.innerHTML = plusIconSVG; paymentActionBtn.title = _('tooltip_add_entry');
            paymentActionBtn.className = 'paymentActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            monthsPaidInput.value = ''; paymentAmountInput.value = ''; paymentHistoryIdInput.value = '';
            paymentHistoryContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelPaymentEditBtn.classList.add('hidden'); submitBtn.disabled = false; submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        };
        const setPaymentButtonToEditMode = () => {
            paymentActionBtn.innerHTML = checkIconSVG; paymentActionBtn.title = _('tooltip_save_entry');
            paymentActionBtn.className = 'paymentActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelPaymentEditBtn.classList.remove('hidden'); submitBtn.disabled = true; submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        };
        setPaymentButtonToAddMode(); cancelPaymentEditBtn.onclick = setPaymentButtonToAddMode;

        paymentActionBtn.onclick = () => {
            const historyId = paymentHistoryIdInput.value;
            const memberId = memberToEdit.id;
            const monthsPaid = parseInt(monthsPaidInput.value);
            const amount = parseFloat(paymentAmountInput.value);
            const currentTierId = monthlyTierSelect.value || null;
            if (isNaN(monthsPaid) || monthsPaid <= 0) { showMessageBox(_('error_months_paid_invalid'), 'error'); return; }
            if ((parseFloat(monthlyPlanAmountInput.value) || 0) <= 0) { showMessageBox(_('error_monthly_amount_required'), 'error'); return; }
            if (isNaN(amount) || amount < 0) { showMessageBox(_('error_payment_amount_invalid'), 'error'); return; }
            const entryData = { monthsPaid, amount, monthlyPlanTierId: currentTierId, lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
            if (historyId) {
                database.ref(`/users/${memberId}/paymentHistory/${historyId}`).update(entryData).then(() => {
                    showMessageBox(_('success_payment_entry_updated'), 'success');
                    database.ref(`/users/${memberId}`).once('value', s => { memberToEdit = {id:s.key,...s.val()}; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode, monthlyTierSelect); setPaymentButtonToAddMode(); });
                }).catch(e => showMessageBox(e.message, 'error'));
            } else {
                database.ref(`/users/${memberId}/paymentHistory`).push({...entryData, date: new Date().toISOString(), status: 'active'}).then(() => {
                    showMessageBox(_('success_payment_entry_added'), 'success');
                    database.ref(`/users/${memberId}`).once('value', s => { memberToEdit = {id:s.key,...s.val()}; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode, monthlyTierSelect); setPaymentButtonToAddMode(); });
                }).catch(e => showMessageBox(e.message, 'error'));
            }
        };

        // Populate Form
        form.querySelector('#memberModalId').value = memberToEdit.id;
        form.querySelector('#memberName').value = memberToEdit.name;
        form.querySelector('#memberEmail').value = memberToEdit.email;
        const { countryCode, number } = parsePhoneNumber(memberToEdit.phone);
        memberCountryCodeInput.value = countryCode; memberPhoneInput.value = number;
        form.querySelector('#adminNotes').value = memberToEdit.notes || '';

        // Wallet Logic - MODIFIED TO PREVENT AUTO-FILL
        const wallet = getMemberWallet(memberToEdit);
        
        // Always reset to empty on load so user must select manually (to add) or select history (to edit)
        creditTypeSelect.value = ""; 
        expiryDateInput.value = ""; 
        updateExpiryUI();

        creditTypeSelect.onchange = () => {
            const typeId = creditTypeSelect.value;

            // 1. Handle Expiry Date Pre-fill (Existing Logic)
            if (wallet[typeId] && wallet[typeId].expiryDate) {
                expiryDateInput.value = wallet[typeId].expiryDate;
            } else {
                expiryDateInput.value = "";
            }
            updateExpiryUI();

            // 2. NEW: Gatekeeper Logic
            // If a valid type is selected, lock the main form and show the Cancel option
            if (typeId) {
                // Disable the main modal "Save Changes" button
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

                // Show the "Cancel" button next to the "+" button
                // This allows the user to abort the addition and re-enable the main Save button
                cancelCreditEditBtn.classList.remove('hidden');
            } else {
                // If they somehow selected the placeholder (empty), reset state
                setCreditButtonToAddMode();
            }
        };

        // Monthly Plan Logic (HYBRID)
        enableMonthlyCheckbox.checked = !!memberToEdit.monthlyPlan;
        const toggleMonthlyInputs = () => {
            if (enableMonthlyCheckbox.checked) {
                monthlyInputsContainer.classList.remove('opacity-50', 'pointer-events-none');
                if (!planStartDateInput.value) { planStartDateInput.value = getIsoDate(new Date()); updatePlanStartUI(); }
            } else {
                monthlyInputsContainer.classList.add('opacity-50', 'pointer-events-none');
            }
        };
        enableMonthlyCheckbox.onchange = toggleMonthlyInputs;
        
        paymentDueDateInput.value = memberToEdit.paymentDueDate || ''; updatePaymentDueUI();
        monthlyPlanAmountInput.value = memberToEdit.monthlyPlanAmount || '';
        planStartDateInput.value = memberToEdit.planStartDate || ''; updatePlanStartUI();
        const defaults = appState.studioSettings.clsDefaults || {};
        estimatedAttendanceInput.value = memberToEdit.monthlyPlanEstimatedAttendance || defaults.defaultEstAttendance || '';
        
        // Calculated Value Logic
        const updateCalculatedValue = () => {
            const amount = parseFloat(monthlyPlanAmountInput.value) || 0;
            const attendance = parseInt(estimatedAttendanceInput.value) || 0;
            if (amount > 0 && attendance > 0) {
                const perCreditText = `${formatCurrency(amount / attendance)} ${_('label_per_credit')}`;
                calculatedCreditValueDisplay.textContent = perCreditText;
                calculatedCreditValueContainer.classList.remove('hidden');
            } else {
                calculatedCreditValueContainer.classList.add('hidden');
            }
        };
        
        monthlyPlanAmountInput.addEventListener('input', updateCalculatedValue);
        estimatedAttendanceInput.addEventListener('input', updateCalculatedValue);
        updateCalculatedValue();

        toggleMonthlyInputs(); 

        _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode, creditTypeSelect, expiryDateInput);
        _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode, monthlyTierSelect);

        // View Switcher Logic (Tabs)
        const btnPlanCredit = form.querySelector('#btnPlanCredit');
        const btnPlanMonthly = form.querySelector('#btnPlanMonthly');
        const creditFieldsContainer = form.querySelector('#creditFields');
        const monthlyPlanFieldsContainer = form.querySelector('#monthlyPlanFields');

        const switchToCreditView = () => {
            btnPlanCredit.className = "flex-1 py-2 text-sm font-semibold rounded-md transition-all bg-white text-indigo-600 shadow-sm";
            btnPlanMonthly.className = "flex-1 py-2 text-sm font-semibold rounded-md transition-all text-slate-500 hover:text-slate-700";
            creditFieldsContainer.style.display = 'block';
            monthlyPlanFieldsContainer.style.display = 'none';
        };
        const switchToMonthlyView = () => {
            btnPlanCredit.className = "flex-1 py-2 text-sm font-semibold rounded-md transition-all text-slate-500 hover:text-slate-700";
            btnPlanMonthly.className = "flex-1 py-2 text-sm font-semibold rounded-md transition-all bg-white text-indigo-600 shadow-sm";
            creditFieldsContainer.style.display = 'none';
            monthlyPlanFieldsContainer.style.display = 'block';
        };

        btnPlanCredit.onclick = switchToCreditView;
        btnPlanMonthly.onclick = switchToMonthlyView;
        if (memberToEdit.monthlyPlan) switchToMonthlyView(); else switchToCreditView();

        form.onsubmit = (e) => handleMemberFormSubmit(e, memberToEdit);
        openModal(DOMElements.memberModal);
        updateUIText();
    }

    async function handleMemberFormSubmit(e, originalMember) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#memberModalId').value;
        if (!id) return;

        // Hybrid Logic: Check specific toggle, not the segmented button
        const isMonthlyActive = form.querySelector('#enableMonthlySubscription').checked;

        let monthlyPlanAmount = 0;
        let estimatedAttendance = 0;
        let calculatedCreditValue = 0;

        if (isMonthlyActive) {
            monthlyPlanAmount = parseFloat(form.querySelector('#monthlyPlanAmount').value) || 0;
            estimatedAttendance = parseInt(form.querySelector('#monthlyPlanEstimatedAttendance').value) || 0;

            if (monthlyPlanAmount > 0 && estimatedAttendance <= 0) {
                showMessageBox(_('error_est_attendance_required'), 'error');
                return; 
            }

            if (estimatedAttendance > 0) {
                calculatedCreditValue = monthlyPlanAmount / estimatedAttendance;
            }
        } 
        
        const countryCode = form.querySelector('#memberCountryCode').value.trim();
        const phoneNumber = form.querySelector('#memberPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);

        // Capture New Tier ID
        const newTierId = form.querySelector('#monthlyTierSelect').value || null;

        // --- NEW: Capture Branch ID ---
        const newBranchId = form.querySelector('#memberBranchSelect').value || null;

        // Prepare Updates Object
        let updates = {};
        updates[`/users/${id}/name`] = form.querySelector('#memberName').value;
        updates[`/users/${id}/phone`] = fullPhoneNumber;
        const notesValue = form.querySelector('#adminNotes').value.trim();
        updates[`/users/${id}/notes`] = notesValue || null; // Stores null if empty
        updates[`/users/${id}/homeBranchId`] = newBranchId; // Save Branch
        
        // Monthly Plan Updates (Hybrid: These exist alongside wallet)
        updates[`/users/${id}/monthlyPlan`] = isMonthlyActive;
        updates[`/users/${id}/monthlyPlanAmount`] = isMonthlyActive ? monthlyPlanAmount : null;
        updates[`/users/${id}/planStartDate`] = isMonthlyActive ? form.querySelector('#planStartDate').value : null;
        updates[`/users/${id}/paymentDueDate`] = isMonthlyActive ? form.querySelector('#paymentDueDate').value || null : null;
        updates[`/users/${id}/monthlyPlanEstimatedAttendance`] = isMonthlyActive ? estimatedAttendance : null;
        updates[`/users/${id}/monthlyCreditValue`] = isMonthlyActive ? calculatedCreditValue : null;
        updates[`/users/${id}/monthlyPlanTierId`] = isMonthlyActive ? newTierId : null;

        // Wallet Expiry Update (Always check, regardless of Monthly status)
        const selectedTypeId = form.querySelector('#creditTypeSelect').value;
        const newExpiryDate = form.querySelector('#expiryDate').value;
        
        // Ensure legacy fields are cleaned up if moving to wallet
        updates[`/users/${id}/expiryDate`] = null;

        if (selectedTypeId) {
            // Update the specific wallet's expiry date
            updates[`/users/${id}/wallet/${selectedTypeId}/expiryDate`] = newExpiryDate || null;
        }

        const executeDatabaseUpdate = () => {
            database.ref().update(updates).then(() => {
                showMessageBox(_('success_member_updated'), 'success');
                closeModal(DOMElements.memberModal);
            }).catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'));
        };

        // Active Subscription Conflict Check
        // Only run if toggling ON/OFF or changing tiers while ACTIVE
        if (originalMember.monthlyPlan && isMonthlyActive) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const dueDateStr = originalMember.paymentDueDate; 
            const hasActivePlan = dueDateStr && new Date(dueDateStr) >= today;
            const oldTierId = originalMember.monthlyPlanTierId || null;

            if (hasActivePlan && (newTierId !== oldTierId)) {
                const getTierNameById = (tid) => {
                    if (!tid) return _('label_legacy_tier');
                    const t = appState.monthlyPlanTiers.find(x => x.id === tid);
                    return t ? getMonthlyPlanName(t) : _('unknown_type');
                };
                showConfirmation(
                    _('title_tier_change_conflict'),
                    _('desc_tier_change_conflict')
                        .replace('{name}', originalMember.name)
                        .replace('{date}', formatShortDateWithYear(dueDateStr))
                        .replace('{oldTier}', getTierNameById(oldTierId))
                        .replace('{newTier}', getTierNameById(newTierId)),
                    executeDatabaseUpdate
                );
                return; 
            }
        }

        executeDatabaseUpdate();
    }

    let html5QrCode = null; // To hold the scanner instance

    function openCheckInModal() {
        // --- 1. Basic Layout ---
        DOMElements.checkInModal.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                
                <h2 class="text-2xl font-bold text-slate-800 mb-4 text-center">${_('check_in_title')}</h2>

                <!-- Tabs -->
                <div class="flex border-b border-slate-200 mb-6">
                    <button id="tabOwnerShowQR" class="flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors">
                        ${_('tab_show_dynamic_qr')}
                    </button>
                    <button id="tabOwnerScanMember" class="flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors">
                        ${_('tab_scan_member')}
                    </button>
                </div>

                <div id="ownerCheckInContent" class="min-h-[300px] flex flex-col items-center justify-center"></div>
            </div>
        `;

        const modal = DOMElements.checkInModal;
        const contentArea = modal.querySelector('#ownerCheckInContent');
        const tabScan = modal.querySelector('#tabOwnerScanMember');
        const tabShow = modal.querySelector('#tabOwnerShowQR');
        let dynamicQrInterval = null;

        // Cleanup Helper
        const cleanup = () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
                html5QrCode = null;
            }
            if (dynamicQrInterval) clearInterval(dynamicQrInterval);
        };

        // --- SUB-FUNCTION: Owner Scans Member ---
        const renderOwnerScan = () => {
            cleanup();
            tabScan.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabShow.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";

            const branches = appState.branches || [];
            const savedDeviceBranch = localStorage.getItem('studioPulseDeviceBranch') || 'any';
            let locationSelector = '';
            
            if (branches.length > 1) {
                let options = `<option value="any">${_('option_device_location_any')}</option>`;
                options += branches.map(b => {
                    const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                    return `<option value="${b.id}" ${savedDeviceBranch === b.id ? 'selected' : ''}>${bName}</option>`;
                }).join('');
                locationSelector = `
                    <div class="mb-4 flex justify-center items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>
                        <select id="modalDeviceBranchSelect" class="form-select py-1 pl-2 pr-8 text-sm text-center font-semibold w-auto bg-transparent border-none focus:ring-0 cursor-pointer">${options}</select>
                    </div>`;
            }

            // Updated HTML: Square aspect ratio + Guide Overlay
            contentArea.innerHTML = `
                <p class="text-slate-500 mb-4 text-center">${_('check_in_prompt')}</p>
                ${locationSelector}
                
                <div class="relative w-full max-w-[280px] mx-auto">
                    <div id="qr-reader" class="w-full aspect-square bg-slate-900 rounded-lg overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover"></div>
                </div>

                <div id="checkInResult" class="min-h-[4rem] mt-4 w-full text-center"></div>
            `;

            const sel = contentArea.querySelector('#modalDeviceBranchSelect');
            if (sel) sel.onchange = () => { localStorage.setItem('studioPulseDeviceBranch', sel.value); showMessageBox(_('info_device_location_saved'), 'info'); };

            startScannerInstance((decodedText) => {
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.pause();
                    handleCheckIn(decodedText);
                }
            });
        };

        // --- SUB-FUNCTION: Owner Shows Dynamic QR ---
        const renderOwnerShow = () => {
            cleanup();
            tabShow.className = "flex-1 pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
            tabScan.className = "flex-1 pb-2 text-sm font-bold text-slate-500 hover:text-indigo-600 border-b-2 border-transparent transition-colors";

            const branches = appState.branches || [];
            let selectedBranchId = appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : 'main');

            let branchControlHTML = '';
            
            if (branches.length > 1) {
                const buttonsHtml = branches.map(b => {
                    const isActive = b.id === selectedBranchId;
                    const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                    const activeStyle = isActive 
                        ? `background-color: #ffffff; color: ${b.color || '#6366f1'}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` 
                        : '';
                    const baseClass = 'qr-branch-btn flex-1 py-1.5 px-3 text-sm font-bold rounded-md transition-all whitespace-nowrap';
                    const stateClass = isActive ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50';

                    return `<button type="button" class="${baseClass} ${stateClass}" style="${activeStyle}" data-branch-id="${b.id}">${bName}</button>`;
                }).join('');

                branchControlHTML = `
                    <div class="mb-6 flex justify-center w-full">
                        <div class="bg-slate-100 p-1 rounded-lg inline-flex w-full overflow-x-auto no-scrollbar">
                            ${buttonsHtml}
                        </div>
                    </div>`;
            }

            contentArea.innerHTML = `
                <p class="text-slate-500 mb-4 text-center text-sm">${_('label_dynamic_qr_instruction')}</p>
                
                ${branchControlHTML}

                <div id="studioQrContainer" class="w-64 h-64 mx-auto border-4 border-slate-800 rounded-lg p-2 bg-white"></div>
                
                <div class="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span id="qrRefreshTimer">${_('label_auto_refresh_seconds').replace('{seconds}', 15)}</span>
                </div>

                <!-- Print Button -->
                <div class="mt-6 w-full px-4">
                    <button id="openPrintPreviewBtn" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd" />
                        </svg>
                        ${_('btn_print_static_qr')}
                    </button>
                </div>
            `;

            const qrContainer = contentArea.querySelector('#studioQrContainer');
            const timerLabel = contentArea.querySelector('#qrRefreshTimer');

            const generate = () => {
                qrContainer.innerHTML = '';
                const payload = {
                    t: 's', // Type: Studio
                    b: selectedBranchId, // Branch ID
                    ts: Date.now() // Timestamp
                };
                
                new QRCode(qrContainer, {
                    text: JSON.stringify(payload),
                    width: 230,
                    height: 230,
                    colorDark: "#1e293b",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
                
                timerLabel.classList.remove('opacity-50');
                void timerLabel.offsetWidth;
                timerLabel.classList.add('opacity-50');
            };

            // Branch Button Logic
            const buttons = contentArea.querySelectorAll('.qr-branch-btn');
            buttons.forEach(btn => {
                btn.onclick = () => {
                    const newId = btn.dataset.branchId;
                    if (newId !== selectedBranchId) {
                        selectedBranchId = newId;
                        buttons.forEach(b => {
                            const bObj = branches.find(br => br.id === b.dataset.branchId);
                            const color = bObj ? (bObj.color || '#6366f1') : '#6366f1';
                            if (b.dataset.branchId === selectedBranchId) {
                                b.style.backgroundColor = '#ffffff';
                                b.style.color = color;
                                b.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
                                b.classList.remove('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-200/50');
                            } else {
                                b.style = '';
                                b.classList.add('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-200/50');
                            }
                        });
                        generate();
                        clearInterval(dynamicQrInterval);
                        dynamicQrInterval = setInterval(generate, 15000);
                    }
                };
            });

            // --- Print Preview Logic ---
            contentArea.querySelector('#openPrintPreviewBtn').onclick = () => {
                const branchObj = branches.find(b => b.id === selectedBranchId);
                let branchName = _('label_legacy_branch');
                let branchColor = '#1e293b'; 
                
                if (branchObj) {
                    branchName = (appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name;
                    if(branchObj.color) branchColor = branchObj.color;
                }

                // 1. Generate Static QR Image Data
                const staticPayload = { t: 's', b: selectedBranchId, static: true };
                const tempDiv = document.createElement('div');
                new QRCode(tempDiv, {
                    text: JSON.stringify(staticPayload),
                    width: 600,
                    height: 600,
                    colorDark: branchColor, 
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                const canvas = tempDiv.querySelector('canvas');
                const imgData = canvas ? canvas.toDataURL("image/png") : tempDiv.querySelector('img').src;

                // 2. Define Card HTML (Updated: Plain Text Header)
                const cardHTML = `
                    <div class="print-card" style="background: white; padding: 60px 40px; border-radius: 30px; text-align: center; border: 1px solid #e2e8f0; width: 100%; max-width: 450px; margin: auto; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);">
                        
                        <!-- Branch Name (Plain Text, Large, Colored) -->
                        <div style="font-size: 44px; font-weight: 900; color: ${branchColor}; line-height: 1.1; margin-bottom: 15px;">
                            ${branchName}
                        </div>

                        <!-- Title (Slightly smaller, Dark Grey) -->
                        <div style="margin: 0 0 40px 0; font-size: 32px; color: #0f172a; font-weight: 700;">${_('check_in_title')}</div>
                        
                        <div style="border: 4px solid #0f172a; border-radius: 30px; padding: 20px; display: inline-block; margin-bottom: 40px;">
                            <img src="${imgData}" style="display: block; width: 100%; max-width: 300px; height: auto;">
                        </div>
                        
                        <div style="font-size: 16px; color: #94a3b8; font-weight: 600; letter-spacing: 0.5px;">
                            Station Mode • StudioPulse
                        </div>
                    </div>
                `;

                // 3. Create Preview Overlay
                const overlay = document.createElement('div');
                overlay.className = 'fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4';
                overlay.innerHTML = `
                    <div class="w-full max-w-lg flex flex-col gap-4">
                        <div class="relative bg-white/5 rounded-2xl p-4 overflow-hidden">
                            ${cardHTML}
                        </div>
                        <div class="flex gap-3">
                            <button id="cancelPreviewBtn" class="flex-1 bg-white text-slate-800 font-bold py-3 rounded-lg hover:bg-slate-100 transition">${_('btn_cancel')}</button>
                            <button id="confirmPrintBtn" class="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd" /></svg>
                                ${_('btn_print_qr')}
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                // 4. Bind Preview Actions
                overlay.querySelector('#cancelPreviewBtn').onclick = () => overlay.remove();
                
                overlay.querySelector('#confirmPrintBtn').onclick = () => {
                    const printWin = window.open('', '', 'width=600,height=800');
                    printWin.document.write(`
                        <html>
                        <head>
                            <title>${branchName} - Check In</title>
                            <style>
                                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
                                ${cardHTML.replace(/margin: auto;/, 'margin: 0 auto; box-shadow: none; border: none;')}
                                @media print { body { -webkit-print-color-adjust: exact; } }
                            </style>
                        </head>
                        <body>
                            ${cardHTML.replace(/box-shadow:.*?;/, 'box-shadow: none; border: none;')}
                            <script>
                                window.onload = function() { window.print(); window.close(); }
                            <\/script>
                        </body>
                        </html>
                    `);
                    printWin.document.close();
                    overlay.remove(); // Optional: Close preview after printing
                };
            };

            generate();
            dynamicQrInterval = setInterval(generate, 15000); 
        };

        tabScan.onclick = renderOwnerScan;
        tabShow.onclick = renderOwnerShow;

        const closeBtn = modal.querySelector('.modal-close-btn');
        closeBtn.onclick = () => {
            cleanup();
            closeModal(modal);
        };

        openModal(modal);
        // Default to Show QR Tab
        renderOwnerShow(); 
    }

    // Helper to start the scanner cleanly
    function startScannerInstance(onScanSuccess) {
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, (errorMessage) => { 
            // Ignoring frame parsing errors
        }).catch(err => {
            console.error("Unable to start QR scanner", err);
            const resultEl = document.getElementById("checkInResult");
            if(resultEl) resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('check_in_error_camera_start_failed')}</div>`;
        });
    }

    function checkInMember(clsId, memberId) {
        const resultEl = DOMElements.checkInModal.querySelector("#checkInResult");
        const member = appState.users.find(u => u.id === memberId);
        if (!member || !resultEl) return;

        const cls = appState.classes.find(c => c.id === clsId);
        if (!cls) {
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('error_class_not_found')}</div>`;
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
            return;
        }

        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        
        // --- NEW: Branch Validation Logic ---
        const deviceBranchId = localStorage.getItem('studioPulseDeviceBranch') || 'any';
        const branches = appState.branches || [];
        
        // Resolve Class Branch (Handle Legacy)
        const classBranchId = cls.branchId || (branches.length > 0 ? branches[0].id : null);
        
        if (deviceBranchId !== 'any' && classBranchId && deviceBranchId !== classBranchId) {
            const correctBranch = branches.find(b => b.id === classBranchId);
            const correctBranchName = correctBranch ? correctBranch.name : _('label_legacy_branch');
            
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('error_wrong_branch_checkin').replace('{branch}', correctBranchName)}</div>`;
            playErrorSound(); // Optional: You can implement this similarly to playSuccessSound if desired
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 3000);
            return;
        }
        // ------------------------------------

        if (cls.attendedBy && cls.attendedBy[memberId]) {
             resultEl.innerHTML = `<div class="check-in-result-banner check-in-notice">${_('check_in_error_already_checked_in').replace('{name}', member.name).replace('{class}', getSportTypeName(sportType))}</div>`;
             setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
             return;
        }

        database.ref(`/classes/${clsId}/attendedBy/${memberId}`).set(true)
            .then(() => {
                playSuccessSound();
                if (navigator.vibrate) {
                    navigator.vibrate(200);
                }

                resultEl.innerHTML = `<div class="check-in-result-banner check-in-success">${_('check_in_success').replace('{name}', member.name).replace('{class}', getSportTypeName(sportType))}</div>`;
                setTimeout(() => { 
                    if (html5QrCode) html5QrCode.resume(); 
                    resultEl.innerHTML = '';
                }, 2500);
            });
    }

    function playSuccessSound() {
        // Use the modern Web Audio API for a clean, file-free sound
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!audioCtx) return; // Exit if the browser doesn't support it

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Connect the parts: oscillator -> gain (volume) -> speakers
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Configure the sound (a short, pleasant beep)
        oscillator.type = 'sine'; // A smooth, clean tone
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A high 'A' note
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Start with a low volume

        // Fade the sound out quickly to avoid a harsh "click"
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        // Play the sound now and stop it after 0.15 seconds
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
    }

    function playErrorSound() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!audioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sawtooth'; // Harsh sound
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
        oscillator.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3); // Slide down
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    }

    async function handleCheckIn(memberId) {
        const resultEl = DOMElements.checkInModal.querySelector("#checkInResult");
        resultEl.innerHTML = `<p class="text-center font-semibold text-slate-500 p-4">${_('check_in_scanning')}</p>`;
        
        const member = appState.users.find(u => u.id === memberId);
        if (!member) {
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('error_member_not_found')}</div>`;
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
            return;
        }

        const memberSnapshot = await database.ref(`/users/${memberId}`).once('value');
        const memberData = memberSnapshot.val();
        const preSelectedClassId = memberData?.selectedCheckInClassId;

        if (preSelectedClassId) {
            checkInMember(preSelectedClassId, memberId);
            return;
        }

        const today = getIsoDate(new Date());
        
        const allBookingsToday = appState.classes.filter(cls => 
            cls.date === today && cls.bookedBy && cls.bookedBy[memberId]
        );
        
        const unattendedBookingsToday = allBookingsToday
            .filter(cls => !(cls.attendedBy && cls.attendedBy[memberId]))
            .sort((a, b) => a.time.localeCompare(b.time));

        if (allBookingsToday.length === 0) {
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('check_in_error_not_booked').replace('{name}', member.name)}</div>`;
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
            return;
        }
        
        if (unattendedBookingsToday.length === 0) {
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-notice">${_('check_in_error_all_checked_in').replace('{name}', member.name)}</div>`;
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
            return;
        }

        if (unattendedBookingsToday.length === 1) {
            checkInMember(unattendedBookingsToday[0].id, memberId);
        } else {
            // This is the multi-booking case
            const classOptions = unattendedBookingsToday.map(cls => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                return `<button class="w-full text-left p-3 bg-slate-100 hover:bg-indigo-100 rounded-lg transition" data-cls-id="${cls.id}">
                    <strong>${getSportTypeName(sportType)}</strong> at ${getTimeRange(cls.time, cls.duration)}
                </button>`;
            }).join('');
            
            // Build the HTML for the selection dialog, including the new button
            resultEl.innerHTML = `
                <div class="p-4 bg-slate-50 rounded-lg">
                    <h4 class="font-bold text-center mb-2">${_('check_in_select_class_title')}</h4>
                    <p class="text-sm text-center text-slate-600 mb-4">${_('check_in_select_class_prompt').replace('{name}', member.name)}</p>
                    <div class="space-y-2">${classOptions}</div>
                    <button id="checkInAllBtn" class="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition">${_('btn_check_in_all')}</button>
                </div>
            `;
            
            // Listener for individual class check-in buttons
            resultEl.querySelectorAll('button[data-cls-id]').forEach(btn => {
                btn.onclick = () => {
                    checkInMember(btn.dataset.clsId, memberId);
                };
            });

            // Listener for the new "Check-In All" button
            const checkInAllBtn = resultEl.querySelector('#checkInAllBtn');
            if (checkInAllBtn) {
                checkInAllBtn.onclick = () => {
                    const updates = {};
                    unattendedBookingsToday.forEach(cls => {
                        updates[`/classes/${cls.id}/attendedBy/${memberId}`] = true;
                    });

                    database.ref().update(updates).then(() => {
                        playSuccessSound();
                        if (navigator.vibrate) navigator.vibrate(200);

                        const successMessage = _('check_in_success_all')
                                .replace('{name}', member.name)
                                .replace('{count}', unattendedBookingsToday.length);

                        resultEl.innerHTML = `<div class="check-in-result-banner check-in-success">${successMessage}</div>`;
                        setTimeout(() => { 
                            if (html5QrCode) html5QrCode.resume(); 
                            resultEl.innerHTML = '';
                        }, 2500);
                    }).catch(error => {
                        console.error('Failed to check in all classes', error);
                        resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('error_generic')}</div>`;
                        setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
                    });
                };
            }
        }
    }

    function handleMemberScanningStudio(decodedText, onResumeCallback) {
        const resultEl = document.getElementById("memberScanResult");
        if (!resultEl) return;

        let payload;
        try {
            payload = JSON.parse(decodedText);
        } catch (e) {
            resultEl.innerHTML = `<div class="bg-red-100 text-red-700 p-2 rounded text-sm text-center font-bold">${_('error_qr_invalid_format')}</div>`;
            onResumeCallback();
            return;
        }

        // Validate Type
        if (payload.t !== 's') {
            resultEl.innerHTML = `<div class="bg-red-100 text-red-700 p-2 rounded text-sm text-center font-bold">${_('error_qr_invalid_format')}</div>`;
            onResumeCallback();
            return;
        }

        // Validate Timestamp (Allow 60 seconds drift/delay)
        const now = Date.now();
        if (!payload.static && (now - payload.ts > 60000)) {
            resultEl.innerHTML = `<div class="bg-red-100 text-red-700 p-2 rounded text-sm text-center font-bold">${_('error_qr_dynamic_expired')}</div>`;
            onResumeCallback();
            return;
        }

        // Find Booking Logic
        const memberId = appState.currentUser.id;
        const today = getIsoDate(new Date());
        
        // 1. Get all bookings for today
        const allBookingsToday = appState.classes.filter(cls => 
            cls.date === today && cls.bookedBy && cls.bookedBy[memberId]
        );

        // 2. Filter by Scanned Branch
        const scanBranchId = payload.b;
        const branches = appState.branches || [];
        
        const validBranchBookings = allBookingsToday.filter(cls => {
            const clsBranchId = cls.branchId || (branches.length > 0 ? branches[0].id : null);
            return clsBranchId === scanBranchId;
        });

        // 3. General Validation
        if (validBranchBookings.length === 0) {
            if (allBookingsToday.length > 0) {
                resultEl.innerHTML = `<div class="bg-orange-100 text-orange-700 p-2 rounded text-sm text-center font-bold">${_('error_qr_wrong_branch')}</div>`;
            } else {
                resultEl.innerHTML = `<div class="bg-red-100 text-red-700 p-2 rounded text-sm text-center font-bold">${_('check_in_error_not_booked').replace('{name}', '')}</div>`;
            }
            playErrorSound();
            onResumeCallback();
            return;
        }

        // 4. Target Class Selection Logic
        let targetClass = null;
        const selectedId = appState.currentUser.selectedCheckInClassId;

        // SCENARIO A: User explicitly selected a class
        if (selectedId) {
            targetClass = validBranchBookings.find(c => c.id === selectedId);
            
            if (!targetClass) {
                resultEl.innerHTML = `<div class="bg-orange-100 text-orange-700 p-2 rounded text-sm text-center font-bold">${_('error_wrong_branch_checkin').replace('{branch}', '')}</div>`;
                playErrorSound();
                onResumeCallback();
                return;
            }
        } 
        // SCENARIO B: No selection made (Auto-detect)
        else {
            const unattended = validBranchBookings.filter(cls => !(cls.attendedBy && cls.attendedBy[memberId]));
            
            if (unattended.length === 0) {
                resultEl.innerHTML = `<div class="bg-blue-100 text-blue-700 p-2 rounded text-sm text-center font-bold">${_('check_in_error_all_checked_in').replace('{name}', '')}</div>`;
                playSuccessSound();
                onResumeCallback();
                return;
            } else if (unattended.length === 1) {
                targetClass = unattended[0];
            } else {
                // Multiple options - Require user to select
                resultEl.innerHTML = `<div class="bg-yellow-100 text-yellow-800 p-2 rounded text-sm text-center font-bold">${_('check_in_preselect_prompt')}</div>`;
                // NOTE: DO NOT call onResumeCallback() here. 
                // We keep the scanner paused so the user can tap a button.
                // The button click handler in renderCheckInPage will call resume().
                return;
            }
        }

        // 5. Final Status Check
        if (targetClass.attendedBy && targetClass.attendedBy[memberId]) {
            resultEl.innerHTML = `<div class="bg-blue-100 text-blue-700 p-2 rounded text-sm text-center font-bold">${_('check_in_error_already_checked_in').replace('{name}', '').replace('{class}', '')}</div>`;
            playSuccessSound();
            onResumeCallback();
            return;
        }

        // 6. Perform Check-in
        database.ref(`/classes/${targetClass.id}/attendedBy/${memberId}`).set(true)
            .then(() => {
                playSuccessSound();
                if (navigator.vibrate) navigator.vibrate(200);
                
                appState.highlightBookingId = targetClass.id;
                showMessageBox(_('success_check_in_complete'), 'success');

                if (window.memberScanner) {
                    window.memberScanner.stop()
                        .catch(err => console.warn("Scanner stop warning:", err))
                        .finally(() => {
                            window.memberScanner.clear();
                            window.memberScanner = null; 
                            switchPage('account');
                        });
                } else {
                    switchPage('account');
                }
            })
            .catch(err => {
                console.error(err);
                resultEl.innerHTML = `<div class="bg-red-100 text-red-700 p-2 rounded text-sm text-center font-bold">${_('error_generic')}</div>`;
                onResumeCallback();
            });
    }

    async function recalculateMonthlyPlans() {
        showMessageBox(_('info_recalculation_started'), 'info', 5000);

        try {
            const usersSnapshotPromise = database.ref('/users').once('value');
            
            // Normalize "today" to the start of the day (midnight) for consistent calculations.
            const today = new Date();
            today.setHours(0, 0, 0, 0); 

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            thirtyDaysAgo.setHours(0, 0, 0, 0); // Also normalize the 30-day mark

            // Efficiently fetch only the classes from the last 30 days.
            const classesSnapshotPromise = database.ref('/classes').orderByChild('date').startAt(getIsoDate(thirtyDaysAgo)).once('value');
            
            const [usersSnapshot, classesSnapshot] = await Promise.all([usersSnapshotPromise, classesSnapshotPromise]);

            const allUsers = firebaseObjectToArray(usersSnapshot.val());
            const recentClasses = firebaseObjectToArray(classesSnapshot.val());
            
            // Filter for the correct target members.
            const monthlyMembers = allUsers.filter(u => u.role === 'member' && u.monthlyPlan && !u.isDeleted && u.planStartDate);
            
            if (monthlyMembers.length === 0) {
                showMessageBox(_('info_no_monthly_members_to_recalculate'), 'info');
                return;
            }

            const updates = {};
            let updatedCount = 0;
            const MINIMUM_ACTIVE_DAYS_FOR_RECALC = 7; 

            for (const member of monthlyMembers) {
                const planStartDate = new Date(member.planStartDate);
                planStartDate.setHours(0, 0, 0, 0); // Normalize the member's start date

                if (isNaN(planStartDate.getTime())) continue; // Skip if date is invalid

                const observationStartDate = planStartDate > thirtyDaysAgo ? planStartDate : thirtyDaysAgo;
                
                const dayDifference = (today - observationStartDate) / (1000 * 60 * 60 * 24);
                const activeDays = Math.max(1, Math.round(dayDifference) + 1);
                
                // Safety check: Don't calculate for members with too little data.
                if (activeDays < MINIMUM_ACTIVE_DAYS_FOR_RECALC) {
                    continue;
                }

                const attendedClassesCount = recentClasses.filter(cls => {
                    const clsDate = new Date(cls.date);
                    return cls.attendedBy && cls.attendedBy[member.id] &&
                           clsDate >= observationStartDate && clsDate <= today;
                }).length;

                const dailyAttendanceRate = attendedClassesCount / activeDays;
                const projectedMonthlyAttendance = dailyAttendanceRate * 30;

                // --- START: NEW Dynamic Adaptive Smoothing Logic ---

                // Step 1: Calculate member tenure to determine their "veterancy".
                const now = new Date();
                const memberTenureInDays = (now - planStartDate) / (1000 * 60 * 60 * 24);
                const memberTenureInMonths = memberTenureInDays / 30.44; // Avg days in a month

                // Step 2: Determine the dynamic weight (alpha).
                // Alpha controls how much we trust the NEW data vs. the old historical estimate.
                let alpha;
                if (memberTenureInMonths < 3) {
                    // New Member: Trust recent data more (70%).
                    alpha = 0.7;
                } else if (memberTenureInMonths <= 12) {
                    // Established Member: Balanced approach (50%).
                    alpha = 0.5;
                } else { // memberTenureInMonths > 12
                    // Veteran Member: Trust historical estimate more (30%).
                    alpha = 0.3;
                }
                
                // Step 3: Apply the new, more accurate formula.
                // If there's no previous estimate, we use the new projection as the base.
                const previousEstimate = member.monthlyPlanEstimatedAttendance || projectedMonthlyAttendance;
                const newEstimatedAttendance = Math.round((alpha * projectedMonthlyAttendance) + ((1 - alpha) * previousEstimate));

                // --- END: NEW Dynamic Adaptive Smoothing Logic ---
                
                // Only create an update if the value has actually changed.
                if (newEstimatedAttendance !== member.monthlyPlanEstimatedAttendance) {
                    updatedCount++;
                    const monthlyAmount = member.monthlyPlanAmount || 0;
                    let newCreditValue = 0;
                    if (monthlyAmount > 0 && newEstimatedAttendance > 0) {
                        newCreditValue = monthlyAmount / newEstimatedAttendance;
                    }

                    updates[`/users/${member.id}/monthlyPlanEstimatedAttendance`] = newEstimatedAttendance;
                    updates[`/users/${member.id}/monthlyCreditValue`] = newCreditValue;
                }
            }

            // Commit all updates to the database in a single, efficient call.
            if (Object.keys(updates).length > 0) {
                await database.ref().update(updates);
                showMessageBox(_('success_recalculation_complete').replace('{count}', updatedCount), 'success');
            } else {
                showMessageBox(_('info_recalculation_no_updates_needed'), 'info');
            }

        } catch (error) {
            console.error('Error during plan recalculation:', error);
            showMessageBox(_('error_recalculation_failed'), 'error');
        }
    }

    function calculateRevenueForBookings(bookings, revenueMode = 'actual') {
        // 1. Group bookings by member AND capture the member object
        const memberMap = {};
        
        const bookingsByMember = bookings.reduce((acc, booking) => {
            const memberId = booking.member.id;
            if (!acc[memberId]) acc[memberId] = [];
            acc[memberId].push(booking.cls);
            
            // Capture the member object from the input (Fresh data from Modal)
            if (!memberMap[memberId]) memberMap[memberId] = booking.member;
            
            return acc;
        }, {});

        let totalGrossRevenue = 0;
        const revenueByClsId = new Map();
        
        const now = new Date();
        const nowIso = now.toISOString().slice(0, 16); 

        for (const memberId in bookingsByMember) {
            // --- FIX: Use the local map instead of global appState lookup ---
            const member = memberMap[memberId];
            if (!member) continue;

            const memberClasses = bookingsByMember[memberId].sort((a, b) => {
                const dateA = a.date + a.time;
                const dateB = b.date + b.time;
                return dateA.localeCompare(dateB);
            });

            // Prepare Purchase Pools
            const purchasePools = {};
            
            if (member.purchaseHistory) {
                const historyArr = firebaseObjectToArrayFast(member.purchaseHistory);
                
                historyArr
                    .filter(p => p.status !== 'deleted')
                    .sort((a, b) => (a.date || '').localeCompare(b.date || '')) 
                    .forEach(p => {
                        const typeId = p.creditTypeId || 'general';
                        if (!purchasePools[typeId]) purchasePools[typeId] = [];
                        
                        let cost = p.costPerCredit;
                        if (cost === undefined || cost === null) {
                            cost = (p.credits > 0 && p.amount > 0) ? (p.amount / p.credits) : 0;
                        }

                        purchasePools[typeId].push({
                            costPerCredit: Number(cost),
                            remainingCredits: Number(p.credits)
                        });
                    });
            }

            const generalPool = purchasePools['general'] || [];

            for (const cls of memberClasses) {
                const classStartIso = `${cls.date}T${cls.time}`;
                const hasClassStarted = nowIso > classStartIso;
                
                const shouldCalculate = (revenueMode === 'projected') || (revenueMode === 'actual' && hasClassStarted);

                if (shouldCalculate) {
                    let revenue = 0;
                    const bookingInfo = cls.bookedBy && cls.bookedBy[member.id];
                    
                    let isPaidByMonthly = false;
                    if (bookingInfo && bookingInfo.paymentMethod) {
                        isPaidByMonthly = (bookingInfo.paymentMethod === 'monthly');
                    } else {
                        isPaidByMonthly = member.monthlyPlan;
                    }

                    if (isPaidByMonthly) {
                        let creditValue = 0;
                        if (bookingInfo && bookingInfo.monthlyCreditValue) {
                            creditValue = bookingInfo.monthlyCreditValue;
                        } else if (member.monthlyCreditValue) {
                            creditValue = member.monthlyCreditValue;
                        } else if (member.monthlyPlanAmount > 0 && member.monthlyPlanEstimatedAttendance > 0) {
                            creditValue = member.monthlyPlanAmount / member.monthlyPlanEstimatedAttendance;
                        }

                        revenue = (cls.credits || 0) * creditValue;
                    } else {
                        let creditsToDeduct = cls.credits;
                        let clsRevenueForCreditMember = 0;
                        
                        const requiredTypeId = (bookingInfo && bookingInfo.creditTypeId) || cls.costCreditTypeId || 'general';
                        
                        let targetPool = purchasePools[requiredTypeId];
                        if (!targetPool || targetPool.length === 0) {
                            targetPool = generalPool;
                        }

                        if (targetPool) {
                            for (const purchase of targetPool) {
                                if (creditsToDeduct <= 0) break;
                                if (purchase.remainingCredits <= 0) continue;

                                const deductFromThisPool = Math.min(creditsToDeduct, purchase.remainingCredits);
                                clsRevenueForCreditMember += deductFromThisPool * purchase.costPerCredit;
                                
                                purchase.remainingCredits -= deductFromThisPool;
                                creditsToDeduct -= deductFromThisPool;
                            }
                        }
                        revenue = clsRevenueForCreditMember;
                    }

                    totalGrossRevenue += revenue;
                    revenueByClsId.set(cls.id, (revenueByClsId.get(cls.id) || 0) + revenue);
                }
            }
        }
        return { grossRevenue: totalGrossRevenue, revenueByClsId };
    }

    function handleAdminSettingsSave(e) {
        e.preventDefault();
        const form = e.target;
        const saveBtn = form.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.textContent = _('status_saving');

        const newDefaults = {
            time: form.querySelector('#defaultTime').value,
            duration: parseInt(form.querySelector('#defaultDuration').value),
            credits: parseFloat(form.querySelector('#defaultCredits').value),
            maxParticipants: parseInt(form.querySelector('#defaultMaxParticipants').value),
            cancellationCutoff: parseFloat(form.querySelector('#defaultCancellationCutoff').value) || 0,
            // --- FIX: Capture the new field ---
            defaultEstAttendance: parseInt(form.querySelector('#defaultEstAttendance').value) || 0
        };

        database.ref('/studioSettings/clsDefaults').set(newDefaults)
            .then(() => {
                showMessageBox(_('success_settings_saved'), 'success');
            })
            .catch(error => {
                showMessageBox(_('error_settings_save_failed').replace('{error}', error.message), 'error');
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = _('btn_save_defaults');
            });
    }

    async function renderAdminPage(container) {
        const isOwner = appState.currentUser?.role === 'owner';
        const isManager = appState.currentUser?.role === 'manager';
        // Helper: Treat Manager like Owner in this context (Full Admin Access)
        const hasFullAccess = isOwner || isManager;
        
        // --- NEW: Define Plan Variable ---
        const plan = (appState.studioPlan || appState.currentUser?.subscriptionStatus || 'basic').toLowerCase();
        
        // --- 1. Define Helper Function Locally (Fix for Crash) ---
        const setupSearchField = (inputId, clearBtnId, stateKey, paginationKey) => {
            const input = container.querySelector(`#${inputId}`);
            const clearBtn = container.querySelector(`#${clearBtnId}`);
            if (!input || !clearBtn) return; 
            const toggleClearButton = () => {
                clearBtn.classList.toggle('hidden', !input.value);
            };
            input.oninput = () => {
                appState.searchTerms[stateKey] = input.value;
                appState.pagination[paginationKey].page = 1;
                toggleClearButton();
                renderAdminLists();
            };
            clearBtn.onclick = () => {
                input.value = '';
                appState.searchTerms[stateKey] = '';
                appState.pagination[paginationKey].page = 1;
                toggleClearButton();
                renderAdminLists();
                input.focus();
            };
            toggleClearButton();
        };

        // --- 2. Build HTML Content ---
        
        // Conditional: Announcement Section
        let announcementSectionHTML = '';
        if (checkSubscriptionAccess('admin_announcements')) {
            const currentAnnounce = appState.currentAnnouncement;
            let announcementPreviewHTML = `<p data-lang-key="desc_announcements" class="text-slate-500 mb-6"></p>`;

            if (currentAnnounce) {
                const title = (appState.currentLanguage === 'zh-TW' ? currentAnnounce.title?.zh : currentAnnounce.title?.en) || currentAnnounce.title?.en || '';
                const msg = (appState.currentLanguage === 'zh-TW' ? currentAnnounce.message?.zh : currentAnnounce.message?.en) || currentAnnounce.message?.en || '';
                const color = currentAnnounce.color || '#6366f1';

                announcementPreviewHTML = `
                    <div class="mb-6 p-4 rounded-lg text-white shadow-md border border-white/10 relative overflow-hidden" style="background-color: ${color}">
                        <div class="absolute inset-0 bg-gradient-to-br from-white/20 to-black/5 pointer-events-none"></div>
                        <div class="relative z-10">
                            ${title ? `<h4 class="font-bold text-lg mb-1 drop-shadow-sm">${title}</h4>` : ''}
                            <p class="text-sm whitespace-pre-wrap opacity-95 drop-shadow-sm">${msg}</p>
                            <div class="mt-3 text-xs opacity-75 border-t border-white/20 pt-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
                                ${formatShortDateWithYear(currentAnnounce.postedAt)}
                            </div>
                        </div>
                    </div>`;
            }

            announcementSectionHTML = `
                <div class="card p-6 md:p-8">
                    <div class="flex justify-between items-center mb-4">
                        <h3 data-lang-key="header_announcements" class="text-2xl font-bold text-slate-800"></h3>
                        <div class="flex items-center gap-2">
                            ${currentAnnounce ? `
                                <span class="px-2 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full select-none">${_('status_active')}</span>
                                <button id="quickClearAnnounceBtn" class="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition p-1.5 rounded-full shadow-sm ml-1" title="${_('btn_clear_announcement')}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${announcementPreviewHTML}
                    <button id="adminAnnounceBtn" data-lang-key="btn_manage_announcement" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition"></button>
                </div>`;
        }

        // Conditional: Class Defaults
        let classDefaultsSectionHTML = '';
        if (checkSubscriptionAccess('admin_defaults')) {
            classDefaultsSectionHTML = `
                <div class="card p-6 md:p-8">
                    <h3 data-lang-key="header_class_defaults" class="text-2xl font-bold text-slate-800 mb-4"></h3>
                    <p data-lang-key="desc_class_defaults" class="text-slate-500 mb-6"></p>
                    <form id="adminSettingsForm">
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div><label for="defaultTime" data-lang-key="label_start_time" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="text" id="defaultTime" class="form-input" pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" required></div>
                            <div><label for="defaultDuration" data-lang-key="label_duration" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="number" id="defaultDuration" class="form-input" min="15" step="5" required></div>
                            <div><label for="defaultCredits" data-lang-key="label_credits" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="number" id="defaultCredits" class="form-input" min="0" step="0.01" required></div>
                            <div><label for="defaultMaxParticipants" data-lang-key="label_max_participants" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="number" id="defaultMaxParticipants" class="form-input" min="1" step="1" required></div>
                            <div><label for="defaultCancellationCutoff" data-lang-key="label_cancellation_cutoff" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="number" id="defaultCancellationCutoff" class="form-input" min="0" step="0.5" data-lang-key="placeholder_cancellation_cutoff"></div>
                            <div><label for="defaultEstAttendance" data-lang-key="label_default_est_attendance" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="number" id="defaultEstAttendance" class="form-input" min="0" step="1" placeholder="e.g., 8"></div>
                        </div>
                        <div class="flex justify-end mt-6"><button type="submit" data-lang-key="btn_save_changes" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition"></button></div>
                    </form>
                </div>`;
        }

        // Conditional: Formulas
        let formulaCardHTML = '';
        if (hasFullAccess && checkSubscriptionAccess('admin_formulas')) {
            const formulas = appState.salaryFormulas || [];
            const activeFormulas = formulas.filter(f => !f.isDeleted);
            formulaCardHTML = `
                <div class="card p-6 flex flex-col h-full">
                    <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                        <h3 id="formulasHeader" class="text-2xl font-bold text-slate-800">${_('header_salary_formulas')} (${activeFormulas.length})</h3>
                    </div>
                    <button id="btnAddFormula" class="w-full mb-4 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition">${_('btn_add_formula')}</button>
                    <div class="flex-grow">
                        <ul id="formulasList" class="admin-list space-y-2">
                            ${activeFormulas.length === 0 ? `<li class="text-center text-slate-500 p-4">No formulas defined</li>` : 
                            activeFormulas.map(f => `
                                <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                                    <div class="font-mono text-sm font-bold text-slate-700 px-2">${f.name}</div>
                                    <div class="flex items-center gap-2">
                                        <button class="edit-btn font-semibold text-indigo-600" data-type="formula" data-id="${f.id}">${_('btn_edit')}</button>
                                        <button type="button" class="delete-btn font-semibold text-red-600" data-type="formula" data-id="${f.id}" data-name="${f.name}">${_('btn_delete')}</button>
                                    </div>
                                </li>`).join('')}
                        </ul>
                    </div>
                </div>`;
        }

        // --- START: NEW PERMISSION CARD LOGIC (Owner Only) ---
        let permissionsCardHTML = '';
        
        // --- UPDATED CONDITION: Hide if Basic Plan ---
        if (isOwner && plan !== 'basic') {
            // 1. Gather Staff & Managers (exclude deleted)
            const teamMembers = appState.users.filter(u => 
                !u.isDeleted && (u.role === 'staff' || u.role === 'manager')
            );
            
            // 2. Sort: Managers first, then alphabetical by name
            teamMembers.sort((a, b) => {
                if (a.role === b.role) return a.name.localeCompare(b.name);
                return a.role === 'manager' ? -1 : 1;
            });

            // 3. Render List Rows (Updated for Detail View)
            const teamListHTML = teamMembers.length > 0 
                ? teamMembers.map(u => {
                    const isManager = u.role === 'manager';
                    const roleLabel = isManager ? _('role_manager') : _('role_staff');
                    const roleColor = isManager ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
                    
                    const accessKey = u.staffAccessLevel || 'home_only';
                    const accessLabel = {
                        'home_only': _('access_home_only'),
                        'global_read': _('access_global_read'),
                        'global_write': _('access_global_write')
                    }[accessKey];

                    // Resolve Home Branch Name
                    const branches = appState.branches || [];
                    const homeId = u.homeBranchId || (branches.length > 0 ? branches[0].id : null);
                    const bObj = branches.find(b => b.id === homeId);
                    const branchName = bObj ? ((appState.currentLanguage === 'zh-TW' && bObj.name_zh) ? bObj.name_zh : bObj.name) : 'Main Studio';

                    // --- NEW: Calculate Additional Access String ---
                    let additionalInfo = "";
                    
                    // Only show additional branches if NOT Global Write (which implies all)
                    if (accessKey !== 'global_write' && u.allowedBranches) {
                        const extraNames = [];
                        Object.keys(u.allowedBranches).forEach(bId => {
                            if (bId !== homeId) { // Exclude Home Branch
                                const b = branches.find(br => br.id === bId);
                                if (b) extraNames.push((appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name);
                            }
                        });

                        if (extraNames.length > 0) {
                            additionalInfo = ` <span class="text-slate-400">(${_('label_additional_access_display')}: ${extraNames.join(', ')})</span>`;
                        }
                    }
                    // -----------------------------------------------

                    return `
                    <div class="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 gap-3">
                        <div class="flex items-center gap-3 w-full sm:w-auto">
                            <div class="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold flex-shrink-0">
                                ${u.name.charAt(0).toUpperCase()}
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-slate-800 truncate">${u.name}</p>
                                    <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${roleColor}">${roleLabel}</span>
                                </div>
                                <p class="text-xs text-slate-500 truncate">
                                    ${branchName} • <span class="font-semibold text-slate-600">${accessLabel}</span>${additionalInfo}
                                </p>
                            </div>
                        </div>
                        <button class="manage-permission-btn w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 hover:text-indigo-600 text-slate-600 font-semibold py-1.5 px-4 rounded-md text-sm transition shadow-sm" data-id="${u.id}">
                            ${_('btn_manage')}
                        </button>
                    </div>`;
                }).join('')
                : `<p class="text-center text-slate-400 py-4">No staff members found.</p>`;

            permissionsCardHTML = `
                <div class="card p-6 md:p-8 mt-8">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <h3 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            ${_('header_team_permissions')} (${teamMembers.length})
                        </h3>
                        <button id="togglePermissionInfo" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ${_('permissions_how_it_works')}
                        </button>
                    </div>
                    
                    <!-- Info Box (Hidden by default) -->
                    <div id="permissionInfoBox" class="hidden mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                        <div class="space-y-2 text-sm text-slate-700">
                            <p>${_('perm_story_home')}</p>
                            <p>${_('perm_story_read')}</p>
                            <p>${_('perm_story_write')}</p>
                        </div>
                    </div>

                    <div class="space-y-3" id="teamPermissionsList">
                        ${teamListHTML}
                    </div>
                </div>`;
        }
        // --- END: NEW PERMISSION CARD LOGIC ---

        const gridClassesTop = hasFullAccess ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
        const gridClassesBottom = isOwner ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';

        container.innerHTML = `
            <div class="space-y-8">
                <div class="card p-6">
                    <div class="flex justify-between items-center">
                        <h3 data-lang-key="label_language" class="text-xl font-bold text-slate-700"></h3>
                        <div class="text-base">
                            <a href="#" class="lang-selector font-semibold" data-lang="zh-TW" data-lang-key="lang_selector_zh"></a> | 
                            <a href="#" class="lang-selector font-semibold" data-lang="en" data-lang-key="lang_selector_en"></a>
                        </div>
                    </div>
                </div>

                <div class="grid ${gridClassesTop} gap-8 items-start">
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                            <h3 id="sportsHeader" class="text-2xl font-bold text-slate-800"></h3>
                            <div class="relative">
                                <input type="text" id="sportSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-32 pr-8" value="${appState.searchTerms.sports}">
                                <button id="clearSportSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        </div>
                        <button id="addSportTypeBtn" class="w-full mb-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('admin_add_sport_type')}</button>
                        <div class="flex-grow"><ul id="sportsList" class="admin-list space-y-2"></ul></div>
                        <div id="sportsPagination" class="flex justify-between items-center mt-4"></div>
                    </div>

                    ${hasFullAccess ? `
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                            <h3 id="tutorsHeader" class="text-2xl font-bold text-slate-800"></h3>
                            <div class="relative">
                                <input type="text" id="tutorSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-32 pr-8" value="${appState.searchTerms.tutors}">
                                <button id="clearTutorSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        </div>
                        <button id="addTutorBtn" class="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('title_add_tutor')}</button>
                        <div class="flex-grow"><ul id="tutorsList" class="admin-list space-y-2"></ul></div>
                        <div id="tutorsPagination" class="flex justify-between items-center mt-4"></div>
                    </div>` : ''}
                </div>
                
                ${hasFullAccess ? `
                <div class="grid ${gridClassesBottom} gap-8 items-start">
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4"><h3 class="text-2xl font-bold text-slate-800"><span data-lang-key="header_credit_types"></span> <span id="creditTypesCount"></span></h3></div>
                        <button id="addCreditTypeBtn" data-lang-key="btn_add_credit_type" class="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"></button>
                        <div class="flex-grow"><ul id="creditTypesList" class="admin-list space-y-2"></ul></div>
                    </div>
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4"><h3 class="text-2xl font-bold text-slate-800"><span data-lang-key="header_monthly_tiers"></span> <span id="monthlyTiersCount"></span></h3></div>
                        <button id="addMonthlyTierBtn" data-lang-key="btn_add_monthly_tier" class="w-full mb-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition"></button>
                        <div class="flex-grow"><ul id="monthlyTiersList" class="admin-list space-y-2"></ul></div>
                    </div>
                    
                    <!-- Only Owner sees Locations -->
                    ${isOwner ? `
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4"><h3 id="locationsHeader" class="text-2xl font-bold text-slate-800"></h3></div>
                        <button id="addLocationBtn" class="w-full mb-4 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('btn_add_location')}</button>
                        <div class="flex-grow"><ul id="locationsList" class="admin-list space-y-2"></ul></div>
                    </div>
                    ` : ''}
                </div>` : ''}

                ${classDefaultsSectionHTML}
                ${announcementSectionHTML}

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div class="card p-6 md:p-8 flex flex-col h-full">
                        <h3 data-lang-key="header_export_schedule" class="text-2xl font-bold text-slate-800 mb-4"></h3>
                        <p data-lang-key="desc_export_schedule" class="text-slate-500 mb-6"></p>
                        <div class="space-y-6 flex-grow">
                            <div id="exportScheduleBranchContainer" class="hidden">
                                <label class="block text-slate-600 text-sm font-bold mb-2" data-lang-key="label_select_branch"></label>
                                <div id="exportScheduleBranchWrapper" class="flex bg-slate-100 p-1 rounded-lg overflow-x-auto"></div>
                            </div>
                            <div>
                                <label class="block text-slate-600 text-sm font-bold mb-2" data-lang-key="label_select_period"></label>
                                <select id="exportScheduleMonth" class="form-select w-full md:w-64"></select>
                            </div>
                        </div>
                        <button id="btnAdminExportSchedule" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2 mt-4 w-fit">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            <span data-lang-key="btn_export"></span>
                        </button>
                    </div>
                    ${formulaCardHTML}
                </div>
                
                <!-- NEW: Team Permissions Card (Injected at Bottom) -->
                ${permissionsCardHTML}
            </div>`;
        
        // --- 3. Event Binding & Data Population ---
        try {
            setupLanguageToggles();
            renderAdminLists(); 
            
            // Search Fields
            setupSearchField('sportSearchInput', 'clearSportSearchBtn', 'sports', 'sports');
            if (hasFullAccess) setupSearchField('tutorSearchInput', 'clearTutorSearchBtn', 'tutors', 'tutors');

            // Basic List Buttons
            const addSportTypeBtn = container.querySelector('#addSportTypeBtn');
            if (addSportTypeBtn) addSportTypeBtn.onclick = () => openSportTypeModal();
            const sportsList = container.querySelector('#sportsList');
            if (sportsList) sportsList.addEventListener('click', handleAdminListClick);
            
            if (hasFullAccess) {
                const addTutorBtn = container.querySelector('#addTutorBtn');
                if (addTutorBtn) addTutorBtn.onclick = () => openTutorModal();
                const tutorsList = container.querySelector('#tutorsList');
                if (tutorsList) tutorsList.addEventListener('click', handleAdminListClick);

                const addCreditTypeBtn = container.querySelector('#addCreditTypeBtn');
                if (addCreditTypeBtn) {
                    addCreditTypeBtn.onclick = () => openCreditTypeModal();
                    container.querySelector('#creditTypesList').addEventListener('click', handleAdminListClick);
                }
                const addMonthlyTierBtn = container.querySelector('#addMonthlyTierBtn');
                if (addMonthlyTierBtn) {
                    addMonthlyTierBtn.onclick = () => openMonthlyPlanTierModal();
                    container.querySelector('#monthlyTiersList').addEventListener('click', handleAdminListClick);
                }
                const addLocationBtn = container.querySelector('#addLocationBtn');
                if (addLocationBtn) {
                    addLocationBtn.onclick = () => openBranchModal();
                    container.querySelector('#locationsList').addEventListener('click', handleAdminListClick);
                }
            }

            // Announcement Actions
            const adminAnnounceBtn = container.querySelector('#adminAnnounceBtn');
            if (adminAnnounceBtn) adminAnnounceBtn.onclick = openAnnouncementModal;
            
            const quickClearBtn = container.querySelector('#quickClearAnnounceBtn');
            if (quickClearBtn) {
                quickClearBtn.onclick = () => {
                    showConfirmation(_('confirm_clear_announcement_title'), _('confirm_clear_announcement_desc'), () => {
                        database.ref('/announcements/current').remove().then(() => showMessageBox(_('success_announcement_cleared'), 'success'));
                    });
                };
            }

            // Formula Actions
            if (hasFullAccess && checkSubscriptionAccess('admin_formulas')) {
                const btnAddFormula = document.getElementById('btnAddFormula');
                if(btnAddFormula) btnAddFormula.onclick = () => openFormulaModal();
                const fList = document.getElementById('formulasList');
                if(fList) {
                    fList.addEventListener('click', (e) => {
                        const target = e.target.closest('.edit-btn, .delete-btn');
                        if(!target) return;
                        const { type, id, name } = target.dataset;
                        if (type === 'formula') {
                            if (target.classList.contains('edit-btn')) {
                                openFormulaModal(appState.salaryFormulas.find(f => f.id === id));
                            } else {
                                const activeTutors = appState.tutors.filter(t => t.skills && t.skills.some(s => s.salaryFormulaId === id && s.salaryType === 'custom'));
                                if (activeTutors.length > 0) {
                                    showMessageBox(_('error_formula_in_use_title'), 'error'); 
                                    return;
                                }
                                showConfirmation(_('confirm_delete_generic_title').replace('{type}', 'Formula'), _('confirm_delete_generic_desc').replace('{name}', name), () => {
                                    const usedByClasses = appState.classes.some(c => c.payoutDetails && c.payoutDetails.salaryFormulaId === id);
                                    if (usedByClasses) database.ref('/salaryFormulas/' + id).update({ isDeleted: true });
                                    else database.ref('/salaryFormulas/' + id).remove();
                                });
                            }
                        }
                    });
                }
            }

            // --- START: NEW PERMISSION CARD EVENTS ---
            if (isOwner) {
                const toggleInfoBtn = container.querySelector('#togglePermissionInfo');
                const infoBox = container.querySelector('#permissionInfoBox');
                if (toggleInfoBtn && infoBox) {
                    toggleInfoBtn.onclick = () => {
                        infoBox.classList.toggle('hidden');
                    };
                }

                const teamList = container.querySelector('#teamPermissionsList');
                if (teamList) {
                    teamList.addEventListener('click', (e) => {
                        const btn = e.target.closest('.manage-permission-btn');
                        if (btn) {
                            const userId = btn.dataset.id;
                            const user = appState.users.find(u => u.id === userId);
                            if (user) {
                                openPermissionModal(user);
                            }
                        }
                    });
                }
            }
            // --- END: NEW PERMISSION CARD EVENTS ---

            // --- 4. Class Defaults Population (FIXED) ---
            const settingsForm = container.querySelector('#adminSettingsForm');
            if (settingsForm) {
                const defaults = appState.studioSettings.clsDefaults || {};
                const inputTime = settingsForm.querySelector('#defaultTime');
                if (inputTime) inputTime.value = defaults.time || '';
                
                settingsForm.querySelector('#defaultDuration').value = defaults.duration || 60;
                settingsForm.querySelector('#defaultCredits').value = defaults.credits !== undefined ? defaults.credits : 1;
                settingsForm.querySelector('#defaultMaxParticipants').value = defaults.maxParticipants || 10;
                settingsForm.querySelector('#defaultCancellationCutoff').value = defaults.cancellationCutoff || 0;
                settingsForm.querySelector('#defaultEstAttendance').value = defaults.defaultEstAttendance || '';
                
                settingsForm.onsubmit = handleAdminSettingsSave;
            }

            // --- 5. Export Schedule Initialization (FIXED) ---
            const exportScheduleMonth = container.querySelector('#exportScheduleMonth');
            const exportBranchContainer = container.querySelector('#exportScheduleBranchContainer');
            const exportBranchWrapper = container.querySelector('#exportScheduleBranchWrapper');
            const btnExportSchedule = container.querySelector('#btnAdminExportSchedule');

            // Setup Options
            const schedulePeriodsSnapshot = await database.ref('/clsMonths').once('value');
            const schedPeriods = schedulePeriodsSnapshot.exists() ? Object.keys(schedulePeriodsSnapshot.val()).sort().reverse() : [];
            
            let optionsHTML = `
                <optgroup label="${_('label_quick_options') || 'Quick Options'}">
                    <option value="this_week">${_('option_this_week') || 'This Week'}</option>
                    <option value="next_week">${_('option_next_week') || 'Next Week'}</option>
                    <option value="next_2_weeks">${_('option_next_2_weeks') || 'Next 2 Weeks'}</option>
                </optgroup>
                <optgroup label="${_('label_months') || 'Months'}">
            `;
            if (schedPeriods.length > 0) {
                optionsHTML += schedPeriods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            } else {
                optionsHTML += `<option value="" disabled>${_('label_no_months_available')}</option>`;
            }
            optionsHTML += `</optgroup>`;
            
            if (exportScheduleMonth) {
                exportScheduleMonth.innerHTML = optionsHTML;
                exportScheduleMonth.value = 'this_week';
            }

            // Setup Branch Segmented Control
            const branches = appState.branches || [];
            let exportSelectedBranchId = branches.length > 0 ? branches[0].id : null;

            if (branches.length > 1 && exportBranchContainer) {
                exportBranchContainer.classList.remove('hidden');
                const renderBranchButtons = () => {
                    exportBranchWrapper.innerHTML = branches.map(b => {
                        const isActive = b.id === exportSelectedBranchId;
                        const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                        const activeStyle = isActive ? `background-color: #ffffff; color: ${b.color || '#6366f1'}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` : '';
                        const baseClass = 'flex-1 py-2 px-4 text-sm font-bold rounded-md transition-all whitespace-nowrap';
                        const stateClass = isActive ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50';
                        return `<button type="button" class="${baseClass} ${stateClass}" style="${activeStyle}" data-branch-id="${b.id}">${bName}</button>`;
                    }).join('');
                };
                renderBranchButtons();
                exportBranchWrapper.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (btn) {
                        exportSelectedBranchId = btn.dataset.branchId;
                        renderBranchButtons(); 
                    }
                });
            }

            // Setup Export Button
            if (btnExportSchedule) {
                btnExportSchedule.onclick = async () => {
                    const selectedVal = exportScheduleMonth.value;
                    if (!selectedVal) return;
                    const originalBtnText = btnExportSchedule.innerHTML;
                    btnExportSchedule.disabled = true;
                    btnExportSchedule.innerHTML = _('status_exporting') || 'Exporting...';
                    
                    try {
                        let start, end, filenamePeriod;
                        const getExportDateRange = (type) => {
                            const now = new Date();
                            const dayOfWeek = now.getDay();
                            const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
                            const mondayThisWeek = new Date(now);
                            mondayThisWeek.setDate(now.getDate() - distToMonday);
                            const mondayNextWeek = new Date(mondayThisWeek);
                            mondayNextWeek.setDate(mondayThisWeek.getDate() + 7);
                            let s, e;
                            if (type === 'this_week') { s = mondayThisWeek; e = new Date(mondayThisWeek); e.setDate(e.getDate() + 6); } 
                            else if (type === 'next_week') { s = mondayNextWeek; e = new Date(mondayNextWeek); e.setDate(e.getDate() + 6); } 
                            else if (type === 'next_2_weeks') { s = mondayNextWeek; e = new Date(mondayNextWeek); e.setDate(e.getDate() + 13); }
                            return { start: getIsoDate(s), end: getIsoDate(e) };
                        };

                        if (['this_week', 'next_week', 'next_2_weeks'].includes(selectedVal)) {
                            const range = getExportDateRange(selectedVal);
                            start = range.start; end = range.end; filenamePeriod = selectedVal;
                        } else {
                            start = `${selectedVal}-01`; end = `${selectedVal}-31`; filenamePeriod = selectedVal;
                        }

                        const snapshot = await database.ref('/classes').orderByChild('date').startAt(start).endAt(end).once('value');
                        let classes = firebaseObjectToArray(snapshot.val());

                        if (exportSelectedBranchId) classes = classes.filter(c => (c.branchId || branches[0]?.id) === exportSelectedBranchId);
                        
                        if (classes.length === 0) { showMessageBox(_('info_no_data_to_export'), 'info'); return; }

                        classes.sort((a, b) => { const d = a.date.localeCompare(b.date); return d !== 0 ? d : a.time.localeCompare(b.time); });

                        const exportData = classes.map(cls => {
                            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                            const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                            const bObj = branches.find(b => b.id === exportSelectedBranchId);
                            const bName = bObj ? ((appState.currentLanguage === 'zh-TW' && bObj.name_zh) ? bObj.name_zh : bObj.name) : '';
                            const dObj = new Date(cls.date);
                            const dayName = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' }).format(dObj);
                            
                            return {
                                [_('export_header_date')]: cls.date,
                                [_('export_header_day') || 'Day']: dayName,
                                [_('export_header_start_time')]: getTimeRange(cls.time, cls.duration),
                                [_('export_header_class_name')]: getSportTypeName(sportType),
                                [_('export_header_tutor_name')]: tutor?.name || _('unknown_tutor'),
                                [_('label_branch')]: bName,
                                [_('label_credits')]: cls.credits,
                                [_('export_header_capacity')]: cls.maxParticipants
                            };
                        });

                        const bObj = branches.find(b => b.id === exportSelectedBranchId);
                        const safeBranchName = (bObj ? ((appState.currentLanguage === 'zh-TW' && bObj.name_zh) ? bObj.name_zh : bObj.name) : 'Main_Studio').replace(/\s+/g, '_');
                        exportToCsv(`schedule_${filenamePeriod}_${safeBranchName}`, exportData);

                    } catch (err) { console.error(err); showMessageBox("Export failed", "error"); }
                    finally { btnExportSchedule.disabled = false; btnExportSchedule.innerHTML = originalBtnText; }
                };
            }

        } catch (e) {
            console.error("Error initializing admin page:", e);
        }

        // --- 6. Final UI Updates ---
        updateUIText();
        setLanguage(appState.currentLanguage, false);
    }

    function renderAdminLists() {
        const { itemsPerPage } = appState;

        // --- 1. PLAN LIMITS LOGIC ---
        const plan = (appState.studioPlan || appState.currentUser?.subscriptionStatus || 'basic').toLowerCase();
        
        const PLAN_LIMITS = {
            basic: { creditTypes: 2, monthlyTiers: 1, branches: 1, formulas: 0 },
            pro: { creditTypes: 5, monthlyTiers: 3, branches: 1, formulas: 3 },
            premium: { creditTypes: Infinity, monthlyTiers: Infinity, branches: Infinity, formulas: Infinity }
        };

        const currentLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;

        const applyLimitToButton = (btnId, currentCount, limit, limitName) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            if (currentCount >= limit) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                // Remove hover effects to visually indicate disabled state clearly
                btn.classList.remove('hover:bg-blue-700', 'hover:bg-emerald-700', 'hover:bg-teal-700', 'hover:bg-orange-600', 'hover:bg-fuchsia-700', 'hover:bg-indigo-700');
                
                const msg = _('error_plan_limit_reached') || 'Plan limit reached';
                btn.title = `${msg} (${currentCount}/${limit})`;
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.title = '';
            }
        };
        // ---------------------------

        // Helper to generate the stacked arrow buttons
        const getMoveButtons = (type, id, index, totalLength) => {
            const isFirst = index === 0;
            const isLast = index === totalLength - 1;
            
            const baseClass = "move-btn p-0.5 rounded hover:bg-slate-200 transition text-slate-500 hover:text-indigo-600 leading-none flex items-center justify-center h-4 w-5";
            const disabledClass = "opacity-20 cursor-default pointer-events-none";

            return `
            <div class="flex flex-col mr-2 space-y-0.5">
                <button class="${baseClass} ${isFirst ? disabledClass : ''}" data-type="${type}" data-id="${id}" data-direction="up" title="${_('tooltip_move_up')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button class="${baseClass} ${isLast ? disabledClass : ''}" data-type="${type}" data-id="${id}" data-direction="down" title="${_('tooltip_move_down')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>
            `;
        };

        // 0. RENDER LOCATIONS (BRANCHES)
        const locationsList = document.getElementById('locationsList');
        const locationsHeader = document.getElementById('locationsHeader');
        if (locationsList && locationsHeader) {
            const branches = appState.branches || [];
            locationsHeader.textContent = `${_('header_locations')} (${branches.length})`;
            
            // Apply Limit Logic
            applyLimitToButton('addLocationBtn', branches.length, currentLimits.branches, 'locations');
            
            if (branches.length === 0) {
                locationsList.innerHTML = `<li class="text-center text-slate-500 p-4">${_('info_no_locations_found')}</li>`;
            } else {
                locationsList.innerHTML = branches.map((branch, idx) => {
                    const moveBtns = getMoveButtons('branch', branch.id, idx, branches.length);
                    const displayName = (appState.currentLanguage === 'zh-TW' && branch.name_zh) ? branch.name_zh : branch.name;
                    const displayAddress = (appState.currentLanguage === 'zh-TW' && branch.address_zh) ? branch.address_zh : (branch.address || '');

                    return `
                    <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                        <div class="flex items-center gap-3">
                            <span class="admin-color-dot" style="--dot-color: ${branch.color || '#ccc'}"></span>
                            <div>
                                <p class="text-slate-700 font-semibold leading-tight">${displayName}</p>
                                ${displayAddress ? `<p class="text-xs text-slate-500">${displayAddress}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${moveBtns}
                            <button class="edit-btn font-semibold text-indigo-600" data-type="branch" data-id="${branch.id}">${_('btn_edit')}</button>
                            <button type="button" class="delete-btn font-semibold text-red-600" data-type="branch" data-id="${branch.id}" data-name="${displayName}">${_('btn_delete')}</button>
                        </div>
                    </li>`;
                }).join('');
            }
        }

        // 1. RENDER SPORT TYPES (No Limits defined in requirements, kept standard)
        const sportsList = document.getElementById('sportsList');
        const sportsPaginationContainer = document.getElementById('sportsPagination');
        const sportsHeader = document.getElementById('sportsHeader');

        if (sportsList && sportsPaginationContainer && sportsHeader) {
            sportsHeader.textContent = `${_('header_sport_types')} (${appState.sportTypes.length})`;
            const sportSearchTerm = appState.searchTerms.sports.toLowerCase();
            const filteredSports = appState.sportTypes.filter(st => st.name.toLowerCase().includes(sportSearchTerm));
            
            const sportsTotalPages = Math.ceil(filteredSports.length / itemsPerPage.sports) || 1;
            let sportPage = appState.pagination.sports.page;
            if (sportPage > sportsTotalPages) sportPage = sportsTotalPages;
            
            const paginatedSports = filteredSports.slice((sportPage - 1) * itemsPerPage.sports, sportPage * itemsPerPage.sports);
            const startIndex = (sportPage - 1) * itemsPerPage.sports;

            sportsList.innerHTML = paginatedSports.map((st, idx) => {
                const sportName = getSportTypeName(st); 
                const absoluteIndex = startIndex + idx;
                const moveBtns = getMoveButtons('sportType', st.id, absoluteIndex, filteredSports.length);

                return `
                <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                    <div class="flex items-center gap-3"><span class="admin-color-dot" style="--dot-color: ${st.color}"></span><span class="text-slate-700 font-semibold">${sportName}</span></div>
                    <div class="flex items-center gap-2">
                        ${moveBtns}
                        <button class="edit-btn font-semibold text-indigo-600" data-type="sportType" data-id="${st.id}">${_('btn_edit')}</button>
                        <button type="button" class="delete-btn font-semibold text-red-600" data-type="sportType" data-id="${st.id}" data-name="${sportName}">${_('btn_delete')}</button>
                    </div>
                </li>`
            }).join('') || `<li class="text-center text-slate-500 p-4">${_('info_no_sport_types_found')}</li>`;
            
            renderPaginationControls(sportsPaginationContainer, sportPage, sportsTotalPages, filteredSports.length, itemsPerPage.sports, (newPage) => {
                appState.pagination.sports.page = newPage;
                renderAdminLists();
            });
        }

        // 2. RENDER CREDIT TYPES
        const creditTypesList = document.getElementById('creditTypesList');
        const creditTypesCount = document.getElementById('creditTypesCount'); 

        if (creditTypesList) {
            const credits = appState.creditTypes || [];
            if (creditTypesCount) creditTypesCount.textContent = `(${credits.length})`;

            // Apply Limit Logic
            applyLimitToButton('addCreditTypeBtn', credits.length, currentLimits.creditTypes, 'credit types');

            if (credits.length === 0) {
                creditTypesList.innerHTML = `<li class="text-center text-slate-500 p-4">${_('info_no_credit_types_found')}</li>`;
            } else {
                creditTypesList.innerHTML = credits.map((ct, idx) => {
                    const creditName = getCreditTypeName(ct);
                    const moveBtns = getMoveButtons('creditType', ct.id, idx, credits.length);
                    const globalAccessBadge = ct.allowGlobalAccess === false 
                        ? `<span class="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">${_('label_home_only')}</span>` : '';

                    return `
                    <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                        <div class="flex items-center gap-3">
                            <span class="admin-color-dot" style="--dot-color: ${ct.color || '#ccc'}"></span>
                            <span class="text-slate-700 font-semibold">${creditName} ${globalAccessBadge}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${moveBtns}
                            <button class="edit-btn font-semibold text-indigo-600" data-type="creditType" data-id="${ct.id}">${_('btn_edit')}</button>
                            <button type="button" class="delete-btn font-semibold text-red-600" data-type="creditType" data-id="${ct.id}" data-name="${creditName}">${_('btn_delete')}</button>
                        </div>
                    </li>`;
                }).join('');
            }
        }

        // 3. RENDER MONTHLY PLAN TIERS
        const monthlyTiersList = document.getElementById('monthlyTiersList');
        const monthlyTiersCount = document.getElementById('monthlyTiersCount');

        if (monthlyTiersList) {
            const tiers = appState.monthlyPlanTiers || [];
            if (monthlyTiersCount) monthlyTiersCount.textContent = `(${tiers.length})`;

            // Apply Limit Logic
            applyLimitToButton('addMonthlyTierBtn', tiers.length, currentLimits.monthlyTiers, 'monthly tiers');

            if (tiers.length === 0) {
                monthlyTiersList.innerHTML = `<li class="text-center text-slate-500 p-4">${_('info_no_monthly_tiers_found')}</li>`;
            } else {
                monthlyTiersList.innerHTML = tiers.map((tier, idx) => {
                    const tierName = getMonthlyPlanName(tier);
                    const moveBtns = getMoveButtons('monthlyTier', tier.id, idx, tiers.length);
                    const globalAccessBadge = tier.allowGlobalAccess === false 
                        ? `<span class="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded ml-2">Home Only</span>` : '';

                    return `
                    <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                        <div class="flex items-center gap-3">
                            <span class="admin-color-dot" style="--dot-color: ${tier.color || '#ccc'}"></span>
                            <span class="text-slate-700 font-semibold">${tierName} ${globalAccessBadge}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${moveBtns}
                            <button class="edit-btn font-semibold text-indigo-600" data-type="monthlyTier" data-id="${tier.id}">${_('btn_edit')}</button>
                            <button type="button" class="delete-btn font-semibold text-red-600" data-type="monthlyTier" data-id="${tier.id}" data-name="${tierName}">${_('btn_delete')}</button>
                        </div>
                    </li>`;
                }).join('');
            }
        }

        // 4. RENDER TUTORS (No Limits defined in requirements)
        const tutorsList = document.getElementById('tutorsList');
        const tutorsPaginationContainer = document.getElementById('tutorsPagination');
        const tutorsHeader = document.getElementById('tutorsHeader');
        if (tutorsList && tutorsPaginationContainer && tutorsHeader) {
            tutorsHeader.textContent = `${_('header_tutors')} (${appState.tutors.length})`;
            const tutorSearchTerm = appState.searchTerms.tutors.toLowerCase();
            const filteredTutors = appState.tutors.filter(t => t.name.toLowerCase().includes(tutorSearchTerm) || (t.email && t.email.toLowerCase().includes(tutorSearchTerm)));

            const tutorsTotalPages = Math.ceil(filteredTutors.length / itemsPerPage.tutors) || 1;
            let tutorPage = appState.pagination.tutors.page;
            if (tutorPage > tutorsTotalPages) tutorPage = tutorsTotalPages;

            const paginatedTutors = filteredTutors.slice((tutorPage - 1) * itemsPerPage.tutors, tutorPage * itemsPerPage.tutors);
            const startIndex = (tutorPage - 1) * itemsPerPage.tutors;

            tutorsList.innerHTML = paginatedTutors.map((t, idx) => {
                const skillsHtml = t.skills && t.skills.map(skill => {
                    const sportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                    return sportType ? `<span class="text-xs font-medium me-2 px-2.5 py-0.5 rounded-full" style="background-color:${sportType.color}20; color:${sportType.color};">${getSportTypeName(sportType)}</span>` : '';
                }).join('');
                
                const absoluteIndex = startIndex + idx;
                const moveBtns = getMoveButtons('tutor', t.id, absoluteIndex, filteredTutors.length);

                return `
                 <li class="flex justify-between items-center bg-slate-100 p-3 rounded-md min-h-[68px]">
                    <div>
                        <p class="text-slate-700 font-semibold">${t.name}</p>
                        <div class="flex flex-wrap gap-1 mt-1">${skillsHtml || ''}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${moveBtns}
                        <button class="edit-btn font-semibold text-indigo-600" data-type="tutor" data-id="${t.id}">${_('btn_edit')}</button>
                        <button type="button" class="delete-btn font-semibold text-red-600" data-type="tutor" data-id="${t.id}" data-name="${t.name}">${_('btn_delete')}</button>
                    </div>
                </li>`
            }).join('') || `<li class="text-center text-slate-500 p-4">${_('info_no_tutors_found')}</li>`;
            
            renderPaginationControls(tutorsPaginationContainer, tutorPage, tutorsTotalPages, filteredTutors.length, itemsPerPage.tutors, (newPage) => {
                appState.pagination.tutors.page = newPage;
                renderAdminLists();
            });
        }

        // 5. RENDER SALARY FORMULAS
        const formulasList = document.getElementById('formulasList');
        const formulasHeader = document.getElementById('formulasHeader');

        if (formulasList) {
            const formulas = appState.salaryFormulas || [];
            const activeFormulas = formulas.filter(f => !f.isDeleted);

            if (formulasHeader) {
                formulasHeader.textContent = `${_('header_salary_formulas')} (${activeFormulas.length})`;
            }

            // Apply Limit Logic (Basic plan users won't see this card, but logic is safe)
            applyLimitToButton('btnAddFormula', activeFormulas.length, currentLimits.formulas, 'formulas');

            if (activeFormulas.length === 0) {
                formulasList.innerHTML = `<li class="text-center text-slate-500 p-4">${_('info_no_formulas_found') || 'No formulas defined'}</li>`;
            } else {
                formulasList.innerHTML = activeFormulas.map(f => `
                    <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                        <div class="font-mono text-sm font-bold text-slate-700 px-2">${f.name}</div>
                        <div class="flex items-center gap-2">
                            <button class="edit-btn font-semibold text-indigo-600" data-type="formula" data-id="${f.id}">${_('btn_edit')}</button>
                            <button type="button" class="delete-btn font-semibold text-red-600" data-type="formula" data-id="${f.id}" data-name="${f.name}">${_('btn_delete')}</button>
                        </div>
                    </li>
                `).join('');
            }
        }
    }

    function handleAdminItemDelete(type, id, name) {
        // 1. Data Integrity Check
        let isInUse = false;
        let errorMsg = '';

        if (type === 'sportType') {
            isInUse = appState.classes.some(c => c.sportTypeId === id);
            errorMsg = _('error_cannot_delete_item_in_use').replace('{name}', name);
        } else if (type === 'tutor') {
            isInUse = appState.classes.some(c => c.tutorId === id);
            errorMsg = _('error_cannot_delete_item_in_use').replace('{name}', name);
        } else if (type === 'creditType') {
            isInUse = appState.users.some(u => {
                const wallet = getMemberWallet(u);
                return wallet[id] && wallet[id].balance > 0;
            });
            if (isInUse) {
                errorMsg = _('error_cannot_delete_credit_type_in_use').replace('{name}', name);
            }
        } else if (type === 'monthlyTier') {
            isInUse = appState.users.some(u => u.monthlyPlan && u.monthlyPlanTierId === id);
            if (isInUse) {
                errorMsg = _('error_cannot_delete_tier_in_use').replace('{name}', name);
            }
        } else if (type === 'branch') {
            // NEW: Safety check for branches
            const hasClasses = appState.classes.some(c => c.branchId === id);
            const hasUsers = appState.users.some(u => u.homeBranchId === id);
            
            if (hasClasses || hasUsers) {
                isInUse = true;
                // Reuse the generic "in use" message
                errorMsg = _('error_cannot_delete_item_in_use').replace('{name}', name);
            }
        }

        if (isInUse) {
            showMessageBox(errorMsg, 'error');
            return; // Stop the deletion process
        }

        let itemTypeText = '';
        if (type === 'sportType') itemTypeText = _('label_sport_type_item');
        else if (type === 'tutor') itemTypeText = _('label_tutor_item');
        else if (type === 'creditType') itemTypeText = _('label_credit_type');
        else if (type === 'monthlyTier') itemTypeText = _('label_monthly_tier');
        else if (type === 'branch') itemTypeText = _('label_location_name') || 'Location'; // Fallback
        
        // 2. Confirmation Dialog
        const title = _('confirm_delete_generic_title').replace('{type}', itemTypeText);
        const message = _('confirm_delete_generic_desc').replace('{name}', name);
        
        showConfirmation(title, message, () => {
            // 3. Deletion from Firebase
            let path = '';
            if (type === 'sportType') path = '/sportTypes/';
            else if (type === 'tutor') path = '/tutors/';
            else if (type === 'creditType') path = '/creditTypes/';
            else if (type === 'monthlyTier') path = '/monthlyPlanTiers/';
            else if (type === 'branch') path = '/branches/'; // <--- THIS WAS MISSING

            database.ref(path + id).remove()
                .then(() => {
                    showMessageBox(_('info_item_deleted').replace('{type}', itemTypeText), 'info');
                })
                .catch(error => {
                    showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
                });
        });
    }

    function handleAdminItemReorder(type, id, direction) {
        // Map the internal type string to the appState key and Firebase path
        const config = {
            sportType: { stateKey: 'sportTypes', path: '/sportTypes' },
            tutor: { stateKey: 'tutors', path: '/tutors' },
            creditType: { stateKey: 'creditTypes', path: '/creditTypes' },
            monthlyTier: { stateKey: 'monthlyPlanTiers', path: '/monthlyPlanTiers' },
            // ADDED: Configuration for branch sorting
            branch: { stateKey: 'branches', path: '/branches' }
        };

        const settings = config[type];
        if (!settings) return;

        // Create a shallow copy of the array to manipulate
        const list = [...appState[settings.stateKey]];
        const currentIndex = list.findIndex(item => item.id === id);

        if (currentIndex === -1) return;

        // Calculate swap target
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        // Boundary checks
        if (targetIndex < 0 || targetIndex >= list.length) return;

        // Swap the items in the array
        [list[currentIndex], list[targetIndex]] = [list[targetIndex], list[currentIndex]];

        // Prepare batch update for Firebase
        // We re-assign the 'order' field for ALL items to ensure clean, 0-indexed sequencing
        const updates = {};
        list.forEach((item, index) => {
            updates[`${settings.path}/${item.id}/order`] = index;
        });

        // Apply updates
        database.ref().update(updates).catch(error => {
            console.error("Reorder failed:", error);
            showMessageBox(_('error_generic'), 'error');
        });
    }

    function handleAdminListClick(e) {
        // Added .move-btn to the selector
        const target = e.target.closest('.edit-btn, .delete-btn, .move-btn');
        if (!target) return;

        const { type, id, name, direction } = target.dataset;

        if (target.classList.contains('edit-btn')) {
            if (type === 'sportType') {
                openSportTypeModal(appState.sportTypes.find(st => st.id === id));
            } else if (type === 'tutor') {
                openTutorModal(appState.tutors.find(t => t.id === id));
            } else if (type === 'creditType') {
                openCreditTypeModal(appState.creditTypes.find(ct => ct.id === id));
            } else if (type === 'monthlyTier') {
                openMonthlyPlanTierModal(appState.monthlyPlanTiers.find(t => t.id === id));
            } else if (type === 'branch') {
                openBranchModal(appState.branches.find(b => b.id === id));
            }
        } else if (target.classList.contains('delete-btn')) {
            handleAdminItemDelete(type, id, name);
        } else if (target.classList.contains('move-btn')) {
            // New logic handler
            handleAdminItemReorder(type, id, direction);
        }
    }

    function openBranchModal(branchToEdit = null) {
        // Re-use SportType modal styling for consistency, replacing content dynamically
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="branchModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">
                    ${branchToEdit ? _('title_edit_location') : _('title_add_location')}
                </h2>
                <form id="branchForm">
                    <input type="hidden" id="branchModalId">
                    <div class="space-y-4">
                        <!-- Name English -->
                        <div>
                            <label for="branchName" data-lang-key="label_name_en" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="branchName" class="form-input" placeholder="${_('placeholder_branch_name_en')}" required>
                        </div>
                        <!-- Name Chinese -->
                        <div>
                            <label for="branchNameZh" data-lang-key="label_name_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="branchNameZh" class="form-input" placeholder="${_('placeholder_branch_name_zh')}">
                        </div>
                        
                        <!-- Address English -->
                        <div>
                            <label for="branchAddress" data-lang-key="label_address_en" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="branchAddress" class="form-input" placeholder="${_('placeholder_branch_address_en')}">
                        </div>
                        <!-- Address Chinese -->
                        <div>
                            <label for="branchAddressZh" data-lang-key="label_address_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="branchAddressZh" class="form-input" placeholder="${_('placeholder_branch_address_zh')}">
                        </div>

                        <div>
                            <label data-lang-key="label_color" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <div id="colorPickerContainer" class="color-swatch-container"></div>
                            <input type="hidden" id="branchColor">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" data-lang-key="btn_save_changes" class="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-8 rounded-lg"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.sportTypeModal;
        const form = modal.querySelector('form');
        
        // Using default CLS_COLORS imported in script.js
        // Re-use the existing renderColorPicker utility
        
        if (branchToEdit) {
            form.querySelector('#branchModalId').value = branchToEdit.id;
            form.querySelector('#branchName').value = branchToEdit.name;
            form.querySelector('#branchNameZh').value = branchToEdit.name_zh || '';
            form.querySelector('#branchAddress').value = branchToEdit.address || '';
            form.querySelector('#branchAddressZh').value = branchToEdit.address_zh || '';
            form.querySelector('#branchColor').value = branchToEdit.color;
        } else {
            form.querySelector('#branchModalId').value = '';
            form.querySelector('#branchColor').value = '#22c55e'; // Default Green-ish for branches
        }

        renderColorPicker(form.querySelector('#colorPickerContainer'), form.querySelector('#branchColor'));
        
        form.onsubmit = handleBranchFormSubmit;
        openModal(modal);
        updateUIText(); 
    }

    function handleBranchFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#branchModalId').value;
        
        // Trigger if we are adding a NEW branch (no id), and we currently have exactly 1 branch.
        // This implies we are moving from a single-location setup to a multi-location setup.
        const isSecondBranchCreation = appState.branches.length === 1 && !id;
        
        const branchData = {
            name: form.querySelector('#branchName').value.trim(),
            name_zh: form.querySelector('#branchNameZh').value.trim(),
            address: form.querySelector('#branchAddress').value.trim(),
            address_zh: form.querySelector('#branchAddressZh').value.trim(),
            color: form.querySelector('#branchColor').value
        };

        if (!branchData.name) {
            showMessageBox(_('error_location_name_required'), 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        let promise;
        let newBranchId = id; // Store ID for migration

        if (id) {
            promise = database.ref('/branches/' + id).update(branchData);
        } else {
            // Auto-assign order
            const totalItems = (appState.branches || []).length;
            branchData.order = totalItems;
            
            const newRef = database.ref('/branches').push();
            newBranchId = newRef.key;
            promise = newRef.set(branchData);
        }

        promise.then(() => {
            closeModal(DOMElements.sportTypeModal);
            const message = id ? _('success_location_updated') : _('success_location_added');
            showMessageBox(message, 'success');

            // --- CHANGED: Trigger on 2nd creation, but migrate to the FIRST branch ---
            if (isSecondBranchCreation) {
                setTimeout(() => {
                    // Identify the Main/Legacy branch (the existing one)
                    const mainBranch = appState.branches[0];
                    if (!mainBranch) return;

                    const branchName = (appState.currentLanguage === 'zh-TW' && mainBranch.name_zh) ? mainBranch.name_zh : mainBranch.name;
                    
                    showConfirmation(
                        _('title_migrate_legacy_branch'),
                        _('desc_migrate_legacy_branch').replace('{branch}', branchName),
                        // Pass the Main Branch ID, not the new one
                        () => performBranchMigration(mainBranch.id, branchName)
                    );
                }, 300);
            }
        })
        .catch(err => showMessageBox(err.message, 'error'))
        .finally(() => {
            submitBtn.disabled = false;
        });
    }

    function openCreditTypeModal(creditTypeToEdit = null) {
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="creditTypeModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">
                    ${creditTypeToEdit ? _('title_edit_credit_type') : _('title_add_credit_type')}
                </h2>
                <form id="creditTypeForm">
                    <input type="hidden" id="creditTypeModalId">
                    <div class="space-y-4">
                        <div>
                            <label for="creditTypeName" data-lang-key="label_name_en" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="creditTypeName" class="form-input" placeholder="${_('placeholder_credit_name_en')}" required>
                        </div>
                        <div>
                            <label for="creditTypeNameZh" data-lang-key="label_name_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="creditTypeNameZh" class="form-input" placeholder="${_('placeholder_credit_name_zh')}">
                        </div>
                        
                        <!-- Global Access Toggle (Conditional) -->
                        <div id="globalAccessContainer" class="hidden pt-2 border-t border-slate-100">
                            <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_access_settings')}</label>
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" id="allowGlobalAccess" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked>
                                <span class="ml-2 text-sm text-slate-700 font-semibold">${_('label_allow_global_access')}</span>
                            </label>
                            <p class="text-xs text-slate-500 mt-1 ml-6">${_('desc_allow_global_access')}</p>
                        </div>

                        <div>
                            <label data-lang-key="label_color" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <div id="colorPickerContainer" class="color-swatch-container"></div>
                            <input type="hidden" id="creditTypeColor">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" data-lang-key="btn_save_changes" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-lg"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.sportTypeModal; 
        const form = modal.querySelector('form');
        const globalAccessContainer = form.querySelector('#globalAccessContainer');
        
        // Logic: Only show this setting if we have multiple branches
        const hasMultipleBranches = appState.branches && appState.branches.length > 1;
        if (hasMultipleBranches) {
            globalAccessContainer.classList.remove('hidden');
        }

        if (creditTypeToEdit) {
            form.querySelector('#creditTypeModalId').value = creditTypeToEdit.id;
            form.querySelector('#creditTypeName').value = creditTypeToEdit.name;
            form.querySelector('#creditTypeNameZh').value = creditTypeToEdit.name_zh || ''; 
            form.querySelector('#creditTypeColor').value = creditTypeToEdit.color;
            
            // Handle boolean flag. Default to true (undefined/null -> true) for backward compatibility
            const isGlobal = creditTypeToEdit.allowGlobalAccess !== false;
            form.querySelector('#allowGlobalAccess').checked = isGlobal;
        } else {
            form.querySelector('#creditTypeModalId').value = '';
            form.querySelector('#creditTypeColor').value = '#ef4444'; // Default red
            form.querySelector('#allowGlobalAccess').checked = true; // Default new types to global
        }

        renderColorPicker(form.querySelector('#colorPickerContainer'), form.querySelector('#creditTypeColor'));
        
        form.onsubmit = handleCreditTypeFormSubmit;
        openModal(modal);
        updateUIText(); 
    }

    function handleCreditTypeFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#creditTypeModalId').value;
        
        const isFirstCreation = appState.creditTypes.length === 0 && !id;
        
        const creditData = {
            name: form.querySelector('#creditTypeName').value.trim(),
            name_zh: form.querySelector('#creditTypeNameZh').value.trim(), 
            color: form.querySelector('#creditTypeColor').value,
            // Capture the boolean flag
            allowGlobalAccess: form.querySelector('#allowGlobalAccess').checked
        };

        if (!creditData.name) {
            showMessageBox('Name is required.', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        let promise;
        let newTypeId = id;

        if (id) {
            promise = database.ref('/creditTypes/' + id).update(creditData);
        } else {
            const newRef = database.ref('/creditTypes').push();
            newTypeId = newRef.key;
            promise = newRef.set(creditData);
        }

        promise.then(() => {
            closeModal(DOMElements.sportTypeModal);
            const message = id ? _('success_credit_type_updated') : _('success_credit_type_added');
            showMessageBox(message, 'success');

            if (isFirstCreation) {
                setTimeout(() => {
                    const typeName = (appState.currentLanguage === 'zh-TW' && creditData.name_zh) ? creditData.name_zh : creditData.name;
                    showConfirmation(
                        _('title_migrate_legacy_credits'),
                        _('desc_migrate_legacy_credits').replace('{type}', typeName),
                        () => performCreditMigration(newTypeId, typeName)
                    );
                }, 300);
            }
        })
        .catch(err => showMessageBox(err.message, 'error'))
        .finally(() => {
            submitBtn.disabled = false;
        });
    }

    async function performCreditMigration(newTypeId, typeName) {
        showMessageBox(_('status_please_wait'), 'info');

        try {
            // 1. Fetch all users
            const snapshot = await database.ref('/users').once('value');
            const usersObj = snapshot.val() || {};
            
            const updates = {};
            let migrationCount = 0;
            let cleanupCount = 0;

            // 2. Iterate and find eligible members
            Object.entries(usersObj).forEach(([userId, user]) => {
                // Check: Is User? Not Deleted? Has Legacy Credits field?
                if (user.role === 'member' && !user.isDeleted && user.credits !== undefined) {
                    
                    const legacyBalance = parseFloat(user.credits || 0);
                    const legacyInitial = parseFloat(user.initialCredits || 0);
                    const legacyExpiry = user.expiryDate || null;

                    // CHECK: Is this a "Pure Monthly" member? (Monthly Plan + No Credit Balance)
                    const isPureMonthly = user.monthlyPlan && legacyBalance === 0 && legacyInitial === 0;

                    if (isPureMonthly) {
                        // Just clean up the legacy fields, do NOT create a wallet
                        updates[`/users/${userId}/credits`] = null;
                        updates[`/users/${userId}/initialCredits`] = null;
                        updates[`/users/${userId}/expiryDate`] = null;
                        cleanupCount++;
                    } else {
                        // Real Credit User: Migrate to Wallet
                        
                        // A. Move to Wallet
                        updates[`/users/${userId}/wallet/${newTypeId}/balance`] = legacyBalance;
                        updates[`/users/${userId}/wallet/${newTypeId}/initialCredits`] = legacyInitial;
                        updates[`/users/${userId}/wallet/${newTypeId}/expiryDate`] = legacyExpiry;

                        // B. Tag Purchase History
                        if (user.purchaseHistory) {
                            Object.keys(user.purchaseHistory).forEach(purchaseId => {
                                updates[`/users/${userId}/purchaseHistory/${purchaseId}/creditTypeId`] = newTypeId;
                            });
                        }

                        // C. Clean up Legacy Fields
                        updates[`/users/${userId}/credits`] = null;
                        updates[`/users/${userId}/initialCredits`] = null;
                        updates[`/users/${userId}/expiryDate`] = null;

                        migrationCount++;
                    }
                }
            });

            // 3. Apply Updates
            if (Object.keys(updates).length > 0) {
                await database.ref().update(updates);
                
                let msg = '';
                if (migrationCount > 0) {
                    msg = _('success_migration_complete').replace('{count}', migrationCount).replace('{tier}', typeName);
                } else {
                    msg = _('success_cleanup_complete');
                }
                
                showMessageBox(msg, 'success');
            } else {
                showMessageBox(_('info_no_credits_to_migrate'), 'info');
            }

            // --- CHAINED STEP: Prompt for Class Migration ---
            // After handling members, ask the user if they want to update classes.
            setTimeout(() => {
                showConfirmation(
                    _('title_migrate_classes'),
                    _('desc_migrate_classes').replace('{type}', typeName),
                    () => performClassCreditMigration(newTypeId, typeName)
                );
                
                // Refresh view in background
                if (appState.activePage === 'members' || appState.activePage === 'account') {
                    renderCurrentPage();
                }
            }, 1000); // Slight delay for better UX

        } catch (error) {
            console.error("Credit Migration failed:", error);
            showMessageBox(_('error_generic'), 'error');
        }
    }

    async function performClassCreditMigration(newTypeId, typeName) {
        showMessageBox(_('status_please_wait'), 'info');

        try {
            // 1. Fetch all Classes
            const snapshot = await database.ref('/classes').once('value');
            const classesObj = snapshot.val() || {};
            
            const updates = {};
            let classCount = 0;

            // 2. Iterate and find eligible classes
            // We look for classes that have NO credit type defined (legacy) or are explicitly 'general'
            Object.entries(classesObj).forEach(([clsId, cls]) => {
                if (!cls.costCreditTypeId || cls.costCreditTypeId === 'general') {
                    updates[`/classes/${clsId}/costCreditTypeId`] = newTypeId;
                    classCount++;
                }
            });

            // 3. Apply Updates
            if (Object.keys(updates).length > 0) {
                await database.ref().update(updates);
                
                showMessageBox(
                    _('success_class_migration_complete').replace('{count}', classCount), 
                    'success'
                );

                // Refresh schedule/classes view if active
                if (appState.activePage === 'classes' || appState.activePage === 'schedule') {
                    setTimeout(() => renderCurrentPage(), 500);
                }
            } else {
                showMessageBox(_('info_no_classes_to_migrate'), 'info');
            }

        } catch (error) {
            console.error("Class Migration failed:", error);
            showMessageBox(_('error_generic'), 'error');
        }
    }

    function openMonthlyPlanTierModal(tierToEdit = null) {
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="monthlyTierModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">
                    ${tierToEdit ? _('title_edit_monthly_tier') : _('title_add_monthly_tier')}
                </h2>
                <form id="monthlyTierForm">
                    <input type="hidden" id="monthlyTierModalId">
                    <div class="space-y-4">
                        <div>
                            <label for="monthlyTierName" data-lang-key="label_name_en" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="monthlyTierName" class="form-input" placeholder="e.g., Premium Plan" required>
                        </div>
                        <div>
                            <label for="monthlyTierNameZh" data-lang-key="label_name_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="monthlyTierNameZh" class="form-input" placeholder="e.g., 高級方案">
                        </div>

                        <!-- Global Access Toggle (Conditional) -->
                        <div id="tierGlobalAccessContainer" class="hidden pt-2 border-t border-slate-100">
                            <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_access_settings')}</label>
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" id="tierAllowGlobalAccess" class="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500" checked>
                                <span class="ml-2 text-sm text-slate-700 font-semibold">${_('label_allow_global_access')}</span>
                            </label>
                            <p class="text-xs text-slate-500 mt-1 ml-6">${_('desc_allow_global_access')}</p>
                        </div>

                        <div>
                            <label data-lang-key="label_color" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <div id="colorPickerContainer" class="color-swatch-container"></div>
                            <input type="hidden" id="monthlyTierColor">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" data-lang-key="btn_save_changes" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-8 rounded-lg"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.sportTypeModal;
        const form = modal.querySelector('form');
        const globalAccessContainer = form.querySelector('#tierGlobalAccessContainer');

        const hasMultipleBranches = appState.branches && appState.branches.length > 1;
        if (hasMultipleBranches) {
            globalAccessContainer.classList.remove('hidden');
        }
        
        if (tierToEdit) {
            form.querySelector('#monthlyTierModalId').value = tierToEdit.id;
            form.querySelector('#monthlyTierName').value = tierToEdit.name;
            form.querySelector('#monthlyTierNameZh').value = tierToEdit.name_zh || ''; 
            form.querySelector('#monthlyTierColor').value = tierToEdit.color;
            // Default to true if undefined
            const isGlobal = tierToEdit.allowGlobalAccess !== false;
            form.querySelector('#tierAllowGlobalAccess').checked = isGlobal;
        } else {
            form.querySelector('#monthlyTierModalId').value = '';
            form.querySelector('#monthlyTierColor').value = '#10b981'; // Default Emerald
            form.querySelector('#tierAllowGlobalAccess').checked = true;
        }

        renderColorPicker(form.querySelector('#colorPickerContainer'), form.querySelector('#monthlyTierColor'));
        
        form.onsubmit = handleMonthlyPlanTierFormSubmit;
        openModal(modal);
        updateUIText(); 
    }

    function handleMonthlyPlanTierFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#monthlyTierModalId').value;
        
        const isFirstTierCreation = appState.monthlyPlanTiers.length === 0 && !id;

        const tierData = {
            name: form.querySelector('#monthlyTierName').value.trim(),
            name_zh: form.querySelector('#monthlyTierNameZh').value.trim(),
            color: form.querySelector('#monthlyTierColor').value,
            // Capture boolean flag
            allowGlobalAccess: form.querySelector('#tierAllowGlobalAccess').checked
        };

        if (!tierData.name) {
            showMessageBox('Name is required.', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        let promise;
        let newTierKey = id;

        if (id) {
            promise = database.ref('/monthlyPlanTiers/' + id).update(tierData);
        } else {
            const newRef = database.ref('/monthlyPlanTiers').push();
            newTierKey = newRef.key;
            promise = newRef.set(tierData);
        }

        promise.then(() => {
            closeModal(DOMElements.sportTypeModal); 
            
            const message = id ? _('success_monthly_tier_updated') : _('success_monthly_tier_added');
            showMessageBox(message, 'success');

            if (isFirstTierCreation) {
                setTimeout(() => {
                    const tierName = (appState.currentLanguage === 'zh-TW' && tierData.name_zh) ? tierData.name_zh : tierData.name;
                    
                    showConfirmation(
                        _('title_migrate_legacy_members'),
                        _('desc_migrate_legacy_members').replace('{tier}', tierName),
                        () => performMonthlyTierMigration(newTierKey, tierName)
                    );
                }, 300);
            }
        })
        .catch(err => showMessageBox(err.message, 'error'))
        .finally(() => {
            submitBtn.disabled = false;
        });
    }

    async function performMonthlyTierMigration(newTierId, tierName) {
        showMessageBox(_('status_please_wait'), 'info');

        try {
            // 1. Fetch all users to ensure we have the latest data
            const snapshot = await database.ref('/users').once('value');
            const usersObj = snapshot.val() || {};
            
            const updates = {};
            let migrationCount = 0;

            // 2. Iterate and find eligible members
            Object.entries(usersObj).forEach(([userId, user]) => {
                // Check: Is User? Not Deleted? Is Monthly Plan? Does NOT have a Tier ID?
                if (user.role === 'member' && !user.isDeleted && user.monthlyPlan && !user.monthlyPlanTierId) {
                    // A. Update User Profile to the new Tier
                    updates[`/users/${userId}/monthlyPlanTierId`] = newTierId;
                    migrationCount++;

                    // B. Update Past Payment History (Retrospective Tagging)
                    // This ensures the "Pill" appears correctly for past payments in the UI
                    if (user.paymentHistory) {
                        Object.keys(user.paymentHistory).forEach(paymentId => {
                            updates[`/users/${userId}/paymentHistory/${paymentId}/monthlyPlanTierId`] = newTierId;
                        });
                    }
                }
            });

            // 3. Apply Updates
            if (migrationCount > 0) {
                await database.ref().update(updates);
                showMessageBox(_('success_migration_complete').replace('{count}', migrationCount).replace('{tier}', tierName), 'success');
                
                // Refresh the Admin/Members list view if currently active
                if (appState.activePage === 'members') {
                    // Small delay to allow Firebase listener to update appState first
                    setTimeout(() => renderCurrentPage(), 500);
                }
            } else {
                showMessageBox(_('info_no_members_to_migrate'), 'info');
            }

        } catch (error) {
            console.error("Migration failed:", error);
            showMessageBox(_('error_generic'), 'error');
        }
    }

    async function performBranchMigration(newBranchId, branchName) {
        showMessageBox(_('status_please_wait'), 'info');

        try {
            // 1. Fetch all Classes and Users
            const [classesSnap, usersSnap] = await Promise.all([
                database.ref('/classes').once('value'),
                database.ref('/users').once('value')
            ]);

            const classesObj = classesSnap.val() || {};
            const usersObj = usersSnap.val() || {};
            
            const updates = {};
            let classCount = 0;
            let memberCount = 0;

            // 2. Migrate Classes (Legacy classes have no branchId)
            Object.entries(classesObj).forEach(([clsId, cls]) => {
                if (!cls.branchId) {
                    updates[`/classes/${clsId}/branchId`] = newBranchId;
                    classCount++;
                }
            });

            // 3. Migrate Members (Legacy members have no homeBranchId)
            Object.entries(usersObj).forEach(([userId, user]) => {
                // Only migrate 'member' role. Admins/Staff usually remain global or manual.
                if (user.role === 'member' && !user.isDeleted && !user.homeBranchId) {
                    updates[`/users/${userId}/homeBranchId`] = newBranchId;
                    memberCount++;
                }
            });

            // 4. Apply Updates Atomically
            if (Object.keys(updates).length > 0) {
                await database.ref().update(updates);
                
                const msg = _('success_branch_migration_complete')
                    .replace('{classes}', classCount)
                    .replace('{members}', memberCount)
                    .replace('{branch}', branchName);
                
                showMessageBox(msg, 'success');
                
                // Refresh the current view to reflect changes immediately
                // Small delay ensures Firebase local state is sync'd
                setTimeout(() => {
                    // Update global state selection to prevent "empty" view
                    appState.selectedScheduleBranch = newBranchId;
                    renderCurrentPage();
                }, 500);

            } else {
                showMessageBox(_('info_no_data_to_migrate'), 'info');
            }

        } catch (error) {
            console.error("Branch Migration failed:", error);
            showMessageBox(_('error_generic'), 'error');
        }
    }

    function openSportTypeModal(sportTypeToEdit = null) {
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="sportTypeModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="sportTypeForm">
                    <input type="hidden" id="sportTypeModalId">
                    <div class="space-y-4">
                        <div>
                            <label for="sportTypeName" data-lang-key="admin_sport_type_name" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="sportTypeName" class="form-input" placeholder="${_('placeholder_sport_name_en')}">
                        </div>
                        <div>
                            <label for="sportTypeNameZh" data-lang-key="admin_sport_type_name_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="sportTypeNameZh" class="form-input" placeholder="${_('placeholder_sport_name_zh')}">
                        </div>
                        <div>
                            <label data-lang-key="admin_sport_type_color" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <div id="colorPickerContainer" class="color-swatch-container"></div>
                            <input type="hidden" id="sportTypeColor">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" class="submit-btn bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-8 rounded-lg"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.sportTypeModal;
        const form = modal.querySelector('form');
        form.reset();

        if (sportTypeToEdit) {
            modal.querySelector('#sportTypeModalTitle').dataset.langKey = 'admin_edit_sport_type';
            modal.querySelector('.submit-btn').dataset.langKey = 'btn_save_changes';
            form.querySelector('#sportTypeModalId').value = sportTypeToEdit.id;
            form.querySelector('#sportTypeName').value = sportTypeToEdit.name;
            form.querySelector('#sportTypeNameZh').value = sportTypeToEdit.name_zh || ''; 
            form.querySelector('#sportTypeColor').value = sportTypeToEdit.color;
        } else {
            modal.querySelector('#sportTypeModalTitle').dataset.langKey = 'admin_add_sport_type';
            modal.querySelector('.submit-btn').dataset.langKey = 'admin_add_sport_type';
            form.querySelector('#sportTypeModalId').value = '';
            form.querySelector('#sportTypeColor').value = CLS_COLORS[0];
        }

        renderColorPicker(form.querySelector('#colorPickerContainer'), form.querySelector('#sportTypeColor'));
        form.onsubmit = handleSportTypeFormSubmit;
        openModal(modal);
        updateUIText(); 
    }

    function handleSportTypeFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#sportTypeModalId').value;
        
        // --- START: NEW VALIDATION LOGIC ---
        const nameEn = form.querySelector('#sportTypeName').value.trim();
        const nameZh = form.querySelector('#sportTypeNameZh').value.trim();

        if (!nameEn && !nameZh) {
            showMessageBox(_('error_sport_type_name_required'), 'error');
            return;
        }
        // --- END: NEW VALIDATION LOGIC ---

        const sportTypeData = {
            name: nameEn,
            name_zh: nameZh,
            color: form.querySelector('#sportTypeColor').value
        };

        let promise;
        if (id) {
            promise = database.ref('/sportTypes/' + id).update(sportTypeData);
        } else {
            appState.searchTerms.sports = '';
            const totalItemsAfterAdd = appState.sportTypes.length + 1;
            const itemsPerPage = appState.itemsPerPage.sports;
            const lastPage = Math.ceil(totalItemsAfterAdd / itemsPerPage);
            appState.pagination.sports.page = lastPage;
            promise = database.ref('/sportTypes').push(sportTypeData);
        }
        promise.then(() => {
            const itemType = _('label_sport_type_item');
            const message = id
                ? _('success_item_updated_generic').replace('{type}', itemType)
                : _('success_item_added_generic').replace('{type}', itemType);
            
            showMessageBox(message, 'success');
            closeModal(DOMElements.sportTypeModal);
        });
    }

    function openTutorModal(tutorToEdit = null) {
        DOMElements.tutorModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="tutorModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="tutorForm">
                    <input type="hidden" id="tutorModalId">
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div><label for="tutorName" data-lang-key="label_tutor_name" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="text" id="tutorName" required class="form-input" placeholder="${_('placeholder_tutor_name')}"></div>
                           <div><label for="tutorEmail" data-lang-key="label_email" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="email" id="tutorEmail" class="form-input" placeholder="${_('placeholder_tutor_email')}"></div>
                        </div>
                        <div>
                            <label for="tutorPhone" data-lang-key="label_mobile_number" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <div class="flex gap-2">
                                <input type="text" id="tutorCountryCode" class="form-input w-24" placeholder="${_('placeholder_country_code_example')}">
                                <input type="tel" id="tutorPhone" class="form-input flex-grow" placeholder="${_('placeholder_tutor_phone')}">
                            </div>
                        </div>

                        <!-- NEW: Home Branch Select -->
                        <div id="tutorBranchContainer" class="hidden">
                            <label for="tutorBranchSelect" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_home_branch') || 'Home Branch'}</label>
                            <select id="tutorBranchSelect" class="form-select w-full"></select>
                        </div>
                        
                        <div class="pt-2">
                            <div class="flex items-center">
                                <input type="checkbox" id="isEmployeeCheckbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500">
                                <label for="isEmployeeCheckbox" data-lang-key="label_is_employee" class="ml-2 text-slate-700"></label>
                            </div>
                        </div>

                        <div>
                            <label data-lang-key="header_skills_salaries" class="block text-slate-600 text-sm font-semibold mb-2 pt-2 border-t"></label>
                            <div id="tutorSkillsList" class="space-y-3"></div>
                            <button type="button" id="addTutorSkillBtn" data-lang-key="btn_add_skill" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-2"></button>
                        </div>
                    </div>
                    <div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg"></button></div>
                </form>
            </div>`;
            
        const modal = DOMElements.tutorModal;
        const form = modal.querySelector('form');
        const skillsList = form.querySelector('#tutorSkillsList');
        skillsList.innerHTML = '';
        form.reset();

        const tutorCountryCodeInput = form.querySelector('#tutorCountryCode');
        const tutorPhoneInput = form.querySelector('#tutorPhone');

        // --- Branch Logic ---
        const branchContainer = form.querySelector('#tutorBranchContainer');
        const branchSelect = form.querySelector('#tutorBranchSelect');
        const branches = appState.branches || [];

        if (branches.length > 1) {
            branchContainer.classList.remove('hidden');
            let options = `<option value="">${_('option_no_specific_branch') || 'No Specific Branch'}</option>`;
            branches.forEach(b => {
                const bName = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                options += `<option value="${b.id}">${bName}</option>`;
            });
            branchSelect.innerHTML = options;
        }

        tutorPhoneInput.oninput = (e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '');
            e.target.value = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ');
        };

        const employeeCheckbox = form.querySelector('#isEmployeeCheckbox');

        const toggleSalaryFields = (isEmployee) => {
            form.querySelectorAll('.tutor-skill-row').forEach(row => {
                const salaryValueInput = row.querySelector('.salary-value-input');
                const salaryTypeButtons = row.querySelectorAll('.salary-type-btn');

                salaryValueInput.disabled = isEmployee;
                salaryTypeButtons.forEach(btn => btn.disabled = isEmployee);
                
                if (isEmployee) {
                    salaryValueInput.value = 0; 
                    salaryValueInput.removeAttribute('required'); 
                } else {
                    salaryValueInput.setAttribute('required', ''); 
                }
            });
        };
        
        employeeCheckbox.onchange = () => toggleSalaryFields(employeeCheckbox.checked);

        if (tutorToEdit) {
            modal.querySelector('#tutorModalTitle').dataset.langKey = 'title_edit_tutor';
            modal.querySelector('.submit-btn').dataset.langKey = 'btn_save_changes';
            form.querySelector('#tutorModalId').value = tutorToEdit.id;
            form.querySelector('#tutorName').value = tutorToEdit.name;
            form.querySelector('#tutorEmail').value = tutorToEdit.email;
            
            const { countryCode, number } = parsePhoneNumber(tutorToEdit.phone);
            tutorCountryCodeInput.value = countryCode;
            tutorPhoneInput.value = number;

            employeeCheckbox.checked = tutorToEdit.isEmployee || false;
            
            // Set Branch
            if (branches.length > 1) {
                branchSelect.value = tutorToEdit.homeBranchId || "";
            }

            if (tutorToEdit.skills) {
                tutorToEdit.skills.forEach(skill => addSkillRow(skillsList, skill));
            }
            
            toggleSalaryFields(employeeCheckbox.checked);

        } else {
            modal.querySelector('#tutorModalTitle').dataset.langKey = 'title_add_tutor';
            modal.querySelector('.submit-btn').dataset.langKey = 'btn_save_changes';
            form.querySelector('#tutorModalId').value = '';
            addSkillRow(skillsList);
        }
        form.querySelector('#addTutorSkillBtn').onclick = () => {
            addSkillRow(skillsList);
            toggleSalaryFields(employeeCheckbox.checked); 
        };
        form.onsubmit = handleTutorFormSubmit;
        openModal(modal);
        updateUIText();
    }

    function openPermissionModal(user) {
        // Reuse generic modal container
        const modal = DOMElements.sportTypeModal;
        
        // --- FIX: Save original state to restore later ---
        // This prevents styling conflicts when switching back to "Add Sport Type"
        const originalClassName = modal.className;
        
        // Apply specific styles for this modal (ensure it is centered and has background)
        modal.className = "modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity hidden";
        
        modal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-6 text-center">${user.name}</h2>
                <form id="permissionForm">
                    <!-- 1. Role Selection -->
                    <div class="mb-5">
                        <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_select_user_role')}</label>
                        <select id="permUserRole" class="form-select w-full">
                            <option value="staff">${_('role_staff')}</option>
                            <option value="manager">${_('role_manager')}</option>
                        </select>
                    </div>

                    <!-- 2. Home Branch Selection -->
                    <div class="mb-5">
                        <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_home_branch')}</label>
                        <select id="permHomeBranch" class="form-select w-full"></select>
                    </div>

                    <!-- 3. Access Level Radios -->
                    <div class="mb-5">
                        <label class="block text-slate-600 text-sm font-semibold mb-3">${_('label_access_level')}</label>
                        <div class="space-y-3">
                            <!-- Home Only -->
                            <label class="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition border-slate-200 has-checked:border-indigo-500 has-checked:bg-indigo-50">
                                <input type="radio" name="permAccessLevel" value="home_only" class="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500">
                                <div class="ml-3">
                                    <span class="block text-sm font-bold text-slate-800">${_('access_home_only')}</span>
                                    <span class="block text-xs text-slate-500 mt-0.5">${_('desc_access_home_only')}</span>
                                </div>
                            </label>
                            
                            <!-- Global Read -->
                            <label class="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition border-slate-200 has-checked:border-indigo-500 has-checked:bg-indigo-50">
                                <input type="radio" name="permAccessLevel" value="global_read" class="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500">
                                <div class="ml-3">
                                    <span class="block text-sm font-bold text-slate-800">${_('access_global_read')}</span>
                                    <span class="block text-xs text-slate-500 mt-0.5">${_('desc_access_global_read')}</span>
                                </div>
                            </label>

                            <!-- Global Write -->
                            <label class="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition border-slate-200 has-checked:border-indigo-500 has-checked:bg-indigo-50">
                                <input type="radio" name="permAccessLevel" value="global_write" class="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500">
                                <div class="ml-3">
                                    <span class="block text-sm font-bold text-slate-800">${_('access_global_write')}</span>
                                    <span class="block text-xs text-slate-500 mt-0.5">${_('desc_access_global_write')}</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- 4. Allowed Branches (Checkboxes) -->
                    <div id="allowedBranchesSection" class="mb-6 pt-4 border-t border-slate-100">
                        <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_additional_access')}</label>
                        <div id="allowedBranchesList" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto"></div>
                        <div id="globalWriteOverlay" class="hidden p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 mt-2">
                            ${_('info_global_write_override')}
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg shadow-sm transition transform hover:scale-105">${_('btn_save_changes')}</button>
                    </div>
                </form>
            </div>`;

        const form = modal.querySelector('#permissionForm');
        
        // --- 1. Populate Dropdowns ---
        const roleSelect = form.querySelector('#permUserRole');
        const homeSelect = form.querySelector('#permHomeBranch');
        const branches = appState.branches || [];
        
        // Role
        roleSelect.value = user.role || 'staff';

        // Home Branch Options
        let homeOptions = '';
        branches.forEach(b => {
            homeOptions += `<option value="${b.id}">${getBranchName(b)}</option>`;
        });
        homeSelect.innerHTML = homeOptions;
        
        // Initial Selection (Fallback to first branch if null)
        const currentHomeId = user.homeBranchId || (branches.length > 0 ? branches[0].id : null);
        homeSelect.value = currentHomeId;

        // --- 2. Build Checkboxes & Logic ---
        const allowedList = form.querySelector('#allowedBranchesList');
        const overlay = form.querySelector('#globalWriteOverlay');
        const radios = form.querySelectorAll('input[name="permAccessLevel"]');

        // Current Allowed Map (ensure it's an object)
        const currentAllowed = user.allowedBranches || {};

        const renderCheckboxes = (selectedHomeId) => {
            allowedList.innerHTML = branches.map(b => {
                const bName = getBranchName(b);
                const isHome = b.id === selectedHomeId;
                
                // Logic: 
                // 1. Home branch is ALWAYS checked and disabled (forced).
                // 2. Others are checked if present in user's saved map.
                const isChecked = isHome || !!currentAllowed[b.id];
                const isDisabled = isHome; // Only disable Home here.

                const styleClass = isHome 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" 
                    : "hover:bg-slate-50 cursor-pointer border-slate-200";

                const homeTag = isHome ? `<span class="text-[10px] bg-slate-200 px-1 rounded ml-1">${_('label_home_tag')}</span>` : '';

                return `
                <label class="flex items-center p-2 rounded border ${styleClass}">
                    <input type="checkbox" value="${b.id}" class="perm-branch-cb h-4 w-4 text-indigo-600 rounded" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                    <span class="ml-2 text-sm font-medium ${isHome ? 'text-slate-500' : 'text-slate-700'}">
                        ${bName} ${homeTag}
                    </span>
                </label>`;
            }).join('');
        };

        // --- 3. Interaction Logic ---
        
        // A. Handle Access Level Change (Radio)
        const updateUIState = () => {
            const level = form.querySelector('input[name="permAccessLevel"]:checked').value;
            
            if (level === 'global_write') {
                allowedList.classList.add('hidden');
                overlay.classList.remove('hidden');
            } else {
                allowedList.classList.remove('hidden');
                overlay.classList.add('hidden');
            }
        };

        radios.forEach(r => r.addEventListener('change', updateUIState));

        // B. Handle Home Branch Change (Updates checkboxes)
        homeSelect.addEventListener('change', () => {
            renderCheckboxes(homeSelect.value);
        });

        // --- 4. Initialize State ---
        // Set Radio
        const currentLevel = user.staffAccessLevel || 'home_only';
        const radioToSelect = form.querySelector(`input[value="${currentLevel}"]`);
        if (radioToSelect) radioToSelect.checked = true;

        // Render Checkboxes
        renderCheckboxes(currentHomeId);
        
        // Set Visibility
        updateUIState();

        // --- 5. Save & Close Handlers ---

        const safeClose = () => {
            closeModal(modal);
            // Restore the original class name after the transition animation
            setTimeout(() => {
                modal.className = originalClassName;
            }, 300);
        };

        const closeBtn = modal.querySelector('.modal-close-btn');
        if(closeBtn) closeBtn.onclick = safeClose;

        form.onsubmit = (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            const newRole = roleSelect.value;
            const newHomeId = homeSelect.value;
            const newAccessLevel = form.querySelector('input[name="permAccessLevel"]:checked').value;
            
            // Construct Allowed Branches Map
            const newAllowedBranches = {};
            
            if (newAccessLevel === 'global_write') {
                newAllowedBranches[newHomeId] = true;
            } else {
                newAllowedBranches[newHomeId] = true;
                form.querySelectorAll('.perm-branch-cb:checked').forEach(cb => {
                    newAllowedBranches[cb.value] = true;
                });
            }

            const updates = {};
            updates[`/users/${user.id}/role`] = newRole;
            updates[`/users/${user.id}/homeBranchId`] = newHomeId;
            updates[`/users/${user.id}/staffAccessLevel`] = newAccessLevel;
            updates[`/users/${user.id}/allowedBranches`] = newAllowedBranches;

            database.ref().update(updates).then(() => {
                showMessageBox(_('info_permission_updated'), 'success');
                safeClose();
                
                // Manually trigger re-render of Admin Page
                const adminPage = document.getElementById('page-admin');
                if (adminPage && !adminPage.classList.contains('hidden')) {
                    setTimeout(() => renderAdminPage(adminPage), 100);
                }
            }).catch(err => {
                console.error(err);
                showMessageBox(_('error_generic'), 'error');
                submitBtn.disabled = false;
            });
        };

        openModal(modal);
    }

    function addSkillRow(container, skill = null) {
        const skillRow = document.createElement('div');
        skillRow.className = 'tutor-skill-row p-3 bg-slate-100 rounded-lg space-y-2 border border-slate-200 relative';
        
        // 1. Populate Sport Types
        const availableSports = appState.sportTypes.map(st => 
            `<option value="${st.id}" ${skill && skill.sportTypeId === st.id ? 'selected' : ''}>${getSportTypeName(st)}</option>`
        ).join('');

        // 2. Generate Formula Options for the Dropdown
        let formulaOptions = '';
        // FILTER: Only show active formulas
        const activeFormulas = appState.salaryFormulas.filter(f => !f.isDeleted);
        
        if (activeFormulas.length > 0) {
            formulaOptions = activeFormulas.map(f => 
                `<option value="${f.id}">${f.name}</option>`
            ).join('');
        } else {
            // Add a helpful empty state if no formulas exist yet
            formulaOptions = `<option value="" disabled selected>${_('info_no_formulas_found') || 'No formulas created'}</option>`;
        }

        // 3. Build HTML Structure
        skillRow.innerHTML = `
            <button type="button" class="remove-skill-btn absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 rounded-full text-xs flex items-center justify-center transition hover:bg-red-600">&times;</button>
            
            <select class="form-select skill-type-select mb-2">${availableSports}</select>
            
            <!-- Salary Type Buttons -->
            <div class="flex gap-1 rounded-lg bg-slate-200 p-1 salary-type-container flex-wrap">
                <button type="button" data-value="perCls" class="salary-type-btn flex-1 p-1 rounded-md text-xs whitespace-nowrap">${_('salary_type_per_class')}</button>
                <button type="button" data-value="percentage" class="salary-type-btn flex-1 p-1 rounded-md text-xs whitespace-nowrap">${_('salary_type_percentage')}</button>
                <button type="button" data-value="perHeadcount" class="salary-type-btn flex-1 p-1 rounded-md text-xs whitespace-nowrap">${_('salary_type_per_head')}</button>
                <!-- Custom Script Button (Orange Accent) -->
                <button type="button" data-value="custom" class="salary-type-btn flex-1 p-1 rounded-md text-xs whitespace-nowrap text-orange-700 font-bold">${_('salary_type_custom')}</button>
            </div>
            
            <!-- Input Area (Toggles between Number and Dropdown) -->
            <div class="mt-2">
                <input type="number" class="form-input salary-value-input w-full" min="0" step="0.01">
                <select class="form-select salary-formula-select w-full hidden">${formulaOptions}</select>
            </div>`;
        
        container.appendChild(skillRow);

        // --- References ---
        const salaryTypeContainer = skillRow.querySelector('.salary-type-container');
        const salaryValueInput = skillRow.querySelector('.salary-value-input');
        const salaryFormulaSelect = skillRow.querySelector('.salary-formula-select');

        // --- UI Updater Logic ---
        const updateRowSalaryUI = (type) => {
            // A. Update Button Active States
            salaryTypeContainer.querySelectorAll('.salary-type-btn').forEach(btn => {
                const isActive = btn.dataset.value === type;
                btn.classList.toggle('active', isActive);
                
                // Add specific active styling for the "Custom" button
                if (btn.dataset.value === 'custom') {
                    if (isActive) btn.classList.add('bg-orange-200', 'text-orange-900', 'shadow-inner');
                    else btn.classList.remove('bg-orange-200', 'text-orange-900', 'shadow-inner');
                }
            });

            // B. Toggle Inputs
            if (type === 'custom') {
                // Show Dropdown, Hide Number
                salaryValueInput.classList.add('hidden');
                salaryValueInput.removeAttribute('required');
                
                salaryFormulaSelect.classList.remove('hidden');
                salaryFormulaSelect.setAttribute('required', '');
            } else {
                // Show Number, Hide Dropdown
                salaryFormulaSelect.classList.add('hidden');
                salaryFormulaSelect.removeAttribute('required');
                
                salaryValueInput.classList.remove('hidden');
                salaryValueInput.setAttribute('required', '');
                
                // Update placeholder text
                salaryValueInput.placeholder = { 
                    perCls: _('placeholder_salary_per_class'), 
                    percentage: _('placeholder_salary_percentage'), 
                    perHeadcount: _('placeholder_salary_per_head') 
                }[type];
            }
        };

        // --- Event Listeners ---
        salaryTypeContainer.onclick = (e) => { 
            if(e.target.matches('.salary-type-btn')) {
                updateRowSalaryUI(e.target.dataset.value); 
            }
        };

        skillRow.querySelector('.remove-skill-btn').onclick = () => skillRow.remove();

        // --- Initialization ---
        const initialSalaryType = skill?.salaryType || 'perCls';
        updateRowSalaryUI(initialSalaryType);

        // Set initial values based on existing data
        if (initialSalaryType === 'custom') {
            if (skill && skill.salaryFormulaId) {
                salaryFormulaSelect.value = skill.salaryFormulaId;
            }
        } else {
            salaryValueInput.value = skill?.salaryValue !== undefined ? skill.salaryValue : '';
        }
    }

    function handleTutorFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#tutorModalId').value;
        const skills = [];
        form.querySelectorAll('.tutor-skill-row').forEach(row => {
            const sType = row.querySelector('.salary-type-btn.active').dataset.value;
            skills.push({
                sportTypeId: row.querySelector('.skill-type-select').value,
                salaryType: sType,
                salaryValue: parseFloat(row.querySelector('.salary-value-input').value) || 0,
                // FIX: Only save the Formula ID if the type is actually 'custom'
                salaryFormulaId: sType === 'custom' ? row.querySelector('.salary-formula-select').value : null 
            });
        });

        const uniqueSkills = new Set();
        for (const skill of skills) {
            if (uniqueSkills.has(skill.sportTypeId)) {
                const duplicateSportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                const sportName = duplicateSportType ? duplicateSportType.name : 'A skill';
                showMessageBox(_('error_duplicate_skill_assignment').replace('{name}', sportName), 'error');
                return;
            }
            uniqueSkills.add(skill.sportTypeId);
        }

        const countryCode = form.querySelector('#tutorCountryCode').value.trim();
        const phoneNumber = form.querySelector('#tutorPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);
        
        // --- Capture Branch ---
        const homeBranchId = form.querySelector('#tutorBranchSelect') ? form.querySelector('#tutorBranchSelect').value : null;

        const tutorData = { 
            name: form.querySelector('#tutorName').value, 
            email: form.querySelector('#tutorEmail').value,
            phone: fullPhoneNumber,
            skills,
            isEmployee: form.querySelector('#isEmployeeCheckbox').checked,
            homeBranchId: homeBranchId // Save to DB
        };

        let promise;
        if (id) {
            promise = database.ref('/tutors/' + id).update(tutorData);
        } else {
            appState.searchTerms.tutors = '';

            const totalItemsAfterAdd = appState.tutors.length + 1;
            const itemsPerPage = appState.itemsPerPage.tutors;
            const lastPage = Math.ceil(totalItemsAfterAdd / itemsPerPage);

            appState.pagination.tutors.page = lastPage;

            promise = database.ref('/tutors').push(tutorData);
        }
        promise.then(() => {
            const itemType = _('label_tutor_item');
            const message = id
                ? _('success_item_updated_generic').replace('{type}', itemType)
                : _('success_item_added_generic').replace('{type}', itemType);

            showMessageBox(message, 'success');
            closeModal(DOMElements.tutorModal);
        });
    }

    // --- Custom Formula Logic ---
    function openFormulaModal(formulaToEdit = null) {
        // Reuse generic modal container
        const modal = DOMElements.sportTypeModal; 
        
        // --- FIX START: Mobile Scrolling Issue ---
        // Ensure modal aligns to top to allow scrolling on small screens (iPhone)
        modal.classList.remove('items-center');
        modal.classList.add('items-start', 'overflow-y-auto');
        // --- FIX END ---
        
        // 1. CHECK DEPENDENCIES
        // Check if this formula is assigned to any class currently loaded in memory
        let isScriptLocked = false;

        if (formulaToEdit) {
            isScriptLocked = appState.classes.some(c => 
                c.payoutDetails && 
                c.payoutDetails.salaryFormulaId === formulaToEdit.id &&
                c.payoutDetails.salaryType === 'custom'
            );
        }

        // Styles for the script editor based on state
        // Locked: Grey background, standard text | Active: Dark background, code text
        const editorClasses = isScriptLocked 
            ? "form-input font-mono text-sm bg-slate-100 text-slate-500 cursor-not-allowed p-4 h-64 w-full" 
            : "form-input font-mono text-sm bg-slate-900 text-green-400 p-4 h-64 w-full";

        const defaultScript = `// Example: Base 100 + 50 per head over 2 people, max 450
const A = context.attendees;
const base = 100;
const bonus = 50;
const threshold = 2;
const cap = 450;

if (A <= threshold) return base;
return Math.min(base + (A - threshold) * bonus, cap);`;

        modal.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative flex flex-col md:flex-row gap-6">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                
                <!-- Left: Editor -->
                <div class="flex-grow space-y-4">
                    <h2 class="text-2xl font-bold text-slate-800">${formulaToEdit ? _('title_edit_formula') : _('title_add_formula')}</h2>
                    <form id="formulaForm">
                        <input type="hidden" id="formulaId">
                        <div class="mb-4">
                            <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_formula_name')}</label>
                            <input type="text" id="formulaName" class="form-input" required placeholder="e.g., Senior Tier Script">
                        </div>
                        
                        <div class="mb-2">
                            <label class="block text-slate-600 text-sm font-semibold mb-2">${_('label_script_editor')}</label>
                            
                            <!-- WARNING BANNER (Only shown if locked) -->
                            <div class="${isScriptLocked ? 'flex' : 'hidden'} items-start gap-2 bg-orange-50 border border-orange-100 text-orange-800 text-xs p-2 rounded mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                                </svg>
                                <span>${_('info_formula_locked')}</span>
                            </div>

                            <textarea id="formulaScript" class="${editorClasses}" spellcheck="false" ${isScriptLocked ? 'disabled' : ''}></textarea>
                            <p class="text-xs text-slate-500 mt-1">${_('helper_script_variables')}</p>
                        </div>
                        <div class="flex justify-end pt-2">
                            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow">${_('btn_save_changes')}</button>
                        </div>
                    </form>
                </div>

                <!-- Right: Test Console -->
                <div class="w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h3 class="font-bold text-slate-700 mb-4 border-b pb-2">${_('label_test_console')}</h3>
                    
                    <div class="space-y-4 flex-grow overflow-y-auto max-h-[400px]">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${_('label_test_attendees')}</label>
                            <input type="number" id="testAttendees" class="form-input bg-white" value="5" min="0">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${_('label_test_revenue')}</label>
                            <input type="number" id="testRevenue" class="form-input bg-white" value="500" min="0">
                        </div>
                        <!-- NEW FIELDS -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${_('label_test_duration')}</label>
                            <input type="number" id="testDuration" class="form-input bg-white" value="60" min="0">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${_('label_test_credits')}</label>
                            <input type="number" id="testCredits" class="form-input bg-white" value="1" min="0" step="0.1">
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-slate-200">
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${_('label_test_result')}</label>
                        <div id="testResultDisplay" class="text-3xl font-bold text-indigo-600">$0.00</div>
                        <div id="testErrorDisplay" class="text-xs text-red-500 mt-1 hidden"></div>
                    </div>
                </div>
            </div>`;

        // Logic binding
        const form = modal.querySelector('#formulaForm');
        const scriptInput = modal.querySelector('#formulaScript');
        
        // Select all test inputs
        const testAttendees = modal.querySelector('#testAttendees');
        const testRevenue = modal.querySelector('#testRevenue');
        const testDuration = modal.querySelector('#testDuration'); // NEW
        const testCredits = modal.querySelector('#testCredits');   // NEW
        
        const resultDisplay = modal.querySelector('#testResultDisplay');
        const errorDisplay = modal.querySelector('#testErrorDisplay');

        // Initial Data
        if (formulaToEdit) {
            modal.querySelector('#formulaId').value = formulaToEdit.id;
            modal.querySelector('#formulaName').value = formulaToEdit.name;
            scriptInput.value = formulaToEdit.script;
        } else {
            modal.querySelector('#formulaId').value = '';
            scriptInput.value = defaultScript;
        }

        // Live Preview Function
        const runPreview = () => {
            const code = scriptInput.value;
            const context = {
                attendees: parseInt(testAttendees.value) || 0,
                revenue: parseFloat(testRevenue.value) || 0,
                duration: parseInt(testDuration.value) || 0,   // NEW: Dynamic
                credits: parseFloat(testCredits.value) || 0    // NEW: Dynamic
            };

            try {
                const func = new Function('context', code);
                const result = func(context);
                
                if (isNaN(result)) throw new Error("Result is NaN");
                
                resultDisplay.textContent = formatCurrency(result);
                resultDisplay.classList.remove('text-red-500');
                resultDisplay.classList.add('text-indigo-600');
                errorDisplay.classList.add('hidden');
            } catch (err) {
                resultDisplay.textContent = "Error";
                resultDisplay.classList.add('text-red-500');
                resultDisplay.classList.remove('text-indigo-600');
                errorDisplay.textContent = err.message;
                errorDisplay.classList.remove('hidden');
            }
        };

        // Bind listeners for real-time updates
        scriptInput.addEventListener('input', runPreview);
        testAttendees.addEventListener('input', runPreview);
        testRevenue.addEventListener('input', runPreview);
        testDuration.addEventListener('input', runPreview); // NEW
        testCredits.addEventListener('input', runPreview);  // NEW

        // Run once on open
        runPreview();

        // Save Handler
        form.onsubmit = (e) => {
            e.preventDefault();
            const id = form.querySelector('#formulaId').value;
            
            // If the script input is disabled, the value still persists in the DOM element
            const data = {
                name: form.querySelector('#formulaName').value,
                script: scriptInput.value
            };

            if (id) {
                database.ref('/salaryFormulas/' + id).update(data);
            } else {
                database.ref('/salaryFormulas').push(data);
            }
            showMessageBox(_('success_formula_saved'), 'success');
            closeModal(modal);
        };

        openModal(modal);
        updateUIText();
    }

    async function renderSalaryPage(container) {
        const user = appState.currentUser;
        const isOwner = user.role === 'owner';
        const branches = appState.branches || [];

        // --- FIX: Restored this line so the rest of the function (Table headers/Export) can see it ---
        const hasMultipleBranches = branches.length > 1;

        // --- REFACTORED: Use Helper ---
        const effectiveBranches = getEffectiveBranches(user, branches);

        // --- 1. Prepare Branch Filter HTML ---
        let branchFilterHTML = '';
        const hasEffectiveMulti = effectiveBranches.length > 1;

        if (hasEffectiveMulti) {
            let options = `<option value="all">${_('filter_all_branches')}</option>`;
            options += effectiveBranches.map(b => `<option value="${b.id}">${getBranchName(b)}</option>`).join('');
            branchFilterHTML = `<select id="salaryBranchSelect" class="form-select w-full sm:w-48">${options}</select>`;
        }

        // --- 2. Build Layout ---
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_salary_overview')}</h2>
                    <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
                        <select id="salaryPeriodSelect" class="form-select w-full sm:w-48"></select>
                        ${branchFilterHTML}
                        <select id="salaryTutorSelect" class="form-select w-full sm:w-48">
                            <option value="" disabled selected>${_('status_loading')}...</option>
                        </select>
                        <button id="exportSalaryBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 w-full sm:w-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export')}
                        </button>
                    </div>
                </div>
                <div id="salaryDetailsContainer"><p class="text-center text-slate-500 p-8">${_('status_loading')}...</p></div>
            </div>`;

        const periodSelect = container.querySelector('#salaryPeriodSelect');
        const tutorSelect = container.querySelector('#salaryTutorSelect');
        const branchSelect = container.querySelector('#salaryBranchSelect');
        const exportBtn = container.querySelector('#exportSalaryBtn');
        const detailsContainer = container.querySelector('#salaryDetailsContainer');
        const exportBtnDefaultHTML = exportBtn.innerHTML;

        let monthlyClasses = []; 

        // --- 3. Initialization ---
        const periodsSnapshot = await database.ref('/clsMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];

        if (periods.length > 0) {
            periodSelect.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            
            const currentMonthPeriod = getIsoDate(new Date()).substring(0, 7);
            if (appState.selectedFilters.salaryPeriod && periods.includes(appState.selectedFilters.salaryPeriod)) {
                periodSelect.value = appState.selectedFilters.salaryPeriod;
            } else if (periods.includes(currentMonthPeriod)) {
                periodSelect.value = currentMonthPeriod;
            } else {
                periodSelect.value = periods[0];
            }
        } else {
            periodSelect.innerHTML = `<option value="">${_('label_no_months_available')}</option>`;
            tutorSelect.innerHTML = `<option value="">${_('info_no_tutors_found')}</option>`;
            return;
        }

        // --- 4. Logic Functions ---

        // Helper to safely get default branch ID
        const getDefaultBranchId = () => (branches.length > 0 ? branches[0].id : null);

        // C. Render the actual table (Defined first to be used by Waterfall logic)
        const updateSalaryTable = () => {
            const tutorId = tutorSelect.value;
            const selectedBranchId = branchSelect ? branchSelect.value : 'all';
            
            appState.selectedFilters.salaryTutorId = tutorId;

            if (!tutorId) {
                detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('info_no_classes_in_period')}</p>`;
                return;
            }

            // Filter classes for the specific tutor
            let filteredClasses = monthlyClasses.filter(c => c.tutorId === tutorId);

            // Double check branch filter
            filteredClasses = filterClassesByBranchContext(filteredClasses, branches, effectiveBranches, selectedBranchId);

            renderSalaryDetails(filteredClasses);
        };

        // B. Waterfall Logic: Filter Tutors based on Branch & Period data
        const updateAvailableTutors = () => {
            const selectedBranchId = branchSelect ? branchSelect.value : 'all';
            const classesForTutorList = filterClassesByBranchContext(monthlyClasses, branches, effectiveBranches, selectedBranchId);

            // 2. Identify distinct tutors who have classes in this filtered subset
            const activeTutorIds = new Set(classesForTutorList.map(c => c.tutorId));
            const activeTutors = appState.tutors.filter(t => activeTutorIds.has(t.id));

            // 3. Populate Dropdown
            if (activeTutors.length > 0) {
                // Save current selection to restore if valid
                const currentSelection = tutorSelect.value;
                
                populateDropdown(tutorSelect, activeTutors);
                
                // Smart Selection Logic:
                if (currentSelection && activeTutorIds.has(currentSelection)) {
                    tutorSelect.value = currentSelection;
                } else if (appState.selectedFilters.salaryTutorId && activeTutorIds.has(appState.selectedFilters.salaryTutorId)) {
                    tutorSelect.value = appState.selectedFilters.salaryTutorId;
                } else {
                    tutorSelect.value = activeTutors[0].id;
                }
            } else {
                tutorSelect.innerHTML = `<option value="">${_('info_no_tutors_found')}</option>`;
                updateSalaryTable(); 
                return;
            }

            // 4. Finally, update the table with the specific tutor selected
            updateSalaryTable();
        };

        // A. Load Data for selected Period
        const loadPeriodData = async () => {
            const period = periodSelect.value;
            appState.selectedFilters.salaryPeriod = period;

            if (!period) return;

            detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            tutorSelect.disabled = true;
            if(branchSelect) branchSelect.disabled = true;

            try {
                const startOfMonth = `${period}-01`;
                const endOfMonth = `${period}-31`;
                const snapshot = await database.ref('/classes').orderByChild('date').startAt(startOfMonth).endAt(endOfMonth).once('value');
                
                const rawClasses = firebaseObjectToArray(snapshot.val());

                // --- REFACTORED: Security Filter ---
                monthlyClasses = filterClassesByBranchContext(rawClasses, branches, effectiveBranches, 'all');

                tutorSelect.disabled = false;
                if(branchSelect) branchSelect.disabled = false;

                // Trigger the waterfall logic to populate tutors based on branch
                updateAvailableTutors();
            } catch (error) {
                console.error("Error loading salary data:", error);
                detailsContainer.innerHTML = `<p class="text-center text-red-500 p-8">${_('error_generic')}</p>`;
            }
        };

        // --- 5. Calculation & HTML Generation Helper ---
        const renderSalaryDetails = async (filteredClasses) => {
            // A. Show Loading State immediately
            detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_calculating_revenue')}</p>`;

            // B. Identify members involved in THIS month's view
            const memberIdsInPeriod = new Set();
            filteredClasses.forEach(cls => {
                if (cls.bookedBy) Object.keys(cls.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            });

            // C. FIX: FETCH FULL HISTORY CONTEXT
            // We must load all classes to reconstruct the FIFO credit depletion timeline correctly.
            // Without this, the calculator assumes this month's classes are the first ever booked,
            // potentially using old/free credits that should have been expired or used.
            let allRelevantBookings = [];
            
            try {
                // Fetch all classes (lightweight fetch if possible, but structure requires full scan for accuracy)
                const allClassesSnapshot = await database.ref('/classes').once('value');
                const allClassesForCalc = firebaseObjectToArray(allClassesSnapshot.val());

                if (memberIdsInPeriod.size > 0) {
                    allClassesForCalc.forEach(cls => {
                        if (cls.bookedBy) {
                            Object.keys(cls.bookedBy).forEach(mid => {
                                // We only care about the history of members who are present in the current salary view
                                if (memberIdsInPeriod.has(mid)) {
                                    const member = appState.users.find(u => u.id === mid);
                                    if (member) allRelevantBookings.push({ member, cls });
                                }
                            });
                        }
                    });
                }
            } catch (err) {
                console.error("Error fetching history for salary calc:", err);
                detailsContainer.innerHTML = `<p class="text-center text-red-500 p-8">${_('error_generic')}</p>`;
                return;
            }

            // D. Calculate Revenue using the comprehensive history
            // We use 'projected' mode to ensure the calculator processes ALL classes in the timeline
            const { revenueByClsId } = calculateRevenueForBookings(allRelevantBookings, 'projected');

            let totalEarnings = 0;
            
            // Re-calculate hasMultipleBranches locally to ensure safety if this function is pasted out of scope
            const hasMultipleBranches = appState.branches && appState.branches.length > 1;

            const clsDetails = filteredClasses.map(cls => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                const clsGrossRevenue = revenueByClsId.get(cls.id) || 0;
                
                // Stats
                const attendeesCount = cls.attendedBy ? Object.keys(cls.attendedBy).length : 0;
                const enrollmentsCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                
                // Use Centralized Helper for Math (Now receives the correct Gross Revenue)
                const earnings = calculateTutorPayout(cls, clsGrossRevenue, enrollmentsCount, appState.salaryFormulas);
                
                totalEarnings += earnings;

                // UI String Construction
                let calculation = _('label_na');
                if (cls.payoutDetails) { 
                    const { salaryType, salaryValue, salaryFormulaId } = cls.payoutDetails;
                    
                    if (salaryType === 'perCls') {
                        calculation = _('salary_calculation_fixed').replace('{amount}', formatCurrency(salaryValue));
                    } else if (salaryType === 'percentage') {
                        calculation = _('template_salary_percentage').replace('{revenue}', formatCurrency(clsGrossRevenue)).replace('{percentage}', salaryValue);
                    } else if (salaryType === 'perHeadcount') {
                        const headcountUnit = _(enrollmentsCount === 1 ? 'salary_unit_attendee' : 'salary_unit_attendees');
                        calculation = _('salary_calculation_per_head')
                            .replace('{count}', enrollmentsCount)
                            .replace('{unit}', headcountUnit)
                            .replace('{amount}', formatCurrency(salaryValue));
                    } else if (salaryType === 'custom') {
                        const formula = appState.salaryFormulas.find(f => f.id === salaryFormulaId);
                        calculation = formula ? formula.name : 'Formula Missing';
                    }
                }

                let branchName = '';
                if (hasMultipleBranches) {
                    const bId = cls.branchId || (appState.branches.length > 0 ? appState.branches[0].id : null);
                    const branch = appState.branches.find(b => b.id === bId);
                    branchName = getBranchName(branch);
                }

                return { 
                    ...cls, 
                    sportTypeName: getSportTypeName(sportType), 
                    earnings, 
                    calculation, 
                    attendeesCount, 
                    enrollmentsCount,
                    branchName 
                };
            });

            // Sorting
            const { key, direction } = appState.salarySort;
            clsDetails.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                if (key === 'date') {
                    valA = new Date(a.date).getTime();
                    valB = new Date(b.date).getTime();
                }
                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            // Totals
            const totalEnrollments = clsDetails.reduce((acc, c) => acc + c.enrollmentsCount, 0);
            const totalAttendees = clsDetails.reduce((acc, c) => acc + c.attendeesCount, 0);

            // Pagination
            const { itemsPerPage } = appState;
            const totalPages = Math.ceil(clsDetails.length / itemsPerPage.salary) || 1;
            let page = appState.pagination.salary.page;
            
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            appState.pagination.salary.page = page;

            const paginatedClsDetails = clsDetails.slice((page - 1) * itemsPerPage.salary, page * itemsPerPage.salary);

            // Column Span
            const colSpan = hasMultipleBranches ? 8 : 7;

            detailsContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div class="bg-slate-100 p-4 rounded-lg">
                        <p class="text-sm text-slate-500">${_('label_total_earnings')}</p>
                        <p class="text-3xl font-bold text-slate-800">${formatCurrency(totalEarnings)}</p>
                    </div>
                    <div class="bg-slate-100 p-4 rounded-lg">
                        <p class="text-sm text-slate-500">${_('label_classes_taught')}</p>
                        <p class="text-3xl font-bold text-slate-800">${filteredClasses.length}</p>
                    </div>
                    <div class="bg-slate-100 p-4 rounded-lg">
                        <p class="text-sm text-slate-500">${_('label_total_enrollments') || 'Total Enrollments'}</p>
                        <p class="text-3xl font-bold text-slate-800">${totalEnrollments}</p>
                    </div>
                    <div class="bg-slate-100 p-4 rounded-lg">
                        <p class="text-sm text-slate-500">${_('label_total_attendees')}</p>
                        <p class="text-3xl font-bold text-slate-800">${totalAttendees}</p>
                    </div>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-slate-700 mb-4">${_('header_detailed_breakdown')}</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left min-w-[900px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 w-12">#</th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="date">${_('table_header_datetime')}<span class="sort-icon"></span></th>
                                ${hasMultipleBranches ? `<th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="branchName">${_('label_branch')}<span class="sort-icon"></span></th>` : ''}
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="sportTypeName">${_('label_class')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="enrollmentsCount">${_('table_header_enrollments') || 'Enrollments'}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="attendeesCount">${_('table_header_attendees')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="calculation">${_('table_header_calculation')}<span class="sort-icon"></span></th>
                                <th class="p-2 text-right sortable cursor-pointer whitespace-nowrap" data-sort-key="earnings">${_('table_header_earnings')}<span class="sort-icon"></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paginatedClsDetails.map((c, index) => {
                                const entryNumber = (page - 1) * itemsPerPage.salary + index + 1;
                                return `
                                <tr class="border-b border-slate-100">
                                    <td class="p-2 text-slate-500 font-semibold">${entryNumber}</td>
                                    <td class="p-2 whitespace-nowrap text-slate-700">
                                        ${formatShortDateWithYear(c.date)}
                                        <br>
                                        <span class="text-sm text-slate-500">${getTimeRange(c.time, c.duration)}</span>
                                    </td>
                                    ${hasMultipleBranches ? `<td class="p-2 whitespace-nowrap text-slate-700">${c.branchName}</td>` : ''}
                                    <td class="p-2 whitespace-nowrap text-slate-700">${c.sportTypeName}</td>
                                    <td class="p-2 whitespace-nowrap text-slate-700">${c.enrollmentsCount}</td>
                                    <td class="p-2 whitespace-nowrap text-slate-700">${c.attendeesCount} / ${c.maxParticipants}</td>
                                    <td class="p-2 whitespace-nowrap text-slate-700">${c.calculation}</td>
                                    <td class="p-2 text-right font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(c.earnings)}</td>
                                </tr>`;
                            }).join('') || `<tr><td colspan="${colSpan}" class="text-center p-4 text-slate-500">${_('info_no_classes_in_period')}</td></tr>`}
                        </tbody>
                    </table></div>
                    <div id="salaryPagination" class="flex justify-between items-center mt-4"></div>
                </div>`;

            const paginationContainer = detailsContainer.querySelector('#salaryPagination');
            renderPaginationControls(paginationContainer, page, totalPages, clsDetails.length, itemsPerPage.salary, (newPage) => {
                appState.pagination.salary.page = newPage;
                renderSalaryDetails(filteredClasses);
            });

            const sortState = appState.salarySort;

            detailsContainer.querySelectorAll('th.sortable .sort-icon').forEach(icon => icon.className = 'sort-icon');
            const activeHeader = detailsContainer.querySelector(`th[data-sort-key="${sortState.key}"] .sort-icon`);
            if (activeHeader) activeHeader.classList.add(sortState.direction);

            detailsContainer.querySelectorAll('th.sortable').forEach(header => {
                header.onclick = () => {
                    const newKey = header.dataset.sortKey;
                    if (sortState.key === newKey) {
                        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = newKey;
                        sortState.direction = 'asc';
                    }
                    renderSalaryDetails(filteredClasses);
                };
            });

            // Re-bind Export (with updated context)
            const exportBtn = document.getElementById('exportSalaryBtn');
            if (exportBtn) {
                exportBtn.onclick = () => {
                    // Safety check to ensure exportBtn is available in scope
                    if (!exportBtn) return;
                    
                    // Note: 'originalBtnText' logic moved inside to be safe
                    const originalText = _('btn_export');
                    exportBtn.disabled = true;
                    exportBtn.innerHTML = _('status_exporting');

                    const exportData = clsDetails.map(cls => {
                        const timeRange = getTimeRange(cls.time, cls.duration).split(' - ');
                        const row = {
                            [_('export_header_date')]: cls.date,
                            [_('export_header_start_time')]: timeRange[0] || '',
                            [_('export_header_end_time')]: timeRange[1] || '',
                        };
                        
                        if (hasMultipleBranches) {
                                row[_('label_branch')] = cls.branchName;
                        }

                        Object.assign(row, {
                            [_('export_header_class_name')]: cls.sportTypeName,
                            [_('table_header_enrollments') || 'Enrollments']: cls.enrollmentsCount,
                            [_('export_header_attendees_capacity')]: `${cls.attendeesCount}/${cls.maxParticipants}`,
                            [_('export_header_calculation')]: cls.calculation,
                            [_('export_header_earnings')]: cls.earnings.toFixed(2)
                        });
                        return row;
                    });

                    // Add Totals Row
                    const totalsRow = {
                        [_('export_header_date')]: 'TOTAL',
                        [_('export_header_class_name')]: filteredClasses.length,
                        [_('table_header_enrollments') || 'Enrollments']: totalEnrollments,
                        [_('export_header_attendees_capacity')]: totalAttendees,
                        [_('export_header_earnings')]: totalEarnings.toFixed(2)
                    };
                    if (hasMultipleBranches) totalsRow[_('label_branch')] = '';
                    
                    exportData.push({}); // Spacer
                    exportData.push(totalsRow);

                    // Get currently selected tutor for filename
                    const tutorId = document.getElementById('salaryTutorSelect').value;
                    const tutor = appState.tutors.find(t => t.id === tutorId);
                    const tutorName = tutor ? tutor.name.replace(/ /g, '_') : 'Tutor';
                    const period = document.getElementById('salaryPeriodSelect').value;
                    const fileName = `salary-report_${tutorName}_${period}`;
                    exportToCsv(fileName, exportData);

                    exportBtn.disabled = false;
                    exportBtn.innerHTML = originalText;
                };
            }
        };

        // --- 6. Event Bindings ---
        
        // Changing Period loads new data. Reset pagination manually.
        periodSelect.onchange = () => {
            appState.pagination.salary.page = 1; 
            loadPeriodData();
        };
        
        // Changing Branch triggers waterfall logic. Reset pagination manually.
        if (branchSelect) {
            branchSelect.onchange = () => {
                appState.pagination.salary.page = 1;
                updateAvailableTutors();
            };
        }

        // Changing Tutor directly updates the table. Reset pagination manually.
        tutorSelect.onchange = () => {
            appState.pagination.salary.page = 1;
            updateSalaryTable();
        };
        
        exportBtn.onclick = async () => {
            // Placeholder click handler. Real one bound inside renderSalaryDetails.
        };

        // Initial Load
        loadPeriodData();
    }

    async function renderStatisticsPage(container) {
        const user = appState.currentUser;
        const isOwner = user.role === 'owner';
        const branches = appState.branches || [];

        // --- REFACTORED: Use Helper ---
        const effectiveBranches = getEffectiveBranches(user, branches);

        // --- 1. Prepare Branch Filter HTML ---
        let branchFilterHTML = '';
        const hasEffectiveMulti = effectiveBranches.length > 1;
        
        if (hasEffectiveMulti) {
            let options = `<option value="all">${_('filter_all_branches')}</option>`;
            options += effectiveBranches.map(b => `<option value="${b.id}">${getBranchName(b)}</option>`).join('');
            branchFilterHTML = `<select id="statsBranchSelect" class="form-select w-48">${options}</select>`;
        }

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_studio_stats')}</h2>
                     <div class="flex flex-wrap gap-4">
                        ${branchFilterHTML}
                        <select id="statsPeriodSelect" class="form-select w-48"></select>
                        <button id="exportStatsBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export')}
                        </button>
                     </div>
                </div>
                <div id="statisticsContainer" class="space-y-8"><p class="text-center text-slate-500 p-8">${_('status_loading')}...</p></div>
            </div>`;
        
        const periodSelect = container.querySelector('#statsPeriodSelect');
        const branchSelect = container.querySelector('#statsBranchSelect');
        const statsContainer = container.querySelector('#statisticsContainer');
        const exportBtn = container.querySelector('#exportStatsBtn');
        const exportBtnDefaultHTML = exportBtn.innerHTML;
        
        const periods = {
            [_('filter_upcoming_90_days')]: -90,
            [_('filter_upcoming_30_days')]: -30,
            [_('filter_upcoming_7_days')]: -7,
            [_('filter_last_7_days')]: 7,
            [_('filter_last_30_days')]: 30,
            [_('filter_last_90_days')]: 90,
            [_('filter_all_time')]: Infinity 
        };
        periodSelect.innerHTML = Object.keys(periods).map(p => `<option value="${periods[p]}">${p}</option>`).join('');
        
        periodSelect.value = appState.selectedFilters.statsPeriod;
        
        let currentStatsForExport = {};

        // Helper: Revenue Calculation Logic
        const calculateAndRenderRevenueStats = async (filteredClasses, isFutureView) => {
            const memberIdsInPeriod = new Set();
            filteredClasses.forEach(cls => {
                if (cls.bookedBy) {
                    Object.keys(cls.bookedBy).forEach(id => memberIdsInPeriod.add(id));
                }
            });

            const allClassesSnapshot = await database.ref('/classes').once('value');
            const allClassesForCalc = firebaseObjectToArray(allClassesSnapshot.val());

            const allRelevantBookings = [];
            if (memberIdsInPeriod.size > 0) {
                allClassesForCalc.forEach(cls => {
                    if (cls.bookedBy) {
                        for (const memberId of Object.keys(cls.bookedBy)) {
                            if (memberIdsInPeriod.has(memberId)) {
                                const member = appState.users.find(u => u.id === memberId);
                                if (member) allRelevantBookings.push({ member, cls });
                            }
                        }
                    }
                });
            }
            
            // 1. Calculate Projected Revenue
            const { revenueByClsId: projectedRevenueByClsId } = calculateRevenueForBookings(allRelevantBookings, 'projected');

            // 2. Determine Data Source
            let revenueMapForCalculation;
            let grossRevenueForDisplay = 0;

            if (isFutureView) {
                revenueMapForCalculation = projectedRevenueByClsId;
                grossRevenueForDisplay = filteredClasses.reduce((sum, cls) => {
                    return sum + (projectedRevenueByClsId.get(cls.id) || 0);
                }, 0);
            } else {
                const actualData = calculateRevenueForBookings(allRelevantBookings, 'actual');
                revenueMapForCalculation = actualData.revenueByClsId;
                grossRevenueForDisplay = filteredClasses.reduce((sum, cls) => {
                    return sum + (actualData.revenueByClsId.get(cls.id) || 0);
                }, 0);
            }

            let totalTutorPayout = 0;
            const netRevenueByClsId = new Map();

            filteredClasses.forEach(cls => {
                const clsGrossRevenue = revenueMapForCalculation.get(cls.id) || 0;
                let clsPayout = 0;

                if (clsGrossRevenue > 0 || isFutureView) {
                    const headcount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                    clsPayout = calculateTutorPayout(cls, clsGrossRevenue, headcount, appState.salaryFormulas);
                }

                totalTutorPayout += clsPayout;
                const clsNetRevenue = clsGrossRevenue - clsPayout;
                netRevenueByClsId.set(cls.id, clsNetRevenue);
            });

            const totalNetRevenue = grossRevenueForDisplay - totalTutorPayout;
            
            const topClassesByRevenue = rankByGroupedRevenue(filteredClasses, netRevenueByClsId, appState.sportTypes, 'sportTypeId');
            const topTutorsByRevenue = rankByGroupedRevenue(filteredClasses, netRevenueByClsId, appState.tutors, 'tutorId');

            const grossRevenueCard = document.getElementById('grossRevenueCard');
            if (grossRevenueCard) grossRevenueCard.innerHTML = `<p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-slate-800">${formatCurrency(grossRevenueForDisplay)}</p>`;

            const netRevenueCard = document.getElementById('netRevenueCard');
            if (netRevenueCard) {
                const netRevenueColor = totalNetRevenue >= 0 ? 'text-green-600' : 'text-red-600';
                netRevenueCard.innerHTML = `<p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(totalNetRevenue)}</p>`;
            }
            
            const topEarningClassesCard = document.getElementById('topEarningClassesCard');
            if(topEarningClassesCard) topEarningClassesCard.innerHTML = createRankingCard(_('header_top_earning_classes'), topClassesByRevenue, _('label_revenue'), '#22c55e', true);

            const topTutorsByRevenueCard = document.getElementById('topTutorsByRevenueCard');
            if(topTutorsByRevenueCard) topTutorsByRevenueCard.innerHTML = createRankingCard(_('header_top_tutors_revenue'), topTutorsByRevenue, _('label_revenue'), '#22c55e');

            currentStatsForExport.summary.push(
                { key: 'grossRevenue', value: formatCurrency(grossRevenueForDisplay) },
                { key: 'netRevenue', value: formatCurrency(totalNetRevenue) }
            );
            currentStatsForExport.topClassesByRevenue = topClassesByRevenue.map(item => ({ Ranking: 'Class by Revenue', name: item.name, value: item.value }));
            currentStatsForExport.topTutorsByRevenue = topTutorsByRevenue.map(item => ({ Ranking: 'Tutor by Revenue', name: item.name, value: item.value }));
        };

        const renderFilteredStats = async () => {
            statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            
            const days = parseFloat(appState.selectedFilters.statsPeriod);
            
            const isFutureView = days < 0;
            const primaryStatKey = isFutureView ? 'bookedBy' : 'attendedBy';
            const participantLabel = isFutureView ? _('label_total_enrollments') : _('label_total_attendees');
            const rankingValueLabel = isFutureView ? _('label_enrollments') : _('label_attendees');
            const tutorPopularityTitle = isFutureView ? _('header_top_tutors_enrollment') : _('header_top_tutors_attendance');

            let rawClasses;

            if (days === Infinity) {
                const allClassesSnapshot = await database.ref('/classes').once('value');
                rawClasses = firebaseObjectToArray(allClassesSnapshot.val()).filter(c => c && c.date);
            } else {
                const now = new Date();
                now.setUTCHours(0, 0, 0, 0);

                let startDate, endDate;
                if (isFutureView) {
                    startDate = new Date(now.getTime()); 
                    endDate = new Date(now.getTime());
                    endDate.setUTCDate(now.getUTCDate() + Math.abs(days));
                } else {
                    startDate = new Date(now.getTime());
                    startDate.setUTCDate(now.getUTCDate() - (days - 1));
                    endDate = now;
                }
                
                const startDateIso = getIsoDate(startDate);
                const endDateIso = getIsoDate(endDate);
                
                const classesSnapshot = await database.ref('/classes').orderByChild('date').startAt(startDateIso).endAt(endDateIso).once('value');
                rawClasses = firebaseObjectToArray(classesSnapshot.val());
            }

            // --- FILTER: Apply Permissions & Selection ---
            let filteredClasses = rawClasses;
            
            // 1. Permission Filter (Refactored)
            if (effectiveBranches.length < branches.length) {
                const allowedIds = effectiveBranches.map(b => b.id);
                filteredClasses = filteredClasses.filter(c => {
                    const cBranch = c.branchId || (branches.length > 0 ? branches[0].id : null);
                    return allowedIds.includes(cBranch);
                });
            }

            // 2. UI Filter: Apply Dropdown Selection
            const selectedBranchId = branchSelect ? branchSelect.value : 'all';

            if (hasEffectiveMulti && selectedBranchId !== 'all') {
                filteredClasses = filteredClasses.filter(c => {
                    const cBranch = c.branchId || (branches.length > 0 ? branches[0].id : null);
                    return cBranch === selectedBranchId;
                });
            }

            if (filteredClasses.length === 0) {
                 statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('info_no_data_for_period')}</p>`;
                 currentStatsForExport = {}; 
                 return;
            }

            let totalParticipants = 0, totalBookings = 0;
            filteredClasses.forEach(cls => {
                totalParticipants += cls[primaryStatKey] ? Object.keys(cls[primaryStatKey]).length : 0;
                totalBookings += cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
            });

            const totalCapacity = filteredClasses.reduce((sum, c) => sum + (c.maxParticipants || 0), 0);
            const avgFillRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;
            const attendanceRate = totalBookings > 0 ? (totalParticipants / totalBookings) * 100 : 0;
            
            const clsPopularity = rankByStat(filteredClasses, 'sportTypeId', primaryStatKey, appState.sportTypes);
            const tutorPopularity = rankByStat(filteredClasses, 'tutorId', primaryStatKey, appState.tutors);
            const peakTimes = rankTimeSlots(filteredClasses, 'desc', primaryStatKey);
            const lowTimes = rankTimeSlots(filteredClasses, 'asc', primaryStatKey);

            statsContainer.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div id="grossRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-slate-800">${_('status_loading')}...</p></div>
                    <div id="netRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold text-slate-800">${_('status_loading')}...</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${participantLabel}</p><p class="text-2xl font-bold text-slate-800">${totalParticipants}</p></div>
                    ${!isFutureView ? `<div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_attendance_rate')}</p><p class="text-2xl font-bold text-slate-800">${attendanceRate.toFixed(1)}%</p></div>` : ''}
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_avg_fill_rate')}</p><p class="text-2xl font-bold text-slate-800">${avgFillRate.toFixed(1)}%</p></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${createRankingCard(_('header_popular_classes'), clsPopularity, rankingValueLabel, '#6366f1', true)}
                    <div id="topEarningClassesCard">${createRankingCard(_('header_top_earning_classes'), [], _('label_revenue'), '#22c55e', true)}</div>
                    ${createRankingCard(tutorPopularityTitle, tutorPopularity, rankingValueLabel, '#6366f1')}
                    <div id="topTutorsByRevenueCard">${createRankingCard(_('header_top_tutors_revenue'), [], _('label_revenue'), '#22c55e')}</div>
                    ${createRankingCard(_('header_peak_times'), peakTimes, rankingValueLabel, '#f97316')}
                    ${createRankingCard(_('header_low_times'), lowTimes, rankingValueLabel, '#f97316')}
                </div>`;
            
            currentStatsForExport = {
                summary: [
                    { key: 'timePeriod', value: periodSelect.options[periodSelect.selectedIndex].text },
                    { key: 'totalParticipants', value: totalParticipants },
                    { key: 'avgFillRate', value: avgFillRate.toFixed(1) }
                ],
                clsPopularity: clsPopularity.map(item => ({ Ranking: 'Class by ' + rankingValueLabel, name: item.name, value: item.value })),
                tutorPopularity: tutorPopularity.map(item => ({ Ranking: 'Tutor by ' + rankingValueLabel, name: item.name, value: item.value })),
                peakTimes: peakTimes.map(item => ({ Ranking: 'Peak Time Slots', name: item.name, value: item.value })),
                lowTimes: lowTimes.map(item => ({ Ranking: 'Low Time Slots', name: item.name, value: item.value }))
            };
             if (!isFutureView) {
                currentStatsForExport.summary.push({ key: 'attendanceRate', value: attendanceRate.toFixed(1) });
            }
            
            await calculateAndRenderRevenueStats(filteredClasses, isFutureView);
        };

        exportBtn.onclick = () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = _('status_exporting');

            const { summary, clsPopularity, topClassesByRevenue, tutorPopularity, topTutorsByRevenue, peakTimes, lowTimes } = currentStatsForExport;

            if (!summary || summary.length === 0) {
                showMessageBox(_('info_no_stats_to_export'), 'info');
                exportBtn.disabled = false;
                exportBtn.innerHTML = exportBtnDefaultHTML;
                return;
            }

            const isFutureView = parseFloat(periodSelect.value) < 0;
            const classPopularityTitle = isFutureView ? _('export_cat_class_by_enrollment') : _('export_cat_class_by_attendance');
            const tutorPopularityTitle = isFutureView ? _('export_cat_tutor_by_enrollment') : _('export_cat_tutor_by_attendance');
            
            const translatedSummary = [
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_time_period'),
                    [_('export_header_value')]: summary.find(s => s.key === 'timePeriod')?.value || _('label_na')
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_gross_revenue'),
                    [_('export_header_value')]: summary.find(s => s.key === 'grossRevenue')?.value || _('label_na')
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_net_revenue'),
                    [_('export_header_value')]: summary.find(s => s.key === 'netRevenue')?.value || _('label_na')
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: isFutureView ? _('label_total_enrollments') : _('label_total_attendees'),
                    [_('export_header_value')]: summary.find(s => s.key === 'totalParticipants')?.value || _('label_na')
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_attendance_rate'),
                    [_('export_header_value')]: summary.find(s => s.key === 'attendanceRate')?.value || _('label_na')
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_avg_fill_rate'),
                    [_('export_header_value')]: summary.find(s => s.key === 'avgFillRate')?.value || _('label_na')
                },
            ];
            
            const createTranslatedSection = (title, data) => {
                if (!data || data.length === 0) return [];
                return [
                    { [_('export_header_category')]: '', [_('export_header_name')]: '', [_('export_header_value')]: '' },
                    ...data.map(item => ({
                        [_('export_header_category')]: title,
                        [_('export_header_name')]: item.name,
                        [_('export_header_value')]: (title === _('export_cat_class_by_revenue') || title === _('export_cat_tutor_by_revenue'))
                            ? formatCurrency(item.value)
                            : item.value
                    }))
                ];
            };

            const formattedExportData = [
                ...translatedSummary,
                ...createTranslatedSection(classPopularityTitle, clsPopularity),
                ...createTranslatedSection(_('export_cat_class_by_revenue'), topClassesByRevenue),
                ...createTranslatedSection(tutorPopularityTitle, tutorPopularity),
                ...createTranslatedSection(_('export_cat_tutor_by_revenue'), topTutorsByRevenue),
                ...createTranslatedSection(_('export_cat_peak_times'), peakTimes),
                ...createTranslatedSection(_('export_cat_low_times'), lowTimes),
            ];

            const periodText = periodSelect.options[periodSelect.selectedIndex].text.replace(/ /g, '-');
            const fileName = `statistics-report_${periodText}`;

            exportToCsv(fileName, formattedExportData);

            exportBtn.disabled = false;
            exportBtn.innerHTML = exportBtnDefaultHTML;
        };

        periodSelect.onchange = () => {
            appState.selectedFilters.statsPeriod = periodSelect.value;
            renderFilteredStats();
        };
        
        if (branchSelect) {
            branchSelect.onchange = renderFilteredStats;
        }
        
        renderFilteredStats();
    }

    function rankByStat(classes, groupByKey, valueKey, lookup) {
        const stats = classes.reduce((acc, cls) => {
            const count = cls[valueKey] ? Object.keys(cls[valueKey]).length : 0;
            acc[cls[groupByKey]] = (acc[cls[groupByKey]] || 0) + count;
            return acc;
        }, {});
        return Object.entries(stats)
            .map(([id, value]) => {
                const item = lookup.find(item => item.id === id);
                return {
                    id,
                    name: getSportTypeName(item), // <<< THIS IS THE FIX
                    value,
                    color: item?.color
                };
            })
            .sort((a,b) => b.value - a.value)
            .slice(0, 5);
    }

    function rankByGroupedRevenue(classes, revenueByClsId, lookupArray, groupingKey) {
        const revenueByGroup = classes.reduce((acc, cls) => {
            const clsRevenue = revenueByClsId.get(cls.id) || 0;
            const groupId = cls[groupingKey];
            if (groupId) {
                acc[groupId] = (acc[groupId] || 0) + clsRevenue;
            }
            return acc;
        }, {});

        return Object.entries(revenueByGroup)
            .map(([id, value]) => {
                const item = lookupArray.find(lookupItem => lookupItem.id === id);
                return {
                    id,
                    name: getSportTypeName(item), // <<< THIS IS THE FIX
                    value: value,
                    color: item?.color
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }

    function rankTimeSlots(classes, sortDirection = 'desc', valueKey = 'bookedBy') {
        const timeSlots = {};
        classes.forEach(c => {
            const hour = c.time.split(':')[0];
            // Using a simple 1-hour slot for clarity
            const slot = `${String(hour).padStart(2, '0')}:00 - ${String(parseInt(hour) + 1).padStart(2, '0')}:00`;
            // --- START OF CHANGE: Use the dynamic valueKey ---
            const participants = c[valueKey] ? Object.keys(c[valueKey]).length : 0;
            timeSlots[slot] = (timeSlots[slot] || 0) + participants;
            // --- END OF CHANGE ---
        });

        const sortedSlots = Object.entries(timeSlots).sort(([, aValue], [, bValue]) => {
            return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
        });

        // Filter out slots with zero enrollments for the "Low Time Slots" card to make it more meaningful
        const relevantSlots = sortDirection === 'asc' ? sortedSlots.filter(([, value]) => value > 0) : sortedSlots;

        return relevantSlots.slice(0, 5).map(([name, value]) => ({ name, value }));
    }

    function createRankingCard(title, data, valueLabel, color = '#6366f1', useColorDot = false) {
        // Find the maximum value for scaling the bar charts correctly.
        const max = data.length > 0 ? Math.max(...data.map(d => d.value)) : 0;

        return `
            <div class="p-6 bg-slate-50/50 rounded-lg">
                <h3 class="text-xl font-bold text-slate-700 mb-4">${title}</h3>
                <div class="space-y-4">
                ${data.length > 0 ? data.map(item => `
                    <div>
                        <div class="flex justify-between items-center text-sm mb-1">
                            <span class="font-semibold text-slate-600 flex items-center gap-2 truncate pr-2">
                                ${useColorDot ? `<span class="h-3 w-3 rounded-full flex-shrink-0" style="background-color: ${item.color || '#ccc'}"></span>` : ''}
                                <span class="truncate">${item.name}</span>
                            </span>
                            <span class="text-slate-500 font-medium flex-shrink-0">
                                ${valueLabel === _('label_revenue') ? formatCurrency(item.value) : `${item.value} ${valueLabel}`}
                            </span>
                        </div>
                        <div class="w-full bg-slate-200 rounded-full h-2.5">
                            <div class="bar-chart-bar h-2.5 rounded-full" style="--bar-width: ${max > 0 ? (item.value / max) * 100 : 0}%; --bar-color: ${color};"></div>
                        </div>
                    </div>
                `).join('') : `<p class="text-slate-500 text-sm">${_('info_no_data_to_display')}</p>`}
                </div>
            </div>`;
    }

    function populateDropdown(selectEl, options, isSportType = false) {
        selectEl.innerHTML = options.map(opt => {
            // If it's a sport type, use the special translation helper.
            // Otherwise, use the standard 'name' property.
            const name = isSportType ? getSportTypeName(opt) : opt.name;
            return `<option value="${opt.id}">${name}</option>`;
        }).join('');
    }

    function renderColorPicker(container, colorInput) {
        // --- FIX: Generate a unique ID suffix ---
        // This prevents collisions when multiple modals (e.g., SportType and Announcement)
        // are in the DOM at the same time.
        const uid = Math.random().toString(36).substr(2, 9);

        // 1. Use all presets except the last one
        const standardColors = CLS_COLORS.slice(0, -1);
        
        // 2. Determine initial state
        const currentColor = colorInput.value;
        const isCustom = currentColor && !standardColors.includes(currentColor);

        // 3. Render Standard Swatches (Using Unique IDs)
        let html = standardColors.map((color, index) => `
            <input type="radio" name="color" id="color-${index}-${uid}" value="${color}" class="color-swatch-radio" ${color === currentColor ? 'checked' : ''}>
            <label for="color-${index}-${uid}" class="color-swatch-label" style="background-color: ${color};" title="${color}"></label>
        `).join('');

        // 4. Render Custom Picker
        const customBg = isCustom ? currentColor : '#f1f5f9'; 
        const customBorder = isCustom ? 'none' : '2px dashed #cbd5e1'; 
        const iconHiddenClass = isCustom ? 'hidden' : '';

        html += `
            <input type="radio" name="color" id="color-custom-${uid}" value="custom" class="color-swatch-radio" ${isCustom ? 'checked' : ''}>
            <label for="color-custom-${uid}" id="lbl-custom-${uid}" class="color-swatch-label flex items-center justify-center relative overflow-hidden" style="background-color: ${customBg}; border: ${customBorder};" title="Custom Color">
                <svg id="icon-custom-${uid}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 ${iconHiddenClass} pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                <input type="color" id="inp-custom-${uid}" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value="${isCustom ? currentColor : '#ffffff'}">
            </label>
        `;

        container.innerHTML = html;

        // 5. Attach Logic (Using Unique IDs)
        const customRadio = container.querySelector(`#color-custom-${uid}`);
        const customLabel = container.querySelector(`#lbl-custom-${uid}`);
        const customIcon = container.querySelector(`#icon-custom-${uid}`);
        const customInput = container.querySelector(`#inp-custom-${uid}`);

        // A. Handle Custom Input Changes
        const handleCustomChange = (e) => {
            const newColor = e.target.value;
            colorInput.value = newColor;
            customRadio.checked = true;
            customLabel.style.backgroundColor = newColor;
            customLabel.style.border = 'none';
            customIcon.classList.add('hidden');
        };

        customInput.addEventListener('input', handleCustomChange);
        customInput.addEventListener('click', () => { customRadio.checked = true; });

        // B. Handle Standard Radio Changes
        container.addEventListener('change', (e) => {
            // Check 'value' instead of 'id' to be robust against ID changes
            if (e.target.name === 'color' && e.target.value !== 'custom' && e.target.type === 'radio') {
                colorInput.value = e.target.value;
                
                customLabel.style.backgroundColor = '#f1f5f9';
                customLabel.style.border = '2px dashed #cbd5e1';
                customIcon.classList.remove('hidden');
            }
        });
    }

    function populateSportTypeFilter(selectEl, sourceData = appState.sportTypes) {
        // Use the new translation key for the default option
        let optionsHtml = `<option value="all">${_('filter_all_sport_types')}</option>`;
        optionsHtml += sourceData.map(st => `<option value="${st.id}">${getSportTypeName(st)}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
    }

    function populateTutorFilter(selectEl, selectedSportTypeId = 'all', sourceTutors = appState.tutors) {
        let filteredTutors = sourceTutors;

        if (selectedSportTypeId !== 'all') {
            filteredTutors = sourceTutors.filter(tutor => 
                tutor.skills.some(skill => skill.sportTypeId === selectedSportTypeId)
            );
        }
        
        // Use the new translation key for the default option
        let optionsHtml = `<option value="all">${_('filter_all_tutors')}</option>`;
        optionsHtml += filteredTutors.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
    }

    function renderPaginationControls(container, currentPage, totalPages, totalItems, itemsPerPage, onPageChange) {
        container.innerHTML = '';
        if (totalItems === 0) {
            container.innerHTML = `<span class="text-sm text-slate-500">${_('pagination_no_items')}</span>`;
            return;
        }

        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        const infoEl = document.createElement('span');
        infoEl.className = 'text-sm text-slate-500';
        infoEl.textContent = _('pagination_showing_of').replace('{start}', startItem).replace('{end}', endItem).replace('{total}', totalItems);

        const buttonsEl = document.createElement('div');
        buttonsEl.className = 'flex items-center gap-2';

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>`;
        prevBtn.className = 'pagination-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => onPageChange(currentPage - 1);

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>`;
        nextBtn.className = 'pagination-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => onPageChange(currentPage + 1);
        
        buttonsEl.appendChild(prevBtn);
        buttonsEl.appendChild(nextBtn);
        
        container.appendChild(infoEl);
        container.appendChild(buttonsEl);
    }

    async function renderClassesPage(container) {
        const user = appState.currentUser;
        const isOwner = user.role === 'owner';
        const isManager = user.role === 'manager';
        const isOwnerOrManager = isOwner || isManager; // Keep for Export button logic

        const branches = appState.branches || [];
        const hasMultipleBranches = branches.length > 1;

        // --- REFACTORED: Use Helper ---
        const effectiveBranches = getEffectiveBranches(user, branches);
        const staffAccessLevel = user.staffAccessLevel || 'home_only'; // Kept for row-button edit logic

        // --- 1. Prepare Branch Filter HTML ---
        let branchFilterHTML = '';
        const hasEffectiveMulti = effectiveBranches.length > 1;

        if (hasEffectiveMulti) {
            let options = `<option value="all">${_('filter_all_branches')}</option>`;
            options += effectiveBranches.map(b => `<option value="${b.id}">${getBranchName(b)}</option>`).join('');
            branchFilterHTML = `<select id="classesBranchFilter" class="form-select w-48">${options}</select>`;
        }

        // --- 2. Build Layout ---
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_all_classes')} <span id="classesCount" class="text-xl font-semibold text-slate-500"></span></h2>
                    <div class="flex flex-wrap gap-4">
                        <!-- 1. Date/Time (Month) -->
                        <select id="classesMonthFilter" class="form-select w-48"></select>
                        <!-- 2. Branch (Conditional) -->
                        ${branchFilterHTML}
                        <!-- 3. Sport Type -->
                        <select id="classesSportTypeFilter" class="form-select w-48"></select>
                        <!-- 4. Tutor -->
                        <select id="classesTutorFilter" class="form-select w-48"></select>
                        
                        ${isOwnerOrManager ? `
                        <button id="exportClassesBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export')}
                        </button>
                        ` : ''}
                        <button id="addClsBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('btn_add_class')}</button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left min-w-[900px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 w-12">#</th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="date">${_('table_header_datetime')}<span class="sort-icon"></span></th>
                                ${hasMultipleBranches ? `<th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="branchName">${_('label_branch')}<span class="sort-icon"></span></th>` : ''}
                                <th class="p-2 whitespace-nowrap">${_('label_class')}</th>
                                <th class="p-2 whitespace-nowrap">${_('label_tutor')}</th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="credits">${_('label_credits')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="enrollments">${_('table_header_enrollments')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="attendees">${_('table_header_attendees')}<span class="sort-icon"></span></th>
                                <th class="p-2"></th>
                            </tr>
                        </thead>
                        <tbody id="classesTableBody"></tbody>
                    </table>
                </div>
                <div id="classesPagination" class="flex justify-between items-center mt-4"></div>
            </div>`;
        
        const monthFilter = container.querySelector('#classesMonthFilter');
        const branchFilter = container.querySelector('#classesBranchFilter'); 
        const sportTypeFilter = container.querySelector('#classesSportTypeFilter');
        const tutorFilter = container.querySelector('#classesTutorFilter');
        const addClsBtn = container.querySelector('#addClsBtn');
        const exportBtn = container.querySelector('#exportClassesBtn');
        let exportBtnDefaultHTML = '';
        if(exportBtn) {
            exportBtnDefaultHTML = exportBtn.innerHTML;
        }
        const tableBody = container.querySelector('#classesTableBody');
        let monthlyClasses = [];

        // --- 4. Initialization Logic ---
        const periodsSnapshot = await database.ref('/clsMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];

        if (periods.length > 0) {
            monthFilter.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            
            const currentMonthPeriod = getIsoDate(new Date()).substring(0, 7);

            if (appState.selectedFilters.classesPeriod && periods.includes(appState.selectedFilters.classesPeriod)) {
                monthFilter.value = appState.selectedFilters.classesPeriod;
            } else if (periods.includes(currentMonthPeriod)) {
                monthFilter.value = currentMonthPeriod;
            } else {
                monthFilter.value = periods[0];
            }
        } else {
            monthFilter.innerHTML = `<option value="">${_('label_no_months_available')}</option>`;
        }
        
        const updateDynamicFilters = (classesData) => {
            const presentSportIds = new Set(classesData.map(c => c.sportTypeId));
            const presentTutorIds = new Set(classesData.map(c => c.tutorId));

            const filteredSportTypes = appState.sportTypes.filter(st => presentSportIds.has(st.id));
            const filteredTutors = appState.tutors.filter(t => presentTutorIds.has(t.id));

            const currentSportSelection = sportTypeFilter.value;
            const currentTutorSelection = tutorFilter.value;

            populateSportTypeFilter(sportTypeFilter, filteredSportTypes);
            populateTutorFilter(tutorFilter, 'all', filteredTutors); 

            if (presentSportIds.has(currentSportSelection)) {
                sportTypeFilter.value = currentSportSelection;
            } else {
                sportTypeFilter.value = 'all';
                appState.selectedFilters.classesSportTypeId = 'all'; 
            }

            if (presentTutorIds.has(currentTutorSelection)) {
                tutorFilter.value = currentTutorSelection;
            } else {
                tutorFilter.value = 'all';
                appState.selectedFilters.classesTutorId = 'all'; 
            }
        };

        const fetchAndRenderClasses = async () => {
            const selectedMonth = monthFilter.value;
            const colSpan = hasMultipleBranches ? 9 : 8; 

            if (!selectedMonth) {
                tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">${_('status_please_select_month')}</td></tr>`;
                container.querySelector('#classesCount').textContent = '';
                container.querySelector('#classesPagination').innerHTML = '';
                populateSportTypeFilter(sportTypeFilter, []);
                populateTutorFilter(tutorFilter, 'all', []);
                return;
            }

            tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">${_('status_loading_classes_for_month').replace('{month}', selectedMonth)}</td></tr>`;
            
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`;
            const snapshot = await database.ref('/classes').orderByChild('date').startAt(startOfMonth).endAt(endOfMonth).once('value');

            monthlyClasses = firebaseObjectToArray(snapshot.val());
            
            monthlyClasses = filterClassesByBranchContext(monthlyClasses, branches, effectiveBranches, 'all');

            updateDynamicFilters(monthlyClasses);
            updateClassesTable();
        };

        const getClsBranchName = (cls) => {
            const bId = cls.branchId || (branches[0] ? branches[0].id : null);
            const branch = branches.find(b => b.id === bId);
            return getBranchName(branch); // Use global helper
        };

        const updateClassesTable = () => {
            const paginationContainer = container.querySelector('#classesPagination');
            const classesCountEl = container.querySelector('#classesCount');
            
            const selectedSportType = sportTypeFilter.value;
            const selectedTutor = tutorFilter.value;
            
            let selectedBranchId = 'all';
            if (branchFilter) {
                selectedBranchId = branchFilter.value;
            } else if (effectiveBranches.length === 1) {
                // If only one branch allowed, force logic even if filter hidden
                selectedBranchId = effectiveBranches[0].id;
            }

            // Pass 'monthlyClasses' which is already permission-filtered, but the helper handles double-filtering safely.
            let filteredClasses = filterClassesByBranchContext(monthlyClasses, branches, effectiveBranches, selectedBranchId);

            if (selectedSportType !== 'all') {
                filteredClasses = filteredClasses.filter(c => c.sportTypeId === selectedSportType);
            }
            if (selectedTutor !== 'all') {
                filteredClasses = filteredClasses.filter(c => c.tutorId === selectedTutor);
            }

            classesCountEl.textContent = `${_('label_in_month')} (${filteredClasses.length})`;

            const { key, direction } = appState.classesSort;
            filteredClasses.sort((a, b) => {
                let valA, valB;
                switch (key) {
                    case 'date':
                        valA = new Date(`${a.date}T${a.time}`).getTime();
                        valB = new Date(`${b.date}T${b.time}`).getTime();
                        break;
                    case 'enrollments': 
                        valA = a.bookedBy ? Object.keys(a.bookedBy).length : 0;
                        valB = b.bookedBy ? Object.keys(b.bookedBy).length : 0;
                        break;
                    case 'attendees': 
                        valA = a.attendedBy ? Object.keys(a.attendedBy).length : 0;
                        valB = b.attendedBy ? Object.keys(b.attendedBy).length : 0;
                        break;
                    case 'credits':
                        valA = a.credits;
                        valB = b.credits;
                        break;
                    case 'branchName': 
                        valA = getClsBranchName(a).toLowerCase();
                        valB = getClsBranchName(b).toLowerCase();
                        break;
                    default:
                        valA = a[key];
                        valB = b[key];
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            container.querySelectorAll('th.sortable .sort-icon').forEach(icon => icon.className = 'sort-icon');
            const activeHeader = container.querySelector(`th[data-sort-key="${key}"] .sort-icon`);
            if (activeHeader) activeHeader.classList.add(direction);

            const { itemsPerPage } = appState;
            const totalPages = Math.ceil(filteredClasses.length / itemsPerPage.classes) || 1;
            let page = appState.pagination.classes.page;
            
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1; 
            appState.pagination.classes.page = page;

            const paginatedClasses = filteredClasses.slice((page - 1) * itemsPerPage.classes, page * itemsPerPage.classes);
            
            let lastDate = null;
            const colSpan = hasMultipleBranches ? 9 : 8; 

            tableBody.innerHTML = paginatedClasses.map((cls, index) => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                const entryNumber = (page - 1) * itemsPerPage.classes + index + 1;
                
                const enrollmentsCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                const attendeesCount = cls.attendedBy ? Object.keys(cls.attendedBy).length : 0;
                
                const isNewDay = cls.date !== lastDate;
                lastDate = cls.date;

                const targetBranchId = cls.branchId || (branches.length > 0 ? branches[0].id : '');
                
                let branchCellHTML = '';
                if (hasMultipleBranches) {
                    const bName = getClsBranchName(cls);
                    branchCellHTML = `<td class="p-2 whitespace-nowrap">${bName}</td>`;
                }

                // --- Calculate Row Permissions (UPDATED) ---
                let showRowButtons = true;
                
                // UPDATED: Managers are now subject to permission checks, only Owner is exempt
                if (!isOwner) {
                    // Only apply restrictions if NOT 'global_write'
                    if (staffAccessLevel !== 'global_write') {
                        let writeAllowedIds = [];
                        if (user.allowedBranches && Object.keys(user.allowedBranches).length > 0) {
                            writeAllowedIds = Object.keys(user.allowedBranches);
                        } else {
                            writeAllowedIds = [user.homeBranchId || (branches.length > 0 ? branches[0].id : null)];
                        }

                        if (!writeAllowedIds.includes(targetBranchId)) {
                            showRowButtons = false;
                        }
                    }
                }
                
                const buttonsHTML = showRowButtons 
                    ? `<button class="edit-cls-btn font-semibold text-indigo-600" data-id="${cls.id}">${_('btn_edit')}</button>
                       <button class="delete-cls-btn font-semibold text-red-600" data-id="${cls.id}">${_('btn_delete')}</button>`
                    : `<span class="text-xs text-slate-400 italic">${_('label_view_only') || 'View Only'}</span>`;

                return `
                    <tr class="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isNewDay && index > 0 ? 'day-divider' : ''}" data-date="${cls.date}" data-branch-id="${targetBranchId}">
                        <td class="p-2 text-slate-500 font-semibold">${entryNumber}</td>
                        <td class="p-2 whitespace-nowrap">${formatShortDateWithYear(cls.date)}<br><span class="text-sm text-slate-500">${getTimeRange(cls.time, cls.duration)}</span></td>
                        ${branchCellHTML}
                        <td class="p-2 font-semibold whitespace-nowrap">${getSportTypeName(sportType)}</td>
                        <td class="p-2 whitespace-nowrap">${tutor?.name || _('label_unknown')}</td>
                        <td class="p-2 whitespace-nowrap">${cls.credits}</td>
                        <td class="p-2 whitespace-nowrap">${enrollmentsCount}</td>
                        <td class="p-2 whitespace-nowrap">${attendeesCount}/${cls.maxParticipants}</td>
                        <td class="p-2 text-right space-x-2 whitespace-nowrap">
                            ${buttonsHTML}
                        </td>
                    </tr>`;
            }).join('') || `<tr><td colspan="${colSpan}" class="text-center p-4 text-slate-500">${_('info_no_classes_match_filters')}</td></tr>`;

            renderPaginationControls(paginationContainer, page, totalPages, filteredClasses.length, itemsPerPage.classes, (newPage) => {
                appState.pagination.classes.page = newPage;
                updateClassesTable();
            });
        };

        monthFilter.onchange = () => {
            appState.selectedFilters.classesPeriod = monthFilter.value;
            appState.pagination.classes.page = 1; 
            fetchAndRenderClasses();
        };
        sportTypeFilter.onchange = () => {
            appState.selectedFilters.classesSportTypeId = sportTypeFilter.value;
            appState.pagination.classes.page = 1; 
            updateClassesTable();
        };
        tutorFilter.onchange = () => {
            appState.selectedFilters.classesTutorId = tutorFilter.value;
            appState.pagination.classes.page = 1; 
            updateClassesTable();
        };
        
        if (branchFilter) {
            branchFilter.onchange = () => {
                appState.pagination.classes.page = 1; 
                updateClassesTable();
            };
        }

        container.querySelectorAll('th.sortable').forEach(header => {
            header.onclick = () => {
                const newKey = header.dataset.sortKey;
                const currentSort = appState.classesSort;
                if (currentSort.key === newKey) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.key = newKey;
                    currentSort.direction = 'asc';
                }
                updateClassesTable();
            };
        });
        
        addClsBtn.onclick = () => {
            // Determine target branch context matching openClsModal logic
            // 1. Use filter value if specific branch is selected
            // 2. Fallback to global selection or default branch
            let targetBranchId = (branchFilter && branchFilter.value !== 'all') 
                ? branchFilter.value 
                : (appState.selectedScheduleBranch || (branches.length > 0 ? branches[0].id : null));

            // Permission Check
            if (!canManageBranch(user, targetBranchId)) {
                const bObj = branches.find(b => b.id === targetBranchId);
                const bName = bObj ? getBranchName(bObj) : _('label_legacy_branch');

                DOMElements.confirmationModal.innerHTML = `
                    <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content text-center">
                        <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 class="text-xl font-bold text-slate-800 mb-2">${_('error_access_denied')}</h2>
                        <p class="text-slate-600 mb-6 text-sm">${_('error_branch_add_class_denied').replace('{branch}', `<strong>${bName}</strong>`)}</p>
                        <button type="button" class="close-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg transition">${_('btn_close')}</button>
                    </div>`;
                
                openModal(DOMElements.confirmationModal);
                
                const close = () => {
                    closeModal(DOMElements.confirmationModal);
                    switchPage('schedule');
                };
                DOMElements.confirmationModal.querySelector('.close-btn').onclick = close;
                DOMElements.confirmationModal.querySelector('.modal-close-btn').onclick = close;
                return;
            }

            openClsModal(getIsoDate(new Date()));
        };
        
        if (isOwnerOrManager) {
            exportBtn.onclick = () => {
                exportBtn.disabled = true;
                exportBtn.innerHTML = _('status_exporting');
                
                let selectedBranchId = 'all';
                if (branchFilter) {
                    selectedBranchId = branchFilter.value;
                } else if (effectiveBranches.length === 1) {
                    selectedBranchId = effectiveBranches[0].id;
                }

                let classesToExport = monthlyClasses;

                if (selectedBranchId !== 'all') {
                    classesToExport = classesToExport.filter(c => {
                        const cBranch = c.branchId || branches[0].id;
                        return cBranch === selectedBranchId;
                    });
                }
                
                classesToExport.sort((a, b) => {
                    const dateComparison = a.date.localeCompare(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    return a.time.localeCompare(b.time);
                });

                const exportData = classesToExport.map(cls => {
                    const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                    const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                    const timeRange = getTimeRange(cls.time, cls.duration).split(' - ');
                    
                    const bookingsCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                    const attendeesCount = cls.attendedBy ? Object.keys(cls.attendedBy).length : 0;
                    
                    const rowData = {
                        [_('export_header_date')]: cls.date,
                    };

                    if (hasMultipleBranches) {
                        rowData[_('label_branch')] = getClsBranchName(cls);
                    }

                    Object.assign(rowData, {
                        [_('export_header_start_time')]: timeRange[0] || '',
                        [_('export_header_end_time')]: timeRange[1] || '',
                        [_('export_header_class_name')]: getSportTypeName(sportType),
                        [_('export_header_tutor_name')]: tutor?.name || _('unknown_tutor'),
                        [_('export_header_credits')]: cls.credits,
                        [_('table_header_enrollments')]: bookingsCount,
                        [_('export_header_attendees_capacity')]: `${attendeesCount}/${cls.maxParticipants}`
                    });

                    return rowData;
                });

                const selectedMonth = monthFilter.value;
                const fileName = selectedMonth ? `classes-export_${selectedMonth}` : 'classes-export';
                exportToCsv(fileName, exportData);
                
                exportBtn.disabled = false;
                exportBtn.innerHTML = exportBtnDefaultHTML;
            };
        }

        tableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-cls-btn');
            if (editBtn) {
                const clsToEdit = monthlyClasses.find(c => c.id === editBtn.dataset.id);
                if (clsToEdit) openClsModal(clsToEdit.date, clsToEdit);
                return;
            }

            const deleteBtn = e.target.closest('.delete-cls-btn');
            if (deleteBtn) {
                const clsToDelete = monthlyClasses.find(c => c.id === deleteBtn.dataset.id);
                if (clsToDelete) handleDeleteClsRequest(clsToDelete);
                return;
            }

            const row = e.target.closest('tr[data-date]');
            if (row) {
                const date = row.dataset.date;
                const targetBranchId = row.dataset.branchId;

                if (date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const targetDate = new Date(date);
                    targetDate.setHours(0, 0, 0, 0);

                    const daysDifference = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));
                    const currentLookBack = appState.ownerPastDaysVisible;

                    if (daysDifference > currentLookBack) {
                        appState.ownerPastDaysVisible = daysDifference + 7;
                        detachDataListeners();
                        initDataListeners();
                    }

                    if (targetBranchId) {
                        appState.selectedScheduleBranch = targetBranchId;
                    }

                    appState.scrollToDateOnNextLoad = date;
                    switchPage('schedule');
                }
            }
        });

        if (monthFilter.value) {
            fetchAndRenderClasses();
        } else {
            const colSpan = hasMultipleBranches ? 9 : 8;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8 text-slate-500">${_('info_no_classes_found_in_db')}</td></tr>`;
            container.querySelector('#classesCount').textContent = '';
            container.querySelector('#classesPagination').innerHTML = '';
        }
    }

    async function renderIncomePage(container) {
        const user = appState.currentUser;
        const isOwner = user.role === 'owner';
        const branches = appState.branches || [];

        // --- REFACTORED: Use Helper ---
        const effectiveBranches = getEffectiveBranches(user, branches);

        // --- 1. Prepare Branch Filter HTML ---
        let branchFilterHTML = '';
        const hasEffectiveMulti = effectiveBranches.length > 1;
        
        if (hasEffectiveMulti) {
            let options = `<option value="all">${_('filter_all_branches')}</option>`;
            options += effectiveBranches.map(b => `<option value="${b.id}">${getBranchName(b)}</option>`).join('');
            branchFilterHTML = `<select id="incomeBranchSelect" class="form-select w-full sm:w-48">${options}</select>`;
        }

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_income_overview')}</h2>
                    <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
                        ${branchFilterHTML}
                        <select id="incomePeriodSelect" class="form-select w-full sm:w-48"></select>
                        <button id="exportIncomeBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 w-full sm:w-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export_income')}
                        </button>
                    </div>
                </div>
                <div id="incomeDetailsContainer"><p class="text-center text-slate-500 p-8">${_('status_loading')}...</p></div>
            </div>`;

        const periodSelect = container.querySelector('#incomePeriodSelect');
        const branchSelect = container.querySelector('#incomeBranchSelect');
        const exportBtn = container.querySelector('#exportIncomeBtn');
        const detailsContainer = container.querySelector('#incomeDetailsContainer');
        const exportBtnDefaultHTML = exportBtn.innerHTML;

        const periodsSnapshot = await database.ref('/clsMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];

        if (periods.length > 0) {
            periodSelect.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            
            const currentMonthPeriod = getIsoDate(new Date()).substring(0, 7);
            if (appState.selectedFilters.incomePeriod && periods.includes(appState.selectedFilters.incomePeriod)) {
                periodSelect.value = appState.selectedFilters.incomePeriod;
            } else if (periods.includes(currentMonthPeriod)) {
                periodSelect.value = currentMonthPeriod;
            } else {
                periodSelect.value = periods[0];
            }
        } else {
            periodSelect.innerHTML = `<option value="">${_('label_no_months_available')}</option>`;
        }

        const renderIncomeDetails = async () => {
            const period = periodSelect.value;
            appState.selectedFilters.incomePeriod = period;

            if (!period) {
                detailsContainer.innerHTML = `<p class="text-center text-slate-500">${_('status_please_select_month')}</p>`;
                return;
            }

            detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;

            const startOfMonth = `${period}-01`;
            const endOfMonth = `${period}-31`;
            const snapshot = await database.ref('/classes').orderByChild('date').startAt(startOfMonth).endAt(endOfMonth).once('value');
            const classesInPeriod = firebaseObjectToArray(snapshot.val());

            // --- NEW: Apply Branch Filter (Security + UI) ---
            const selectedBranch = (branchSelect && branchSelect.value !== 'all') ? branchSelect.value : 'all';
            const filteredClasses = filterClassesByBranchContext(classesInPeriod, branches, effectiveBranches, selectedBranch);
            // --------------------------------

            const memberIdsInPeriod = new Set();
            filteredClasses.forEach(cls => {
                if (cls.bookedBy) Object.keys(cls.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            });

            const allMemberBookings = [];
            if (memberIdsInPeriod.size > 0) {
                filteredClasses.forEach(cls => {
                    if (cls.bookedBy) {
                        for (const memberId of Object.keys(cls.bookedBy)) {
                            if (memberIdsInPeriod.has(memberId)) {
                                const member = appState.users.find(u => u.id === memberId);
                                if (member) allMemberBookings.push({ member, cls });
                            }
                        }
                    }
                });
            }

            const { revenueByClsId } = calculateRevenueForBookings(allMemberBookings, 'projected');

            const dailyStatsMap = {};
            
            filteredClasses.forEach(cls => {
                if (!dailyStatsMap[cls.date]) {
                    dailyStatsMap[cls.date] = { 
                        date: cls.date, 
                        classCount: 0, 
                        attendees: 0, 
                        enrollments: 0, 
                        capacity: 0, 
                        grossRevenue: 0, 
                        netRevenue: 0,   
                        enrolledNames: []
                    };
                }
                
                const dayStat = dailyStatsMap[cls.date];
                dayStat.classCount++;
                dayStat.capacity += (cls.maxParticipants || 0);
                
                // This variable is defined ONCE here and reused below
                const bookingsForClass = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
                dayStat.enrollments += bookingsForClass.length;
                dayStat.attendees += (cls.attendedBy ? Object.keys(cls.attendedBy).length : 0);
                
                const clsGross = (revenueByClsId.get(cls.id) || 0);
                
                // --- FIXED: Use existing 'bookingsForClass' variable ---
                const clsPayout = calculateTutorPayout(cls, clsGross, bookingsForClass.length, appState.salaryFormulas);
                // ---------------------------------------

                const clsNet = clsGross - clsPayout;

                dayStat.grossRevenue += clsGross;
                dayStat.netRevenue += clsNet;

                bookingsForClass.forEach(uid => {
                    const user = appState.users.find(u => u.id === uid);
                    if (user) {
                        dayStat.enrolledNames.push(user.name);
                    }
                });
            });

            const dailyDetails = Object.values(dailyStatsMap);
            
            const totalGross = dailyDetails.reduce((sum, d) => sum + d.grossRevenue, 0);
            const totalNet = dailyDetails.reduce((sum, d) => sum + d.netRevenue, 0);
            const totalClasses = dailyDetails.reduce((sum, d) => sum + d.classCount, 0);
            const totalAttendees = dailyDetails.reduce((sum, d) => sum + d.attendees, 0);
            const totalEnrollments = dailyDetails.reduce((sum, d) => sum + d.enrollments, 0);

            const { key, direction } = appState.incomeSort;
            dailyDetails.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                if (key === 'date') {
                    valA = new Date(a.date).getTime();
                    valB = new Date(b.date).getTime();
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            const { itemsPerPage } = appState;
            const totalPages = Math.ceil(dailyDetails.length / itemsPerPage.income) || 1;
            let page = appState.pagination.income.page;
            if (page > totalPages) page = totalPages;
            const paginatedDetails = dailyDetails.slice((page - 1) * itemsPerPage.income, page * itemsPerPage.income);

            detailsContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-slate-800">${formatCurrency(totalGross)}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(totalNet)}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_classes_taught')}</p><p class="text-3xl font-bold text-slate-800">${totalClasses}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_total_enrollments')}</p><p class="text-3xl font-bold text-slate-800">${totalEnrollments}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_total_attendees')}</p><p class="text-3xl font-bold text-slate-800">${totalAttendees}</p></div>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-slate-700 mb-4">${_('header_daily_breakdown')}</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left min-w-[800px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="date">${_('table_header_datetime')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="classCount">${_('table_header_classes')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="enrollments">${_('table_header_enrollments')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer whitespace-nowrap" data-sort-key="attendees">${_('table_header_attendees')}<span class="sort-icon"></span></th>
                                <th class="p-2 text-right sortable cursor-pointer whitespace-nowrap" data-sort-key="grossRevenue">${_('label_gross_revenue')}<span class="sort-icon"></span></th>
                                <th class="p-2 text-right sortable cursor-pointer whitespace-nowrap" data-sort-key="netRevenue">${_('label_net_revenue')}<span class="sort-icon"></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paginatedDetails.map(d => `
                                <tr class="border-b border-slate-100">
                                    <td class="p-2 whitespace-nowrap">${formatShortDateWithYear(d.date)}</td>
                                    <td class="p-2 whitespace-nowrap">${d.classCount}</td>
                                    <td class="p-2 whitespace-nowrap">${d.enrollments}</td>
                                    <td class="p-2 whitespace-nowrap">${d.attendees} / ${d.capacity}</td>
                                    <td class="p-2 text-right font-semibold text-slate-700 whitespace-nowrap">${formatCurrency(d.grossRevenue)}</td>
                                    <td class="p-2 text-right font-bold whitespace-nowrap ${d.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(d.netRevenue)}</td>
                                </tr>`).join('') || `<tr><td colspan="6" class="text-center p-4 text-slate-500">${_('info_no_income_data')}</td></tr>`}
                        </tbody>
                    </table></div>
                    <div id="incomePagination" class="flex justify-between items-center mt-4"></div>
                </div>`;

            const paginationContainer = detailsContainer.querySelector('#incomePagination');
            renderPaginationControls(paginationContainer, page, totalPages, dailyDetails.length, itemsPerPage.income, (newPage) => {
                appState.pagination.income.page = newPage;
                renderIncomeDetails(); 
            });

            const sortState = appState.incomeSort;
            detailsContainer.querySelectorAll('th.sortable .sort-icon').forEach(icon => icon.className = 'sort-icon');
            const activeHeader = detailsContainer.querySelector(`th[data-sort-key="${sortState.key}"] .sort-icon`);
            if (activeHeader) activeHeader.classList.add(sortState.direction);

            detailsContainer.querySelectorAll('th.sortable').forEach(header => {
                header.onclick = () => {
                    const newKey = header.dataset.sortKey;
                    if (sortState.key === newKey) {
                        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = newKey;
                        sortState.direction = 'asc';
                    }
                    renderIncomeDetails();
                };
            });

            exportBtn.onclick = () => {
                exportBtn.disabled = true;
                exportBtn.innerHTML = _('status_exporting');

                const exportData = dailyDetails.map(d => ({
                    [_('export_header_date')]: d.date,
                    [_('table_header_classes')]: d.classCount,
                    [_('table_header_enrollments')]: d.enrollments,
                    [_('export_header_attendees_capacity')]: `${d.attendees}/${d.capacity}`,
                    [_('label_gross_revenue')]: d.grossRevenue.toFixed(2),
                    [_('label_net_revenue')]: d.netRevenue.toFixed(2),
                    [_('export_header_enrolled_members')]: d.enrolledNames.join(', ')
                }));

                exportData.push({}); 
                exportData.push({
                    [_('export_header_date')]: 'TOTAL',
                    [_('table_header_classes')]: totalClasses,
                    [_('table_header_enrollments')]: totalEnrollments,
                    [_('export_header_attendees_capacity')]: totalAttendees,
                    [_('label_gross_revenue')]: totalGross.toFixed(2),
                    [_('label_net_revenue')]: totalNet.toFixed(2)
                });

                const fileName = `income-report_${period}`;
                exportToCsv(fileName, exportData);

                exportBtn.disabled = false;
                exportBtn.innerHTML = exportBtnDefaultHTML;
            };
        };

        periodSelect.onchange = () => {
            appState.pagination.income.page = 1;
            renderIncomeDetails();
        };
        
        if (branchSelect) {
            branchSelect.onchange = () => {
                appState.pagination.income.page = 1;
                renderIncomeDetails();
            };
        }

        renderIncomeDetails();
    }

    async function openMemberBookingHistoryModal(member) {
        // --- Pagination State Initialization (Safe check) ---
        if (!appState.pagination.memberHistory) appState.pagination.memberHistory = { page: 1 };

        // Initial Loading State
        DOMElements.memberBookingHistoryModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${_('status_loading')}...</h2>
                <p class="text-center text-slate-500 mb-6">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                <div class="space-y-3 max-h-[60vh] overflow-y-auto" id="history-content-area">
                    <p class="text-center text-slate-500 p-8">${_('status_please_wait')}</p>
                </div>
            </div>
        `;
        openModal(DOMElements.memberBookingHistoryModal);

        try {
            const memberBookingsSnapshot = await database.ref(`/memberBookings/${member.id}`).once('value');
            
            let memberBookings = [];

            if (memberBookingsSnapshot.exists()) {
                const bookedClsIds = Object.keys(memberBookingsSnapshot.val());
                const clsPromises = bookedClsIds.map(clsId => database.ref(`/classes/${clsId}`).once('value'));
                const clsSnapshots = await Promise.all(clsPromises);

                memberBookings = clsSnapshots
                    .map(snap => ({ id: snap.key, ...snap.val() }))
                    .filter(cls => cls.date)
                    // FIX: Sort by Date Descending, then Time Descending
                    .sort((a, b) => {
                        const dateComparison = b.date.localeCompare(a.date);
                        if (dateComparison !== 0) return dateComparison;
                        return b.time.localeCompare(a.time); // Changed from a.time.localeCompare(b.time)
                    });
            }

            const branches = appState.branches || [];
            const defaultBranchId = branches.length > 0 ? branches[0].id : 'legacy';

            // Filter State
            let currentCreditFilter = 'all';
            let currentBranchFilter = 'all';

            // --- DYNAMIC PILL GENERATION WITH WATERFALL LOGIC ---
            const getPillsHTML = () => {
                if (memberBookings.length === 0) return ''; 

                // 1. Reset Stats for Calculation
                const usedBranchIds = new Set();
                const branchClassCountMap = { 'all': 0 };
                
                const usedCreditTypeIds = new Set();
                const creditUsageMap = { 'all': 0 };

                // 2. Iterate Bookings to Build Stats
                memberBookings.forEach(cls => {
                    const booking = cls.bookedBy[member.id];
                    const bId = cls.branchId || defaultBranchId;
                    const typeId = booking.creditTypeId || cls.costCreditTypeId || 'general';
                    const creditsUsed = parseFloat(booking.creditsPaid || 0);

                    // A. Branch Stats (Always Absolute)
                    // We count all classes for branch pills so user sees full availability
                    branchClassCountMap['all']++;
                    if (!branchClassCountMap[bId]) { branchClassCountMap[bId] = 0; }
                    branchClassCountMap[bId]++;
                    usedBranchIds.add(bId);

                    // B. Credit Stats (Waterfall: Dependent on Branch Selection)
                    const branchMatch = (currentBranchFilter === 'all') || (bId === currentBranchFilter);
                    
                    if (branchMatch) {
                        // Only count credits if the class belongs to the selected branch
                        usedCreditTypeIds.add(typeId);
                        
                        creditUsageMap['all'] += creditsUsed;
                        if (!creditUsageMap[typeId]) { creditUsageMap[typeId] = 0; }
                        creditUsageMap[typeId] += creditsUsed;
                    }
                });

                // 3. Generate HTML
                
                // --- ROW 1: Branch Filters ---
                let branchPillsHTML = '';
                if (usedBranchIds.size > 1) {
                    branchPillsHTML = `<div class="flex flex-wrap gap-2 justify-center mb-1">`;
                    
                    const allBranchActive = currentBranchFilter === 'all';
                    const allBranchClass = allBranchActive ? 'bg-slate-700 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200';
                    const countLabel = branchClassCountMap['all'];
                    
                    branchPillsHTML += `<button class="modal-pill-branch px-3 py-1 text-xs font-bold rounded-full transition-all ${allBranchClass}" data-filter-branch="all">${_('filter_all_branches')} (${countLabel})</button>`;

                    usedBranchIds.forEach(bId => {
                        const branchObj = branches.find(b => b.id === bId);
                        const bName = branchObj ? ((appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name) : _('label_legacy_branch');
                        const bColor = branchObj ? (branchObj.color || '#64748b') : '#64748b';
                        const isActive = currentBranchFilter === bId;
                        const bCount = branchClassCountMap[bId] || 0;

                        // Unified Style (No Border)
                        let style = isActive ? `background-color: ${bColor}; color: white; box-shadow: 0 4px 6px -1px ${bColor}66;` : `background-color: ${bColor}15; color: ${bColor};`;
                        let className = 'modal-pill-branch px-3 py-1 text-xs font-bold rounded-full transition-all ' + (isActive ? '' : 'hover:opacity-80');
                        
                        branchPillsHTML += `<button class="${className}" style="${style}" data-filter-branch="${bId}">${bName} (${bCount})</button>`;
                    });
                    branchPillsHTML += `</div>`;
                }

                // --- ROW 2: Credit Filters ---
                let creditPillsHTML = '<div class="flex flex-wrap gap-2 justify-center mb-4">';
                
                const allCreditActive = currentCreditFilter === 'all';
                const allCreditClass = allCreditActive ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                const allUsageText = _('label_used_credits_suffix').replace('{count}', formatCredits(creditUsageMap['all'] || 0));
                
                creditPillsHTML += `<button class="modal-pill-credit px-3 py-1 text-xs font-bold rounded-full transition-all ${allCreditClass}" data-type-id="all">${_('filter_all')} ${allUsageText}</button>`;

                if (usedCreditTypeIds.size > 1) {
                    usedCreditTypeIds.forEach(typeId => {
                        const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                        const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                        const baseColor = typeDef?.color || '#64748b';
                        
                        const isActive = currentCreditFilter === typeId;
                        const usageText = _('label_used_credits_suffix').replace('{count}', formatCredits(creditUsageMap[typeId] || 0));

                        let style = isActive ? `background-color: ${baseColor}; color: white; box-shadow: 0 4px 6px -1px ${baseColor}66;` : `background-color: ${baseColor}15; color: ${baseColor};`;
                        let className = 'modal-pill-credit px-3 py-1 text-xs font-bold rounded-full transition-all ml-1 ' + (isActive ? '' : 'hover:opacity-80');
                        
                        creditPillsHTML += `<button class="${className}" style="${style}" data-type-id="${typeId}">${typeName} ${usageText}</button>`;
                    });
                }
                creditPillsHTML += '</div>';

                return branchPillsHTML + creditPillsHTML;
            };

            // 4. Main Render Function for Content
            const renderContent = () => {
                const listContainer = DOMElements.memberBookingHistoryModal.querySelector('#history-content-area');
                const paginationContainer = DOMElements.memberBookingHistoryModal.querySelector('#historyPagination');

                // --- DUAL FILTERING ---
                const filteredBookings = memberBookings.filter(cls => {
                    const booking = cls.bookedBy[member.id];
                    
                    // 1. Branch Filter (Primary)
                    const branchId = cls.branchId || defaultBranchId;
                    const branchMatch = (currentBranchFilter === 'all') || (branchId === currentBranchFilter);

                    // 2. Credit Filter (Secondary)
                    const typeId = booking.creditTypeId || cls.costCreditTypeId || 'general';
                    const creditMatch = (currentCreditFilter === 'all') || (typeId === currentCreditFilter);

                    return branchMatch && creditMatch;
                });

                const countText = `(${filteredBookings.length})`;
                const headerEl = DOMElements.memberBookingHistoryModal.querySelector('#history-modal-header');
                if (headerEl) headerEl.textContent = `${_('header_member_booking_history').replace('{name}', member.name)} ${countText}`;

                if (filteredBookings.length === 0) {
                    listContainer.innerHTML = `<p class="text-slate-500 text-center p-8">${_('no_booking_history')}</p>`;
                    paginationContainer.innerHTML = '';
                    return;
                }

                // --- PAGINATION LOGIC START ---
                const itemsPerPage = 10;
                const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
                let page = appState.pagination.memberHistory.page;
                if (page > totalPages) page = totalPages;

                const paginatedBookings = filteredBookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);
                // --- PAGINATION LOGIC END ---

                listContainer.innerHTML = paginatedBookings.map(cls => {
                    const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                    const isAttended = cls.attendedBy && cls.attendedBy[member.id];
                    const bookingDetails = cls.bookedBy[member.id];
                    const creditsUsed = bookingDetails.creditsPaid;

                    // Monthly Plan Note
                    const isMonthlyPayment = bookingDetails.paymentMethod === 'monthly';
                    const monthlyNote = isMonthlyPayment ? ` <span class="text-slate-500 font-normal ml-1">(${_('info_monthly_plan_coverage')})</span>` : '';
                    
                    // Credit Pill
                    const typeId = bookingDetails.creditTypeId || cls.costCreditTypeId || 'general';
                    const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === typeId) : null;
                    const typeName = typeDef ? getCreditTypeName(typeDef) : (typeId === 'general' ? _('label_general') : _('label_credits'));
                    const typeColor = typeDef?.color || '#64748b';
                    const typePill = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 align-middle" style="background-color: ${typeColor}26; color: ${typeColor}">${typeName}</span>`;

                    // --- NEW: Branch Badge Logic ---
                    let branchBadge = '';
                    if (branches.length > 1) {
                        const bId = cls.branchId || defaultBranchId;
                        const branchObj = branches.find(b => b.id === bId);
                        if (branchObj) {
                            const bName = (appState.currentLanguage === 'zh-TW' && branchObj.name_zh) ? branchObj.name_zh : branchObj.name;
                            const bColor = branchObj.color || '#64748b';
                            branchBadge = `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border align-middle ml-2" style="background-color: ${bColor}15; color: ${bColor}; border-color: ${bColor}30;">${bName}</span>`;
                        }
                    }
                    // -------------------------------

                    return `<div class="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <!-- Added Branch Badge -->
                            <p class="font-bold text-slate-800">${getSportTypeName(sportType)}${branchBadge}</p>
                            <p class="text-sm text-slate-500">${_('template_datetime_at').replace('{date}', formatDateWithWeekday(cls.date)).replace('{time}', getTimeRange(cls.time, cls.duration))}</p>
                            <div class="text-xs text-slate-600 mt-1 flex items-center">
                                ${_('label_credits_used')} ${creditsUsed} ${typePill}${monthlyNote}
                            </div>
                            <p class="text-xs text-slate-500 mt-0.5">${formatBookingAuditText(bookingDetails)}</p>
                        </div>
                        ${isAttended 
                            ? `<span class="text-sm font-semibold text-green-600">${_('status_completed')}</span>`
                            : `<button class="cancel-booking-btn-member-history text-sm font-semibold text-red-600 hover:text-red-800" data-cls-id="${cls.id}" data-member-id="${member.id}">${_('btn_cancel')}</button>`
                        }
                    </div>`;
                }).join('');

                // Render Pagination Controls
                renderPaginationControls(paginationContainer, page, totalPages, filteredBookings.length, itemsPerPage, (newPage) => {
                    appState.pagination.memberHistory.page = newPage;
                    renderContent();
                });

                // Re-attach cancel listeners
                listContainer.querySelectorAll('.cancel-booking-btn-member-history').forEach(btn => {
                    btn.onclick = () => {
                        const cls = memberBookings.find(c => c.id === btn.dataset.clsId);
                        const memberId = btn.dataset.memberId;
                        handleCancelBooking(cls, memberId);
                    };
                });
            };

            // 5. Update the Main Container Structure
            DOMElements.memberBookingHistoryModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative open">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <h2 id="history-modal-header" class="text-3xl font-bold text-slate-800 mb-2 text-center"></h2>
                    <p class="text-center text-slate-500 mb-4">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                    
                    <div id="modal-filter-pills-container"></div>

                    <div class="space-y-3 max-h-[50vh] overflow-y-auto" id="history-content-area"></div>
                    <div id="historyPagination" class="flex justify-between items-center mt-4 pt-2 border-t border-slate-100"></div>
                </div>
            `;

            // 6. Bind Pill Events
            const bindPillEvents = () => {
                const container = DOMElements.memberBookingHistoryModal.querySelector('#modal-filter-pills-container');
                container.innerHTML = getPillsHTML();
                
                // Credit Filter Logic
                container.querySelectorAll('.modal-pill-credit').forEach(btn => {
                    btn.onclick = () => {
                        currentCreditFilter = btn.dataset.typeId;
                        appState.pagination.memberHistory.page = 1; 
                        renderContent();
                        bindPillEvents(); 
                    };
                });

                // Branch Filter Logic (Triggers waterfall update)
                container.querySelectorAll('.modal-pill-branch').forEach(btn => {
                    btn.onclick = () => {
                        currentBranchFilter = btn.dataset.filterBranch;
                        
                        // --- WATERFALL RESET ---
                        // Reset credit filter to 'all' whenever the branch changes
                        currentCreditFilter = 'all'; 
                        
                        appState.pagination.memberHistory.page = 1;
                        renderContent();
                        bindPillEvents(); 
                    };
                });
            };

            bindPillEvents();
            renderContent();

        } catch (error) {
            console.error("Error fetching member booking history:", error);
            const historyContentArea = DOMElements.memberBookingHistoryModal.querySelector('#history-content-area');
            if (historyContentArea) {
                historyContentArea.innerHTML = `<p class="text-center text-red-500 p-8">${_('error_could_not_load_booking_history')}</p>`;
            }
        }
    }

    // Track the currently active branch subscription to avoid redundant re-fetches
    let currentSubscribedBranchId = null;

    const setupClassSubscription = (branchId) => {
        // 1. Safety Checks
        if (!branchId) return;
        
        // 2. Detach previous listener
        if (activeClassesRef) {
            activeClassesRef.off();
            activeClassesRef = null;
        }

        // 3. Clear local state (Optimistic UI)
        appState.classes = [];
        currentSubscribedBranchId = branchId;

        // 4. Define the Query
        const classesRef = database.ref('/classes');
        let query;

        // --- OPTIMIZATION: TIME WINDOW CAPPING ---
        const today = new Date();
        const daysToLookBack = appState.ownerPastDaysVisible || 0; 
        
        // Start Date: Based on how far back the owner has scrolled
        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCDate(today.getUTCDate() - daysToLookBack);

        // End Date: Cap at 180 days (6 months) forward to support "Go To Date" jumps
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 180); // Changed from + 60 to + 180

        query = classesRef.orderByChild('date')
            .startAt(getIsoDate(startDate))
            .endAt(getIsoDate(endDate));

        activeClassesRef = query;

        // 5. Helper: Visibility Check for Members
        const isVisibleForMember = (cls) => {
            const user = appState.currentUser;
            const isOwner = user?.role === 'owner';
            const isStaff = user?.role === 'staff';
            const isManager = user?.role === 'manager';
            
            // Admins see all (drafts included)
            if (isOwner || isStaff || isManager) return true; 

            const scheduleStatus = appState.scheduleStatus || {};
            const todayIso = getIsoDate(new Date());
            
            // Past classes always visible
            if (cls.date < todayIso) return true;

            // Future classes check Draft status
            const statusRaw = scheduleStatus[cls.date];
            if (typeof statusRaw === 'boolean') {
                const mainBranchId = appState.branches[0]?.id;
                return !cls.branchId || cls.branchId === mainBranchId;
            } else if (statusRaw && typeof statusRaw === 'object') {
                // Check status for this specific branch
                const cBranch = cls.branchId || (appState.branches[0]?.id);
                return statusRaw[cBranch] === true;
            }
            return false; 
        };

        // 6. Attach Listeners
        const onChildAdded = (snapshot) => {
            const newCls = { id: snapshot.key, ...snapshot.val() };
            
            if (isVisibleForMember(newCls)) {
                if (!appState.classes.some(c => c.id === newCls.id)) {
                    appState.classes.push(newCls);
                    if (appState.activePage === 'schedule') {
                        _reSortDayColumn(newCls.date);
                    }
                }
            }
        };

        const onChildChanged = (snapshot) => {
            const updatedCls = { id: snapshot.key, ...snapshot.val() };
            
            if (isVisibleForMember(updatedCls)) {
                const index = appState.classes.findIndex(c => c.id === updatedCls.id);
                if (index > -1) {
                    appState.classes[index] = updatedCls;
                } else {
                    appState.classes.push(updatedCls);
                }
                
                if (appState.activePage === 'schedule') {
                    _reSortDayColumn(updatedCls.date);
                }
            }
        };

        const onChildRemoved = (snapshot) => {
            const removedClsId = snapshot.key;
            appState.classes = appState.classes.filter(c => c.id !== removedClsId);
            const el = document.getElementById(removedClsId);
            if (el) el.remove();
        };

        query.on('child_added', onChildAdded);
        query.on('child_changed', onChildChanged);
        query.on('child_removed', onChildRemoved);

        // 7. Initial Fetch Trigger
        query.once('value', () => {
            // Re-render schedule if active to show data immediately
            if (appState.activePage === 'schedule') {
                renderCurrentPage();
            }
        });
    };

    // --- Firebase Listeners ---
    const initDataListeners = () => {
        // Detach any old listeners before setting up new ones.
        detachDataListeners();

        const user = appState.currentUser;
        const isOwner = user?.role === 'owner';
        const isManager = user?.role === 'manager';
        const isStaff = user?.role === 'staff';
        
        // 1. Determine Plan Level
        // If Owner: use own status. If Staff/Manager: use the synced studioPlan.
        const plan = (isOwner ? user.subscriptionStatus : appState.studioPlan) || 'basic';
        const isBasic = plan.toLowerCase() === 'basic';

        // 2. Routing Logic
        // Owners ALWAYS get full access (to manage subscription/downgrade).
        // Managers/Staff only get full access if plan is NOT Basic.
        if (isOwner || ((isManager || isStaff) && !isBasic)) {
            initOwnerListeners();
        } else {
            // Basic Plan Staff/Managers get Member view (restricted data)
            initMemberListeners();
        }
    };

    const initOwnerListeners = () => {
        const announcementRef = database.ref('/announcements/current');
        dataListeners.announcement = (snapshot) => {
            appState.currentAnnouncement = snapshot.val();
            displayAnnouncement();
            if (appState.activePage === 'admin') renderAdminPage(document.getElementById('page-admin'));
        };
        announcementRef.on('value', dataListeners.announcement);

        // Staff/Manager Plan Sync Logic
        if (appState.currentUser.role === 'staff' || appState.currentUser.role === 'manager') {
            if (ownerPlanQuery) ownerPlanQuery.off();
            ownerPlanQuery = database.ref('/users').orderByChild('role').equalTo('owner').limitToFirst(1);
            
            const handleOwnerPlanUpdate = (snapshot) => {
                const ownerData = snapshot.val();
                if (ownerData) {
                    const owner = Object.values(ownerData)[0];
                    if (owner) {
                        const newPlan = owner.subscriptionStatus || 'basic';
                        const oldPlan = appState.studioPlan;
                        appState.studioPlan = newPlan;

                        // --- FIX: Downgrade Protection ---
                        // If we are currently in Owner Mode (Premium), but the plan drops to Basic,
                        // we must restart to switch to Member Mode (restricted).
                        if (newPlan === 'basic' && oldPlan !== 'basic') {
                            initDataListeners();
                            return;
                        }
                        
                        updateUIVisibility();
                    }
                }
            };
            ownerPlanQuery.on('value', handleOwnerPlanUpdate);
        }

        const nonUserRefs = {
            tutors: database.ref('/tutors'),
            sportTypes: database.ref('/sportTypes'),
            studioSettings: database.ref('/studioSettings'),
            currentUser: database.ref('/users/' + appState.currentUser.id),
            scheduleStatus: database.ref('/scheduleStatus'),
            creditTypes: database.ref('/creditTypes'),
            monthlyPlanTiers: database.ref('/monthlyPlanTiers'),
            branches: database.ref('/branches'),
            salaryFormulas: database.ref('/salaryFormulas')
        };

        Object.entries(nonUserRefs).forEach(([key, ref]) => {
            dataListeners[key] = (snapshot) => {
                const val = snapshot.val();
                if (key === 'currentUser') {
                    // --- SECURITY: Immediate Logout if Account Deleted ---
                    if (val && val.isDeleted) {
                        auth.signOut();
                        return;
                    }
                    // ---------------------------------------------------
                    
                    appState.currentUser = { ...appState.currentUser, ...val };
                    
                    if (appState.currentUser.role === 'owner') {
                        appState.studioPlan = val.subscriptionStatus;
                    }

                    renderNav(); 
                    renderSubscriptionBadge();
                    if (['admin','income','salary','statistics','check-in','filter','account'].includes(appState.activePage)) renderCurrentPage();
                } else if (key === 'studioSettings') {
                    if (val) appState.studioSettings = { ...appState.studioSettings, ...val, clsDefaults: { ...appState.studioSettings.clsDefaults, ...(val.clsDefaults || {}) } };
                    if (appState.activePage === 'admin') renderAdminPage(document.getElementById('page-admin'));
                } else if (key === 'scheduleStatus') {
                    appState.scheduleStatus = val || {};
                    if (appState.activePage === 'schedule') renderCurrentPage();
                } else { 
                    appState[key] = firebaseObjectToArray(val);
                    if (appState.activePage === 'admin') renderAdminLists();
                    if (key === 'branches' && appState.branches.length > 0) {
                        const defaultBranch = appState.currentUser.homeBranchId || appState.branches[0].id;
                        if (!appState.selectedScheduleBranch) appState.selectedScheduleBranch = defaultBranch;
                        setupClassSubscription(appState.selectedScheduleBranch);
                    }
                }
            };
            ref.on('value', dataListeners[key], (error) => console.error(`Listener error on /${key}`, error));
        });

        const usersRef = database.ref('/users');
        dataListeners.users = (snapshot) => {
            // --- PERFORMANCE: Use Fast Converter (No Sort) ---
            appState.users = firebaseObjectToArrayFast(snapshot.val());
            // -------------------------------------------------
            
            const pagesRequiringUserListRender = ['members', 'salary', 'statistics', 'income'];
            if (pagesRequiringUserListRender.includes(appState.activePage)) {
                if (window.userRenderTimeout) clearTimeout(window.userRenderTimeout);
                window.userRenderTimeout = setTimeout(() => renderCurrentPage(), 100);
            }
        };
        usersRef.on('value', dataListeners.users, (error) => console.error(`Listener error on /users`, error));
    };

    const initMemberListeners = () => {
        const announcementRef = database.ref('/announcements/current');
        dataListeners.announcement = (snapshot) => {
            appState.currentAnnouncement = snapshot.val();
            displayAnnouncement();
        };
        announcementRef.on('value', dataListeners.announcement);

        // Listen for Owner's Subscription Status
        if (ownerPlanQuery) ownerPlanQuery.off();
        ownerPlanQuery = database.ref('/users').orderByChild('role').equalTo('owner').limitToFirst(1);
        
        const handleOwnerPlanUpdate = (snapshot) => {
            const ownerData = snapshot.val();
            if (ownerData) {
                const owner = Object.values(ownerData)[0];
                if (owner) {
                    const newPlan = owner.subscriptionStatus || 'basic';
                    const oldPlan = appState.studioPlan;
                    
                    appState.studioPlan = newPlan;

                    // --- ROOT CAUSE FIX: "The Escape Hatch" ---
                    // If we initialized in Basic mode (default) but discover we are actually Premium/Pro,
                    // we must restart the listeners to switch to Owner Mode immediately.
                    if (newPlan !== 'basic' && (oldPlan === 'basic' || !oldPlan)) {
                        initDataListeners(); 
                        return; // Stop here, the restart handles everything
                    }

                    // Standard update for Basic -> Basic changes
                    renderNav();
                    // Explicitly update badge in case of minor changes (e.g. name change)
                    renderSubscriptionBadge();
                    if (appState.activePage === 'check-in') renderCurrentPage();
                }
            }
        };
        ownerPlanQuery.on('value', handleOwnerPlanUpdate);

        const refs = {
            tutors: database.ref('/tutors'),
            sportTypes: database.ref('/sportTypes'),
            studioSettings: database.ref('/studioSettings'),
            creditTypes: database.ref('/creditTypes'),
            monthlyPlanTiers: database.ref('/monthlyPlanTiers'),
            branches: database.ref('/branches') 
        };
        
        const currentUserRef = database.ref('/users/' + appState.currentUser.id);
        dataListeners['currentUser'] = (snapshot) => {
            const newUserData = snapshot.val();
            
            // --- SECURITY: Immediate Logout if Account Deleted ---
            if (!newUserData || newUserData.isDeleted) {
                auth.signOut();
                return;
            }
            // ---------------------------------------------------

            appState.currentUser = { id: appState.currentUser.id, ...newUserData };
            if (appState.activePage === 'account') renderCurrentPage();
        };
        currentUserRef.on('value', dataListeners['currentUser'], (error) => console.error(`Listener error on /users/${appState.currentUser.id}`, error));

        Object.entries(refs).forEach(([key, ref]) => {
            dataListeners[key] = (snapshot) => {
                const val = snapshot.val();
                if (key === 'studioSettings') {
                    if (val) {
                        appState.studioSettings = { ...appState.studioSettings, ...val, clsDefaults: { ...appState.studioSettings.clsDefaults, ...(val.clsDefaults || {}) } };
                        if (appState.activePage === 'schedule') renderCurrentPage();
                    }
                } else {
                    appState[key] = firebaseObjectToArray(val);
                    if ((key === 'creditTypes' || key === 'monthlyPlanTiers') && appState.activePage === 'account') renderCurrentPage();
                    if (key === 'branches') {
                        if (appState.branches.length > 0) {
                            const defaultBranch = appState.currentUser.homeBranchId || appState.branches[0].id;
                            if (!appState.selectedScheduleBranch) appState.selectedScheduleBranch = defaultBranch;
                            setupClassSubscription(appState.selectedScheduleBranch);
                        }
                        if (appState.activePage === 'schedule') renderCurrentPage();
                    }
                }
            };
            ref.on('value', dataListeners[key], (error) => console.error(`Listener error on /${key}`, error));
        });

        const statusRef = database.ref('/scheduleStatus');
        dataListeners.scheduleStatus = (snapshot) => {
            appState.scheduleStatus = snapshot.val() || {};
            if (appState.activePage === 'schedule') {
                currentSubscribedBranchId = null; 
                setupClassSubscription(appState.selectedScheduleBranch);
            }
        };
        statusRef.on('value', dataListeners.scheduleStatus);
    };

    const detachDataListeners = () => {
        if (activeClassesRef) {
            activeClassesRef.off();
        }
        activeClassesRef = null;

        // --- NEW: Cleanup Owner Plan Query ---
        if (ownerPlanQuery) {
            ownerPlanQuery.off();
            ownerPlanQuery = null;
        }
        // -------------------------------------

        Object.values(memberCheckInListeners).forEach(({ ref, listener }) => ref.off('value', listener));
        memberCheckInListeners = {};

        if (dataListeners.announcement) {
            database.ref('/announcements/current').off('value', dataListeners.announcement);
        }

        Object.entries(dataListeners).forEach(([key, listenerInfo]) => {
            let path;
            if (key === 'currentUser' && appState.currentUser) {
                path = `/users/${appState.currentUser.id}`;
            } else {
                path = `/${key}`;
            }
            database.ref(path).off('value', listenerInfo);
        });
        
        dataListeners = {};
    };

    const setupLanguageToggles = () => {
        const langSelectors = document.querySelectorAll('.lang-selector');
        langSelectors.forEach(selector => {
            selector.onclick = (e) => {
                e.preventDefault();
                // The setLanguage function already handles saving to DB for logged-in users
                setLanguage(selector.dataset.lang);
            };
        });
    };

    // --- Auth State Change Handler ---
    const handleAuthStateChange = (user) => {
        if (user) {
            // Detach any listeners from a previous session.
            detachDataListeners();
            
            database.ref('/users/' + user.uid).once('value', snapshot => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();

                    // --- NEW: Security Check for Deleted Users ---
                    if (userData.isDeleted) {
                        showMessageBox(_('error_account_disabled') || 'Account disabled.', 'error');
                        auth.signOut();
                        return;
                    }
                    // ---------------------------------------------

                    appState.currentUser = { id: user.uid, ...userData }; 

                    // --- START: NEW LANGUAGE LOGIC ---
                    // Load language from DB, fallback to browser storage, then to default
                    const userLang = userData.language || localStorage.getItem('studioPulseLanguage') || 'en';
                    setLanguage(userLang, false); // Set language from DB, don't re-save immediately
                    // --- END: NEW LANGUAGE LOGIC ---

                    DOMElements.authPage.classList.add('hidden');
                    DOMElements.appWrapper.classList.remove('hidden');
                    showMessageBox(_('success_welcome_back').replace('{name}', appState.currentUser.name), 'success');
                    
                    // --- START: CRITICAL FIX ---
                    // Build the main UI shell, including the navigation bar, immediately.
                    updateUIVisibility();
                    // --- END: CRITICAL FIX ---
                    
                    // Now, start fetching the dynamic data for the pages.
                    initDataListeners();

                } else {
                    // First, show a message to the user so they know why they are being logged out.
                    showMessageBox(_('error_auth_no_db_entry'), 'error', 5000);
                    // Then, log the technical error for the developer.
                    console.error("Authenticated user has no database entry. Logging out.");
                    auth.signOut();
                }
            });
        } else {
            detachDataListeners();
            appState.currentUser = null;
            appState.activePage = 'schedule';
            document.body.classList.remove('admin-view', 'member-view');
            DOMElements.appWrapper.classList.add('hidden');
            DOMElements.authPage.classList.remove('hidden');
        }
    };
    
    const setupAuthFormListeners = () => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        // Inject placeholder logic for the static Registration Phone input
        const registerPhoneInput = registerForm.querySelector('#registerPhone');
        if (registerPhoneInput) {
            registerPhoneInput.setAttribute('placeholder', ''); 
            registerPhoneInput.setAttribute('data-lang-key', 'placeholder_phone');
        }
        
        const showRegisterLink = document.getElementById('showRegisterLink');
        const showLoginLink = document.getElementById('showLoginLink');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const loginContainer = document.getElementById('login-form-container');
        const registerContainer = document.getElementById('register-form-container');
        
        // Get elements from within the registration form
        const registerPasswordInput = registerForm.querySelector('#registerPassword');
        const confirmPasswordInput = registerForm.querySelector('#confirmRegisterPassword');
        const strengthContainer = registerForm.querySelector('.password-strength-container'); 

        // --- NEW: Branch Logic Variables ---
        let cachedRegistrationBranches = []; // Store branches to avoid re-fetching on language switch
        const branchContainer = document.getElementById('registerBranchContainer');
        const branchSelect = document.getElementById('registerBranchSelect');

        // Helper to render options based on current language
        const renderBranchOptions = () => {
            if (!branchSelect || cachedRegistrationBranches.length <= 1) return;

            // Keep the first option (The "Select Location" placeholder)
            // We assume the first option in HTML has the data-lang-key for translation
            const placeholderOption = branchSelect.firstElementChild;
            branchSelect.innerHTML = ''; 
            branchSelect.appendChild(placeholderOption);

            cachedRegistrationBranches.forEach(b => {
                const option = document.createElement('option');
                option.value = b.id;
                // Use global language state to pick the correct name
                option.textContent = (appState.currentLanguage === 'zh-TW' && b.name_zh) ? b.name_zh : b.name;
                branchSelect.appendChild(option);
            });
        };

        // Initialize Language Toggles with added logic to re-render branches
        const langSelectors = document.querySelectorAll('.lang-selector');
        langSelectors.forEach(selector => {
            selector.onclick = (e) => {
                e.preventDefault();
                setLanguage(selector.dataset.lang);
                // Re-render branch options to apply new language immediately
                if (!branchContainer.classList.contains('hidden')) {
                    renderBranchOptions();
                }
            };
        });

        loginForm.onsubmit = (e) => {
            e.preventDefault();
            handleLogin(loginForm.querySelector('#loginEmail').value, loginForm.querySelector('#loginPassword').value);
        };

        registerForm.onsubmit = (e) => {
            e.preventDefault();
            
            let selectedBranchId = null;
            
            // Logic: If the dropdown is visible (not hidden), a value is required.
            if (branchContainer && !branchContainer.classList.contains('hidden')) {
                if (!branchSelect.value) {
                    showMessageBox(_('error_branch_required'), 'error');
                    return;
                }
                selectedBranchId = branchSelect.value;
            }

            const formData = {
                name: registerForm.querySelector('#registerName').value,
                email: registerForm.querySelector('#registerEmail').value,
                password: registerPasswordInput.value,
                confirmPassword: confirmPasswordInput.value,
                phone: constructPhoneNumber(
                    registerForm.querySelector('#registerCountryCode').value,
                    registerForm.querySelector('#registerPhone').value
                ),
                homeBranchId: selectedBranchId 
            };
            handleRegistration(formData);
        };
        
        registerPasswordInput.addEventListener('input', () => {
            if (strengthContainer) {
                strengthContainer.classList.toggle('hidden', !registerPasswordInput.value);
                updatePasswordStrengthUI(registerForm); 
            }
        });
        
        confirmPasswordInput.addEventListener('focus', () => {
            if (strengthContainer) strengthContainer.classList.add('hidden');
        });
        
        registerPasswordInput.addEventListener('focus', () => {
            if (strengthContainer && registerPasswordInput.value) {
                strengthContainer.classList.remove('hidden');
            }
        });
        
        // --- Updated Branch Loading Logic ---
        showRegisterLink.onclick = async (e) => {
            e.preventDefault();
            loginContainer.classList.add('hidden');
            registerContainer.classList.remove('hidden');

            // Only fetch if we haven't already (and if the container exists in HTML)
            if (branchContainer && cachedRegistrationBranches.length === 0) {
                try {
                    const snapshot = await firebase.database().ref('/branches').orderByChild('order').once('value');
                    const branchesVal = snapshot.val();
                    
                    if (branchesVal) {
                        cachedRegistrationBranches = Object.entries(branchesVal).map(([id, val]) => ({ id, ...val }));
                        cachedRegistrationBranches.sort((a, b) => (a.order || 0) - (b.order || 0));

                        // Only show dropdown if > 1 branch
                        if (cachedRegistrationBranches.length > 1) {
                            renderBranchOptions(); // Populate options
                            branchContainer.classList.remove('hidden'); // Show the HTML container
                        }
                    }
                } catch (err) {
                    console.error("Error loading branches. Check Firebase Rules.", err);
                }
            }
        };
        
        showLoginLink.onclick = (e) => {
            e.preventDefault();
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        };

        forgotPasswordLink.onclick = (e) => {
            e.preventDefault();
            const email = prompt(_('prompt_password_reset'));
            if (email) {
                firebase.auth().sendPasswordResetEmail(email)
                    .then(() => showMessageBox(_('success_password_reset_sent').replace('{email}', email), 'success'))
                    .catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'));
            }
        };

        setupPasswordToggle('loginPassword');
        setupPasswordToggle('registerPassword');
        setupPasswordToggle('confirmRegisterPassword');
    };
    
    // --- Initialization ---
    const init = () => {
        const currentYear = new Date().getFullYear();
        const authYearEl = document.getElementById('copyright-year-auth');
        const appYearEl = document.getElementById('copyright-year-app');
        
        if (authYearEl) authYearEl.textContent = currentYear;
        if (appYearEl) appYearEl.textContent = currentYear;
        
        setupAuthFormListeners();

        DOMElements.cancelCopyBtn.onclick = cancelCopy;

        // --- NEW: Drag Detection Variables ---
        let dragStartX = 0;
        let dragStartY = 0;

        // capture the starting position of any touch/click
        document.addEventListener('pointerdown', (e) => {
            dragStartX = e.clientX;
            dragStartY = e.clientY;
        }, true);

        // Global Event Delegation (Capture Phase)
        document.body.addEventListener('click', e => {
            // --- 1. HANDLE COPY MODE INTERACTIONS FIRST ---
            if (appState.copyMode.active) {
                const { type, targetDate, targetBranchId } = appState.copyMode;
                const branches = appState.branches || [];

                // A. Handling "Copy Day" (Clicking a Header)
                const headerEl = e.target.closest('.copy-mode-source');
                if (headerEl && type === 'day') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    
                    const sourceDate = headerEl.dataset.date;
                    const friendlySourceDate = formatDateWithWeekday(sourceDate);
                    const friendlyTargetDate = formatDateWithWeekday(targetDate);
                    
                    // Resolve Branch Info
                    const currentViewBranchId = appState.selectedScheduleBranch || (branches[0] ? branches[0].id : null);
                    const sourceBranchObj = branches.find(b => b.id === currentViewBranchId) || branches[0];
                    const targetBranchObj = branches.find(b => b.id === targetBranchId) || branches[0];

                    const sourceBranchName = (appState.currentLanguage === 'zh-TW' && sourceBranchObj?.name_zh) ? sourceBranchObj.name_zh : (sourceBranchObj?.name || 'Main Studio');
                    const targetBranchName = (appState.currentLanguage === 'zh-TW' && targetBranchObj?.name_zh) ? targetBranchObj.name_zh : (targetBranchObj?.name || 'Main Studio');

                    // Check: Don't copy self to self
                    if (sourceDate === targetDate && currentViewBranchId === targetBranchId) {
                        return;
                    }

                    let message = '';

                    // LOGIC: Check context to decide message format
                    if (currentViewBranchId === targetBranchId) {
                        // SAME BRANCH: Use Simple Message (Date -> Date)
                        message = _('confirm_copy_day_desc')
                            .replace('{sourceDate}', friendlySourceDate)
                            .replace('{targetDate}', friendlyTargetDate);
                    } else {
                        // CROSS BRANCH: Use Detailed Message (Branch + Date -> Branch + Date)
                        message = _('confirm_copy_day_detailed')
                            .replace('{sourceBranch}', sourceBranchName)
                            .replace('{sourceDate}', friendlySourceDate)
                            .replace('{targetBranch}', targetBranchName)
                            .replace('{targetDate}', friendlyTargetDate);
                    }

                    showConfirmation(_('confirm_copy_day_title'), message, () => performCopy('day', sourceDate, targetDate));
                    return;
                }

                // B. Handling "Copy Class" (Clicking a Class Block)
                const clsEl = e.target.closest('.copy-mode-source-class');
                if (clsEl && type === 'class') {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    const cls = appState.classes.find(c => c.id === clsEl.id);
                    if (!cls) return;

                    const currentViewBranchId = appState.selectedScheduleBranch || (branches[0] ? branches[0].id : null);
                    // Check: Don't copy self to self
                    if (cls.date === targetDate && currentViewBranchId === targetBranchId) return;

                    performCopy('class', cls, targetDate);
                    return;
                }
            }

            // --- 2. SCHEDULE & CLASS BLOCK INTERACTIONS (DELEGATED) ---
            
            // A. Admin Edit Button (Inside Schedule or Table)
            const editClsBtn = e.target.closest('.edit-cls-btn');
            if (editClsBtn) {
                e.preventDefault();
                e.stopPropagation();
                const clsId = editClsBtn.dataset.id || editClsBtn.closest('.cls-block')?.id;
                const cls = appState.classes.find(c => c.id === clsId);
                if (cls) openClsModal(cls.date, cls);
                return;
            }

            // B. Member Cancel Button (Inside Schedule)
            const cancelBookingBtn = e.target.closest('.cancel-booking-btn-toggle');
            if (cancelBookingBtn) {
                e.preventDefault();
                e.stopPropagation();
                saveSchedulePosition();
                const clsId = cancelBookingBtn.closest('.cls-block').id;
                const cls = appState.classes.find(c => c.id === clsId);
                if (cls) handleCancelBooking(cls);
                return;
            }

            // C. Main Class Block Click (Schedule Card)
            const clsBlock = e.target.closest('.cls-block');
            // Filter out interactive elements to prevent double-firing
            if (clsBlock && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('.time-slot-editable') && !e.target.closest('.participant-counter-editable') && !e.target.closest('.participant-dial-trigger')) {
                
                // --- DRAG DETECTION FIX ---
                // Calculate distance moved. If > 10px, treat as scroll (drag) and ignore click.
                const xDiff = Math.abs(e.clientX - dragStartX);
                const yDiff = Math.abs(e.clientY - dragStartY);
                if (xDiff > 10 || yDiff > 10) return;
                // --------------------------

                const cls = appState.classes.find(c => c.id === clsBlock.id);
                if (!cls) return;

                const isOwner = appState.currentUser?.role === 'owner';
                const isManager = appState.currentUser?.role === 'manager';
                const isStaff = appState.currentUser?.role === 'staff';
                const isAdmin = isOwner || isManager || isStaff;

                // Admin Action
                if (isAdmin) {
                    if (appState.copyMode.active) return; // Handled by copy logic above
                    
                    // Check Write Permission (Re-implemented here for global scope)
                    let hasWritePermission = true;
                    if (isStaff || isManager) {
                        const user = appState.currentUser;
                        const staffLevel = user.staffAccessLevel || 'home_only';
                        if (staffLevel !== 'global_write') {
                            const branches = appState.branches || [];
                            const defaultBranchId = branches.length > 0 ? branches[0].id : null;
                            const classBranchId = cls.branchId || defaultBranchId;
                            let writeAllowedIds = [];
                            if (user.allowedBranches && Object.keys(user.allowedBranches).length > 0) {
                                writeAllowedIds = Object.keys(user.allowedBranches);
                            } else {
                                writeAllowedIds = [user.homeBranchId || defaultBranchId];
                            }
                            if (!writeAllowedIds.includes(classBranchId)) {
                                hasWritePermission = false;
                            }
                        }
                    }

                    if (hasWritePermission) {
                        openJoinedMembersModal(cls);
                    }
                    return;
                }

                // Member Action
                const isBooked = cls.bookedBy && cls.bookedBy[appState.currentUser.id];
                const isFull = (cls.bookedBy ? Object.keys(cls.bookedBy).length : 0) >= cls.maxParticipants;
                
                // If booked, do nothing (Cancel button handles interaction)
                if (isBooked) return;

                // Check Restrictions (Restricted Class Click)
                if (clsBlock.classList.contains('cls-block-restricted')) {
                    const requiredTypeId = cls.costCreditTypeId || 'general';
                    const typeDef = appState.creditTypes ? appState.creditTypes.find(ct => ct.id === requiredTypeId) : null;
                    const typeName = typeDef ? getCreditTypeName(typeDef) : 'Credits';
                    
                    if (cls.notForMonthly) {
                        showMessageBox(`${_('error_class_not_for_monthly')} & ${_('error_member_insufficient_credits')} (${typeName})`, 'info');
                    } else {
                        showMessageBox(`${_('error_tier_restricted')} & ${_('error_member_insufficient_credits')} (${typeName})`, 'info');
                    }
                    return;
                }

                // Standard Booking
                if (!isFull) {
                    openBookingModal(cls);
                }
                return;
            }

            // --- 3. EXISTING HANDLERS ---
            if (!e.target.closest('.time-slot-editable.editing')) {
                document.querySelectorAll('.time-slot-editable.editing').forEach(el => el.classList.remove('editing'));
            }

            const closeButton = e.target.closest('.modal-close-btn');
            if (closeButton) {
                const modalToClose = closeButton.closest('.modal-backdrop');
                if (modalToClose) {
                    if (modalToClose.id === 'checkInModal' && html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().catch(err => console.error("Failed to stop scanner on close.", err));
                        html5QrCode = null;
                    }
                    closeModal(modalToClose);
                }
                return;
            }

            const publishToggle = e.target.closest('.publish-toggle');
            if (publishToggle) {
                e.stopPropagation();
                const date = publishToggle.dataset.date;
                const isPublished = publishToggle.classList.contains('status-published');
                handlePublishToggle(date, isPublished);
                return;
            }

            const addBtn = e.target.closest('.add-cls-button');
            if (addBtn) {
                const currentUser = appState.currentUser;
                // FIX: Added 'manager' to the allowed roles list so the button responds
                if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager' || currentUser.role === 'staff')) {
                    openClsModal(addBtn.dataset.date);
                }
            }
        }, true);
        
        // --- START: AUTO-MIGRATION FOR BRANCHES ---
        // Only run for Owners/Staff on initial load
        auth.onAuthStateChanged(user => {
            handleAuthStateChange(user);
            
            if (user) {
                database.ref('/users/' + user.uid).once('value').then(snapshot => {
                    const userData = snapshot.val();
                    if (userData && (userData.role === 'owner')) {
                        // Check if branches exist
                        database.ref('/branches').once('value').then(bSnap => {
                            if (!bSnap.exists()) {
                                console.log("Initializing default branch structure...");
                                const newBranchRef = database.ref('/branches').push();
                                newBranchRef.set({
                                    name: "Main Studio",
                                    address: "",
                                    color: "#22c55e",
                                    order: 0
                                });
                            }
                        });
                    }
                });
            }
        });
        // --- END: AUTO-MIGRATION ---

        const savedLang = localStorage.getItem('studioPulseLanguage') || 'en';
        setLanguage(savedLang, false); 
    };

    // --- DEVELOPER HELPER FOR CSV IMPORT ---
    // Run this function from the browser's console by typing: _dev_importFromCSV()
    // It will add file input controls to the page.
    window._dev_importFromCSV = function() {
        // Prevent creating duplicate importers
        if (document.getElementById('dev-importer-container')) {
            alert('Importer is already on the page.');
            return;
        }

        // --- 1. CREATE THE UI FOR THE IMPORTER ---
        const importerContainer = document.createElement('div');
        importerContainer.id = 'dev-importer-container';
        // Use Tailwind classes for a responsive, centered modal that matches the app theme
        importerContainer.className = 'card fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-11/12 max-w-md p-6 space-y-4';

        importerContainer.innerHTML = `
            <button id="close-importer-btn" class="modal-close-btn"></button>
            <h3 class="text-2xl font-bold text-slate-800 text-center">Dev CSV Importer</h3>
            
            <div class="space-y-2">
                <label for="sports-csv" class="block text-slate-600 text-sm font-semibold">1. Sport Types CSV</label>
                <p class="text-xs text-slate-500">Format: <code>name,color,name_zh</code> (name_zh is optional)</p>
                <label for="sports-csv" class="importer-file-label">
                    <input type="file" id="sports-csv" accept=".csv" class="hidden">
                    <span class="file-prompt">Click to choose a file...</span>
                </label>
            </div>
            
            <div class="space-y-2">
                <label for="tutors-csv" class="block text-slate-600 text-sm font-semibold">2. Tutors CSV</label>
                 <p class="text-xs text-slate-500">Format: <code>email,name,phone,skill1,skill2...</code></p>
                <label for="tutors-csv" class="importer-file-label">
                    <input type="file" id="tutors-csv" accept=".csv" class="hidden">
                    <span class="file-prompt">Click to choose a file...</span>
                </label>
            </div>

            <button id="start-import-btn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition">
                Start Import
            </button>
        `;

        document.body.appendChild(importerContainer);
        // Add the close icon svg to the button
        document.getElementById('close-importer-btn').innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

        // --- 2. ADD EVENT LISTENERS ---
        function handleFileSelect(inputId) {
            const input = document.getElementById(inputId);
            const label = input.parentElement;
            const prompt = label.querySelector('.file-prompt');
            if (input.files.length > 0) {
                prompt.innerHTML = `File: <span class="file-name">${input.files[0].name}</span>`;
                label.classList.add('file-chosen');
            } else {
                prompt.innerHTML = 'Click to choose a file...';
                label.classList.remove('file-chosen');
            }
        }

        document.getElementById('sports-csv').onchange = () => handleFileSelect('sports-csv');
        document.getElementById('tutors-csv').onchange = () => handleFileSelect('tutors-csv');

        document.getElementById('close-importer-btn').onclick = () => importerContainer.remove();

        document.getElementById('start-import-btn').onclick = async () => {
            const sportsFile = document.getElementById('sports-csv').files[0];
            const tutorsFile = document.getElementById('tutors-csv').files[0];

            if (!sportsFile || !tutorsFile) {
                alert('Please select both a sports and a tutors CSV file.');
                return;
            }

            const button = document.getElementById('start-import-btn');
            button.textContent = 'Importing...';
            button.disabled = true;

            try {
                const sportsData = await readFileAsText(sportsFile);
                const tutorsData = await readFileAsText(tutorsFile);
                const sportTypesToImport = parseSimpleCSV(sportsData);
                const tutorsToImport = parseSimpleCSV(tutorsData);
                await runImportLogic(sportTypesToImport, tutorsToImport);
                alert('Import complete! Check the console for details.');
            } catch (error) {
                console.error('Import failed:', error);
                alert('An error occurred during import. Check the console.');
            } finally {
                button.textContent = 'Start Import';
                button.disabled = false;
            }
        };

        // --- 3. HELPER & CORE LOGIC ---
        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = event => resolve(event.target.result);
                reader.onerror = error => reject(error);
                reader.readAsText(file);
            });
        }

        function parseSimpleCSV(csvText) {
            const lines = csvText.trim().split(/\r?\n/);
            return lines.slice(1); // Skip header row
        }

        async function runImportLogic(sportTypesToImport, tutorsToImport) {
            console.log('--- Starting CSV Data Import ---');
            console.log('Importing sport types...');
            const sportsRef = database.ref('/sportTypes');
            const sportsSnapshot = await sportsRef.once('value');
            const existingSports = sportsSnapshot.val() || {};
            const existingSportNames = new Set(Object.values(existingSports).map(s => s.name.toLowerCase()));
            
            for (const sportString of sportTypesToImport) {
                // --- START: MODIFIED PARSING LOGIC ---
                const [name, color, name_zh] = sportString.split(',').map(p => p.trim());
                if (!name || existingSportNames.has(name.toLowerCase())) continue;
                
                const sportData = {
                    name,
                    color: color || CLS_COLORS[existingSportNames.size % CLS_COLORS.length],
                    name_zh: name_zh || ''
                };
                
                await sportsRef.push(sportData);
                // --- END: MODIFIED PARSING LOGIC ---
                existingSportNames.add(name.toLowerCase());
            }
            console.log(`Finished processing ${sportTypesToImport.length} sport type rows.`);

            console.log('Importing tutors...');
            const allSportsSnapshot = await sportsRef.once('value');
            const sportNameMap = new Map();
            Object.entries(allSportsSnapshot.val() || {}).forEach(([id, sport]) => {
                sportNameMap.set(sport.name.toLowerCase(), id);
            });

            const tutorsRef = database.ref('/tutors');
            const tutorsSnapshot = await tutorsRef.once('value');
            const existingTutors = tutorsSnapshot.val() || {};
            const existingTutorEmails = new Set(Object.values(existingTutors).map(t => t.email?.toLowerCase()));
            
            for (const tutorString of tutorsToImport) {
                const parts = tutorString.split(',').map(p => p.trim());
                const [email, name, phone, ...skillNames] = parts;
                if (!email || existingTutorEmails.has(email.toLowerCase())) continue;

                const skills = skillNames.map(skillName => {
                    const sportTypeId = sportNameMap.get(skillName.toLowerCase());
                    if (sportTypeId) return { sportTypeId, salaryType: 'perCls', salaryValue: 10 };
                    return null;
                }).filter(Boolean);

                await tutorsRef.push({ name, email, phone, skills, isEmployee: false });
            }
            console.log(`Finished processing ${tutorsToImport.length} tutor rows.`);
            console.log('--- CSV Data Import Complete! ---');
        }
    }
    // --- Run Application ---
    init();
});

