
// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const html = document.documentElement;
const saved = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', saved);
updateThemeIcon(saved);

function updateThemeIcon(theme) {
    if (theme === 'light') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }
}

themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
    if (typeof Chart !== 'undefined') {
        updateChartColors(next);
    }
});

// Mobile Menu
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
hamburgerBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
});
document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
    });
});

// Scroll Animation
html.classList.add('animations-ready');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
document.querySelectorAll('section').forEach(s => observer.observe(s));

// Counter Animation
let counted = false;
const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting && !counted) {
            counted = true;
            document.querySelectorAll('.counter').forEach(c => {
                const target = parseInt(c.dataset.target);
                const dur = 1500;
                const inc = target / (dur / 16);
                let cur = 0;
                const timer = setInterval(() => {
                    cur += inc;
                    if (cur >= target) { c.textContent = target; clearInterval(timer); }
                    else c.textContent = Math.floor(cur);
                }, 16);
            });
        }
    });
}, { threshold: 0.5 });
counterObs.observe(document.querySelector('.stats-bar'));

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    });
});

// Client Panel Switcher
document.querySelectorAll('.client-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
        var selector = pill.closest('.work-sub');
        selector.querySelectorAll('.client-pill').forEach(function(p) { p.classList.remove('active'); });
        selector.querySelectorAll('.client-panel').forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');
        var panel = document.getElementById(pill.getAttribute('data-panel'));
        if (panel) { panel.classList.add('active'); }
    });
});

// Animated count-up on scroll (hero numbers in result cards)
const heroNumbers = document.querySelectorAll('.hero-number');
const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('visible')) {
            entry.target.classList.add('visible');
            const el = entry.target;
            const target = parseFloat(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            const isDecimal = target % 1 !== 0;
            const duration = 1500;
            const start = performance.now();
            function tick(now) {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = target * eased;
                el.textContent = (isDecimal ? current.toFixed(2) : Math.round(current)) + suffix;
                if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        }
    });
}, { threshold: 0.3 });
heroNumbers.forEach(el => countObserver.observe(el));

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href === '#top') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const t = document.querySelector(href);
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// Charts
function getChartColors(theme) {
    return {
        line: theme === 'dark' ? '#A78BFA' : '#7C3AED',
        bar: theme === 'dark' ? '#F59E0B' : '#D97706',
        fill: theme === 'dark' ? 'rgba(167,139,250,0.12)' : 'rgba(124,58,237,0.06)',
        grid: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        text: theme === 'dark' ? '#78716C' : '#A8A29E',
    };
}

let aptosLine, aptosBar, seamlessLine, ionetLine;
const initTheme = html.getAttribute('data-theme');

function createCharts(theme) {
    if (typeof Chart === 'undefined') return;

    const c = getChartColors(theme);
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = c.text;

    const commonScales = {
        y: { beginAtZero: true, grid: { color: c.grid, drawBorder: false }, ticks: { padding: 8 } },
        x: { grid: { display: false }, ticks: { padding: 4 } }
    };
    const commonPlugins = { legend: { display: false } };

    aptosLine = new Chart(document.getElementById('aptosLineChart'), {
        type: 'line',
        data: {
            labels: ['Jun','Jul','Aug','Sep','Oct'],
            datasets: [{ label: 'Avg Views/Tweet', data: [7457,9366,9277,11870,23800],
                borderColor: c.line, backgroundColor: c.fill, tension: 0.4, fill: true,
                pointRadius: 3, pointBackgroundColor: c.line, borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, title: { display: true, text: 'Avg Views per Tweet', color: c.text, padding: { bottom: 12 } } },
            scales: commonScales }
    });

    aptosBar = new Chart(document.getElementById('aptosBarChart'), {
        type: 'bar',
        data: {
            labels: ['Jun','Jul','Aug','Sep','Oct'],
            datasets: [{ label: 'Impressions', data: [270000,732000,409000,718000,2220000],
                backgroundColor: c.bar, borderRadius: 4, barPercentage: 0.6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, title: { display: true, text: 'Monthly Impressions', color: c.text, padding: { bottom: 12 } } },
            scales: commonScales }
    });

    seamlessLine = new Chart(document.getElementById('seamlessLineChart'), {
        type: 'line',
        data: {
            labels: ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'],
            datasets: [{ label: 'Avg Views/Post', data: [1412,1680,2100,2450,2900,3200,3550,3871],
                borderColor: c.line, backgroundColor: c.fill, tension: 0.4, fill: true,
                pointRadius: 3, pointBackgroundColor: c.line, borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, title: { display: true, text: 'Avg Views per Post', color: c.text, padding: { bottom: 12 } } },
            scales: commonScales }
    });

    ionetLine = new Chart(document.getElementById('ionetLineChart'), {
        type: 'line',
        data: {
            labels: ['Aug','Sep','Oct','Nov','Dec','Jan'],
            datasets: [{ label: 'Traffic Value ($)', data: [5097,8500,12000,16000,20000,27022],
                borderColor: c.line, backgroundColor: c.fill, tension: 0.4, fill: true,
                pointRadius: 3, pointBackgroundColor: c.line, borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, title: { display: true, text: 'Estimated Traffic Value ($)', color: c.text, padding: { bottom: 12 } } },
            scales: commonScales }
    });
}

function updateChartColors(theme) {
    if (typeof Chart === 'undefined') return;

    const c = getChartColors(theme);
    [aptosLine, aptosBar, seamlessLine, ionetLine].forEach(chart => {
        if (!chart) return;
        chart.options.scales.y.grid.color = c.grid;
        chart.options.plugins.title.color = c.text;
        Chart.defaults.color = c.text;
        const ds = chart.data.datasets[0];
        if (chart.config.type === 'line') {
            ds.borderColor = c.line; ds.backgroundColor = c.fill;
            ds.pointBackgroundColor = c.line;
        } else {
            ds.backgroundColor = c.bar;
        }
        chart.update();
    });
}

createCharts(initTheme);

// Subtle top-bar shadow on scroll
window.addEventListener('scroll', () => {
    const topBar = document.querySelector('.top-bar');
    if (window.scrollY > 10) {
        topBar.style.boxShadow = '0 1px 8px rgba(0,0,0,0.06)';
    } else {
        topBar.style.boxShadow = 'none';
    }
});
