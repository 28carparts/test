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
        activePage: 'schedule', 
        currentUser: null,
        currentLanguage: 'en',
        studioSettings: {
            clsDefaults: {
                time: '09:00',
                duration: 60,
                credits: 1,
                maxParticipants: 15
            }
        },
        selectedFilters: {
            salaryTutorId: null,
            salaryPeriod: null, 
            classesPeriod: null,
            classesSportTypeId: 'all',
            classesTutorId: 'all',
            memberSportType: 'all', 
            memberTutor: 'all' 
        },
        ownerPastDaysVisible: 0,
        scheduleScrollDate: null,
        scrollToDateOnNextLoad: null,
        copyMode: { 
            active: false,
            type: null, 
            sourceId: null, 
            targetDate: null,
        },
        pagination: {
            classes: { page: 1 },
            sports: { page: 1 },
            tutors: { page: 1 }
        },
        searchTerms: {
            sports: '',
            tutors: ''
        },
        itemsPerPage: {
            classes: 10,
            sports: 10,
            tutors: 6 
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
        }
    };
    let emblaApi = null;
    let navEmblaApi = null;
    let onConfirmCallback = null;
    let dataListeners = {}; // To hold references to our listeners
    let memberCheckInListeners = {};
    let activeClassesRef = null;

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
        checkInModal: document.getElementById('checkInModal')
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
        appState.currentLanguage = lang;
        localStorage.setItem('studioPulseLanguage', lang);
        updateUIText();
        // --- CHANGE START: Add a guard to prevent unnecessary UI updates ---
        // Only update the password strength UI if the registration form is visible
        const registerFormContainer = document.getElementById('register-form-container');
        if (registerFormContainer && !registerFormContainer.classList.contains('hidden')) {
            updatePasswordStrengthUI();
        }
        // --- CHANGE END ---
    
        // Update active state on language selectors
        document.querySelectorAll('.lang-selector').forEach(selector => {
            if (selector.dataset.lang === lang) {
                selector.classList.remove('text-slate-400');
                selector.classList.add('text-indigo-600', 'underline', 'decoration-2', 'underline-offset-2');
            } else {
                selector.classList.add('text-slate-400');
                selector.classList.remove('text-indigo-600', 'underline', 'decoration-2', 'underline-offset-2');
            }
        });
    
        if (saveToDb && appState.currentUser?.id) {
            database.ref(`/users/${appState.currentUser.id}/language`).set(lang)
              .catch(error => console.error("Could not save language preference:", error));
        }

        // If a user is logged in, specifically re-render the navigation bar
        if (appState.currentUser) {
            renderNav();
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
        return Object.entries(obj).map(([id, value]) => ({ id, ...value }));
    };

    const getIsoDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const formatTime = (date) => date.toTimeString().slice(0, 5);
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
        // If the sportType object doesn't exist, return a fallback.
        if (!sportType) {
            return _('unknown_type');
        }
        // If the language is Chinese AND a Chinese name exists, use it.
        if (appState.currentLanguage === 'zh-TW' && sportType.name_zh) {
            return sportType.name_zh;
        }
        // Otherwise, fall back to the default English name.
        return sportType.name;
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

    function calculateClsRevenueAndPayout(cls, allUsers, allTutors, allClasses) {
        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        let tutorPayout = 0;
        
        // This part requires a full set of classes to trace member purchase history
        const membersOnThisCls = bookedMemberIds.map(id => allUsers.find(u => u.id === id)).filter(Boolean);
        const allBookingsByTheseMembers = [];
        if (membersOnThisCls.length > 0) {
            const memberIdSet = new Set(membersOnThisCls.map(m => m.id));
            allClasses.forEach(c => {
                if (c.bookedBy) {
                    for (const memberId of Object.keys(c.bookedBy)) {
                        if (memberIdSet.has(memberId)) {
                            const member = allUsers.find(u => u.id === memberId);
                            if (member) allBookingsByTheseMembers.push({ member, cls: c });
                        }
                    }
                }
            });
        }
        
        const { revenueByClsId } = calculateRevenueForBookings(allBookingsByTheseMembers);
        const grossRevenue = revenueByClsId.get(cls.id) || 0;

        // --- START: SIMPLIFIED PAYOUT CALCULATION ---
        // We now assume `payoutDetails` always exists and remove the legacy fallback.
        if (cls.payoutDetails && typeof cls.payoutDetails.salaryValue !== 'undefined') {
            const { salaryType, salaryValue } = cls.payoutDetails;
            if (salaryType === 'perCls') {
                tutorPayout = salaryValue;
            } else if (salaryType === 'percentage') {
                tutorPayout = grossRevenue * (salaryValue / 100);
            } else if (salaryType === 'perHeadcount') {
                tutorPayout = bookedMemberIds.length * salaryValue;
            }
        }
        // --- END: SIMPLIFIED PAYOUT CALCULATION ---
        
        const netRevenue = grossRevenue - tutorPayout;
        return { grossRevenue, tutorPayout, netRevenue };
    }

    const formatShortDateWithYear = (isoString) => {
        if (!isoString) return _('label_na');
        const date = new Date(isoString); 
        if (isNaN(date)) return 'Invalid Date';

        // Use the dynamic locale for date formatting
        const options = {
            year: '2-digit',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC' // Use UTC to be consistent with how dates are stored
        };
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
        link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
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
                showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
            })
            .finally(() => {
                loginButton.disabled = false;
                loginButton.textContent = _('auth_login_button');
            });
    };

    const handleRegistration = (formData) => {
        const { name, email, password, confirmPassword, phone } = formData;
        const registerForm = document.getElementById('registerForm');
        const registerButton = registerForm.querySelector('button[type="submit"]');

        // --- START: MODIFIED LOGIC ---

        // 1. Give immediate feedback by disabling the button first.
        registerButton.disabled = true;
        registerButton.textContent = _('status_checking');

        // 2. Perform validation checks.
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

        // 4. If validation passes, proceed with registration.
        registerButton.textContent = _('status_registering');

        // --- END: MODIFIED LOGIC ---

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const user = userCredential.user;
                const newUserProfile = {
                    name: name,
                    email: user.email,
                    phone: phone,
                    role: 'member',
                    credits: 0,
                    initialCredits: 0,
                    monthlyPlan: false,
                    joinDate: new Date().toISOString(),
                    lastBooking: null,
                    expiryDate: null,
                    language: appState.currentLanguage,
                    purchaseHistory: {}
                };
                return database.ref('users/' + user.uid).set(newUserProfile);
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
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;

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

        if (isAdmin) {
            DOMElements.mainNav.classList.add('flex-grow', 'lg:flex-grow-0', 'min-w-0');
        } else {
            DOMElements.mainNav.classList.remove('flex-grow', 'lg:flex-grow-0', 'min-w-0');
        }

        const mobileNavContainer = DOMElements.mainNav.querySelector('#nav-carousel-mobile .embla-nav__container');
        const desktopNavContainer = DOMElements.mainNav.querySelector('#nav-static-desktop');

        if (isAdmin) {
            let navButtonsHTML = [
                `<button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_schedule')}</button>`,
                `<button data-page="classes" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_classes')}</button>`,
                `<button data-page="members" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_members')}</button>`,
                `<button data-page="admin" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_admin')}</button>`,
                `<button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">${_('nav_logout')}</button>`
            ];
            
            // --- START: MODIFIED SECTION ---
            navButtonsHTML.splice(1, 0, `<button id="navCheckInBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_check_in')}</button>`);
            navButtonsHTML.splice(2, 0, `<button id="navGoToBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_goto')}</button>`);

            if (isOwner) {
                navButtonsHTML.splice(4, 0, `<button data-page="salary" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_salary')}</button>`);
                navButtonsHTML.splice(5, 0, `<button data-page="statistics" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_statistics')}</button>`);
            }
            // --- END: MODIFIED SECTION ---

            mobileNavContainer.innerHTML = navButtonsHTML.map(btn => `<div class="embla-nav__slide">${btn}</div>`).join('');
            desktopNavContainer.innerHTML = navButtonsHTML.join('');

            const initNavCarousel = () => {
                if (window.innerWidth < 1024 && !navEmblaApi) {
                    const navCarouselNode = DOMElements.mainNav.querySelector('#nav-carousel-mobile .embla-nav');
                    if (navCarouselNode) {
                        navEmblaApi = EmblaCarousel(navCarouselNode, {
                            align: 'start',
                            dragFree: true
                        });
                    }
                } else if (window.innerWidth >= 1024 && navEmblaApi) {
                    navEmblaApi.destroy();
                    navEmblaApi = null;
                }
            };
            initNavCarousel();
            window.addEventListener('resize', initNavCarousel);

        } else {
            const { memberSportType, memberTutor } = appState.selectedFilters;
            const activeFilterCount = (memberSportType !== 'all' ? 1 : 0) + (memberTutor !== 'all' ? 1 : 0);
            
            DOMElements.mainNav.innerHTML = `
                <div class="flex items-center gap-2 sm:gap-6 px-4 py-2">
                    <button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_schedule')}</button>
                    <button id="navFilterBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base flex items-center gap-2 relative">
                        ${_('nav_filter')}
                        ${activeFilterCount > 0 ? `<span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500"></span>` : ''}
                    </button>
                    <button data-page="account" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">${_('nav_account')}</button>
                    <button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">${_('nav_logout')}</button>
                </div>
            `;
        }

        DOMElements.mainNav.querySelectorAll('button').forEach(btn => {
            if (btn.id === 'logoutBtn') {
                btn.onclick = handleLogout;
            } else if (btn.id === 'navFilterBtn') {
                btn.onclick = () => {
                    if (appState.activePage !== 'schedule') {
                        switchPage('schedule');
                    }
                    openFilterModal();
                };
            // --- START: ADDED SECTION ---
            } else if (btn.id === 'navCheckInBtn') {
                btn.onclick = openCheckInModal;
            // --- END: ADDED SECTION ---
            } else if (btn.id === 'navGoToBtn') {
                btn.onclick = openGoToDateModal;
            } else if (btn.dataset.page) {
                btn.onclick = () => switchPage(btn.dataset.page);
            }
            if (btn.dataset.page) {
                btn.classList.toggle('active', btn.dataset.page === appState.activePage);
            }
        });
    };

    const updateUIVisibility = () => {
        // Render the navigation bar
        renderNav();

        // Render the current page content
        renderCurrentPage();
    };
    
    // --- Page Navigation & Rendering ---
    const switchPage = (pageId) => {
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
        const isStaff = appState.currentUser?.role === 'staff';
        let pageIdToRender = appState.activePage;

        const ownerOnlyPages = ['statistics', 'salary']; // Pages only for Owner
        const adminPages = ['members', 'admin', 'classes']; // Pages for Owner and Staff
        const memberOnlyPages = ['account'];

        // If a Staff member tries to access an owner-only page
        if (isStaff && ownerOnlyPages.includes(pageIdToRender)) {
            pageIdToRender = 'schedule';
        }
        
        // If a non-admin user tries to access any admin page
        if (!isOwner && !isStaff && (ownerOnlyPages.includes(pageIdToRender) || adminPages.includes(pageIdToRender))) {
            pageIdToRender = 'schedule';
        }
        
        // If an admin user tries to access a member-only page
        if ((isOwner || isStaff) && memberOnlyPages.includes(pageIdToRender)) {
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

        // --- START: REVERTED On-Demand Loading Logic ---
        if (pageIdToRender === 'schedule') {
            if (isOwner || isStaff) {
                renderOwnerSchedule(pageElement);
            } else {
                renderMemberSchedulePage(pageElement);
            }
        } else if (pageIdToRender === 'account') {
            renderAccountPage(pageElement);
        } else if (pageIdToRender === 'admin') {
            // Check if studioSettings are loaded. If not, fetch them.
            if (!appState.studioSettings.clsDefaults.time) { // A simple check to see if settings are default or loaded
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_admin_settings')}</p>`;
                database.ref('/studioSettings').once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        appState.studioSettings = { ...appState.studioSettings, ...snapshot.val() };
                    }
                    renderAdminPage(pageElement); // Now render the page with data
                });
            } else {
                renderAdminPage(pageElement);
            }
        } else if (pageIdToRender === 'members') {
            // Check if the full user list is loaded.
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_member_list')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    renderMembersPage(pageElement); // Now render the page with data
                });
            } else {
                renderMembersPage(pageElement);
            }
        } else if (pageIdToRender === 'salary') {
            // The salary page already fetches data on-demand.
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_required_data')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    renderSalaryPage(pageElement);
                });
            } else {
                renderSalaryPage(pageElement);
            }
        } else if (pageIdToRender === 'statistics' || pageIdToRender === 'classes') {
            // These pages also need the full user list.
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">${_('status_loading_required_data')}</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                    if (pageIdToRender === 'classes') renderClassesPage(pageElement);
                });
            } else {
                if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                if (pageIdToRender === 'classes') renderClassesPage(pageElement);
            }
        }
        // --- END: REVERTED On-Demand Loading Logic ---
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
        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];

        if (bookedMemberIds.length > 0) {
            openDeleteClsNotifyModal(cls);
        } else {
            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
            // Translate confirmation title and message
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
                copyTextToClipboard(message, _('success_text_copied').replace('{text}', 'WhatsApp message'));

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
                const attended = cls.attendedBy && cls.attendedBy[memberId];
                
                if (member && !member.monthlyPlan && !attended) {
                    const bookingDetails = cls.bookedBy[memberId];
                    const creditsToRefund = bookingDetails.creditsPaid;
                    return database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) + parseFloat(creditsToRefund));
                }
                
                return Promise.resolve(); 
            });

            Promise.all(refundPromises).then(() => {
                saveSchedulePosition();

                const updates = {};
                const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
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

    function createWhatsAppMessage(member, cls) {
        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === cls.tutorId);
        const dynamicOrigin = window.location.origin;
        const bookingLink = `${dynamicOrigin}/schedule`;

        // Translate the WhatsApp message template
        const message = `
${_('whatsapp_greeting').replace('{name}', member.name)}

${_('whatsapp_body_1')}

*${_('whatsapp_class')}:* ${getSportTypeName(sportType)}
*${_('whatsapp_date')}:* ${formatShortDateWithYear(cls.date)}
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

        const bookingLink = `${window.location.origin}/schedule`;

        // The indentation of the text lines has been removed to fix the formatting issue.
        // The message now uses the new/revised i18n keys for better clarity.
        const message = `${_('whatsapp_greeting').replace('{name}', member.name)}

${_('whatsapp_body_update')}

*${_('whatsapp_class')}:* ${getSportTypeName(sportType)}
*${_('whatsapp_date')}:* ${formatShortDateWithYear(originalCls.date)}

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

    // --- Class, Booking, and Member List Modals (Refactored) ---
    async function openJoinedMembersModal(cls) {
        if (appState.copyMode.active) return;

        const bookedMemberIds = cls.bookedBy ? Object.keys(cls.bookedBy) : [];
        const isOwner = appState.currentUser?.role === 'owner';

        DOMElements.joinedMembersModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${_('title_class_details')}</h2>
                <p class="text-center text-slate-500 mb-6">${appState.sportTypes.find(st => st.id === cls.sportTypeId).name} on ${formatShortDateWithYear(cls.date)}</p>
                ${isOwner ? `
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
                        <div id="addMemberSearchResults" class="absolute w-full bg-white border border-slate-300 rounded-lg mt-1 z-20 max-h-48 overflow-y-auto shadow-lg hidden"></div>
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

        if (isOwner) {
            const revenueEl = DOMElements.joinedMembersModal.querySelector('#clsRevenueDetails');
            let grossRevenue = 0, tutorPayout = 0, netRevenue = 0;
            if (bookedMemberIds.length > 0) {
                const allClassesSnapshot = await database.ref('/classes').once('value');
                const allClassesForCalc = firebaseObjectToArray(allClassesSnapshot.val());

                const revenueData = calculateClsRevenueAndPayout(cls, appState.users, appState.tutors, allClassesForCalc);
                grossRevenue = revenueData.grossRevenue;
                tutorPayout = revenueData.tutorPayout;
                netRevenue = revenueData.netRevenue;
            }
            
            const netRevenueColor = netRevenue >= 0 ? 'text-green-600' : 'text-red-600';
            revenueEl.innerHTML = `
                <div class="flex justify-center gap-4">
                    <div><p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-green-600">${formatCurrency(grossRevenue)}</p></div>
                    <div><p class="text-sm text-slate-500">${_('label_tutor_payout')}</p><p class="text-2xl font-bold text-red-600">(${formatCurrency(tutorPayout)})</p></div>
                    <div><p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(netRevenue)}</p></div>
                </div>`;
        }
        
        if (bookedMembers.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center">${_('status_no_bookings_yet')}</p>`;
        } else {
            listEl.innerHTML = bookedMembers.map(member => {
                const isAttended = cls.attendedBy && cls.attendedBy[member.id];
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
                    const attendedRef = database.ref(`/classes/${cls.id}/attendedBy/${memberId}`);
                    if (e.target.checked) {
                        attendedRef.set(true);
                    } else {
                        attendedRef.remove();
                    }
                };
            });
        }
        
        const addMemberSearchInput = DOMElements.joinedMembersModal.querySelector('#addMemberSearchInput');
        const addMemberSearchResults = DOMElements.joinedMembersModal.querySelector('#addMemberSearchResults');

        addMemberSearchInput.oninput = async () => {
            if (appState.users.length < 50) {
                addMemberSearchResults.innerHTML = `<p class="p-3 text-slate-500 text-center">${_('status_loading_members')}</p>`;
                addMemberSearchResults.classList.remove('hidden');
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
                u.role !== 'owner' && u.role !== 'staff' && !u.isDeleted &&
                (!cls.bookedBy || !cls.bookedBy[u.id]) && (
                    u.name.toLowerCase().includes(searchTerm) ||
                    u.email.toLowerCase().includes(searchTerm) ||
                    (u.phone && u.phone.includes(searchTerm)))
            );

            if (unbookedMembers.length > 0) {
                addMemberSearchResults.innerHTML = unbookedMembers.map(member => `
                    <div class="p-3 hover:bg-slate-100 cursor-pointer flex justify-between items-center add-member-result-item" data-member-id="${member.id}">
                        <div>
                            <p class="font-semibold text-slate-800">${member.name}</p>
                            <p class="text-sm text-slate-500">${member.email}</p>
                        </div>
                        <button class="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold py-1 px-3 rounded-full pointer-events-none">${_('btn_add')}</button>
                    </div>
                `).join('');
                addMemberSearchResults.classList.remove('hidden');
            } else {
                addMemberSearchResults.innerHTML = `<p class="p-3 text-slate-500 text-center">${_('status_no_members_found')}</p>`;
                addMemberSearchResults.classList.remove('hidden');
            }
        };

        addMemberSearchResults.onclick = (e) => {
            const target = e.target.closest('.add-member-result-item');
            if (target) {
                const memberId = target.dataset.memberId;
                const memberToAdd = appState.users.find(u => u.id === memberId);
                const currentBookings = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;

                if (currentBookings >= cls.maxParticipants) {
                    showMessageBox(_('error_class_is_full'), 'error');
                    return;
                }
                
                if (memberToAdd && !memberToAdd.monthlyPlan) {
                    if (parseFloat(memberToAdd.credits) < parseFloat(cls.credits)) {
                        showMessageBox(_('error_member_insufficient_credits'), 'error');
                        return;
                    }
                    database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) - parseFloat(cls.credits));
                }

                const updates = {};
                updates[`/classes/${cls.id}/bookedBy/${memberId}`] = {
                    bookedAt: new Date().toISOString(),
                    bookedBy: appState.currentUser.name,
                    monthlyCreditValue: memberToAdd.monthlyCreditValue || 0,
                    creditsPaid: cls.credits
                };
                updates[`/memberBookings/${memberId}/${cls.id}`] = true;
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
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_time')}:</span><strong class="text-slate-800">${formatDateWithWeekday(cls.date)}, ${getTimeRange(cls.time, cls.duration)}</strong></div>
                    <hr class="my-4">
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_credits_required')}:</span><strong class="text-indigo-600 text-lg">${cls.credits}</strong></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">${_('label_your_balance')}:</span><strong class="text-slate-800 text-lg">${currentUser.monthlyPlan ? _('label_monthly_plan') : `${formatCredits(currentUser.credits)} ${_('label_credits')}`}</strong></div>
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
            } else if (!currentUser.monthlyPlan && (parseFloat(currentUser.credits || 0) < parseFloat(cls.credits))) {
                showMessageBox(_('error_insufficient_credits'), 'error');
            } else if (currentBookings >= cls.maxParticipants) {
                showMessageBox(_('error_class_full'), 'error');
            } else {
                confirmBtn.disabled = true;
                
                let creditUpdatePromise = Promise.resolve();
                if (!currentUser.monthlyPlan) {
                    creditUpdatePromise = database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) - parseFloat(cls.credits));
                }

                creditUpdatePromise.then(() => {
                    const updates = {};
                    updates[`/classes/${cls.id}/bookedBy/${memberId}`] = {
                        bookedAt: new Date().toISOString(),
                        bookedBy: 'member',
                        monthlyCreditValue: currentUser.monthlyCreditValue || 0,
                        creditsPaid: cls.credits
                    };
                    updates[`/memberBookings/${memberId}/${cls.id}`] = true;
                    updates[`/users/${memberId}/lastBooking`] = new Date().toISOString();
                    return database.ref().update(updates);
                }).then(() => {
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
        // Translate the confirmation dialog
        const title = _('title_cancel_booking');
        const message = _('confirm_cancel_booking');

        showConfirmation(title, message, () => {
            const memberId = memberIdToUpdate || appState.currentUser.id;
            
            let memberToUpdate;
            if (memberIdToUpdate) {
                memberToUpdate = appState.users.find(u => u.id === memberId);
            } else {
                memberToUpdate = appState.currentUser;
            }

            if (!memberToUpdate) {
                showMessageBox(_('error_member_not_found'), 'error');
                return;
            }

            const bookingDetails = cls.bookedBy[memberId];
            const creditsToRefund = bookingDetails.creditsPaid;

            let creditRefundPromise = Promise.resolve();
            if (!memberToUpdate.monthlyPlan) {
                creditRefundPromise = database.ref(`/users/${memberId}`).transaction(user => {
                    if (user) {
                        const newCredits = (user.credits || 0) + parseFloat(creditsToRefund);
                        user.credits = Math.min(newCredits, user.initialCredits);
                    }
                    return user;
                });
            }

            creditRefundPromise.then(() => {
                const updates = {};
                updates[`/classes/${cls.id}/bookedBy/${memberId}`] = null;
                updates[`/memberBookings/${memberId}/${cls.id}`] = null;
                return database.ref().update(updates);
            }).then(() => {
                if (memberIdToUpdate) {
                    const updatedMember = appState.users.find(u => u.id === memberIdToUpdate);
                    if (updatedMember) openMemberBookingHistoryModal(updatedMember);
                } 
                else {
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
        DOMElements.clsModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="clsModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="clsForm">
                    <input type="hidden" id="clsModalId">
                    <div class="space-y-4">
                        <div>
                            <label for="clsSportType" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_sport_type')}</label>
                            <select id="clsSportType" name="sportTypeId" required class="form-select"></select>
                        </div>
                        <div>
                            <label for="clsTutor" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_tutor')}</label>
                            <select id="clsTutor" name="tutorId" required class="form-select"></select>
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
                        <div class="pt-4 border-t">
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" id="notForMonthlyCheckbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500">
                                <span class="ml-3 text-slate-700 font-semibold">${_('label_not_for_monthly')}</span>
                            </label>
                            <p class="text-xs text-slate-500 ml-7">${_('desc_not_for_monthly')}</p>
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
        populateDropdown(form.querySelector('#clsSportType'), appState.sportTypes, true);
        
        const deleteBtn = form.querySelector('.delete-btn');
        deleteBtn.classList.add('hidden');
        
        const updateTutorDropdown = () => {
            const selectedSportId = form.querySelector('#clsSportType').value;
            const skilledTutors = appState.tutors.filter(tutor => tutor.skills.some(skill => skill.sportTypeId === selectedSportId));
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
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => handleDeleteClsRequest(clsToEdit);
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

            const classesOnDay = appState.classes
                .filter(c => c.date === defaultDate)
                .sort((a, b) => a.time.localeCompare(b.time));

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
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;

        // NOTE: The 'async' keyword is removed because the problematic 'await' for
        // the refund logic has been taken out. This is the intended fix.
        
        const newClsDataFromForm = {
            sportTypeId: form.querySelector('#clsSportType').value,
            tutorId: form.querySelector('#clsTutor').value,
            duration: parseInt(form.querySelector('#clsDuration').value),
            time: form.querySelector('#clsTime').value,
            credits: parseFloat(form.querySelector('#clsCredits').value),
            maxParticipants: parseInt(form.querySelector('#clsMaxParticipants').value),
            date: form.querySelector('#clsDate').value,
            notForMonthly: form.querySelector('#notForMonthlyCheckbox').checked
        };

        const tutor = appState.tutors.find(t => t.id === newClsDataFromForm.tutorId);
        if (tutor) {
            const skill = tutor.skills.find(s => s.sportTypeId === newClsDataFromForm.sportTypeId);
            if (skill) {
                newClsDataFromForm.payoutDetails = {
                    salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                    salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                };
            }
        }

        const updates = {};
        const monthIndexKey = newClsDataFromForm.date.substring(0, 7);

        let promise;

        if (clsId) {
            const originalCls = appState.classes.find(c => c.id === clsId);
            if (!originalCls) {
                showMessageBox(_('error_could_not_find_original_class'), 'error');
                submitBtn.disabled = false;
                return;
            }
            
            // Defer all logic to our new gatekeeper function
            handleClsUpdateRequest(originalCls, newClsDataFromForm);
            
            // The gatekeeper now handles UI feedback, so we can re-enable the button.
            submitBtn.disabled = false;
            
        } else {
            // This is a NEW class, so the logic is simpler
            const newClsKey = database.ref('/classes').push().key;
            newClsDataFromForm.bookedBy = {};
            newClsDataFromForm.attendedBy = {};
            
            updates[`/classes/${newClsKey}`] = newClsDataFromForm;
            updates[`/clsMonths/${monthIndexKey}`] = true;
            promise = database.ref().update(updates);
        }

        promise.then(() => {
            showMessageBox(_(clsId ? 'success_class_updated' : 'success_class_added'), 'success');
            closeModal(DOMElements.clsModal);
        }).catch(error => {
            showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error');
        }).finally(() => {
            submitBtn.disabled = false;
        });
    }

    function createParticipantCounter(current, max, isEditable = false) {
        const fillRate = max > 0 ? current / max : 0;
        
        let statusCls = 'status-low';
        if (fillRate >= 1) {
            statusCls = 'status-full';
        } else if (fillRate >= 0.75) {
            statusCls = 'status-high';
        } else if (fillRate >= 0.5) {
            statusCls = 'status-medium';
        }
        
        const editableCls = isEditable ? 'participant-counter-editable' : '';

        // Translate the title/tooltip attribute
        const tooltipText = _('tooltip_spots_filled').replace('{current}', current).replace('{max}', max);

        return `
            <div class="participant-counter ${statusCls} ${editableCls}" title="${tooltipText}">
                ${current}/${max}
            </div>
        `;
    }

    // --- Main Rendering Functions ---
    function createClsElement(cls) {
        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === cls.tutorId);
        const el = document.createElement('div');
        el.id = cls.id; 
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;
        const currentBookings = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
        
        el.className = `cls-block p-3 rounded-lg shadow-md text-white mb-2 flex flex-col justify-between`;
        el.style.backgroundColor = sportType?.color || '#64748b';

        if (!isAdmin) {
            const { memberSportType, memberTutor } = appState.selectedFilters;
            const sportMatch = memberSportType === 'all' || cls.sportTypeId === memberSportType;
            const tutorMatch = memberTutor === 'all' || cls.tutorId === memberTutor;
            if (!sportMatch || !tutorMatch) {
                el.classList.add('filtered-out');
            }
        }
        
        let actionButton = '';
        let mainAction = () => {};
        const isBookedByCurrentUser = !isAdmin && appState.currentUser && cls.bookedBy && cls.bookedBy[appState.currentUser.id];
        const isAttendedByCurrentUser = !isAdmin && appState.currentUser && cls.attendedBy && cls.attendedBy[appState.currentUser.id];
        const isFull = currentBookings >= cls.maxParticipants;
        const isMonthlyMember = !isAdmin && appState.currentUser.monthlyPlan;
        const isRestrictedForMonthly = cls.notForMonthly;

        if (isAdmin) {
            el.classList.add('cursor-pointer');
            actionButton = `<button class="edit-cls-btn absolute top-2 right-2 opacity-60 hover:opacity-100 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>`;
            mainAction = () => { 
                if (!appState.copyMode.active) {
                    const freshClsData = appState.classes.find(c => c.id === cls.id);
                    openJoinedMembersModal(freshClsData);
                } 
            };
        } else if (isMonthlyMember && isRestrictedForMonthly) {
            el.classList.add('cls-block-restricted');
        } else if (isBookedByCurrentUser) {
            el.classList.add('booked-by-member');
        } else if (appState.currentUser && !isFull) {
            el.classList.add('cursor-pointer');
            mainAction = () => openBookingModal(cls);
        }

        // Translate the credit text with pluralization
        const creditText = `${cls.credits} ${_(cls.credits === 1 ? 'label_credit_single' : 'label_credit_plural')}`;

        let memberActionHTML;
        if (isBookedByCurrentUser) {
            if (isAttendedByCurrentUser) {
                // Translate "COMPLETED" status
                memberActionHTML = `<span class="bg-white/90 text-green-600 font-bold text-xs px-2 py-1 rounded-full">${_('status_completed')}</span>`;
            } else {
                // Translate "BOOKED" and "CANCEL?" statuses for the toggle button
                memberActionHTML = `<button class="cancel-booking-btn-toggle bg-white/90 text-indigo-600 font-bold text-xs px-3 py-1 rounded-full transition-all duration-200 hover:bg-red-600 hover:text-white" data-booked-text="${_('status_booked')}" data-cancel-text="${_('status_cancel_prompt')}">${_('status_booked')}</button>`;
            }
        } else if (isMonthlyMember && isRestrictedForMonthly) {
            // Translate "NOT AVAILABLE" status
            memberActionHTML = `<span class="bg-white text-slate-600 font-bold text-xs px-3 py-1 rounded-full">${_('status_not_available')}</span>`;
        } else if (isFull) {
            // Translate "FULL" status
            memberActionHTML = `<span class="bg-white text-red-600 font-bold text-xs px-3 py-1 rounded-full">${_('status_full')}</span>`;
        } else {
            memberActionHTML = `<span class="font-bold text-white">${creditText}</span>`;
        }
        
        const participantCounterHTML = isAdmin
            ? (window.matchMedia('(any-pointer: fine)').matches
                ? createParticipantCounter(currentBookings, cls.maxParticipants, true)
                : `<div class="participant-dial-trigger">${createParticipantCounter(currentBookings, cls.maxParticipants, false)}</div>`
            )
            : createParticipantCounter(currentBookings, cls.maxParticipants, false);

        el.innerHTML = `
            <div>
                <p class="font-bold text-lg leading-tight pr-6">${getSportTypeName(sportType)}</p>
                ${actionButton}
            </div>
            <div class="text-sm mt-1.5 flex justify-between items-center">
                <span class="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                    ${tutor?.name || _('unknown_tutor')}
                </span>
                ${participantCounterHTML}
            </div>
            <div class="mt-2 flex justify-between items-center">
                ${isAdmin
                    ? (window.matchMedia('(any-pointer: fine)').matches
                        ? `<p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md inline-block time-slot time-slot-editable">${getTimeRange(cls.time, cls.duration)}</p>`
                        : `<div class="relative inline-block">
                               <p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md">${getTimeRange(cls.time, cls.duration)}</p>
                               <input type="time" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value="${cls.time}" />
                           </div>`
                    )
                    : `<p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md inline-block">${getTimeRange(cls.time, cls.duration)}</p>`
                }
                <div class="member-action-container">
                    ${isAdmin 
                        ? (isFull 
                            ? `<span class="bg-white text-red-600 font-bold text-xs px-3 py-1 rounded-full">${_('status_full')}</span>` 
                            : `<span class="font-bold text-white">${creditText}</span>`) 
                        : memberActionHTML
                    }
                </div>
            </div>`;

        el.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.time-slot-editable') && !e.target.closest('.participant-counter-editable') && !e.target.closest('.participant-dial-trigger')) {
                mainAction();
            }
        });

        if (isAdmin) {
            el.querySelector('.edit-cls-btn').onclick = (e) => {
                e.stopPropagation();
                openClsModal(cls.date, cls);
            };
            
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
                        
                        // --- THIS IS THE FIX ---
                        // Create a function that knows how to revert the UI for THIS specific element
                        const revertUICallback = () => {
                            timeSlotEl.textContent = getTimeRange(cls.time, cls.duration);
                        };

                        // Pass the original time and the revert callback to the gatekeeper
                        handleClsUpdateRequest(cls, { time: localClsTime }, revertUICallback);
                        // --- END OF FIX ---
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

                        // --- THIS IS THE FIX ---
                        // Create a revert callback for the mobile time input as well
                        const revertUICallback = () => {
                            // For the mobile input, we just need to reset its value
                            timeInput.value = cls.time;
                        };

                        handleClsUpdateRequest(cls, { time: timeInput.value }, revertUICallback);
                        // --- END OF FIX ---
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
                cancelButton.onclick = (e) => { e.stopPropagation(); saveSchedulePosition(); handleCancelBooking(cls); };
                cancelButton.onmouseenter = () => cancelButton.textContent = cancelButton.dataset.cancelText;
                cancelButton.onmouseleave = () => cancelButton.textContent = cancelButton.dataset.bookedText;
            }
        }
        
        return el;
    }

    function _reSortDayColumn(dateIso) {
        const dayContainer = document.querySelector(`.classes-container[data-date="${dateIso}"]`);
        if (!dayContainer) return; // Do nothing if the day is not visible

        // 1. Get all classes for this specific day from the global app state
        const dailyClasses = appState.classes.filter(c => c.date === dateIso);
        
        // 2. Sort them by time to ensure the correct order
        dailyClasses.sort((a, b) => a.time.localeCompare(b.time));

        // 3. Clear only this day's container
        dayContainer.innerHTML = '';

        // 4. Re-append the newly sorted class elements
        dailyClasses.forEach(cls => {
            dayContainer.appendChild(createClsElement(cls));
        });
    }

    function _renderScheduleCarousel(container, startDate, endDate, datesArray, initialScrollIndex, showAddButton) {
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

        const todayIso = getIsoDate(new Date());
        // Use the new language-aware formatter
        const headerDateFormatter = new Intl.DateTimeFormat(getLocale(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

        datesArray.forEach(dateIso => {
            const date = new Date(dateIso + 'T12:00:00Z');
            const isToday = (dateIso === todayIso);
            // Translate the "Today" badge
            const todayBadge = isToday ? `<span class="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">${_('label_today')}</span>` : '';
            const headerClasses = `day-header p-2 rounded-t-xl ${isToday ? 'bg-indigo-50' : 'hover:bg-slate-100'}`;

            // Translate the copy buttons
            const copyButtonsHTML = showAddButton ? `
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <button data-date="${dateIso}" class="copy-class-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">${_('btn_copy_class')}</button>
                    <button data-date="${dateIso}" class="copy-day-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">${_('btn_copy_day')}</button>
                </div>
            ` : '';

            content += `
                <div class="embla__slide px-2">
                    <div class="day-column bg-slate-50/50 rounded-xl flex flex-col">
                        <div class="${headerClasses}" data-date="${dateIso}">
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

        const classesByDate = appState.classes.reduce((acc, cls) => { (acc[cls.date] = acc[cls.date] || []).push(cls); return acc; }, {});
        container.querySelectorAll('.classes-container').forEach(cont => {
            const date = cont.dataset.date;
            const dailyClasses = classesByDate[date] || [];
            
            cont.innerHTML = '';
            
            dailyClasses.sort((a, b) => a.time.localeCompare(b.time)).forEach(cls => cont.appendChild(createClsElement(cls)));
        });

        const emblaNode = container.querySelector('.embla__viewport');
        emblaApi = EmblaCarousel(emblaNode, { loop: false, align: "start", dragFree: true, startIndex: initialScrollIndex });
        
        const prevBtn = container.querySelector(".embla__button--prev");
        const nextBtn = container.querySelector(".embla__button--next");
        
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;
        
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
    }

    function renderOwnerSchedule(container) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Use local time
        
        const daysToLookBack = appState.ownerPastDaysVisible;
        const ownerStartDate = new Date(today.getTime());
        ownerStartDate.setDate(today.getDate() - daysToLookBack);

        const ownerEndDate = new Date();
        ownerEndDate.setUTCHours(0,0,0,0);
        ownerEndDate.setUTCDate(today.getUTCDate() + 30);

        // Determine the furthest future date we need to display. This could be from
        // a one-time jump or from the persistent remembered scroll position.
        const furthestRequiredDate = appState.scrollToDateOnNextLoad || appState.scheduleScrollDate;

        if (furthestRequiredDate) {
            const targetDate = new Date(furthestRequiredDate);
            // If the required date (either from a jump or memory) is beyond our default 30-day view...
            if (targetDate > ownerEndDate) {
                // ...update the end date to include that date plus a 7-day buffer for context.
                const newEndDate = new Date(targetDate);
                newEndDate.setUTCDate(newEndDate.getUTCDate() + 7);
                ownerEndDate.setTime(newEndDate.getTime());
            }
        }
        // --- END: COMPLETE FIX FOR DATE RANGE EXPANSION ---

        const datesArray = [];
        for (let d = new Date(ownerStartDate); d <= ownerEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            datesArray.push(getIsoDate(d));
        }

        const initialScrollIndex = getInitialScheduleIndex(datesArray, daysToLookBack);
        
        // Render the carousel first with the correct index.
        _renderScheduleCarousel(container, ownerStartDate, ownerEndDate, datesArray, initialScrollIndex, true);
        
        updateCopyUI();
    }

    function renderMemberSchedulePage(container) {
        // The container is now the main content area for the schedule page
        container.innerHTML = `<div id="member-schedule-carousel"></div>`;
        const carouselContainer = container.querySelector('#member-schedule-carousel');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Use local time

        const memberStartDate = new Date(today.getTime());
        memberStartDate.setDate(today.getDate() - MEMBER_PAST_DAYS); // Use local date

        let memberEndDate = new Date(today.getTime());

        const futureClasses = appState.classes.filter(c => new Date(c.date) >= memberStartDate);
        if (futureClasses.length > 0) {
            const latestClsDate = new Date(Math.max(...futureClasses.map(c => new Date(c.date).getTime())));
            if (latestClsDate > memberEndDate) {
                memberEndDate = latestClsDate;
            }
        }
        
        const datesArray = [];
        for (let d = new Date(memberStartDate); d <= memberEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            datesArray.push(getIsoDate(d));
        }

        const initialScrollIndex = getInitialScheduleIndex(datesArray, MEMBER_PAST_DAYS);

        _renderScheduleCarousel(carouselContainer, memberStartDate, memberEndDate, datesArray, initialScrollIndex, false);
    }

    function openFilterModal() {
        const { memberSportType, memberTutor } = appState.selectedFilters;
        const isFilterActive = memberSportType !== 'all' || memberTutor !== 'all';

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const memberStartDate = new Date(today.getTime());
        const futureClasses = appState.classes.filter(c => new Date(c.date) >= memberStartDate);

        const relevantSportTypeIds = new Set(futureClasses.map(c => c.sportTypeId));
        const availableSportTypes = appState.sportTypes.filter(st => relevantSportTypeIds.has(st.id));
        
        const relevantTutorIds = new Set(futureClasses.map(c => c.tutorId));
        const availableTutors = appState.tutors.filter(t => relevantTutorIds.has(t.id));

        DOMElements.filterModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-6 text-center">${_('title_filter_schedule')}</h2>
                <form id="filterForm" class="space-y-4">
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
        const sportTypeFilter = modal.querySelector('#modalSportTypeFilter');
        const tutorFilter = modal.querySelector('#modalTutorFilter');
        const clearBtn = modal.querySelector('#modalClearFiltersBtn');

        populateSportTypeFilter(sportTypeFilter, availableSportTypes);
        sportTypeFilter.value = memberSportType;
        
        populateTutorFilter(tutorFilter, sportTypeFilter.value, availableTutors);
        tutorFilter.value = memberTutor;
        
        sportTypeFilter.onchange = () => {
            populateTutorFilter(tutorFilter, sportTypeFilter.value, availableTutors);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            appState.selectedFilters.memberSportType = sportTypeFilter.value;
            appState.selectedFilters.memberTutor = tutorFilter.value;
            closeModal(modal);
            updateUIVisibility();
        };
        
        clearBtn.onclick = () => {
            appState.selectedFilters.memberSportType = 'all';
            appState.selectedFilters.memberTutor = 'all';
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
                <form id="goToDateForm" class="space-y-4">
                    <div>
                        <label for="goToDatePicker" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_select_date')}</label>
                        <input type="date" id="goToDatePicker" class="form-input w-full" value="${getIsoDate(new Date())}">
                    </div>
                    <div class="pt-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition">${_('btn_go')}</button>
                    </div>
                </form>
            </div>
        `;

        const form = DOMElements.goToDateModal.querySelector('#goToDateForm');

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
            }
            
            switchPage('schedule');
            closeModal(DOMElements.goToDateModal);
        };

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
        DOMElements.cancelCopyBtn.classList.remove('hidden');
        updateCopyUI();
    }

    function cancelCopy() {
        appState.copyMode.active = false;
        appState.copyMode.type = null;
        appState.copyMode.sourceId = null;
        appState.copyMode.targetDate = null;
        DOMElements.cancelCopyBtn.classList.add('hidden');
        updateCopyUI();
    }

    function performCopy(type, sourceData, targetDate) {
        saveSchedulePosition();

        if (type === 'day') {
            const sourceDate = sourceData;
            const classesToCopy = appState.classes.filter(c => c.date === sourceDate);
            if (classesToCopy.length === 0) {
                showMessageBox(_('error_copy_source_day_empty'), 'error');
                cancelCopy();
                return;
            } else {
                const copyPromises = classesToCopy.map(cls => {
                    // --- START: FIX ---
                    // 1. Exclude the old payoutDetails from the spread operator.
                    const { id, bookedBy, attendedBy, payoutDetails, ...restOfCls } = cls;
                    const newCls = {
                        ...restOfCls,
                        date: targetDate,
                        bookedBy: {},
                        attendedBy: {}
                    };

                    // 2. Generate new payoutDetails based on the tutor's CURRENT salary.
                    const tutor = appState.tutors.find(t => t.id === newCls.tutorId);
                    if (tutor) {
                        const skill = tutor.skills.find(s => s.sportTypeId === newCls.sportTypeId);
                        if (skill) {
                            newCls.payoutDetails = {
                                salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                                salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                            };
                        }
                    }
                    // --- END: FIX ---

                    return database.ref('/classes').push(newCls);
                });
                Promise.all(copyPromises).then(() => {
                    showMessageBox(_('success_day_copied').replace('{count}', classesToCopy.length).replace('{sourceDate}', formatDateWithWeekday(sourceDate)).replace('{targetDate}', formatDateWithWeekday(targetDate)), 'success');
                });
            }
        } else if (type === 'class') {
            // --- START: FIX ---
            // 1. Exclude the old payoutDetails from the spread operator.
            const { id, bookedBy, attendedBy, payoutDetails, ...restOfCls } = sourceData;
            const newCls = {
                ...restOfCls,
                date: targetDate,
                bookedBy: {},
                attendedBy: {}
            };

            // 2. Generate new payoutDetails based on the tutor's CURRENT salary.
            const tutor = appState.tutors.find(t => t.id === newCls.tutorId);
            if (tutor) {
                const skill = tutor.skills.find(s => s.sportTypeId === newCls.sportTypeId);
                if (skill) {
                    newCls.payoutDetails = {
                        salaryType: tutor.isEmployee ? 'perCls' : skill.salaryType,
                        salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                    };
                }
            }
            // --- END: FIX ---

            database.ref('/classes').push(newCls).then(() => {
                const sportTypeName = appState.sportTypes.find(st => st.id === newCls.sportTypeId).name;
                showMessageBox(_('success_class_copied').replace('{name}', sportTypeName).replace('{date}', formatDateWithWeekday(targetDate)), 'success');
            });
        }
        
        cancelCopy();
    }

    function updateCopyUI() {
        const schedulePage = document.getElementById('page-schedule');
        if (!schedulePage) return;

        schedulePage.querySelectorAll('.copy-mode-source, .copy-mode-source-class, .copy-mode-paste-zone').forEach(el => {
            el.classList.remove('copy-mode-source', 'copy-mode-source-class', 'copy-mode-paste-zone');
            el.style.cursor = '';
        });

        if (!appState.copyMode.active) return;

        const { type, targetDate } = appState.copyMode;

        const targetDayEl = schedulePage.querySelector(`.day-column .classes-container[data-date="${targetDate}"]`)?.closest('.day-column');
        if (targetDayEl) {
            targetDayEl.classList.add('copy-mode-paste-zone');
        }

        if (type === 'day') {
            showMessageBox(_('info_copy_day_prompt'), 'info');
            schedulePage.querySelectorAll('.day-header').forEach(headerEl => {
                if (headerEl.dataset.date !== targetDate) {
                    headerEl.classList.add('copy-mode-source');
                    headerEl.style.cursor = 'copy';
                }
            });
        } else if (type === 'class') {
            showMessageBox(_('info_copy_class_prompt'), 'info');
            schedulePage.querySelectorAll('.cls-block').forEach(clsEl => {
                const cls = appState.classes.find(c => c.id === clsEl.id);
                if (cls && cls.date !== targetDate) {
                    clsEl.classList.add('copy-mode-source-class');
                }
            });
        }
    }

    function renderAccountPage(container) {
        const member = appState.currentUser;
        if (!member) {
            container.innerHTML = '<p>Loading account details...</p>';
            return;
        };
        
        // Clean up any old listeners from previous page views
        Object.values(memberCheckInListeners).forEach(({ ref, listener }) => ref.off('value', listener));
        memberCheckInListeners = {};

        const today = getIsoDate(new Date());
        const todaysUnattendedBookings = appState.classes.filter(cls => 
            cls.date === today && 
            cls.bookedBy && cls.bookedBy[member.id] &&
            !(cls.attendedBy && cls.attendedBy[member.id])
        );

        todaysUnattendedBookings.forEach(cls => {
            const checkInRef = database.ref(`/classes/${cls.id}/attendedBy/${member.id}`);
            
            const listener = checkInRef.on('value', (snapshot) => {
                if (snapshot.val() === true) {
                    playSuccessSound();
                    if (navigator.vibrate) {
                        navigator.vibrate(200);
                    }

                    // --- START OF FIX: Target the new container below the QR code ---
                    const resultContainer = document.getElementById('qrCodeResultContainer');
                    if (resultContainer) {
                        const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                        const message = _('check_in_success').replace('{name}', member.name).replace('{class}', getSportTypeName(sportType));
                        
                        resultContainer.innerHTML = `<div class="check-in-result-banner check-in-success">${message}</div>`;
                        
                        // Clear the message after 3 seconds
                        setTimeout(() => {
                            if (resultContainer) { // Check if element still exists
                               resultContainer.innerHTML = '';
                            }
                        }, 3000);
                    }
                    // --- END OF FIX ---

                    checkInRef.off('value', listener);
                    delete memberCheckInListeners[cls.id];
                }
            });

            memberCheckInListeners[cls.id] = { ref: checkInRef, listener: listener };
        });
        
        const memberBookings = appState.classes
            .filter(c => c.bookedBy && c.bookedBy[member.id])
            .sort((a, b) => {
                const dateComparison = b.date.localeCompare(a.date);
                if (dateComparison !== 0) {
                    return dateComparison;
                }
                return a.time.localeCompare(b.time);
            });

        const purchaseHistory = firebaseObjectToArray(member.purchaseHistory);
        const paymentHistory = firebaseObjectToArray(member.paymentHistory);

        container.innerHTML = `
            <div class="w-full max-w-screen-lg mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 space-y-8">
                    <div class="card p-6 text-center">
                        <h2 class="text-2xl font-bold text-slate-800">${member.name}</h2>
                        <p class="text-slate-500">${member.email}</p>
                        <hr class="my-6">
                        <div class="space-y-4 text-left">
                            ${member.monthlyPlan 
                                ? `
                                   <div><p data-lang-key="label_join_date" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.joinDate)}</p></div>
                                   <div><p data-lang-key="label_plan" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800"><span class="bg-green-100 text-green-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span></p></div>
                                   <div><p data-lang-key="label_renews_every_month" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800">${
                                        (() => {
                                            if (!member.planStartDate) return _('label_na');
                                            const day = parseInt(member.planStartDate.split('-')[2]);
                                            const suffix = getOrdinalSuffix(day);
                                            return _('label_on_the_day')
                                                .replace('{day}', day)
                                                .replace('{suffix}', suffix);
                                        })()
                                   }</p></div>
                                   <div><p data-lang-key="label_next_payment_due" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800">${member.paymentDueDate ? formatShortDateWithYear(member.paymentDueDate) : 'N/A'}</p></div>`
                                : `
                                   <div><p data-lang-key="label_join_date" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.joinDate)}</p></div>
                                   <div><p data-lang-key="label_credits_remaining" class="text-sm text-slate-500"></p><p class="font-bold text-3xl text-indigo-600">
                                       <span class="bg-yellow-100 text-yellow-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCredits(member.credits)}/${formatCredits(member.initialCredits) || _('label_na')}</span>
                                   </p></div>
                                   <div><p data-lang-key="label_credits_expire" class="text-sm text-slate-500"></p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.expiryDate)}</p></div>`
                            }
                        </div>
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

                    <!-- START OF FIX: The HTML structure is changed here -->
                    <div class="card p-6 text-center">
                        <h4 data-lang-key="title_qr_code" class="text-xl font-bold text-slate-800 mb-4"></h4>
                        <div id="qrCodeContainer" class="w-48 h-48 mx-auto"></div>
                        <div id="qrCodeResultContainer" class="mt-4 min-h-[4rem]"></div>
                    </div>
                    <!-- END OF FIX -->

                    ${member.monthlyPlan ? `
                    <div class="card p-6">
                        <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">${_('header_payment_history')}</h4>
                        <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                            ${paymentHistory.length > 0
                                ? paymentHistory
                                    .filter(p => p.status !== 'deleted')
                                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                                    .map(p => {
                                        const monthUnit = p.monthsPaid === 1 ? _('label_month_singular') : _('label_month_plural');
                                        const entryText = _('history_payment_entry')
                                            .replace('{amount}', formatCurrency(p.amount))
                                            .replace('{quantity}', p.monthsPaid)
                                            .replace('{unit}', monthUnit);
                                        let auditMessage = '';
                                        if (p.lastModifiedBy) {
                                            const actionKey = (p.date === p.lastModifiedAt ? 'audit_added_by' : 'audit_edited_by');
                                            auditMessage = `<span class="text-xs text-slate-500 mt-1">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</span>`;
                                        }
                                        return `
                                            <div class="text-slate-600 bg-slate-50 p-2 rounded-md">
                                                <div><strong>${formatShortDateWithYear(p.date)}:</strong> ${entryText}</div>
                                                ${auditMessage}
                                            </div>
                                        `;
                                    }).join('')
                                : `<p class="text-sm text-slate-500 text-center">${_('no_payment_history')}</p>`
                            }
                        </div>
                    </div>` : `
                    <div class="card p-6">
                        <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">${_('header_purchase_history')}</h4>
                        <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                            ${purchaseHistory.length > 0 
                                ? purchaseHistory
                                    .filter(p => p.status !== 'deleted')
                                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                                    .map(p => {
                                        const creditsUnit = p.credits === 1 ? _('label_credit_single') : _('label_credit_plural');
                                        const entryText = _('history_purchase_entry')
                                            .replace('{amount}', formatCurrency(p.amount))
                                            .replace('{quantity}', p.credits)
                                            .replace('{unit}', creditsUnit);
                                        let auditMessage = '';
                                        if (p.lastModifiedBy) {
                                            const actionKey = (p.date === p.lastModifiedAt ? 'audit_added_by' : 'audit_edited_by');
                                            auditMessage = `<span class="text-xs text-slate-500 mt-1">${_(actionKey).replace('{name}', p.lastModifiedBy).replace('{date}', formatShortDateWithYear(p.lastModifiedAt))}</span>`;
                                        }
                                        return `
                                            <div class="text-slate-600 bg-slate-50 p-2 rounded-md">
                                                <div><strong>${formatShortDateWithYear(p.date)}:</strong> ${entryText}</div>
                                                ${auditMessage}
                                            </div>
                                        `;
                                    }).join('') 
                                : `<p class="text-sm text-slate-500 text-center">${_('no_purchase_history')}</p>`
                            }
                        </div>
                    </div>`}
                </div>
                <div class="md:col-span-2">
                    <div class="card p-6">
                        <h3 class="text-2xl font-bold text-slate-800 mb-4">${_('header_my_bookings')} (${memberBookings.length})</h3>
                        <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                            ${memberBookings.length === 0 ? `<p class="text-slate-500">${_('no_booking_history')}</p>` :
                            memberBookings.map(cls => {
                                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                                const isAttended = cls.attendedBy && cls.attendedBy[member.id];
                                const isHighlighted = cls.id === appState.highlightBookingId;
                                const bookingDetails = cls.bookedBy[member.id];
                                const creditsUsed = bookingDetails.creditsPaid;
                                return `<div class="${isHighlighted ? 'booking-highlight' : 'bg-slate-100'} p-4 rounded-lg flex justify-between items-center" data-cls-id="${cls.id}">
                                    <div>
                                        <p class="font-bold text-slate-800">${getSportTypeName(sportType)}</p>
                                        <p class="text-sm text-slate-500">${_('template_datetime_at').replace('{date}', formatShortDateWithYear(cls.date)).replace('{time}', getTimeRange(cls.time, cls.duration))}</p>
                                        <p class="text-xs text-slate-600">${_('label_credits_used')} ${creditsUsed}</p>
                                        <p class="text-xs text-slate-500">${formatBookingAuditText(bookingDetails)}</p>
                                    </div>
                                    ${isAttended 
                                        ? `<span class="text-sm font-semibold text-green-600">${_('status_completed')}</span>`
                                        : `<button class="cancel-booking-btn-dash text-sm font-semibold text-red-600 hover:text-red-800" data-cls-id="${cls.id}">${_('btn_cancel')}</button>`
                                    }
                                </div>`
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>`;

        const qrCodeContainer = container.querySelector('#qrCodeContainer');
        if (qrCodeContainer) {
            qrCodeContainer.innerHTML = '';
            new QRCode(qrCodeContainer, {
                text: member.id,
                width: 192,
                height: 192,
                colorDark: "#1e293b",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        setupLanguageToggles();
        updateUIText();
        setLanguage(appState.currentLanguage, false);

        container.querySelectorAll('.cancel-booking-btn-dash').forEach(btn => {
            btn.onclick = () => {
                const cls = appState.classes.find(c => c.id === btn.dataset.clsId);
                handleCancelBooking(cls);
            };
        });

        if (appState.highlightBookingId) {
            const elementToScrollTo = container.querySelector(`[data-cls-id="${appState.highlightBookingId}"]`);
            if (elementToScrollTo) {
                elementToScrollTo.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
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
                        <input type="text" id="editMemberName" required class="form-input" value="${member.name}">
                    </div>
                    <div>
                        <label for="editMemberEmail" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_email')}</label>
                        <input type="email" id="editMemberEmail" required class="form-input" value="${member.email}" disabled>
                    </div>
                    <div>
                        <label for="editMemberPhone" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_mobile_number')}</label>
                        <div class="flex gap-2">
                            <input type="text" id="editMemberCountryCode" class="form-input w-24" placeholder="${_('placeholder_country_code')}">
                            <input type="tel" id="editMemberPhone" required class="form-input flex-grow">
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
        const memberCount = appState.users.filter(u => u.role !== 'owner' && u.role !== 'staff' && !u.isDeleted).length;
        const isOwner = appState.currentUser?.role === 'owner';

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_manage_members')} (${memberCount})</h2>
                    <div class="flex flex-wrap items-center justify-end gap-4">
                        <div class="relative w-64">
                            <input type="text" id="memberSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-full pr-10">
                            <button id="clearSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" style="display: none;">
                                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        ${isOwner ? `
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
                 <div class="w-full mt-4 mb-6 p-4 bg-slate-50 border rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 class="font-semibold text-slate-800">${_('header_auto_adjust_plans')}</h4>
                        <p class="text-sm text-slate-600">${_('desc_auto_adjust_plans')}</p>
                    </div>
                    <button id="recalculatePlansBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition w-full sm:w-auto flex-shrink-0">${_('btn_recalculate_all')}</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 sortable cursor-pointer" data-sort-key="name">${_('table_header_name')}<span class="sort-icon"></span></th>
                                <th class="p-2">${_('table_header_contact')}</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="joinDate">${_('table_header_join')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="credits">${_('table_header_credits_plan')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="expiryDate">${_('table_header_expiry_due')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="lastBooking">${_('table_header_last_active')}<span class="sort-icon"></span></th>
                                <th class="p-2"></th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody"></tbody>
                    </table>
                </div>
            </div>`;
        
        const searchInput = container.querySelector('#memberSearchInput');
        const clearBtn = container.querySelector('#clearSearchBtn');
        const tableBody = container.querySelector('#membersTableBody');

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

        const updateTable = (searchTerm = '') => {
            const { key, direction } = appState.membersSort;
            container.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
                icon.className = 'sort-icon';
            });
            const activeHeader = container.querySelector(`th[data-sort-key="${key}"] .sort-icon`);
            if (activeHeader) {
                activeHeader.classList.add(direction);
            }
            
            const filteredUsers = appState.users.filter(u => 
                u.role !== 'owner' && u.role !== 'staff' && !u.isDeleted && (
                !searchTerm ||
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.phone && u.phone.includes(searchTerm)))
            );

            const sortedUsers = filteredUsers.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                if (key === 'credits') {
                    if (a.monthlyPlan) valA = Infinity;
                    if (b.monthlyPlan) valB = Infinity;
                }
                if (key === 'expiryDate' || key === 'lastBooking' || key === 'joinDate') {
                    if (key === 'expiryDate') {
                        valA = a.monthlyPlan ? a.paymentDueDate : a.expiryDate;
                        valB = b.monthlyPlan ? b.paymentDueDate : b.expiryDate;
                    }
                    valA = valA ? new Date(valA).getTime() : -Infinity;
                    valB = valB ? new Date(valB).getTime() : -Infinity;
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            tableBody.innerHTML = sortedUsers.map(member => {
                const expiryOrDueDate = formatShortDateWithYear(member.monthlyPlan ? member.paymentDueDate : member.expiryDate);

                return `
                <tr class="border-b border-slate-100">
                    <td class="p-2 font-semibold"><button class="text-indigo-600 hover:underline member-name-btn" data-id="${member.id}">${member.name}</button></td>
                    <td class="p-2 text-sm"><div>${member.email}</div><div>${formatDisplayPhoneNumber(member.phone)}</div></td>
                    <td class="p-2 text-sm">${member.joinDate ? formatShortDateWithYear(member.joinDate) : 'N/A'}</td>
                    <td class="p-2">${member.monthlyPlan 
                        ? `<span class="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span>` 
                        : `<span class="bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded-full">${formatCredits(member.credits)}/${formatCredits(member.initialCredits) || _('label_na')}</span>`}
                    </td>
                    <td class="p-2 text-sm">${expiryOrDueDate}</td>
                    <td class="p-2 text-sm">${formatShortDateWithYear(member.lastBooking)}</td>
                    <td class="p-2 text-right space-x-2">
                        <button class="edit-member-btn font-semibold text-indigo-600" data-id="${member.id}">${_('btn_edit')}</button>
                        <button class="delete-member-btn font-semibold text-red-600" data-id="${member.id}" data-name="${member.name}">${_('btn_delete')}</button>
                    </td>
                </tr>
            `}).join('');
            tableBody.querySelectorAll('.edit-member-btn').forEach(btn => {
                btn.onclick = () => openMemberModal(appState.users.find(u => u.id === btn.dataset.id));
            });
            tableBody.querySelectorAll('.delete-member-btn').forEach(btn => {
                btn.onclick = () => {
                    const memberId = btn.dataset.id;
                    const memberName = btn.dataset.name;
                    const memberToDelete = appState.users.find(u => u.id === memberId);
                    if (!memberToDelete) {
                        showMessageBox(_('error_could_not_find_member_to_delete'), 'error');
                        return;
                    }
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
        };

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

        searchInput.oninput = () => {
            const term = searchInput.value;
            updateTable(term);
            clearBtn.style.display = term ? 'flex' : 'none';
        };

        clearBtn.onclick = () => {
            searchInput.value = '';
            updateTable('');
            clearBtn.style.display = 'none';
            searchInput.focus();
        };

        if (isOwner) {
            container.querySelector('#exportSummaryBtn').onclick = (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox(_('info_generating_summary'), 'info', 2000);
                const searchTerm = searchInput.value.toLowerCase();
                const filteredUsers = appState.users.filter(u => 
                    u.role !== 'owner' && !u.isDeleted && (
                    !searchTerm ||
                    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.phone && u.phone.includes(searchTerm)))
                );
    
                filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
    
                const exportData = filteredUsers.map(member => ({
                    [_('export_header_name')]: member.name,
                    [_('export_header_email')]: member.email,
                    [_('export_header_phone')]: member.phone,
                    [_('export_header_join_date')]: member.joinDate ? member.joinDate.slice(0, 10) : '',
                    [_('export_header_plan_type')]: member.monthlyPlan ? _('export_value_monthly') : _('export_value_credits'),
                    [_('export_header_monthly_amount')]: member.monthlyPlanAmount || 0,
                    [_('export_header_due_date')]: member.monthlyPlan ? (member.paymentDueDate || '') : _('label_na'),
                    [_('export_header_credits_remaining')]: member.monthlyPlan ? _('label_na') : (member.credits || 0),
                    [_('export_header_credits_initial')]: member.monthlyPlan ? _('label_na') : (member.initialCredits || 0),
                    [_('export_header_expiry_date')]: member.monthlyPlan ? _('label_na') : (member.expiryDate || ''),
                    [_('export_header_last_active')]: member.lastBooking ? member.lastBooking.slice(0, 10) : ''
                }));
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
                                exportData.push({
                                    [_('export_header_name')]: member.name,
                                    [_('export_header_email')]: member.email,
                                    [_('export_header_booking_date')]: cls.date,
                                    [_('export_header_class_name')]: getSportTypeName(sportType),
                                    [_('export_header_tutor_name')]: tutor?.name || _('unknown_tutor'),
                                    [_('export_header_credits_used')]: cls.credits,
                                    [_('export_header_attended')]: (cls.attendedBy && cls.attendedBy[member.id]) ? _('export_value_yes') : _('export_value_no'),
                                    [_('export_header_booked_on')]: bookingInfo.bookedAt ? bookingInfo.bookedAt.slice(0, 10) : '',
                                    [_('export_header_booked_by')]: bookingInfo.bookedBy || _('export_value_unknown')
                                });
                            }
                        });
                    });
                    
                    exportData.sort((a, b) => {
                        const nameKey = _('export_header_name');
                        const dateKey = _('export_header_booking_date');
                        const nameComparison = a[nameKey].localeCompare(b[nameKey]); // <<< FIX
                        if (nameComparison !== 0) {
                            return nameComparison;
                        }
                        return a[dateKey].localeCompare(b[dateKey]); // <<< FIX
                    });
                    
                    exportToCsv('member-full-booking-history', exportData);
                } catch (error) {
                    console.error("Error generating booking history export:", error);
                    showMessageBox(_('error_generate_booking_history_failed'), 'error');
                }
            };
    
            container.querySelector('#exportFinancialHistoryBtn').onclick = async (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox(_('info_generating_financials'), 'info', 5000); //
                try {
                    const usersSnapshot = await database.ref('/users').once('value');
                    const allUsers = firebaseObjectToArray(usersSnapshot.val());
                    const exportData = [];
                    const members = allUsers.filter(u => u.role === 'member' && !u.isDeleted);
                    
                    members.forEach(member => {
                        if (member.purchaseHistory) {
                            firebaseObjectToArray(member.purchaseHistory)
                                .filter(p => p.status !== 'deleted')
                                .forEach(p => {
                                    exportData.push({
                                        [_('export_header_name')]: member.name,
                                        [_('export_header_email')]: member.email,
                                        [_('export_header_transaction_date')]: p.date ? p.date.slice(0, 10) : '',
                                        [_('export_header_transaction_type')]: _('export_value_credit_purchase'),
                                        [_('export_header_description')]: _('export_desc_credits').replace('{count}', p.credits),
                                        [_('export_header_amount')]: p.amount,
                                        [_('export_header_modified_by')]: p.lastModifiedBy || '',
                                        [_('export_header_modified_date')]: p.lastModifiedAt ? p.lastModifiedAt.slice(0, 10) : ''
                                    });
                                });
                        }
                        if (member.paymentHistory) {
                            firebaseObjectToArray(member.paymentHistory)
                                .filter(p => p.status !== 'deleted')
                                .forEach(p => {
                                    exportData.push({
                                        [_('export_header_name')]: member.name,
                                        [_('export_header_email')]: member.email,
                                        [_('export_header_transaction_date')]: p.date ? p.date.slice(0, 10) : '',
                                        [_('export_header_transaction_type')]: _('export_value_monthly_payment'),
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
                        const nameComparison = a[nameKey].localeCompare(b[nameKey]); // <<< FIX
                        if (nameComparison !== 0) return nameComparison;
                        return new Date(a[dateKey]) - new Date(b[dateKey]); // <<< FIX
                    });
                    
                    exportToCsv('member-financial-history', exportData);
                } catch (error) {
                    console.error("Error generating financial history export:", error);
                    showMessageBox(_('error_generate_financial_history_failed'), 'error');
                }
            };
        }

        updateTable();

        container.querySelector('#recalculatePlansBtn').onclick = () => {
            showConfirmation(
                _('confirm_recalculate_title'),
                _('confirm_recalculate_desc'),
                recalculateMonthlyPlans
            );
        };
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
        updates[`/users/${memberId}/email`] = `deleted.${memberId}@studiopulse.app`;
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

    function _renderMemberPurchaseHistory(member, container, historyIdInput, purchaseAmountInput, creditsInput, onEditStart) {
        container.innerHTML = ''; 
        const purchaseHistory = firebaseObjectToArray(member.purchaseHistory);
        
        if (purchaseHistory.length > 0) {
            const sortedHistory = purchaseHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = sortedHistory.map(p => {
                const isDeleted = p.status === 'deleted';
                const costPerCreditText = p.costPerCredit ? _('label_cost_per_credit').replace('{cost}', formatCurrency(p.costPerCredit)) : _('label_na');
                const creditsUnit = p.credits === 1 ? _('label_credit_single') : _('label_credit_plural');
                
                const entryText = _('history_purchase_entry')
                    .replace('{amount}', formatCurrency(p.amount))
                    .replace('{quantity}', p.credits)
                    .replace('{unit}', creditsUnit);

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
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong> ${entryText} <span class="text-xs text-slate-500">${costPerCreditText}</span>
                                ${auditMessage}
                            </div>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none ${isDeleted ? 'hidden' : ''}" data-history-id="${p.id}" title="Remove entry">×</button>
                    </div>`;
            }).join('');
        } else {
             container.innerHTML = `<p class="text-sm text-slate-500 text-center">${_('no_purchase_history')}</p>`;
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
                    const updates = {
                        status: 'deleted',
                        lastModifiedBy: appState.currentUser.name,
                        lastModifiedAt: new Date().toISOString()
                    };

                    database.ref(`/users/${memberId}/purchaseHistory/${historyId}`).update(updates)
                        .then(() => {
                            return database.ref(`/users/${memberId}`).transaction(user => {
                                if (user) {
                                    user.credits = (user.credits || 0) - entryToUpdate.credits;
                                    user.initialCredits = (user.initialCredits || 0) - entryToUpdate.credits;
                                }
                                return user;
                            });
                        })
                        .then(() => {
                            database.ref(`/users/${memberId}`).once('value', snapshot => {
                                const updatedMember = { id: snapshot.key, ...snapshot.val() };
                                _renderMemberPurchaseHistory(updatedMember, container, historyIdInput, purchaseAmountInput, creditsInput);
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
                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(_('info_editing_purchase_from').replace('{date}', formatShortDateWithYear(historyEntry.date)), 'info');
                    onEditStart();
                }
            }
        };
    }
    
    function _renderMemberPaymentHistory(member, container, historyIdInput, monthsPaidInput, paymentAmountInput, onEditStart) {
        container.innerHTML = ''; 
        const paymentHistory = firebaseObjectToArray(member.paymentHistory);
        
        if (paymentHistory.length > 0) {
            const sortedHistory = paymentHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = sortedHistory.map(p => {
                const isDeleted = p.status === 'deleted';
                const monthUnit = p.monthsPaid === 1 ? _('label_month_singular') : _('label_month_plural');
                
                const entryText = _('history_payment_entry')
                    .replace('{amount}', formatCurrency(p.amount))
                    .replace('{quantity}', p.monthsPaid)
                    .replace('{unit}', monthUnit);

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
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong> ${entryText}
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
                                _renderMemberPaymentHistory(updatedMember, container, historyIdInput, monthsPaidInput, paymentAmountInput, onEditStart);
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
                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(_('info_editing_payment_from').replace('{date}', formatShortDateWithYear(historyEntry.date)), 'info');
                    onEditStart();
                }
            }
        };
    }

    function openMemberModal(memberToEdit) {
        DOMElements.memberModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="memberModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">${_('title_edit_member')}</h2>
                <form id="memberForm" class="space-y-4">
                    <input type="hidden" id="memberModalId">
                    <input type="hidden" id="purchaseHistoryId">
                    <input type="hidden" id="paymentHistoryId">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberName" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_member_name')}</label><input type="text" id="memberName" required class="form-input"></div>
                        <div><label for="memberEmail" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_email_address')}</label><input type="email" id="memberEmail" required class="form-input" disabled></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberPhone" class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_mobile_number')}</label><div class="flex gap-2"><input type="text" id="memberCountryCode" class="form-input w-24" placeholder="${_('placeholder_country_code')}"><input type="tel" id="memberPhone" required class="form-input flex-grow"></div></div>
                        <div><label class="block text-slate-600 text-sm font-semibold mb-2">${_('auth_password')}</label><button type="button" id="resetPasswordBtn" class="form-input text-left text-indigo-600 hover:bg-slate-100">${_('label_reset_password')}</button></div>
                    </div>
                    <div class="pt-4 border-t">
                        <div class="flex items-center mb-4"><input type="checkbox" id="monthlyPlan" class="h-4 w-4 rounded text-indigo-600"><label for="monthlyPlan" class="ml-2 text-slate-700">${_('label_monthly_plan')}</label></div>
                        <div id="creditFields" class="space-y-4">
                            <div class="flex items-end gap-2">
                                <div class="flex-grow"><label for="purchaseAmount" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_top_up_amount')}</label><input type="number" id="purchaseAmount" class="form-input" min="0"></div>
                                <div class="flex-grow"><label for="creditsToAdd" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_credits_to_add_edit')}</label><input type="number" id="creditsToAdd" class="form-input" min="0"></div>
                                <button type="button" id="creditActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                <button type="button" id="cancelCreditEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">${_('btn_cancel')}</button>
                            </div>
                            <div id="purchaseHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1"></div>
                            <div>
                                <label for="expiryDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_expiry_date')}</label>
                                <div class="flex gap-2 mb-2">
                                    <button type="button" data-years="1" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_1_year')}</button>
                                    <button type="button" data-years="2" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_2_years')}</button>
                                    <button type="button" data-years="3" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_3_years')}</button>
                                </div>
                                <input type="date" id="expiryDate" class="form-input">
                            </div>
                        </div>
                        <div id="monthlyPlanFields" class="hidden space-y-4">
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
                            <div class="pt-4 border-t border-slate-200">
                                <div class="flex items-end gap-2">
                                    <div class="flex-grow">
                                        <label for="monthsPaid" class="block text-slate-600 text-sm font-semibold mb-1">${_('label_months_paid')}</label>
                                        <input type="number" id="monthsPaid" class="form-input" min="1" step="1">
                                    </div>
                                    <div class="flex-grow">
                                        <label for="paymentAmount" class="block text-slate-600 text-sm font-semibold mb-1">${_('label_payment_amount')}</label>
                                        <input type="number" id="paymentAmount" class="form-input" min="0" step="0.01">
                                    </div>
                                    <button type="button" id="paymentActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                    <button type="button" id="cancelPaymentEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">${_('btn_cancel')}</button>
                                </div>
                                <div id="paymentHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1 mt-2"></div>
                            </div>
                             <div class="flex gap-2">
                                <button type="button" data-months="3" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_3_months')}</button>
                                <button type="button" data-months="6" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_6_months')}</button>
                                <button type="button" data-months="12" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">${_('label_quick_select_1_year')}</button>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="paymentDueDate" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_payment_due_date')}</label>
                                    <input type="date" id="paymentDueDate" class="form-input">
                                </div>
                                <div>
                                    <label for="monthlyPlanEstimatedAttendance" class="block text-slate-600 text-sm font-semibold mb-2">${_('label_est_monthly_attendance')}</label>
                                    <input type="number" id="monthlyPlanEstimatedAttendance" class="form-input" min="1" step="1" placeholder="e.g., 8">
                                </div>
                            </div>
                            <div id="calculatedCreditValueContainer" class="bg-slate-100 p-3 rounded-lg text-center mt-4">
                                <p class="text-sm text-slate-500">${_('label_calculated_credit_value')}</p>
                                <p id="calculatedCreditValueDisplay" class="text-xl font-bold text-indigo-600"></p>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">${_('btn_save_changes')}</button></div>
                </form>
            </div>`;
        
        const modal = DOMElements.memberModal;
        const form = modal.querySelector('form');
        const purchaseAmountInput = form.querySelector('#purchaseAmount');
        const creditsInput = form.querySelector('#creditsToAdd');
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
        
        form.querySelectorAll('.expiry-quick-select-btn').forEach(btn => {
            btn.onclick = () => {
                const yearsToAdd = parseInt(btn.dataset.years);
                if (!isNaN(yearsToAdd)) {
                    const today = new Date();
                    today.setFullYear(today.getFullYear() + yearsToAdd);
                    expiryDateInput.value = getIsoDate(today);
                }
            };
        });

        form.querySelectorAll('.due-date-quick-select-btn').forEach(btn => {
            btn.onclick = () => {
                const planStartDateString = planStartDateInput.value;
                const baseDateString = memberToEdit.paymentDueDate || planStartDateString;
                if (!baseDateString) {
                    showMessageBox(_('info_set_plan_start_date_first'), 'info');
                    return;
                }
                const baseDate = new Date(baseDateString + 'T12:00:00Z');
                if (isNaN(baseDate.getTime())) {
                    showMessageBox(_('error_invalid_base_date'), 'error');
                    return;
                }
                const monthsToAdd = parseInt(btn.dataset.months);
                if (!isNaN(monthsToAdd)) {
                    const newDueDate = new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + monthsToAdd, baseDate.getUTCDate());
                    paymentDueDateInput.value = getIsoDate(newDueDate);
                }
            };
        });
        
        const plusIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>`;
        const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;

        const setCreditButtonToAddMode = () => {
            creditActionBtn.innerHTML = plusIconSVG;
            creditActionBtn.title = _('tooltip_add_entry');
            creditActionBtn.className = 'creditActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            purchaseAmountInput.value = '';
            creditsInput.value = '';
            historyIdInput.value = '';
            historyContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelCreditEditBtn.classList.add('hidden');
        };

        const setCreditButtonToEditMode = () => {
            creditActionBtn.innerHTML = checkIconSVG;
            creditActionBtn.title = _('tooltip_save_entry');
            creditActionBtn.className = 'creditActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelCreditEditBtn.classList.remove('hidden');
        };
        setCreditButtonToAddMode(); 

        cancelCreditEditBtn.onclick = setCreditButtonToAddMode;

        creditActionBtn.onclick = () => {
            const historyId = historyIdInput.value;
            let memberId = memberToEdit.id; 
            const amount = parseFloat(purchaseAmountInput.value);
            const credits = parseFloat(creditsInput.value);
            if (historyId) {
                 if (isNaN(amount) || isNaN(credits) || amount < 0 || credits < 0) { showMessageBox(_('error_invalid_amount_and_credits'), 'error'); return; }
                const originalEntry = firebaseObjectToArray(memberToEdit.purchaseHistory).find(p => p.id === historyId);
                if (!originalEntry) { showMessageBox(_('error_find_original_entry_failed'), 'error'); return; }
                const creditDifference = credits - originalEntry.credits;
                const entryUpdate = { amount, credits, costPerCredit: amount / credits, lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}/purchaseHistory/${historyId}`).update(entryUpdate).then(() => database.ref(`/users/${memberId}`).transaction(user => {
                    if (user) { user.credits = (user.credits || 0) + creditDifference; user.initialCredits = (user.initialCredits || 0) + creditDifference; } return user;
                })).then(() => {
                    showMessageBox(_('success_purchase_entry_updated'), 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode); setCreditButtonToAddMode(); });
                }).catch(error => showMessageBox(_('error_update_failed').replace('{error}', error.message), 'error'));
            } else {
                if (isNaN(amount) || isNaN(credits) || amount <= 0 || credits <= 0) { showMessageBox(_('error_invalid_amount_and_credits_to_add'), 'error'); return; }
                const newPurchaseRef = database.ref(`/users/${memberId}/purchaseHistory`).push();
                const newPurchase = { date: new Date().toISOString(), amount, credits, costPerCredit: amount / credits, status: 'active', lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}`).transaction(user => { if (user) { user.credits = (user.credits || 0) + credits; user.initialCredits = (user.initialCredits || 0) + credits; } return user;
                }).then(() => newPurchaseRef.set(newPurchase)).then(() => {
                    showMessageBox(_('success_credit_entry_added'), 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode); setCreditButtonToAddMode(); });
                }).catch(error => showMessageBox(_('error_adding_credits').replace('{error}', error.message), 'error'));
            }
        };

        const autoCalculatePayment = () => {
            const months = parseInt(monthsPaidInput.value) || 0;
            const monthlyAmount = parseFloat(monthlyPlanAmountInput.value) || 0;
            paymentAmountInput.value = (months * monthlyAmount).toFixed(2);
        };
        monthsPaidInput.oninput = autoCalculatePayment;
        monthlyPlanAmountInput.addEventListener('input', autoCalculatePayment);

        const setPaymentButtonToAddMode = () => {
            paymentActionBtn.innerHTML = plusIconSVG;
            paymentActionBtn.title = _('tooltip_add_entry');
            paymentActionBtn.className = 'paymentActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            monthsPaidInput.value = '';
            paymentAmountInput.value = '';
            paymentHistoryIdInput.value = '';
            paymentHistoryContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelPaymentEditBtn.classList.add('hidden');
        };

        const setPaymentButtonToEditMode = () => {
            paymentActionBtn.innerHTML = checkIconSVG;
            paymentActionBtn.title = _('tooltip_save_entry');
            paymentActionBtn.className = 'paymentActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelPaymentEditBtn.classList.remove('hidden');
        };

        setPaymentButtonToAddMode();
        cancelPaymentEditBtn.onclick = setPaymentButtonToAddMode;

        paymentActionBtn.onclick = () => {
            const historyId = paymentHistoryIdInput.value;
            const memberId = memberToEdit.id;
            const monthsPaid = parseInt(monthsPaidInput.value);
            const amount = parseFloat(paymentAmountInput.value);

            if (isNaN(monthsPaid) || monthsPaid <= 0) { showMessageBox(_('error_months_paid_invalid'), 'error'); return; }
            if ((parseFloat(monthlyPlanAmountInput.value) || 0) <= 0) { showMessageBox(_('error_monthly_amount_required'), 'error'); return; }
            if (isNaN(amount) || amount < 0) { showMessageBox(_('error_payment_amount_invalid'), 'error'); return; }

            if (historyId) {
                const entryUpdate = { monthsPaid, amount, lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}/paymentHistory/${historyId}`).update(entryUpdate).then(() => {
                    showMessageBox(_('success_payment_entry_updated'), 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode); setPaymentButtonToAddMode(); });
                }).catch(error => showMessageBox(_('error_update_failed').replace('{error}', error.message), 'error'));
            } else {
                const newPaymentRef = database.ref(`/users/${memberId}/paymentHistory`).push();
                const newPayment = { date: new Date().toISOString(), monthsPaid, amount, status: 'active', lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                newPaymentRef.set(newPayment).then(() => {
                    showMessageBox(_('success_payment_entry_added'), 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode); setPaymentButtonToAddMode(); });
                }).catch(error => showMessageBox(_('error_adding_payment').replace('{error}', error.message), 'error'));
            }
        };

        form.querySelector('#memberModalId').value = memberToEdit.id;
        form.querySelector('#memberName').value = memberToEdit.name;
        form.querySelector('#memberEmail').value = memberToEdit.email;
        
        const { countryCode, number } = parsePhoneNumber(memberToEdit.phone);
        memberCountryCodeInput.value = countryCode;
        memberPhoneInput.value = number;
        
        form.querySelector('#monthlyPlan').checked = memberToEdit.monthlyPlan;
        expiryDateInput.value = memberToEdit.expiryDate;
        paymentDueDateInput.value = memberToEdit.paymentDueDate || '';

        const estimatedAttendanceInput = form.querySelector('#monthlyPlanEstimatedAttendance');
        const calculatedCreditValueContainer = form.querySelector('#calculatedCreditValueContainer');
        const calculatedCreditValueDisplay = form.querySelector('#calculatedCreditValueDisplay');

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
        
        monthlyPlanAmountInput.oninput = updateCalculatedValue;
        estimatedAttendanceInput.oninput = updateCalculatedValue;
        
        monthlyPlanAmountInput.value = memberToEdit.monthlyPlanAmount || '';
        planStartDateInput.value = memberToEdit.planStartDate || '';
        estimatedAttendanceInput.value = memberToEdit.monthlyPlanEstimatedAttendance || '';
        updateCalculatedValue();
        
        _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode);
        _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode);
        
        form.querySelector('#resetPasswordBtn').onclick = () => {
            auth.sendPasswordResetEmail(memberToEdit.email)
                .then(() => showMessageBox(_('success_password_reset_sent_to').replace('{email}', memberToEdit.email), 'success'))
                .catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'));
        };

        const monthlyPlanCheckbox = form.querySelector('#monthlyPlan');
        const creditFieldsContainer = form.querySelector('#creditFields');
        const monthlyPlanFieldsContainer = form.querySelector('#monthlyPlanFields');
        const updatePlanFields = () => { 
            const isMonthly = monthlyPlanCheckbox.checked;
            creditFieldsContainer.style.display = isMonthly ? 'none' : 'block';
            monthlyPlanFieldsContainer.style.display = isMonthly ? 'block' : 'none';
            if (isMonthly && !planStartDateInput.value) {
                planStartDateInput.value = getIsoDate(new Date());
            }
        };
        monthlyPlanCheckbox.onchange = updatePlanFields;
        updatePlanFields();

        form.onsubmit = (e) => handleMemberFormSubmit(e, memberToEdit);
        openModal(DOMElements.memberModal);
    }

    async function handleMemberFormSubmit(e, originalMember) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#memberModalId').value;
        if (!id) return;

        const latestMemberSnapshot = await database.ref(`/users/${id}`).once('value');
        const latestMember = latestMemberSnapshot.val();

        if (!latestMember) {
            showMessageBox(_('error_find_member_to_update_failed'), 'error');
            return;
        }

        const isMonthly = form.querySelector('#monthlyPlan').checked;

        let monthlyPlanAmount = 0;
        let estimatedAttendance = 0;
        let calculatedCreditValue = 0;

        if (isMonthly) {
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
        else {
            const hasCredits = (latestMember.credits > 0 || latestMember.initialCredits > 0);
            const expiryDate = form.querySelector('#expiryDate').value;

            if (hasCredits && !expiryDate) {
                showMessageBox(_('error_expiry_date_required'), 'error');
                return; 
            }
        }

        const countryCode = form.querySelector('#memberCountryCode').value.trim();
        const phoneNumber = form.querySelector('#memberPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);

        let updates = {};
        updates[`/users/${id}/name`] = form.querySelector('#memberName').value;
        updates[`/users/${id}/phone`] = fullPhoneNumber;
        updates[`/users/${id}/monthlyPlan`] = isMonthly;

        updates[`/users/${id}/monthlyPlanAmount`] = isMonthly ? monthlyPlanAmount : null;
        updates[`/users/${id}/planStartDate`] = isMonthly ? form.querySelector('#planStartDate').value : null;
        updates[`/users/${id}/paymentDueDate`] = isMonthly ? form.querySelector('#paymentDueDate').value || null : null;
        updates[`/users/${id}/monthlyPlanEstimatedAttendance`] = isMonthly ? estimatedAttendance : null;
        updates[`/users/${id}/monthlyCreditValue`] = isMonthly ? calculatedCreditValue : null;
        updates[`/users/${id}/expiryDate`] = !isMonthly ? form.querySelector('#expiryDate').value || null : null;
        
        database.ref().update(updates).then(() => {
            showMessageBox(_('success_member_updated'), 'success');
            closeModal(DOMElements.memberModal);
        }).catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'));
    }

    let html5QrCode = null; // To hold the scanner instance

    function openCheckInModal() {
        DOMElements.checkInModal.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-slate-800 mb-2">${_('check_in_title')}</h2>
                    <p class="text-slate-500 mb-4">${_('check_in_prompt')}</p>
                </div>
                
                <!-- START OF FIX: Simplified the nested divs into a single one -->
                <div id="qr-reader" class="bg-slate-900"></div>
                <!-- END OF FIX -->
                
                <div id="checkInResult" class="min-h-[4rem]"></div>
            </div>
        `;
        openModal(DOMElements.checkInModal);
        
        const onScanSuccess = (decodedText, decodedResult) => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.pause();
                handleCheckIn(decodedText);
            }
        };

        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, (errorMessage) => { 
        }).catch(err => {
            console.error("Unable to start QR scanner", err);
            const resultEl = document.getElementById("checkInResult");
            if(resultEl) resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">Could not start camera. Please check permissions.</div>`;
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

    async function handleCheckIn(memberId) {
        const resultEl = DOMElements.checkInModal.querySelector("#checkInResult");
        resultEl.innerHTML = `<p class="text-center font-semibold text-slate-500 p-4">${_('check_in_scanning')}</p>`;
        
        const member = appState.users.find(u => u.id === memberId);
        if (!member) {
            resultEl.innerHTML = `<div class="check-in-result-banner check-in-error">${_('error_member_not_found')}</div>`;
            setTimeout(() => { if (html5QrCode) html5QrCode.resume(); }, 2500);
            return;
        }

        const today = getIsoDate(new Date());
        
        const allBookingsToday = appState.classes.filter(cls => 
            cls.date === today && cls.bookedBy && cls.bookedBy[memberId]
        );
        
        // --- START OF FIX: Added the .sort() method here ---
        const unattendedBookingsToday = allBookingsToday
            .filter(cls => !(cls.attendedBy && cls.attendedBy[memberId]))
            .sort((a, b) => a.time.localeCompare(b.time)); // Sort by time, e.g., "09:00" before "18:00"
        // --- END OF FIX ---

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

        const checkInMember = (clsId) => {
            const cls = appState.classes.find(c => c.id === clsId);
            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
            
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
                    setTimeout(() => { if (html5QrCode) html5QrCode.resume(); resultEl.innerHTML = '';}, 2500);
                });
        };

        if (unattendedBookingsToday.length === 1) {
            checkInMember(unattendedBookingsToday[0].id);
        } else {
            const classOptions = unattendedBookingsToday.map(cls => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                return `<button class="w-full text-left p-3 bg-slate-100 hover:bg-indigo-100 rounded-lg" data-cls-id="${cls.id}">
                    <strong>${getSportTypeName(sportType)}</strong> at ${getTimeRange(cls.time, cls.duration)}
                </button>`;
            }).join('');
            
            resultEl.innerHTML = `
                <div class="p-4 bg-slate-50 rounded-lg">
                    <h4 class="font-bold text-center mb-2">${_('check_in_select_class_title')}</h4>
                    <p class="text-sm text-center text-slate-600 mb-4">${_('check_in_select_class_prompt').replace('{name}', member.name)}</p>
                    <div class="space-y-2">${classOptions}</div>
                </div>
            `;
            
            resultEl.querySelectorAll('button[data-cls-id]').forEach(btn => {
                btn.onclick = () => {
                    checkInMember(btn.dataset.clsId);
                };
            });
        }
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

    function calculateRevenueForBookings(bookings) {
        const bookingsByMember = bookings.reduce((acc, booking) => {
            const memberId = booking.member.id;
            if (!acc[memberId]) {
                acc[memberId] = [];
            }
            acc[memberId].push(booking.cls);
            return acc;
        }, {});

        let totalGrossRevenue = 0;
        const revenueByClsId = new Map();

        for (const memberId in bookingsByMember) {
            const member = appState.users.find(u => u.id === memberId);
            if (!member) continue;

            const memberClasses = bookingsByMember[memberId].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

            if (member.monthlyPlan) {
                for (const cls of memberClasses) {
                    const bookingInfo = cls.bookedBy[member.id];
                    
                    // --- MODIFIED: Use the frozen value from the booking object ---
                    // It checks for the new object format first, with a fallback for any old data.
                    const creditValueForThisBooking = (typeof bookingInfo === 'object' && bookingInfo.monthlyCreditValue)
                        ? bookingInfo.monthlyCreditValue
                        : (member.monthlyCreditValue || 0); // Fallback for legacy bookings
                    
                    const revenue = (cls.credits || 0) * creditValueForThisBooking;
                    totalGrossRevenue += revenue;
                    revenueByClsId.set(cls.id, (revenueByClsId.get(cls.id) || 0) + revenue);
                }
                continue;
            }

            // --- START: THE FIX IS HERE ---
            // We must filter out 'deleted' purchase entries before sorting for FIFO.
            const purchasePool = firebaseObjectToArray(member.purchaseHistory)
                .filter(p => p.status !== 'deleted') // <-- ADD THIS LINE
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(p => ({
                    ...p,
                    costPerCredit: p.costPerCredit !== undefined ? p.costPerCredit : 0,
                    remainingCredits: p.credits,
                }));
            // --- END: THE FIX IS HERE ---
            
            for (const cls of memberClasses) {
                let creditsToDeduct = cls.credits;
                let clsRevenue = 0;

                for (const purchase of purchasePool) {
                    if (creditsToDeduct <= 0) break;
                    if (purchase.remainingCredits <= 0) continue;

                    const deductFromThisPool = Math.min(creditsToDeduct, purchase.remainingCredits);
                    clsRevenue += deductFromThisPool * purchase.costPerCredit;
                    purchase.remainingCredits -= deductFromThisPool;
                    creditsToDeduct -= deductFromThisPool;
                }
                totalGrossRevenue += clsRevenue;
                revenueByClsId.set(cls.id, (revenueByClsId.get(cls.id) || 0) + clsRevenue);
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
            maxParticipants: parseInt(form.querySelector('#defaultMaxParticipants').value)
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

    function renderAdminPage(container) {
        const isOwner = appState.currentUser?.role === 'owner';
        const gridClasses = isOwner ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';

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

                <div class="grid ${gridClasses} gap-8 items-start">
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                            <h3 id="sportsHeader" class="text-2xl font-bold text-slate-800"></h3>
                            <div class="relative">
                                <input type="text" id="sportSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-40 pr-8" value="${appState.searchTerms.sports}">
                                <button id="clearSportSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden" aria-label="Clear search">
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <button id="addSportTypeBtn" class="w-full mb-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('admin_add_sport_type')}</button>
                        <div class="flex-grow">
                            <ul id="sportsList" class="admin-list space-y-2"></ul>
                        </div>
                        <div id="sportsPagination" class="flex justify-between items-center mt-4"></div>
                    </div>
                    ${isOwner ? `
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                            <h3 id="tutorsHeader" class="text-2xl font-bold text-slate-800"></h3>
                            <div class="relative">
                                <input type="text" id="tutorSearchInput" placeholder="${_('placeholder_search')}" class="form-input w-40 pr-8" value="${appState.searchTerms.tutors}">
                                <button id="clearTutorSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden" aria-label="Clear search">
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <button id="addTutorBtn" class="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('title_add_tutor')}</button>
                        <div class="flex-grow">
                             <ul id="tutorsList" class="admin-list space-y-2"></ul>
                        </div>
                        <div id="tutorsPagination" class="flex justify-between items-center mt-4"></div>
                    </div>
                    ` : ''}
                </div>
                <div class="card p-6 md:p-8">
                    <h3 data-lang-key="header_class_defaults" class="text-2xl font-bold text-slate-800 mb-4"></h3>
                    <p data-lang-key="desc_class_defaults" class="text-slate-500 mb-6"></p>
                    <form id="adminSettingsForm">
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label for="defaultTime" data-lang-key="label_start_time" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                <input type="text" id="defaultTime" class="form-input" pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" required>
                            </div>
                            <div>
                                <label for="defaultDuration" data-lang-key="label_duration" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                <input type="number" id="defaultDuration" class="form-input" min="15" step="5" required>
                            </div>
                            <div>
                                <label for="defaultCredits" data-lang-key="label_credits" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                <input type="number" id="defaultCredits" class="form-input" min="0" step="0.01" required>
                            </div>
                            <div>
                                <label for="defaultMaxParticipants" data-lang-key="label_max_participants" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                                <input type="number" id="defaultMaxParticipants" class="form-input" min="1" step="1" required>
                            </div>
                        </div>
                        <div class="flex justify-end mt-6">
                            <button type="submit" data-lang-key="btn_save_changes" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition"></button>
                        </div>
                    </form>
                </div>
            </div>`;
        
        setupLanguageToggles();
        renderAdminLists();
        
        container.querySelector('#addSportTypeBtn').onclick = () => openSportTypeModal();
        container.querySelector('#sportsList').addEventListener('click', handleAdminListClick);
        
        if (isOwner) {
            container.querySelector('#addTutorBtn').onclick = () => openTutorModal();
            container.querySelector('#tutorsList').addEventListener('click', handleAdminListClick);
        }
        
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
        
        setupSearchField('sportSearchInput', 'clearSportSearchBtn', 'sports', 'sports');
        if (isOwner) {
            setupSearchField('tutorSearchInput', 'clearTutorSearchBtn', 'tutors', 'tutors');
        }

        const settingsForm = container.querySelector('#adminSettingsForm');
        if (settingsForm) {
            const defaults = appState.studioSettings.clsDefaults;
            settingsForm.querySelector('#defaultTime').value = defaults.time;
            settingsForm.querySelector('#defaultDuration').value = defaults.duration;
            settingsForm.querySelector('#defaultCredits').value = defaults.credits;
            settingsForm.querySelector('#defaultMaxParticipants').value = defaults.maxParticipants;
            settingsForm.onsubmit = handleAdminSettingsSave;
        }

        updateUIText();
        setLanguage(appState.currentLanguage, false);
    }

    function renderAdminLists() {
        const { itemsPerPage } = appState;

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

            sportsList.innerHTML = paginatedSports.map(st => {
                const sportName = getSportTypeName(st); // Get the translated name
                return `
                <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                    <div class="flex items-center gap-3"><span class="h-5 w-5 rounded-full" style="background-color: ${st.color}"></span><span class="text-slate-700 font-semibold">${sportName}</span></div>
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="sportType" data-id="${st.id}">${_('btn_edit')}</button><button type="button" class="delete-btn font-semibold text-red-600" data-type="sportType" data-id="${st.id}" data-name="${sportName}">${_('btn_delete')}</button></div>
                </li>`
            }).join('') || `<li class="text-center text-slate-500 p-4">No sport types found.</li>`;
            
            renderPaginationControls(sportsPaginationContainer, sportPage, sportsTotalPages, filteredSports.length, itemsPerPage.sports, (newPage) => {
                appState.pagination.sports.page = newPage;
                renderAdminLists();
            });
        }

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

            tutorsList.innerHTML = paginatedTutors.map(t => {
                const skillsHtml = t.skills && t.skills.map(skill => {
                    const sportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                    // Use the getSportTypeName helper here
                    return sportType ? `<span class="text-xs font-medium me-2 px-2.5 py-0.5 rounded-full" style="background-color:${sportType.color}20; color:${sportType.color};">${getSportTypeName(sportType)}</span>` : '';
                }).join('');
                return `
                 <li class="flex justify-between items-center bg-slate-100 p-3 rounded-md min-h-[68px]">
                    <div>
                        <p class="text-slate-700 font-semibold">${t.name}</p>
                        <div class="flex flex-wrap gap-1 mt-1">${skillsHtml || ''}</div>
                    </div>
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="tutor" data-id="${t.id}">${_('btn_edit')}</button><button type="button" class="delete-btn font-semibold text-red-600" data-type="tutor" data-id="${t.id}" data-name="${t.name}">${_('btn_delete')}</button></div>
                </li>`
            }).join('') || `<li class="text-center text-slate-500 p-4">No tutors found.</li>`;
            
            renderPaginationControls(tutorsPaginationContainer, tutorPage, tutorsTotalPages, filteredTutors.length, itemsPerPage.tutors, (newPage) => {
                appState.pagination.tutors.page = newPage;
                renderAdminLists();
            });
        }
    }

    function handleAdminListClick(e) {
        const target = e.target.closest('.edit-btn, .delete-btn');
        if (!target) return;
        const { type, id, name } = target.dataset;

        if (target.classList.contains('edit-btn')) {
            if (type === 'sportType') openSportTypeModal(appState.sportTypes.find(st => st.id === id));
            if (type === 'tutor') openTutorModal(appState.tutors.find(t => t.id === id));
        } else if (target.classList.contains('delete-btn')) {
            // --- START: REFINED LOGIC WITH DATA INTEGRITY CHECK ---
            // First, check if the item is in use.
            if (type === 'sportType') {
                const isInUse = appState.classes.some(c => c.sportTypeId === id);
                if (isInUse) {
                    showMessageBox(_('error_cannot_delete_item_in_use').replace('{name}', name), 'error');
                    return; // Prevent deletion
                }
            }
            if (type === 'tutor') {
                const isInUse = appState.classes.some(c => c.tutorId === id);
                if (isInUse) {
                    showMessageBox(_('error_cannot_delete_item_in_use').replace('{name}', name), 'error');
                    return; // Prevent deletion
                }
            }

            // If not in use, proceed with the original confirmation and deletion logic.
            showConfirmation(
                _('confirm_delete_generic_title').replace('{type}', type), 
                _('confirm_delete_generic_desc').replace('{name}', name), 
                () => {
                if (type === 'sportType') {
                    database.ref('/sportTypes/' + id).remove();
                }
                if (type === 'tutor') {
                    database.ref('/tutors/' + id).remove();
                }
                showMessageBox(_('info_item_deleted').replace('{type}', type), 'info');
            });
            // --- END: REFINED LOGIC ---
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
                            <input type="text" id="sportTypeName" required class="form-input">
                        </div>
                        <div>
                            <label for="sportTypeNameZh" data-lang-key="admin_sport_type_name_zh" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                            <input type="text" id="sportTypeNameZh" class="form-input" placeholder="e.g., 瑜伽">
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
            form.querySelector('#sportTypeNameZh').value = sportTypeToEdit.name_zh || ''; // Populate the new field
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
        updateUIText(); // This will now translate the modal's text
    }

    function handleSportTypeFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#sportTypeModalId').value;
        const sportTypeData = {
            name: form.querySelector('#sportTypeName').value,
            name_zh: form.querySelector('#sportTypeNameZh').value || '', // Get the new field's value
            color: form.querySelector('#sportTypeColor').value
        };

        let promise;
        if (id) {
            // This is an EDIT operation, no change in pagination needed.
            promise = database.ref('/sportTypes/' + id).update(sportTypeData);
        } else {
            // --- START: NEW LOGIC FOR ADDING ---
            // Clear any search filters to show the full list.
            appState.searchTerms.sports = '';

            // Calculate which page the new item will be on.
            const totalItemsAfterAdd = appState.sportTypes.length + 1;
            const itemsPerPage = appState.itemsPerPage.sports;
            const lastPage = Math.ceil(totalItemsAfterAdd / itemsPerPage);

            // Update the state to navigate to the last page.
            appState.pagination.sports.page = lastPage;
            // --- END: NEW LOGIC FOR ADDING ---

            promise = database.ref('/sportTypes').push(sportTypeData);
        }
        promise.then(() => closeModal(DOMElements.sportTypeModal));
    }

    function openTutorModal(tutorToEdit = null) {
        DOMElements.tutorModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="tutorModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="tutorForm"><input type="hidden" id="tutorModalId"><div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div><label for="tutorName" data-lang-key="label_tutor_name" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="text" id="tutorName" required class="form-input"></div>
                       <div><label for="tutorEmail" data-lang-key="label_email" class="block text-slate-600 text-sm font-semibold mb-2"></label><input type="email" id="tutorEmail" class="form-input"></div>
                    </div>
                    <div>
                        <label for="tutorPhone" data-lang-key="label_mobile_number" class="block text-slate-600 text-sm font-semibold mb-2"></label>
                        <div class="flex gap-2">
                            <input type="text" id="tutorCountryCode" class="form-input w-24" data-lang-key="placeholder_country_code" placeholder="852">
                            <input type="tel" id="tutorPhone" class="form-input flex-grow">
                        </div>
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
                </div><div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg"></button></div></form>
            </div>`;
        const modal = DOMElements.tutorModal;
        const form = modal.querySelector('form');
        const skillsList = form.querySelector('#tutorSkillsList');
        skillsList.innerHTML = '';
        form.reset();

        const tutorCountryCodeInput = form.querySelector('#tutorCountryCode');
        const tutorPhoneInput = form.querySelector('#tutorPhone');

        tutorPhoneInput.oninput = (e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '');
            e.target.value = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ');
        };

        // --- START: Add this new logic block ---
        const employeeCheckbox = form.querySelector('#isEmployeeCheckbox');

        // This function handles enabling/disabling the salary fields
        const toggleSalaryFields = (isEmployee) => {
            form.querySelectorAll('.tutor-skill-row').forEach(row => {
                const salaryValueInput = row.querySelector('.salary-value-input');
                const salaryTypeButtons = row.querySelectorAll('.salary-type-btn');

                salaryValueInput.disabled = isEmployee;
                salaryTypeButtons.forEach(btn => btn.disabled = isEmployee);
                
                if (isEmployee) {
                    salaryValueInput.value = 0; // Set value to 0
                    salaryValueInput.removeAttribute('required'); // Explicitly remove the attribute
                } else {
                    salaryValueInput.setAttribute('required', ''); // Add the attribute back
                }
            });
        };
        
        // Add the event listener to the checkbox
        employeeCheckbox.onchange = () => toggleSalaryFields(employeeCheckbox.checked);
        // --- END: Add this new logic block ---

        if (tutorToEdit) {
            modal.querySelector('#tutorModalTitle').dataset.langKey = 'title_edit_tutor';
            modal.querySelector('.submit-btn').dataset.langKey = 'btn_save_changes';
            form.querySelector('#tutorModalId').value = tutorToEdit.id;
            form.querySelector('#tutorName').value = tutorToEdit.name;
            form.querySelector('#tutorEmail').value = tutorToEdit.email;
            
            const { countryCode, number } = parsePhoneNumber(tutorToEdit.phone);
            tutorCountryCodeInput.value = countryCode;
            tutorPhoneInput.value = number;

            // --- START: Corrected Logic ---
            // Set the checkbox value first.
            employeeCheckbox.checked = tutorToEdit.isEmployee || false;

            // Create all the skill rows from the tutor's data.
            if (tutorToEdit.skills) {
                tutorToEdit.skills.forEach(skill => addSkillRow(skillsList, skill));
            }
            
            // NOW, with all rows created, apply the correct enabled/disabled state.
            toggleSalaryFields(employeeCheckbox.checked);
            // --- END: Corrected Logic ---

        } else {
            modal.querySelector('#tutorModalTitle').dataset.langKey = 'title_add_tutor';
            modal.querySelector('.submit-btn').dataset.langKey = 'btn_save_changes';
            form.querySelector('#tutorModalId').value = '';
            addSkillRow(skillsList);
        }
        form.querySelector('#addTutorSkillBtn').onclick = () => {
            addSkillRow(skillsList);
            // Immediately apply the correct state to the new row
            toggleSalaryFields(employeeCheckbox.checked); 
        };
        form.onsubmit = handleTutorFormSubmit;
        openModal(modal);
        updateUIText();
    }

    function addSkillRow(container, skill = null) {
        const skillRow = document.createElement('div');
        skillRow.className = 'tutor-skill-row p-3 bg-slate-100 rounded-lg space-y-2 border border-slate-200 relative';
        const availableSports = appState.sportTypes.map(st => `<option value="${st.id}" ${skill && skill.sportTypeId === st.id ? 'selected' : ''}>${getSportTypeName(st)}</option>`).join('');

        skillRow.innerHTML = `
            <button type="button" class="remove-skill-btn absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 rounded-full text-xs flex items-center justify-center">&times;</button>
            <select class="form-select skill-type-select">${availableSports}</select>
            <div class="flex gap-1 rounded-lg bg-slate-200 p-1 salary-type-container">
                <button type="button" data-value="perCls" class="salary-type-btn flex-1 p-1 rounded-md text-xs">${_('salary_type_per_class')}</button>
                <button type="button" data-value="percentage" class="salary-type-btn flex-1 p-1 rounded-md text-xs">${_('salary_type_percentage')}</button>
                <button type="button" data-value="perHeadcount" class="salary-type-btn flex-1 p-1 rounded-md text-xs">${_('salary_type_per_head')}</button>
            </div>
            <div><input type="number" required class="form-input salary-value-input" min="0" step="1"></div>`;
        
        container.appendChild(skillRow);

        const salaryTypeContainer = skillRow.querySelector('.salary-type-container');
        const salaryValueInput = skillRow.querySelector('.salary-value-input');

        const updateRowSalaryUI = (type) => {
            salaryTypeContainer.querySelectorAll('.salary-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === type));
            salaryValueInput.placeholder = { 
                perCls: _('placeholder_salary_per_class'), 
                percentage: _('placeholder_salary_percentage'), 
                perHeadcount: _('placeholder_salary_per_head') 
            }[type];
        };

        salaryTypeContainer.onclick = (e) => { if(e.target.matches('.salary-type-btn')) updateRowSalaryUI(e.target.dataset.value); };

        const initialSalaryType = skill?.salaryType || 'perCls';
        updateRowSalaryUI(initialSalaryType);
        salaryValueInput.value = skill?.salaryValue || '';
        skillRow.querySelector('.remove-skill-btn').onclick = () => skillRow.remove();
    }

    function handleTutorFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#tutorModalId').value;
        const skills = [];
        form.querySelectorAll('.tutor-skill-row').forEach(row => {
            skills.push({
                sportTypeId: row.querySelector('.skill-type-select').value,
                salaryType: row.querySelector('.salary-type-btn.active').dataset.value,
                salaryValue: parseFloat(row.querySelector('.salary-value-input').value)
            });
        });

        // --- START: New validation logic for duplicate skills ---
        const uniqueSkills = new Set();
        for (const skill of skills) {
            if (uniqueSkills.has(skill.sportTypeId)) {
                // A duplicate was found.
                const duplicateSportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                const sportName = duplicateSportType ? duplicateSportType.name : 'A skill';
                showMessageBox(_('error_duplicate_skill_assignment').replace('{name}', sportName), 'error');
                return; // Abort the save operation.
            }
            uniqueSkills.add(skill.sportTypeId);
        }
        // --- END: New validation logic for duplicate skills ---

        const countryCode = form.querySelector('#tutorCountryCode').value.trim();
        const phoneNumber = form.querySelector('#tutorPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);

        const tutorData = { 
            name: form.querySelector('#tutorName').value, 
            email: form.querySelector('#tutorEmail').value,
            phone: fullPhoneNumber,
            skills,
            isEmployee: form.querySelector('#isEmployeeCheckbox').checked
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
        promise.then(() => closeModal(DOMElements.tutorModal));
    }

    async function renderSalaryPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_salary_overview')}</h2>
                    <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
                        <select id="salaryTutorSelect" class="form-select w-full sm:w-48"></select>
                        <select id="salaryPeriodSelect" class="form-select w-full sm:w-48"></select>
                        <button id="exportSalaryBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 w-full sm:w-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export')}
                        </button>
                    </div>
                </div>
                <div id="salaryDetailsContainer"><p class="text-center text-slate-500 p-8">${_('status_loading')}...</p></div>
            </div>`;
        
        const tutorSelect = container.querySelector('#salaryTutorSelect');
        const periodSelect = container.querySelector('#salaryPeriodSelect');
        const exportBtn = container.querySelector('#exportSalaryBtn');
        const exportBtnDefaultHTML = exportBtn.innerHTML;
        const detailsContainer = container.querySelector('#salaryDetailsContainer');
        
        populateDropdown(tutorSelect, appState.tutors);
        if (appState.selectedFilters.salaryTutorId) {
            tutorSelect.value = appState.selectedFilters.salaryTutorId;
        }

        const periodsSnapshot = await database.ref('/clsMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];
        
        if (periods.length > 0) {
            periodSelect.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            
            // --- START: NEW LOGIC BLOCK ---
            const currentMonthPeriod = getIsoDate(new Date()).substring(0, 7); // e.g., "2024-07"

            if (appState.selectedFilters.salaryPeriod && periods.includes(appState.selectedFilters.salaryPeriod)) {
                // Priority 1: Use the last selected filter if it's still valid
                periodSelect.value = appState.selectedFilters.salaryPeriod;
            } else if (periods.includes(currentMonthPeriod)) {
                // Priority 2: Default to the CURRENT month if it exists in the list
                periodSelect.value = currentMonthPeriod;
            } else {
                // Priority 3: Fallback to the newest available month
                periodSelect.value = periods[0];
            }
            // --- END: NEW LOGIC BLOCK ---

        } else {
            periodSelect.innerHTML = '<option value="">No Data</option>';
        }

        const onFilterChange = async () => {
            appState.selectedFilters.salaryTutorId = tutorSelect.value;
            appState.selectedFilters.salaryPeriod = periodSelect.value;
            
            const tutorId = tutorSelect.value;
            const period = periodSelect.value;

            if (!tutorId || !period) {
                detailsContainer.innerHTML = `<p class="text-center text-slate-500">Please select a tutor and period to view details.</p>`;
                return;
            }

            detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            
            const allClassesSnapshot = await database.ref('/classes').once('value');
            const allClassesForCalc = firebaseObjectToArray(allClassesSnapshot.val());

            renderSalaryDetails(allClassesForCalc);
        };

        tutorSelect.onchange = onFilterChange;
        periodSelect.onchange = onFilterChange;
        
        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = _('status_exporting');

            const tutorId = tutorSelect.value;
            const period = periodSelect.value;
            const tutor = appState.tutors.find(t => t.id === tutorId);

            if (!tutorId || !period || !tutor) {
                showMessageBox(_('error_select_tutor_and_period'), 'error');
                exportBtn.disabled = false;
                exportBtn.innerHTML = exportBtnDefaultHTML;
                return;
            }
            
            const allClassesSnapshot = await database.ref('/classes').once('value');
            const allClassesForExport = firebaseObjectToArray(allClassesSnapshot.val());
            
            const classesInPeriod = allClassesForExport.filter(c => c.tutorId === tutorId && c.date.startsWith(period));
            const sortedClassesInPeriod = [...classesInPeriod].sort((a,b) => a.date.localeCompare(b.date));

            const memberIdsInPeriod = new Set();
            sortedClassesInPeriod.forEach(cls => {
                if (cls.bookedBy) Object.keys(cls.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            });

            const allMemberBookings = [];
            if (memberIdsInPeriod.size > 0) {
                allClassesForExport.forEach(cls => {
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
            
            const { revenueByClsId } = calculateRevenueForBookings(allMemberBookings);
            
            const clsDetails = sortedClassesInPeriod.map(cls => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                let earnings = 0;
                let calculation = _('label_na');
                const attendeesCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                const clsGrossRevenue = revenueByClsId.get(cls.id) || 0;
                
                if (cls.payoutDetails && typeof cls.payoutDetails.salaryValue !== 'undefined') {
                    const { salaryType, salaryValue } = cls.payoutDetails;
                    if (salaryType === 'perCls') {
                        earnings = salaryValue;
                        calculation = _('salary_calculation_fixed').replace('{amount}', formatCurrency(salaryValue));
                    } else if (salaryType === 'percentage') {
                        earnings = clsGrossRevenue * (salaryValue / 100);
                        calculation = _('salary_calculation_percentage').replace('{revenue}', formatCurrency(clsGrossRevenue)).replace('{percentage}', salaryValue);
                    } else if (salaryType === 'perHeadcount') {
                        earnings = attendeesCount * salaryValue;
                        const attendeesUnit = _(attendeesCount === 1 ? 'salary_unit_attendee' : 'salary_unit_attendees');
                        calculation = _('salary_calculation_per_head')
                            .replace('{count}', attendeesCount)
                            .replace('{unit}', attendeesUnit)
                            .replace('{amount}', formatCurrency(salaryValue));
                    }
                }
                return { ...cls, sportTypeName: getSportTypeName(sportType), earnings, calculation, attendeesCount };
            });
            
            const exportData = clsDetails.map(c => ({
                [_('export_header_date')]: c.date,
                [_('export_header_class_name')]: c.sportTypeName,
                [_('export_header_attendees_capacity')]: `${c.attendeesCount}/${c.maxParticipants}`,
                [_('export_header_calculation')]: c.calculation,
                [_('export_header_earnings')]: c.earnings.toFixed(2)
            }));

            const tutorName = tutor.name.replace(/ /g, '_');
            const fileName = `salary-report_${tutorName}_${period}`;
            exportToCsv(fileName, exportData);

            exportBtn.disabled = false;
            exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg> Export`;
        };
        
        onFilterChange();
    }

    function renderSalaryDetails(allClasses) {
        const container = document.getElementById('salaryDetailsContainer');
        const tutorId = document.getElementById('salaryTutorSelect').value;
        const period = document.getElementById('salaryPeriodSelect').value;

        if(!tutorId || !period || !container) {
            if(container) container.innerHTML = `<p class="text-center text-slate-500">Please select a tutor and period to view details.</p>`;
            return;
        }

        const tutor = appState.tutors.find(t => t.id === tutorId);
        const classesInPeriod = allClasses.filter(c => c.tutorId === tutorId && c.date.startsWith(period));

        const memberIdsInPeriod = new Set();
        classesInPeriod.forEach(cls => {
            if (cls.bookedBy) {
                Object.keys(cls.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            }
        });

        const allMemberBookings = [];
        if (memberIdsInPeriod.size > 0) {
            allClasses.forEach(cls => {
                if (cls.bookedBy) {
                    for (const memberId of Object.keys(cls.bookedBy)) {
                        if (memberIdsInPeriod.has(memberId)) {
                            const member = appState.users.find(u => u.id === memberId);
                            if (member) {
                                allMemberBookings.push({ member, cls });
                            }
                        }
                    }
                }
            });
        }
        
        const { revenueByClsId } = calculateRevenueForBookings(allMemberBookings);
        
        let totalEarnings = 0;
        const clsDetails = classesInPeriod.map(cls => {
            const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
            let earnings = 0;
            let calculation = "N/A";
            const attendeesCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
            const clsGrossRevenue = revenueByClsId.get(cls.id) || 0;
            
            if (cls.payoutDetails && typeof cls.payoutDetails.salaryValue !== 'undefined') {
                const { salaryType, salaryValue } = cls.payoutDetails;
                if (salaryType === 'perCls') {
                    earnings = salaryValue;
                    calculation = _('salary_calculation_fixed').replace('{amount}', formatCurrency(salaryValue));
                } else if (salaryType === 'percentage') {
                    earnings = clsGrossRevenue * (salaryValue / 100);
                    calculation = `${formatCurrency(clsGrossRevenue)} x ${salaryValue}%`;
                } else if (salaryType === 'perHeadcount') {
                    earnings = attendeesCount * salaryValue;
                    const attendeesUnit = _(attendeesCount === 1 ? 'salary_unit_attendee' : 'salary_unit_attendees');
                    calculation = _('salary_calculation_per_head')
                        .replace('{count}', attendeesCount)
                        .replace('{unit}', attendeesUnit)
                        .replace('{amount}', formatCurrency(salaryValue));
                }
            }

            totalEarnings += earnings;
            return { ...cls, sportTypeName: getSportTypeName(sportType), earnings, calculation, attendeesCount };
        });

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

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_total_earnings')}</p><p class="text-3xl font-bold text-slate-800">${formatCurrency(totalEarnings)}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_classes_taught')}</p><p class="text-3xl font-bold text-slate-800">${classesInPeriod.length}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_total_attendees')}</p><p class="text-3xl font-bold text-slate-800">${clsDetails.reduce((acc, c) => acc + c.attendeesCount, 0)}</p></div>
            </div>
            <div>
                <h3 class="text-xl font-bold text-slate-700 mb-4">${_('header_detailed_breakdown')}</h3>
                <div class="overflow-x-auto"><table class="w-full text-left">
                    <thead>
                        <tr class="border-b">
                            <th class="p-2 sortable cursor-pointer" data-sort-key="date">${_('table_header_datetime')}<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="sportTypeName">${_('label_class')}<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="attendeesCount">${_('table_header_attendees')}<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="calculation">${_('table_header_calculation')}<span class="sort-icon"></span></th>
                            <th class="p-2 text-right sortable cursor-pointer" data-sort-key="earnings">${_('table_header_earnings')}<span class="sort-icon"></span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clsDetails.map(c => `
                            <tr class="border-b border-slate-100">
                                <td class="p-2">${formatShortDateWithYear(c.date)}</td>
                                <td class="p-2">${c.sportTypeName}</td>
                                <td class="p-2">${c.attendeesCount} / ${c.maxParticipants}</td>
                                <td class="p-2 text-sm text-slate-500">${c.calculation}</td>
                                <td class="p-2 text-right font-semibold">${formatCurrency(c.earnings)}</td>
                            </tr>`).join('') || `<tr><td colspan="5" class="text-center p-4 text-slate-500">${_('info_no_classes_in_period')}</td></tr>`}
                    </tbody>
                </table></div>
            </div>`;

            const sortState = appState.salarySort;

            container.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
                icon.className = 'sort-icon';
            });
            const activeHeader = container.querySelector(`th[data-sort-key="${sortState.key}"] .sort-icon`);
            if (activeHeader) {
                activeHeader.classList.add(sortState.direction);
            }

            container.querySelectorAll('th.sortable').forEach(header => {
                header.onclick = () => {
                    const newKey = header.dataset.sortKey;
                    if (sortState.key === newKey) {
                        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = newKey;
                        sortState.direction = 'asc';
                    }
                    renderSalaryDetails(allClasses);
                };
            });
    }

    async function renderStatisticsPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_studio_stats')}</h2>
                     <div class="flex gap-4">
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
        const statsContainer = container.querySelector('#statisticsContainer');
        const exportBtn = container.querySelector('#exportStatsBtn');
        const exportBtnDefaultHTML = exportBtn.innerHTML;
        const periods = { [_('filter_last_7_days')]: 7, [_('filter_last_30_days')]: 30, [_('filter_last_90_days')]: 90, [_('filter_all_time')]: Infinity };
        periodSelect.innerHTML = Object.keys(periods).map(p => `<option value="${periods[p]}">${p}</option>`).join('');
        
        let currentStatsForExport = {};

        const renderFilteredStats = async () => {
            statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">${_('status_loading')}...</p>`;
            const days = parseInt(periodSelect.value);
            const now = new Date();
            const startDate = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            const startDateIso = getIsoDate(startDate);
            
            const classesSnapshot = await database.ref('/classes').orderByChild('date').startAt(startDateIso).once('value');
            const filteredClasses = firebaseObjectToArray(classesSnapshot.val());

            if (filteredClasses.length === 0) {
                 statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">No data available for the selected period.</p>`;
                 currentStatsForExport = {}; 
                 return;
            }

            let totalBookings = 0, totalAttendees = 0;
            filteredClasses.forEach(cls => {
                totalBookings += cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                totalAttendees += cls.attendedBy ? Object.keys(cls.attendedBy).length : 0;
            });

            const totalCapacity = filteredClasses.reduce((sum, c) => sum + c.maxParticipants, 0);
            const avgFillRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;
            const attendanceRate = totalBookings > 0 ? (totalAttendees / totalBookings) * 100 : 0;
            
            const clsPopularity = rankByStat(filteredClasses, 'sportTypeId', 'bookedBy', appState.sportTypes);
            const tutorPopularity = rankByStat(filteredClasses, 'tutorId', 'bookedBy', appState.tutors);
            const peakTimes = rankTimeSlots(filteredClasses, 'desc');
            const lowTimes = rankTimeSlots(filteredClasses, 'asc');

            statsContainer.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div id="grossRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-slate-800">${_('status_loading')}...</p></div>
                    <div id="netRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_net_revenue')}</p><p class="text-2xl font-bold text-slate-800">${_('status_loading')}...</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_total_enrollments')}</p><p class="text-2xl font-bold text-slate-800">${totalBookings}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_attendance_rate')}</p><p class="text-2xl font-bold text-slate-800">${attendanceRate.toFixed(1)}%</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">${_('label_avg_fill_rate')}</p><p class="text-2xl font-bold text-slate-800">${avgFillRate.toFixed(1)}%</p></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${createRankingCard(_('header_popular_classes'), clsPopularity, _('label_enrollments'), '#6366f1', true)}
                    <div id="topEarningClassesCard">${createRankingCard(_('header_top_earning_classes'), [], _('label_revenue'), '#22c55e', true)}</div>
                    ${createRankingCard(_('header_top_tutors_enrollment'), tutorPopularity, _('label_enrollments'), '#6366f1')}
                    <div id="topTutorsByRevenueCard">${createRankingCard(_('header_top_tutors_revenue'), [], _('label_revenue'), '#22c55e')}</div>
                    ${createRankingCard(_('header_peak_times'), peakTimes, _('label_enrollments'), '#f97316')}
                    ${createRankingCard(_('header_low_times'), lowTimes, _('label_enrollments'), '#f97316')}
                </div>`;
            
            currentStatsForExport = {
                summary: [
                    { Metric: 'Time Period', Value: periodSelect.options[periodSelect.selectedIndex].text },
                    { Metric: 'Total Enrollments', Value: totalBookings },
                    { Metric: 'Attendance Rate (%)', Value: attendanceRate.toFixed(1) },
                    { Metric: 'Average Fill Rate (%)', Value: avgFillRate.toFixed(1) }
                ],
                clsPopularity: clsPopularity.map(item => ({ Ranking: 'Class by Enrollment', name: item.name, value: item.value })),
                tutorPopularity: tutorPopularity.map(item => ({ Ranking: 'Tutor by Enrollment', name: item.name, value: item.value })),
                peakTimes: peakTimes.map(item => ({ Ranking: 'Peak Time Slots', name: item.name, value: item.value })),
                lowTimes: lowTimes.map(item => ({ Ranking: 'Low Time Slots', name: item.name, value: item.value }))
            };
            
            await calculateAndRenderRevenueStats(filteredClasses); // <<< FIX #1: Added await
        };

        const calculateAndRenderRevenueStats = async (filteredClasses) => {
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
            
            const { revenueByClsId } = calculateRevenueForBookings(allRelevantBookings);
            
            let grossRevenue = 0, totalTutorPayout = 0;
            filteredClasses.forEach(cls => {
                const clsRevenue = revenueByClsId.get(cls.id) || 0;
                grossRevenue += clsRevenue;
                
                if (cls.payoutDetails && typeof cls.payoutDetails.salaryValue !== 'undefined') {
                    const { salaryType, salaryValue } = cls.payoutDetails;
                    if (salaryType === 'perCls') totalTutorPayout += salaryValue;
                    else if (salaryType === 'perHeadcount') totalTutorPayout += (cls.bookedBy ? Object.keys(cls.bookedBy).length : 0) * salaryValue;
                    else if (salaryType === 'percentage') totalTutorPayout += clsRevenue * (salaryValue / 100);
                }
            });

            const totalNetRevenue = grossRevenue - totalTutorPayout;
            const topClassesByRevenue = rankByGroupedRevenue(filteredClasses, revenueByClsId, appState.sportTypes, 'sportTypeId');
            const topTutorsByRevenue = rankByGroupedRevenue(filteredClasses, revenueByClsId, appState.tutors, 'tutorId');

            const grossRevenueCard = document.getElementById('grossRevenueCard');
            if (grossRevenueCard) grossRevenueCard.innerHTML = `<p class="text-sm text-slate-500">${_('label_gross_revenue')}</p><p class="text-2xl font-bold text-slate-800">${formatCurrency(grossRevenue)}</p>`;

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
                { Metric: 'Gross Revenue', Value: formatCurrency(grossRevenue) },
                { Metric: 'Net Revenue', Value: formatCurrency(totalNetRevenue) }
            );
            currentStatsForExport.topClassesByRevenue = topClassesByRevenue.map(item => ({ Ranking: 'Class by Revenue', name: item.name, value: item.value }));
            currentStatsForExport.topTutorsByRevenue = topTutorsByRevenue.map(item => ({ Ranking: 'Tutor by Revenue', name: item.name, value: item.value }));
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

            // This is the main fix: Standardize ALL rows to a 3-column format.
            const translatedSummary = [
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_time_period'),
                    [_('export_header_value')]: periodSelect.options[periodSelect.selectedIndex].text
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_gross_revenue'),
                    [_('export_header_value')]: summary.find(s => s.Metric.includes('Gross'))?.Value || 'N/A'
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_net_revenue'),
                    [_('export_header_value')]: summary.find(s => s.Metric.includes('Net'))?.Value || 'N/A'
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_total_enrollments'),
                    [_('export_header_value')]: summary.find(s => s.Metric.includes('Enrollments'))?.Value || 'N/A'
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_attendance_rate'),
                    [_('export_header_value')]: summary.find(s => s.Metric.includes('Attendance'))?.Value || 'N/A'
                },
                {
                    [_('export_header_category')]: _('title_studio_stats'),
                    [_('export_header_name')]: _('export_cat_avg_fill_rate'),
                    [_('export_header_value')]: summary.find(s => s.Metric.includes('Fill Rate'))?.Value || 'N/A'
                },
            ];

            const createTranslatedSection = (title, data) => {
                if (!data || data.length === 0) return [];
                return [
                    // Spacer row with the same 3 keys
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
                ...createTranslatedSection(_('export_cat_class_by_enrollment'), clsPopularity),
                ...createTranslatedSection(_('export_cat_class_by_revenue'), topClassesByRevenue),
                ...createTranslatedSection(_('export_cat_tutor_by_enrollment'), tutorPopularity),
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

        periodSelect.onchange = renderFilteredStats;
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

    function rankTimeSlots(classes, sortDirection = 'desc') {
        const timeSlots = {};
        classes.forEach(c => {
            const hour = c.time.split(':')[0];
            // Using a simple 1-hour slot for clarity
            const slot = `${String(hour).padStart(2, '0')}:00 - ${String(parseInt(hour) + 1).padStart(2, '0')}:00`;
            const bookings = c.bookedBy ? Object.keys(c.bookedBy).length : 0;
            timeSlots[slot] = (timeSlots[slot] || 0) + bookings;
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
                            <div class="bar-chart-bar h-2.5 rounded-full" style="width: ${max > 0 ? (item.value / max) * 100 : 0}%; background-color: ${color};"></div>
                        </div>
                    </div>
                `).join('') : '<p class="text-slate-500 text-sm">No data to display for this period.</p>'}
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
        container.innerHTML = CLS_COLORS.map((color, index) => `<input type="radio" name="color" id="color-${index}" value="${color}" class="color-swatch-radio" ${color === colorInput.value ? 'checked' : ''}><label for="color-${index}" class="color-swatch-label" style="background-color: ${color};"></label>`).join('');
        container.onchange = e => { if (e.target.name === 'color') colorInput.value = e.target.value; };
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
        const isOwner = appState.currentUser?.role === 'owner';

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">${_('title_all_classes')} <span id="classesCount" class="text-xl font-semibold text-slate-500"></span></h2>
                    <div class="flex flex-wrap gap-4">
                        <select id="classesMonthFilter" class="form-select w-48"></select>
                        <select id="classesSportTypeFilter" class="form-select w-48"></select>
                        <select id="classesTutorFilter" class="form-select w-48"></select>
                        ${isOwner ? `
                        <button id="exportClassesBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            ${_('btn_export')}
                        </button>
                        ` : ''}
                        <button id="addClsBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">${_('btn_add_class')}</button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left min-w-[600px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 w-12">#</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="date">${_('table_header_datetime')}<span class="sort-icon"></span></th>
                                <th class="p-2">${_('label_class')}</th>
                                <th class="p-2">${_('label_tutor')}</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="credits">${_('label_credits')}<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="attendees">${_('table_header_attendees')}<span class="sort-icon"></span></th>
                                <th class="p-2"></th>
                            </tr>
                        </thead>
                        <tbody id="classesTableBody"></tbody>
                    </table>
                </div>
                <div id="classesPagination" class="flex justify-between items-center mt-4"></div>
            </div>`;
        
        const monthFilter = container.querySelector('#classesMonthFilter');
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
            monthFilter.innerHTML = '<option value="">No Months Available</option>';
        }

        populateSportTypeFilter(sportTypeFilter);
        sportTypeFilter.value = appState.selectedFilters.classesSportTypeId || 'all';
        populateTutorFilter(tutorFilter, sportTypeFilter.value);
        tutorFilter.value = appState.selectedFilters.classesTutorId || 'all';
        
        const fetchAndRenderClasses = async () => {
            const selectedMonth = monthFilter.value;
            if (!selectedMonth) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">${_('status_please_select_month')}</td></tr>`;
                container.querySelector('#classesCount').textContent = '';
                container.querySelector('#classesPagination').innerHTML = '';
                return;
            }

            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">${_('status_loading_classes_for_month').replace('{month}', selectedMonth)}</td></tr>`;
            
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`;
            const snapshot = await database.ref('/classes').orderByChild('date').startAt(startOfMonth).endAt(endOfMonth).once('value');

            monthlyClasses = firebaseObjectToArray(snapshot.val());
            appState.pagination.classes.page = 1;
            updateClassesTable();
        };

        const updateClassesTable = () => {
            const paginationContainer = container.querySelector('#classesPagination');
            const classesCountEl = container.querySelector('#classesCount');
            const selectedSportType = sportTypeFilter.value;
            const selectedTutor = tutorFilter.value;

            let filteredClasses = monthlyClasses;
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
                    case 'attendees':
                        valA = a.bookedBy ? Object.keys(a.bookedBy).length : 0;
                        valB = b.bookedBy ? Object.keys(b.bookedBy).length : 0;
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

            const paginatedClasses = filteredClasses.slice((page - 1) * itemsPerPage.classes, page * itemsPerPage.classes);
            
            let lastDate = null;
            tableBody.innerHTML = paginatedClasses.map((cls, index) => {
                const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                const entryNumber = (page - 1) * itemsPerPage.classes + index + 1;
                const bookingsCount = cls.bookedBy ? Object.keys(cls.bookedBy).length : 0;
                const isNewDay = cls.date !== lastDate;
                lastDate = cls.date;

                return `
                    <tr class="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isNewDay && index > 0 ? 'day-divider' : ''}" data-date="${cls.date}">
                        <td class="p-2 text-slate-500 font-semibold">${entryNumber}</td>
                        <td class="p-2">${formatShortDateWithYear(cls.date)}<br><span class="text-sm text-slate-500">${getTimeRange(cls.time, cls.duration)}</span></td>
                        <td class="p-2 font-semibold">${getSportTypeName(sportType)}</td>
                        <td class="p-2">${tutor?.name || 'Unknown'}</td>
                        <td class="p-2">${cls.credits}</td>
                        <td class="p-2">${bookingsCount}/${cls.maxParticipants}</td>
                        <td class="p-2 text-right space-x-2">
                            <button class="edit-cls-btn font-semibold text-indigo-600" data-id="${cls.id}">${_('btn_edit')}</button>
                            <button class="delete-cls-btn font-semibold text-red-600" data-id="${cls.id}">${_('btn_delete')}</button>
                        </td>
                    </tr>`;
            }).join('') || `<tr><td colspan="7" class="text-center p-4 text-slate-500">No classes match the selected filters for this month.</td></tr>`;

            renderPaginationControls(paginationContainer, page, totalPages, filteredClasses.length, itemsPerPage.classes, (newPage) => {
                appState.pagination.classes.page = newPage;
                updateClassesTable();
            });
        };

        monthFilter.onchange = () => {
            appState.selectedFilters.classesPeriod = monthFilter.value;
            fetchAndRenderClasses();
        };
        sportTypeFilter.onchange = () => {
            appState.selectedFilters.classesSportTypeId = sportTypeFilter.value;
            populateTutorFilter(tutorFilter, sportTypeFilter.value);
            tutorFilter.value = 'all';
            appState.selectedFilters.classesTutorId = 'all';
            updateClassesTable();
        };
        tutorFilter.onchange = () => {
            appState.selectedFilters.classesTutorId = tutorFilter.value;
            updateClassesTable();
        };
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
        
        addClsBtn.onclick = () => openClsModal(getIsoDate(new Date()));
        
        if (isOwner) {
            exportBtn.onclick = () => {
                exportBtn.disabled = true;
                exportBtn.innerHTML = _('status_exporting');
                
                const classesToExport = monthlyClasses.sort((a, b) => {
                    const dateComparison = a.date.localeCompare(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    return a.time.localeCompare(b.time);
                });

                const exportData = classesToExport.map(cls => {
                    const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                    const tutor = appState.tutors.find(t => t.id === cls.tutorId);
                    const timeRange = getTimeRange(cls.time, cls.duration).split(' - ');
                    return {
                        [_('export_header_date')]: cls.date,
                        [_('export_header_start_time')]: timeRange[0] || '',
                        [_('export_header_end_time')]: timeRange[1] || '',
                        [_('export_header_class_name')]: getSportTypeName(sportType),
                        [_('export_header_tutor_name')]: tutor?.name || _('unknown_tutor'),
                        [_('export_header_credits')]: cls.credits,
                        [_('export_header_booked_count')]: cls.bookedBy ? Object.keys(cls.bookedBy).length : 0,
                        [_('export_header_capacity')]: cls.maxParticipants
                    };
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
                if (date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const targetDate = new Date(date);
                    targetDate.setHours(0, 0, 0, 0);

                    const daysDifference = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));
                    const currentLookBack = appState.ownerPastDaysVisible;

                    // --- START OF FIX ---
                    // Check if the required look-back period is greater than what we currently have.
                    if (daysDifference > currentLookBack) {
                        // If it is, update the state to expand the view.
                        appState.ownerPastDaysVisible = daysDifference + 7;

                        // This is the crucial step: Re-initialize the data listeners.
                        // This tells Firebase to fetch data for the newly visible past dates.
                        detachDataListeners();
                        initDataListeners();
                    }
                    // --- END OF FIX ---

                    appState.scrollToDateOnNextLoad = date;
                    switchPage('schedule');
                }
            }
        });

        if (monthFilter.value) {
            fetchAndRenderClasses();
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">${_('info_no_classes_found_in_db')}</td></tr>`;
            container.querySelector('#classesCount').textContent = '';
            container.querySelector('#classesPagination').innerHTML = '';
        }
    }

    async function openMemberBookingHistoryModal(member) {
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
            
            let bookingCount = 0;
            let memberBookings = [];

            if (memberBookingsSnapshot.exists()) {
                const bookedClsIds = Object.keys(memberBookingsSnapshot.val());
                bookingCount = bookedClsIds.length;

                const clsPromises = bookedClsIds.map(clsId => database.ref(`/classes/${clsId}`).once('value'));
                const clsSnapshots = await Promise.all(clsPromises);

                // --- START OF FIX: Applying multi-level sorting logic ---
                memberBookings = clsSnapshots
                    .map(snap => ({ id: snap.key, ...snap.val() }))
                    .filter(cls => cls.date)
                    .sort((a, b) => {
                        // Primary Sort: By date in descending order (newest day first)
                        const dateComparison = b.date.localeCompare(a.date);
                        if (dateComparison !== 0) {
                            return dateComparison;
                        }
                        // Secondary Sort: If dates are the same, sort by time in ascending order (earliest class first)
                        return a.time.localeCompare(b.time);
                    });
                // --- END OF FIX ---
            }
            
            const historyListHTML = memberBookings.length === 0 ? `<p class="text-slate-500 text-center p-8">${_('no_booking_history')}</p>` :
                memberBookings.map(cls => {
                    const sportType = appState.sportTypes.find(st => st.id === cls.sportTypeId);
                    const isAttended = cls.attendedBy && cls.attendedBy[member.id];
                    const bookingDetails = cls.bookedBy[member.id];
                    const creditsUsed = bookingDetails.creditsPaid;
                    return `<div class="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="font-bold text-slate-800">${getSportTypeName(sportType)}</p>
                            <p class="text-sm text-slate-500">${_('template_datetime_at').replace('{date}', formatShortDateWithYear(cls.date)).replace('{time}', getTimeRange(cls.time, cls.duration))}</p>
                            <p class="text-xs text-slate-600">${_('label_credits_used')} ${creditsUsed}</p>
                            <p class="text-xs text-slate-500">${formatBookingAuditText(bookingDetails)}</p>
                        </div>
                        ${isAttended 
                            ? `<span class="text-sm font-semibold text-green-600">${_('status_completed')}</span>`
                            : `<button class="cancel-booking-btn-member-history text-sm font-semibold text-red-600 hover:text-red-800" data-cls-id="${cls.id}" data-member-id="${member.id}">${_('btn_cancel')}</button>`
                        }
                    </div>`
                }).join('');

            DOMElements.memberBookingHistoryModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative open">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${_('header_member_booking_history').replace('{name}', member.name)} (${bookingCount})</h2>
                    <p class="text-center text-slate-500 mb-6">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                    <div class="space-y-3 max-h-[60vh] overflow-y-auto" id="history-content-area">
                        ${historyListHTML}
                    </div>
                </div>
            `;

            DOMElements.memberBookingHistoryModal.querySelectorAll('.cancel-booking-btn-member-history').forEach(btn => {
                btn.onclick = () => {
                    const cls = memberBookings.find(c => c.id === btn.dataset.clsId);
                    const memberId = btn.dataset.memberId;
                    handleCancelBooking(cls, memberId);
                };
            });

        } catch (error) {
            console.error("Error fetching member booking history:", error);
            const historyContentArea = DOMElements.memberBookingHistoryModal.querySelector('#history-content-area');
            if (historyContentArea) {
                historyContentArea.innerHTML = `<p class="text-center text-red-500 p-8">${_('error_could_not_load_booking_history')}</p>`;
            }
        }
    }

    // --- Firebase Listeners ---
    const initDataListeners = () => {
        // --- START: MODIFIED LOGIC ---
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;
        // --- END: MODIFIED LOGIC ---

        // Detach any old listeners before setting up new ones.
        detachDataListeners();

        // This function now acts as a simple router.
        // --- START: MODIFIED LOGIC ---
        if (isAdmin) { // This now correctly routes both 'owner' and 'staff'
            initOwnerListeners();
        } else {
            initMemberListeners();
        }
        // --- END: MODIFIED LOGIC ---
    };

    // --- START: NEW OWNER-SPECIFIC LISTENER FUNCTION ---
    const initOwnerListeners = () => {
        // --- Listeners for foundational data (settings, current user profile, etc.) ---
        const nonUserRefs = {
            tutors: database.ref('/tutors'),
            sportTypes: database.ref('/sportTypes'),
            studioSettings: database.ref('/studioSettings'),
            currentUser: database.ref('/users/' + appState.currentUser.id),
        };

        Object.entries(nonUserRefs).forEach(([key, ref]) => {
            dataListeners[key] = (snapshot) => {
                const val = snapshot.val();
                if (key === 'currentUser') {
                    appState.currentUser = { ...appState.currentUser, ...val };
                } else if (key === 'studioSettings') {
                    if (val) appState.studioSettings = { ...appState.studioSettings, ...val, clsDefaults: { ...appState.studioSettings.clsDefaults, ...(val.clsDefaults || {}) } };
                } else {
                    appState[key] = firebaseObjectToArray(val);
                }
                renderCurrentPage();
            };
            ref.on('value', dataListeners[key], (error) => console.error(`Listener error on /${key}`, error));
        });

        const usersRef = database.ref('/users');
        dataListeners.users = (snapshot) => {
            appState.users = firebaseObjectToArray(snapshot.val());
            if (appState.activePage !== 'schedule') {
                renderCurrentPage();
            }
        };
        usersRef.on('value', dataListeners.users, (error) => console.error(`Listener error on /users`, error));


        // --- Surgical Class Listening Strategy for Owners ---
        let initialLoadComplete = false;
        const today = new Date();
        const daysToLookBack = appState.ownerPastDaysVisible || 0;
        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCDate(today.getUTCDate() - daysToLookBack);
        const startIso = getIsoDate(startDate);
        
        activeClassesRef = database.ref('/classes').orderByChild('date').startAt(startIso);

        activeClassesRef.once('value', (snapshot) => {
            appState.classes = firebaseObjectToArray(snapshot.val());
            renderCurrentPage();
            initialLoadComplete = true;
        }).catch(error => console.error("Initial class fetch failed for owner:", error));


        // --- START: MODIFIED LISTENER LOGIC ---
        activeClassesRef.on('child_changed', (snapshot) => {
            if (!initialLoadComplete) return;

            const updatedCls = { id: snapshot.key, ...snapshot.val() };
            const oldCls = appState.classes.find(c => c.id === updatedCls.id);
            
            // This is the intelligent check
            const timeHasChanged = oldCls && updatedCls.time !== oldCls.time;
            
            // First, update the global state regardless of what changed
            const index = appState.classes.findIndex(c => c.id === updatedCls.id);
            if (index > -1) appState.classes[index] = updatedCls; else appState.classes.push(updatedCls);

            // Now, decide how to update the UI
            if (timeHasChanged) {
                // If time changed, re-sort the entire day column
                _reSortDayColumn(updatedCls.date);
            } else {
                // Otherwise, perform the simple, surgical replacement (no flicker)
                const clsElement = document.getElementById(updatedCls.id);
                if (clsElement) {
                    clsElement.replaceWith(createClsElement(updatedCls));
                }
                
                // Show booking notification if it's a new booking
                if (oldCls) {
                    const oldBookedIds = Object.keys(oldCls.bookedBy || {});
                    const newBookedIds = Object.keys(updatedCls.bookedBy || {});
                    if (newBookedIds.length > oldBookedIds.length) {
                        const newMemberId = newBookedIds.find(id => !oldBookedIds.includes(id));
                        if (newMemberId) {
                            const member = appState.users.find(u => u.id === newMemberId);
                            const sportType = appState.sportTypes.find(st => st.id === updatedCls.sportTypeId);
                            if (member && sportType) {
                                showBookingNotification({ memberName: member.name, clsName: sportType.name, clsTime: updatedCls.time, duration: updatedCls.duration });
                            }
                        }
                    }
                }
            }
        });
        // --- END: MODIFIED LISTENER LOGIC ---

        activeClassesRef.on('child_added', (snapshot) => {
            if (!initialLoadComplete) return;

            const newCls = { id: snapshot.key, ...snapshot.val() };
            if (!appState.classes.some(c => c.id === newCls.id)) {
                appState.classes.push(newCls);
                // A full re-sort of the day is best here to place the new class correctly
                _reSortDayColumn(newCls.date);
            }
        });

        activeClassesRef.on('child_removed', (snapshot) => {
            if (!initialLoadComplete) return;
            const removedClsId = snapshot.key;
            appState.classes = appState.classes.filter(c => c.id !== removedClsId);
            const clsElement = document.getElementById(removedClsId);
            if (clsElement) clsElement.remove();
        });
    };
    // --- END: NEW OWNER-SPECIFIC LISTENER FUNCTION ---

    // --- START: NEW MEMBER-SPECIFIC LISTENER FUNCTION ---
    const initMemberListeners = () => {
        // --- Listeners for static-like data (tutors, sports, user profile) ---
        const refs = {
            tutors: database.ref('/tutors'),
            sportTypes: database.ref('/sportTypes'),
            currentUser: database.ref('/users/' + appState.currentUser.id),
        };

        Object.entries(refs).forEach(([key, ref]) => {
            dataListeners[key] = (snapshot) => {
                const val = snapshot.val();
                if (key === 'currentUser') {
                    appState.currentUser = { ...appState.currentUser, ...val };
                    // A full re-render is okay here as it's less frequent (e.g., credit change)
                    renderCurrentPage();
                } else {
                    appState[key] = firebaseObjectToArray(val);
                }
            };
            ref.on('value', dataListeners[key], (error) => console.error(`Listener error on /${key}`, error));
        });

        // --- NEW, SURGICAL Class Listening Strategy for Members ---
        let initialLoadComplete = false;
        const memberId = appState.currentUser.id;
        const todayIso = getIsoDate(new Date());
        activeClassesRef = database.ref('/classes').orderByChild('date').startAt(todayIso);

        // PHASE 1: Perform a single, initial fetch to render the page quickly.
        const initialFetchAndRender = async () => {
            try {
                // Fetch past and future classes in parallel for speed.
                const pastBookingsPromise = database.ref(`/memberBookings/${memberId}`).once('value').then(snap => {
                    if (!snap.exists()) return [];
                    const clsIds = Object.keys(snap.val());
                    const pastClsPromises = clsIds.map(id => database.ref(`/classes/${id}`).once('value'));
                    return Promise.all(pastClsPromises);
                });

                const futureClassesPromise = activeClassesRef.once('value');
                const [pastClsSnapshots, futureClassesSnapshot] = await Promise.all([pastBookingsPromise, futureClassesPromise]);

                const pastClasses = pastClsSnapshots.map(snap => ({ id: snap.key, ...snap.val() })).filter(c => c.date && c.date < todayIso);
                const futureClasses = firebaseObjectToArray(futureClassesSnapshot.val());

                // Combine and de-duplicate using a Map.
                const allClassesMap = new Map();
                futureClasses.forEach(cls => allClassesMap.set(cls.id, cls));
                pastClasses.forEach(cls => allClassesMap.set(cls.id, cls));
                appState.classes = Array.from(allClassesMap.values());

                // Render the entire page ONCE.
                renderCurrentPage();
                initialLoadComplete = true;

            } catch (error) {
                console.error("Initial class fetch failed for member:", error);
            }
        };

        // PHASE 2: Attach live listeners for surgical updates AFTER the initial render.
        
        // --- START: MODIFIED LISTENER LOGIC ---
        // This listener is now smarter, just like the owner's version.
        activeClassesRef.on('child_changed', (snapshot) => {
            if (!initialLoadComplete) return;

            const updatedCls = { id: snapshot.key, ...snapshot.val() };
            const oldCls = appState.classes.find(c => c.id === updatedCls.id);

            // Check if the time specifically has changed.
            const timeHasChanged = oldCls && updatedCls.time !== oldCls.time;
            
            // First, always update the central app state.
            const index = appState.classes.findIndex(c => c.id === updatedCls.id);
            if (index > -1) appState.classes[index] = updatedCls; else appState.classes.push(updatedCls);

            // Now, decide how to update the UI based on what changed.
            if (timeHasChanged) {
                // If the time was edited by an admin, re-sort the entire day column.
                _reSortDayColumn(updatedCls.date);
            } else {
                // For any other change (like participant count), just replace the single element.
                const clsElement = document.getElementById(updatedCls.id);
                if (clsElement) {
                    const newClsElement = createClsElement(updatedCls);
                    clsElement.replaceWith(newClsElement);
                }
            }
        });

        // This listener now correctly re-sorts the day when a new class is added.
        activeClassesRef.on('child_added', (snapshot) => {
            if (!initialLoadComplete) return;

            const newCls = { id: snapshot.key, ...snapshot.val() };
            if (!appState.classes.some(c => c.id === newCls.id)) {
                appState.classes.push(newCls);
                // Re-sort the day column to place the new class in the correct time slot.
                _reSortDayColumn(newCls.date);
            }
        });
        // --- END: MODIFIED LISTENER LOGIC ---

        activeClassesRef.on('child_removed', (snapshot) => {
            if (!initialLoadComplete) return;

            const removedClsId = snapshot.key;
            appState.classes = appState.classes.filter(c => c.id !== removedClsId);
            
            const clsElement = document.getElementById(removedClsId);
            if (clsElement) {
                clsElement.remove();
            }
        });

        // Kick off the whole process.
        initialFetchAndRender();
    };
    // --- END: NEW MEMBER-SPECIFIC LISTENER FUNCTION ---

    const detachDataListeners = () => {
        if (activeClassesRef) {
            activeClassesRef.off();
        }
        activeClassesRef = null;

        // --- START OF FIX: Clean up member-specific check-in listeners ---
        Object.values(memberCheckInListeners).forEach(({ ref, listener }) => ref.off('value', listener));
        memberCheckInListeners = {};
        // --- END OF FIX ---

        Object.entries(dataListeners).forEach(([key, listenerInfo]) => {
            if (key !== 'classes') { 
                let path = `/${key}`;
                if (key === 'currentUser' && appState.currentUser) {
                    path = `/users/${appState.currentUser.id}`;
                }
                database.ref(path).off('value', listenerInfo);
            }
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
                    const userData = snapshot.val(); // <-- ADD THIS LINE
                    appState.currentUser = { id: user.uid, ...userData }; // <-- MODIFY THIS LINE

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
            DOMElements.appWrapper.classList.add('hidden');
            DOMElements.authPage.classList.remove('hidden');
        }
    };
    
    const setupAuthFormListeners = () => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const showRegisterLink = document.getElementById('showRegisterLink');
        const showLoginLink = document.getElementById('showLoginLink');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const loginContainer = document.getElementById('login-form-container');
        const registerContainer = document.getElementById('register-form-container');
        
        // Get elements from within the registration form
        const registerPasswordInput = registerForm.querySelector('#registerPassword');
        const confirmPasswordInput = registerForm.querySelector('#confirmRegisterPassword');
        const strengthContainer = registerForm.querySelector('.password-strength-container'); // Use class selector

        setupLanguageToggles();

        loginForm.onsubmit = (e) => {
            e.preventDefault();
            handleLogin(loginForm.querySelector('#loginEmail').value, loginForm.querySelector('#loginPassword').value);
        };

        registerForm.onsubmit = (e) => {
            e.preventDefault();
            const formData = {
                name: registerForm.querySelector('#registerName').value,
                email: registerForm.querySelector('#registerEmail').value,
                password: registerPasswordInput.value,
                confirmPassword: confirmPasswordInput.value,
                phone: constructPhoneNumber(
                    registerForm.querySelector('#registerCountryCode').value,
                    registerForm.querySelector('#registerPhone').value
                )
            };
            handleRegistration(formData);
        };
        
        registerPasswordInput.addEventListener('input', () => {
            if (strengthContainer) {
                strengthContainer.classList.toggle('hidden', !registerPasswordInput.value);
                // Pass the form element to the reusable function
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
        
        showRegisterLink.onclick = (e) => {
            e.preventDefault();
            loginContainer.classList.add('hidden');
            registerContainer.classList.remove('hidden');
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
                auth.sendPasswordResetEmail(email)
                    .then(() => showMessageBox(_('success_password_reset_sent').replace('{email}', email), 'success'))
                    .catch(error => showMessageBox(_('error_firebase_generic').replace('{error}', error.message), 'error'));
            }
        };

        // Initialize all password toggles on the auth page
        setupPasswordToggle('loginPassword');
        setupPasswordToggle('registerPassword');
        setupPasswordToggle('confirmRegisterPassword');
    };

    // --- Initialization ---
    const init = () => {
        setupAuthFormListeners();

        DOMElements.cancelCopyBtn.onclick = cancelCopy;

        document.body.addEventListener('click', e => {
            if (!e.target.closest('.time-slot-editable.editing')) {
                document.querySelectorAll('.time-slot-editable.editing').forEach(el => el.classList.remove('editing'));
            }

            const closeButton = e.target.closest('.modal-close-btn');
            if (closeButton) {
                const modalToClose = closeButton.closest('.modal-backdrop');
                if (modalToClose) {
                    // --- START: ADDED LOGIC ---
                    if (modalToClose.id === 'checkInModal' && html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().catch(err => console.error("Failed to stop scanner on close.", err));
                        html5QrCode = null;
                    }
                    // --- END: ADDED LOGIC ---
                    closeModal(modalToClose);
                }
                return;
            }

            if (appState.copyMode.active) {
                let copyActionTaken = false;
                const { type, targetDate } = appState.copyMode;

                if (type === 'day') {
                    const sourceHeader = e.target.closest('.copy-mode-source.day-header');
                    if (sourceHeader) {
                        copyActionTaken = true;
                        const sourceDate = sourceHeader.dataset.date;
                        if (sourceDate !== targetDate) {
                            const friendlySourceDate = formatDateWithWeekday(sourceDate);
                            const friendlyTargetDate = formatDateWithWeekday(targetDate);
                            showConfirmation(
                                _('confirm_copy_day_title'),
                                _('confirm_copy_day_desc').replace('{sourceDate}', friendlySourceDate).replace('{targetDate}', friendlyTargetDate),
                                () => performCopy('day', sourceDate, targetDate)
                            );
                        }
                    }
                } else if (type === 'class') {
                    const sourceClsEl = e.target.closest('.copy-mode-source-class');
                    if (sourceClsEl) {
                        copyActionTaken = true;
                        const clsId = sourceClsEl.id;
                        const clsToCopy = appState.classes.find(c => c.id === clsId);
                        if (clsToCopy && clsToCopy.date !== targetDate) {
                            performCopy('class', clsToCopy, targetDate);
                        }
                    }
                }
                
                if (copyActionTaken) e.stopPropagation();
            }

            // --- START: MODIFIED LOGIC ---
            const addBtn = e.target.closest('.add-cls-button');
            if (addBtn) {
                const currentUser = appState.currentUser;
                // Check if user is owner OR staff
                if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'staff')) {
                    openClsModal(addBtn.dataset.date);
                }
            }
            // --- END: MODIFIED LOGIC ---
        }, true);
        
        auth.onAuthStateChanged(handleAuthStateChange);

        // --- START: NEW INITIAL LANGUAGE SET ---
        const savedLang = localStorage.getItem('studioPulseLanguage') || 'en';
        setLanguage(savedLang, false); // Don't save to DB on initial load
        // --- END: NEW INITIAL LANGUAGE SET ---
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
