// *** আপনার নতুন গুগল অ্যাপস স্ক্রিপ্ট লিংটি এখানে বসান ***
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLmepg6JN-nBqqVKvRlsCYtnDPfyPBItm_xzrV4GOVRgWDf3Sug1ZKNJDq-xKm8f29/exec';

let productDB = [];
let allTransactions = [];
let lowStockDataList = []; // লো-স্টক ডেটা ধরে রাখার জন্য
let expiringDataList = []; // মেয়াদোত্তীর্ণের ডেটা ধরে রাখার জন্য

// THEME TOGGLE 
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = themeToggleBtn.querySelector('i');
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcon(theme);
});

function updateThemeIcon(theme) {
    themeIcon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

// FETCH LIVE DATA
// FETCH LIVE DATA
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL);

        // ১. যদি লিংক ভুল থাকে বা গুগল পারমিশন ব্লক করে দেয়, তাহলে এই এরর ধরবে
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();

        // ২. যদি এক্সেলের ভেতরে কোনো কোডিং এরর থাকে, তবে সেটি ধরবে
        if (data.error) {
            throw new Error(data.error);
        }

        // সব ঠিক থাকলে ড্যাশবোর্ড আপডেট করবে
        animateValue(document.getElementById('todaySalesStat'), data.todaySales || 0);
        animateValue(document.getElementById('totalProductsStat'), data.totalProducts || 0);
        animateValue(document.getElementById('lowStockStat'), data.lowStockCount || 0);
        expiringDataList = data.expiringDetails || [];
        animateValue(document.getElementById('expiringStat'), data.expiringCount || 0);

        productDB = data.products || [];
        populateProductDropdown();

        allTransactions = data.recentTransactions || [];
        document.querySelector('#transactionTable tbody').innerHTML = '';

        const displayLimit = Math.min(allTransactions.length, 15);
        const latestTransactions = allTransactions.slice(-displayLimit).reverse();

        latestTransactions.forEach(item => {
            updateLocalTable(item, false);
        });

        lowStockDataList = data.lowStockDetails || [];
    }

    catch (error) {
        console.error("Error Details: ", error);

        // ৩. কানেকশন ফেইল করলে ইউজারের স্ক্রিনে এই মেসেজটি দেখাবে
        alert("⚠️ ডাটাবেস কানেকশন ফেইল করেছে! \n\nসম্ভাব্য কারণ:\n১. script.js ফাইলে লিংকটি ভুল হতে পারে।\n২. লিংকের পারমিশন (Anyone) দেওয়া নেই।");

        // ফর্মের নিচেও লাল রঙের মেসেজ দেখিয়ে দেবে
        const statusMsg = document.getElementById('statusMessage');
        if (statusMsg) {
            statusMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Database Disconnected! Check URL.';
            statusMsg.style.color = "var(--danger)";
            statusMsg.classList.remove("hidden");
        }
    }
});
// PRODUCT AUTO-SUGGEST
const productIdInput = document.getElementById('productId');
const productNameInput = document.getElementById('productName');
const categoryInput = document.getElementById('category');

function populateProductDropdown() {
    const dataList = document.getElementById('product-suggestions');
    dataList.innerHTML = '';
    productDB.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.text = `${p.name} (${p.category})`;
        dataList.appendChild(option);
    });
}

productIdInput.addEventListener('input', function () {
    const matched = productDB.find(p => p.id === this.value.trim());
    if (matched) {
        productNameInput.value = matched.name;
        categoryInput.value = matched.category;
    } else {
        productNameInput.value = '';
        categoryInput.value = '';
    }
});

// FORM SUBMISSION
document.getElementById('stockForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');

  const payload = {
        date: new Date().toLocaleDateString('en-GB'),
        productId: productIdInput.value,
        productName: productNameInput.value,
        category: categoryInput.value,
        type: document.getElementById('transactionType').value,
        quantity: parseInt(document.getElementById('quantity').value),
        expiryDate: document.getElementById('expiryDate').value // <-- Ei naya line ti jog korun
    };

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.result === "success") {
            statusMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved successfully!';
            statusMsg.style.color = "var(--accent)";
            statusMsg.classList.remove("hidden");
        }
    } catch (error) {
        statusMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error Connection!';
        statusMsg.style.color = "var(--danger)";
        statusMsg.classList.remove("hidden");
    } finally {
        // নতুন ডেটা টেবিলে অ্যাড করা
        updateLocalTable(payload, true);

        // **Today's Sales লাইভ আপডেট করার কোড**
        if (payload.type === 'Sell') {
            const currentSales = parseInt(document.getElementById('todaySalesStat').innerText) || 0;
            animateValue(document.getElementById('todaySalesStat'), currentSales + payload.quantity);
        }

        // ফর্ম ক্লিয়ার করা
        productIdInput.value = '';
        productNameInput.value = '';
        categoryInput.value = '';
        document.getElementById('quantity').value = '';

        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save to Database';
            btn.disabled = false;
            statusMsg.classList.add("hidden");
        }, 3000);
    }
});

// UPDATE LOCAL TABLE
function updateLocalTable(data, pushToArray = true) {
    if (pushToArray) allTransactions.push(data);

    const tbody = document.querySelector('#transactionTable tbody');
    const row = document.createElement('tr');
    row.classList.add('fade-in');

    const badgeClass = data.type === 'Buy' ? 'type-buy' : 'type-sell';

    row.innerHTML = `
        <td>${data.date}</td>
        <td><strong>${data.productId}</strong></td>
        <td>${data.productName}</td>
        <td><span class="type-badge ${badgeClass}">${data.type}</span></td>
        <td>${data.quantity}</td>
    `;
    if (pushToArray) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }
}

// NUMBER ANIMATION
function animateValue(obj, end) {
    let startTimestamp = null;
    const duration = 1000;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * end);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = end;
    };
    window.requestAnimationFrame(step);
}

// ================= LOW STOCK CLICK FEATURE =================
document.getElementById('lowStockCard').addEventListener('click', function () {
    const tbody = document.querySelector('#transactionTable tbody');
    const tableHeader = document.querySelector('.table-section .section-header h3');

    // টেবিলের টাইটেল পরিবর্তন করা
    tableHeader.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i> Low Stock Items <span style="font-size:0.8rem; cursor:pointer; color:var(--accent); float:right;" id="resetTableBtn"><i class="fa-solid fa-rotate-left"></i> Back to Recent</span>';

    tbody.innerHTML = ''; // আগের ডেটা ক্লিয়ার করা

    if (lowStockDataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">সব প্রোডাক্টের স্টক পর্যাপ্ত আছে!</td></tr>';
    } else {
        // লো-স্টক ডেটাগুলো টেবিলে বসানো
        lowStockDataList.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('fade-in');
            row.innerHTML = `
                <td>-</td>
                <td><strong>${item.id}</strong></td>
                <td>${item.name}</td>
                <td><span class="type-badge type-sell">Warning</span></td>
                <td><strong style="color:var(--danger)">${item.stock}</strong></td>
            `;
            tbody.appendChild(row);
        });
    }

    // "Back to Recent" বাটনে ক্লিক করলে আবার আগের ট্রানজেকশন দেখাবে
    document.getElementById('resetTableBtn').addEventListener('click', function () {
        tableHeader.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Recent Activity';
        tbody.innerHTML = '';
        const displayLimit = Math.min(allTransactions.length, 15);
        const latestTransactions = allTransactions.slice(-displayLimit).reverse();
        latestTransactions.forEach(item => {
            updateLocalTable(item, false);
        });
    });
});
//---------------------------------------------------------
// ================= EXPIRING SOON CLICK FEATURE =================
document.getElementById('expiringCard').addEventListener('click', function () {
    const tbody = document.querySelector('#transactionTable tbody');
    const tableHeader = document.querySelector('.table-section .section-header h3');

    tableHeader.innerHTML = '<i class="fa-solid fa-calendar-xmark" style="color:var(--danger)"></i> Expiring Soon (Next 60 Days) <span style="font-size:0.8rem; cursor:pointer; color:var(--accent); float:right;" id="resetTableBtnExp"><i class="fa-solid fa-rotate-left"></i> Back to Recent</span>';

    tbody.innerHTML = '';

    if (expiringDataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">আগামী ২ মাসে কোনো প্রোডাক্টের মেয়াদ শেষ হচ্ছে না!</td></tr>';
    } else {
       // ৫. ফিল্টার করা ডেটাগুলো টেবিলে বসানো
        expiringDataList.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('fade-in'); 
            
            // colspan="2" সরিয়ে দিয়ে আলাদা Qty কলাম তৈরি করা হলো
            row.innerHTML = `
                <td><strong style="color:var(--danger)">${item.expDate}</strong></td>
                <td><strong>${item.id}</strong></td>
                <td>${item.name}</td>
                <td><span class="type-badge type-sell">Expiring in ${item.daysLeft} Days</span></td>
                <td><strong style="color:var(--danger); font-size: 1.1rem;">${item.stock}</strong></td>
            `;
            tbody.appendChild(row);
        });
    }

    document.getElementById('resetTableBtnExp').addEventListener('click', function () {
        tableHeader.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Recent Activity';
        tbody.innerHTML = '';
        const displayLimit = Math.min(allTransactions.length, 15);
        const latestTransactions = allTransactions.slice(-displayLimit).reverse();
        latestTransactions.forEach(item => {
            updateLocalTable(item, false);
        });
    });
});
// ================= SHOW/HIDE EXPIRY DATE =================
document.getElementById('transactionType').addEventListener('change', function () {
    const expiryGroup = document.getElementById('expiryDateGroup');
    if (this.value === 'Buy') {
        expiryGroup.classList.remove('hidden');
        document.getElementById('expiryDate').required = true;
    } else {
        expiryGroup.classList.add('hidden');
        document.getElementById('expiryDate').required = false;
        document.getElementById('expiryDate').value = '';
    }
});


// =============================================================================
// NEW ADDITION: TODAY'S SALES CLICK FEATURE (script.js er ekdom niche paste korun)
// =============================================================================

document.getElementById('todaySalesCard').addEventListener('click', function() {
    const tbody = document.querySelector('#transactionTable tbody');
    const tableHeader = document.querySelector('.table-section .section-header h3');
    
    // ১. Table Header er nam bodle "Today's Sales" kora ebong "Back to Recent" button add kora
    tableHeader.innerHTML = '<i class="fa-solid fa-arrow-trend-up" style="color:#3b82f6"></i> Today\'s Sales <span style="font-size:0.8rem; cursor:pointer; color:var(--accent); float:right;" id="resetTableBtnSales"><i class="fa-solid fa-rotate-left"></i> Back to Recent</span>';
    
    tbody.innerHTML = ''; // Table er baki purano data clear kora
    
    // ২. Bangladesh time onujayi ajker tarikh (DD/MM/YYYY) format e ber kora
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    // ৩. Database er shob data theke shudhu ajker tarikh ebong "Sell" type transaction gulo filter kora
    const todaySalesData = allTransactions.filter(t => t.type === 'Sell' && t.date === todayStr);

    // ৪. Condition Check: Ajke jodi kono sell na thake
    if (todaySalesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Ajke akhono kono product sell hoyni!</td></tr>';
    } else {
        // ৫. JODI SELL THAKE, TOBE LATEST DATA GULO TABLE E SHOW KORA
        todaySalesData.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('fade-in'); 
            row.innerHTML = `
                <td>${item.date}</td>
                <td><strong>${item.productId}</strong></td>
                <td>${item.productName}</td>
                <td><span class="type-badge type-sell">${item.type}</span></td>
                <td><strong>${item.quantity}</strong></td>
            `;
            tbody.appendChild(row);
        });
    }

    // -----------------------------------------------------------------
    // BACK TO RECENT FUNCTION: "Back to Recent" button e click korle purano table firat ashbe
    // -----------------------------------------------------------------
    document.getElementById('resetTableBtnSales').addEventListener('click', function() {
        tableHeader.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Recent Activity';
        tbody.innerHTML = '';
        
        // Agger moto top 15 transaction table e firat ana
        const displayLimit = Math.min(allTransactions.length, 15);
        const latestTransactions = allTransactions.slice(0, displayLimit); 
        
        latestTransactions.forEach(item => {
            updateLocalTable(item, false); 
        });
    });
});

// =============================================================================