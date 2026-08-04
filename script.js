// ============================================
// Global Application State & Helpers
// ============================================
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://trampoline.vercel.app/api'; 

let currentUser = null;
let editingRecordId = null;
let activeTab = 'active';
let gamesData = [];
let systemUsers = [];

function normalizeNumbers(str) {
    if (!str) return '';
    return str.toString().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function getCurrentUserShiftId() {
    let shiftCounter = localStorage.getItem('shift_counter') || 1;
    return `SHIFT-${shiftCounter}`;
}

// Ensure execution after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    setTodayAsDefaultDate();
});

// ============================================
// 1. Authentication & Session Handling
// ============================================
async function login() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value.trim().toLowerCase();
    const password = normalizeNumbers(passwordInput.value.trim());

    if (!username || !password) {
        alert("⚠️ يرجى إدخال اسم المستخدم وكلمة المرور!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'بيانات الدخول غير صحيحة' }));
            alert(`⚠️ ${errorData.message}`);
            return;
        }

        const data = await res.json();
        currentUser = data.user;

        const activeUserEl = document.getElementById('active-user');
        const activeShiftEl = document.getElementById('active-shift-num');
        if (activeUserEl) activeUserEl.innerText = `${currentUser.name} (${currentUser.role === 'admin' ? 'مدير' : 'موظف'})`;
        if (activeShiftEl) activeShiftEl.innerText = getCurrentUserShiftId();

        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('dashboard-screen')?.classList.remove('hidden');

        // Admin controls visibility
        const adminReportBtn = document.getElementById('admin-report-btn');
        const adminGamesBtn = document.getElementById('admin-games-btn');
        const adminUsersBtn = document.getElementById('admin-users-btn');
        const discountContainer = document.getElementById('discount-container');

        if (isAdmin()) {
            if (adminReportBtn) adminReportBtn.classList.remove('hidden');
            if (adminGamesBtn) adminGamesBtn.classList.remove('hidden');
            if (adminUsersBtn) adminUsersBtn.classList.remove('hidden');
            if (discountContainer) discountContainer.style.display = 'block';
        } else {
            if (adminReportBtn) adminReportBtn.classList.add('hidden');
            if (adminGamesBtn) adminGamesBtn.classList.add('hidden');
            if (adminUsersBtn) adminUsersBtn.classList.add('hidden');
            if (discountContainer) discountContainer.style.display = 'none';
        }

        await fetchGamesData();
        loadGamesDropdown();
    } catch (err) {
        alert("❌ تعذر الاتصال بالسيرفر: " + err.message);
    }
}

function logout() {
    currentUser = null;
    if (document.getElementById('username')) document.getElementById('username').value = '';
    if (document.getElementById('password')) document.getElementById('password').value = '';
    document.getElementById('dashboard-screen')?.classList.add('hidden');
    document.getElementById('reports-screen')?.classList.add('hidden');
    document.getElementById('games-manager-screen')?.classList.add('hidden');
    document.getElementById('users-manager-screen')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
}

function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

async function changeMyPasswordModal() {
    if (!currentUser) return;
    const newPass = prompt(`🔑 تغيير كلمة المرور للمستخدم (${currentUser.name}):\nأدخل كلمة المرور الجديدة:`);
    if (newPass && newPass.trim() !== "") {
        try {
            await fetch(`${API_BASE}/users/change-password/${currentUser.username}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPass.trim() })
            });
            alert("✅ تم تغيير كلمة المرور بنجاح!");
        } catch (err) {
            alert("❌ خطأ التحديث: " + err.message);
        }
    }
}

// ============================================
// 2. Games Data & Selection Mechanics
// ============================================
async function fetchGamesData() {
    try {
        const res = await fetch(`${API_BASE}/games`);
        gamesData = await res.json();
    } catch (err) {
        console.error("Error fetching games:", err);
    }
}

function loadGamesDropdown() {
    const gameSelect = document.getElementById('game-type');
    if (!gameSelect) return;
    
    gameSelect.innerHTML = '<option value="">-- اختر اللعبة --</option>';

    const uniqueGames = [...new Set(gamesData.map(g => g.name))];
    uniqueGames.forEach(gName => {
        const opt = document.createElement('option');
        opt.value = gName;
        opt.textContent = gName;
        gameSelect.appendChild(opt);
    });
}

function updateGamePrices() {
    const selectedGame = document.getElementById('game-type').value;
    const durationContainer = document.getElementById('duration-price-container');
    const durationSelect = document.getElementById('duration-price');
    const playerContainer = document.getElementById('player-count-container');

    if (!selectedGame) {
        if (durationContainer) durationContainer.style.display = 'none';
        if (playerContainer) playerContainer.style.display = 'none';
        return;
    }

    const filteredOptions = gamesData.filter(g => g.name === selectedGame);
    
    durationSelect.innerHTML = '<option value="">-- اختر المدة --</option>';
    filteredOptions.forEach((item, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.dataset.duration = item.duration;
        opt.dataset.price = item.price;
        opt.textContent = `${item.duration} دقيقة - ${item.price} جنيه (لالفرد)`;
        durationSelect.appendChild(opt);
    });

    if (durationContainer) durationContainer.style.display = 'block';
    if (playerContainer) playerContainer.style.display = 'block';
}

// ============================================
// 3. Booking Transactions & Printing
// ============================================
async function startSession() {
    const childName = document.getElementById('child-name').value.trim();
    const fatherName = document.getElementById('father-name').value.trim();
    const phone = normalizeNumbers(document.getElementById('customer-phone').value.trim());
    const gameType = document.getElementById('game-type').value;
    const durationSelect = document.getElementById('duration-price');
    const selectedOpt = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
    const count = parseInt(document.getElementById('player-count').value) || 1;
    const discount = parseFloat(document.getElementById('discount-amount').value) || 0;

    const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;

    if (!childName || !nameRegex.test(childName)) { alert("⚠️ يرجى إدخال اسم الطفل بشكل صحيح!"); return; }
    if (!fatherName || !nameRegex.test(fatherName)) { alert("⚠️ يرجى إدخال اسم الأب بشكل صحيح!"); return; }
    if (!gameType || !selectedOpt || !selectedOpt.value) { alert("⚠️ اختر نوع اللعبة والمدة!"); return; }

    const durationMinutes = parseInt(selectedOpt.dataset.duration) || 30;
    const unitPrice = parseFloat(selectedOpt.dataset.price) || 0;
    const subtotal = unitPrice * count;
    const finalPrice = Math.max(0, subtotal - discount);

    const now = new Date();
    const endTime = new Date(now.getTime() + durationMinutes * 60000);
    const startTimeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const currentShiftId = getCurrentUserShiftId();
    const activeUsername = currentUser ? currentUser.username : 'admin';

    const payload = {
        shift_id: currentShiftId,
        child_name: childName,
        father_name: fatherName,
        phone: phone || 'لا يوجد',
        game_name: gameType,
        duration: durationMinutes,
        player_count: count,
        unit_price: unitPrice,
        subtotal: subtotal,
        discount: discount,
        total_price: finalPrice,
        start_time: startTimeStr,
        end_time: endTimeStr,
        created_by: activeUsername,
        modified_by: activeUsername
    };

    try {
        let res;
        if (editingRecordId !== null) {
            res = await fetch(`${API_BASE}/bookings/${editingRecordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            editingRecordId = null;
        } else {
            res = await fetch(`${API_BASE}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'خطأ بالحفظ' }));
            throw new Error(errData.error || errData.message || "فشل حفظ البيانات بالخادم");
        }

        document.getElementById('r-shift-id').innerText = currentShiftId;
        document.getElementById('r-child-name').innerText = childName;
        document.getElementById('r-father-name').innerText = fatherName;
        document.getElementById('r-cust-phone').innerText = phone || 'لا يوجد';
        document.getElementById('r-game').innerText = gameType;
        document.getElementById('r-duration').innerText = `${durationMinutes} دقيقة`;
        document.getElementById('r-unit-price').innerText = `${unitPrice} جنيه`;
        document.getElementById('r-count').innerText = count;
        document.getElementById('r-start').innerText = startTimeStr;
        document.getElementById('r-end').innerText = endTimeStr;
        document.getElementById('r-subtotal').innerText = `${subtotal} جنيه`;
        document.getElementById('r-discount').innerText = `${discount} جنيه`;
        document.getElementById('r-price').innerText = `${finalPrice} جنيه`;
        document.getElementById('r-name').innerText = currentUser ? currentUser.name : 'المدير';

        document.getElementById('dashboard-screen')?.classList.add('hidden');
        document.getElementById('receipt-screen')?.classList.remove('hidden');

        resetBookingForm();
    } catch (err) {
        alert("❌ خطأ: " + err.message);
    }
}

function resetBookingForm() {
    if (document.getElementById('child-name')) document.getElementById('child-name').value = '';
    if (document.getElementById('father-name')) document.getElementById('father-name').value = '';
    if (document.getElementById('customer-phone')) document.getElementById('customer-phone').value = '';
    if (document.getElementById('game-type')) document.getElementById('game-type').value = '';
    if (document.getElementById('duration-price-container')) document.getElementById('duration-price-container').style.display = 'none';
    if (document.getElementById('player-count-container')) document.getElementById('player-count-container').style.display = 'none';
    if (document.getElementById('player-count')) document.getElementById('player-count').value = 1;
    if (document.getElementById('discount-amount')) document.getElementById('discount-amount').value = 0;
}

function backToDashboard() {
    document.getElementById('receipt-screen')?.classList.add('hidden');
    document.getElementById('dashboard-screen')?.classList.remove('hidden');
}

// ============================================
// 4. Shift Closure Implementation
// ============================================
async function closeShift() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_BASE}/shifts/active/${currentUser.username}`);
        const currentShiftRecords = await res.json();

        if (!currentShiftRecords || currentShiftRecords.length === 0) {
            alert(`لا توجد أوردرات مفتوحة للوردية الحالية!`);
            return;
        }

        const shiftTotalMoney = currentShiftRecords.reduce((sum, r) => sum + parseFloat(r.total_price || 0), 0);
        const shiftTotalPlayers = currentShiftRecords.reduce((sum, r) => sum + parseInt(r.player_count || 1), 0);
        const currentShiftId = getCurrentUserShiftId();

        if (confirm(`🔒 هل أنت متأكد من إغلاق الوردية (${currentShiftId}) وطباعة التقرير؟`)) {
            await fetch(`${API_BASE}/shifts/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });

            const shiftCloseTime = new Date().toLocaleString('ar-EG');
            document.getElementById('sr-shift-id').innerText = currentShiftId;
            document.getElementById('sr-user-name').innerText = currentUser.name;
            document.getElementById('sr-close-time').innerText = shiftCloseTime;
            document.getElementById('sr-orders-count').innerText = `${currentShiftRecords.length} أوردر`;
            document.getElementById('sr-players-count').innerText = `${shiftTotalPlayers} لاعب`;
            document.getElementById('sr-total-money').innerText = `${shiftTotalMoney} جنيه`;

            let tableHtml = '';
            currentShiftRecords.forEach((r, idx) => {
                tableHtml += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${r.child_name}</td>
                        <td>${r.father_name}</td>
                        <td>${r.game_name} (${r.player_count} لاعب)</td>
                        <td>${r.total_price} ج</td>
                    </tr>
                `;
            });
            document.getElementById('sr-orders-table-body').innerHTML = tableHtml;

            document.getElementById('dashboard-screen')?.classList.add('hidden');
            document.getElementById('shift-summary-screen')?.classList.remove('hidden');
        }
    } catch (err) {
        alert("❌ خطأ عند إقفال الوردية: " + err.message);
    }
}

function finishShiftClose() {
    let shiftCounter = parseInt(localStorage.getItem('shift_counter') || 1) + 1;
    localStorage.setItem('shift_counter', shiftCounter);

    const activeShiftEl = document.getElementById('active-shift-num');
    if (activeShiftEl) activeShiftEl.innerText = getCurrentUserShiftId();

    document.getElementById('shift-summary-screen')?.classList.add('hidden');
    document.getElementById('dashboard-screen')?.classList.remove('hidden');
    resetBookingForm();
}

// ============================================
// 5. Admin Reports Navigation & Filtering
// ============================================
function showAdminReports() {
    if (!isAdmin()) return;
    setTodayAsDefaultDate();
    updateReports();
    document.getElementById('dashboard-screen')?.classList.add('hidden');
    document.getElementById('reports-screen')?.classList.remove('hidden');
}

function setTodayAsDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    if (startDate && endDate) {
        startDate.value = today;
        endDate.value = today;
    }
}

function switchReportTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    updateReports();
}

function filterAndSearchRecords() {
    updateReports();
}

async function updateReports() {
    const startVal = document.getElementById('start-date')?.value || '';
    const endVal = document.getElementById('end-date')?.value || '';

    const shiftSearch = (document.getElementById('search-shift-id')?.value || '').trim().toLowerCase();
    const childSearch = (document.getElementById('search-child-name')?.value || '').trim().toLowerCase();
    const fatherSearch = (document.getElementById('search-father-name')?.value || '').trim().toLowerCase();

    try {
        const res = await fetch(`${API_BASE}/bookings?startDate=${startVal}&endDate=${endVal}&status=${activeTab}`);
        const records = await res.json();

        const filtered = records.filter(r => {
            const shiftMatch = !shiftSearch || (r.shift_id && r.shift_id.toLowerCase().includes(shiftSearch));
            const childNameMatch = !childSearch || (r.child_name && r.child_name.toLowerCase().includes(childSearch));
            const fatherNameMatch = !fatherSearch || (r.father_name && r.father_name.toLowerCase().includes(fatherSearch));
            return shiftMatch && childNameMatch && fatherNameMatch;
        });

        renderRecordsList(filtered);
    } catch (err) {
        console.error("Error fetching reports:", err);
    }
}

function renderRecordsList(records) {
    let recordsHtml = '';
    let totalMoney = 0;
    let totalPlayers = 0;

    records.forEach(record => {
        totalMoney += parseFloat(record.total_price || 0);
        totalPlayers += parseInt(record.player_count || 1);

        recordsHtml += `
            <div class="log-item" style="${record.status === 'modified' ? 'border-left: 5px solid #f6c23e;' : ''}">
                <div class="log-header">
                    <span>🆔 الوردية: <strong>${record.shift_id}</strong> | ⏰ ${record.start_time || ''} - ${record.end_time || ''}</span>
                    <strong style="color:#1cc88a;">${record.total_price} ج</strong>
                </div>
                <div>👶 الطفل: <strong>${record.child_name}</strong> | 👨 الأب: ${record.father_name}</div>
                <div>📞 ${record.phone} | 🎮 ${record.game_name} | 👥 ${record.player_count} لاعب</div>
                ${activeTab === 'active' ? `
                <div style="margin-top: 8px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button style="background:#f6c23e; color:#fff;" onclick="editRecordInit(${record.id}, '${record.child_name}', '${record.father_name}', '${record.phone}', '${record.game_name}', ${record.player_count}, ${record.discount})">✏️ تعديل</button>
                    <button style="background:#e74a3b; color:#fff;" onclick="deleteRecord(${record.id})">🗑️ حذف</button>
                </div>
                ` : ''}
            </div>
        `;
    });

    const moneyEl = document.getElementById('total-money');
    const playersEl = document.getElementById('total-players');
    const listEl = document.getElementById('logs-list');

    if (moneyEl) moneyEl.innerText = `${totalMoney} جنيه`;
    if (playersEl) playersEl.innerText = `${totalPlayers} لاعب`;
    if (listEl) listEl.innerHTML = recordsHtml || `<p style='text-align:center; color:#858796;'>لا توجد نتائج مطابقة للبحث.</p>`;
}

function editRecordInit(id, childName, fatherName, phone, gameName, count, discount) {
    if (confirm(`هل ترغب في جلب بيانات الحجز (${childName}) لشاشة الحجز لتعديلها؟`)) {
        editingRecordId = id;
        document.getElementById('child-name').value = childName;
        document.getElementById('father-name').value = fatherName;
        document.getElementById('customer-phone').value = phone;
        document.getElementById('player-count').value = count;
        document.getElementById('discount-amount').value = discount;

        document.getElementById('game-type').value = gameName;
        updateGamePrices();

        document.getElementById('reports-screen')?.classList.add('hidden');
        document.getElementById('dashboard-screen')?.classList.remove('hidden');
    }
}

async function deleteRecord(id) {
    if (confirm("هل أنت متأكد من إلغاء هذا الحجز؟")) {
        try {
            await fetch(`${API_BASE}/bookings/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleted_by: currentUser ? currentUser.username : 'admin' })
            });
            updateReports();
        } catch (err) {
            alert("❌ فشل عملية الحذف: " + err.message);
        }
    }
}

function resetDateFilter() {
    setTodayAsDefaultDate();
    if (document.getElementById('search-shift-id')) document.getElementById('search-shift-id').value = '';
    if (document.getElementById('search-child-name')) document.getElementById('search-child-name').value = '';
    if (document.getElementById('search-father-name')) document.getElementById('search-father-name').value = '';
    updateReports();
}

function backFromReports() {
    document.getElementById('reports-screen')?.classList.add('hidden');
    document.getElementById('dashboard-screen')?.classList.remove('hidden');
}

// ============================================
// 6. Games Manager UI
// ============================================
function showGamesManager() {
    if (!isAdmin()) return;
    loadGamesList();
    document.getElementById('dashboard-screen')?.classList.add('hidden');
    document.getElementById('games-manager-screen')?.classList.remove('hidden');
}

function backFromGamesManager() {
    document.getElementById('games-manager-screen')?.classList.add('hidden');
    document.getElementById('dashboard-screen')?.classList.remove('hidden');
}

async function addGamePrice() {
    const name = document.getElementById('new-game-name').value.trim();
    const duration = parseInt(document.getElementById('new-game-duration').value);
    const price = parseFloat(document.getElementById('new-game-price').value);

    if (!name || isNaN(duration) || isNaN(price)) {
        alert("يرجى ملء جميع الحقول بصورة صحيحة!");
        return;
    }

    try {
        await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, duration, price })
        });
        document.getElementById('new-game-name').value = '';
        document.getElementById('new-game-duration').value = '';
        document.getElementById('new-game-price').value = '';
        await fetchGamesData();
        loadGamesList();
        loadGamesDropdown();
        alert("✅ تم إدراج اللعبة بنجاح!");
    } catch (err) {
        alert("❌ خطأ: " + err.message);
    }
}

async function removeGamePrice(id) {
    if (confirm("هل تريد إزالة هذا الخيار للعبة؟")) {
        try {
            await fetch(`${API_BASE}/games/${id}`, { method: 'DELETE' });
            await fetchGamesData();
            loadGamesList();
            loadGamesDropdown();
        } catch (err) {
            alert("❌ خطأ: " + err.message);
        }
    }
}

function loadGamesList() {
    const container = document.getElementById('games-list');
    if (!container) return;
    if (gamesData.length === 0) {
        container.innerHTML = '<p style="text-align:center;">لا توجد ألعاب مضافة.</p>';
        return;
    }
    let html = '';
    gamesData.forEach(g => {
        html += `
            <div class="list-item-row" style="display:flex; justify-content:space-between; margin-bottom:10px; padding:10px; background:#f8f9fc; border-radius:5px;">
                <div>🎮 <strong>${g.name}</strong> | ⏳ ${g.duration} دقيقة | 💰 ${g.price} جنيه (لالفرد)</div>
                <button style="background:#e74a3b; color:#fff;" onclick="removeGamePrice(${g.id})">إزالة ✕</button>
            </div>`;
    });
    container.innerHTML = html;
}

// ============================================
// 7. Users Manager UI
// ============================================
async function showUsersManager() {
    if (!isAdmin()) return;
    resetUserForm();
    await loadUsersList();
    document.getElementById('dashboard-screen')?.classList.add('hidden');
    document.getElementById('users-manager-screen')?.classList.remove('hidden');
}

function backFromUsersManager() {
    document.getElementById('users-manager-screen')?.classList.add('hidden');
    document.getElementById('dashboard-screen')?.classList.remove('hidden');
}

async function loadUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/users`);
        systemUsers = await res.json();

        let html = '';
        systemUsers.forEach((u, idx) => {
            html += `
                <div class="list-item-row" style="display:flex; justify-content:space-between; margin-bottom:10px; padding:10px; background:#f8f9fc; border-radius:5px;">
                    <div>👤 <strong>${u.name}</strong> (@${u.username}) - <span style="color:#4e73df;">${u.role === 'admin' ? 'مدير' : 'موظف'}</span></div>
                    <div style="display:flex; gap:5px;">
                        <button style="background:#f6c23e; color:#fff;" onclick="editUserInit(${idx})">✏️ تعديل</button>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p style="color:red;">خطأ جلب المستخدمين: ${err.message}</p>`;
    }
}

async function saveUser() {
    const editIndex = parseInt(document.getElementById('editing-user-index').value);
    const name = document.getElementById('new-user-name').value.trim();
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    if (!name || !username) {
        alert("⚠️ يرجى ملء اسم الموظف واسم المستخدم!");
        return;
    }

    try {
        if (editIndex === -1) {
            if (!password) { alert("⚠️ يرجى كتابة كلمة مرور للموظف الجديد!"); return; }
            await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password, role })
            });
            alert("✅ تم إضافة الموظف بنجاح!");
        } else {
            const user = systemUsers[editIndex];
            await fetch(`${API_BASE}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password, role })
            });
            alert("✅ تم تعديل بيانات الموظف بنجاح!");
        }
        resetUserForm();
        await loadUsersList();
    } catch (err) {
        alert("❌ خطأ أثناء الحفظ: " + err.message);
    }
}

function editUserInit(index) {
    const user = systemUsers[index];
    document.getElementById('editing-user-index').value = index;
    document.getElementById('new-user-name').value = user.name;
    document.getElementById('new-user-username').value = user.username;
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-password').placeholder = "اتركه فارغاً للحفاظ على كلمة المرور القديمة";
    document.getElementById('new-user-role').value = user.role;

    document.getElementById('user-form-title').innerText = `✏️ تعديل بيانات الموظف: (${user.name})`;
    document.getElementById('btn-save-user').innerText = "💾 حفظ التعديلات";
    document.getElementById('btn-cancel-user-edit')?.classList.remove('hidden');
}

function resetUserForm() {
    if (document.getElementById('editing-user-index')) document.getElementById('editing-user-index').value = -1;
    if (document.getElementById('new-user-name')) document.getElementById('new-user-name').value = '';
    if (document.getElementById('new-user-username')) document.getElementById('new-user-username').value = '';
    if (document.getElementById('new-user-password')) {
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-password').placeholder = "كلمة المرور";
    }
    if (document.getElementById('new-user-role')) document.getElementById('new-user-role').value = 'staff';

    if (document.getElementById('user-form-title')) document.getElementById('user-form-title').innerText = "➕ إضافة موظف جديد";
    if (document.getElementById('btn-save-user')) document.getElementById('btn-save-user').innerText = "➕ حفظ الموظف";
    if (document.getElementById('btn-cancel-user-edit')) document.getElementById('btn-cancel-user-edit').classList.add('hidden');
}