document.addEventListener('DOMContentLoaded', function() {
    // --- App State & Constants ---
    // Number of past days visible on the schedule for a regular member
    const MEMBER_PAST_DAYS = 0; 
    const COURSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#FF007F', '#00BFFF', '#32CD32', '#FFD700', '#8A2BE2', '#FF4500', '#20B2AA', '#DAA520', '#4682B4', '#FF69B4', '#7CFC00', '#ADFF2F', '#DC143C', '#BA55D3'];
    
    let appState = { 
        courses: [], 
        tutors: [], 
        sportTypes: [], 
        members: [], 
        activePage: 'schedule', 
        currentUser: null,
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
        scheduleScrollIndex: null,
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
        membersSort: { 
            key: 'name', 
            direction: 'asc' 
        }
    };
    let emblaApi = null;
    let onConfirmCallback = null;

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
        cancelCopyBtn: document.getElementById('cancelCopyBtn')
    };

    // --- Utility & Helper Functions ---
    const showMessageBox = (message, type = 'success') => {
        DOMElements.messageBox.textContent = message;
        const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-sky-500' };
        DOMElements.messageBox.className = `fixed bottom-6 right-6 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-bounce ${colors[type] || colors.info}`;
        DOMElements.messageBox.classList.remove('hidden');
        setTimeout(() => DOMElements.messageBox.classList.add('hidden'), 3000);
    };

    const saveData = () => {
        const stateToSave = JSON.parse(JSON.stringify(appState));
        if (stateToSave.selectedFilters) {
            delete stateToSave.selectedFilters.memberSportType;
            delete stateToSave.selectedFilters.memberTutor;
        }
        localStorage.setItem('studioPulseData', JSON.stringify(stateToSave));
    };

    const loadData = () => {
        const data = localStorage.getItem('studioPulseData');
        if (data) { 
            const loadedState = JSON.parse(data);
            const transientState = {
                copyMode: { active: false, type: null, sourceId: null, targetDate: null },
                ownerPastDaysVisible: 0,
                scheduleScrollIndex: null,
                pagination: loadedState.pagination || { courses: { page: 1 }, sports: { page: 1 }, tutors: { page: 1 } },
                searchTerms: loadedState.searchTerms || { sports: '', tutors: '' },
                membersSort: loadedState.membersSort || { key: 'name', direction: 'asc' }
            };
            if (typeof loadedState.itemsPerPage === 'number' || !loadedState.itemsPerPage) {
                loadedState.itemsPerPage = { courses: 10, sports: 10, tutors: 6 };
            }

            appState = { ...appState, ...loadedState, ...transientState };
            appState.selectedFilters.memberSportType = appState.selectedFilters.memberSportType || 'all';
            appState.selectedFilters.memberTutor = appState.selectedFilters.memberTutor || 'all';
        } else {
            // Default data if nothing in localStorage
            appState.sportTypes = [
                { id: 'st1', name: 'Sunrise Yoga', color: '#10B981'}, 
                { id: 'st2', name: 'HIIT Blast', color: '#F97316'},
                { id: 'st3', name: 'Kickboxing', color: '#ef4444'}
            ];
            appState.tutors = [
                { id: 't1', name: 'Elena', email: 'elena@example.com', phone: '+852 92280948', skills: [{ sportTypeId: 'st1', salaryType: 'perCourse', salaryValue: 50 }]}, 
                { id: 't2', name: 'Marco', email: 'marco@example.com', phone: '+852 61606055', skills: [{ sportTypeId: 'st2', salaryType: 'percentage', salaryValue: 20 }, { sportTypeId: 'st1', salaryType: 'perHeadcount', salaryValue: 5 }]},
                { id: 't3', name: 'John', email: 'john.t@example.com', phone: '+852 98006302', skills: [{ sportTypeId: 'st3', salaryType: 'perCourse', salaryValue: 60 }]}
            ];
            appState.courses = [
                { id: 'c1', sportTypeId: 'st1', tutorId: 't1', duration: 60, date: '2025-07-02', time: '07:00', credits: 1, maxParticipants: 15, bookedBy: [], attendedBy: [] },
                { id: 'c2', sportTypeId: 'st2', tutorId: 't2', duration: 45, date: '2025-07-03', time: '09:00', credits: 1.5, maxParticipants: 20, bookedBy: [], attendedBy: [] },
                { id: 'c3', sportTypeId: 'st1', tutorId: 't2', duration: 60, date: '2025-07-05', time: '18:00', credits: 1, maxParticipants: 15, bookedBy: [], attendedBy: [] },
                { id: 'c4', sportTypeId: 'st3', tutorId: 't3', duration: 75, date: '2025-06-28', time: '19:00', credits: 2, maxParticipants: 10, bookedBy: [], attendedBy: [] },
                { id: 'c5', sportTypeId: 'st1', tutorId: 't1', duration: 60, date: '2025-06-27', time: '07:00', credits: 1, maxParticipants: 15, bookedBy: [], attendedBy: [] },
            ];
            appState.members = [
                { id: 'm_owner', name: 'Studio Owner', email: 'owner@gmail.com', password: '001234', phone: '+1 555000000', type: 'owner' },
                { id: 'm_member1', name: 'Perry Yuen', email: 'member1@gmail.com', password: '001234', phone: '+852 98001055', credits: 50, initialCredits: 50, creditCost: 80, purchaseAmount: 4000, monthlyPlan: false, type: 'member', lastBooking: null, expiryDate: '2026-06-30', purchaseHistory: [{ id: 1688720400000, date: '2025-06-30T10:00:00.000Z', amount: 4000, credits: 50 }] },
                { id: 'm_member2', name: 'Irene Kwok', email: 'member2@gmail.com', password: '001234', phone: '+852 94909142', monthlyPlan: true, monthlyPlanAmount: 980, planStartDate: '2025-06-01', monthlyCreditValue: 25, type: 'member', lastBooking: null, expiryDate: null, purchaseHistory: [] }
            ];
            saveData();
        }
        const userSession = sessionStorage.getItem('studioPulseUser');
        if (userSession) {
            appState.currentUser = JSON.parse(userSession);
        }
    };
    const getIsoDate = (date) => date.toISOString().split('T')[0];
    const formatTime = (date) => date.toTimeString().slice(0, 5);
    const getTimeRange = (startTime, duration) => {
        const start = new Date(`1970-01-01T${startTime}`);
        const end = new Date(start.getTime() + duration * 60000);
        return `${formatTime(start)} - ${formatTime(end)}`;
    };
    const formatCurrency = (amount) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    const formatShortDateWithYear = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString.includes('T') ? isoString : isoString + 'T00:00:00Z');
        if (isNaN(date)) return 'Invalid Date';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const year = String(date.getUTCFullYear()).slice(-2);
        return `${day} ${month}, ${year}`;
    };
    
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
            appState.scheduleScrollIndex = emblaApi.selectedScrollSnap();
        }
    };

    const getInitialScheduleIndex = (defaultIndex) => {
        if (appState.scheduleScrollIndex !== null) {
            const index = appState.scheduleScrollIndex;
            appState.scheduleScrollIndex = null; // Consume the index
            return index;
        }
        return defaultIndex;
    };
    
    // --- Auth & UI Visibility ---
    const handleLogin = (email, password) => {
        const user = appState.members.find(m => m.email === email && m.password === password);
        if (user) {
            appState.currentUser = user;
            sessionStorage.setItem('studioPulseUser', JSON.stringify(appState.currentUser));
            DOMElements.authPage.classList.add('hidden');
            DOMElements.appWrapper.classList.remove('hidden');
            updateUIVisibility();
            switchPage(user.type === 'member' ? 'schedule' : 'schedule');
            showMessageBox(`Welcome, ${user.name}!`, 'success');
        } else {
            showMessageBox('Invalid email or password.', 'error');
        }
    };

    const handleRegistration = (formData) => {
        const { name, email, password, phone } = formData;
        
        // Check if email already exists
        if (appState.members.some(m => m.email === email)) {
            showMessageBox('This email is already registered.', 'error');
            return;
        }

        const newMember = {
            id: `m_${Date.now()}`,
            name,
            email,
            password,
            phone,
            type: 'member',
            credits: 0,
            initialCredits: 0,
            creditCost: 0,
            monthlyPlan: false,
            monthlyPlanAmount: 0,
            planStartDate: null,
            monthlyCreditValue: 0,
            lastBooking: null,
            expiryDate: null,
            purchaseHistory: []
        };

        appState.members.push(newMember);
        saveData();
        showMessageBox('Registration successful! Please log in.', 'success');

        // Switch back to the login form
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
        document.getElementById('loginEmail').value = email; // Pre-fill email
    };

    const handleLogout = () => {
        appState.currentUser = null;
        sessionStorage.removeItem('studioPulseUser');
        DOMElements.appWrapper.classList.add('hidden');
        DOMElements.authPage.classList.remove('hidden');
        appState.scheduleScrollIndex = null; 
        appState.ownerPastDaysVisible = 0;
        appState.selectedFilters.memberSportType = 'all';
        appState.selectedFilters.memberTutor = 'all';
    };

    const updateUIVisibility = () => {
        const isOwner = appState.currentUser?.type === 'owner';
        DOMElements.mainNav.querySelectorAll('[data-page]').forEach(btn => {
            const page = btn.dataset.page;
            if (['statistics', 'salary', 'members', 'admin', 'courses'].includes(page)) {
                btn.style.display = isOwner ? 'block' : 'none';
            } 
            else if (page === 'account') {
                btn.style.display = isOwner ? 'none' : 'block';
            } else if (page === 'schedule') {
                btn.style.display = 'block';
            }
        });
        DOMElements.mainNav.querySelector('[data-page="schedule"]').textContent = "Schedule";
        
        if (!isOwner && !DOMElements.mainNav.querySelector('[data-page="account"]')) {
            const accountBtn = document.createElement('button');
            accountBtn.dataset.page = 'account';
            accountBtn.className = 'nav-btn font-semibold px-3 py-1 text-sm sm:text-base';
            accountBtn.textContent = 'Account';
            const scheduleBtn = DOMElements.mainNav.querySelector('[data-page="schedule"]');
            if (scheduleBtn) {
                scheduleBtn.parentNode.insertBefore(accountBtn, scheduleBtn.nextSibling);
            } else {
                DOMElements.mainNav.appendChild(accountBtn);
            }
            DOMElements.navButtons = document.querySelectorAll('.nav-btn');
            accountBtn.onclick = () => switchPage(accountBtn.dataset.page);
        } else if (isOwner && DOMElements.mainNav.querySelector('[data-page="account"]')) {
            DOMElements.mainNav.querySelector('[data-page="account"]').remove();
            DOMElements.navButtons = document.querySelectorAll('.nav-btn');
        }
        renderCurrentPage();
    };
    
    // --- Page Navigation & Rendering ---
    const switchPage = (pageId) => {
        appState.activePage = pageId;
        renderCurrentPage();
    };

    const renderCurrentPage = () => {
        DOMElements.pages.forEach(p => p.classList.add('hidden'));
        DOMElements.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.page === appState.activePage));

        const isOwner = appState.currentUser?.type === 'owner';
        let pageIdToRender = appState.activePage;

        const ownerOnlyPages = ['statistics', 'salary', 'members', 'admin', 'courses'];

        if (!isOwner && ownerOnlyPages.includes(pageIdToRender)) {
            pageIdToRender = 'schedule';
            appState.activePage = 'schedule';
            DOMElements.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.page === 'schedule'));
            showMessageBox('Access denied. Redirected to Schedule.', 'error');
        }

        const pageElement = document.getElementById(`page-${pageIdToRender}`);
        pageElement.classList.remove('hidden');

        if (pageIdToRender === 'schedule') {
            if (isOwner) {
                renderOwnerSchedule(pageElement);
            } else {
                renderMemberSchedulePage(pageElement);
            }
        } else if (pageIdToRender === 'account') {
            renderAccountPage(pageElement);
        } else if (pageIdToRender === 'admin') {
            renderAdminPage(pageElement);
        } else if (pageIdToRender === 'members') {
            renderMembersPage(pageElement);
        } else if (pageIdToRender === 'salary') {
            renderSalaryPage(pageElement);
        } else if (pageIdToRender === 'statistics') {
            renderStatisticsPage(pageElement);
        } else if (pageIdToRender === 'courses') {
            renderCoursesPage(pageElement);
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
                    <button class="cancel-btn bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg">Cancel</button>
                    <button class="confirm-btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Confirm</button>
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
        course.bookedBy.forEach(memberId => {
            const member = appState.members.find(m => m.id === memberId);
            if (member && !member.monthlyPlan && !course.attendedBy.includes(memberId)) {
                member.credits = parseFloat(member.credits) + parseFloat(course.credits);
            }
        });

        if (course.bookedBy && course.bookedBy.length > 0) {
            openDeleteCourseNotifyModal(course);
        } else {
            const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
            showConfirmation('Delete Course', `Are you sure you want to delete the <strong>"${sportType?.name}"</strong> course? This action cannot be undone.`, () => {
                saveSchedulePosition();
                appState.courses = appState.courses.filter(c => c.id !== course.id);
                saveData();
                closeModal(DOMElements.courseModal);
                renderCurrentPage();
                showMessageBox('Course deleted.', 'info');
            });
        }
    }

    function openDeleteCourseNotifyModal(course) {
        const bookedMembers = course.bookedBy.map(id => appState.members.find(m => m.id === id)).filter(Boolean);

        DOMElements.deleteCourseNotifyModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div class="text-center">
                    <h2 class="text-2xl font-bold text-slate-800">Notify Booked Members</h2>
                    <p class="text-slate-500 mt-2 mb-6">This course has ${bookedMembers.length} booking(s). Please copy the message for each member to notify them of the cancellation before deleting the course.</p>
                </div>
                <div id="notify-members-list" class="space-y-3 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                    ${bookedMembers.map(member => {
                        const phoneDigits = member.phone ? member.phone.replace(/\D/g, '').slice(-8) : '';
                        return `
                        <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm" data-member-id="${member.id}">
                            <div class="flex-grow">
                                <span class="font-semibold text-slate-700 member-name">${member.name}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm text-slate-500">${formatDisplayPhoneNumber(member.phone)}</span>
                                    <button class="copy-phone-btn text-slate-400 hover:text-indigo-600" data-phone-digits="${phoneDigits}" title="Copy Phone Number">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2H6zM8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /></svg>
                                    </button>
                                </div>
                            </div>
                            <button class="copy-notify-msg-btn bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-3 rounded-full transition">Copy WhatsApp Msg</button>
                        </div>
                    `}).join('')}
                </div>
                <div class="flex justify-center mt-8">
                    <button id="final-delete-btn" class="bg-red-600 text-white font-bold py-3 px-8 rounded-lg transition opacity-50 cursor-not-allowed" disabled>Delete Course</button>
                </div>
            </div>`;
        
        const modal = DOMElements.deleteCourseNotifyModal;
        modal.querySelectorAll('.copy-notify-msg-btn').forEach(btn => {
            btn.onclick = () => {
                const memberItem = btn.closest('[data-member-id]');
                const memberId = memberItem.dataset.memberId;
                const member = appState.members.find(m => m.id === memberId);
                
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
        
        modal.querySelectorAll('.copy-phone-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const phoneNumber = btn.dataset.phoneDigits;
                copyTextToClipboard(phoneNumber, `Copied ${phoneNumber} to clipboard!`);
            };
        });

        modal.querySelector('#final-delete-btn').onclick = () => {
            saveSchedulePosition();
            appState.courses = appState.courses.filter(c => c.id !== course.id);
            saveData();
            closeModal(modal);
            closeModal(DOMElements.courseModal);
            renderCurrentPage();
            showMessageBox('Course deleted and members notified.', 'success');
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
    
    // --- Course, Booking, and Member List Modals (Existing) ---
    function openJoinedMembersModal(course) {
        if (appState.copyMode.active) return;
        
        DOMElements.joinedMembersModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">Course Details</h2>
                <p class="text-center text-slate-500 mb-6">${appState.sportTypes.find(st => st.id === course.sportTypeId).name} on ${formatShortDateWithYear(course.date)}</p>
                <div id="courseRevenueDetails" class="mb-6 p-4 bg-slate-50 rounded-lg text-center"></div>
                <h3 class="text-xl font-bold text-slate-700 mb-4">Booked Members</h3>
                <div id="joinedMembersList" class="space-y-3 max-h-60 overflow-y-auto"></div>
                
                <div class="mt-8 border-t pt-6">
                    <h3 class="text-xl font-bold text-slate-700 mb-4">Add Walk-in Member</h3>
                    <div class="relative">
                        <input type="text" id="addMemberSearchInput" placeholder="Search members to add..." class="form-input w-full">
                        <div id="addMemberSearchResults" class="absolute w-full bg-white border border-slate-300 rounded-lg mt-1 z-20 max-h-48 overflow-y-auto shadow-lg hidden"></div>
                    </div>
                </div>
            </div>`;
        const listEl = DOMElements.joinedMembersModal.querySelector('#joinedMembersList');
        const revenueEl = DOMElements.joinedMembersModal.querySelector('#courseRevenueDetails');

        const tutor = appState.tutors.find(t => t.id === course.tutorId);
        const skill = tutor.skills.find(s => s.sportTypeId === course.sportTypeId);
        let tutorSalary = 0;
        let grossRevenue = 0;

        if (course.bookedBy.length > 0) {
            course.bookedBy.forEach(memberId => {
                const member = appState.members.find(m => m.id === memberId);
                if (member) {
                    grossRevenue += course.credits * (member.monthlyPlan ? member.monthlyCreditValue : member.creditCost || 0);
                }
            });
        }

        if (skill) {
            if (skill.salaryType === 'perCourse') {
                tutorSalary = skill.salaryValue;
            } else if (skill.salaryType === 'percentage') {
                tutorSalary = grossRevenue * (skill.salaryValue / 100);
            } else if (skill.salaryType === 'perHeadcount') {
                tutorSalary = course.bookedBy.length * skill.salaryValue;
            }
        }
        
        const netRevenue = grossRevenue - tutorSalary;
        const netRevenueColor = netRevenue >= 0 ? 'text-slate-800' : 'text-red-600';

        revenueEl.innerHTML = `
            <div class="flex justify-center gap-4">
                <div><p class="text-sm text-slate-500">Gross Revenue</p><p class="text-2xl font-bold text-green-600">${formatCurrency(grossRevenue)}</p></div>
                <div><p class="text-sm text-slate-500">Tutor Payout</p><p class="text-2xl font-bold text-red-600">(${formatCurrency(tutorSalary)})</p></div>
                <div><p class="text-sm text-slate-500">Net Revenue</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(netRevenue)}</p></div>
            </div>`;

        if (course.bookedBy.length === 0) {
            listEl.innerHTML = `<p class="text-slate-500 text-center">No members have booked this course yet.</p>`;
        } else {
            listEl.innerHTML = course.bookedBy.map(memberId => {
                const member = appState.members.find(m => m.id === memberId);
                const isAttended = course.attendedBy.includes(memberId);
                return member ? `<div class="bg-slate-100 p-3 rounded-lg flex justify-between items-center">
                    <div class="flex items-center">
                       <input type="checkbox" data-member-id="${memberId}" class="h-5 w-5 rounded text-indigo-600 mr-4 attendance-checkbox" ${isAttended ? 'checked' : ''}>
                       <div>
                            <p class="font-semibold text-slate-800">${member.name}</p>
                            <p class="text-sm text-slate-500">${member.email}</p>
                       </div>
                    </div>
                    <p class="text-sm text-slate-600">${formatDisplayPhoneNumber(member.phone)}</p>
                </div>` : '';
            }).join('');

            listEl.querySelectorAll('.attendance-checkbox').forEach(checkbox => {
                checkbox.onchange = (e) => {
                    saveSchedulePosition();
                    const memberId = e.target.dataset.memberId;
                    const courseIndex = appState.courses.findIndex(c => c.id === course.id);
                    if (courseIndex !== -1) {
                        if (e.target.checked) {
                            if (!appState.courses[courseIndex].attendedBy.includes(memberId)) {
                                appState.courses[courseIndex].attendedBy.push(memberId);
                            }
                        } else {
                            appState.courses[courseIndex].attendedBy = appState.courses[courseIndex].attendedBy.filter(id => id !== memberId);
                        }
                        saveData();
                        renderCurrentPage(); 
                    }
                };
            });
        }
        
        const addMemberSearchInput = DOMElements.joinedMembersModal.querySelector('#addMemberSearchInput');
        const addMemberSearchResults = DOMElements.joinedMembersModal.querySelector('#addMemberSearchResults');

        addMemberSearchInput.oninput = () => {
            const searchTerm = addMemberSearchInput.value.toLowerCase().trim();
            if (searchTerm.length < 1) {
                addMemberSearchResults.innerHTML = '';
                addMemberSearchResults.classList.add('hidden');
                return;
            }

            const unbookedMembers = appState.members.filter(m => 
                m.type !== 'owner' &&
                !course.bookedBy.includes(m.id) && (
                    m.name.toLowerCase().includes(searchTerm) ||
                    m.email.toLowerCase().includes(searchTerm) ||
                    (m.phone && m.phone.includes(searchTerm)))
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
                const courseToUpdate = appState.courses.find(c => c.id === course.id);
                const memberIndex = appState.members.findIndex(m => m.id === memberId);

                if (courseToUpdate.bookedBy.length >= courseToUpdate.maxParticipants) {
                    showMessageBox('Cannot add member, class is full.', 'error');
                    return;
                }
                
                if (memberIndex !== -1 && !appState.members[memberIndex].monthlyPlan) {
                    if (parseFloat(appState.members[memberIndex].credits) < parseFloat(courseToUpdate.credits)) {
                        showMessageBox('Member has insufficient credits.', 'error');
                        return;
                    }
                    appState.members[memberIndex].credits -= parseFloat(courseToUpdate.credits);
                }

                if (!courseToUpdate.bookedBy.includes(memberId)) {
                    courseToUpdate.bookedBy.push(memberId);
                    saveSchedulePosition();
                    saveData();
                    showMessageBox('Member added to course.', 'success');
                    renderCurrentPage();
                    // Re-open the modal to show the updated list
                    openJoinedMembersModal(courseToUpdate); 
                }
            }
        };

        openModal(DOMElements.joinedMembersModal);
    }

    function openBookingModal(course) {
        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === course.tutorId);
        const currentUser = appState.members.find(m => m.id === appState.currentUser.id);

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
                    <div class="flex justify-between items-center"><span class="text-slate-500">Your Balance:</span><strong class="text-slate-800 text-lg">${currentUser.monthlyPlan ? 'Monthly Plan' : `${currentUser.credits} Credits`}</strong></div>
                </div>
                <div class="p-6 bg-slate-50">
                    <button id="confirmBookingBtn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105">Book Now & Confirm</button>
                </div>
            </div>`;
        
        const confirmBtn = DOMElements.bookingModal.querySelector('#confirmBookingBtn');
        confirmBtn.onclick = () => {
            saveSchedulePosition();
            const courseToBook = appState.courses.find(c => c.id === course.id);
            const memberIndex = appState.members.findIndex(m => m.id === appState.currentUser.id);

            if (courseToBook.bookedBy.includes(appState.members[memberIndex].id)) {
                 showMessageBox('You have already booked this course.', 'error');
            } else if (!appState.members[memberIndex].monthlyPlan && (parseFloat(appState.members[memberIndex].credits) < parseFloat(courseToBook.credits))) {
                showMessageBox('Not enough credits to book this course.', 'error');
            } else if (courseToBook.bookedBy.length >= courseToBook.maxParticipants) {
                showMessageBox('Sorry, this class is full.', 'error');
            } else {
                courseToBook.bookedBy.push(appState.members[memberIndex].id);
                if (!appState.members[memberIndex].monthlyPlan) {
                   appState.members[memberIndex].credits = parseFloat(appState.members[memberIndex].credits) - parseFloat(courseToBook.credits);
                }
                appState.members[memberIndex].lastBooking = new Date().toISOString();
                saveData();
                renderCurrentPage();
                showMessageBox('Booking successful!', 'success');
                closeModal(DOMElements.bookingModal);
            }
        };
        openModal(DOMElements.bookingModal);
    }

    function handleCancelBooking(course, memberIdToUpdate = null) {
        showConfirmation('Cancel Booking', 'Are you sure you want to cancel your booking for this course?', () => {
            saveSchedulePosition();
            const courseToCancel = appState.courses.find(c => c.id === course.id);
            const memberToUpdate = appState.members.find(m => m.id === (memberIdToUpdate || appState.currentUser.id));

            if (!memberToUpdate) {
                showMessageBox('Member not found.', 'error');
                return;
            }
            
            courseToCancel.bookedBy = courseToCancel.bookedBy.filter(id => id !== memberToUpdate.id);
            if (!memberToUpdate.monthlyPlan) {
                memberToUpdate.credits = parseFloat(memberToUpdate.credits) + parseFloat(courseToCancel.credits);
            }
            
            saveData();
            if (memberIdToUpdate) {
                openMemberBookingHistoryModal(memberToUpdate);
            } else {
                renderCurrentPage();
            }
            showMessageBox('Booking cancelled.', 'info');
        });
    }

    function openCourseModal(dateIso, courseToEdit = null) {
        DOMElements.courseModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
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
                                <input type="number" id="courseDuration" name="duration" required min="15" max="240" step="5" value="60" class="form-input">
                            </div>
                            <div>
                                <label for="courseCredits" class="block text-slate-600 text-sm font-semibold mb-2">Credits</label>
                                <input type="number" id="courseCredits" name="credits" required min="0" max="10" step="0.5" value="1" class="form-input">
                            </div>
                        </div>
                        <div>
                            <label for="courseMaxParticipants" class="block text-slate-600 text-sm font-semibold mb-2">Max Participants</label>
                            <input type="number" id="courseMaxParticipants" name="maxParticipants" required min="1" max="100" value="15" class="form-input">
                        </div>
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
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => handleDeleteCourseRequest(courseToEdit);
        } else {
            modal.querySelector('#courseModalTitle').textContent = 'Add New Course';
            modal.querySelector('.submit-btn').textContent = 'Add Course';
            form.querySelector('#courseModalId').value = '';
            updateTutorDropdown();
            const defaultDate = dateIso || new Date().toISOString().split('T')[0];
            form.querySelector('#courseDate').value = defaultDate;
            
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
                form.querySelector('#courseTime').value = '09:00';
            }
        }
        form.onsubmit = handleCourseFormSubmit;
        openModal(modal);
    }

    function handleCourseFormSubmit(e) {
        e.preventDefault();
        saveSchedulePosition();
        const form = e.target;
        const courseId = form.querySelector('#courseModalId').value;
        const courseData = {
            sportTypeId: form.querySelector('#courseSportType').value,
            tutorId: form.querySelector('#courseTutor').value,
            duration: parseInt(form.querySelector('#courseDuration').value),
            time: form.querySelector('#courseTime').value,
            credits: parseFloat(form.querySelector('#courseCredits').value),
            maxParticipants: parseInt(form.querySelector('#courseMaxParticipants').value),
            date: form.querySelector('#courseDate').value,
        };

        if (courseId) {
            const index = appState.courses.findIndex(c => c.id === courseId);
            if (index !== -1) {
                appState.courses[index] = { ...appState.courses[index], ...courseData };
                showMessageBox('Course updated!', 'success');
            }
        } else {
            appState.courses.push({ id: `c_${Date.now()}`, ...courseData, bookedBy: [], attendedBy: [] });
            showMessageBox('Course added!', 'success');
        }
        saveData(); 
        closeModal(DOMElements.courseModal); 
        renderCurrentPage();
    }

    // --- Main Rendering Functions ---
    function createCourseElement(course) {
        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
        const tutor = appState.tutors.find(t => t.id === course.tutorId);
        const el = document.createElement('div');
        el.id = course.id; 
        const isOwner = appState.currentUser?.type === 'owner';
        
        el.className = `course-block p-3 rounded-lg shadow-md text-white mb-2 flex flex-col justify-between`;
        el.style.backgroundColor = sportType?.color || '#64748b';

        if (!isOwner) {
            const { memberSportType, memberTutor } = appState.selectedFilters;
            const sportMatch = memberSportType === 'all' || course.sportTypeId === memberSportType;
            const tutorMatch = memberTutor === 'all' || course.tutorId === memberTutor;
            if (!sportMatch || !tutorMatch) {
                el.classList.add('filtered-out');
            }
        }
        
        let actionButton = '';
        let mainAction = () => {};
        const isBookedByCurrentUser = !isOwner && appState.currentUser && course.bookedBy.includes(appState.currentUser.id);
        const isAttendedByCurrentUser = !isOwner && appState.currentUser && course.attendedBy.includes(appState.currentUser.id);
        const isFull = course.bookedBy.length >= course.maxParticipants;

        if (isOwner) {
            el.classList.add('cursor-pointer');
            actionButton = `<button class="edit-course-btn absolute top-2 right-2 opacity-60 hover:opacity-100 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg></button>`;
            mainAction = () => { if (!appState.copyMode.active) openJoinedMembersModal(course); };
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
        } else if (isFull) {
            memberActionHTML = `<span class="bg-white text-red-600 font-bold text-xs px-3 py-1 rounded-full">FULL</span>`;
        } else {
            memberActionHTML = `<span class="font-bold text-white">${course.credits} ${course.credits === 1 ? 'credit' : 'credits'}</span>`;
        }

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
                <span class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v-1h8v1zM10 12a5 5 0 00-5 5v1a2 2 0 002 2h6a2 2 0 002-2v-1a5 5 0 00-5-5z" /></svg>
                    ${course.bookedBy.length}/${course.maxParticipants}
                </span>
            </div>
            <div class="mt-2 flex justify-between items-center">
                <p class="font-bold text-base bg-black/20 px-2 py-1 rounded-md inline-block time-slot ${isOwner ? 'time-slot-editable' : ''}">${getTimeRange(course.time, course.duration)}</p>
                ${isOwner ? `<span class="font-bold text-white">${course.credits} ${course.credits === 1 ? 'credit' : 'credits'}</span>` : memberActionHTML}
            </div>`;

        el.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.classList.contains('time-slot-editable')) {
                mainAction();
            }
        });

        if (isOwner) {
            el.querySelector('.edit-course-btn').onclick = (e) => {
                e.stopPropagation();
                openCourseModal(course.date, course);
            };
            
            const timeSlotEl = el.querySelector('.time-slot-editable');
            if (timeSlotEl) {
                timeSlotEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.time-slot-editable.editing').forEach(otherEl => {
                        if (otherEl !== timeSlotEl) otherEl.classList.remove('editing');
                    });
                    timeSlotEl.classList.toggle('editing');
                });

                let timeChangeDebounce;
                timeSlotEl.addEventListener('wheel', (e) => {
                    if (!timeSlotEl.classList.contains('editing')) return;
                    
                    e.preventDefault();
                    const courseToUpdate = appState.courses.find(c => c.id === course.id);
                    if (!courseToUpdate) return;
                    
                    const [hours, minutes] = courseToUpdate.time.split(':').map(Number);
                    let totalMinutes = hours * 60 + minutes;
                    
                    if (e.deltaY < 0) totalMinutes -= 15;
                    else totalMinutes += 15;

                    if (totalMinutes < 0) totalMinutes = 24 * 60 - 15;
                    if (totalMinutes >= 24 * 60) totalMinutes = 0;

                    const newHours = Math.floor(totalMinutes / 60);
                    const newMinutes = totalMinutes % 60;
                    
                    courseToUpdate.time = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                    
                    timeSlotEl.textContent = getTimeRange(courseToUpdate.time, courseToUpdate.duration);

                    clearTimeout(timeChangeDebounce);
                    timeChangeDebounce = setTimeout(() => {
                        saveSchedulePosition();
                        saveData();
                        renderCurrentPage();
                    }, 1500);
                });
            }

        } else if (isBookedByCurrentUser && !isAttendedByCurrentUser) {
            const cancelButton = el.querySelector('.cancel-booking-btn-toggle');
            if (cancelButton) {
                cancelButton.onclick = (e) => {
                    e.stopPropagation();
                    handleCancelBooking(course);
                };
                cancelButton.onmouseenter = () => cancelButton.textContent = cancelButton.dataset.cancelText;
                cancelButton.onmouseleave = () => cancelButton.textContent = cancelButton.dataset.bookedText;
            }
        }
        
        return el;
    }

    function _renderScheduleCarousel(container, startDate, endDate, datesArray, initialScrollIndex, showAddButton) {
        container.innerHTML = `
            <div class="relative">
                <div class="embla overflow-hidden card p-4 md:p-6">
                    <div class="embla__viewport"><div class="embla__container flex -mx-2"></div></div>
                </div>
                <button class="embla__button embla__button--prev absolute left-[-28px] top-0 h-full bg-white/80 backdrop-blur-sm text-slate-700 px-2 rounded-none shadow-lg border border-slate-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 z-10 hidden md:block transition flex items-center" type="button"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
                <button class="embla__button embla__button--next absolute right-[-28px] top-0 h-full bg-white/80 backdrop-blur-sm text-slate-700 px-2 rounded-none shadow-lg border border-slate-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 z-10 hidden md:block transition flex items-center" type="button"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button>
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
        
        const isOwner = appState.currentUser?.type === 'owner';
        
        const scrollPrev = () => {
            if (isOwner && !emblaApi.canScrollPrev()) {
                if (appState.ownerPastDaysVisible < 30) {
                    saveSchedulePosition();
                    appState.ownerPastDaysVisible += 7;
                    renderOwnerSchedule(document.getElementById('page-schedule'));
                }
            } else {
                emblaApi.scrollPrev();
            }
        };

        const updateButtons = () => { 
            if(!emblaApi) return;
            const canScrollPrev = emblaApi.canScrollPrev();
            const canScrollNext = emblaApi.canScrollNext();
            
            prevBtn.disabled = !canScrollPrev && !(isOwner && appState.ownerPastDaysVisible < 30);
            nextBtn.disabled = !canScrollNext;
        };
        
        emblaApi.on('select', updateButtons);
        emblaApi.on('reInit', updateButtons);
        
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
        today.setUTCHours(0, 0, 0, 0); 
        
        const daysToLookBack = appState.ownerPastDaysVisible;

        const ownerStartDate = new Date();
        ownerStartDate.setUTCHours(0,0,0,0);
        ownerStartDate.setUTCDate(today.getUTCDate() - daysToLookBack);

        const ownerEndDate = new Date();
        ownerEndDate.setUTCHours(0,0,0,0);
        ownerEndDate.setUTCDate(today.getUTCDate() + 30);

        const datesArray = [];
        for (let d = new Date(ownerStartDate); d <= ownerEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
            datesArray.push(getIsoDate(d));
        }

        const initialScrollIndex = getInitialScheduleIndex(daysToLookBack);
        
        _renderScheduleCarousel(container, ownerStartDate, ownerEndDate, datesArray, initialScrollIndex, true);
        updateCopyUI();
    }

    function renderMemberSchedulePage(container) {
        const { memberSportType, memberTutor } = appState.selectedFilters;
        const isFilterActive = memberSportType !== 'all' || memberTutor !== 'all';

        container.innerHTML = `
            <div class="flex flex-wrap gap-4 justify-center items-center mb-4">
                <select id="memberSportTypeFilter" class="form-select w-48"></select>
                <select id="memberTutorFilter" class="form-select w-48"></select>
                <button id="clearMemberFiltersBtn" class="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition ${!isFilterActive ? 'hidden' : ''}" title="Clear Filters">
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div id="member-schedule-carousel"></div>
        `;

        const sportTypeFilter = container.querySelector('#memberSportTypeFilter');
        const tutorFilter = container.querySelector('#memberTutorFilter');
        const clearFiltersBtn = container.querySelector('#clearMemberFiltersBtn');
        const carouselContainer = container.querySelector('#member-schedule-carousel');

        populateSportTypeFilter(sportTypeFilter);
        sportTypeFilter.value = memberSportType;
        
        populateTutorFilter(tutorFilter, sportTypeFilter.value);
        tutorFilter.value = memberTutor;

        const handleFilterChange = () => {
            appState.selectedFilters.memberSportType = sportTypeFilter.value;
            appState.selectedFilters.memberTutor = tutorFilter.value;
            renderMemberSchedulePage(document.getElementById('page-schedule'));
        };
        
        sportTypeFilter.onchange = handleFilterChange;
        tutorFilter.onchange = handleFilterChange;
        
        clearFiltersBtn.onclick = () => {
            appState.selectedFilters.memberSportType = 'all';
            appState.selectedFilters.memberTutor = 'all';
            renderMemberSchedulePage(document.getElementById('page-schedule'));
        };

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const memberStartDate = new Date(today.getTime());
        memberStartDate.setUTCDate(today.getUTCDate() - MEMBER_PAST_DAYS);

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

        const initialScrollIndex = getInitialScheduleIndex(MEMBER_PAST_DAYS);

        _renderScheduleCarousel(carouselContainer, memberStartDate, memberEndDate, datesArray, initialScrollIndex, false);
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
            } else {
                coursesToCopy.forEach(course => {
                    const newCourse = { ...course, id: `c_${Date.now()}_${Math.random()}`, date: targetDate, bookedBy: [], attendedBy: [] };
                    appState.courses.push(newCourse);
                });
                showMessageBox(`Copied ${coursesToCopy.length} class(es) from ${formatDateWithWeekday(sourceDate)} to ${formatDateWithWeekday(targetDate)}.`, 'success');
            }
        } else if (type === 'class') {
            const courseToCopy = sourceData;
            const newCourse = { ...courseToCopy, id: `c_${Date.now()}_${Math.random()}`, date: targetDate, bookedBy: [], attendedBy: [] };
            appState.courses.push(newCourse);
            const sportTypeName = appState.sportTypes.find(st => st.id === courseToCopy.sportTypeId).name;
            showMessageBox(`Copied "${sportTypeName}" to ${formatDateWithWeekday(targetDate)}.`, 'success');
        }
        
        saveData();
        cancelCopy();
        renderCurrentPage();
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
        const member = appState.members.find(m => m.id === appState.currentUser.id);
        const myBookings = appState.courses.filter(c => c.bookedBy.includes(member.id)).sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = `
            <div class="w-full max-w-screen-lg mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1">
                    <div class="card p-6 text-center">
                        <h2 class="text-2xl font-bold text-slate-800">${member.name}</h2>
                        <p class="text-slate-500">${member.email}</p>
                        <hr class="my-6">
                        <div class="space-y-4 text-left">
                            ${member.monthlyPlan 
                                ? `<div><p class="text-sm text-slate-500">Plan</p><p class="font-bold text-lg text-slate-800"><span class="bg-green-100 text-green-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span></p></div>
                                   <div><p class="text-sm text-slate-500">Renews On</p><p class="font-bold text-lg text-slate-800">${formatShortDateWithYear(member.planStartDate)}</p></div>`
                                : `<div><p class="text-sm text-slate-500">Credits Remaining</p><p class="font-bold text-3xl text-indigo-600">
                                        <span class="bg-yellow-100 text-yellow-800 text-base font-medium me-2 px-2.5 py-0.5 rounded-full">${member.credits}/${member.initialCredits || 'N/A'}</span>
                                    </p></div>
                                   <div><p class="text-sm text-slate-500">Credits Expire</p><p class="font-bold text-lg text-slate-800">${member.expiryDate ? formatShortDateWithYear(member.expiryDate) : 'N/A'}</p></div>`
                            }
                        </div>
                         <div class="mt-8 space-y-4">
                            <button id="editProfileBtn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Edit Profile</button>
                            <button id="changePasswordBtn" class="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition">Change Password</button>
                        </div>
                    </div>
                     ${!member.monthlyPlan ? `
                    <div class="card p-6 mt-8">
                         <h4 class="text-xl font-bold text-slate-800 mb-4 text-center">Purchase History</h4>
                        <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                            ${member.purchaseHistory && member.purchaseHistory.length > 0 ? member.purchaseHistory.map(p => `
                                <div class="text-slate-600 bg-slate-50 p-2 rounded-md"><strong>${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.credits} credits</div>
                            `).join('') : '<p class="text-sm text-slate-500 text-center">No purchase history.</p>'}
                        </div>
                    </div>` : ''}
                </div>
                <div class="md:col-span-2">
                    <div class="card p-6">
                        <h3 class="text-2xl font-bold text-slate-800 mb-4">My Bookings</h3>
                        <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                            ${myBookings.length === 0 ? '<p class="text-slate-500">You have no upcoming or past bookings.</p>' :
                            myBookings.map(course => {
                                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                                const isAttended = course.attendedBy.includes(member.id);
                                return `<div class="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p class="font-bold text-slate-800">${sportType.name}</p>
                                        <p class="text-sm text-slate-500">${formatShortDateWithYear(course.date)} at ${getTimeRange(course.time, course.duration)}</p>
                                        <p class="text-xs text-slate-600">Credits Used: ${course.credits}</p>
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
                        <input type="email" id="editMemberEmail" required class="form-input" value="${member.email}">
                    </div>
                    <div>
                        <label for="editMemberPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label>
                        <div class="flex gap-2">
                            <input type="text" id="editMemberCountryCode" class="form-input w-24" placeholder="e.g., 852">
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
        const email = form.querySelector('#editMemberEmail').value;
        const countryCode = form.querySelector('#editMemberCountryCode').value.trim();
        const phoneNumber = form.querySelector('#editMemberPhone').value;
        const phone = constructPhoneNumber(countryCode, phoneNumber);

        const memberIndex = appState.members.findIndex(m => m.id === appState.currentUser.id);
        if (memberIndex !== -1) {
            appState.members[memberIndex].name = name;
            appState.members[memberIndex].email = email;
            appState.members[memberIndex].phone = phone;
            appState.currentUser = { ...appState.currentUser, name, email, phone };
            sessionStorage.setItem('studioPulseUser', JSON.stringify(appState.currentUser));
            saveData();
            showMessageBox('Profile updated successfully!', 'success');
            closeModal(DOMElements.editMemberAccountModal);
            renderCurrentPage();
        } else {
            showMessageBox('Error updating profile.', 'error');
        }
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

        if (currentPassword !== appState.currentUser.password) {
            showMessageBox('Current password is incorrect.', 'error');
            return;
        }
        if (newPassword === '') {
            showMessageBox('New password cannot be empty.', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showMessageBox('New passwords do not match.', 'error');
            return;
        }

        const memberIndex = appState.members.findIndex(m => m.id === appState.currentUser.id);
        if (memberIndex !== -1) {
            appState.members[memberIndex].password = newPassword;
            appState.currentUser.password = newPassword;
            sessionStorage.setItem('studioPulseUser', JSON.stringify(appState.currentUser));
            saveData();
            showMessageBox('Password changed successfully!', 'success');
            closeModal(DOMElements.changePasswordModal);
        } else {
            showMessageBox('Error changing password.', 'error');
        }
    }

    function renderMembersPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Manage Members</h2>
                    <div class="relative w-64">
                        <input type="text" id="memberSearchInput" placeholder="Search by name, email, phone..." class="form-input w-full pr-10">
                        <button id="clearSearchBtn" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" style="display: none;">
                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 sortable cursor-pointer" data-sort-key="name">Name<span class="sort-icon"></span></th>
                                <th class="p-2">Contact</th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="credits">Credits/Plan<span class="sort-icon"></span></th>
                                <th class="p-2 sortable cursor-pointer" data-sort-key="expiryDate">Credit Expiry<span class="sort-icon"></span></th>
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

        const updateTable = (searchTerm = '') => {
            const { key, direction } = appState.membersSort;

            container.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
                icon.className = 'sort-icon';
            });
            const activeHeader = container.querySelector(`th[data-sort-key="${key}"] .sort-icon`);
            if (activeHeader) {
                activeHeader.classList.add(direction);
            }

            const sortedMembers = [...appState.members].sort((a, b) => {
                if (a.type === 'owner' || b.type === 'owner') return 0;

                let valA = a[key];
                let valB = b[key];

                if (key === 'credits') {
                    if (a.monthlyPlan) valA = Infinity;
                    if (b.monthlyPlan) valB = Infinity;
                }
                if (key === 'expiryDate' || key === 'lastBooking') {
                    valA = valA ? new Date(valA).getTime() : -Infinity;
                    valB = valB ? new Date(valB).getTime() : -Infinity;
                }

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });

            const filteredMembers = sortedMembers.filter(m => 
                m.type !== 'owner' && (
                !searchTerm ||
                m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.phone.includes(searchTerm))
            );

            tableBody.innerHTML = filteredMembers.map(member => `
                <tr class="border-b border-slate-100">
                    <td class="p-2 font-semibold"><button class="text-indigo-600 hover:underline member-name-btn" data-id="${member.id}">${member.name}</button></td>
                    <td class="p-2 text-sm"><div>${member.email}</div><div>${formatDisplayPhoneNumber(member.phone)}</div></td>
                    <td class="p-2">${member.monthlyPlan 
                        ? `<span class="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${formatCurrency(member.monthlyPlanAmount)}/mo</span>` 
                        : `<span class="bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${member.credits}/${member.initialCredits || 'N/A'}</span>`}
                    </td>
                    <td class="p-2 text-sm">${member.expiryDate ? formatShortDateWithYear(member.expiryDate) : 'N/A'}</td>
                    <td class="p-2 text-sm">${member.lastBooking ? formatShortDateWithYear(member.lastBooking) : 'N/A'}</td>
                    <td class="p-2 text-right space-x-2">
                        <button class="edit-member-btn font-semibold text-indigo-600" data-id="${member.id}">Edit</button>
                        <button class="delete-member-btn font-semibold text-red-600" data-id="${member.id}" data-name="${member.name}">Delete</button>
                    </td>
                </tr>
            `).join('');
            tableBody.querySelectorAll('.edit-member-btn').forEach(btn => {
                btn.onclick = () => openMemberModal(appState.members.find(m => m.id === btn.dataset.id));
            });
             tableBody.querySelectorAll('.delete-member-btn').forEach(btn => {
                btn.onclick = () => {
                    showConfirmation('Delete Member', `Are you sure you want to delete <strong>${btn.dataset.name}</strong>? This action cannot be undone.`, () => {
                        const memberId = btn.dataset.id;
                        appState.members = appState.members.filter(m => m.id !== memberId);
                        appState.courses.forEach(course => {
                            course.bookedBy = course.bookedBy.filter(id => id !== memberId);
                        });
                        saveData();
                        updateTable(searchInput.value);
                        showMessageBox('Member deleted.', 'info');
                    });
                };
            });
            tableBody.querySelectorAll('.member-name-btn').forEach(btn => {
                btn.onclick = () => {
                    const member = appState.members.find(m => m.id === btn.dataset.id);
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

        updateTable();
    }
    
    function _renderMemberPurchaseHistory(member, container, historyIdInput, purchaseAmountInput, creditsInput) {
        container.innerHTML = ''; 
        
        if (member.purchaseHistory && member.purchaseHistory.length > 0) {
            const sortedHistory = [...member.purchaseHistory].sort((a,b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = sortedHistory.map(p => {
                const costPerCredit = p.credits > 0 ? formatCurrency(p.amount / p.credits) : 'N/A';
                return `
                    <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-md transition" data-history-item-id="${p.id}">
                        <div class="flex-grow cursor-pointer hover:bg-slate-200 p-1 rounded-md">
                            <strong>${formatShortDateWithYear(p.date)}:</strong> ${formatCurrency(p.amount)} for ${p.credits} credits <span class="text-xs text-slate-500">(${costPerCredit}/credit)</span>
                        </div>
                        <button type="button" class="remove-history-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none" data-history-id="${p.id}" title="Remove entry">&times;</button>
                    </div>`;
            }).join('');
        } else {
             container.innerHTML = '<p class="text-sm text-slate-500 text-center">No purchase history.</p>';
        }

        container.onclick = (e) => {
            const editTarget = e.target.closest('[data-history-item-id] .flex-grow');
            const removeTarget = e.target.closest('.remove-history-btn');

            container.querySelectorAll('.history-entry-highlighted').forEach(el => el.classList.remove('history-entry-highlighted'));
            
            if (removeTarget) {
                const idToRemove = removeTarget.dataset.historyId;
                const entryToRemove = member.purchaseHistory.find(p => p.id == idToRemove);
                showConfirmation('Delete Purchase Entry', `Are you sure you want to delete the entry of ${formatCurrency(entryToRemove.amount)} for ${entryToRemove.credits} credits? This will also deduct the credits from the member's balance.`, () => {
                    const historyIndex = member.purchaseHistory.findIndex(p => p.id == idToRemove);
                    if (historyIndex > -1) {
                        const oldEntry = member.purchaseHistory[historyIndex];
                        member.credits -= oldEntry.credits;
                        member.initialCredits -= oldEntry.credits;
                        member.purchaseHistory.splice(historyIndex, 1);
                        saveData();
                        _renderMemberPurchaseHistory(member, container, historyIdInput, purchaseAmountInput, creditsInput);
                        showMessageBox('Purchase entry removed.', 'info');
                    }
                });
            }
            else if (editTarget) {
                const parentItem = editTarget.closest('[data-history-item-id]');
                const id = parentItem.dataset.historyItemId;
                const historyEntry = member.purchaseHistory.find(p => p.id == id);
                if (historyEntry) {
                    purchaseAmountInput.value = historyEntry.amount;
                    creditsInput.value = historyEntry.credits;
                    historyIdInput.value = id;
                    parentItem.classList.add('history-entry-highlighted');
                    showMessageBox(`Editing purchase from ${formatShortDateWithYear(historyEntry.date)}.`, 'info');
                }
            }
        };
    }
    
    function openMemberModal(memberToEdit) { // Now only for editing
        DOMElements.memberModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="memberModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center">Edit Member</h2>
                <form id="memberForm" class="space-y-4">
                    <input type="hidden" id="memberModalId">
                    <input type="hidden" id="purchaseHistoryId">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberName" class="block text-slate-600 text-sm font-semibold mb-2">Member Name</label><input type="text" id="memberName" required class="form-input"></div>
                        <div><label for="memberEmail" class="block text-slate-600 text-sm font-semibold mb-2">Email Address</label><input type="email" id="memberEmail" required class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="memberPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label><div class="flex gap-2"><input type="text" id="memberCountryCode" class="form-input w-24" placeholder="e.g., 852"><input type="tel" id="memberPhone" required class="form-input flex-grow"></div></div>
                        <div><label class="block text-slate-600 text-sm font-semibold mb-2">Password</label><button type="button" id="resetPasswordBtn" class="form-input text-left text-indigo-600 hover:bg-slate-100">Reset Password</button></div>
                    </div>
                    <div class="pt-4 border-t">
                        <div class="flex items-center mb-4"><input type="checkbox" id="monthlyPlan" class="h-4 w-4 rounded text-indigo-600"><label for="monthlyPlan" class="ml-2 text-slate-700">Monthly Plan</label></div>
                        <div id="creditFields" class="space-y-4">
                            <div class="flex items-end gap-2">
                                <div class="flex-grow"><label for="purchaseAmount" class="block text-slate-600 text-sm font-semibold mb-2">Top-up Amount ($)</label><input type="number" id="purchaseAmount" class="form-input" min="0"></div>
                                <div class="flex-grow"><label for="creditsToAdd" class="block text-slate-600 text-sm font-semibold mb-2">Credits to Add/Edit</label><input type="number" id="creditsToAdd" class="form-input" min="0"></div>
                                <button type="button" id="addCreditEntryBtn" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xl py-[0.6rem] px-4 flex items-center justify-center rounded-lg transition" title="Add new credit entry">+</button>
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
                            <div><label for="planStartDate" class="block text-slate-600 text-sm font-semibold mb-2">Plan Start Date</label><input type="date" id="planStartDate" class="form-input"></div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label for="monthlyPlanAmount" class="block text-slate-600 text-sm font-semibold mb-2">Monthly Amount ($)</label><input type="number" id="monthlyPlanAmount" class="form-input" min="0"></div>
                                <div><label for="monthlyCreditValue" class="block text-slate-600 text-sm font-semibold mb-2">Credit Value ($)</label><input type="number" id="monthlyCreditValue" class="form-input" min="0"></div>
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
        const historyContainer = form.querySelector('#purchaseHistoryContainer');
        const historyIdInput = form.querySelector('#purchaseHistoryId');
        const addCreditEntryBtn = form.querySelector('#addCreditEntryBtn');

        memberPhoneInput.oninput = (e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '');
            e.target.value = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ');
        };

        form.querySelectorAll('.expiry-quick-select-btn').forEach(button => {
            button.onclick = (e) => {
                const years = parseInt(e.target.dataset.years);
                const today = new Date();
                today.setFullYear(today.getFullYear() + years);
                expiryDateInput.value = today.toISOString().split('T')[0];
            };
        });

        addCreditEntryBtn.onclick = () => {
            const amount = parseFloat(purchaseAmountInput.value);
            const credits = parseFloat(creditsInput.value);
            if (isNaN(amount) || isNaN(credits) || amount <= 0 || credits <= 0) {
                showMessageBox('Please enter a valid amount and credits to add.', 'error');
                return;
            }
            if (historyIdInput.value) {
                showMessageBox('Clear current edit before adding a new one.', 'error');
                return;
            }
            const newPurchase = { id: Date.now(), date: new Date().toISOString(), amount: amount, credits: credits };
            if (!memberToEdit.purchaseHistory) memberToEdit.purchaseHistory = [];
            memberToEdit.purchaseHistory.push(newPurchase);
            memberToEdit.credits = (memberToEdit.credits || 0) + credits;
            memberToEdit.initialCredits = (memberToEdit.initialCredits || 0) + credits;
            _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput);
            purchaseAmountInput.value = '';
            creditsInput.value = '';
            showMessageBox('New credit entry added!', 'success');
        };

        // Populate form with existing member data
        form.querySelector('#memberModalId').value = memberToEdit.id;
        form.querySelector('#memberName').value = memberToEdit.name;
        form.querySelector('#memberEmail').value = memberToEdit.email;
        
        const { countryCode, number } = parsePhoneNumber(memberToEdit.phone);
        memberCountryCodeInput.value = countryCode;
        memberPhoneInput.value = number;
        
        form.querySelector('#monthlyPlan').checked = memberToEdit.monthlyPlan;
        expiryDateInput.value = memberToEdit.expiryDate;
        form.querySelector('#monthlyPlanAmount').value = memberToEdit.monthlyPlanAmount;
        planStartDateInput.value = memberToEdit.planStartDate;
        form.querySelector('#monthlyCreditValue').value = memberToEdit.monthlyCreditValue;
        
        _renderMemberPurchaseHistory(memberToEdit, historyContainer, historyIdInput, purchaseAmountInput, creditsInput);
        
        form.querySelector('#resetPasswordBtn').onclick = () => {
            showMessageBox('Password reset will be triggered via email in a future update.', 'info');
        };

        const monthlyPlanCheckbox = form.querySelector('#monthlyPlan');
        const creditFieldsContainer = form.querySelector('#creditFields');
        const monthlyPlanFieldsContainer = form.querySelector('#monthlyPlanFields');
        const updatePlanFields = () => { 
            const isMonthly = monthlyPlanCheckbox.checked;
            creditFieldsContainer.style.display = isMonthly ? 'none' : 'block';
            monthlyPlanFieldsContainer.style.display = isMonthly ? 'block' : 'none';
        };
        monthlyPlanCheckbox.onchange = updatePlanFields;
        updatePlanFields();

        form.onsubmit = handleMemberFormSubmit;
        openModal(DOMElements.memberModal);
    }


    function handleMemberFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('#memberModalId').value; // This will always be an ID now
        if (!id) return; // Should not happen, but as a safeguard

        const isMonthly = form.querySelector('#monthlyPlan').checked;
        const topUpAmount = parseFloat(form.querySelector('#purchaseAmount').value) || 0;
        const creditsToAdd = parseFloat(form.querySelector('#creditsToAdd').value) || 0;
        const historyId = form.querySelector('#purchaseHistoryId').value;
        
        const countryCode = form.querySelector('#memberCountryCode').value.trim();
        const phoneNumber = form.querySelector('#memberPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);

        let memberData = {
            name: form.querySelector('#memberName').value,
            email: form.querySelector('#memberEmail').value,
            phone: fullPhoneNumber,
            monthlyPlan: isMonthly,
            monthlyPlanAmount: isMonthly ? parseFloat(form.querySelector('#monthlyPlanAmount').value) : 0,
            planStartDate: isMonthly ? form.querySelector('#planStartDate').value : null,
            monthlyCreditValue: isMonthly ? parseFloat(form.querySelector('#monthlyCreditValue').value) : 0,
            expiryDate: form.querySelector('#expiryDate').value || null
        };
        
        const index = appState.members.findIndex(m => m.id === id);
        if (index > -1) {
            const member = appState.members[index];

            // Handle credit entry edits
            if (!isMonthly && historyId && (topUpAmount > 0 || creditsToAdd > 0)) {
                const historyIndex = member.purchaseHistory.findIndex(p => p.id == historyId);
                if (historyIndex > -1) {
                    const oldEntry = member.purchaseHistory[historyIndex];
                    member.credits -= oldEntry.credits;
                    member.initialCredits -= oldEntry.credits;
                    
                    oldEntry.amount = topUpAmount;
                    oldEntry.credits = creditsToAdd;
                    member.credits += creditsToAdd;
                    member.initialCredits += creditsToAdd;
                }
            }
            
            appState.members[index] = { ...member, ...memberData };
            showMessageBox('Member updated successfully.', 'success');
        }

        saveData();
        closeModal(DOMElements.memberModal);
        renderMembersPage(document.getElementById('page-members'));
    }
    
    function renderAdminPage(container) {
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <!-- Sport Types Card -->
                <div class="card p-6 flex flex-col">
                    <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                        <h3 id="sportsHeader" class="text-2xl font-bold text-slate-800"></h3>
                        <div class="relative">
                            <input type="text" id="sportSearchInput" placeholder="Search..." class="form-input w-40" value="${appState.searchTerms.sports}">
                        </div>
                    </div>
                    <button id="addSportTypeBtn" class="w-full mb-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Sport Type</button>
                    <div class="flex-grow">
                        <ul id="sportsList" class="admin-list space-y-2"></ul>
                    </div>
                    <div id="sportsPagination" class="flex justify-between items-center mt-4"></div>
                </div>
                <!-- Tutors Card -->
                <div class="card p-6 flex flex-col">
                    <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
                        <h3 id="tutorsHeader" class="text-2xl font-bold text-slate-800"></h3>
                        <div class="relative">
                            <input type="text" id="tutorSearchInput" placeholder="Search..." class="form-input w-40" value="${appState.searchTerms.tutors}">
                        </div>
                    </div>
                    <button id="addTutorBtn" class="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Tutor</button>
                    <div class="flex-grow">
                         <ul id="tutorsList" class="admin-list space-y-2"></ul>
                    </div>
                    <div id="tutorsPagination" class="flex justify-between items-center mt-4"></div>
                </div>
            </div>`;
        
        renderAdminLists();
        
        container.querySelector('#addSportTypeBtn').onclick = () => openSportTypeModal();
        container.querySelector('#addTutorBtn').onclick = () => openTutorModal();
        container.querySelector('#sportsList').addEventListener('click', handleAdminListClick);
        container.querySelector('#tutorsList').addEventListener('click', handleAdminListClick);
        
        container.querySelector('#sportSearchInput').oninput = (e) => {
            appState.searchTerms.sports = e.target.value;
            appState.pagination.sports.page = 1;
            renderAdminLists();
        };
        container.querySelector('#tutorSearchInput').oninput = (e) => {
            appState.searchTerms.tutors = e.target.value;
            appState.pagination.tutors.page = 1;
            renderAdminLists();
        };
    }

    function renderAdminLists() {
        const { itemsPerPage } = appState;

        // --- Render Sports List ---
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
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="sportType" data-id="${st.id}">Edit</button><button class="delete-btn font-semibold text-red-600" data-type="sportType" data-id="${st.id}" data-name="${st.name}">Delete</button></div>
                </li>`).join('') || `<li class="text-center text-slate-500 p-4">No sport types found.</li>`;
            
            renderPaginationControls(sportsPaginationContainer, sportPage, sportsTotalPages, filteredSports.length, itemsPerPage.sports, (newPage) => {
                appState.pagination.sports.page = newPage;
                renderAdminLists();
            });
        }

        // --- Render Tutors List ---
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
                const skillsHtml = t.skills.map(skill => {
                    const sportType = appState.sportTypes.find(st => st.id === skill.sportTypeId);
                    return sportType ? `<span class="text-xs font-medium me-2 px-2.5 py-0.5 rounded-full" style="background-color:${sportType.color}20; color:${sportType.color};">${sportType.name}</span>` : '';
                }).join('');

                return `
                 <li class="flex justify-between items-center bg-slate-100 p-3 rounded-md min-h-[68px]">
                    <div>
                        <p class="text-slate-700 font-semibold">${t.name}</p>
                        <div class="flex flex-wrap gap-1 mt-1">${skillsHtml}</div>
                    </div>
                    <div class="flex gap-2"><button class="edit-btn font-semibold text-indigo-600" data-type="tutor" data-id="${t.id}">Edit</button><button class="delete-btn font-semibold text-red-600" data-type="tutor" data-id="${t.id}" data-name="${t.name}">Delete</button></div>
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
            showConfirmation(`Delete ${type}`, `Are you sure you want to delete <strong>${name}</strong>? This cannot be undone.`, () => {
                if (type === 'sportType') {
                    appState.sportTypes = appState.sportTypes.filter(st => st.id !== id);
                    appState.courses = appState.courses.filter(c => c.sportTypeId !== id);
                }
                if (type === 'tutor') {
                    appState.tutors = appState.tutors.filter(t => t.id !== id);
                    appState.courses = appState.courses.filter(c => c.tutorId !== id);
                }
                saveData();
                renderAdminLists();
                showMessageBox(`${type} deleted.`, 'info');
            });
        }
    }
    
    function openSportTypeModal(sportTypeToEdit = null) {
        DOMElements.sportTypeModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
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

        if (id) {
            const index = appState.sportTypes.findIndex(st => st.id === id);
            if (index !== -1) appState.sportTypes[index] = { ...appState.sportTypes[index], ...sportTypeData };
        } else {
            appState.sportTypes.push({ id: `st_${Date.now()}`, ...sportTypeData });
        }
        saveData(); 
        closeModal(DOMElements.sportTypeModal); 
        renderAdminLists();
    }

    function openTutorModal(tutorToEdit = null) {
        DOMElements.tutorModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 id="tutorModalTitle" class="text-3xl font-bold text-slate-800 mb-6 text-center"></h2>
                <form id="tutorForm"><input type="hidden" id="tutorModalId"><div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div><label for="tutorName" class="block text-slate-600 text-sm font-semibold mb-2">Tutor Name</label><input type="text" id="tutorName" required class="form-input"></div>
                       <div><label for="tutorEmail" class="block text-slate-600 text-sm font-semibold mb-2">Email</label><input type="email" id="tutorEmail" class="form-input"></div>
                    </div>
                    <div><label for="tutorPhone" class="block text-slate-600 text-sm font-semibold mb-2">Mobile Number</label><div class="flex gap-2"><input type="text" id="tutorCountryCode" class="form-input w-24" placeholder="e.g., 852"><input type="tel" id="tutorPhone" class="form-input flex-grow"></div></div>
                    <div><label class="block text-slate-600 text-sm font-semibold mb-2">Skills & Salaries</label><div id="tutorSkillsList" class="space-y-3"></div><button type="button" id="addTutorSkillBtn" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-2">+ Add Skill</button></div>
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

        if (tutorToEdit) {
            modal.querySelector('#tutorModalTitle').textContent = 'Edit Tutor';
            modal.querySelector('.submit-btn').textContent = 'Save Changes';
            form.querySelector('#tutorModalId').value = tutorToEdit.id;
            form.querySelector('#tutorName').value = tutorToEdit.name;
            form.querySelector('#tutorEmail').value = tutorToEdit.email;
            
            const { countryCode, number } = parsePhoneNumber(tutorToEdit.phone);
            tutorCountryCodeInput.value = countryCode;
            tutorPhoneInput.value = number;

            tutorToEdit.skills.forEach(skill => addSkillRow(skillsList, skill));
        } else {
            modal.querySelector('#tutorModalTitle').textContent = 'Add Tutor';
            modal.querySelector('.submit-btn').textContent = 'Add Tutor';
            form.querySelector('#tutorModalId').value = '';
            addSkillRow(skillsList);
        }
        form.querySelector('#addTutorSkillBtn').onclick = () => addSkillRow(skillsList);
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

        const countryCode = form.querySelector('#tutorCountryCode').value.trim();
        const phoneNumber = form.querySelector('#tutorPhone').value;
        const fullPhoneNumber = constructPhoneNumber(countryCode, phoneNumber);

        const tutorData = { 
            name: form.querySelector('#tutorName').value, 
            email: form.querySelector('#tutorEmail').value,
            phone: fullPhoneNumber,
            skills 
        };

        if (id) {
            const index = appState.tutors.findIndex(t => t.id === id);
            if (index > -1) appState.tutors[index] = { ...appState.tutors[index], ...tutorData };
        } else {
            appState.tutors.push({ id: `t_${Date.now()}`, ...tutorData });
        }
        saveData(); 
        closeModal(DOMElements.tutorModal); 
        renderAdminLists();
    }

    function renderSalaryPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Tutor Salary Overview</h2>
                    <div class="flex gap-4">
                        <select id="salaryTutorSelect" class="form-select w-48"></select>
                        <select id="salaryPeriodSelect" class="form-select w-48"></select>
                    </div>
                </div>
                <div id="salaryDetailsContainer"></div>
            </div>`;
        
        const tutorSelect = container.querySelector('#salaryTutorSelect');
        const periodSelect = container.querySelector('#salaryPeriodSelect');
        
        populateDropdown(tutorSelect, appState.tutors);
        if (appState.selectedFilters.salaryTutorId) {
            tutorSelect.value = appState.selectedFilters.salaryTutorId;
        }
        populateSalaryPeriods(periodSelect);
        
        if (appState.selectedFilters.salaryPeriod) {
            periodSelect.value = appState.selectedFilters.salaryPeriod;
        } else {
            const currentMonth = new Date().toISOString().substring(0, 7);
            if ([...periodSelect.options].some(option => option.value === currentMonth)) {
                periodSelect.value = currentMonth;
                appState.selectedFilters.salaryPeriod = periodSelect.value;
            } else if (periodSelect.options.length > 0) {
                periodSelect.value = periodSelect.options[0].value;
                appState.selectedFilters.salaryPeriod = periodSelect.options[0].value;
            }
        }


        tutorSelect.onchange = () => {
            appState.selectedFilters.salaryTutorId = tutorSelect.value;
            renderSalaryDetails();
        };
        periodSelect.onchange = () => {
            appState.selectedFilters.salaryPeriod = periodSelect.value;
            renderSalaryDetails();
        };
        renderSalaryDetails();
    }

    function populateSalaryPeriods(selectEl) {
        const periods = [...new Set(appState.courses.map(c => c.date.substring(0, 7)))].sort().reverse();
        selectEl.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
    }

    function renderSalaryDetails() {
        const container = document.getElementById('salaryDetailsContainer');
        const tutorId = document.getElementById('salaryTutorSelect').value;
        const period = document.getElementById('salaryPeriodSelect').value;
        if(!tutorId || !period || !container) {
            if(container) container.innerHTML = `<p class="text-center text-slate-500">Please select a tutor and period to view details.</p>`;
            return;
        }

        const tutor = appState.tutors.find(t => t.id === tutorId);
        const coursesInPeriod = appState.courses.filter(c => c.tutorId === tutorId && c.date.startsWith(period));

        let totalEarnings = 0;
        const courseDetails = coursesInPeriod.map(course => {
            const skill = tutor.skills.find(s => s.sportTypeId === course.sportTypeId);
            const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
            let earnings = 0;
            let calculation = "N/A";
            const attendeesCount = course.bookedBy.length;
            
            if (skill) {
                if (skill.salaryType === 'perCourse') {
                    earnings = skill.salaryValue;
                    calculation = `${formatCurrency(skill.salaryValue)} (fixed)`;
                } else if (skill.salaryType === 'percentage') {
                    let grossRevenue = 0;
                     course.bookedBy.forEach(memberId => {
                        const member = appState.members.find(m => m.id === memberId);
                        if(member) {
                            grossRevenue += course.credits * (member.monthlyPlan ? member.monthlyCreditValue : member.creditCost || 0);
                        }
                    });
                    earnings = grossRevenue * (skill.salaryValue / 100);
                    calculation = `${formatCurrency(grossRevenue)} x ${skill.salaryValue}%`;
                } else if (skill.salaryType === 'perHeadcount') {
                    earnings = attendeesCount * skill.salaryValue;
                    calculation = `${attendeesCount} attendees x ${formatCurrency(skill.salaryValue)}`;
                }
            }
            totalEarnings += earnings;
            return { ...course, sportTypeName: sportType?.name || 'Unknown', earnings, calculation, attendeesCount };
        }).sort((a,b) => new Date(a.date) - new Date(b.date));

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Earnings</p><p class="text-3xl font-bold text-slate-800">${formatCurrency(totalEarnings)}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Courses Taught</p><p class="text-3xl font-bold text-slate-800">${coursesInPeriod.length}</p></div>
                <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Attendees</p><p class="text-3xl font-bold text-slate-800">${courseDetails.reduce((acc, c) => acc + c.attendeesCount, 0)}</p></div>
            </div>
            <div>
                <h3 class="text-xl font-bold text-slate-700 mb-4">Detailed Breakdown</h3>
                <div class="overflow-x-auto"><table class="w-full text-left">
                    <thead><tr class="border-b"><th class="p-2">Date</th><th class="p-2">Course</th><th class="p-2">Attendees</th><th class="p-2">Calculation</th><th class="p-2 text-right">Earnings</th></tr></thead>
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
    }
    
    function renderStatisticsPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Studio Statistics</h2>
                     <div class="flex gap-4">
                        <select id="statsPeriodSelect" class="form-select w-48"></select>
                     </div>
                </div>
                <div id="statisticsContainer" class="space-y-8"></div>
            </div>`;
        
        const periodSelect = container.querySelector('#statsPeriodSelect');
        const statsContainer = container.querySelector('#statisticsContainer');
        const periods = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90, 'All Time': Infinity };
        periodSelect.innerHTML = Object.keys(periods).map(p => `<option value="${periods[p]}">${p}</option>`).join('');
        
        const renderFilteredStats = () => {
            const days = parseInt(periodSelect.value);
            const now = new Date();
            const startDate = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            const filteredCourses = appState.courses.filter(c => new Date(c.date) >= startDate);
            
            if (filteredCourses.length === 0) {
                 statsContainer.innerHTML = `<p class="text-center text-slate-500">No data available for the selected period.</p>`;
                 return;
            }

            let totalGrossRevenue = 0;
            let totalTutorPayout = 0;
            let totalBookings = 0;
            let totalAttendees = 0;
            
            filteredCourses.forEach(course => {
                const tutor = appState.tutors.find(t => t.id === course.tutorId);
                const skill = tutor?.skills.find(s => s.sportTypeId === course.sportTypeId);
                let courseGrossRevenue = 0;
                totalBookings += course.bookedBy.length;
                totalAttendees += course.attendedBy.length;

                course.bookedBy.forEach(memberId => {
                    const member = appState.members.find(m => m.id === memberId);
                    if(member) {
                       courseGrossRevenue += course.credits * (member.monthlyPlan ? member.monthlyCreditValue : member.creditCost || 0);
                    }
                });
                totalGrossRevenue += courseGrossRevenue;

                if (skill) {
                    if (skill.salaryType === 'perCourse') {
                        totalTutorPayout += skill.salaryValue;
                    } else if (skill.salaryType === 'percentage') {
                        totalTutorPayout += courseGrossRevenue * (skill.salaryValue / 100);
                    } else if (skill.salaryType === 'perHeadcount') {
                        totalTutorPayout += course.bookedBy.length * skill.salaryValue;
                    }
                }
            });

            const totalNetRevenue = totalGrossRevenue - totalTutorPayout;
            const totalCapacity = filteredCourses.reduce((sum, c) => sum + c.maxParticipants, 0);
            const avgFillRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;
            const attendanceRate = totalBookings > 0 ? (totalAttendees / totalBookings) * 100 : 0;
            
            const coursePopularity = rankBy(filteredCourses, 'sportTypeId', 'bookedBy', appState.sportTypes);
            const tutorPopularity = rankBy(filteredCourses, 'tutorId', 'bookedBy', appState.tutors);
            
            const timeSlots = {};
            filteredCourses.forEach(c => {
                const hour = c.time.split(':')[0];
                const day = new Date(c.date + 'T12:00:00Z').toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
                const slot = `${day}, ${hour}:00 - ${String(parseInt(hour)+1).padStart(2,'0')}:00`;
                timeSlots[slot] = (timeSlots[slot] || 0) + c.bookedBy.length;
            });
            const peakTimes = Object.entries(timeSlots).sort((a,b) => b[1] - a[1]).slice(0,5);
            
            const netRevenueColor = totalNetRevenue >= 0 ? 'text-green-600' : 'text-red-600';

            statsContainer.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Gross Revenue</p><p class="text-2xl font-bold text-slate-800">${formatCurrency(totalGrossRevenue)}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Net Revenue</p><p class="text-2xl font-bold ${netRevenueColor}">${formatCurrency(totalNetRevenue)}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Total Enrollments</p><p class="text-2xl font-bold text-slate-800">${totalBookings}</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Attendance Rate</p><p class="text-2xl font-bold text-slate-800">${attendanceRate.toFixed(1)}%</p></div>
                    <div class="bg-slate-100 p-4 rounded-lg"><p class="text-sm text-slate-500">Avg. Fill Rate</p><p class="text-2xl font-bold text-slate-800">${avgFillRate.toFixed(1)}%</p></div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    ${createRankingCard('Most Popular Courses', coursePopularity, 'Enrollments', true)}
                    ${createRankingCard('Top Performing Tutors', tutorPopularity, 'Enrollments')}
                    ${createRankingCard('Peak Time Slots', peakTimes.map(([name, value])=>({name, value})), 'Enrollments')}
                </div>`;
        };

        periodSelect.onchange = renderFilteredStats;
        renderFilteredStats();
    }

    function rankBy(courses, groupByKey, valueKey, lookup) {
        const stats = courses.reduce((acc, course) => {
            acc[course[groupByKey]] = (acc[course[groupByKey]] || 0) + course[valueKey].length;
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

    function createRankingCard(title, data, valueLabel, useColorDot = false) {
        const max = Math.max(...data.map(d => d.value), 0);
        return `
            <div class="p-6">
                <h3 class="text-xl font-bold text-slate-700 mb-4">${title}</h3>
                <div class="space-y-4">
                ${data.map(item => `
                    <div>
                        <div class="flex justify-between items-center text-sm mb-1">
                            <span class="font-semibold text-slate-600 flex items-center gap-2">
                                ${useColorDot ? `<span class="h-3 w-3 rounded-full" style="background-color: ${item.color || '#ccc'}"></span>` : ''}
                                ${item.name}
                            </span>
                            <span class="text-slate-500">${item.value} ${valueLabel}</span>
                        </div>
                        <div class="w-full bg-slate-200 rounded-full h-2.5"><div class="bar-chart-bar h-2.5 bg-indigo-500" style="width: ${max > 0 ? (item.value / max) * 100 : 0}%;"></div></div>
                    </div>
                `).join('') || '<p class="text-slate-500">No data to display.</p>'}
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

    function populateCoursesPeriods(selectEl) {
        const periods = [...new Set(appState.courses.map(c => c.date.substring(0, 7)))].sort().reverse();
        if (periods.length === 0) {
            selectEl.innerHTML = '<option value="">No Months Available</option>';
        } else {
            selectEl.innerHTML = periods.map(p => `<option value="${p}">${new Date(p + '-01T12:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>`).join('');
        }
    }

    function populateSportTypeFilter(selectEl) {
        let optionsHtml = '<option value="all">All Sport Types</option>';
        optionsHtml += appState.sportTypes.map(st => `<option value="${st.id}">${st.name}</option>`).join('');
        selectEl.innerHTML = optionsHtml;
    }

    function populateTutorFilter(selectEl, selectedSportTypeId = 'all') {
        let filteredTutors = appState.tutors;
        if (selectedSportTypeId !== 'all') {
            filteredTutors = appState.tutors.filter(tutor => 
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

    function renderCoursesPage(container) {
        container.innerHTML = `
            <div class="card p-6 md:p-8">
                <div class="flex flex-wrap gap-4 justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">All Courses <span id="coursesCount" class="text-xl font-semibold text-slate-500"></span></h2>
                    <div class="flex flex-wrap gap-4">
                        <select id="coursesMonthFilter" class="form-select w-48"></select>
                        <select id="coursesSportTypeFilter" class="form-select w-48"></select>
                        <select id="coursesTutorFilter" class="form-select w-48"></select>
                        <button id="addCourseBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">Add Class</button>
                    </div>
                </div>
                <div class="overflow-x-auto table-swipe-container">
                    <table class="w-full text-left min-w-[600px]">
                        <thead>
                            <tr class="border-b">
                                <th class="p-2 w-12">#</th>
                                <th class="p-2">Date/Time</th>
                                <th class="p-2">Course</th>
                                <th class="p-2">Tutor</th>
                                <th class="p-2">Credits</th>
                                <th class="p-2">Attendees</th>
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

        populateCoursesPeriods(monthFilter);
        populateSportTypeFilter(sportTypeFilter);
        
        if (appState.selectedFilters.coursesPeriod && !Array.from(monthFilter.options).some(opt => opt.value === appState.selectedFilters.coursesPeriod)) {
            appState.selectedFilters.coursesPeriod = monthFilter.options.length > 0 ? monthFilter.options[0].value : '';
        }
        if (appState.selectedFilters.coursesPeriod) {
            monthFilter.value = appState.selectedFilters.coursesPeriod;
        } else if (monthFilter.options.length > 0) {
            monthFilter.value = monthFilter.options[0].value;
            appState.selectedFilters.coursesPeriod = monthFilter.options[0].value;
        }


        if (appState.selectedFilters.coursesSportTypeId) {
            sportTypeFilter.value = appState.selectedFilters.coursesSportTypeId;
        }

        populateTutorFilter(tutorFilter, sportTypeFilter.value);

        if (appState.selectedFilters.coursesTutorId && !Array.from(tutorFilter.options).some(opt => opt.value === appState.selectedFilters.coursesTutorId)) {
            appState.selectedFilters.coursesTutorId = 'all';
        }
        if (appState.selectedFilters.coursesTutorId) {
            tutorFilter.value = appState.selectedFilters.coursesTutorId;
        }


        const updateCoursesTable = () => {
            const coursesTableBody = container.querySelector('#coursesTableBody');
            const coursesPaginationContainer = container.querySelector('#coursesPagination');
            const coursesCountEl = container.querySelector('#coursesCount');

            const selectedMonth = monthFilter.value;
            const selectedSportType = sportTypeFilter.value;
            const selectedTutor = tutorFilter.value;

            let filteredCourses = appState.courses.filter(c => c.date.startsWith(selectedMonth));
            
            if (selectedSportType !== 'all') {
                filteredCourses = filteredCourses.filter(c => c.sportTypeId === selectedSportType);
            }
            if (selectedTutor !== 'all') {
                filteredCourses = filteredCourses.filter(c => c.tutorId === selectedTutor);
            }

            coursesCountEl.textContent = `(${filteredCourses.length} added)`;

            filteredCourses.sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                return dateA - dateB;
            });
            
            const { itemsPerPage } = appState;
            const totalPages = Math.ceil(filteredCourses.length / itemsPerPage.courses) || 1;
            let page = appState.pagination.courses.page;
            if (page > totalPages) page = totalPages;

            const paginatedCourses = filteredCourses.slice((page - 1) * itemsPerPage.courses, page * itemsPerPage.courses);

            let lastDate = null;
            coursesTableBody.innerHTML = paginatedCourses.map((course, index) => {
                const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                const tutor = appState.tutors.find(t => t.id === course.tutorId);
                const entryNumber = (page - 1) * itemsPerPage.courses + index + 1;
                
                const isNewDay = course.date !== lastDate;
                lastDate = course.date;

                return `
                    <tr class="border-b border-slate-100 ${isNewDay && index > 0 ? 'day-divider' : ''}">
                        <td class="p-2 text-slate-500 font-semibold">${entryNumber}</td>
                        <td class="p-2">${formatShortDateWithYear(course.date)}<br><span class="text-sm text-slate-500">${getTimeRange(course.time, course.duration)}</span></td>
                        <td class="p-2 font-semibold">${sportType?.name || 'Unknown'}</td>
                        <td class="p-2">${tutor?.name || 'Unknown'}</td>
                        <td class="p-2">${course.credits}</td>
                        <td class="p-2">${course.bookedBy.length}/${course.maxParticipants}</td>
                        <td class="p-2 text-right space-x-2">
                            <button class="edit-course-btn font-semibold text-indigo-600" data-id="${course.id}">Edit</button>
                            <button class="delete-course-btn font-semibold text-red-600" data-id="${course.id}">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('') || `<tr><td colspan="7" class="text-center p-4 text-slate-500">No courses available for this month with the selected filters.</td></tr>`;
        
            renderPaginationControls(coursesPaginationContainer, page, totalPages, filteredCourses.length, itemsPerPage.courses, (newPage) => {
                appState.pagination.courses.page = newPage;
                updateCoursesTable();
            });

            coursesTableBody.querySelectorAll('.edit-course-btn').forEach(btn => {
                btn.onclick = () => {
                    const courseToEdit = appState.courses.find(c => c.id === btn.dataset.id);
                    openCourseModal(courseToEdit.date, courseToEdit);
                };
            });

            coursesTableBody.querySelectorAll('.delete-course-btn').forEach(btn => {
                btn.onclick = () => {
                    const courseId = btn.dataset.id;
                    const course = appState.courses.find(c => c.id === courseId);
                    handleDeleteCourseRequest(course);
                };
            });
        };

        const handleFilterChange = () => {
            appState.pagination.courses.page = 1;
            appState.selectedFilters.coursesPeriod = monthFilter.value;
            appState.selectedFilters.coursesSportTypeId = sportTypeFilter.value;
            populateTutorFilter(tutorFilter, sportTypeFilter.value);
            appState.selectedFilters.coursesTutorId = 'all';
            tutorFilter.value = 'all';
            updateCoursesTable();
        };

        monthFilter.onchange = handleFilterChange;
        sportTypeFilter.onchange = handleFilterChange;
        tutorFilter.onchange = () => {
            appState.selectedFilters.coursesTutorId = tutorFilter.value;
            updateCoursesTable();
        };

        addCourseBtn.onclick = () => {
            const defaultDateForNewCourse = monthFilter.value ? `${monthFilter.value}-01` : new Date().toISOString().split('T')[0];
            openCourseModal(defaultDateForNewCourse);
        };
        
        const tableContainer = container.querySelector('.table-swipe-container');
        let isDown = false;
        let startX;
        let scrollLeft;

        tableContainer.addEventListener('mousedown', (e) => {
            isDown = true;
            tableContainer.classList.add('swiping');
            startX = e.pageX - tableContainer.offsetLeft;
            scrollLeft = tableContainer.scrollLeft;
        });
        tableContainer.addEventListener('mouseleave', () => {
            isDown = false;
            tableContainer.classList.remove('swiping');
        });
        tableContainer.addEventListener('mouseup', () => {
            isDown = false;
            tableContainer.classList.remove('swiping');
        });
        tableContainer.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            e.preventDefault();
            const x = e.pageX - tableContainer.offsetLeft;
            const walk = (x - startX) * 2;
            tableContainer.scrollLeft = scrollLeft - walk;
        });

        updateCoursesTable();
    }

    function openMemberBookingHistoryModal(member) {
        const memberBookings = appState.courses.filter(c => c.bookedBy.includes(member.id)).sort((a, b) => new Date(b.date) - new Date(a.date));

        DOMElements.memberBookingHistoryModal.innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 modal-content relative">
                <button class="modal-close-btn"><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 text-center">${member.name}'s Booking History</h2>
                <p class="text-center text-slate-500 mb-6">${member.email} | ${formatDisplayPhoneNumber(member.phone)}</p>
                <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                    ${memberBookings.length === 0 ? '<p class="text-slate-500 text-center">This member has no booking history.</p>' :
                    memberBookings.map(course => {
                        const sportType = appState.sportTypes.find(st => st.id === course.sportTypeId);
                        const isAttended = course.attendedBy.includes(member.id);
                        return `<div class="bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p class="font-bold text-slate-800">${sportType.name}</p>
                                <p class="text-sm text-slate-500">${formatShortDateWithYear(course.date)} at ${getTimeRange(course.time, course.duration)}</p>
                                <p class="text-xs text-slate-600">Credits Used: ${course.credits}</p>
                            </div>
                            ${isAttended 
                                ? `<span class="text-sm font-semibold text-green-600">COMPLETED</span>`
                                : `<button class="cancel-booking-btn-member-history text-sm font-semibold text-red-600 hover:text-red-800" data-course-id="${course.id}" data-member-id="${member.id}">Cancel</button>`
                            }
                        </div>`
                    }).join('')}
                </div>
            </div>
        `;
        DOMElements.memberBookingHistoryModal.querySelectorAll('.cancel-booking-btn-member-history').forEach(btn => {
            btn.onclick = () => {
                const course = appState.courses.find(c => c.id === btn.dataset.courseId);
                const memberId = btn.dataset.memberId;
                handleCancelBooking(course, memberId);
            };
        });

        openModal(DOMElements.memberBookingHistoryModal);
    }

    // --- Initialization ---
    const init = () => {
        loadData();
        
        if (appState.currentUser?.type === 'member') {
            appState.activePage = 'schedule';
        } else {
            appState.activePage = 'schedule';
        }

        if (appState.currentUser) {
            DOMElements.authPage.classList.add('hidden');
            DOMElements.appWrapper.classList.remove('hidden');
            updateUIVisibility();
        } else {
            // Setup Auth Page Listeners if no user is logged in
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
                showMessageBox('Forgot Password functionality is not yet implemented.', 'info');
            };
        }

        // --- Event Listeners ---
        DOMElements.logoutBtn.onclick = handleLogout;
        DOMElements.navButtons.forEach(btn => btn.onclick = () => switchPage(btn.dataset.page));
        
        DOMElements.cancelCopyBtn.onclick = cancelCopy;

        document.body.addEventListener('click', e => {
            if (!e.target.closest('.time-slot-editable.editing')) {
                document.querySelectorAll('.time-slot-editable.editing').forEach(el => {
                    el.classList.remove('editing');
                });
            }

            if (e.target.closest('#cancelCopyBtn')) {
                cancelCopy();
                return;
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
                                () => {
                                    performCopy('day', sourceDate, targetDate);
                                }
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
                
                if (copyActionTaken) {
                    e.stopPropagation();
                    return; 
                }
            }

            const addBtn = e.target.closest('.add-course-button');
            if (addBtn && appState.currentUser?.type === 'owner') {
                openCourseModal(addBtn.dataset.date);
            }
        }, true); 
    };

    // --- Run Application ---
    init();
});
