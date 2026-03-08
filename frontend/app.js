/**
 * Kinetic — Frontend Application Logic
 *
 * Handles GitHub OAuth flow, token management, dashboard rendering,
 * and wallet linking.
 */

const API_URL = ''; // Same origin — backend serves the frontend

// ===================================
//  Initialize
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // Check if returning from OAuth callback with token
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        localStorage.setItem('kinetic_token', token);
        // Clean URL
        window.history.replaceState({}, document.title, '/dashboard');
        showDashboard();
    } else if (localStorage.getItem('kinetic_token')) {
        showDashboard();
    } else {
        showLoginPage();
    }

    // Start typing animation on login page
    if (!localStorage.getItem('kinetic_token')) {
        startTypingAnimation();
    }
});

// ===================================
//  Auth Functions
// ===================================
function loginWithGithub() {
    window.location.href = `${API_URL}/api/auth/github`;
}

function logout() {
    localStorage.removeItem('kinetic_token');
    window.location.href = '/';
}

// ===================================
//  Page Switching
// ===================================
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
}

async function showDashboard() {
    const token = localStorage.getItem('kinetic_token');
    if (!token) {
        showLoginPage();
        return;
    }

    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        const data = await response.json();
        renderDashboard(data.user);
    } catch (error) {
        console.error('Auth error:', error);
        showToast('Session expired. Please log in again.', 'error');
        localStorage.removeItem('kinetic_token');
        setTimeout(() => {
            showLoginPage();
        }, 1500);
    }
}

// ===================================
//  Dashboard Rendering
// ===================================
function renderDashboard(user) {
    // Avatar & name
    const avatarEl = document.getElementById('user-avatar');
    avatarEl.src = user.avatarUrl || `https://github.com/${user.github}.png`;
    avatarEl.alt = user.displayName;

    document.getElementById('user-name').textContent = user.displayName || user.github;
    document.getElementById('user-github').textContent = `@${user.github}`;

    // Stats
    document.getElementById('stat-did').textContent = user.did;
    document.getElementById('stat-ipfs').textContent = truncateCID(user.ipfsCID);
    document.getElementById('stat-created').textContent = new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    // DID Document JSON
    const didDoc = user.didDocument || {
        id: user.did,
        github: user.github,
        wallet: user.wallet,
        createdAt: user.createdAt,
    };
    document.getElementById('did-document-json').innerHTML = syntaxHighlight(JSON.stringify(didDoc, null, 2));

    // MongoDB Record
    const mongoRecord = {
        github: user.github,
        did: user.did,
        ipfsCID: user.ipfsCID,
        wallet: user.wallet || null,
    };
    document.getElementById('mongo-record-json').innerHTML = syntaxHighlight(JSON.stringify(mongoRecord, null, 2));

    // Wallet
    if (user.wallet) {
        document.getElementById('wallet-status').textContent = user.wallet;
        document.getElementById('wallet-status').classList.add('connected');
        document.getElementById('wallet-input').value = user.wallet;
    }
}

// ===================================
//  Wallet Update
// ===================================
async function updateWallet() {
    const token = localStorage.getItem('kinetic_token');
    const walletInput = document.getElementById('wallet-input');
    const wallet = walletInput.value.trim();

    if (!wallet) {
        showToast('Please enter a wallet address', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/wallet`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ wallet }),
        });

        if (!response.ok) {
            throw new Error('Failed to update wallet');
        }

        const data = await response.json();
        document.getElementById('wallet-status').textContent = wallet;
        document.getElementById('wallet-status').classList.add('connected');
        showToast('Wallet linked successfully!', 'success');

        // Refresh dashboard data
        showDashboard();
    } catch (error) {
        console.error('Wallet update error:', error);
        showToast('Failed to link wallet. Try again.', 'error');
    }
}

// ===================================
//  Utilities
// ===================================
function truncateCID(cid) {
    if (!cid) return '—';
    if (cid.length <= 20) return cid;
    return `${cid.substring(0, 12)}...${cid.substring(cid.length - 8)}`;
}

function syntaxHighlight(json) {
    return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g,
            (match) => {
                if (/:$/.test(match)) {
                    // Key
                    return `<span class="json-key">${match.slice(0, -1)}</span>:`;
                }
                // String value
                return `<span class="json-string">${match}</span>`;
            }
        )
        .replace(/\b(true|false|null)\b/g, '<span style="color: #f59e0b;">$1</span>')
        .replace(/\b(\d+)\b/g, '<span style="color: #f59e0b;">$1</span>');
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach((t) => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================================
//  Typing Animation (Login Page)
// ===================================
function startTypingAnimation() {
    const names = ['alice', 'bob-dev', 'carol', 'dave-oss', 'eve'];
    const githubs = ['alice-dev', 'bob-builder', 'carol-code', 'dave-contrib', 'eve-hacker'];
    let index = 0;

    setInterval(() => {
        index = (index + 1) % names.length;
        const didEl = document.getElementById('typing-did');
        const githubEl = document.getElementById('typing-github');

        if (didEl && githubEl) {
            // Fade out
            didEl.style.opacity = '0';
            githubEl.style.opacity = '0';
            didEl.style.transition = 'opacity 0.3s';
            githubEl.style.transition = 'opacity 0.3s';

            setTimeout(() => {
                didEl.textContent = names[index];
                githubEl.textContent = githubs[index];
                didEl.style.opacity = '1';
                githubEl.style.opacity = '1';
            }, 300);
        }
    }, 3000);
}
