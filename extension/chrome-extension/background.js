(function() {
    try { importScripts('config.js'); } catch (e) {}
    const STATIC_BACKEND_URL = (self && self.GENREACH_CONFIG && self.GENREACH_CONFIG.BACKEND_URL) ? String(self.GENREACH_CONFIG.BACKEND_URL).trim() : '';
    const OPENROUTER_API_KEY = (self && self.GENREACH_CONFIG && self.GENREACH_CONFIG.OPENROUTER_API_KEY) ? String(self.GENREACH_CONFIG.OPENROUTER_API_KEY).trim() : '';
    const OPENROUTER_MODEL = (self && self.GENREACH_CONFIG && self.GENREACH_CONFIG.MODEL) ? String(self.GENREACH_CONFIG.MODEL).trim() : 'meta-llama/llama-3.3-8b-instruct:free';
	chrome.action.onClicked.addListener(async (tab) => {
		if (!tab || !tab.id) return;
		try {
			await chrome.tabs.sendMessage(tab.id, { action: 'genreach_toggle_panel' });
		} catch (e) {
			if (chrome.runtime.lastError) {
				try {
					await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
					await chrome.tabs.sendMessage(tab.id, { action: 'genreach_toggle_panel' });
				} catch (_) {}
			}
		}
	});

	async function getBackendUrl() {
		if (STATIC_BACKEND_URL) return STATIC_BACKEND_URL;
		// Legacy fallback to storage if config not set
		return new Promise((resolve) => {
			chrome.storage.local.get(['BACKEND_URL'], (res) => {
				const url = res && typeof res.BACKEND_URL === 'string' ? res.BACKEND_URL.trim() : '';
				resolve(url);
			});
		});
	}

    async function generateAiMessageViaBackend(payload) {
        const backendUrl = await getBackendUrl();
        if (!backendUrl) {
            return { ok: false, error: 'Backend URL not set. Configure it in config.js.' };
        }
        try {
            const resp = await fetch(`${backendUrl.replace(/\/$/, '')}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {})
            });
			if (!resp.ok) {
				const text = await resp.text();
				return { ok: false, error: `Backend error ${resp.status}: ${text.slice(0, 200)}` };
			}
			const data = await resp.json();
			if (!data || typeof data.message !== 'string') {
				return { ok: false, error: 'Malformed backend response' };
			}
			return { ok: true, content: data.message };
		} catch (err) {
			return { ok: false, error: err && err.message ? err.message : 'Network error calling backend' };
        }
    }

    function buildSystemPrompt() {
        return (
            'Write one LinkedIn outreach message (180–300 characters), friendly and specific.' +
            ' Use ONLY provided data; do not assume facts about sender or recipient.' +
            ' Prioritize the most impressive/relevant achievement or experience (from experiences, awards, or recent posts).' +
            ' If numbers or measurable outcomes are present, include one.' +
            ' Avoid salesy language, emojis, hashtags, bullet points, or placeholders.' +
            ' If a first name is present, use it; otherwise omit.' +
            ' End with a low‑friction question that proposes a concrete next step (e.g., a quick 10–15 min chat next week, or permission to share a 2‑line idea).' +
            ' Do NOT ask open‑ended questions that put the burden on them (e.g., "What would you like to discuss?" or "What works for you?").' +
            ' Output plain text only (no surrounding quotes or code blocks).'
        );
    }

    function buildUserContent(intent, profileInfo, extendedProfile) {
        const payload = {
            instruction: (
                'Generate one friendly, personalized LinkedIn message (180–300 chars). Use ONLY facts below; if unknown, omit.' +
                ' Highlight the most impressive/relevant achievement or experience (or recent post) and weave one concrete detail.' +
                ' Prefer measurable outcomes if present. If the intent provides a specific CTA, use it; otherwise propose a concrete, low‑friction next step (e.g., 10–15 min chat next week or permission to send a 2‑line idea).' +
                " Avoid open‑ended questions like 'What would you like to discuss?'. Do not wrap the message in quotes."
            ),
            intent: intent || 'Polite intro with value and a soft ask to connect',
            profile: {
                profileInfo: profileInfo || {},
                extendedProfile: extendedProfile || {},
            },
        };
        return 'Please generate a concise, friendly, highly personalized LinkedIn message based on the following JSON.\n' + JSON.stringify(payload);
    }

    async function generateAiMessageViaOpenRouter(payload) {
        if (!OPENROUTER_API_KEY) {
            return { ok: false, error: 'OpenRouter key not set' };
        }
        const { intent, profileInfo, extendedProfile } = payload || {};
        const system = buildSystemPrompt();
        const user = buildUserContent(intent, profileInfo || {}, extendedProfile || {});
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://salesai-extension',
                    'X-Title': 'Sales.ai Extension'
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user }
                    ],
                    max_tokens: 320,
                    temperature: 0.85
                })
            });
            if (!resp.ok) {
                const text = await resp.text();
                return { ok: false, error: `OpenRouter error ${resp.status}: ${text.slice(0,200)}` };
            }
            const data = await resp.json();
            const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            const content = typeof c === 'string' ? c.trim() : '';
            if (!content) return { ok: false, error: 'No content returned from model' };
            return { ok: true, content };
        } catch (e) {
            return { ok: false, error: e && e.message ? e.message : 'Network error calling OpenRouter' };
        }
    }

    function fabricateMessage(payload) {
        const name = (payload && payload.profileInfo && payload.profileInfo.name) || '';
        const firstName = name.split(' ')[0] || '';
        const intent = (payload && payload.intent) || 'connect briefly next week';
        const company = (payload && payload.profileInfo && payload.profileInfo.company) || '';
        const role = (payload && payload.profileInfo && payload.profileInfo.title) || '';
        const who = firstName ? firstName : 'there';
        const detail = role && company ? `${role} at ${company}` : (role || company);
        const hook = detail ? ` Noticed your ${detail}.` : '';
        return `Hi ${who}, I’m impressed by your work.${hook} I think there’s a quick, practical way we can help with your goals. Would you be open to a 10–15 min chat next week to explore?`;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.action === 'generate_ai_message') {
            (async () => {
                const payload = request.payload || {};
                let result = await generateAiMessageViaBackend(payload);
                if (!result.ok) {
                    result = await generateAiMessageViaOpenRouter(payload);
                }
                if (!result.ok) {
                    const content = fabricateMessage(payload);
                    result = { ok: true, content, fallback: 'local' };
                }
                sendResponse(result);
            })();
            return true;
        }
    });
})();
