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
    const COURSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#FF007F', '#00BFFF', '#32CD32', '#FFD700', '#8A2BE2', '#FF4500', '#20B2AA', '#DAA520', '#4682B4', '#FF69B4', '#7CFC00', '#ADFF2F', '#DC143C', '#BA55D3'];
    
    let appState = { 
        courses: [],  
        tutors: [], 
        sportTypes: [], 
        users: [],
        activePage: 'schedule', 
        currentUser: null,
        studioSettings: {
            courseDefaults: {
                time: '09:00',
                duration: 60,
                credits: 1,
                maxParticipants: 15
            }
        },
        selectedFilters: {
            salaryTutorId: null,
            salaryPeriod: null, 
            coursesPeriod: null,
            coursesSportTypeId: 'all',
            coursesTutorId: 'all',
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
            courses: { page: 1 },
            sports: { page: 1 },
            tutors: { page: 1 }
        },
        searchTerms: {
            sports: '',
            tutors: ''
        },
        itemsPerPage: {
            courses: 10,
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
        coursesSort: {
            key: 'date',
            direction: 'asc'
        }
    };
    let emblaApi = null;
    let navEmblaApi = null;
    let onConfirmCallback = null;
    let dataListeners = {}; // To hold references to our listeners
    let activeCoursesRef = null;

    // --- DOM Element Cache ---
    const DOMElements = {
        authPage: document.getElementById('authPage'),
        appWrapper: document.getElementById('appWrapper'),
        logoutBtn: document.getElementById('logoutBtn'),
        mainNav: document.getElementById('mainNav'),
        messageBox: document.getElementById('messageBox'),
        navButtons: document.querySelectorAll('.nav-btn'),
        pages: document.querySelectorAll('.page'),
        courseModal: document.getElementById('courseModal'),
        bookingModal: document.getElementById('bookingModal'),
        joinedMembersModal: document.getElementById('joinedMembersModal'),
        sportTypeModal: document.getElementById('sportTypeModal'),
        tutorModal: document.getElementById('tutorModal'),
        memberModal: document.getElementById('memberModal'),
        editMemberAccountModal: document.getElementById('editMemberAccountModal'),
        changePasswordModal: document.getElementById('changePasswordModal'),
        confirmationModal: document.getElementById('confirmationModal'),
        memberBookingHistoryModal: document.getElementById('memberBookingHistoryModal'),
        deleteCourseNotifyModal: document.getElementById('deleteCourseNotifyModal'),
        filterModal: document.getElementById('filterModal'),
        numericDialModal: document.getElementById('numericDialModal'),
        cancelCopyBtn: document.getElementById('cancelCopyBtn')
    };

    // --- Utility & Helper Functions ---
    const showMessageBox = (message, type = 'success', duration = 3000) => {
        DOMElements.messageBox.textContent = message;
        const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-sky-500' };
        DOMElements.messageBox.className = `fixed bottom-6 right-6 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce ${colors[type] || colors.info}`;
        DOMElements.messageBox.classList.remove('hidden');
        setTimeout(() => DOMElements.messageBox.classList.add('hidden'), duration);
    };

    const showBookingNotification = (bookingDetails) => {
        const { memberName, courseName, courseTime, duration } = bookingDetails;
        const timeRange = getTimeRange(courseTime, duration);

        const templates = [
            `Woot! <strong>${memberName}</strong> is joining the <strong>${courseName}</strong> class! 🎉`,
            `New booking! See you at <strong>${courseName}</strong>, <strong>${memberName}</strong>!`,
            `Let's go! <strong>${memberName}</strong> just snagged a spot in <strong>${courseName}</strong>.`,
            `Awesome! <strong>${memberName}</strong> is in for <strong>${courseName}</strong> at <strong>${timeRange}</strong>.`,
            `Score! Another spot filled in <strong>${courseName}</strong> by <strong>${memberName}</strong>! 👍`
        ];
        
        const message = templates[Math.floor(Math.random() * templates.length)];

        // We use the existing showMessageBox but with custom HTML
        const messageBox = DOMElements.messageBox;
        messageBox.innerHTML = message; // Use innerHTML to render the <strong> tags
        messageBox.className = `fixed bottom-6 right-6 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce bg-sky-500`;
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
    const formatCurrency = (amount) => (amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    const formatBookingAuditText = (bookingInfo) => {
        // If for some reason booking info is missing, return an empty string.
        if (!bookingInfo || !bookingInfo.bookedAt) {
            return '';
        }

        const formattedDate = formatShortDateWithYear(bookingInfo.bookedAt);

        // Case 1: Booking was made by an owner/staff
        if (bookingInfo.bookedBy && bookingInfo.bookedBy !== 'member') {
            return `Booked by <strong>${bookingInfo.bookedBy}</strong> on ${formattedDate}`;
        }
        
        // Case 2 (Default): Member self-booking
        return `Booked on ${formattedDate}`;
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

    function calculateCourseRevenueAndPayout(course, allUsers, allTutors, allCourses) {
        const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];
        let tutorPayout = 0;
        
        // This part requires a full set of courses to trace member purchase history
        const membersOnThisCourse = bookedMemberIds.map(id => allUsers.find(u => u.id === id)).filter(Boolean);
        const allBookingsByTheseMembers = [];
        if (membersOnThisCourse.length > 0) {
            const memberIdSet = new Set(membersOnThisCourse.map(m => m.id));
            allCourses.forEach(c => {
                if (c.bookedBy) {
                    for (const memberId of Object.keys(c.bookedBy)) {
                        if (memberIdSet.has(memberId)) {
                            const member = allUsers.find(u => u.id === memberId);
                            if (member) allBookingsByTheseMembers.push({ member, course: c });
                        }
                    }
                }
            });
        }
        
        const { revenueByCourseId } = calculateRevenueForBookings(allBookingsByTheseMembers);
        const grossRevenue = revenueByCourseId.get(course.id) || 0;

        // --- START: SIMPLIFIED PAYOUT CALCULATION ---
        // We now assume `payoutDetails` always exists and remove the legacy fallback.
        if (course.payoutDetails && typeof course.payoutDetails.salaryValue !== 'undefined') {
            const { salaryType, salaryValue } = course.payoutDetails;
            if (salaryType === 'perCourse') {
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
        if (!isoString) return 'N/A';
        // Create a date object using the browser's local time zone.
        // This correctly handles full ISO strings (like from a database) and date-only strings.
        const date = new Date(isoString); 
        if (isNaN(date)) return 'Invalid Date';

        // Use local date methods instead of UTC methods
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short' }); // Uses local time
        const year = String(date.getFullYear()).slice(-2);
        
        return `${day} ${month}, ${year}`;
    };

    const getOrdinalSuffix = (day) => {
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
            showMessageBox('No data available to export.', 'info');
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

        showMessageBox('Export started successfully!', 'success');
    }

    const formatDateWithWeekday = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString + 'T12:00:00Z');
        return new Intl.DateTimeFormat('en-US', { 
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
                const coursesContainer = currentSlideNode.querySelector('.courses-container[data-date]');
                if (coursesContainer) {
                    appState.scheduleScrollDate = coursesContainer.dataset.date;
                }
            }
        }
    };

    const getInitialScheduleIndex = (datesArray, defaultIndex) => {
        let targetDate = null;

        // Priority 1: Handle one-time navigation (e.g., after booking)
        if (appState.scrollToDateOnNextLoad !== null) {
            targetDate = appState.scrollToDateOnNextLoad;
            appState.scrollToDateOnNextLoad = null; // Consume this one-time state
        } 
        // Priority 2: Use the persistent scroll date if it exists
        else if (appState.scheduleScrollDate !== null) {
            targetDate = appState.scheduleScrollDate;
            // Do not consume this state. This allows the position to be remembered.
        }

        if (targetDate) {
            const index = datesArray.indexOf(targetDate);
            // If the date exists in the current view, scroll to it.
            if (index !== -1) {
                return index;
            }
        }
        
        // Priority 3: Fallback to the default index (e.g., "today")
        return defaultIndex;
    };
    
    // --- Auth & UI Visibility ---
    const handleLogin = (email, password) => {
        const loginButton = document.querySelector('#loginForm button[type="submit"]');
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                showMessageBox(error.message, 'error');
            })
            .finally(() => {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            });
    };

    const handleRegistration = (formData) => {
        const { name, email, password, phone } = formData;
        const registerButton = document.querySelector('#registerForm button[type="submit"]');
        registerButton.disabled = true;
        registerButton.textContent = 'Registering...';

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
                    purchaseHistory: {}
                };
                return database.ref('users/' + user.uid).set(newUserProfile);
            })
            .then(() => {
                showMessageBox('Registration successful! Please log in.', 'success');
                document.getElementById('register-form-container').classList.add('hidden');
                document.getElementById('login-form-container').classList.remove('hidden');
                document.getElementById('loginEmail').value = email;
            })
            .catch(error => {
                showMessageBox(error.message, 'error');
            })
            .finally(() => {
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
            });
    };

    const handleLogout = () => {
        auth.signOut();
    };

    const updateUIVisibility = () => {
        // --- START: MODIFIED LOGIC ---
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff; // True for both Owner and Staff
        // --- END: MODIFIED LOGIC ---

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

        // --- START: MODIFIED LOGIC ---
        // Conditionally apply classes to the <nav> container itself.
        if (isAdmin) { // Check for either admin role
            // On mobile, force the nav to grow and fill available space,
            // giving the carousel a proper viewport to scroll within.
            DOMElements.mainNav.classList.add('flex-grow', 'lg:flex-grow-0', 'min-w-0');
        } else {
            // For members, let the nav shrink to fit its simple content.
            DOMElements.mainNav.classList.remove('flex-grow', 'lg:flex-grow-0', 'min-w-0');
        }
        // --- END: MODIFIED LOGIC ---

        const mobileNavContainer = DOMElements.mainNav.querySelector('#nav-carousel-mobile .embla-nav__container');
        const desktopNavContainer = DOMElements.mainNav.querySelector('#nav-static-desktop');

        // --- START: MODIFIED LOGIC ---
        if (isAdmin) { // Check for either admin role
            let navButtonsHTML = [
                // Buttons visible to both Owner and Staff
                `<button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Schedule</button>`,
                `<button data-page="courses" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Courses</button>`,
                `<button data-page="members" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Members</button>`,
                `<button data-page="admin" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Admin</button>`,
                // Statistics and Salary are conditionally inserted for Owner only
                `<button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">Logout</button>`
            ];

            // Insert Owner-only buttons at specific positions
            if (isOwner) {
                navButtonsHTML.splice(3, 0, `<button data-page="salary" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Salary</button>`);
                navButtonsHTML.splice(4, 0, `<button data-page="statistics" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Statistics</button>`);
            }

            mobileNavContainer.innerHTML = navButtonsHTML.map(btn => `<div class="embla-nav__slide">${btn}</div>`).join('');
            desktopNavContainer.innerHTML = navButtonsHTML.join('');
        // --- END: MODIFIED LOGIC ---

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
                    <button data-page="schedule" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Schedule</button>
                    <button id="navFilterBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base flex items-center gap-2 relative">
                        Filter
                        ${activeFilterCount > 0 ? `<span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500"></span>` : ''}
                    </button>
                    <button data-page="account" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base">Account</button>
                    <button id="logoutBtn" class="nav-btn font-semibold px-3 py-1 text-sm sm:text-base text-red-600 hover:text-red-800">Logout</button>
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
            } else if (btn.dataset.page) {
                btn.onclick = () => switchPage(btn.dataset.page);
            }
            if (btn.dataset.page) {
                btn.classList.toggle('active', btn.dataset.page === appState.activePage);
            }
        });

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
        const adminPages = ['members', 'admin', 'courses']; // Pages for Owner and Staff
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
             showMessageBox('Access denied. Redirected to Schedule.', 'error');
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
            if (!appState.studioSettings.courseDefaults.time) { // A simple check to see if settings are default or loaded
                pageElement.innerHTML = `<p class="text-center p-8">Loading admin settings...</p>`;
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
                pageElement.innerHTML = `<p class="text-center p-8">Loading member list...</p>`;
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
                pageElement.innerHTML = `<p class="text-center p-8">Loading required member data...</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    renderSalaryPage(pageElement);
                });
            } else {
                renderSalaryPage(pageElement);
            }
        } else if (pageIdToRender === 'statistics' || pageIdToRender === 'courses') {
            // These pages also need the full user list.
            if (appState.users.length === 0) {
                pageElement.innerHTML = `<p class="text-center p-8">Loading required member data...</p>`;
                database.ref('/users').once('value').then(snapshot => {
                    appState.users = firebaseObjectToArray(snapshot.val());
                    if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                    if (pageIdToRender === 'courses') renderCoursesPage(pageElement);
                });
            } else {
                if (pageIdToRender === 'statistics') renderStatisticsPage(pageElement);
                if (pageIdToRender === 'courses') renderCoursesPage(pageElement);
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
                    <button type="button" class="cancel-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg">Cancel</button>
                    <button type="button" class="confirm-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Confirm</button>
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

    function handleDeleteCourseRequest(course) {
        const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];

        if (bookedMemberIds.length > 0) {
            // If there are bookings, open the notification modal. No refund happens here.
            openDeleteCourseNotifyModal(course);
        } else {
            // If no bookings, just show the simple confirmation to delete.
            const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
            showConfirmation('Delete Course', `Are you sure you want to delete the <strong>"${sportType?.name}"</strong> course? This action cannot be undone.`, () => {
                saveSchedulePosition();
                database.ref('/courses/' + course.id).remove().then(() => {
                    closeModal(DOMElements.courseModal);
                    showMessageBox('Course deleted.', 'info');
                    if (appState.activePage === 'courses') {
                        renderCurrentPage();
                    }
                });
            });
        }
    }

    function openDeleteCourseNotifyModal(course) {
        const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];
        const bookedMembers = bookedMemberIds.map(id => appState.users.find(u => u.id === id)).filter(Boolean);

        DOMElements.deleteCourseNotifyModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-slate-800">Notify Booked Members</h2>
                    <p class="text-slate-500 mt-2 mb-6">This course has ${bookedMembers.length} booking(s). Please copy the message for each member to notify them of the cancellation before deleting the course. Credits have been refunded.</p>
                </div>
                <div id="notify-members-list" class="space-y-3 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                    ${bookedMembers.map(member => {
                        const phoneDigits = member.phone ? member.phone.replace(/\D/g, '').slice(-8) : '';
                        return `
                        <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm" data-member-id="${member.id}">
                            <div class="flex-grow">
                                <span class="font-semibold text-slate-700 member-name">${member.name}</span>
                                <!-- The changes are in the span below -->
                                <span class="copy-phone-number text-sm text-slate-500 cursor-pointer hover:text-indigo-600 transition" 
                                      data-phone-digits="${phoneDigits}" 
                                      title="Click to copy number">
                                    ${formatDisplayPhoneNumber(member.phone)}
                                </span>
                            </div>
                            <button class="copy-notify-msg-btn bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-3 rounded-full transition">Copy WhatsApp Msg</button>
                        </div>
                    `}).join('')}
                </div>
                <div class="flex justify-center mt-8">
                    <button type="button" id="final-delete-btn" class="bg-red-600 text-white font-bold py-3 px-8 rounded-lg transition opacity-50 cursor-not-allowed" disabled>Delete Course</button>
                </div>
            </div>`;
        
        const modal = DOMElements.deleteCourseNotifyModal;
        modal.querySelectorAll('.copy-notify-msg-btn').forEach(btn => {
            btn.onclick = () => {
                const memberItem = btn.closest('[data-member-id]');
                const memberId = memberItem.dataset.memberId;
                const member = appState.users.find(u => u.id === memberId);
                
                const message = createWhatsAppMessage(member, course);
                copyTextToClipboard(message, 'WhatsApp message copied to clipboard!');

                memberItem.querySelector('.member-name').classList.add('notified-member');
                btn.textContent = 'Copied!';
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
                // We use just the digits, not the formatted number
                copyTextToClipboard(phoneNumber, `Copied ${phoneNumber.replace(/(\d{4})(?=\d)/g, '$1 ')} to clipboard!`);
            };
        });

        modal.querySelector('#final-delete-btn').onclick = () => {
            // Get all members who were booked on this course.
            const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];

            // --- START: THE FIX IS HERE ---
            // We now generate a refund promise for each member based on their specific 'creditsPaid'.
            const refundPromises = bookedMemberIds.map(memberId => {
                const member = appState.users.find(u => u.id === memberId);
                const attended = course.attendedBy && course.attendedBy[memberId];
                
                // Only refund non-monthly members who have NOT attended the class.
                if (member && !member.monthlyPlan && !attended) {
                    // 1. Get the specific booking details for this member.
                    const bookingDetails = course.bookedBy[memberId];
                    
                    // 2. Use the 'creditsPaid' value from the booking details. This is the "digital receipt".
                    const creditsToRefund = bookingDetails.creditsPaid;

                    // 3. Create the refund transaction using the correct amount.
                    return database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) + parseFloat(creditsToRefund));
                }
                
                // For monthly members or those who attended, no refund is issued.
                return Promise.resolve(); 
            });
            // --- END: THE FIX IS HERE ---

            // Wait for all refunds to complete before deleting the course.
            Promise.all(refundPromises).then(() => {
                saveSchedulePosition();

                // 1. Create an 'updates' object for a multi-path, atomic deletion.
                const updates = {};
                const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];

                // 2. Mark the main course document for deletion.
                updates[`/courses/${course.id}`] = null;

                // 3. Mark the 'memberBookings' index entry for each booked member for deletion.
                bookedMemberIds.forEach(memberId => {
                    updates[`/memberBookings/${memberId}/${course.id}`] = null;
                });

                // 4. Execute the atomic update. This deletes the course and all its indexes at once.
                database.ref().update(updates).then(() => {
                    closeModal(modal);
                    closeModal(DOMElements.courseModal);
                    showMessageBox('Course deleted and all records cleaned up.', 'success'); // More accurate message
                    if (appState.activePage === 'courses') {
                        renderCurrentPage();
                    }
                });
            });
        };

        openModal(modal);
    }

    function createWhatsAppMessage(member, course) {
        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === course.tutorId);
        const bookingLink = "https://www.studiopulse.app/schedule";

        const message = `
👋 Hi *${member.name}*,

This is a notification from StudioPulse. Unfortunately, we have to cancel the following class:

*Course:* ${sportType.name}
*Date:* ${formatShortDateWithYear(course.date)}
*Time:* ${getTimeRange(course.time, course.duration)}
*Tutor:* ${tutor.name}

We apologize for any inconvenience. The credit for this class has been refunded to your account. 🙏

Would you like to book another class? You can view the schedule here:
${bookingLink}

Thank you for your understanding.
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
                showMessageBox('Could not copy text.', 'error');
            }
        } catch (err) {
            showMessageBox('Could not copy text.', 'error');
        }
        document.body.removeChild(textArea);
    }
    
    // --- Course, Booking, and Member List Modals (Refactored) ---
    async function openJoinedMembersModal(course) {
        if (appState.copyMode.active) return;

        const bookedMemberIds = course.bookedBy ? Object.keys(course.bookedBy) : [];
        const isOwner = appState.currentUser?.role === 'owner';

        DOMElements.joinedMembersModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">Course Details</h2>
                <p class="text-center text-slate-500 mb-6">${appState.sportTypes.find(st => st.id === course.sportTypeId).name} on ${formatShortDateWithYear(course.date)}</p>
                ${isOwner ? `
                <div id="courseRevenueDetails" class="mb-6 p-4 bg-slate-50 rounded-lg text-center"><p class="text-slate-500">Calculating revenue...</p></div>
                ` : ''}
                <h3 class="text-xl font-bold text-slate-700 mb-4">Booked Members</h3>
                <div id="joinedMembersList" class="space-y-3 max-h-60 overflow-y-auto">
                    <p class="text-center text-slate-500 p-4">Loading booked members...</p>
                </div>
                
                <div class="mt-8 border-t pt-6">
                    <h3 class="text-xl font-bold text-slate-700 mb-4">Add Walk-in Member</h3>
                    <div class="relative">
                        <input type="text" id="addMemberSearchInput" placeholder="Search members to add..." class="form-input w-full">
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
            const revenueEl = DOMElements.joinedMembersModal.querySelector('#courseRevenueDetails');
            let grossRevenue = 0, tutorPayout = 0, netRevenue = 0;
            if (bookedMemberIds.length > 0) {
                const allCoursesSnapshot = await database.ref('/courses').once('value');
                const allCoursesForCalc = firebaseObjectToArray(allCoursesSnapshot.val());

                const revenueData = calculateCourseRevenueAndPayout(course, appState.users, appState.tutors, allCoursesForCalc);
                grossRevenue = revenueData.grossRevenue;
                tutorPayout = revenueData.tutorPayout;
                netRevenue = revenueData.netRevenue;
            }
            
            const netRevenueColor = netRevenue >= 0 ? 'text-green-600' : 'text-red-600';
            revenueEl.innerHTML = `
                <div class="flex justify-center gap-4">
                    <div><p class="text-sm text-slate-500">Gross Revenue</p><p class="text-2xl font-bold text-green-600">${formatCurrency(grossRevenue)}</p></div>
                    <div><p class="text-sm text-slate-500">Tutor Payout</p><p class="text-2xl font-bold text-red-600">(${formatCurrency(tutorPayout)})</p></div>
                    <div><p class="text-sm text-slate-500">Net Revenue</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(netRevenue)}</p></div>
                </div>`;
        }
        
        if (bookedMembers.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center">No members have booked this course yet.</p>`;
        } else {
            listEl.innerHTML = bookedMembers.map(member => {
                const isAttended = course.attendedBy && course.attendedBy[member.id];
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
                    const attendedRef = database.ref(`/courses/${course.id}/attendedBy/${memberId}`);
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
                addMemberSearchResults.innerHTML = '<p class="p-3 text-slate-500 text-center">Loading all members for search...</p>';
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
                (!course.bookedBy || !course.bookedBy[u.id]) && (
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
                        <button class="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold py-1 px-3 rounded-full pointer-events-none">Add</button>
                    </div>
                `).join('');
                addMemberSearchResults.classList.remove('hidden');
            } else {
                addMemberSearchResults.innerHTML = '<p class="p-3 text-slate-500 text-center">No members found.</p>';
                addMemberSearchResults.classList.remove('hidden');
            }
        };

        addMemberSearchResults.onclick = (e) => {
            const target = e.target.closest('.add-member-result-item');
            if (target) {
                const memberId = target.dataset.memberId;
                const memberToAdd = appState.users.find(u => u.id === memberId);
                const currentBookings = course.bookedBy ? Object.keys(course.bookedBy).length : 0;

                if (currentBookings >= course.maxParticipants) {
                    showMessageBox('Cannot add member, class is full.', 'error');
                    return;
                }
                
                if (memberToAdd && !memberToAdd.monthlyPlan) {
                    if (parseFloat(memberToAdd.credits) < parseFloat(course.credits)) {
                        showMessageBox('Member has insufficient credits.', 'error');
                        return;
                    }
                    database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) - parseFloat(course.credits));
                }

                const updates = {};
                // --- START: IMPLEMENTATION ---
                updates[`/courses/${course.id}/bookedBy/${memberId}`] = {
                    bookedAt: new Date().toISOString(),
                    bookedBy: appState.currentUser.name,
                    monthlyCreditValue: memberToAdd.monthlyCreditValue || 0,
                    creditsPaid: course.credits // Freeze the credit cost at time of booking
                };
                // --- END: IMPLEMENTATION ---
                updates[`/memberBookings/${memberId}/${course.id}`] = true;
                database.ref().update(updates).then(() => {
                    showMessageBox('Member added to course.', 'success');
                    closeModal(DOMElements.joinedMembersModal);
                });
            }
        };
    }

    function openBookingModal(course) {
        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === course.tutorId);
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
                    <h2 class="text-3xl font-bold mb-1">Confirm Your Spot</h2>
                    <p class="opacity-80">You're about to book a class!</p>
                </div>
                <div class="p-8 space-y-4">
                    <div class="flex justify-between items-center"><span class="text-slate-500">Course:</span><strong class="text-slate-800">${sportType.name}</strong></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">Tutor:</span><strong class="text-slate-800">${tutor.name}</strong></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">Time:</span><strong class="text-slate-800">${formatDateWithWeekday(course.date)}, ${getTimeRange(course.time, course.duration)}</strong></div>
                    <hr class="my-4">
                    <div class="flex justify-between items-center"><span class="text-slate-500">Credits Required:</span><strong class="text-indigo-600 text-lg">${course.credits}</strong></div>
                    <div class="flex justify-between items-center"><span class="text-slate-500">Your Balance:</span><strong class="text-slate-800 text-lg">${currentUser.monthlyPlan ? 'Monthly Plan' : `${formatCredits(currentUser.credits)} Credits`}</strong></div>
                </div>
                <div class="p-6 bg-slate-50">
                    <button id="confirmBookingBtn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105">Book Now & Confirm</button>
                </div>
            </div>`;
        
        const confirmBtn = DOMElements.bookingModal.querySelector('#confirmBookingBtn');
        confirmBtn.onclick = () => {
            const memberId = currentUser.id;
            const currentBookings = course.bookedBy ? Object.keys(course.bookedBy).length : 0;

            if (course.bookedBy && course.bookedBy[memberId]) {
                 showMessageBox('You have already booked this course.', 'error');
            } else if (!currentUser.monthlyPlan && (parseFloat(currentUser.credits || 0) < parseFloat(course.credits))) {
                showMessageBox('Not enough credits to book this course.', 'error');
            } else if (currentBookings >= course.maxParticipants) {
                showMessageBox('Sorry, this class is full.', 'error');
            } else {
                confirmBtn.disabled = true;
                
                let creditUpdatePromise = Promise.resolve();
                if (!currentUser.monthlyPlan) {
                    creditUpdatePromise = database.ref(`/users/${memberId}/credits`).transaction(credits => (credits || 0) - parseFloat(course.credits));
                }

                creditUpdatePromise.then(() => {
                    const updates = {};
                    // --- START: IMPLEMENTATION ---
                    updates[`/courses/${course.id}/bookedBy/${memberId}`] = {
                        bookedAt: new Date().toISOString(),
                        bookedBy: 'member',
                        monthlyCreditValue: currentUser.monthlyCreditValue || 0,
                        creditsPaid: course.credits // Freeze the credit cost at time of booking
                    };
                    // --- END: IMPLEMENTATION ---
                    updates[`/memberBookings/${memberId}/${course.id}`] = true;
                    updates[`/users/${memberId}/lastBooking`] = new Date().toISOString();
                    return database.ref().update(updates);
                }).then(() => {
                    appState.highlightBookingId = course.id;
                    appState.scrollToDateOnNextLoad = course.date;
                    showMessageBox('Booking successful!', 'success');
                    closeModal(DOMElements.bookingModal);
                    switchPage('account');
                }).catch(error => {
                    showMessageBox(`Booking failed: ${error.message}`, 'error');
                }).finally(() => {
                    confirmBtn.disabled = false;
                });
            }
        };
        openModal(DOMElements.bookingModal);
    }

    function handleCancelBooking(course, memberIdToUpdate = null) {
        showConfirmation('Cancel Booking', 'Are you sure you want to cancel your booking for this course?', () => {
            const memberId = memberIdToUpdate || appState.currentUser.id;
            
            let memberToUpdate;
            if (memberIdToUpdate) {
                memberToUpdate = appState.users.find(u => u.id === memberId);
            } else {
                memberToUpdate = appState.currentUser;
            }

            if (!memberToUpdate) {
                showMessageBox('Member not found.', 'error');
                return;
            }

            // --- START: CLEANED LOGIC ---
            // Directly access the frozen 'creditsPaid' value from the booking record.
            const bookingDetails = course.bookedBy[memberId];
            const creditsToRefund = bookingDetails.creditsPaid;
            // --- END: CLEANED LOGIC ---

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
                updates[`/courses/${course.id}/bookedBy/${memberId}`] = null;
                updates[`/memberBookings/${memberId}/${course.id}`] = null;
                return database.ref().update(updates);
            }).then(() => {
                if (memberIdToUpdate) {
                    const updatedMember = appState.users.find(u => u.id === memberIdToUpdate);
                    if (updatedMember) openMemberBookingHistoryModal(updatedMember);
                } 
                else {
                    const courseIndex = appState.courses.findIndex(c => c.id === course.id);
                    if (courseIndex > -1 && appState.courses[courseIndex].bookedBy) {
                        delete appState.courses[courseIndex].bookedBy[appState.currentUser.id];
                    }
                    renderCurrentPage();
                }

                showMessageBox('Booking cancelled.', 'info');
            }).catch(error => {
                showMessageBox(`Cancellation failed: ${error.message}`, 'error');
            });
        });
    }

    function openCourseModal(dateIso, courseToEdit = null) {
        DOMElements.courseModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="courseModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="courseForm">
                    <input type="hidden" id="courseModalId">
                    <div class="space-y-4">
                        <div>
                            <label for="courseSportType" class="block text-slate-600 text-sm font-semibold mb-2">Sport Type</label>
                            <select id="courseSportType" name="sportTypeId" required class="form-select"></select>
                        </div>
                        <div>
                            <label for="courseTutor" class="block text-slate-600 text-sm font-semibold mb-2">Tutor</label>
                            <select id="courseTutor" name="tutorId" required class="form-select"></select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="courseDate" class="block text-slate-600 text-sm font-semibold mb-2">Date</label>
                                <input type="date" id="courseDate" name="date" required class="form-input">
                            </div>
                            <div>
                                <label for="courseTime" class="block text-slate-600 text-sm font-semibold mb-2">Start Time (24h)</label>
                                <input type="text" id="courseTime" name="time" required class="form-input" pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" title="Enter time in 24-hour HH:MM format">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="courseDuration" class="block text-slate-600 text-sm font-semibold mb-2">Duration (min)</label>
                                <input type="number" id="courseDuration" name="duration" required min="15" max="240" step="5" class="form-input">
                            </div>
                            <div>
                                <label for="courseCredits" class="block text-slate-600 text-sm font-semibold mb-2">Credits</label>
                                <input type="number" id="courseCredits" name="credits" required min="0" max="20" step="0.01" class="form-input">
                            </div>
                        </div>
                        <div>
                            <label for="courseMaxParticipants" class="block text-slate-600 text-sm font-semibold mb-2">Max Participants</label>
                            <input type="number" id="courseMaxParticipants" name="maxParticipants" required min="1" max="100" class="form-input">
                        </div>
                        <!-- START: NEW CHECKBOX ADDED HERE -->
                        <div class="pt-4 border-t">
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" id="notForMonthlyCheckbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500">
                                <span class="ml-3 text-slate-700 font-semibold">Not for Monthly Members</span>
                            </label>
                            <p class="text-xs text-slate-500 ml-7">Check this for special classes like Personal Training that cannot be booked with a monthly plan.</p>
                        </div>
                        <!-- END: NEW CHECKBOX ADDED HERE -->
                    </div>
                    <div class="flex justify-center items-center gap-4 mt-8">
                        <button type="button" class="delete-btn bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-5 rounded-lg transition hidden">Delete</button>
                        <button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg flex-grow"></button>
                    </div>
                </form>
            </div>`;

        const modal = DOMElements.courseModal;
        const form = modal.querySelector('form');
        form.reset();
        populateDropdown(form.querySelector('#courseSportType'), appState.sportTypes);
        
        const deleteBtn = form.querySelector('.delete-btn');
        deleteBtn.classList.add('hidden');
        
        const updateTutorDropdown = () => {
            const selectedSportId = form.querySelector('#courseSportType').value;
            const skilledTutors = appState.tutors.filter(tutor => tutor.skills.some(skill => skill.sportTypeId === selectedSportId));
            populateDropdown(form.querySelector('#courseTutor'), skilledTutors);
        };

        form.querySelector('#courseSportType').onchange = updateTutorDropdown;

        if (courseToEdit) {
            modal.querySelector('#courseModalTitle').textContent = 'Edit Course';
            modal.querySelector('.submit-btn').textContent = 'Save Changes';
            form.querySelector('#courseModalId').value = courseToEdit.id;
            form.querySelector('#courseSportType').value = courseToEdit.sportTypeId;
            updateTutorDropdown();
            form.querySelector('#courseTutor').value = courseToEdit.tutorId;
            form.querySelector('#courseDuration').value = courseToEdit.duration;
            form.querySelector('#courseTime').value = courseToEdit.time;
            form.querySelector('#courseCredits').value = courseToEdit.credits;
            form.querySelector('#courseMaxParticipants').value = courseToEdit.maxParticipants;
            form.querySelector('#courseDate').value = courseToEdit.date;
            // --- START: POPULATE CHECKBOX ON EDIT ---
            form.querySelector('#notForMonthlyCheckbox').checked = courseToEdit.notForMonthly || false;
            // --- END: POPULATE CHECKBOX ON EDIT ---
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => handleDeleteCourseRequest(courseToEdit);
        } else {
            modal.querySelector('#courseModalTitle').textContent = 'Add New Course';
            modal.querySelector('.submit-btn').textContent = 'Add Course';
            form.querySelector('#courseModalId').value = '';
            updateTutorDropdown();
            const defaultDate = dateIso || new Date().toISOString().split('T')[0];
            form.querySelector('#courseDate').value = defaultDate;
            
            const defaults = appState.studioSettings.courseDefaults;
            form.querySelector('#courseDuration').value = defaults.duration;
            form.querySelector('#courseCredits').value = defaults.credits;
            form.querySelector('#courseMaxParticipants').value = defaults.maxParticipants;

            const coursesOnDay = appState.courses
                .filter(c => c.date === defaultDate)
                .sort((a, b) => a.time.localeCompare(b.time));

            if (coursesOnDay.length > 0) {
                const lastCourse = coursesOnDay[coursesOnDay.length - 1];
                const [hours, minutes] = lastCourse.time.split(':').map(Number);
                const lastCourseStartTime = new Date();
                lastCourseStartTime.setHours(hours, minutes, 0, 0);
                const nextAvailableTime = new Date(lastCourseStartTime.getTime() + lastCourse.duration * 60000);
                
                const defaultHours = String(nextAvailableTime.getHours()).padStart(2, '0');
                const defaultMinutes = String(nextAvailableTime.getMinutes()).padStart(2, '0');
                form.querySelector('#courseTime').value = `${defaultHours}:${defaultMinutes}`;
            } else {
                form.querySelector('#courseTime').value = defaults.time;
            }
        }
        form.onsubmit = handleCourseFormSubmit;
        openModal(modal);
    }

    function openNumericDialModal(title, currentValue, min, max, onConfirm) {
        const modalContainer = DOMElements.numericDialModal;
        if (!modalContainer) return;

        let optionsHTML = '';
        for (let i = min; i <= max; i++) {
            const isSelected = (i === currentValue);
            optionsHTML += `<div class="dial-option ${isSelected ? 'selected' : ''}" data-value="${i}">${i}</div>`;
        }

        modalContainer.innerHTML = `
            <div class="numeric-dial-modal-content modal-content">
                <div class="dial-header">
                    <button type="button" class="cancel-btn text-lg text-slate-500 hover:text-slate-700 font-semibold">Cancel</button>
                    <h3 class="text-lg font-bold text-slate-800">${title}</h3>
                    <button type="button" class="confirm-btn text-lg text-indigo-600 hover:text-indigo-800 font-bold">Done</button>
                </div>
                <div class="dial-options-container">
                    ${optionsHTML}
                </div>
            </div>`;
            
        const optionsContainer = modalContainer.querySelector('.dial-options-container');
        let selectedValue = currentValue;
        let debounceTimer;

        // --- START: NEW SCROLL-BASED SELECTION LOGIC ---
        optionsContainer.addEventListener('scroll', () => {
            // Clear the previous timer
            clearTimeout(debounceTimer);

            // Set a new timer to run the logic after scrolling has stopped
            debounceTimer = setTimeout(() => {
                const containerRect = optionsContainer.getBoundingClientRect();
                const containerCenter = containerRect.top + (containerRect.height / 2);

                let closestElement = null;
                let minDistance = Infinity;

                // Find the option element closest to the container's center
                optionsContainer.querySelectorAll('.dial-option').forEach(option => {
                    const optionRect = option.getBoundingClientRect();
                    const optionCenter = optionRect.top + (optionRect.height / 2);
                    const distance = Math.abs(containerCenter - optionCenter);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestElement = option;
                    }
                });

                // If we found a closest element, select it
                if (closestElement) {
                    selectedValue = parseInt(closestElement.dataset.value);
                    if (!closestElement.classList.contains('selected')) {
                        optionsContainer.querySelector('.selected')?.classList.remove('selected');
                        closestElement.classList.add('selected');
                        // Smoothly snap the selected item to the center
                        closestElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 150); // 150ms delay is a good balance
        });
        // --- END: NEW SCROLL-BASED SELECTION LOGIC ---

        // The user can still tap an option for a quick jump
        optionsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.dial-option');
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

    function handleCourseFormSubmit(e) {
        e.preventDefault();
        saveSchedulePosition();
        const form = e.target;
        const courseId = form.querySelector('#courseModalId').value;
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;

        // NOTE: The 'async' keyword is removed because the problematic 'await' for
        // the refund logic has been taken out. This is the intended fix.
        
        const newCourseDataFromForm = {
            sportTypeId: form.querySelector('#courseSportType').value,
            tutorId: form.querySelector('#courseTutor').value,
            duration: parseInt(form.querySelector('#courseDuration').value),
            time: form.querySelector('#courseTime').value,
            credits: parseFloat(form.querySelector('#courseCredits').value),
            maxParticipants: parseInt(form.querySelector('#courseMaxParticipants').value),
            date: form.querySelector('#courseDate').value,
            notForMonthly: form.querySelector('#notForMonthlyCheckbox').checked
        };

        const tutor = appState.tutors.find(t => t.id === newCourseDataFromForm.tutorId);
        if (tutor) {
            const skill = tutor.skills.find(s => s.sportTypeId === newCourseDataFromForm.sportTypeId);
            if (skill) {
                newCourseDataFromForm.payoutDetails = {
                    salaryType: tutor.isEmployee ? 'perCourse' : skill.salaryType,
                    salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                };
            }
        }

        const updates = {};
        const monthIndexKey = newCourseDataFromForm.date.substring(0, 7);

        let promise;

        if (courseId) {
            // --- THIS IS THE CRITICAL EDITING LOGIC ---
            const originalCourse = appState.courses.find(c => c.id === courseId);
            if (!originalCourse) {
                showMessageBox('Error: Could not find original course to update.', 'error');
                submitBtn.disabled = false;
                return;
            }

            // 1. Preserve existing booking and attendance data
            const finalCourseData = {
                ...originalCourse,       // Start with the original course data (including bookedBy)
                ...newCourseDataFromForm // Overwrite with new values from the form
            };

            // 2. THE FIX: The automatic refund logic that was here has been completely removed.
            //    We no longer issue refunds when a course price is lowered. The cancellation
            //    process will correctly use the original 'creditsPaid' value.

            updates[`/courses/${courseId}`] = finalCourseData;
            updates[`/courseMonths/${monthIndexKey}`] = true;
            promise = database.ref().update(updates);

        } else {
            // This is a NEW course, so the logic is simpler
            const newCourseKey = database.ref('/courses').push().key;
            newCourseDataFromForm.bookedBy = {};
            newCourseDataFromForm.attendedBy = {};
            
            updates[`/courses/${newCourseKey}`] = newCourseDataFromForm;
            updates[`/courseMonths/${monthIndexKey}`] = true;
            promise = database.ref().update(updates);
        }

        promise.then(() => {
            showMessageBox(courseId ? 'Course updated successfully!' : 'Course added!', 'success');
            closeModal(DOMElements.courseModal);
        }).catch(error => {
            showMessageBox(error.message, 'error');
        }).finally(() => {
            submitBtn.disabled = false;
        });
    }

    function createParticipantCounter(current, max, isEditable = false) {
        const fillRate = max > 0 ? current / max : 0;
        
        let statusClass = 'status-low';
        if (fillRate >= 1) {
            statusClass = 'status-full';
        } else if (fillRate >= 0.9) {
            statusClass = 'status-high';
        } else if (fillRate >= 0.5) {
            statusClass = 'status-medium';
        }
        
        const editableClass = isEditable ? 'participant-counter-editable' : '';

        return `
            <div class="participant-counter ${statusClass} ${editableClass}" title="${current} of ${max} spots filled">
                ${current}/${max}
            </div>
        `;
    }

    // --- Main Rendering Functions ---
    function createCourseElement(course) {
        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === course.tutorId);
        const el = document.createElement('div');
        el.id = course.id; 
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;
        const currentBookings = course.bookedBy ? Object.keys(course.bookedBy).length : 0;
        
        el.className = `course-block p-3 rounded-lg shadow-md text-white mb-2 flex flex-col justify-between`;
        el.style.backgroundColor = sportType?.color || '#64748b';

        if (!isAdmin) {
            const { memberSportType, memberTutor } = appState.selectedFilters;
            const sportMatch = memberSportType === 'all' || course.sportTypeId === memberSportType;
            const tutorMatch = memberTutor === 'all' || course.tutorId === memberTutor;
            if (!sportMatch || !tutorMatch) {
                el.classList.add('filtered-out');
            }
        }
        
        let actionButton = '';
        let mainAction = () => {};
        const isBookedByCurrentUser = !isAdmin && appState.currentUser && course.bookedBy && course.bookedBy[appState.currentUser.id];
        const isAttendedByCurrentUser = !isAdmin && appState.currentUser && course.attendedBy && course.attendedBy[appState.currentUser.id];
        const isFull = currentBookings >= course.maxParticipants;
        // --- START: NEW STATE VARIABLES ---
        const isMonthlyMember = !isAdmin && appState.currentUser.monthlyPlan;
        const isRestrictedForMonthly = course.notForMonthly;
        // --- END: NEW STATE VARIABLES ---

        if (isAdmin) {
            el.classList.add('cursor-pointer');
            actionButton = `<button class="edit-course-btn absolute top-2 right-2 opacity-60 hover:opacity-100 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>`;
            mainAction = () => { 
                if (!appState.copyMode.active) {
                    const freshCourseData = appState.courses.find(c => c.id === course.id);
                    openJoinedMembersModal(freshCourseData);
                } 
            };
        // --- START: NEW LOGIC BLOCK FOR RESTRICTED COURSES ---
        } else if (isMonthlyMember && isRestrictedForMonthly) {
            // This is a monthly member looking at a restricted course.
            el.classList.add('course-block-restricted'); // New CSS class for styling
            mainAction = () => showMessageBox('This course is not available for Monthly Plan members.', 'info');
        // --- END: NEW LOGIC BLOCK ---
        } else if (isBookedByCurrentUser) {
            el.classList.add('booked-by-member');
        } else if (appState.currentUser && !isFull) {
            el.classList.add('cursor-pointer');
            mainAction = () => openBookingModal(course);
        }

        let memberActionHTML;
        if (isBookedByCurrentUser) {
            if (isAttendedByCurrentUser) {
                memberActionHTML = `<span class="bg-white/90 text-green-600 font-bold text-xs px-2 py-1 rounded-full">COMPLETED</span>`;
            } else {
                memberActionHTML = `<button class="cancel-booking-btn-toggle bg-white/90 text-indigo-600 font-bold text-xs px-3 py-1 rounded-full transition-all duration-200 hover:bg-red-600 hover:text-white" data-booked-text="BOOKED" data-cancel-text="CANCEL?">BOOKED</button>`;
            }
        // --- START: NEW LOGIC FOR RESTRICTED COURSES ---
        } else if (isMonthlyMember && isRestrictedForMonthly) {
            memberActionHTML = `<span class="bg-white text-slate-600 font-bold text-xs px-3 py-1 rounded-full">NOT AVAILABLE</span>`;
        // --- END: NEW LOGIC FOR RESTRICTED COURSES ---
        } else if (isFull) {
            memberActionHTML = `<span class="bg-white text-red-600 font-bold text-xs px-3 py-1 rounded-full">FULL</span>`;
        } else {
            memberActionHTML = `<span class="font-bold text-white">${course.credits} ${course.credits === 1 ? 'credit' : 'credits'}</span>`;
        }
        
        const participantCounterHTML = isAdmin
            ? (window.matchMedia('(any-pointer: fine)').matches
                ? createParticipantCounter(currentBookings, course.maxParticipants, true)
                : `<div class="participant-dial-trigger">${createParticipantCounter(currentBookings, course.maxParticipants, false)}</div>`
            )
            : createParticipantCounter(currentBookings, course.maxParticipants, false);

        el.innerHTML = `
            <div>
                <p class="font-bold text-lg leading-tight pr-6">${sportType?.name || 'Unknown Type'}</p>
                ${actionButton}
            </div>
            <div class="text-sm mt-1.5 flex justify-between items-center">
                <span class="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                    ${tutor?.name || 'Unknown'}
                </span>
                ${participantCounterHTML}
            </div>
            <div class="mt-2 flex justify-between items-center">
                ${isAdmin
                    ? (window.matchMedia('(any-pointer: fine)').matches
                        ? `<p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md inline-block time-slot time-slot-editable">${getTimeRange(course.time, course.duration)}</p>`
                        : `<div class="relative inline-block">
                               <p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md">${getTimeRange(course.time, course.duration)}</p>
                               <input type="time" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value="${course.time}" />
                           </div>`
                    )
                    : `<p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md inline-block">${getTimeRange(course.time, course.duration)}</p>`
                }
                <div class="member-action-container">
                    ${isAdmin 
                        ? (isFull 
                            ? `<span class="bg-white text-red-600 font-bold text-xs px-3 py-1 rounded-full">FULL</span>` 
                            : `<span class="font-bold text-white">${course.credits} ${course.credits === 1 ? 'credit' : 'credits'}</span>`) 
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
            el.querySelector('.edit-course-btn').onclick = (e) => {
                e.stopPropagation();
                openCourseModal(course.date, course);
            };
            
            const timeSlotEl = el.querySelector('.time-slot-editable');
            if (timeSlotEl) {
                let localCourseTime = course.time;
                
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
                    
                    const [hours, minutes] = localCourseTime.split(':').map(Number);
                    let totalMinutes = hours * 60 + minutes;
                    
                    if (e.deltaY < 0) totalMinutes -= 15; else totalMinutes += 15;
                    if (totalMinutes < 0) totalMinutes = 24 * 60 - 15; if (totalMinutes >= 24 * 60) totalMinutes = 0;

                    const newHours = Math.floor(totalMinutes / 60); const newMinutes = totalMinutes % 60;
                    localCourseTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                    timeSlotEl.textContent = getTimeRange(localCourseTime, course.duration);

                    clearTimeout(timeChangeDebounce);
                    timeChangeDebounce = setTimeout(() => { saveSchedulePosition(); database.ref(`/courses/${course.id}/time`).set(localCourseTime); }, 1500);
                });
            }

            const timeInput = el.querySelector('input[type="time"]');
            if (timeInput) {
                timeInput.addEventListener('click', (e) => e.stopPropagation());
                timeInput.addEventListener('change', () => {
                    let timeChangeDebounce;
                    clearTimeout(timeChangeDebounce);
                    timeChangeDebounce = setTimeout(() => { saveSchedulePosition(); database.ref(`/courses/${course.id}/time`).set(timeInput.value); }, 1500);
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
                    maxPartChangeDebounce = setTimeout(() => { saveSchedulePosition(); database.ref(`/courses/${course.id}/maxParticipants`).set(localMaxParticipants); }, 1500);
                });
            }

            const participantDialTrigger = el.querySelector('.participant-dial-trigger');
            if (participantDialTrigger) {
                participantDialTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNumericDialModal(
                        'Set Max Participants',
                        course.maxParticipants,
                        1, 100,
                        (newMax) => {
                            saveSchedulePosition();
                            database.ref(`/courses/${course.id}/maxParticipants`).set(newMax);
                        }
                    );
                });
            }

        } else if (isBookedByCurrentUser && !isAttendedByCurrentUser) {
            const cancelButton = el.querySelector('.cancel-booking-btn-toggle');
            if (cancelButton) {
                cancelButton.onclick = (e) => { e.stopPropagation(); saveSchedulePosition(); handleCancelBooking(course); };
                cancelButton.onmouseenter = () => cancelButton.textContent = cancelButton.dataset.cancelText;
                cancelButton.onmouseleave = () => cancelButton.textContent = cancelButton.dataset.bookedText;
            }
        }
        
        return el;
    }

    function _reSortDayColumn(dateIso) {
        const dayContainer = document.querySelector(`.courses-container[data-date="${dateIso}"]`);
        if (!dayContainer) return; // Do nothing if the day is not visible

        // 1. Get all courses for this specific day from the global app state
        const dailyCourses = appState.courses.filter(c => c.date === dateIso);
        
        // 2. Sort them by time to ensure the correct order
        dailyCourses.sort((a, b) => a.time.localeCompare(b.time));

        // 3. Clear only this day's container
        dayContainer.innerHTML = '';

        // 4. Re-append the newly sorted course elements
        dailyCourses.forEach(course => {
            dayContainer.appendChild(createCourseElement(course));
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
        const headerDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

        datesArray.forEach(dateIso => {
            const date = new Date(dateIso + 'T12:00:00Z');
            const isToday = (dateIso === todayIso);
            const todayBadge = isToday ? '<span class="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">Today</span>' : '';
            const headerClasses = `day-header p-2 rounded-t-xl ${isToday ? 'bg-indigo-50' : 'hover:bg-slate-100'}`;

            const copyButtonsHTML = showAddButton ? `
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <button data-date="${dateIso}" class="copy-class-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">Copy Class</button>
                    <button data-date="${dateIso}" class="copy-day-btn w-full flex items-center justify-center py-2 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 text-xs transition-all">Copy Day</button>
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
                        <div data-date="${dateIso}" class="courses-container px-1 py-1 flex-grow"></div>
                        <div class="add-controls-wrapper mt-auto p-2">
                            ${showAddButton ? `<button data-date="${dateIso}" class="add-course-button w-full flex items-center justify-center py-3 rounded-lg bg-slate-200/50 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 transition-all"><svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>Add Class</button>${copyButtonsHTML}` : ''}
                        </div>
                    </div>
                </div>`;
        });
        emblaContainer.innerHTML = content;

        const coursesByDate = appState.courses.reduce((acc, course) => { (acc[course.date] = acc[course.date] || []).push(course); return acc; }, {});
        container.querySelectorAll('.courses-container').forEach(cont => {
            const date = cont.dataset.date;
            const dailyCourses = coursesByDate[date] || [];
            
            cont.innerHTML = '';
            
            dailyCourses.sort((a, b) => a.time.localeCompare(b.time)).forEach(course => cont.appendChild(createCourseElement(course)));
        });

        const emblaNode = container.querySelector('.embla__viewport');
        emblaApi = EmblaCarousel(emblaNode, { loop: false, align: "start", dragFree: true, startIndex: initialScrollIndex });
        
        const prevBtn = container.querySelector(".embla__button--prev");
        const nextBtn = container.querySelector(".embla__button--next");
        
        // --- START: MODIFIED LOGIC ---
        const isOwner = appState.currentUser?.role === 'owner';
        const isStaff = appState.currentUser?.role === 'staff';
        const isAdmin = isOwner || isStaff;
        
        const scrollPrev = () => {
            // Use isAdmin to allow both Owner and Staff to load past data
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
            
            // Use isAdmin here as well to correctly enable/disable the button
            prevBtn.disabled = !canScrollPrev && !(isAdmin && appState.ownerPastDaysVisible < 30);
            nextBtn.disabled = !canScrollNext;
        };
        // --- END: MODIFIED LOGIC ---
        
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
        ownerStartDate.setDate(today.getDate() - daysToLookBack); // Use local date

        const ownerEndDate = new Date();
        ownerEndDate.setUTCHours(0,0,0,0);
        ownerEndDate.setUTCDate(today.getUTCDate() + 30);

        const datesArray = [];
        for (let d = new Date(ownerStartDate); d <= ownerEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            datesArray.push(getIsoDate(d));
        }

        const initialScrollIndex = getInitialScheduleIndex(datesArray, daysToLookBack);
        
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

        const futureCourses = appState.courses.filter(c => new Date(c.date) >= memberStartDate);
        if (futureCourses.length > 0) {
            const latestCourseDate = new Date(Math.max(...futureCourses.map(c => new Date(c.date).getTime())));
            if (latestCourseDate > memberEndDate) {
                memberEndDate = latestCourseDate;
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

        // 1. Determine the set of courses visible to the member
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const memberStartDate = new Date(today.getTime());
        const futureCourses = appState.courses.filter(c => new Date(c.date) >= memberStartDate);

        // 2. Derive available sport types and tutors from that specific set of courses
        const relevantSportTypeIds = new Set(futureCourses.map(c => c.sportTypeId));
        const availableSportTypes = appState.sportTypes.filter(st => relevantSportTypeIds.has(st.id));
        
        const relevantTutorIds = new Set(futureCourses.map(c => c.tutorId));
        const availableTutors = appState.tutors.filter(t => relevantTutorIds.has(t.id));

        DOMElements.filterModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-2xl font-bold text-slate-800 mb-6 text-center">Filter Schedule</h2>
                <form id="filterForm" class="space-y-4">
                    <div>
                        <label for="modalSportTypeFilter" class="block text-slate-600 text-sm font-semibold mb-2">Sport Type</label>
                        <select id="modalSportTypeFilter" class="form-select w-full"></select>
                    </div>
                    <div>
                        <label for="modalTutorFilter" class="block text-slate-600 text-sm font-semibold mb-2">Tutor</label>
                        <select id="modalTutorFilter" class="form-select w-full"></select>
                    </div>
                    <div class="pt-4 space-y-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition">Apply Filters</button>
                        <button type="button" id="modalClearFiltersBtn" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg transition ${!isFilterActive ? 'hidden' : ''}">Clear Filters</button>
                    </div>
                </form>
            </div>
        `;

        const modal = DOMElements.filterModal;
        const form = modal.querySelector('#filterForm');
        const sportTypeFilter = modal.querySelector('#modalSportTypeFilter');
        const tutorFilter = modal.querySelector('#modalTutorFilter');
        const clearBtn = modal.querySelector('#modalClearFiltersBtn');

        // 3. Populate the dropdowns using the dynamically calculated lists
        populateSportTypeFilter(sportTypeFilter, availableSportTypes);
        sportTypeFilter.value = memberSportType;
        
        populateTutorFilter(tutorFilter, sportTypeFilter.value, availableTutors);
        tutorFilter.value = memberTutor;
        
        sportTypeFilter.onchange = () => {
            // Re-populate tutors based on the new sport selection, still using the same `availableTutors` list
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
            const coursesToCopy = appState.courses.filter(c => c.date === sourceDate);
            if (coursesToCopy.length === 0) {
                showMessageBox('Source day has no classes to copy.', 'error');
                cancelCopy();
                return;
            } else {
                const copyPromises = coursesToCopy.map(course => {
                    // --- START: FIX ---
                    // 1. Exclude the old payoutDetails from the spread operator.
                    const { id, bookedBy, attendedBy, payoutDetails, ...restOfCourse } = course;
                    const newCourse = {
                        ...restOfCourse,
                        date: targetDate,
                        bookedBy: {},
                        attendedBy: {}
                    };

                    // 2. Generate new payoutDetails based on the tutor's CURRENT salary.
                    const tutor = appState.tutors.find(t => t.id === newCourse.tutorId);
                    if (tutor) {
                        const skill = tutor.skills.find(s => s.sportTypeId === newCourse.sportTypeId);
                        if (skill) {
                            newCourse.payoutDetails = {
                                salaryType: tutor.isEmployee ? 'perCourse' : skill.salaryType,
                                salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                            };
                        }
                    }
                    // --- END: FIX ---

                    return database.ref('/courses').push(newCourse);
                });
                Promise.all(copyPromises).then(() => {
                    showMessageBox(`Copied ${coursesToCopy.length} class(es) from ${formatDateWithWeekday(sourceDate)} to ${formatDateWithWeekday(targetDate)}.`, 'success');
                });
            }
        } else if (type === 'class') {
            // --- START: FIX ---
            // 1. Exclude the old payoutDetails from the spread operator.
            const { id, bookedBy, attendedBy, payoutDetails, ...restOfCourse } = sourceData;
            const newCourse = {
                ...restOfCourse,
                date: targetDate,
                bookedBy: {},
                attendedBy: {}
            };

            // 2. Generate new payoutDetails based on the tutor's CURRENT salary.
            const tutor = appState.tutors.find(t => t.id === newCourse.tutorId);
            if (tutor) {
                const skill = tutor.skills.find(s => s.sportTypeId === newCourse.sportTypeId);
                if (skill) {
                    newCourse.payoutDetails = {
                        salaryType: tutor.isEmployee ? 'perCourse' : skill.salaryType,
                        salaryValue: tutor.isEmployee ? 0 : skill.salaryValue
                    };
                }
            }
            // --- END: FIX ---

            database.ref('/courses').push(newCourse).then(() => {
                const sportTypeName = appState.sportTypes.find(st => st.id === newCourse.sportTypeId).name;
                showMessageBox(`Copied "${sportTypeName}" to ${formatDateWithWeekday(targetDate)}.`, 'success');
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

        const targetDayEl = schedulePage.querySelector(`.day-column .courses-container[data-date="${targetDate}"]`)?.closest('.day-column');
        if (targetDayEl) {
            targetDayEl.classList.add('copy-mode-paste-zone');
        }

        if (type === 'day') {
            showMessageBox('Copy Day: Select a day to copy FROM.', 'info');
            schedulePage.querySelectorAll('.day-header').forEach(headerEl => {
                if (headerEl.dataset.date !== targetDate) {
                    headerEl.classList.add('copy-mode-source');
                    headerEl.style.cursor = 'copy';
                }
            });
        } else if (type === 'class') {
            showMessageBox('Copy Class: Select a class to copy FROM.', 'info');
            schedulePage.querySelectorAll('.course-block').forEach(courseEl => {
                const course = appState.courses.find(c => c.id === courseEl.id);
                if (course && course.date !== targetDate) {
                    courseEl.classList.add('copy-mode-source-class');
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
        
        const memberBookings = appState.courses.filter(c => c.bookedBy && c.bookedBy[member.id]).sort((a, b) => new Date(b.date) - new Date(a.date));
        const purchaseHistory = firebaseObjectToArray(member.purchaseHistory);
        const paymentHistory = firebaseObjectToArray(member.paymentHistory);

        container.innerHTML = `
            <div class="w-full max-w-screen-lg mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1">
                    <div class="card p-6 text-center">
                        <h2 class="text-2xl font-bold text-slate-800">${member.name}</h2>
                        <p class="text-slate-500">${member.email}</p>
                        <hr class="my-6">
                        <div class="space-y-4 text-left">
                            ${member.monthlyPlan 
                                ? `
                                   <div><p class="text-sm text-slate-500">Join Date</p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.joinDate)}</p></div>
                                   <div><p class="text-sm text-slate-500">Plan</p><p class="font-bold text-lg text-slate-800"><span class="bg-green-100 text-green-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span></p></div>
                                   <div><p class="text-sm text-slate-500">Renews every month</p><p class="font-bold text-lg text-slate-800">${member.planStartDate ? `on the ${parseInt(member.planStartDate.split('-')[2])}${getOrdinalSuffix(parseInt(member.planStartDate.split('-')[2]))}` : 'N/A'}</p></div>
                                   <div><p class="text-sm text-slate-500">Next Payment Due</p><p class="font-bold text-lg text-slate-800">${member.paymentDueDate ? formatShortDateWithYear(member.paymentDueDate) : 'N/A'}</p></div>`
                                : `
                                   <div><p class="text-sm text-slate-500">Join Date</p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.joinDate)}</p></div>
                                   <div><p class="text-sm text-slate-500">Credits Remaining</p><p class="font-bold text-3xl text-indigo-600">
                                       <span class="bg-yellow-100 text-yellow-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCredits(member.credits)}/${formatCredits(member.initialCredits) || 'N/A'}</span>
                                   </p></div>
                                   <div><p class="text-sm text-slate-500">Credits Expire</p><p class="font-bold text-lg text-slate-800">${member.expiryDate ? formatShortDateWithYear(member.expiryDate) : 'N/A'}</p></div>`
                            }
                        </div>
                         <div class="mt-8 space-y-4">
                            <button id="editProfileBtn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Edit Profile</button>
                            <button id="changePasswordBtn" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition">Change Password</button>
                        </div>
                    </div>

                    ${member.monthlyPlan ? `
                    <div class="card p-6 mt-8">
                        <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">Payment History</h4>
                        <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                            ${paymentHistory.length > 0
                                ? paymentHistory
                                    .filter(p => p.status !== 'deleted')
                                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                                    .map(p => {
                                        let auditMessage = '';
                                        if (p.lastModifiedBy) {
                                            const action = (p.date === p.lastModifiedAt ? 'Added' : 'Edited');
                                            auditMessage = `<span class="text-xs text-slate-500 mt-1">${action} by ${p.lastModifiedBy} on ${formatShortDateWithYear(p.lastModifiedAt)}</span>`;
                                        }
                                        return `
                                            <div class="text-slate-600 bg-slate-50 p-2 rounded-md">
                                                <div><strong>${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.monthsPaid} ${p.monthsPaid === 1 ? 'month' : 'months'}</div>
                                                ${auditMessage}
                                            </div>
                                        `;
                                    }).join('')
                                : '<p class="text-sm text-slate-500 text-center">No payment history.</p>'
                            }
                        </div>
                    </div>` : `
                    <div class="card p-6 mt-8">
                        <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">Purchase History</h4>
                        <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                            ${purchaseHistory.length > 0 
                                ? purchaseHistory
                                    .filter(p => p.status !== 'deleted')
                                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                                    .map(p => {
                                        let auditMessage = '';
                                        if (p.lastModifiedBy) {
                                            const action = (p.date === p.lastModifiedAt ? 'Added' : 'Edited');
                                            auditMessage = `<span class="text-xs text-slate-500 mt-1">${action} by ${p.lastModifiedBy} on ${formatShortDateWithYear(p.lastModifiedAt)}</span>`;
                                        }
                                        return `
                                            <div class="text-slate-600 bg-slate-50 p-2 rounded-md">
                                                <div><strong>${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.credits} credits</div>
                                                ${auditMessage}
                                            </div>
                                        `;
                                    }).join('') 
                                : '<p class="text-sm text-slate-500 text-center">No purchase history.</p>'
                            }
                        </div>
                    </div>`}
                </div>
                <div class="md:col-span-2">
                    <div class="card p-6">
                        <h3 class="text-2xl font-bold text-slate-800 mb-4">My Bookings (${memberBookings.length})</h3>
                        <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                            ${memberBookings.length === 0 ? '<p class="text-slate-500">You have no upcoming or past bookings.</p>' :
                            memberBookings.map(course => {
                                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                                const isAttended = course.attendedBy && course.attendedBy[member.id];
                                const isHighlighted = course.id === appState.highlightBookingId;
                                // --- START: CLEANED LOGIC ---
                                const bookingDetails = course.bookedBy[member.id];
                                const creditsUsed = bookingDetails.creditsPaid;
                                // --- END: CLEANED LOGIC ---
                                return `<div class="${isHighlighted ? 'booking-highlight' : 'bg-slate-100'} p-4 rounded-lg flex justify-between items-center" data-course-id="${course.id}">
                                    <div>
                                        <p class="font-bold text-slate-800">${sportType.name}</p>
                                        <p class="text-sm text-slate-500">${formatShortDateWithYear(course.date)} at ${getTimeRange(course.time, course.duration)}</p>
                                        <p class="text-xs text-slate-600">Credits Used: ${creditsUsed}</p>
                                        <p class="text-xs text-slate-500">${formatBookingAuditText(bookingDetails)}</p>
                                    </div>
                                    ${isAttended 
                                        ? `<span class="text-sm font-semibold text-green-600">COMPLETED</span>`
                                        : `<button class="cancel-booking-btn-dash text-sm font-semibold text-red-600 hover:text-red-800" data-course-id="${course.id}">Cancel</button>`
                                    }
                                </div>`
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>`;

        container.querySelectorAll('.cancel-booking-btn-dash').forEach(btn => {
            btn.onclick = () => {
                const course = appState.courses.find(c => c.id === btn.dataset.courseId);
                handleCancelBooking(course);
            };
        });

        if (appState.highlightBookingId) {
            const elementToScrollTo = container.querySelector(`[data-course-id="${appState.highlightBookingId}"]`);
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
                <h2 class="text-3xl font-bold text-slate-800 mb-6 text-center">Edit Profile</h2>
                <form id="editMemberAccountForm" class="space-y-4">
                    <div>
                        <label for="editMemberName" class="block text-slate-600 text-sm font-semibold mb-2">Name</label>
                        <input type="text" id="editMemberName" required class="form-input" value="${member.name}">
                    </div>
                    <div>
                        <label for="editMemberEmail" class="block text-slate-600 text-sm font-semibold mb-2">Email</label>
                        <input type="email" id="editMemberEmail" required class="form-input" value="${member.email}" disabled>
                    </div>
                    <div>
                        <label for="editMemberPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label>
                        <div class="flex gap-2">
                            <input type="text" id="editMemberCountryCode" class="form-input w-24" placeholder="852">
                            <input type="tel" id="editMemberPhone" required class="form-input flex-grow">
                        </div>
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">Save Changes</button>
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
                showMessageBox('Profile updated successfully!', 'success');
                closeModal(DOMElements.editMemberAccountModal);
            })
            .catch(error => showMessageBox(error.message, 'error'))
            .finally(() => submitBtn.disabled = false);
    }

    function openChangePasswordModal() {
        DOMElements.changePasswordModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-6 text-center">Change Password</h2>
                <form id="changePasswordForm" class="space-y-4">
                    <div>
                        <label for="currentPassword" class="block text-slate-600 text-sm font-semibold mb-2">Current Password</label>
                        <input type="password" id="currentPassword" required class="form-input">
                    </div>
                    <div>
                        <label for="newPassword" class="block text-slate-600 text-sm font-semibold mb-2">New Password</label>
                        <input type="password" id="newPassword" required class="form-input">
                    </div>
                    <div>
                        <label for="confirmNewPassword" class="block text-slate-600 text-sm font-semibold mb-2">Confirm New Password</label>
                        <input type="password" id="confirmNewPassword" required class="form-input">
                    </div>
                    <div class="flex justify-center mt-8">
                        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">Change Password</button>
                    </div>
                </form>
            </div>
        `;
        const form = DOMElements.changePasswordModal.querySelector('#changePasswordForm');
        form.onsubmit = handleChangePasswordSubmit;
        openModal(DOMElements.changePasswordModal);
    }

    function handleChangePasswordSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const currentPassword = form.querySelector('#currentPassword').value;
        const newPassword = form.querySelector('#newPassword').value;
        const confirmNewPassword = form.querySelector('#confirmNewPassword').value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (newPassword !== confirmNewPassword) {
            showMessageBox('New passwords do not match.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showMessageBox('Password should be at least 6 characters.', 'error');
            return;
        }

        submitBtn.disabled = true;
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        user.reauthenticateWithCredential(credential)
            .then(() => user.updatePassword(newPassword))
            .then(() => {
                showMessageBox('Password changed successfully!', 'success');
                closeModal(DOMElements.changePasswordModal);
            })
            .catch(error => showMessageBox(error.message, 'error'))
            .finally(() => submitBtn.disabled = false);
    }

    function renderMembersPage(container) {
        const memberCount = appState.users.filter(u => u.role !== 'owner' && u.role !== 'staff' && !u.isDeleted).length;
        const isOwner = appState.currentUser?.role === 'owner';

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Manage Members (${memberCount})</h2>
                    <div class="flex flex-wrap items-center justify-end gap-4">
                        <div class="relative w-64">
                            <input type="text" id="memberSearchInput" placeholder="Search by name, email, phone..." class="form-input w-full pr-10">
                            <button id="clearSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" style="display: none;">
                                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        ${isOwner ? `
                        <div class="relative" id="exportMenuContainer">
                            <button id="exportMembersBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                                Export
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </button>
                            <div id="exportMembersDropdown" class="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 hidden" role="menu" aria-orientation="vertical" aria-labelledby="exportMembersBtn">
                                <div class="p-1" role="none">
                                    <a href="#" id="exportSummaryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <span class="font-medium">Export Member Summary</span>
                                    </a>
                                    <a href="#" id="exportBookingHistoryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span class="font-medium">Export Full Booking History</span>
                                    </a>
                                    <a href="#" id="exportFinancialHistoryBtn" class="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-indigo-50 hover:text-indigo-900 transition-colors duration-150" role="menuitem">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        <span class="font-medium">Export Full Financial History</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                 <div class="w-full mt-4 mb-6 p-4 bg-slate-50 border rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 class="font-semibold text-slate-800">Auto-Adjust Monthly Plans</h4>
                        <p class="text-sm text-slate-600">Recalculate estimated courses and credit values for all monthly members based on the last 30 days of attendance.</p>
                    </div>
                    <button id="recalculatePlansBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition w-full sm:w-auto flex-shrink-0">Recalculate All</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 sortable cursor-pointer" data-sort-key="name">Name<span class="sort-icon"></span></th>
                                <th class="p-2">Contact</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="joinDate">Join<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="credits">Credits/Plan<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="expiryDate">Credit Expiry / Due Date<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="lastBooking">Last Active<span class="sort-icon"></span></th>
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
            
            // --- START: MODIFIED LOGIC (FILTER FIRST, THEN SORT) ---
            // 1. Filter out non-members AND apply search term first.
            const filteredUsers = appState.users.filter(u => 
                u.role !== 'owner' && u.role !== 'staff' && !u.isDeleted && (
                !searchTerm ||
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.phone && u.phone.includes(searchTerm)))
            );

            // 2. Now, sort the clean, filtered list.
            const sortedUsers = filteredUsers.sort((a, b) => {
                // The problematic check for admin roles is now gone.
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
            // --- END: MODIFIED LOGIC ---

            tableBody.innerHTML = sortedUsers.map(member => { // Use the newly sorted list
                const expiryOrDueDate = member.monthlyPlan 
                    ? (member.paymentDueDate ? formatShortDateWithYear(member.paymentDueDate) : 'N/A')
                    : (member.expiryDate ? formatShortDateWithYear(member.expiryDate) : 'N/A');

                return `
                <tr class="border-b border-slate-100">
                    <td class="p-2 font-semibold"><button class="text-indigo-600 hover:underline member-name-btn" data-id="${member.id}">${member.name}</button></td>
                    <td class="p-2 text-sm"><div>${member.email}</div><div>${formatDisplayPhoneNumber(member.phone)}</div></td>
                    <td class="p-2 text-sm">${member.joinDate ? formatShortDateWithYear(member.joinDate) : 'N/A'}</td>
                    <td class="p-2">${member.monthlyPlan 
                        ? `<span class="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span>` 
                        : `<span class="bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded-full">${formatCredits(member.credits)}/${formatCredits(member.initialCredits) || 'N/A'}</span>`}
                    </td>
                    <td class="p-2 text-sm">${expiryOrDueDate}</td>
                    <td class="p-2 text-sm">${member.lastBooking ? formatShortDateWithYear(member.lastBooking) : 'N/A'}</td>
                    <td class="p-2 text-right space-x-2">
                        <button class="edit-member-btn font-semibold text-indigo-600" data-id="${member.id}">Edit</button>
                        <button class="delete-member-btn font-semibold text-red-600" data-id="${member.id}" data-name="${member.name}">Delete</button>
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
                        showMessageBox('Could not find member to delete.', 'error');
                        return;
                    }
                    showConfirmation('Anonymize Member', `This will cancel all of <strong>${memberName}</strong>'s upcoming bookings and anonymize their record. Attended course history and revenue will be preserved. This cannot be undone.`, () => {
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
                showMessageBox('Generating member summary...', 'info', 2000);
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
                    Name: member.name,
                    Email: member.email,
                    Phone: member.phone,
                    JoinDate: member.joinDate ? member.joinDate.slice(0, 10) : '',
                    PlanType: member.monthlyPlan ? 'Monthly' : 'Credits',
                    MonthlyPlanAmount: member.monthlyPlanAmount || 0,
                    PaymentDueDate: member.monthlyPlan ? (member.paymentDueDate || '') : 'N/A',
                    CreditsRemaining: member.monthlyPlan ? 'N/A' : (member.credits || 0),
                    CreditsInitial: member.monthlyPlan ? 'N/A' : (member.initialCredits || 0),
                    CreditExpiryDate: member.monthlyPlan ? 'N/A' : (member.expiryDate || ''),
                    LastActiveDate: member.lastBooking ? member.lastBooking.slice(0, 10) : ''
                }));
                exportToCsv('member-summary', exportData);
            };
    
            container.querySelector('#exportBookingHistoryBtn').onclick = async (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox('Generating booking history... This may take a moment.', 'info', 5000);
                try {
                    const usersSnapshot = await database.ref('/users').once('value');
                    const coursesSnapshot = await database.ref('/courses').once('value');
                    const allUsers = firebaseObjectToArray(usersSnapshot.val());
                    const allCourses = firebaseObjectToArray(coursesSnapshot.val());
                    const exportData = [];
                    const members = allUsers.filter(u => u.role === 'member' && !u.isDeleted);
                    members.forEach(member => {
                        allCourses.forEach(course => {
                            if (course.bookedBy && course.bookedBy[member.id]) {
                                const bookingInfo = course.bookedBy[member.id];
                                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                                const tutor = appState.tutors.find(t => t.id === course.tutorId);
                                exportData.push({
                                    MemberName: member.name,
                                    MemberEmail: member.email,
                                    BookingDate: course.date,
                                    CourseName: sportType?.name || 'Unknown',
                                    TutorName: tutor?.name || 'Unknown',
                                    CreditsUsed: course.credits,
                                    WasAttended: (course.attendedBy && course.attendedBy[member.id]) ? 'Yes' : 'No',
                                    BookingMadeOn: bookingInfo.bookedAt ? bookingInfo.bookedAt.slice(0, 10) : '',
                                    BookingMadeBy: bookingInfo.bookedBy || 'Unknown'
                                });
                            }
                        });
                    });
                    
                    exportData.sort((a, b) => {
                        const nameComparison = a.MemberName.localeCompare(b.MemberName);
                        if (nameComparison !== 0) {
                            return nameComparison;
                        }
                        return a.BookingDate.localeCompare(b.BookingDate);
                    });
                    
                    exportToCsv('member-full-booking-history', exportData);
                } catch (error) {
                    console.error("Error generating booking history export:", error);
                    showMessageBox('Failed to generate booking history. Please try again.', 'error');
                }
            };
    
            container.querySelector('#exportFinancialHistoryBtn').onclick = async (e) => {
                e.preventDefault();
                exportDropdown.classList.add('hidden');
                showMessageBox('Generating full financial history... This may take a moment.', 'info', 5000);
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
                                        MemberName: member.name,
                                        MemberEmail: member.email,
                                        TransactionDate: p.date ? p.date.slice(0, 10) : '',
                                        TransactionType: 'Credit Purchase',
                                        Description: `${p.credits} credits`,
                                        Amount: p.amount,
                                        ModifiedBy: p.lastModifiedBy || '',
                                        ModifiedDate: p.lastModifiedAt ? p.lastModifiedAt.slice(0, 10) : ''
                                    });
                                });
                        }
                        if (member.paymentHistory) {
                            firebaseObjectToArray(member.paymentHistory)
                                .filter(p => p.status !== 'deleted')
                                .forEach(p => {
                                    exportData.push({
                                        MemberName: member.name,
                                        MemberEmail: member.email,
                                        TransactionDate: p.date ? p.date.slice(0, 10) : '',
                                        TransactionType: 'Monthly Payment',
                                        Description: `${p.monthsPaid} month(s)`,
                                        Amount: p.amount,
                                        ModifiedBy: p.lastModifiedBy || '',
                                        ModifiedDate: p.lastModifiedAt ? p.lastModifiedAt.slice(0, 10) : ''
                                    });
                                });
                        }
                    });

                    exportData.sort((a, b) => {
                        const nameComparison = a.MemberName.localeCompare(b.MemberName);
                        if (nameComparison !== 0) return nameComparison;
                        return new Date(a.TransactionDate) - new Date(b.TransactionDate);
                    });
                    
                    exportToCsv('member-financial-history', exportData);
                } catch (error) {
                    console.error("Error generating financial history export:", error);
                    showMessageBox('Failed to generate financial history. Please try again.', 'error');
                }
            };
        }

        updateTable();

        container.querySelector('#recalculatePlansBtn').onclick = () => {
            showConfirmation(
                'Recalculate Monthly Plans?',
                'This will analyze the last 30 days of attendance for all monthly members and update their estimated course counts and credit values. This action cannot be undone.',
                recalculateMonthlyPlans
            );
        };
    }

    function handleMemberDeletion(member) {
        const memberId = member.id;
        const updates = {};
        let upcomingCancellations = 0;

        // Find all courses this member is booked on
        const memberBookings = appState.courses.filter(c => c.bookedBy && c.bookedBy[memberId]);
        
        memberBookings.forEach(course => {
            const isAttended = course.attendedBy && course.attendedBy[memberId];
            
            // Only cancel upcoming, non-attended bookings
            if (!isAttended) {
                updates[`/courses/${course.id}/bookedBy/${memberId}`] = null;
                updates[`/memberBookings/${memberId}/${course.id}`] = null; // New index
                upcomingCancellations++;
            }
        });

        // Anonymize the user's record instead of deleting it.
        // This preserves their purchase history for accurate revenue calculations.
        updates[`/users/${memberId}/name`] = 'Deleted Member';
        updates[`/users/${memberId}/email`] = 'anonymized@studiopulse.app';
        updates[`/users/${memberId}/phone`] = '';
        updates[`/users/${memberId}/credits`] = 0;
        updates[`/users/${memberId}/isDeleted`] = true; // Add a flag

        database.ref().update(updates)
            .then(() => {
                showMessageBox(`Member ${member.name} anonymized. ${upcomingCancellations} upcoming booking(s) cancelled.`, 'success');
            })
            .catch(error => {
                showMessageBox(`Error: ${error.message}`, 'error');
            });
    }

    function _renderMemberPurchaseHistory(member, container, historyIdInput, purchaseAmountInput, creditsInput, onEditStart) {
        container.innerHTML = ''; 
        const purchaseHistory = firebaseObjectToArray(member.purchaseHistory);
        
        if (purchaseHistory.length > 0) {
            const sortedHistory = purchaseHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = sortedHistory.map(p => {
                // --- START: Replacement logic for rendering audit trail ---
                const costPerCredit = p.costPerCredit ? formatCurrency(p.costPerCredit) : 'N/A';
                const isDeleted = p.status === 'deleted';
                
                let auditMessage = '';
                if (p.lastModifiedBy) {
                    const action = isDeleted ? 'Deleted' : (p.date === p.lastModifiedAt ? 'Added' : 'Edited');
                    auditMessage = `<span class="text-xs text-slate-500 mt-1">${action} by ${p.lastModifiedBy} on ${formatShortDateWithYear(p.lastModifiedAt)}</span>`;
                }

                return `
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-md transition ${isDeleted ? 'opacity-50' : ''}" data-history-item-id="${p.id}">
                        <div class="flex-grow cursor-pointer hover:bg-slate-200 p-1 rounded-md">
                            <div class="flex flex-col">
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.credits} credits <span class="text-xs text-slate-500">(${costPerCredit}/credit)</span>
                                ${auditMessage}
                            </div>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none ${isDeleted ? 'hidden' : ''}" data-history-id="${p.id}" title="Remove entry">×</button>
                    </div>`;
                // --- END: Replacement logic for rendering audit trail ---
            }).join('');
        } else {
             container.innerHTML = '<p class="text-sm text-slate-500 text-center">No purchase history.</p>';
        }

        container.onclick = (e) => {
            const editTarget = e.target.closest('[data-history-item-id] .flex-grow');
            const removeTarget = e.target.closest('.remove-history-btn');

            container.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            
            if (removeTarget) {
                const historyId = removeTarget.dataset.historyId;
                const entryToUpdate = purchaseHistory.find(p => p.id === historyId);
                const memberId = member.id;

                // --- START: Replacement logic for soft delete ---
                if (entryToUpdate.status === 'deleted') {
                    showMessageBox('This entry has already been deleted.', 'info');
                    return;
                }

                showConfirmation('Delete Purchase Entry', `Are you sure you want to delete this entry? This will also deduct ${entryToUpdate.credits} credits from the member's balance.`, () => {
                    const updates = {
                        status: 'deleted',
                        lastModifiedBy: appState.currentUser.name,
                        lastModifiedAt: new Date().toISOString()
                    };

                    database.ref(`/users/${memberId}/purchaseHistory/${historyId}`).update(updates)
                        .then(() => {
                            // Deduct the credits from the member's balance
                            return database.ref(`/users/${memberId}`).transaction(user => {
                                if (user) {
                                    user.credits = (user.credits || 0) - entryToUpdate.credits;
                                    user.initialCredits = (user.initialCredits || 0) - entryToUpdate.credits;
                                }
                                return user;
                            });
                        })
                        .then(() => {
                            // Refresh the modal's list with the updated data
                            database.ref(`/users/${memberId}`).once('value', snapshot => {
                                const updatedMember = { id: snapshot.key, ...snapshot.val() };
                                _renderMemberPurchaseHistory(updatedMember, container, historyIdInput, purchaseAmountInput, creditsInput);
                                showMessageBox('Purchase entry deleted.', 'info');
                            });
                        })
                        .catch(error => {
                            showMessageBox(`Error deleting entry: ${error.message}`, 'error');
                        });
                });
                // --- END: Replacement logic for soft delete ---
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
                    showMessageBox(`Editing purchase from ${formatShortDateWithYear(historyEntry.date)}.`, 'info');
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
                
                let auditMessage = '';
                if (p.lastModifiedBy) {
                    const action = isDeleted ? 'Deleted' : (p.date === p.lastModifiedAt ? 'Added' : 'Edited');
                    auditMessage = `<span class="text-xs text-slate-500 mt-1">${action} by ${p.lastModifiedBy} on ${formatShortDateWithYear(p.lastModifiedAt)}</span>`;
                }

                return `
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-md transition ${isDeleted ? 'opacity-50' : ''}" data-history-item-id="${p.id}">
                        <div class="flex-grow cursor-pointer hover:bg-slate-200 p-1 rounded-md">
                            <div class="flex flex-col">
                                <strong class="${isDeleted ? 'line-through' : ''}">${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.monthsPaid} ${p.monthsPaid === 1 ? 'month' : 'months'}
                                ${auditMessage}
                            </div>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none ${isDeleted ? 'hidden' : ''}" data-history-id="${p.id}" title="Remove entry">×</button>
                    </div>`;
            }).join('');
        } else {
             container.innerHTML = '<p class="text-sm text-slate-500 text-center">No payment history.</p>';
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
                    showMessageBox('This entry has already been deleted.', 'info');
                    return;
                }

                showConfirmation('Delete Payment Entry', `Are you sure you want to delete this payment entry? This action is for record-keeping and cannot be undone.`, () => {
                    const updates = {
                        status: 'deleted',
                        lastModifiedBy: appState.currentUser.name,
                        lastModifiedAt: new Date().toISOString()
                    };

                    database.ref(`/users/${memberId}/paymentHistory/${historyId}`).update(updates)
                        .then(() => {
                            // Refresh the modal's list with the updated data
                            database.ref(`/users/${memberId}`).once('value', snapshot => {
                                const updatedMember = { id: snapshot.key, ...snapshot.val() };
                                _renderMemberPaymentHistory(updatedMember, container, historyIdInput, monthsPaidInput, paymentAmountInput, onEditStart);
                                showMessageBox('Payment entry deleted.', 'info');
                            });
                        })
                        .catch(error => {
                            showMessageBox(`Error deleting entry: ${error.message}`, 'error');
                        });
                });
            }
            else if (editTarget) {
                const parentItem = editTarget.closest('[data-history-item-id]');
                const id = parentItem.dataset.historyItemId;
                const historyEntry = paymentHistory.find(p => p.id === id);
                if (historyEntry) {
                    monthsPaidInput.value = historyEntry.monthsPaid;
                    // The paymentAmount is derived from monthsPaid, so let's trigger the input event to calculate it
                    monthsPaidInput.dispatchEvent(new Event('input'));
                    historyIdInput.value = id;
                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(`Editing payment from ${formatShortDateWithYear(historyEntry.date)}.`, 'info');
                    onEditStart();
                }
            }
        };
    }

    function openMemberModal(memberToEdit) {
        DOMElements.memberModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="memberModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">Edit Member</h2>
                <form id="memberForm" class="space-y-4">
                    <input type="hidden" id="memberModalId">
                    <input type="hidden" id="purchaseHistoryId">
                    <input type="hidden" id="paymentHistoryId">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberName" class="block text-slate-600 text-sm font-semibold mb-2">Member Name</label><input type="text" id="memberName" required class="form-input"></div>
                        <div><label for="memberEmail" class="block text-slate-600 text-sm font-semibold mb-2">Email Address</label><input type="email" id="memberEmail" required class="form-input" disabled></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label><div class="flex gap-2"><input type="text" id="memberCountryCode" class="form-input w-24" placeholder="852"><input type="tel" id="memberPhone" required class="form-input flex-grow"></div></div>
                        <div><label class="block text-slate-600 text-sm font-semibold mb-2">Password</label><button type="button" id="resetPasswordBtn" class="form-input text-left text-indigo-600 hover:bg-slate-100">Reset Password</button></div>
                    </div>
                    <div class="pt-4 border-t">
                        <div class="flex items-center mb-4"><input type="checkbox" id="monthlyPlan" class="h-4 w-4 rounded text-indigo-600"><label for="monthlyPlan" class="ml-2 text-slate-700">Monthly Plan</label></div>
                        <div id="creditFields" class="space-y-4">
                            <div class="flex items-end gap-2">
                                <div class="flex-grow"><label for="purchaseAmount" class="block text-slate-600 text-sm font-semibold mb-2">Top-up Amount ($)</label><input type="number" id="purchaseAmount" class="form-input" min="0"></div>
                                <div class="flex-grow"><label for="creditsToAdd" class="block text-slate-600 text-sm font-semibold mb-2">Credits to Add/Edit</label><input type="number" id="creditsToAdd" class="form-input" min="0"></div>
                                <button type="button" id="creditActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                <!-- NEW: Cancel button for credit edit -->
                                <button type="button" id="cancelCreditEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">Cancel</button>
                            </div>
                            <div id="purchaseHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1"></div>
                            <div>
                                <label for="expiryDate" class="block text-slate-600 text-sm font-semibold mb-2">Credit Expiry Date</label>
                                <div class="flex gap-2 mb-2">
                                    <button type="button" data-years="1" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">1 Year</button>
                                    <button type="button" data-years="2" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">2 Years</button>
                                    <button type="button" data-years="3" class="expiry-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">3 Years</button>
                                </div>
                                <input type="date" id="expiryDate" class="form-input">
                            </div>
                        </div>
                        <div id="monthlyPlanFields" class="hidden space-y-4">
                            <!-- Row 1: Plan Start Date & Monthly Amount -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="planStartDate" class="block text-slate-600 text-sm font-semibold mb-2">Plan Start Date</label>
                                    <input type="date" id="planStartDate" class="form-input">
                                </div>
                                <div>
                                    <label for="monthlyPlanAmount" class="block text-slate-600 text-sm font-semibold mb-2">Monthly Amount ($)</label>
                                    <input type="number" id="monthlyPlanAmount" class="form-input" min="0">
                                </div>
                            </div>
                            <!-- Row 2: Payment History Section -->
                            <div class="pt-4 border-t border-slate-200">
                                <div class="flex items-end gap-2">
                                    <div class="flex-grow">
                                        <label for="monthsPaid" class="block text-slate-600 text-sm font-semibold mb-1">Months Paid</label>
                                        <input type="number" id="monthsPaid" class="form-input" min="1" step="1">
                                    </div>
                                    <div class="flex-grow">
                                        <label for="paymentAmount" class="block text-slate-600 text-sm font-semibold mb-1">Payment Amount ($)</label>
                                        <input type="number" id="paymentAmount" class="form-input" min="0" step="0.01">
                                    </div>
                                    <button type="button" id="paymentActionBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white"></button>
                                    <!-- NEW: Cancel button for payment edit -->
                                    <button type="button" id="cancelPaymentEditBtn" class="font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white bg-slate-400 hover:bg-slate-500 hidden">Cancel</button>
                                </div>
                                <div id="paymentHistoryContainer" class="space-y-2 max-h-32 overflow-y-auto p-1 mt-2"></div>
                            </div>
                             <!-- Row 3: Due Date Quick Set Buttons -->
                            <div class="flex gap-2">
                                <button type="button" data-months="3" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">3 Months</button>
                                <button type="button" data-months="6" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">6 Months</button>
                                <button type="button" data-months="12" class="due-date-quick-select-btn flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-1 px-2 rounded-md text-sm transition">1 Year</button>
                            </div>
                            <!-- Row 4: Payment Due Date & Est. Attendance -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="paymentDueDate" class="block text-slate-600 text-sm font-semibold mb-2">Payment Due Date</label>
                                    <input type="date" id="paymentDueDate" class="form-input">
                                </div>
                                <div>
                                    <label for="monthlyPlanEstimatedAttendance" class="block text-slate-600 text-sm font-semibold mb-2">Est. Monthly Attendance</label>
                                    <input type="number" id="monthlyPlanEstimatedAttendance" class="form-input" min="1" step="1" placeholder="e.g., 8">
                                </div>
                            </div>
                            <!-- Bottom: Calculated Value -->
                            <div id="calculatedCreditValueContainer" class="bg-slate-100 p-3 rounded-lg text-center mt-4">
                                <p class="text-sm text-slate-500">Calculated Credit Value</p>
                                <p id="calculatedCreditValueDisplay" class="text-xl font-bold text-indigo-600"></p>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg">Save Changes</button></div>
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
        const cancelCreditEditBtn = form.querySelector('#cancelCreditEditBtn'); // NEW: Cache cancel button

        const paymentHistoryContainer = form.querySelector('#paymentHistoryContainer');
        const paymentHistoryIdInput = form.querySelector('#paymentHistoryId');
        const monthsPaidInput = form.querySelector('#monthsPaid');
        const paymentAmountInput = form.querySelector('#paymentAmount');
        const paymentActionBtn = form.querySelector('#paymentActionBtn');
        const cancelPaymentEditBtn = form.querySelector('#cancelPaymentEditBtn'); // NEW: Cache cancel button
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
                    showMessageBox('Please set a Plan Start Date first.', 'info');
                    return;
                }

                const baseDate = new Date(baseDateString + 'T12:00:00Z');
                if (isNaN(baseDate.getTime())) {
                    showMessageBox('Invalid base date for calculation.', 'error');
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

        // --- Credit History Button Logic ---
        const setCreditButtonToAddMode = () => {
            creditActionBtn.innerHTML = plusIconSVG;
            creditActionBtn.title = 'Add new credit entry';
            creditActionBtn.className = 'creditActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            purchaseAmountInput.value = '';
            creditsInput.value = '';
            historyIdInput.value = '';
            historyContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelCreditEditBtn.classList.add('hidden'); // MODIFIED: Hide cancel button
        };

        const setCreditButtonToEditMode = () => {
            creditActionBtn.innerHTML = checkIconSVG;
            creditActionBtn.title = 'Save this entry';
            creditActionBtn.className = 'creditActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelCreditEditBtn.classList.remove('hidden'); // MODIFIED: Show cancel button
        };
        setCreditButtonToAddMode(); 

        // NEW: Assign the reset function to the cancel button's click event
        cancelCreditEditBtn.onclick = setCreditButtonToAddMode;

        creditActionBtn.onclick = () => {
            const historyId = historyIdInput.value;
            let memberId = memberToEdit.id; 
            const amount = parseFloat(purchaseAmountInput.value);
            const credits = parseFloat(creditsInput.value);
            if (historyId) {
                 if (isNaN(amount) || isNaN(credits) || amount < 0 || credits < 0) { showMessageBox('Please enter a valid amount and credits.', 'error'); return; }
                const originalEntry = firebaseObjectToArray(memberToEdit.purchaseHistory).find(p => p.id === historyId);
                if (!originalEntry) { showMessageBox('Could not find original entry.', 'error'); return; }
                const creditDifference = credits - originalEntry.credits;
                const entryUpdate = { amount, credits, costPerCredit: amount / credits, lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}/purchaseHistory/${historyId}`).update(entryUpdate).then(() => database.ref(`/users/${memberId}`).transaction(user => {
                    if (user) { user.credits = (user.credits || 0) + creditDifference; user.initialCredits = (user.initialCredits || 0) + creditDifference; } return user;
                })).then(() => {
                    showMessageBox('Purchase entry updated!', 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode); setCreditButtonToAddMode(); });
                }).catch(error => showMessageBox(`Update failed: ${error.message}`, 'error'));
            } else {
                if (isNaN(amount) || isNaN(credits) || amount <= 0 || credits <= 0) { showMessageBox('Please enter a valid amount and credits to add.', 'error'); return; }
                const newPurchaseRef = database.ref(`/users/${memberId}/purchaseHistory`).push();
                const newPurchase = { date: new Date().toISOString(), amount, credits, costPerCredit: amount / credits, status: 'active', lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}`).transaction(user => { if (user) { user.credits = (user.credits || 0) + credits; user.initialCredits = (user.initialCredits || 0) + credits; } return user;
                }).then(() => newPurchaseRef.set(newPurchase)).then(() => {
                    showMessageBox('New credit entry added!', 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput, setCreditButtonToEditMode); setCreditButtonToAddMode(); });
                }).catch(error => showMessageBox(`Error adding credits: ${error.message}`, 'error'));
            }
        };

        // --- Payment History Logic ---
        const autoCalculatePayment = () => {
            const months = parseInt(monthsPaidInput.value) || 0;
            const monthlyAmount = parseFloat(monthlyPlanAmountInput.value) || 0;
            paymentAmountInput.value = (months * monthlyAmount).toFixed(2);
        };
        monthsPaidInput.oninput = autoCalculatePayment;
        monthlyPlanAmountInput.addEventListener('input', autoCalculatePayment);

        const setPaymentButtonToAddMode = () => {
            paymentActionBtn.innerHTML = plusIconSVG;
            paymentActionBtn.title = 'Add new payment entry';
            paymentActionBtn.className = 'paymentActionBtn bg-green-500 hover:bg-green-600 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            monthsPaidInput.value = '';
            paymentAmountInput.value = '';
            paymentHistoryIdInput.value = '';
            paymentHistoryContainer.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            cancelPaymentEditBtn.classList.add('hidden'); // MODIFIED: Hide cancel button
        };

        const setPaymentButtonToEditMode = () => {
            paymentActionBtn.innerHTML = checkIconSVG;
            paymentActionBtn.title = 'Save this payment entry';
            paymentActionBtn.className = 'paymentActionBtn bg-indigo-600 hover:bg-indigo-700 font-bold py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition text-white';
            cancelPaymentEditBtn.classList.remove('hidden'); // MODIFIED: Show cancel button
        };

        setPaymentButtonToAddMode();

        // NEW: Assign the reset function to the cancel button's click event
        cancelPaymentEditBtn.onclick = setPaymentButtonToAddMode;

        paymentActionBtn.onclick = () => {
            const historyId = paymentHistoryIdInput.value;
            const memberId = memberToEdit.id;
            const monthsPaid = parseInt(monthsPaidInput.value);
            const amount = parseFloat(paymentAmountInput.value);

            if (isNaN(monthsPaid) || monthsPaid <= 0) { showMessageBox('Please enter a valid number of months paid.', 'error'); return; }
            if ((parseFloat(monthlyPlanAmountInput.value) || 0) <= 0) { showMessageBox('A Monthly Amount must be set to log a payment.', 'error'); return; }
            if (isNaN(amount) || amount < 0) { showMessageBox('Please enter a valid payment amount.', 'error'); return; }


            if (historyId) { // Update
                const entryUpdate = { monthsPaid, amount, lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                database.ref(`/users/${memberId}/paymentHistory/${historyId}`).update(entryUpdate).then(() => {
                    showMessageBox('Payment entry updated!', 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode); setPaymentButtonToAddMode(); });
                }).catch(error => showMessageBox(`Update failed: ${error.message}`, 'error'));
            } else { // Add
                const newPaymentRef = database.ref(`/users/${memberId}/paymentHistory`).push();
                const newPayment = { date: new Date().toISOString(), monthsPaid, amount, status: 'active', lastModifiedBy: appState.currentUser.name, lastModifiedAt: new Date().toISOString() };
                newPaymentRef.set(newPayment).then(() => {
                    showMessageBox('New payment entry added!', 'success');
                    database.ref(`/users/${memberId}`).once('value', snapshot => { memberToEdit = { id: snapshot.key, ...snapshot.val() }; _renderMemberPaymentHistory(memberToEdit, paymentHistoryContainer, paymentHistoryIdInput, monthsPaidInput, paymentAmountInput, setPaymentButtonToEditMode); setPaymentButtonToAddMode(); });
                }).catch(error => showMessageBox(`Error adding payment: ${error.message}`, 'error'));
            }
        };

        // --- Form Population and Setup ---
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
                calculatedCreditValueDisplay.textContent = `${formatCurrency(amount / attendance)} per credit`;
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
                .then(() => showMessageBox(`Password reset email sent to ${memberToEdit.email}`, 'success'))
                .catch(error => showMessageBox(error.message, 'error'));
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
            showMessageBox('Error: Could not find member to update.', 'error');
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
                showMessageBox('Estimated Monthly Attendance must be greater than 0 when a Monthly Amount is set.', 'error');
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
                showMessageBox('An Credit Expiry Date is required for members with a credit balance.', 'error');
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
            showMessageBox('Member updated successfully.', 'success');
            closeModal(DOMElements.memberModal);
        }).catch(error => showMessageBox(error.message, 'error'));
    }
    
    async function recalculateMonthlyPlans() {
        showMessageBox('Starting recalculation... This may take a moment.', 'info', 5000);

        try {
            const usersSnapshotPromise = database.ref('/users').once('value');
            
            // Normalize "today" to the start of the day (midnight) for consistent calculations.
            const today = new Date();
            today.setHours(0, 0, 0, 0); 

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            thirtyDaysAgo.setHours(0, 0, 0, 0); // Also normalize the 30-day mark

            // Efficiently fetch only the courses from the last 30 days.
            const coursesSnapshotPromise = database.ref('/courses').orderByChild('date').startAt(getIsoDate(thirtyDaysAgo)).once('value');
            
            const [usersSnapshot, coursesSnapshot] = await Promise.all([usersSnapshotPromise, coursesSnapshotPromise]);

            const allUsers = firebaseObjectToArray(usersSnapshot.val());
            const recentCourses = firebaseObjectToArray(coursesSnapshot.val());
            
            // Filter for the correct target members.
            const monthlyMembers = allUsers.filter(u => u.role === 'member' && u.monthlyPlan && !u.isDeleted && u.planStartDate);
            
            if (monthlyMembers.length === 0) {
                showMessageBox('No active monthly members with a plan start date found to recalculate.', 'info');
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

                const attendedCoursesCount = recentCourses.filter(course => {
                    const courseDate = new Date(course.date);
                    return course.attendedBy && course.attendedBy[member.id] &&
                           courseDate >= observationStartDate && courseDate <= today;
                }).length;

                const dailyAttendanceRate = attendedCoursesCount / activeDays;
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
                showMessageBox(`Recalculation complete! ${updatedCount} member plan(s) were updated.`, 'success');
            } else {
                showMessageBox('Recalculation complete. No plan estimates required an update at this time.', 'info');
            }

        } catch (error) {
            console.error('Error during plan recalculation:', error);
            showMessageBox('An error occurred during recalculation. Please check the console.', 'error');
        }
    }

    function calculateRevenueForBookings(bookings) {
        const bookingsByMember = bookings.reduce((acc, booking) => {
            const memberId = booking.member.id;
            if (!acc[memberId]) {
                acc[memberId] = [];
            }
            acc[memberId].push(booking.course);
            return acc;
        }, {});

        let totalGrossRevenue = 0;
        const revenueByCourseId = new Map();

        for (const memberId in bookingsByMember) {
            const member = appState.users.find(u => u.id === memberId);
            if (!member) continue;

            const memberCourses = bookingsByMember[memberId].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

            if (member.monthlyPlan) {
                for (const course of memberCourses) {
                    const bookingInfo = course.bookedBy[member.id];
                    
                    // --- MODIFIED: Use the frozen value from the booking object ---
                    // It checks for the new object format first, with a fallback for any old data.
                    const creditValueForThisBooking = (typeof bookingInfo === 'object' && bookingInfo.monthlyCreditValue)
                        ? bookingInfo.monthlyCreditValue
                        : (member.monthlyCreditValue || 0); // Fallback for legacy bookings
                    
                    const revenue = (course.credits || 0) * creditValueForThisBooking;
                    totalGrossRevenue += revenue;
                    revenueByCourseId.set(course.id, (revenueByCourseId.get(course.id) || 0) + revenue);
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
            
            for (const course of memberCourses) {
                let creditsToDeduct = course.credits;
                let courseRevenue = 0;

                for (const purchase of purchasePool) {
                    if (creditsToDeduct <= 0) break;
                    if (purchase.remainingCredits <= 0) continue;

                    const deductFromThisPool = Math.min(creditsToDeduct, purchase.remainingCredits);
                    courseRevenue += deductFromThisPool * purchase.costPerCredit;
                    purchase.remainingCredits -= deductFromThisPool;
                    creditsToDeduct -= deductFromThisPool;
                }
                totalGrossRevenue += courseRevenue;
                revenueByCourseId.set(course.id, (revenueByCourseId.get(course.id) || 0) + courseRevenue);
            }
        }
        return { grossRevenue: totalGrossRevenue, revenueByCourseId };
    }

    function handleAdminSettingsSave(e) {
        e.preventDefault();
        const form = e.target;
        const saveBtn = form.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const newDefaults = {
            time: form.querySelector('#defaultTime').value,
            duration: parseInt(form.querySelector('#defaultDuration').value),
            credits: parseFloat(form.querySelector('#defaultCredits').value),
            maxParticipants: parseInt(form.querySelector('#defaultMaxParticipants').value)
        };

        database.ref('/studioSettings/courseDefaults').set(newDefaults)
            .then(() => {
                showMessageBox('Default course settings saved successfully!', 'success');
            })
            .catch(error => {
                showMessageBox(`Error saving settings: ${error.message}`, 'error');
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Defaults';
            });
    }

    function renderAdminPage(container) {
        // --- START: MODIFIED LOGIC ---
        const isOwner = appState.currentUser?.role === 'owner';
        
        // The grid layout is made more dynamic based on the user's role.
        const gridClasses = isOwner ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
        // --- END: MODIFIED LOGIC ---

        container.innerHTML = `
            <div class="space-y-8">
                <!-- START: MODIFIED LOGIC -->
                <div class="grid ${gridClasses} gap-8 items-start">
                    <div class="card p-6 flex flex-col">
                        <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                            <h3 id="sportsHeader" class="text-2xl font-bold text-slate-800"></h3>
                            <div class="relative">
                                <input type="text" id="sportSearchInput" placeholder="Search..." class="form-input w-40 pr-8" value="${appState.searchTerms.sports}">
                                <button id="clearSportSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden" aria-label="Clear search">
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <button id="addSportTypeBtn" class="w-full mb-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Sport Type</button>
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
                                <input type="text" id="tutorSearchInput" placeholder="Search..." class="form-input w-40 pr-8" value="${appState.searchTerms.tutors}">
                                <button id="clearTutorSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 hidden" aria-label="Clear search">
                                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <button id="addTutorBtn" class="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Tutor</button>
                        <div class="flex-grow">
                             <ul id="tutorsList" class="admin-list space-y-2"></ul>
                        </div>
                        <div id="tutorsPagination" class="flex justify-between items-center mt-4"></div>
                    </div>
                    ` : ''}
                </div>
                <!-- END: MODIFIED LOGIC -->
                <div class="card p-6 md:p-8">
                    <h3 class="text-2xl font-bold text-slate-800 mb-4">Course Defaults</h3>
                    <p class="text-slate-500 mb-6">Set the default values for when you add a new course. This speeds up your workflow.</p>
                    <form id="adminSettingsForm">
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label for="defaultTime" class="block text-slate-600 text-sm font-semibold mb-2">Start Time</label>
                                <input type="text" id="defaultTime" class="form-input" pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" required>
                            </div>
                            <div>
                                <label for="defaultDuration" class="block text-slate-600 text-sm font-semibold mb-2">Duration (min)</label>
                                <input type="number" id="defaultDuration" class="form-input" min="15" step="5" required>
                            </div>
                            <div>
                                <label for="defaultCredits" class="block text-slate-600 text-sm font-semibold mb-2">Credits</label>
                                <input type="number" id="defaultCredits" class="form-input" min="0" step="0.01" required>
                            </div>
                            <div>
                                <label for="defaultMaxParticipants" class="block text-slate-600 text-sm font-semibold mb-2">Max Participants</label>
                                <input type="number" id="defaultMaxParticipants" class="form-input" min="1" step="1" required>
                            </div>
                        </div>
                        <div class="flex justify-end mt-6">
                            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">Save Defaults</button>
                        </div>
                    </form>
                </div>
            </div>`;
        
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

            if (!input || !clearBtn) return; // Guard against elements not being present (e.g., tutor search for staff)

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
            const defaults = appState.studioSettings.courseDefaults;
            settingsForm.querySelector('#defaultTime').value = defaults.time;
            settingsForm.querySelector('#defaultDuration').value = defaults.duration;
            settingsForm.querySelector('#defaultCredits').value = defaults.credits;
            settingsForm.querySelector('#defaultMaxParticipants').value = defaults.maxParticipants;
            settingsForm.onsubmit = handleAdminSettingsSave;
        }
    }

    function renderAdminLists() {
        const { itemsPerPage } = appState;

        const sportsList = document.getElementById('sportsList');
        const sportsPaginationContainer = document.getElementById('sportsPagination');
        const sportsHeader = document.getElementById('sportsHeader');

        if (sportsList && sportsPaginationContainer && sportsHeader) {
            sportsHeader.textContent = `Sport Types (${appState.sportTypes.length})`;
            const sportSearchTerm = appState.searchTerms.sports.toLowerCase();
            const filteredSports = appState.sportTypes.filter(st => st.name.toLowerCase().includes(sportSearchTerm));
            
            const sportsTotalPages = Math.ceil(filteredSports.length / itemsPerPage.sports) || 1;
            let sportPage = appState.pagination.sports.page;
            if (sportPage > sportsTotalPages) sportPage = sportsTotalPages;
            
            const paginatedSports = filteredSports.slice((sportPage - 1) * itemsPerPage.sports, sportPage * itemsPerPage.sports);

            sportsList.innerHTML = paginatedSports.map(st => `
                <li class="flex justify-between items-center bg-slate-100 p-2 rounded-md">
                    <div class="flex items-center gap-3"><span class="h-5 w-5 rounded-full" style="background-color: ${st.color}"></span><span class="text-slate-700 font-semibold">${st.name}</span></div>
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="sportType" data-id="${st.id}">Edit</button><button type="button" class="delete-btn font-semibold text-red-600" data-type="sportType" data-id="${st.id}" data-name="${st.name}">Delete</button></div>
                </li>`).join('') || `<li class="text-center text-slate-500 p-4">No sport types found.</li>`;
            
            renderPaginationControls(sportsPaginationContainer, sportPage, sportsTotalPages, filteredSports.length, itemsPerPage.sports, (newPage) => {
                appState.pagination.sports.page = newPage;
                renderAdminLists();
            });
        }

        const tutorsList = document.getElementById('tutorsList');
        const tutorsPaginationContainer = document.getElementById('tutorsPagination');
        const tutorsHeader = document.getElementById('tutorsHeader');
        if (tutorsList && tutorsPaginationContainer && tutorsHeader) {
            tutorsHeader.textContent = `Tutors (${appState.tutors.length})`;
            const tutorSearchTerm = appState.searchTerms.tutors.toLowerCase();
            const filteredTutors = appState.tutors.filter(t => t.name.toLowerCase().includes(tutorSearchTerm) || (t.email && t.email.toLowerCase().includes(tutorSearchTerm)));

            const tutorsTotalPages = Math.ceil(filteredTutors.length / itemsPerPage.tutors) || 1;
            let tutorPage = appState.pagination.tutors.page;
            if (tutorPage > tutorsTotalPages) tutorPage = tutorsTotalPages;

            const paginatedTutors = filteredTutors.slice((tutorPage - 1) * itemsPerPage.tutors, tutorPage * itemsPerPage.tutors);

            tutorsList.innerHTML = paginatedTutors.map(t => {
                const skillsHtml = t.skills && t.skills.map(skill => {
                    const sportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                    return sportType ? `<span class="text-xs font-medium me-2 px-2.5 py-0.5 rounded-full" style="background-color:${sportType.color}20; color:${sportType.color};">${sportType.name}</span>` : '';
                }).join('');

                return `
                 <li class="flex justify-between items-center bg-slate-100 p-3 rounded-md min-h-[68px]">
                    <div>
                        <p class="text-slate-700 font-semibold">${t.name}</p>
                        <div class="flex flex-wrap gap-1 mt-1">${skillsHtml || ''}</div>
                    </div>
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="tutor" data-id="${t.id}">Edit</button><button type="button" class="delete-btn font-semibold text-red-600" data-type="tutor" data-id="${t.id}" data-name="${t.name}">Delete</button></div>
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
                const isInUse = appState.courses.some(c => c.sportTypeId === id);
                if (isInUse) {
                    showMessageBox(`Cannot delete "${name}" because it is assigned to one or more courses.`, 'error');
                    return; // Prevent deletion
                }
            }
            if (type === 'tutor') {
                const isInUse = appState.courses.some(c => c.tutorId === id);
                if (isInUse) {
                    showMessageBox(`Cannot delete "${name}" because they are assigned to one or more courses.`, 'error');
                    return; // Prevent deletion
                }
            }

            // If not in use, proceed with the original confirmation and deletion logic.
            showConfirmation(`Delete ${type}`, `Are you sure you want to delete <strong>${name}</strong>? This cannot be undone.`, () => {
                if (type === 'sportType') {
                    database.ref('/sportTypes/' + id).remove();
                }
                if (type === 'tutor') {
                    database.ref('/tutors/' + id).remove();
                }
                showMessageBox(`${type} deleted.`, 'info');
            });
            // --- END: REFINED LOGIC ---
        }
    }
    
    function openSportTypeModal(sportTypeToEdit = null) {
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="sportTypeModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="sportTypeForm"><input type="hidden" id="sportTypeModalId"><div class="space-y-4"><div><label for="sportTypeName" class="block text-slate-600 text-sm font-semibold mb-2">Sport Type Name</label><input type="text" id="sportTypeName" required class="form-input"></div><div><label class="block text-slate-600 text-sm font-semibold mb-2">Color</label><div id="colorPickerContainer" class="color-swatch-container"></div><input type="hidden" id="sportTypeColor"></div></div><div class="flex justify-center mt-8"><button type="submit" class="submit-btn bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-8 rounded-lg"></button></div></form>
            </div>`;
        const modal = DOMElements.sportTypeModal;
        const form = modal.querySelector('form');
        form.reset();
        if (sportTypeToEdit) {
            modal.querySelector('#sportTypeModalTitle').textContent = 'Edit Sport Type';
            modal.querySelector('.submit-btn').textContent = 'Save Changes';
            form.querySelector('#sportTypeModalId').value = sportTypeToEdit.id;
            form.querySelector('#sportTypeName').value = sportTypeToEdit.name;
            form.querySelector('#sportTypeColor').value = sportTypeToEdit.color;
        } else {
            modal.querySelector('#sportTypeModalTitle').textContent = 'Add Sport Type';
            modal.querySelector('.submit-btn').textContent = 'Add Type';
            form.querySelector('#sportTypeModalId').value = '';
            form.querySelector('#sportTypeColor').value = COURSE_COLORS[0];
        }
        renderColorPicker(form.querySelector('#colorPickerContainer'), form.querySelector('#sportTypeColor'));
        form.onsubmit = handleSportTypeFormSubmit;
        openModal(modal);
    }

    function handleSportTypeFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#sportTypeModalId').value;
        const sportTypeData = { name: form.querySelector('#sportTypeName').value, color: form.querySelector('#sportTypeColor').value };

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
                       <div><label for="tutorName" class="block text-slate-600 text-sm font-semibold mb-2">Tutor Name</label><input type="text" id="tutorName" required class="form-input"></div>
                       <div><label for="tutorEmail" class="block text-slate-600 text-sm font-semibold mb-2">Email</label><input type="email" id="tutorEmail" class="form-input"></div>
                    </div>
                    <div><label for="tutorPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label><div class="flex gap-2"><input type="text" id="tutorCountryCode" class="form-input w-24" placeholder="852"><input type="tel" id="tutorPhone" class="form-input flex-grow"></div></div>
                    
                    <!-- START: New Employee Checkbox -->
                    <div class="pt-2">
                        <div class="flex items-center">
                            <input type="checkbox" id="isEmployeeCheckbox" class="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500">
                            <label for="isEmployeeCheckbox" class="ml-2 text-slate-700">This tutor is an employee</label>
                        </div>
                    </div>
                    <!-- END: New Employee Checkbox -->

                    <div><label class="block text-slate-600 text-sm font-semibold mb-2 pt-2 border-t">Skills & Salaries</label><div id="tutorSkillsList" class="space-y-3"></div><button type="button" id="addTutorSkillBtn" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-2">+ Add Skill</button></div>
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
            modal.querySelector('#tutorModalTitle').textContent = 'Edit Tutor';
            modal.querySelector('.submit-btn').textContent = 'Save Changes';
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
            modal.querySelector('#tutorModalTitle').textContent = 'Add Tutor';
            modal.querySelector('.submit-btn').textContent = 'Add Tutor';
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
    }

    function addSkillRow(container, skill = null) {
        const skillRow = document.createElement('div');
        skillRow.className = 'tutor-skill-row p-3 bg-slate-100 rounded-lg space-y-2 border border-slate-200 relative';
        const availableSports = appState.sportTypes.map(st => `<option value="${st.id}" ${skill && skill.sportTypeId === st.id ? 'selected' : ''}>${st.name}</option>`).join('');

        skillRow.innerHTML = `
            <button type="button" class="remove-skill-btn absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 rounded-full text-xs flex items-center justify-center">&times;</button>
            <select class="form-select skill-type-select">${availableSports}</select>
            <div class="flex gap-1 rounded-lg bg-slate-200 p-1 salary-type-container">
                <button type="button" data-value="perCourse" class="salary-type-btn flex-1 p-1 rounded-md text-xs">Per Course</button>
                <button type="button" data-value="percentage" class="salary-type-btn flex-1 p-1 rounded-md text-xs">Percentage</button>
                <button type="button" data-value="perHeadcount" class="salary-type-btn flex-1 p-1 rounded-md text-xs">Per Attendee</button>
            </div>
            <div><input type="number" required class="form-input salary-value-input" min="0" step="1"></div>`;
        
        container.appendChild(skillRow);

        const salaryTypeContainer = skillRow.querySelector('.salary-type-container');
        const salaryValueInput = skillRow.querySelector('.salary-value-input');

        const updateRowSalaryUI = (type) => {
            salaryTypeContainer.querySelectorAll('.salary-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === type));
            salaryValueInput.placeholder = { perCourse: '$ per course', percentage: '% of revenue', perHeadcount: '$ per head' }[type];
        };

        salaryTypeContainer.onclick = (e) => { if(e.target.matches('.salary-type-btn')) updateRowSalaryUI(e.target.dataset.value); };

        const initialSalaryType = skill?.salaryType || 'perCourse';
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
                showMessageBox(`Cannot save. ${sportName} is assigned more than once. Please remove the duplicate skill.`, 'error');
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
                    <h2 class="text-3xl font-bold text-slate-800">Tutor Salary Overview</h2>
                    <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
                        <select id="salaryTutorSelect" class="form-select w-full sm:w-48"></select>
                        <select id="salaryPeriodSelect" class="form-select w-full sm:w-48"></select>
                        <button id="exportSalaryBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 w-full sm:w-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            Export
                        </button>
                    </div>
                </div>
                <div id="salaryDetailsContainer"><p class="text-center text-slate-500 p-8">Loading available months...</p></div>
            </div>`;
        
        const tutorSelect = container.querySelector('#salaryTutorSelect');
        const periodSelect = container.querySelector('#salaryPeriodSelect');
        const exportBtn = container.querySelector('#exportSalaryBtn');
        const detailsContainer = container.querySelector('#salaryDetailsContainer');
        
        // --- START: NEW High-Performance Logic ---
        
        // Step 1: Populate tutor dropdown (this is already fast).
        populateDropdown(tutorSelect, appState.tutors);
        if (appState.selectedFilters.salaryTutorId) {
            tutorSelect.value = appState.selectedFilters.salaryTutorId;
        }

        // Step 2: Fetch the new, lightweight month index.
        const periodsSnapshot = await database.ref('/courseMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];
        
        // Step 3: Populate the period dropdown with the fast index data.
        if (periods.length > 0) {
            periodSelect.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            
            // Set the selected period from app state or default to the most recent.
            if (appState.selectedFilters.salaryPeriod && periods.includes(appState.selectedFilters.salaryPeriod)) {
                periodSelect.value = appState.selectedFilters.salaryPeriod;
            } else {
                periodSelect.value = periods[0];
            }
        } else {
            periodSelect.innerHTML = '<option value="">No Data</option>';
        }

        // Step 4: The core function that now runs AFTER user selection.
        const onFilterChange = async () => {
            appState.selectedFilters.salaryTutorId = tutorSelect.value;
            appState.selectedFilters.salaryPeriod = periodSelect.value;
            
            const tutorId = tutorSelect.value;
            const period = periodSelect.value;

            if (!tutorId || !period) {
                detailsContainer.innerHTML = `<p class="text-center text-slate-500">Please select a tutor and period to view details.</p>`;
                return;
            }

            detailsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">Fetching courses and calculating salary...</p>`;
            
            // This is the deferred, heavy operation. It now only runs on demand.
            // We still fetch all courses because the revenue calculation needs full member history.
            // But the page load itself is now instant.
            const allCoursesSnapshot = await database.ref('/courses').once('value');
            const allCoursesForCalc = firebaseObjectToArray(allCoursesSnapshot.val());

            renderSalaryDetails(allCoursesForCalc);
        };

        // Step 5: Wire up event listeners.
        tutorSelect.onchange = onFilterChange;
        periodSelect.onchange = onFilterChange;
        
        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = 'Exporting...';

            const tutorId = tutorSelect.value;
            const period = periodSelect.value;
            const tutor = appState.tutors.find(t => t.id === tutorId);

            if (!tutorId || !period || !tutor) {
                showMessageBox('Please select a valid tutor and period.', 'error');
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<svg ... > Export`;
                return;
            }
            
            // The export must also fetch the full data set to perform its calculations.
            const allCoursesSnapshot = await database.ref('/courses').once('value');
            const allCoursesForExport = firebaseObjectToArray(allCoursesSnapshot.val());
            
            const coursesInPeriod = allCoursesForExport.filter(c => c.tutorId === tutorId && c.date.startsWith(period));
            const sortedCoursesInPeriod = [...coursesInPeriod].sort((a,b) => a.date.localeCompare(b.date));

            const memberIdsInPeriod = new Set();
            sortedCoursesInPeriod.forEach(course => {
                if (course.bookedBy) Object.keys(course.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            });

            const allMemberBookings = [];
            if (memberIdsInPeriod.size > 0) {
                allCoursesForExport.forEach(course => {
                    if (course.bookedBy) {
                        for (const memberId of Object.keys(course.bookedBy)) {
                            if (memberIdsInPeriod.has(memberId)) {
                                const member = appState.users.find(u => u.id === memberId);
                                if (member) allMemberBookings.push({ member, course });
                            }
                        }
                    }
                });
            }
            
            const { revenueByCourseId } = calculateRevenueForBookings(allMemberBookings);
            
            const courseDetails = sortedCoursesInPeriod.map(course => {
                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                let earnings = 0;
                let calculation = "N/A";
                const attendeesCount = course.bookedBy ? Object.keys(course.bookedBy).length : 0;
                const courseGrossRevenue = revenueByCourseId.get(course.id) || 0;
                
                if (course.payoutDetails && typeof course.payoutDetails.salaryValue !== 'undefined') {
                    const { salaryType, salaryValue } = course.payoutDetails;
                    if (salaryType === 'perCourse') {
                        earnings = salaryValue;
                        calculation = `${formatCurrency(salaryValue)} (fixed)`;
                    } else if (salaryType === 'percentage') {
                        earnings = courseGrossRevenue * (salaryValue / 100);
                        calculation = `${formatCurrency(courseGrossRevenue)} x ${salaryValue}%`;
                    } else if (salaryType === 'perHeadcount') {
                        earnings = attendeesCount * salaryValue;
                        calculation = `${attendeesCount} attendees x ${formatCurrency(salaryValue)}`;
                    }
                }
                return { ...course, sportTypeName: sportType?.name || 'Unknown', earnings, calculation, attendeesCount };
            });
            
            const exportData = courseDetails.map(c => ({
                Date: c.date,
                Course: c.sportTypeName,
                Attendees_Capacity: `${c.attendeesCount}/${c.maxParticipants}`,
                Calculation: c.calculation,
                Earnings: c.earnings.toFixed(2)
            }));

            const tutorName = tutor.name.replace(/ /g, '_');
            const fileName = `salary-report_${tutorName}_${period}`;
            exportToCsv(fileName, exportData);

            exportBtn.disabled = false;
            exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg> Export`;
        };

        // --- Step 6: Trigger the initial render.
        onFilterChange();
        // --- END: NEW High-Performance Logic ---
    }

    function renderSalaryDetails(allCourses) {
        const container = document.getElementById('salaryDetailsContainer');
        const tutorId = document.getElementById('salaryTutorSelect').value;
        const period = document.getElementById('salaryPeriodSelect').value;

        if(!tutorId || !period || !container) {
            if(container) container.innerHTML = `<p class="text-center text-slate-500">Please select a tutor and period to view details.</p>`;
            return;
        }

        const tutor = appState.tutors.find(t => t.id === tutorId);
        const coursesInPeriod = allCourses.filter(c => c.tutorId === tutorId && c.date.startsWith(period));

        const memberIdsInPeriod = new Set();
        coursesInPeriod.forEach(course => {
            if (course.bookedBy) {
                Object.keys(course.bookedBy).forEach(id => memberIdsInPeriod.add(id));
            }
        });

        const allMemberBookings = [];
        if (memberIdsInPeriod.size > 0) {
            allCourses.forEach(course => {
                if (course.bookedBy) {
                    for (const memberId of Object.keys(course.bookedBy)) {
                        if (memberIdsInPeriod.has(memberId)) {
                            const member = appState.users.find(u => u.id === memberId);
                            if (member) {
                                allMemberBookings.push({ member, course });
                            }
                        }
                    }
                }
            });
        }
        
        const { revenueByCourseId } = calculateRevenueForBookings(allMemberBookings);
        
        let totalEarnings = 0;
        const courseDetails = coursesInPeriod.map(course => {
            const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
            let earnings = 0;
            let calculation = "N/A";
            const attendeesCount = course.bookedBy ? Object.keys(course.bookedBy).length : 0;
            const courseGrossRevenue = revenueByCourseId.get(course.id) || 0;
            
            if (course.payoutDetails && typeof course.payoutDetails.salaryValue !== 'undefined') {
                const { salaryType, salaryValue } = course.payoutDetails;
                if (salaryType === 'perCourse') {
                    earnings = salaryValue;
                    calculation = `${formatCurrency(salaryValue)} (fixed)`;
                } else if (salaryType === 'percentage') {
                    earnings = courseGrossRevenue * (salaryValue / 100);
                    calculation = `${formatCurrency(courseGrossRevenue)} x ${salaryValue}%`;
                } else if (salaryType === 'perHeadcount') {
                    earnings = attendeesCount * salaryValue;
                    // --- START: MODIFIED LINE ---
                    // Display the full calculation for per-attendee rates.
                    calculation = `${attendeesCount} ${attendeesCount === 1 ? 'attendee' : 'attendees'} x ${formatCurrency(salaryValue)}`;
                    // --- END: MODIFIED LINE ---
                }
            }

            totalEarnings += earnings;
            return { ...course, sportTypeName: sportType?.name || 'Unknown', earnings, calculation, attendeesCount };
        });

        const { key, direction } = appState.salarySort;
        courseDetails.sort((a, b) => {
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
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Earnings</p><p class="text-3xl font-bold text-slate-800">${formatCurrency(totalEarnings)}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Courses Taught</p><p class="text-3xl font-bold text-slate-800">${coursesInPeriod.length}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Attendees</p><p class="text-3xl font-bold text-slate-800">${courseDetails.reduce((acc, c) => acc + c.attendeesCount, 0)}</p></div>
            </div>
            <div>
                <h3 class="text-xl font-bold text-slate-700 mb-4">Detailed Breakdown</h3>
                <div class="overflow-x-auto"><table class="w-full text-left">
                    <thead>
                        <tr class="border-b">
                            <th class="p-2 sortable cursor-pointer" data-sort-key="date">Date<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="sportTypeName">Course<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="attendeesCount">Attendees<span class="sort-icon"></span></th>
                            <th class="p-2 sortable cursor-pointer" data-sort-key="calculation">Calculation<span class="sort-icon"></span></th>
                            <th class="p-2 text-right sortable cursor-pointer" data-sort-key="earnings">Earnings<span class="sort-icon"></span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courseDetails.map(c => `
                            <tr class="border-b border-slate-100">
                                <td class="p-2">${formatShortDateWithYear(c.date)}</td>
                                <td class="p-2">${c.sportTypeName}</td>
                                <td class="p-2">${c.attendeesCount} / ${c.maxParticipants}</td>
                                <td class="p-2 text-sm text-slate-500">${c.calculation}</td>
                                <td class="p-2 text-right font-semibold">${formatCurrency(c.earnings)}</td>
                            </tr>`).join('') || `<tr><td colspan="5" class="text-center p-4 text-slate-500">No courses taught in this period.</td></tr>`}
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
                    renderSalaryDetails(allCourses);
                };
            });
    }
    
    async function renderStatisticsPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Studio Statistics</h2>
                     <div class="flex gap-4">
                        <select id="statsPeriodSelect" class="form-select w-48"></select>
                        <button id="exportStatsBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            Export
                        </button>
                     </div>
                </div>
                <div id="statisticsContainer" class="space-y-8"><p class="text-center text-slate-500 p-8">Calculating statistics...</p></div>
            </div>`;
        
        const periodSelect = container.querySelector('#statsPeriodSelect');
        const statsContainer = container.querySelector('#statisticsContainer');
        const exportBtn = container.querySelector('#exportStatsBtn');
        const periods = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90, 'All Time': Infinity };
        periodSelect.innerHTML = Object.keys(periods).map(p => `<option value="${periods[p]}">${p}</option>`).join('');
        
        // This object will be built in two phases for the export function.
        let currentStatsForExport = {};

        // --- START: NEW TWO-PHASE RENDERING LOGIC ---
        const renderFilteredStats = async () => {
            statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">Calculating statistics...</p>`;
            const days = parseInt(periodSelect.value);
            const now = new Date();
            const startDate = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            const startDateIso = getIsoDate(startDate);
            
            // --- Phase 1: Fetch only the courses within the selected period. This is fast. ---
            const coursesSnapshot = await database.ref('/courses').orderByChild('date').startAt(startDateIso).once('value');
            const filteredCourses = firebaseObjectToArray(coursesSnapshot.val());

            if (filteredCourses.length === 0) {
                 statsContainer.innerHTML = `<p class="text-center text-slate-500 p-8">No data available for the selected period.</p>`;
                 currentStatsForExport = {}; 
                 return;
            }

            // --- Phase 1: Calculate and render all NON-REVENUE stats immediately. ---
            let totalBookings = 0, totalAttendees = 0;
            filteredCourses.forEach(course => {
                totalBookings += course.bookedBy ? Object.keys(course.bookedBy).length : 0;
                totalAttendees += course.attendedBy ? Object.keys(course.attendedBy).length : 0;
            });

            const totalCapacity = filteredCourses.reduce((sum, c) => sum + c.maxParticipants, 0);
            const avgFillRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;
            const attendanceRate = totalBookings > 0 ? (totalAttendees / totalBookings) * 100 : 0;
            
            // These rankings don't depend on revenue and can be calculated now.
            const coursePopularity = rankByStat(filteredCourses, 'sportTypeId', 'bookedBy', appState.sportTypes);
            const tutorPopularity = rankByStat(filteredCourses, 'tutorId', 'bookedBy', appState.tutors);
            const peakTimes = rankTimeSlots(filteredCourses, 'desc');
            const lowTimes = rankTimeSlots(filteredCourses, 'asc');

            // Render the page shell with placeholders for the revenue stats.
            statsContainer.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div id="grossRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Gross Revenue</p><p class="text-2xl font-bold text-slate-800">Calculating...</p></div>
                    <div id="netRevenueCard" class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Net Revenue</p><p class="text-2xl font-bold text-slate-800">Calculating...</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Enrollments</p><p class="text-2xl font-bold text-slate-800">${totalBookings}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Attendance Rate</p><p class="text-2xl font-bold text-slate-800">${attendanceRate.toFixed(1)}%</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Avg. Fill Rate</p><p class="text-2xl font-bold text-slate-800">${avgFillRate.toFixed(1)}%</p></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${createRankingCard('Most Popular Courses', coursePopularity, 'Enrollments', '#6366f1', true)}
                    <div id="topEarningCoursesCard">${createRankingCard('Top Earning Courses', [], 'Revenue', '#22c55e', true)}</div>
                    ${createRankingCard('Top Tutors by Enrollment', tutorPopularity, 'Enrollments', '#6366f1')}
                    <div id="topTutorsByRevenueCard">${createRankingCard('Top Tutors by Revenue', [], 'Revenue', '#22c55e')}</div>
                    ${createRankingCard('Peak Time Slots', peakTimes, 'Enrollments', '#f97316')}
                    ${createRankingCard('Low Time Slots', lowTimes, 'Enrollments', '#f97316')}
                </div>`;
            
            // Populate the export object with the stats we have so far.
            currentStatsForExport = {
                summary: [
                    { Metric: 'Time Period', Value: periodSelect.options[periodSelect.selectedIndex].text },
                    { Metric: 'Total Enrollments', Value: totalBookings },
                    { Metric: 'Attendance Rate (%)', Value: attendanceRate.toFixed(1) },
                    { Metric: 'Average Fill Rate (%)', Value: avgFillRate.toFixed(1) }
                ],
                coursePopularity: coursePopularity.map(item => ({ Ranking: 'Course by Enrollment', Name: item.name, Value: item.value })),
                tutorPopularity: tutorPopularity.map(item => ({ Ranking: 'Tutor by Enrollment', Name: item.name, Value: item.value })),
                peakTimes: peakTimes.map(item => ({ Ranking: 'Peak Time Slots', Name: item.name, Value: item.value })),
                lowTimes: lowTimes.map(item => ({ Ranking: 'Low Time Slots', Name: item.name, Value: item.value }))
            };
            
            // --- Phase 2: Asynchronously calculate and render REVENUE stats. ---
            // This runs in the background without blocking the UI.
            calculateAndRenderRevenueStats(filteredCourses);
        };

        const calculateAndRenderRevenueStats = async (filteredCourses) => {
            // Identify all unique members who attended a class in the period.
            const memberIdsInPeriod = new Set();
            filteredCourses.forEach(course => {
                if (course.bookedBy) {
                    Object.keys(course.bookedBy).forEach(id => memberIdsInPeriod.add(id));
                }
            });

            // This is the heavy operation needed for FIFO calculation.
            const allCoursesSnapshot = await database.ref('/courses').once('value');
            const allCoursesForCalc = firebaseObjectToArray(allCoursesSnapshot.val());

            const allRelevantBookings = [];
            if (memberIdsInPeriod.size > 0) {
                allCoursesForCalc.forEach(course => {
                    if (course.bookedBy) {
                        for (const memberId of Object.keys(course.bookedBy)) {
                            if (memberIdsInPeriod.has(memberId)) {
                                const member = appState.users.find(u => u.id === memberId);
                                if (member) allRelevantBookings.push({ member, course });
                            }
                        }
                    }
                });
            }
            
            const { revenueByCourseId } = calculateRevenueForBookings(allRelevantBookings);
            
            let grossRevenue = 0, totalTutorPayout = 0;
            filteredCourses.forEach(course => {
                const courseRevenue = revenueByCourseId.get(course.id) || 0;
                grossRevenue += courseRevenue;
                
                if (course.payoutDetails && typeof course.payoutDetails.salaryValue !== 'undefined') {
                    const { salaryType, salaryValue } = course.payoutDetails;
                    if (salaryType === 'perCourse') totalTutorPayout += salaryValue;
                    else if (salaryType === 'perHeadcount') totalTutorPayout += (course.bookedBy ? Object.keys(course.bookedBy).length : 0) * salaryValue;
                    else if (salaryType === 'percentage') totalTutorPayout += courseRevenue * (salaryValue / 100);
                }
            });

            const totalNetRevenue = grossRevenue - totalTutorPayout;
            const topCoursesByRevenue = rankByGroupedRevenue(filteredCourses, revenueByCourseId, appState.sportTypes, 'sportTypeId');
            const topTutorsByRevenue = rankByGroupedRevenue(filteredCourses, revenueByCourseId, appState.tutors, 'tutorId');

            // Now, update the specific DOM elements that were waiting for this data.
            const grossRevenueCard = document.getElementById('grossRevenueCard');
            if (grossRevenueCard) grossRevenueCard.innerHTML = `<p class="text-sm text-slate-500">Gross Revenue</p><p class="text-2xl font-bold text-slate-800">${formatCurrency(grossRevenue)}</p>`;

            const netRevenueCard = document.getElementById('netRevenueCard');
            if (netRevenueCard) {
                const netRevenueColor = totalNetRevenue >= 0 ? 'text-green-600' : 'text-red-600';
                netRevenueCard.innerHTML = `<p class="text-sm text-slate-500">Net Revenue</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(totalNetRevenue)}</p>`;
            }
            
            const topEarningCoursesCard = document.getElementById('topEarningCoursesCard');
            if(topEarningCoursesCard) topEarningCoursesCard.innerHTML = createRankingCard('Top Earning Courses', topCoursesByRevenue, 'Revenue', '#22c55e', true);

            const topTutorsByRevenueCard = document.getElementById('topTutorsByRevenueCard');
            if(topTutorsByRevenueCard) topTutorsByRevenueCard.innerHTML = createRankingCard('Top Tutors by Revenue', topTutorsByRevenue, 'Revenue', '#22c55e');

            // Finally, update the export object with the revenue data.
            currentStatsForExport.summary.push(
                { Metric: 'Gross Revenue', Value: formatCurrency(grossRevenue) },
                { Metric: 'Net Revenue', Value: formatCurrency(totalNetRevenue) }
            );
            currentStatsForExport.topCoursesByRevenue = topCoursesByRevenue.map(item => ({ Ranking: 'Course by Revenue', Name: item.name, Value: formatCurrency(item.value) }));
            currentStatsForExport.topTutorsByRevenue = topTutorsByRevenue.map(item => ({ Ranking: 'Tutor by Revenue', Name: item.name, Value: formatCurrency(item.value) }));
        };

        // --- Event Handlers ---
        exportBtn.onclick = () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = 'Exporting...';

            // The export function now uses the 'currentStatsForExport' object which was built in two phases.
            const { summary, coursePopularity, topCoursesByRevenue, tutorPopularity, topTutorsByRevenue, peakTimes, lowTimes } = currentStatsForExport;

            if (!summary || summary.length === 0) {
                showMessageBox('No statistics data to export.', 'info');
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<svg ... > Export`;
                return;
            }

            // A simple re-ordering for a more logical export file
            const reorderedSummary = summary.sort((a,b) => a.Metric.localeCompare(b.Metric));

            const exportData = [
                ...reorderedSummary,
                { Metric: '', Value: '' }, 
                ...(coursePopularity || []),
                { Metric: '', Value: '' }, 
                ...(topCoursesByRevenue || []),
                { Metric: '', Value: '' }, 
                ...(tutorPopularity || []),
                { Metric: '', Value: '' }, 
                ...(topTutorsByRevenue || []),
                { Metric: '', Value: '' }, 
                ...(peakTimes || []),
                { Metric: '', Value: '' }, 
                ...(lowTimes || []),
            ];

            const formattedExportData = exportData.map(item => ({
                Category: item.Metric || item.Ranking || '',
                Name: item.Name || '',
                Value: item.Value !== undefined ? item.Value : ''
            }));
            
            const periodText = periodSelect.options[periodSelect.selectedIndex].text.replace(/ /g, '-');
            const fileName = `statistics-report_${periodText}`;
            
            exportToCsv(fileName, formattedExportData);

            exportBtn.disabled = false;
            exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg> Export`;
        };

        periodSelect.onchange = renderFilteredStats;
        // Initial call to load the data for the default period.
        renderFilteredStats();
        // --- END: NEW TWO-PHASE RENDERING LOGIC ---
    }

    function rankByStat(courses, groupByKey, valueKey, lookup) {
        const stats = courses.reduce((acc, course) => {
            const count = course[valueKey] ? Object.keys(course[valueKey]).length : 0;
            acc[course[groupByKey]] = (acc[course[groupByKey]] || 0) + count;
            return acc;
        }, {});
        return Object.entries(stats)
            .map(([id, value]) => ({ 
                id, 
                name: lookup.find(item => item.id === id)?.name || 'Unknown', 
                value,
                color: lookup.find(item => item.id === id)?.color
            }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5);
    }

    function rankByGroupedRevenue(courses, revenueByCourseId, lookupArray, groupingKey) {
        const revenueByGroup = courses.reduce((acc, course) => {
            const courseRevenue = revenueByCourseId.get(course.id) || 0;
            const groupId = course[groupingKey];
            if (groupId) {
                acc[groupId] = (acc[groupId] || 0) + courseRevenue;
            }
            return acc;
        }, {});

        return Object.entries(revenueByGroup)
            .map(([id, value]) => {
                const item = lookupArray.find(lookupItem => lookupItem.id === id);
                return {
                    id,
                    name: item?.name || 'Unknown',
                    value: value,
                    color: item?.color
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }

    function rankTimeSlots(courses, sortDirection = 'desc') {
        const timeSlots = {};
        courses.forEach(c => {
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
                                ${valueLabel === 'Revenue' ? formatCurrency(item.value) : `${item.value} ${valueLabel}`}
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

    function populateDropdown(selectEl, options) {
         selectEl.innerHTML = options.map(opt => `<option value="${opt.id}">${opt.name}</option>`).join('');
    }

    function renderColorPicker(container, colorInput) {
        container.innerHTML = COURSE_COLORS.map((color, index) => `<input type="radio" name="color" id="color-${index}" value="${color}" class="color-swatch-radio" ${color === colorInput.value ? 'checked' : ''}><label for="color-${index}" class="color-swatch-label" style="background-color: ${color};"></label>`).join('');
        container.onchange = e => { if (e.target.name === 'color') colorInput.value = e.target.value; };
    }

    function populateSportTypeFilter(selectEl, sourceData = appState.sportTypes) {
        let optionsHtml = '<option value="all">All Sport Types</option>';
        // The function now simply renders options from whatever data source it's given.
        optionsHtml += sourceData.map(st => `<option value="${st.id}">${st.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
    }

    function populateTutorFilter(selectEl, selectedSportTypeId = 'all', sourceTutors = appState.tutors) {
        let filteredTutors = sourceTutors;

        // The existing logic for filtering by skill remains, but it now operates on the
        // provided sourceTutors list, not always the global appState.
        if (selectedSportTypeId !== 'all') {
            filteredTutors = sourceTutors.filter(tutor => 
                tutor.skills.some(skill => skill.sportTypeId === selectedSportTypeId)
            );
        }
        
        let optionsHtml = '<option value="all">All Tutors</option>';
        optionsHtml += filteredTutors.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
    }

    function renderPaginationControls(container, currentPage, totalPages, totalItems, itemsPerPage, onPageChange) {
        container.innerHTML = '';
        if (totalItems === 0) {
            container.innerHTML = `<span class="text-sm text-slate-500">No items to display</span>`;
            return;
        }

        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        const infoEl = document.createElement('span');
        infoEl.className = 'text-sm text-slate-500';
        infoEl.textContent = `Showing ${startItem}-${endItem} of ${totalItems}`;

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

    async function renderCoursesPage(container) {
        // --- START: MODIFIED LOGIC ---
        const isOwner = appState.currentUser?.role === 'owner';
        // --- END: MODIFIED LOGIC ---

        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">All Courses <span id="coursesCount" class="text-xl font-semibold text-slate-500"></span></h2>
                    <div class="flex flex-wrap gap-4">
                        <select id="coursesMonthFilter" class="form-select w-48"></select>
                        <select id="coursesSportTypeFilter" class="form-select w-48"></select>
                        <select id="coursesTutorFilter" class="form-select w-48"></select>
                        <!-- START: MODIFIED LOGIC: Conditional Export Button -->
                        ${isOwner ? `
                        <button id="exportCoursesBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            Export
                        </button>
                        ` : ''}
                        <!-- END: MODIFIED LOGIC: Conditional Export Button -->
                        <button id="addCourseBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Class</button>
                    </div>
                </div>
                <div class="overflow-x-auto table-swipe-container">
                    <table class="w-full text-left min-w-[600px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 w-12">#</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="date">Date/Time<span class="sort-icon"></span></th>
                                <th class="p-2">Course</th>
                                <th class="p-2">Tutor</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="credits">Credits<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="attendees">Attendees<span class="sort-icon"></span></th>
                                <th class="p-2"></th>
                            </tr>
                        </thead>
                        <tbody id="coursesTableBody"></tbody>
                    </table>
                </div>
                <div id="coursesPagination" class="flex justify-between items-center mt-4"></div>
            </div>`;
        
        const monthFilter = container.querySelector('#coursesMonthFilter');
        const sportTypeFilter = container.querySelector('#coursesSportTypeFilter');
        const tutorFilter = container.querySelector('#coursesTutorFilter');
        const addCourseBtn = container.querySelector('#addCourseBtn');
        const exportBtn = container.querySelector('#exportCoursesBtn');
        const tableBody = container.querySelector('#coursesTableBody');
        let monthlyCourses = [];

        const periodsSnapshot = await database.ref('/courseMonths').once('value');
        const periods = periodsSnapshot.exists() ? Object.keys(periodsSnapshot.val()).sort().reverse() : [];

        if (periods.length > 0) {
            monthFilter.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
            if (appState.selectedFilters.coursesPeriod && periods.includes(appState.selectedFilters.coursesPeriod)) {
                monthFilter.value = appState.selectedFilters.coursesPeriod;
            } else {
                monthFilter.value = periods[0];
            }
        } else {
            monthFilter.innerHTML = '<option value="">No Months Available</option>';
        }

        populateSportTypeFilter(sportTypeFilter);
        sportTypeFilter.value = appState.selectedFilters.coursesSportTypeId || 'all';
        populateTutorFilter(tutorFilter, sportTypeFilter.value);
        tutorFilter.value = appState.selectedFilters.coursesTutorId || 'all';
        
        const fetchAndRenderCourses = async () => {
            const selectedMonth = monthFilter.value;
            if (!selectedMonth) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">Please select a month.</td></tr>`;
                container.querySelector('#coursesCount').textContent = '';
                container.querySelector('#coursesPagination').innerHTML = '';
                return;
            }

            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">Loading courses for ${selectedMonth}...</td></tr>`;
            
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`;
            const snapshot = await database.ref('/courses').orderByChild('date').startAt(startOfMonth).endAt(endOfMonth).once('value');

            monthlyCourses = firebaseObjectToArray(snapshot.val());
            appState.pagination.courses.page = 1;
            updateCoursesTable();
        };

        const updateCoursesTable = () => {
            const paginationContainer = container.querySelector('#coursesPagination');
            const coursesCountEl = container.querySelector('#coursesCount');
            const selectedSportType = sportTypeFilter.value;
            const selectedTutor = tutorFilter.value;

            let filteredCourses = monthlyCourses;
            if (selectedSportType !== 'all') {
                filteredCourses = filteredCourses.filter(c => c.sportTypeId === selectedSportType);
            }
            if (selectedTutor !== 'all') {
                filteredCourses = filteredCourses.filter(c => c.tutorId === selectedTutor);
            }

            coursesCountEl.textContent = `(${filteredCourses.length} in month)`;

            const { key, direction } = appState.coursesSort;
            filteredCourses.sort((a, b) => {
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
            const totalPages = Math.ceil(filteredCourses.length / itemsPerPage.courses) || 1;
            let page = appState.pagination.courses.page;
            if (page > totalPages) page = totalPages;

            const paginatedCourses = filteredCourses.slice((page - 1) * itemsPerPage.courses, page * itemsPerPage.courses);
            
            let lastDate = null;
            tableBody.innerHTML = paginatedCourses.map((course, index) => {
                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                const tutor = appState.tutors.find(t => t.id === course.tutorId);
                const entryNumber = (page - 1) * itemsPerPage.courses + index + 1;
                const bookingsCount = course.bookedBy ? Object.keys(course.bookedBy).length : 0;
                const isNewDay = course.date !== lastDate;
                lastDate = course.date;

                return `
                    <tr class="border-b border-slate-100 ${isNewDay && index > 0 ? 'day-divider' : ''}">
                        <td class="p-2 text-slate-500 font-semibold">${entryNumber}</td>
                        <td class="p-2">${formatShortDateWithYear(course.date)}<br><span class="text-sm text-slate-500">${getTimeRange(course.time, course.duration)}</span></td>
                        <td class="p-2 font-semibold">${sportType?.name || 'Unknown'}</td>
                        <td class="p-2">${tutor?.name || 'Unknown'}</td>
                        <td class="p-2">${course.credits}</td>
                        <td class="p-2">${bookingsCount}/${course.maxParticipants}</td>
                        <td class="p-2 text-right space-x-2">
                            <button class="edit-course-btn font-semibold text-indigo-600" data-id="${course.id}">Edit</button>
                            <button class="delete-course-btn font-semibold text-red-600" data-id="${course.id}">Delete</button>
                        </td>
                    </tr>`;
            }).join('') || `<tr><td colspan="7" class="text-center p-4 text-slate-500">No courses match the selected filters for this month.</td></tr>`;

            renderPaginationControls(paginationContainer, page, totalPages, filteredCourses.length, itemsPerPage.courses, (newPage) => {
                appState.pagination.courses.page = newPage;
                updateCoursesTable();
            });

            tableBody.querySelectorAll('.edit-course-btn').forEach(btn => {
                btn.onclick = () => {
                    const courseToEdit = monthlyCourses.find(c => c.id === btn.dataset.id);
                    if (courseToEdit) openCourseModal(courseToEdit.date, courseToEdit);
                };
            });
            tableBody.querySelectorAll('.delete-course-btn').forEach(btn => {
                btn.onclick = () => {
                    const courseToDelete = monthlyCourses.find(c => c.id === btn.dataset.id);
                    if (courseToDelete) handleDeleteCourseRequest(courseToDelete);
                };
            });
        };

        monthFilter.onchange = () => {
            appState.selectedFilters.coursesPeriod = monthFilter.value;
            fetchAndRenderCourses();
        };
        sportTypeFilter.onchange = () => {
            appState.selectedFilters.coursesSportTypeId = sportTypeFilter.value;
            populateTutorFilter(tutorFilter, sportTypeFilter.value);
            tutorFilter.value = 'all';
            appState.selectedFilters.coursesTutorId = 'all';
            updateCoursesTable();
        };
        tutorFilter.onchange = () => {
            appState.selectedFilters.coursesTutorId = tutorFilter.value;
            updateCoursesTable();
        };
        container.querySelectorAll('th.sortable').forEach(header => {
            header.onclick = () => {
                const newKey = header.dataset.sortKey;
                const currentSort = appState.coursesSort;
                if (currentSort.key === newKey) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.key = newKey;
                    currentSort.direction = 'asc';
                }
                updateCoursesTable();
            };
        });
        
        addCourseBtn.onclick = () => openCourseModal(getIsoDate(new Date()));
        
        if (isOwner) {
            exportBtn.onclick = () => {
                exportBtn.disabled = true;
                exportBtn.innerHTML = 'Exporting...';
                
                const coursesToExport = monthlyCourses.sort((a, b) => {
                    const dateComparison = a.date.localeCompare(b.date);
                    if (dateComparison !== 0) return dateComparison;
                    return a.time.localeCompare(b.time);
                });
    
                const exportData = coursesToExport.map(course => {
                    const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                    const tutor = appState.tutors.find(t => t.id === course.tutorId);
                    const timeRange = getTimeRange(course.time, course.duration).split(' - ');
                    return {
                        Date: course.date,
                        StartTime: timeRange[0] || '',
                        EndTime: timeRange[1] || '',
                        CourseName: sportType?.name || 'Unknown',
                        TutorName: tutor?.name || 'Unknown',
                        Credits: course.credits,
                        BookedCount: course.bookedBy ? Object.keys(course.bookedBy).length : 0,
                        Capacity: course.maxParticipants
                    };
                });
    
                const selectedMonth = monthFilter.value;
                const fileName = selectedMonth ? `courses-export_${selectedMonth}` : 'courses-export';
                exportToCsv(fileName, exportData);
                
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg> Export`;
            };
        }

        if (monthFilter.value) {
            fetchAndRenderCourses();
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">No courses found in the database.</td></tr>`;
            container.querySelector('#coursesCount').textContent = '';
            container.querySelector('#coursesPagination').innerHTML = '';
        }
        
        const tableContainer = container.querySelector('.table-swipe-container');
        let isDown = false, startX, scrollLeft;
        tableContainer.addEventListener('mousedown', (e) => { isDown = true; tableContainer.classList.add('swiping'); startX = e.pageX - tableContainer.offsetLeft; scrollLeft = tableContainer.scrollLeft; });
        tableContainer.addEventListener('mouseleave', () => { isDown = false; tableContainer.classList.remove('swiping'); });
        tableContainer.addEventListener('mouseup', () => { isDown = false; tableContainer.classList.remove('swiping'); });
        tableContainer.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - tableContainer.offsetLeft; const walk = (x - startX) * 2; tableContainer.scrollLeft = scrollLeft - walk; });
    }

    async function openMemberBookingHistoryModal(member) {
        DOMElements.memberBookingHistoryModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">Loading History...</h2>
                <p class="text-center text-slate-500 mb-6">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                <div class="space-y-3 max-h-[60vh] overflow-y-auto" id="history-content-area">
                    <p class="text-center text-slate-500 p-8">Please wait...</p>
                </div>
            </div>
        `;
        openModal(DOMElements.memberBookingHistoryModal);

        try {
            const memberBookingsSnapshot = await database.ref(`/memberBookings/${member.id}`).once('value');
            
            let bookingCount = 0;
            let memberBookings = [];

            if (memberBookingsSnapshot.exists()) {
                const bookedCourseIds = Object.keys(memberBookingsSnapshot.val());
                bookingCount = bookedCourseIds.length;

                const coursePromises = bookedCourseIds.map(courseId => database.ref(`/courses/${courseId}`).once('value'));
                const courseSnapshots = await Promise.all(coursePromises);

                memberBookings = courseSnapshots
                    .map(snap => ({ id: snap.key, ...snap.val() }))
                    .filter(course => course.date)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
            }
            
            const historyListHTML = memberBookings.length === 0 ? '<p class="text-slate-500 text-center p-8">This member has no booking history.</p>' :
                memberBookings.map(course => {
                    const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                    const isAttended = course.attendedBy && course.attendedBy[member.id];
                    // --- START: CLEANED LOGIC ---
                    const bookingDetails = course.bookedBy[member.id];
                    const creditsUsed = bookingDetails.creditsPaid;
                    // --- END: CLEANED LOGIC ---
                    return `<div class="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="font-bold text-slate-800">${sportType?.name || 'Unknown Course'}</p>
                            <p class="text-sm text-slate-500">${formatShortDateWithYear(course.date)} at ${getTimeRange(course.time, course.duration)}</p>
                            <p class="text-xs text-slate-600">Credits Used: ${creditsUsed}</p>
                            <p class="text-xs text-slate-500">${formatBookingAuditText(bookingDetails)}</p>
                        </div>
                        ${isAttended 
                            ? `<span class="text-sm font-semibold text-green-600">COMPLETED</span>`
                            : `<button class="cancel-booking-btn-member-history text-sm font-semibold text-red-600 hover:text-red-800" data-course-id="${course.id}" data-member-id="${member.id}">Cancel</button>`
                        }
                    </div>`
                }).join('');

            DOMElements.memberBookingHistoryModal.innerHTML = `
                <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative open">
                    <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${member.name}'s Booking History (${bookingCount})</h2>
                    <p class="text-center text-slate-500 mb-6">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                    <div class="space-y-3 max-h-[60vh] overflow-y-auto" id="history-content-area">
                        ${historyListHTML}
                    </div>
                </div>
            `;

            DOMElements.memberBookingHistoryModal.querySelectorAll('.cancel-booking-btn-member-history').forEach(btn => {
                btn.onclick = () => {
                    const course = memberBookings.find(c => c.id === btn.dataset.courseId);
                    const memberId = btn.dataset.memberId;
                    handleCancelBooking(course, memberId);
                };
            });

        } catch (error) {
            console.error("Error fetching member booking history:", error);
            const historyContentArea = DOMElements.memberBookingHistoryModal.querySelector('#history-content-area');
            if (historyContentArea) {
                historyContentArea.innerHTML = `<p class="text-center text-red-500 p-8">Could not load booking history. Please try again.</p>`;
            }
        }
    }
    
    // --- Data Seeding ---
    const seedDatabaseIfEmpty = () => {
        // This function is now empty to prevent seeding unwanted data.
        // It's left here as a placeholder in case seeding is needed in the future.
    };

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
                    if (val) appState.studioSettings = { ...appState.studioSettings, ...val, courseDefaults: { ...appState.studioSettings.courseDefaults, ...(val.courseDefaults || {}) } };
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


        // --- Surgical Course Listening Strategy for Owners ---
        let initialLoadComplete = false;
        const today = new Date();
        const daysToLookBack = appState.ownerPastDaysVisible || 0;
        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCDate(today.getUTCDate() - daysToLookBack);
        const startIso = getIsoDate(startDate);
        
        activeCoursesRef = database.ref('/courses').orderByChild('date').startAt(startIso);

        activeCoursesRef.once('value', (snapshot) => {
            appState.courses = firebaseObjectToArray(snapshot.val());
            renderCurrentPage();
            initialLoadComplete = true;
        }).catch(error => console.error("Initial course fetch failed for owner:", error));


        // --- START: MODIFIED LISTENER LOGIC ---
        activeCoursesRef.on('child_changed', (snapshot) => {
            if (!initialLoadComplete) return;

            const updatedCourse = { id: snapshot.key, ...snapshot.val() };
            const oldCourse = appState.courses.find(c => c.id === updatedCourse.id);
            
            // This is the intelligent check
            const timeHasChanged = oldCourse && updatedCourse.time !== oldCourse.time;
            
            // First, update the global state regardless of what changed
            const index = appState.courses.findIndex(c => c.id === updatedCourse.id);
            if (index > -1) appState.courses[index] = updatedCourse; else appState.courses.push(updatedCourse);

            // Now, decide how to update the UI
            if (timeHasChanged) {
                // If time changed, re-sort the entire day column
                _reSortDayColumn(updatedCourse.date);
            } else {
                // Otherwise, perform the simple, surgical replacement (no flicker)
                const courseElement = document.getElementById(updatedCourse.id);
                if (courseElement) {
                    courseElement.replaceWith(createCourseElement(updatedCourse));
                }
                
                // Show booking notification if it's a new booking
                if (oldCourse) {
                    const oldBookedIds = Object.keys(oldCourse.bookedBy || {});
                    const newBookedIds = Object.keys(updatedCourse.bookedBy || {});
                    if (newBookedIds.length > oldBookedIds.length) {
                        const newMemberId = newBookedIds.find(id => !oldBookedIds.includes(id));
                        if (newMemberId) {
                            const member = appState.users.find(u => u.id === newMemberId);
                            const sportType = appState.sportTypes.find(st => st.id === updatedCourse.sportTypeId);
                            if (member && sportType) {
                                showBookingNotification({ memberName: member.name, courseName: sportType.name, courseTime: updatedCourse.time, duration: updatedCourse.duration });
                            }
                        }
                    }
                }
            }
        });
        // --- END: MODIFIED LISTENER LOGIC ---

        activeCoursesRef.on('child_added', (snapshot) => {
            if (!initialLoadComplete) return;

            const newCourse = { id: snapshot.key, ...snapshot.val() };
            if (!appState.courses.some(c => c.id === newCourse.id)) {
                appState.courses.push(newCourse);
                // A full re-sort of the day is best here to place the new class correctly
                _reSortDayColumn(newCourse.date);
            }
        });

        activeCoursesRef.on('child_removed', (snapshot) => {
            if (!initialLoadComplete) return;
            const removedCourseId = snapshot.key;
            appState.courses = appState.courses.filter(c => c.id !== removedCourseId);
            const courseElement = document.getElementById(removedCourseId);
            if (courseElement) courseElement.remove();
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

        // --- NEW, SURGICAL Course Listening Strategy for Members ---
        let initialLoadComplete = false;
        const memberId = appState.currentUser.id;
        const todayIso = getIsoDate(new Date());
        activeCoursesRef = database.ref('/courses').orderByChild('date').startAt(todayIso);

        // PHASE 1: Perform a single, initial fetch to render the page quickly.
        const initialFetchAndRender = async () => {
            try {
                // Fetch past and future courses in parallel for speed.
                const pastBookingsPromise = database.ref(`/memberBookings/${memberId}`).once('value').then(snap => {
                    if (!snap.exists()) return [];
                    const courseIds = Object.keys(snap.val());
                    const pastCoursePromises = courseIds.map(id => database.ref(`/courses/${id}`).once('value'));
                    return Promise.all(pastCoursePromises);
                });

                const futureCoursesPromise = activeCoursesRef.once('value');
                const [pastCourseSnapshots, futureCoursesSnapshot] = await Promise.all([pastBookingsPromise, futureCoursesPromise]);

                const pastCourses = pastCourseSnapshots.map(snap => ({ id: snap.key, ...snap.val() })).filter(c => c.date && c.date < todayIso);
                const futureCourses = firebaseObjectToArray(futureCoursesSnapshot.val());

                // Combine and de-duplicate using a Map.
                const allCoursesMap = new Map();
                futureCourses.forEach(course => allCoursesMap.set(course.id, course));
                pastCourses.forEach(course => allCoursesMap.set(course.id, course));
                appState.courses = Array.from(allCoursesMap.values());

                // Render the entire page ONCE.
                renderCurrentPage();
                initialLoadComplete = true;

            } catch (error) {
                console.error("Initial course fetch failed for member:", error);
            }
        };

        // PHASE 2: Attach live listeners for surgical updates AFTER the initial render.
        
        // --- START: MODIFIED LISTENER LOGIC ---
        // This listener is now smarter, just like the owner's version.
        activeCoursesRef.on('child_changed', (snapshot) => {
            if (!initialLoadComplete) return;

            const updatedCourse = { id: snapshot.key, ...snapshot.val() };
            const oldCourse = appState.courses.find(c => c.id === updatedCourse.id);

            // Check if the time specifically has changed.
            const timeHasChanged = oldCourse && updatedCourse.time !== oldCourse.time;
            
            // First, always update the central app state.
            const index = appState.courses.findIndex(c => c.id === updatedCourse.id);
            if (index > -1) appState.courses[index] = updatedCourse; else appState.courses.push(updatedCourse);

            // Now, decide how to update the UI based on what changed.
            if (timeHasChanged) {
                // If the time was edited by an admin, re-sort the entire day column.
                _reSortDayColumn(updatedCourse.date);
            } else {
                // For any other change (like participant count), just replace the single element.
                const courseElement = document.getElementById(updatedCourse.id);
                if (courseElement) {
                    const newCourseElement = createCourseElement(updatedCourse);
                    courseElement.replaceWith(newCourseElement);
                }
            }
        });

        // This listener now correctly re-sorts the day when a new class is added.
        activeCoursesRef.on('child_added', (snapshot) => {
            if (!initialLoadComplete) return;

            const newCourse = { id: snapshot.key, ...snapshot.val() };
            if (!appState.courses.some(c => c.id === newCourse.id)) {
                appState.courses.push(newCourse);
                // Re-sort the day column to place the new class in the correct time slot.
                _reSortDayColumn(newCourse.date);
            }
        });
        // --- END: MODIFIED LISTENER LOGIC ---

        activeCoursesRef.on('child_removed', (snapshot) => {
            if (!initialLoadComplete) return;

            const removedCourseId = snapshot.key;
            appState.courses = appState.courses.filter(c => c.id !== removedCourseId);
            
            const courseElement = document.getElementById(removedCourseId);
            if (courseElement) {
                courseElement.remove();
            }
        });

        // Kick off the whole process.
        initialFetchAndRender();
    };
    // --- END: NEW MEMBER-SPECIFIC LISTENER FUNCTION ---
    
    const detachDataListeners = () => {
        // --- START: MODIFIED DETACH LOGIC ---
        // This now correctly removes all child_* listeners attached to the ref.
        if (activeCoursesRef) {
            activeCoursesRef.off();
        }
        activeCoursesRef = null;
        // --- END: MODIFIED DETACH LOGIC ---

        Object.entries(dataListeners).forEach(([key, listenerInfo]) => {
            if (key.startsWith('course_')) { // This part is now legacy but safe to keep.
                listenerInfo.ref.off('value', listenerInfo.listener);
            } else if (key !== 'courses') { // We already handled 'courses' above.
                let path = `/${key}`;
                if (key === 'currentUser' && appState.currentUser) {
                    path = `/users/${appState.currentUser.id}`;
                }
                database.ref(path).off('value', listenerInfo);
            }
        });
        
        dataListeners = {};
    };

    // --- Auth State Change Handler ---
    const handleAuthStateChange = (user) => {
        if (user) {
            // Detach any listeners from a previous session.
            detachDataListeners();
            
            database.ref('/users/' + user.uid).once('value', snapshot => {
                if (snapshot.exists()) {
                    appState.currentUser = { id: user.uid, ...snapshot.val() };
                    DOMElements.authPage.classList.add('hidden');
                    DOMElements.appWrapper.classList.remove('hidden');
                    showMessageBox(`Welcome back, ${appState.currentUser.name}!`, 'success');
                    
                    // --- START: CRITICAL FIX ---
                    // Build the main UI shell, including the navigation bar, immediately.
                    updateUIVisibility();
                    // --- END: CRITICAL FIX ---
                    
                    // Now, start fetching the dynamic data for the pages.
                    initDataListeners();

                } else {
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

        loginForm.onsubmit = (e) => {
            e.preventDefault();
            handleLogin(loginForm.querySelector('#loginEmail').value, loginForm.querySelector('#loginPassword').value);
        };

        registerForm.onsubmit = (e) => {
            e.preventDefault();
            const formData = {
                name: registerForm.querySelector('#registerName').value,
                email: registerForm.querySelector('#registerEmail').value,
                password: registerForm.querySelector('#registerPassword').value,
                phone: constructPhoneNumber(
                    registerForm.querySelector('#registerCountryCode').value,
                    registerForm.querySelector('#registerPhone').value
                )
            };
            handleRegistration(formData);
        };
        
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
            const email = prompt("Please enter your email address to receive a password reset link:");
            if (email) {
                auth.sendPasswordResetEmail(email)
                    .then(() => showMessageBox(`Password reset email sent to ${email}`, 'success'))
                    .catch(error => showMessageBox(error.message, 'error'));
            }
        };
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
                if (modalToClose) closeModal(modalToClose);
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
                                'Confirm Copy Day',
                                `Are you sure you want to copy all classes from <strong>${friendlySourceDate}</strong> to <strong>${friendlyTargetDate}</strong>?`,
                                () => performCopy('day', sourceDate, targetDate)
                            );
                        }
                    }
                } else if (type === 'class') {
                    const sourceClassEl = e.target.closest('.copy-mode-source-class');
                    if (sourceClassEl) {
                        copyActionTaken = true;
                        const courseId = sourceClassEl.id;
                        const courseToCopy = appState.courses.find(c => c.id === courseId);
                        if (courseToCopy && courseToCopy.date !== targetDate) {
                            performCopy('class', courseToCopy, targetDate);
                        }
                    }
                }
                
                if (copyActionTaken) e.stopPropagation();
            }

            // --- START: MODIFIED LOGIC ---
            const addBtn = e.target.closest('.add-course-button');
            if (addBtn) {
                const currentUser = appState.currentUser;
                // Check if user is owner OR staff
                if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'staff')) {
                    openCourseModal(addBtn.dataset.date);
                }
            }
            // --- END: MODIFIED LOGIC ---
        }, true);
        
        auth.onAuthStateChanged(handleAuthStateChange);
    };

    // --- Run Application ---
    init();
});
