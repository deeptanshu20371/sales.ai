(function() {
	'use strict';
	const NS = (window.GENREACH = window.GENREACH || {});
	const scrape = (NS.scrape = NS.scrape || {});

	scrape.getTextContent = function getTextContent(element) {
		if (!element) return '';
		return (element.textContent || '').replace(/\s+/g, ' ').trim();
	};

	function collapseDuplicateHalves(text) {
		if (!text) return text;
		const trimmed = text.trim();
		if (trimmed.length < 6) return trimmed;
		if (trimmed.length % 2 === 0) {
			const half = trimmed.length / 2;
			const a = trimmed.slice(0, half);
			const b = trimmed.slice(half);
			if (a === b) return a.trim();
		}
		return trimmed;
	}

	function collapseConsecutiveDuplicates(text) {
		if (!text) return text;
		let prev;
		let current = text;
		for (let i = 0; i < 5; i++) {
			prev = current;
			current = current.replace(/\b([A-Za-z0-9&.,'’\-]+)\s+\1\b/gi, '$1');
			current = current.replace(/\b([A-Za-z][A-Za-z'’\-]{2,})\1\b/g, '$1');
			current = current.replace(/(\s*[·•|]\s*)\1+/g, '$1');
			if (current === prev) break;
		}
		return current.trim();
	}

	function normalizeDateConnectors(text) {
		if (!text) return text;
		return text.replace(/\bto\b/gi, '-');
	}

	scrape.sanitizeText = function sanitizeText(text) {
		let s = (text || '').replace(/\s+/g, ' ').trim();
		s = normalizeDateConnectors(s);
		s = collapseDuplicateHalves(s);
		s = collapseConsecutiveDuplicates(s);
		s = collapseDuplicateHalves(s);
		return s;
	};

	scrape.findSectionByIdOrHeading = function findSectionByIdOrHeading(idCandidate, headingText) {
		const byId = document.querySelector(`section[id*="${idCandidate}"]`);
		if (byId) return byId;
		const sections = Array.from(document.querySelectorAll('section'));
		const lower = (headingText || '').toLowerCase();
		const match = sections.find(sec => {
			const h = sec.querySelector('h2, h3, header h2, header h3');
			const t = scrape.getTextContent(h).toLowerCase();
			return t.includes(lower);
		});
		return match || null;
	};

	scrape.extractAbout = function extractAbout() {
		const section = scrape.findSectionByIdOrHeading('about', 'About');
		if (!section) return '';
		const candidates = [
			'.pv-shared-text-with-see-more',
			'.inline-show-more-text',
			'.display-flex.full-width',
			'blockquote',
			'p'
		];
		for (const sel of candidates) {
			const el = section.querySelector(sel);
			const text = scrape.sanitizeText(scrape.getTextContent(el));
			if (text) return text;
		}
		return scrape.sanitizeText(scrape.getTextContent(section));
	};

	scrape.extractExperienceItems = function extractExperienceItems() {
		const section = scrape.findSectionByIdOrHeading('experience', 'Experience');
		if (!section) return [];
		const items = Array.from(section.querySelectorAll('li.pvs-list__item, li.artdeco-list__item, li[role="listitem"]'));
		return items.map(li => {
			const title = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-bold span[aria-hidden="true"], .t-bold, .mr1.t-bold span[aria-hidden="true"]')));
			const org = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-normal span[aria-hidden="true"], .t-14.t-normal, .pv-entity__secondary-title, .t-14.t-black--light')));
			const dateRange = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], .t-12.t-black--light, .pv-entity__date-range span:nth-child(2)')));
			const location = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.pv-entity__location span:nth-child(2), .t-14.t-normal.t-black--light:nth-of-type(2) span[aria-hidden="true"], .t-14.t-black--light:nth-of-type(2)')));
			const description = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.pvs-list__outer-container .inline-show-more-text, .pv-entity__description, .pv-shared-text-with-see-more')));
			const company = org;
			return { title, company, dateRange, location, description };
		}).filter(item => item.title || item.company || item.description);
	};

	scrape.extractEducationItems = function extractEducationItems() {
		const section = scrape.findSectionByIdOrHeading('education', 'Education');
		if (!section) return [];
		const items = Array.from(section.querySelectorAll('li.pvs-list__item, li.artdeco-list__item, li[role="listitem"]'));
		return items.map(li => {
			const school = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-bold span[aria-hidden="true"], .t-bold, .mr1.t-bold span[aria-hidden="true"], .pv-entity__school-name')));
			const degree = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-normal span[aria-hidden="true"], .pv-entity__secondary-title, .pv-entity__degree-name span:nth-child(2)')));
			const fieldOfStudy = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.pv-entity__fos span:nth-child(2)')));
			const dateRange = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], .pv-entity__dates time')));
			return { school, degree, fieldOfStudy, dateRange };
		}).filter(item => item.school || item.degree || item.fieldOfStudy);
	};

	scrape.extractAwards = function extractAwards() {
		const section = scrape.findSectionByIdOrHeading('honors', 'Honors'), section2 = scrape.findSectionByIdOrHeading('awards', 'Awards');
		const target = section2 || section;
		if (!target) return [];
		const items = Array.from(target.querySelectorAll('li.pvs-list__item, li.artdeco-list__item, li[role="listitem"]'));
		return items.map(li => {
			const name = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-bold span[aria-hidden="true"], .t-bold')));
			const issuer = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-normal span[aria-hidden="true"], .t-14.t-normal')));
			const date = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], time')));
			const description = scrape.sanitizeText(scrape.getTextContent(li.querySelector('.inline-show-more-text, .pv-shared-text-with-see-more')));
			return { name, issuer, date, description };
		}).filter(item => item.name || item.description);
	};

	scrape.extractRecentPosts = function extractRecentPosts(maxPosts = 5) {
		const candidates = [
			scrape.findSectionByIdOrHeading('recent-activity', 'Activity'),
			scrape.findSectionByIdOrHeading('activity', 'Activity')
		].filter(Boolean);
		const section = candidates[0] || null;
		if (!section) return [];
		const cards = Array.from(section.querySelectorAll('li, article, div.feed-shared-update-v2'));
		const posts = [];
		for (const card of cards) {
			let text = scrape.sanitizeText(scrape.getTextContent(card.querySelector('.update-components-text, .feed-shared-update-v2__description-wrapper, .feed-shared-text, p, span[dir="ltr"]')));
			if (text && text.length > 400) text = text.slice(0, 400) + '…';
			if (text) posts.push({ text });
			if (posts.length >= maxPosts) break;
		}
		return posts;
	};

	scrape.getProfileInfo = function getProfileInfo() {
		const nameSelectors = [
			'h1.text-heading-xlarge',
			'h1[data-test-id="profile-name"]',
			'.pv-text-details__left-panel h1',
			'.pv-top-card--list h1',
			'.pv-top-card h1',
			'h1'
		];
		let name = '';
		for (const selector of nameSelectors) {
			const element = document.querySelector(selector);
			if (element && element.textContent.trim()) { name = element.textContent.trim(); break; }
		}
		const titleSelectors = [
			'.text-body-medium.break-words',
			'.pv-text-details__left-panel .text-body-medium',
			'.pv-top-card--list .text-body-medium',
			'.pv-top-card .text-body-medium',
			'[data-test-id="profile-headline"]',
			'.pv-entity__secondary-title'
		];
		let title = '';
		for (const selector of titleSelectors) {
			const element = document.querySelector(selector);
			if (element && element.textContent.trim()) { title = element.textContent.trim(); break; }
		}
		const companySelectors = [
			'.pv-text-details__left-panel .text-body-medium',
			'.pv-entity__secondary-title',
			'.pv-top-card--list .text-body-medium',
			'.pv-top-card .text-body-medium',
			'[data-test-id="current-position"]',
			'.pv-entity__company-name'
		];
		let company = '';
		for (const selector of companySelectors) {
			const element = document.querySelector(selector);
			if (element && element.textContent.trim()) { company = element.textContent.trim(); break; }
		}
		return { name, title, company };
	};

	scrape.getExtendedProfile = function getExtendedProfile() {
		return {
			about: scrape.extractAbout(),
			experiences: scrape.extractExperienceItems(),
			education: scrape.extractEducationItems(),
			awards: scrape.extractAwards(),
			recentPosts: scrape.extractRecentPosts()
		};
	};
})();