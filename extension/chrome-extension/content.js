(function() {
    'use strict';

    if (window !== window.top) {
        return;
    }

    if (window.__GENREACH_CONTENT_INITIALIZED__) {
        return;
    }
    window.__GENREACH_CONTENT_INITIALIZED__ = true;

    let isProcessing = false;
    let hasClickedMessageButton = false;
    let openUiPromise = null;

    // Safe DOM helper wrappers (use module if present, else local minimal fallback)
    function getDomModule() {
        return (window.GENREACH && window.GENREACH.dom) || null;
    }

    function waitForElementLocal(selector, timeoutMs = 15000, root = document) {
        return new Promise((resolve, reject) => {
            const existing = root.querySelector(selector);
            if (existing) { resolve(existing); return; }
            const observer = new MutationObserver(() => {
                const el = root.querySelector(selector);
                if (el) { observer.disconnect(); resolve(el); }
            });
            const observeTarget = (root === document ? (document.documentElement || document.body) : root);
            observer.observe(observeTarget, { childList: true, subtree: true });
            setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout waiting for selector: ${selector}`)); }, timeoutMs);
        });
    }

    function isVisibleLocal(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || +style.opacity === 0) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function findMessageContainersLocal() {
        const selectors = [
            '.msg-overlay-conversation-bubble',
            '.msg-conversation-container',
            '.msg-overlay',
            '.msg-form',
            'section.msg-overlay-bubble',
            'aside.msg-overlay-container'
        ];
        const nodes = new Set();
        for (const s of selectors) {
            (document.querySelectorAll(s) || []).forEach(n => nodes.add(n));
        }
        return Array.from(nodes).filter(isVisibleLocal);
    }

    function findMessageInputLocal(container) {
        const selectors = [
            '.msg-form__contenteditable[contenteditable="true"]',
            '.msg-form__contenteditable',
            'div[role="textbox"][contenteditable="true"]',
            'div[contenteditable="true"][data-placeholder]',
            'div[contenteditable="true"].notranslate',
            'div[aria-label="Write a message"]',
            'div[data-test-id="message-compose-input"]',
            'div[data-placeholder]',
            // Fall back to textareas some InMail flows use
            'textarea',
        ];
        const roots = [];
        if (container) roots.push(container);
        roots.push(document);
        for (const root of roots) {
            for (const selector of selectors) {
                const candidates = Array.from(root.querySelectorAll(selector));
                const candidate = candidates.find(el => isVisibleLocal(el) && el.closest('.msg-form, .msg-conversation-container, .msg-overlay-conversation-bubble, .msg-overlay'));
                if (candidate) return candidate;
            }
        }
        for (const root of roots) {
            const contentEditableDivs = root.querySelectorAll('div[contenteditable="true"]');
            for (const div of contentEditableDivs) {
                if (!isVisibleLocal(div)) continue;
                const placeholder = (div.getAttribute('data-placeholder') || '').toLowerCase();
                if (placeholder.includes('message') || placeholder.includes('write')) return div;
            }
        }
        return null;
    }

    function findMessageButtonLocal() {
        const candidates = ['button[aria-label^="Message"]','a[aria-label^="Message"]','button','a'];
        for (const selector of candidates) {
            const elements = Array.from(document.querySelectorAll(selector));
            const el = elements.find(e => {
                const t = (e.innerText || '').trim().toLowerCase();
                return t === 'message' || t === 'inmail' || t.includes('message') || t.includes('inmail');
            });
            if (el) return el;
        }
        const header = document.querySelector('#profile-content, .pv-top-card, .pv-top-card-v2-ctas');
        if (header) {
            const buttons = Array.from(header.querySelectorAll('button, a'));
            const el = buttons.find(e => {
                const t = (e.innerText || '').trim().toLowerCase();
                return t === 'message' || t === 'inmail' || t.includes('message') || t.includes('inmail');
            });
            if (el) return el;
        }
        return null;
    }

    function findAndOpenMoreMenu() {
        // Try to open the "More" menu to reveal Message/InMail
        const header = document.querySelector('#profile-content, .pv-top-card, .pv-top-card-v2-ctas') || document;
        const moreCandidates = Array.from(header.querySelectorAll('button, a')).filter(isVisibleLocal);
        const moreBtn = moreCandidates.find(e => {
            const t = (e.innerText || '').trim().toLowerCase();
            return t === 'more' || t.includes('more');
        }) || header.querySelector('button[aria-label*="More" i], a[aria-label*="More" i]');
        if (moreBtn) {
            try { moreBtn.click(); } catch (_) {}
            return true;
        }
        return false;
    }

    function getLatestMessageContainerLocal() {
        const containers = findMessageContainersLocal();
        return containers.length ? containers[containers.length - 1] : null;
    }

    function simulateTypingIntoElementLocal(targetElement, text) {
        targetElement.innerHTML = '';
        targetElement.textContent = text;
        if (!targetElement.querySelector('br')) targetElement.appendChild(document.createElement('br'));
        if (targetElement.hasAttribute('data-artdeco-is-empty')) targetElement.setAttribute('data-artdeco-is-empty', 'false');
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function injectMessageSafe(message, container) {
        const Dom = getDomModule();
        if (Dom && Dom.injectMessage) return Dom.injectMessage(message, container);
        const root = (container || document);
        const explicit = root.querySelector('div[aria-label="Write a message…"]');
        if (explicit) {
            const p = explicit.querySelector('p');
            if (p) {
                p.textContent = message;
                try { explicit.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (_) { explicit.dispatchEvent(new Event('input', { bubbles: true })); }
                return true;
            }
        }
        const input = findMessageInputLocal(container);
        if (input) {
            input.innerHTML = '';
            input.focus();
            simulateTypingIntoElementLocal(input, message);
            if (input.hasAttribute('data-artdeco-is-empty')) input.setAttribute('data-artdeco-is-empty', 'false');
            return true;
        }
        return false;
    }

    async function ensureMessageUIOpenSafe() {
        const Dom = getDomModule();
        if (Dom && Dom.ensureMessageUIOpen) return await Dom.ensureMessageUIOpen();
        // Minimal fallback
        let container = getLatestMessageContainerLocal();
        let existing = findMessageInputLocal(container || undefined);
        if (existing) return { ok: true, container };
        const containers = findMessageContainersLocal();
        if (containers.length > 0) {
            try {
                container = containers[containers.length - 1];
                // Consider UI open as soon as container is present; input may appear slightly later.
                return { ok: true, container };
            } catch (err) {
                return { ok: false, error: `Message dialog open but input not found: ${err.message}` };
            }
        }
        const btn = findMessageButtonLocal();
        if (!btn) {
            // Try opening More menu and clicking an item named Message or InMail
            const opened = findAndOpenMoreMenu();
            if (!opened) return { ok: false, error: 'Message button not found on profile' };
            // After opening, try to find a menu item
            const items = Array.from(document.querySelectorAll('[role="menuitem"], a, button')).filter(isVisibleLocal);
            const menuTarget = items.find(e => {
                const t = (e.innerText || '').trim().toLowerCase();
                return t === 'message' || t === 'inmail' || t.includes('message') || t.includes('inmail');
            });
            if (menuTarget) {
                try { menuTarget.click(); } catch (_) {}
            } else {
                return { ok: false, error: 'Message/InMail menu item not found' };
            }
        } else {
            if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return { ok: false, error: 'Message button is disabled' };
            btn.scrollIntoView({ block: 'center', inline: 'center' });
            btn.click();
        }
        try {
            container = await waitForElementLocal('.msg-overlay-conversation-bubble, .msg-conversation-container, .msg-overlay, div[role="dialog"], .artdeco-modal', 15000);
            return { ok: true, container };
        } catch (err) {
            return { ok: false, error: `Message dialog did not appear: ${err.message}` };
        }
    }

    function isLinkedInProfile() {
        const url = window.location.href;
        // Standard profiles live under /in/. Exclude edit routes.
        if (url.includes('linkedin.com/in/') && !url.includes('/edit')) return true;
        // Handle some alternate profile routes LinkedIn may use.
        if (url.includes('linkedin.com/pub/') && !url.includes('/edit')) return true;
        return false;
    }

    // Compose message data using scraper module
    async function composeMessageData() {
        const profileInfo = (window.GENREACH && window.GENREACH.scrape && window.GENREACH.scrape.getProfileInfo)
        ? window.GENREACH.scrape.getProfileInfo()
        : { name: '', title: '', company: '' };
    
        const extendedProfile = (window.GENREACH && window.GENREACH.scrape && window.GENREACH.scrape.getExtendedProfile)
        ? window.GENREACH.scrape.getExtendedProfile()
        : { about: '', experiences: [], education: [], awards: [], recentPosts: [] };
    
        return { profileInfo, extendedProfile };
    }

    // Lightweight Apple-style floating panel injected on profile pages
    let panelHost = null;
    let panelShadow = null;
    let panelElements = null;
    let currentTheme = null; // 'light' | 'dark'

    function createPanel() {
        if (panelHost) return panelHost;
        panelHost = document.createElement('div');
        panelHost.id = 'genreach-panel-host';
        panelHost.style.position = 'fixed';
        panelHost.style.right = '16px';
        panelHost.style.top = '16px';
        panelHost.style.zIndex = '999999';
        panelHost.style.pointerEvents = 'none';
        document.documentElement.appendChild(panelHost);

        panelShadow = panelHost.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        wrapper.style.pointerEvents = 'auto';
        wrapper.innerHTML = '<div style="padding:8px 10px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">Loading Sales.ai…</div>';
        panelShadow.appendChild(wrapper);

        const panelUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('panel.html') : null;
        const initializeFromHtml = (html) => {
            wrapper.innerHTML = html;
            panelElements = {
                card: panelShadow.getElementById('gr-card'),
                status: panelShadow.getElementById('gr-status'),
                generate: panelShadow.getElementById('gr-generate'),
                close: panelShadow.getElementById('gr-close'),
                theme: panelShadow.getElementById('gr-theme'),
                intent: panelShadow.getElementById('gr-intent')
            };

            panelElements.close.addEventListener('click', () => { hidePanel(); });

            function applyTheme(theme) {
                currentTheme = theme;
                panelElements.card.setAttribute('data-theme', theme);
                panelElements.theme.textContent = theme === 'light' ? 'Light' : 'Dark';
                try { localStorage.setItem('genreach_theme', theme); } catch (_) {}
            }

            try {
                const stored = localStorage.getItem('genreach_theme');
                if (stored === 'dark' || stored === 'light') applyTheme(stored); else applyTheme('light');
            } catch (_) { applyTheme('light'); }

            panelElements.theme.addEventListener('click', () => { applyTheme(currentTheme === 'light' ? 'dark' : 'light'); });

            try {
                chrome.storage.local.get(['GENREACH_INTENT'], (res) => {
                    if (panelElements.intent && typeof res.GENREACH_INTENT === 'string') {
                        panelElements.intent.value = res.GENREACH_INTENT;
                    }
                });
            } catch (_) {}

            panelElements.generate.addEventListener('click', async () => {
                if (isProcessing) return;
                try {
                    isProcessing = true;
                    panelElements.status.textContent = 'Generating...';
                    panelElements.status.className = 'status';
                    const { profileInfo, extendedProfile } = await composeMessageData();
                    const intent = panelElements.intent && panelElements.intent.value ? panelElements.intent.value.trim() : '';
                    try { chrome.storage.local.set({ GENREACH_INTENT: intent }, () => {}); } catch (_) {}
                    const ai = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'generate_ai_message', payload: { profileInfo, extendedProfile, intent } }, (res) => {
                            if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
                            resolve(res || { ok: false, error: 'No response from background' });
                        });
                    });
                    if (!ai.ok) {
                        panelElements.status.textContent = `Backend failed: ${ai.error || 'Unknown error'}`;
                        panelElements.status.className = 'status warn';
                        return;
                    }
                    const finalMessage = ai.content;
                    const openResult = await ensureMessageUIOpenSafe();
                    if (!openResult.ok) {
                        panelElements.status.textContent = ai.ok ? 'Message generated' : (ai.error ? `Backend failed: ${ai.error}` : 'Message generated');
                        panelElements.status.className = 'status warn';
                        return;
                    }
                    const success = injectMessageSafe(finalMessage, openResult.container);
                    if (!success) {
                        panelElements.status.textContent = 'Message input not found';
                        panelElements.status.className = 'status warn';
                        return;
                    }
                    panelElements.status.textContent = `Inserted message for ${profileInfo.name || 'profile'}`;
                    panelElements.status.className = 'status ok';
                } finally {
                    setTimeout(() => { isProcessing = false; }, 800);
                }
            });
        };

        if (panelUrl) {
            try {
                fetch(panelUrl).then(r => r.text()).then(initializeFromHtml).catch(() => {});
            } catch (_) {}
        }

        return panelHost;
    }

    function showPanel() {
        if (!panelHost) createPanel();
        panelHost.style.display = 'block';
    }

    function hidePanel() {
        if (panelHost) panelHost.style.display = 'none';
    }

    function togglePanel() {
        if (!panelHost || panelHost.style.display === 'none' || panelHost.style.display === '') {
            showPanel();
        } else {
            hidePanel();
        }
    }

    function initPanelIfOnProfile() {
        if (isLinkedInProfile()) {
            createPanel();
            showPanel();
        } else {
            hidePanel();
        }
    }

    // Detect LinkedIn SPA navigation changes
    const pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(this, arguments);
        try { initPanelIfOnProfile(); } catch (_) {}
    };
    const replaceState = history.replaceState;
    history.replaceState = function() {
        replaceState.apply(this, arguments);
        try { initPanelIfOnProfile(); } catch (_) {}
    };
    window.addEventListener('popstate', () => {
        try { initPanelIfOnProfile(); } catch (_) {}
    });
    // Run as soon as possible and also on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { try { initPanelIfOnProfile(); } catch (_) {} });
    } else {
        try { initPanelIfOnProfile(); } catch (_) {}
    }
    window.addEventListener('load', () => {
        try { initPanelIfOnProfile(); } catch (_) {}
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) initPanelIfOnProfile();
    });
    // Fallback URL watcher for navigation methods we didn't intercept
    let __gr_lastHref = location.href;
    setInterval(() => {
        if (location.href !== __gr_lastHref) {
            __gr_lastHref = location.href;
            try { initPanelIfOnProfile(); } catch (_) {}
        }
    }, 1000);
    // Initial attempt (quick + delayed retries)
    setTimeout(() => { try { initPanelIfOnProfile(); } catch (_) {} }, 50);
    setTimeout(() => { try { initPanelIfOnProfile(); } catch (_) {} }, 800);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'genreach_toggle_panel') {
            togglePanel();
            sendResponse({ ok: true });
            return;
        }
        if (request.action === 'ping') {
            sendResponse({ ok: true });
            return; // synchronous response
        }
        if (request.action === 'generateMessage') {
            if (isProcessing) {
                sendResponse({ success: false, error: 'Already processing a message request' });
                return;
            }

            (async () => {
                isProcessing = true;
                try {
                    if (!isLinkedInProfile()) {
                        sendResponse({ success: false, error: 'Not on a LinkedIn profile page' });
                        return;
                    }
                    const { profileInfo, extendedProfile } = await composeMessageData();
                    const intent = (request && typeof request.intent === 'string') ? request.intent : '';
                    // Ask background to generate AI message
                    const ai = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'generate_ai_message', payload: { profileInfo, extendedProfile, intent } }, (res) => {
                            if (chrome.runtime.lastError) {
                                resolve({ ok: false, error: chrome.runtime.lastError.message });
                                return;
                            }
                            resolve(res || { ok: false, error: 'No response from background' });
                        });
                    });
                    if (!ai.ok) {
                        sendResponse({ success: false, error: ai.error || 'Backend failed', profileInfo, extendedProfile });
                        return;
                    }
                    const message = ai.content;                    const openResult = await ensureMessageUIOpenSafe();
                    if (!openResult.ok) {
                        sendResponse({ success: false, error: openResult.error || 'Message generated', profileInfo, extendedProfile });
                        return;
                    }
                    const success = injectMessageSafe(message, openResult.container);
                    if (!success) {
                        sendResponse({ success: false, error: 'Could not find the message input after opening dialog', profileInfo });
                        return;
                    }

                    sendResponse({ success: true, message, profileInfo, extendedProfile });
                } finally {
                    setTimeout(() => {
                        isProcessing = false;
                    }, 2000);
                }
            })();

            return true;
        }
    });
    
})();
