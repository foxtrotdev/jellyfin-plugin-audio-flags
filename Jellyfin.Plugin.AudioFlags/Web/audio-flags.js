(function () {
    'use strict';

    if (window.__audioFlagsLoaded) return;
    window.__audioFlagsLoaded = true;

    const CFG = {
        showAudio: true,
        showSubtitles: true,
        englishUsesGB: true,
        debug: false,
    };

    const STYLE_ID = 'audio-flags-style';
    const CACHE = new Map();
    const PENDING = new Map();
    const QUEUE = new Set();
    let flushTimer = null;
    const BATCH = 40;
    const FLUSH_MS = 90;

    function log(...a) { if (CFG.debug) try { console.debug('[AudioFlags]', ...a); } catch (_) { } }

    const LANG_TO_CC = {
        eng: 'GB', en: 'GB',
        ger: 'DE', deu: 'DE', de: 'DE',
        fre: 'FR', fra: 'FR', fr: 'FR',
        spa: 'ES', es: 'ES',
        ita: 'IT', it: 'IT',
        por: 'PT', pt: 'PT',
        dut: 'NL', nld: 'NL', nl: 'NL',
        swe: 'SE', sv: 'SE',
        nor: 'NO', nob: 'NO', nno: 'NO', no: 'NO',
        dan: 'DK', da: 'DK',
        fin: 'FI', fi: 'FI',
        ice: 'IS', isl: 'IS', is: 'IS',
        gre: 'GR', ell: 'GR', el: 'GR',
        pol: 'PL', pl: 'PL',
        cze: 'CZ', ces: 'CZ', cs: 'CZ',
        slo: 'SK', slk: 'SK', sk: 'SK',
        slv: 'SI', sl: 'SI',
        hun: 'HU', hu: 'HU',
        rum: 'RO', ron: 'RO', ro: 'RO',
        bul: 'BG', bg: 'BG',
        rus: 'RU', ru: 'RU',
        ukr: 'UA', uk: 'UA',
        bel: 'BY', be: 'BY',
        srp: 'RS', sr: 'RS', scc: 'RS',
        hrv: 'HR', hr: 'HR', scr: 'HR',
        bos: 'BA', bs: 'BA',
        mac: 'MK', mkd: 'MK', mk: 'MK',
        alb: 'AL', sqi: 'AL', sq: 'AL',
        lav: 'LV', lv: 'LV',
        lit: 'LT', lt: 'LT',
        est: 'EE', et: 'EE',
        jpn: 'JP', ja: 'JP',
        kor: 'KR', ko: 'KR',
        chi: 'CN', zho: 'CN', zh: 'CN',
        tha: 'TH', th: 'TH',
        vie: 'VN', vi: 'VN',
        ind: 'ID', id: 'ID',
        may: 'MY', msa: 'MY', ms: 'MY',
        tgl: 'PH', fil: 'PH', tl: 'PH',
        hin: 'IN', hi: 'IN',
        tam: 'IN', ta: 'IN',
        tel: 'IN', te: 'IN',
        ben: 'BD', bn: 'BD',
        urd: 'PK', ur: 'PK',
        ara: 'SA', ar: 'SA',
        heb: 'IL', he: 'IL', iw: 'IL',
        tur: 'TR', tr: 'TR',
        per: 'IR', fas: 'IR', fa: 'IR',
        lat: 'VA', la: 'VA',
        und: '', mul: '', zxx: '',
    };

    function normalizeLang(s) {
        if (!s) return '';
        return String(s).toLowerCase().trim();
    }

    function langToFlag(lang) {
        const k = normalizeLang(lang);
        if (!k || k === 'und' || k === 'mul' || k === 'zxx') return '🏳';
        let cc = LANG_TO_CC[k];
        if (k === 'eng' || k === 'en') cc = CFG.englishUsesGB ? 'GB' : 'US';
        if (!cc) return '🏳';
        const A = 0x1F1E6;
        const codepoints = [...cc.toUpperCase()].map(c => A + (c.charCodeAt(0) - 65));
        return String.fromCodePoint(...codepoints);
    }

    function streamsToLangs(streams) {
        const audio = new Set(), sub = new Set();
        if (!Array.isArray(streams)) return { audio, sub };
        for (const s of streams) {
            const l = normalizeLang(s.Language || s.DisplayLanguage);
            if (!l) continue;
            if (s.Type === 'Audio') audio.add(l);
            else if (s.Type === 'Subtitle') sub.add(l);
        }
        return { audio, sub };
    }

    function getApiClient() {
        try {
            if (window.ApiClient) return window.ApiClient;
            if (window.connectionManager && typeof window.connectionManager.currentApiClient === 'function') {
                return window.connectionManager.currentApiClient();
            }
        } catch (_) { }
        return null;
    }

    function getServerUrl() {
        const ac = getApiClient();
        if (ac && typeof ac.serverAddress === 'function') return ac.serverAddress();
        return '';
    }

    function getUserId() {
        const ac = getApiClient();
        try { if (ac && typeof ac.getCurrentUserId === 'function') return ac.getCurrentUserId(); } catch (_) { }
        try {
            const raw = localStorage.getItem('jellyfin_credentials') || '';
            const m = raw.match(/"UserId":"([^"]+)"/);
            if (m) return m[1];
        } catch (_) { }
        return '';
    }

    function getAccessToken() {
        try {
            const ac = getApiClient();
            if (ac && typeof ac.accessToken === 'function') {
                const t = ac.accessToken();
                if (t) return t;
            }
        } catch (_) { }
        try {
            const raw = localStorage.getItem('jellyfin_credentials') || '';
            const m = raw.match(/"AccessToken":"([^"]+)"/);
            if (m) return m[1];
        } catch (_) { }
        return '';
    }

    function getHeaders() {
        const h = { 'Accept': 'application/json' };
        try {
            const ac = getApiClient();
            if (ac && typeof ac.getRequestHeaders === 'function') Object.assign(h, ac.getRequestHeaders());
        } catch (_) { }
        const tok = getAccessToken();
        if (tok && !h['X-Emby-Token'] && !h['Authorization']) {
            h['X-Emby-Token'] = tok;
        }
        return h;
    }

    function enqueue(id) {
        if (CACHE.has(id) || PENDING.has(id)) return PENDING.get(id) || Promise.resolve(CACHE.get(id));
        let resolveFn;
        const p = new Promise(r => { resolveFn = r; });
        p.__resolve = resolveFn;
        PENDING.set(id, p);
        QUEUE.add(id);
        scheduleFlush();
        return p;
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(flush, FLUSH_MS);
    }

    async function flush() {
        flushTimer = null;
        if (QUEUE.size === 0) return;
        const ids = [...QUEUE].slice(0, BATCH);
        ids.forEach(i => QUEUE.delete(i));

        const userId = getUserId();
        const base = getServerUrl();
        const url = `${base}/Users/${userId}/Items?Ids=${ids.join(',')}&Fields=MediaStreams,MediaSources&EnableImages=false&Limit=${ids.length}`;
        try {
            const res = await fetch(url, { headers: getHeaders() });
            if (!res.ok) throw new Error('items ' + res.status);
            const data = await res.json();
            const map = new Map();
            for (const it of (data.Items || [])) {
                let streams = it.MediaStreams;
                if ((!streams || !streams.length) && Array.isArray(it.MediaSources)) {
                    streams = [];
                    for (const ms of it.MediaSources) if (Array.isArray(ms.MediaStreams)) streams.push(...ms.MediaStreams);
                }
                map.set(it.Id, streamsToLangs(streams));
            }
            for (const id of ids) {
                const v = map.get(id) || { audio: new Set(), sub: new Set() };
                CACHE.set(id, v);
                const p = PENDING.get(id);
                if (p) { p.__resolve(v); PENDING.delete(id); }
            }
        } catch (e) {
            log('flush err', e);
            for (const id of ids) {
                const empty = { audio: new Set(), sub: new Set() };
                CACHE.set(id, empty);
                const p = PENDING.get(id);
                if (p) { p.__resolve(empty); PENDING.delete(id); }
            }
        }

        if (QUEUE.size > 0) scheduleFlush();
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
        .audioFlags{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:3px;line-height:1.15;pointer-events:none}
        .audioFlags .afRow{display:inline-flex;gap:4px;align-items:center;max-width:100%}
        .audioFlags .afIcon{font-size:.95em;opacity:.85}
        .audioFlags .afFlag{font-size:1em}
        `;
        document.head.appendChild(s);
    }

    function findInsertAnchor(card) {
        return card.querySelector('.cardText-secondary')
            || card.querySelector('.cardText:nth-of-type(2)')
            || card.querySelector('.cardText')
            || card.querySelector('.cardFooter')
            || card;
    }

    function makeFlagRow(kind, langs) {
        if (!langs.length) return null;
        const row = document.createElement('span');
        row.className = 'afRow ' + (kind === 'audio' ? 'afAudio' : 'afSubs');
        const label = kind === 'audio' ? 'Audio' : 'Subtitles';
        row.title = label + ': ' + langs.join(', ');

        const icon = document.createElement('span');
        icon.className = 'afIcon';
        icon.textContent = kind === 'audio' ? '🎧' : '💬';
        row.appendChild(icon);

        for (const l of langs) {
            const f = document.createElement('span');
            f.className = 'afFlag';
            f.textContent = langToFlag(l);
            row.appendChild(f);
        }
        return row;
    }

    function renderFlags(card, data) {
        if (card.querySelector('.audioFlags')) return;
        const rows = [];
        if (CFG.showAudio) {
            const r1 = makeFlagRow('audio', [...data.audio].sort());
            if (r1) rows.push(r1);
        }
        if (CFG.showSubtitles) {
            const r2 = makeFlagRow('subs', [...data.sub].sort());
            if (r2) rows.push(r2);
        }
        if (rows.length === 0) return;

        const wrap = document.createElement('div');
        wrap.className = 'audioFlags';
        for (const r of rows) wrap.appendChild(r);

        const anchor = findInsertAnchor(card);
        anchor.parentNode ? anchor.parentNode.insertBefore(wrap, anchor.nextSibling) : anchor.appendChild(wrap);
    }

    function getCardId(card) {
        if (card.dataset && card.dataset.id) return card.dataset.id;
        const a = card.querySelector('[data-id]');
        return a ? a.dataset.id : '';
    }

    function isItemType(card) {
        const t = (card.dataset && card.dataset.type) || '';
        if (!t) return true;
        return /Movie|Episode|Video/i.test(t);
    }

    async function processCard(card) {
        if (card.__audioFlagsDone) return;
        card.__audioFlagsDone = true;
        if (!isItemType(card)) return;
        const id = getCardId(card);
        if (!id) return;
        const data = CACHE.get(id) || await enqueue(id);
        if (!data) return;
        renderFlags(card, data);
    }

    function scanRoot(root) {
        const list = root.querySelectorAll
            ? root.querySelectorAll('.card[data-id], .listItem[data-id]')
            : [];
        list.forEach(processCard);
    }

    function startObserver() {
        const mo = new MutationObserver(muts => {
            for (const m of muts) {
                for (const n of m.addedNodes) {
                    if (n.nodeType !== 1) continue;
                    if (n.matches && n.matches('.card[data-id], .listItem[data-id]')) processCard(n);
                    else scanRoot(n);
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    async function fetchClientConfig() {
        try {
            const r = await fetch('/AudioFlags/Config', { headers: getHeaders() });
            if (r.ok) Object.assign(CFG, await r.json());
        } catch (e) { log('config fetch err', e); }
    }

    async function boot() {
        await fetchClientConfig();
        injectStyle();
        scanRoot(document.body);
        startObserver();
        log('booted', CFG);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
