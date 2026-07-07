// *** আপনার নতুন গুগল অ্যাপস স্ক্রিপ্ট লিংটি এখানে বসান ***
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLmepg6JN-nBqqVKvRlsCYtnDPfyPBItm_xzrV4GOVRgWDf3Sug1ZKNJDq-xKm8f29/exec';

let allTransactions = [];

// ================= THEME TOGGLE FIX =================
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = themeToggleBtn.querySelector('i');
// লোকাল স্টোরেজ থেকে থিম চেক করা
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
themeIcon.className = currentTheme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme); // সেভ করে রাখা
    themeIcon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
});

// ================= LIVE DATA FETCH & GENERATE REPORT =================
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

// বাংলাদেশ টাইমজোন অনুযায়ী আজকের তারিখ বের করা
const todayDate = new Date();
const offset = todayDate.getTimezoneOffset() * 60000;
const localDateStr = (new Date(todayDate - offset)).toISOString().split('T')[0];

startDateInput.value = localDateStr;
endDateInput.value = localDateStr;

document.getElementById('generateReportBtn').addEventListener('click', async function() {
    const startVal = startDateInput.value; 
    const endVal = endDateInput.value;

    if(!startVal || !endVal) {
        return Swal.fire({icon: 'warning', title: 'Oops...', text: 'দয়া করে তারিখ সিলেক্ট করুন!'});
    }

    // বাটন ক্লিক করার সাথে সাথে লোডিং এনিমেশন শুরু হবে
    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching Data...';
    btn.disabled = true;

    try {
        // ১. সরাসরি ডাটাবেস থেকে লাইভ ডেটা টানা (গুগল রিডাইরেক্ট ফিক্স সহ)
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'GET',
            redirect: 'follow' 
        });
        const data = await response.json();
        allTransactions = data.recentTransactions || [];

        // ২. টাইমজোন ইস্যু ফিক্স করার জন্য লোকাল ডেট তৈরি করা
        const [sYear, sMonth, sDay] = startVal.split('-');
        const startDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);

        const [eYear, eMonth, eDay] = endVal.split('-');
        const endDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59);

        let totalBought = 0; 
        let totalSold = 0;
        const invoiceTableBody = document.getElementById('invoiceTableBody');
        invoiceTableBody.innerHTML = ''; 

        let hasData = false;
        
        // ৩. ডেটা ফিল্টার করা
        allTransactions.forEach(t => {
            if (!t.date) return;

            let tDate;
            let dateStr = String(t.date).trim();
            
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                tDate = new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0); 
            } else {
                tDate = new Date(dateStr);
            }

            if (tDate >= startDate && tDate <= endDate) {
                hasData = true;
                const qty = Number(t.quantity);
                if (t.type === 'Buy') totalBought += qty;
                else if (t.type === 'Sell') totalSold += qty;
                
                const badgeClass = t.type === 'Buy' ? 'text-buy' : 'text-sell';
                
                // টেবিলের তারিখ ছোট ও সুন্দর করা
                let cleanDate = dateStr;
                if(dateStr.length > 15) {
                    cleanDate = new Date(dateStr).toLocaleDateString('en-GB');
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${cleanDate}</td>
                    <td><strong>${t.productId}</strong></td>
                    <td>${t.productName}</td>
                    <td class="${badgeClass}"><strong>${t.type}</strong></td>
                    <td>${qty}</td>
                `;
                invoiceTableBody.appendChild(tr);
            }
        });

        // ৪. কার্ড আপডেট করা
        document.getElementById('monthlyTotalBuy').innerText = totalBought;
        document.getElementById('monthlyTotalSell').innerText = totalSold;
        document.getElementById('monthlyNetFlow').innerText = totalBought - totalSold;
        
        // ৫. ইনভয়েস শো করানো
        if(hasData) {
            document.getElementById('invoiceWrapper').classList.remove('hidden');
            document.getElementById('invoiceMonthLabel').innerText = `Report: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`;
            document.getElementById('invTotalBuy').innerText = totalBought;
            document.getElementById('invTotalSell').innerText = totalSold;
            document.getElementById('invNetFlow').innerText = totalBought - totalSold;
        } else {
            document.getElementById('invoiceWrapper').classList.add('hidden');
            Swal.fire({
                icon: 'info',
                title: 'কোনো ডেটা নেই',
                text: 'এই তারিখের মধ্যে কোনো কেনা-বেচার রেকর্ড পাওয়া যায়নি!',
                confirmButtonColor: '#10b981'
            });
        }

    } catch (error) {
        console.error("Connection Error: ", error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'গুগল শিট থেকে ডেটা লোড হতে সমস্যা হচ্ছে! ইন্টারনেট চেক করুন।',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        // কাজ শেষ হলে বাটনটি আবার স্বাভাবিক করে দেওয়া
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
// ================= PDF DOWNLOAD LOGIC (Advanced) =================
document.getElementById('downloadPdfBtn').addEventListener('click', function() {
    const btn = this;
    const originalText = btn.innerHTML;
    
    // ডাউনলোডের সময় বাটনে লোডিং এনিমেশন দেখানো
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
    btn.disabled = true;

    try {
        const element = document.getElementById('invoiceContainer');
        const reportDateStr = document.getElementById('invoiceMonthLabel').innerText.replace('Report: ', '');
        
        // ডানদিকের Date: অপশনে আজকের তারিখ বসানো (যদি ফাঁকা থাকে)
        document.getElementById('invoiceDateGenerated').innerText = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;

        const opt = {
            margin:       0.3, // মার্জিন কমানো হয়েছে যেন এক পেজে সুন্দর করে ধরে
            filename:     `Similia_Stock_${reportDateStr.replace(/ /g, '_').replace(/\//g, '-')}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true }, // useCORS খুব জরুরি, নাহলে অনেক ব্রাউজার ব্লক করে দেয়
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        // PDF তৈরি ও সেভ করা
        html2pdf().set(opt).from(element).save().then(() => {
            // ডাউনলোড শেষ হলে বাটন আবার আগের মতো হয়ে যাবে
            btn.innerHTML = originalText;
            btn.disabled = false;
        }).catch(err => {
            console.error("PDF Error: ", err);
            alert("PDF ডাউনলোডে সমস্যা হয়েছে। ব্রাউজার বা ইন্টারনেট কানেকশন চেক করুন।");
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
        
    } catch (error) {
        console.error(error);
        alert("PDF লাইব্রেরি ঠিকমতো কাজ করছে না। দয়া করে পেজটি রিলোড (Ctrl+F5) দিন।");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});