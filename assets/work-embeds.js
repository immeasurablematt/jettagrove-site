// Work section embeds: click-to-load X posts, YouTube, and PDFs in one shared dialog.
// Nothing third-party loads until a visitor clicks. Built from workshop/embeds (shell, youtube, x, pdfview).

// Work embeds: one shared <dialog class="w-embed">, created on first use.
// Providers register on WorkEmbeds.providers (see CONTRACT.md); links keep working without JS.
(() => {
    const W = window.WorkEmbeds = window.WorkEmbeds || { providers: {} };
    W.providers = W.providers || {};
    const TIMEOUT = 10000;
    let dlg, titleEl, origLink, closeBtn, cur = null, openedAt = 0;

    const run = fn => { if (typeof fn === 'function') { try { fn(); } catch (err) { console.warn('[embeds] cleanup failed', err); } } };
    const newHost = () => Object.assign(document.createElement('div'), { className: 'w-embed-host' });

    function build() {
        dlg = document.createElement('dialog');
        dlg.className = 'w-embed';
        dlg.setAttribute('aria-labelledby', 'w-embed-title');
        dlg.innerHTML =
            '<div class="w-embed-bar">' +
                '<h2 class="w-embed-title" id="w-embed-title"></h2>' +
                '<a class="w-embed-orig" target="_blank" rel="noopener">Open original <span aria-hidden="true">&#8599;</span></a>' +
                '<button class="w-embed-close" type="button" aria-label="Close">&times;</button>' +
            '</div>';
        titleEl = dlg.querySelector('.w-embed-title');
        origLink = dlg.querySelector('.w-embed-orig');
        closeBtn = dlg.querySelector('.w-embed-close');
        closeBtn.addEventListener('click', () => dlg.close());
        dlg.addEventListener('close', () => { if (!dlg.open) teardown(); }); // Escape, ×, backdrop

        // Backdrop closes only if the press AND the release both land outside the panel,
        // so a text-selection drag that ends on the backdrop doesn't close it.
        let downOutside = false;
        const outside = e => {
            if (e.target !== dlg) return false;
            const r = dlg.getBoundingClientRect();
            return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        };
        dlg.addEventListener('pointerdown', e => { downOutside = outside(e); });
        // Ignore backdrop clicks right after opening: the second click of a double-click lands there.
        dlg.addEventListener('click', e => {
            if (downOutside && outside(e) && performance.now() - openedAt > 400) dlg.close();
            downOutside = false;
        });
        document.body.appendChild(dlg);
    }

    // Lock page scroll without a layout jump: pad by the scrollbar's width while it's hidden.
    // --w-embed-sbw is also available to fixed bars that want to hold still.
    function lock(on) {
        const root = document.documentElement;
        if (on) {
            const sbw = window.innerWidth - root.clientWidth;
            if (sbw > 0) root.style.setProperty('--w-embed-sbw', sbw + 'px');
            root.classList.add('w-embed-lock');
        } else {
            root.classList.remove('w-embed-lock');
            root.style.removeProperty('--w-embed-sbw');
        }
    }

    function fail(c, err) {
        if (cur !== c || c.failed) return;
        console.warn('[embeds] could not load', c.trigger.href, err);
        c.failed = true;
        clearTimeout(c.timer);
        const h = newHost(); // fresh host: late writes from the provider land in the detached one
        h.innerHTML = '<div class="w-embed-fail"><p>Couldn&rsquo;t load this here.</p>' +
            '<a target="_blank" rel="noopener">Open original <span aria-hidden="true">&#8599;</span></a></div>';
        h.querySelector('a').href = c.trigger.href;
        c.host.replaceWith(h);
        c.host = h;
    }

    function open(a, p) {
        if (!dlg) build();
        if (dlg.open) { teardown(); dlg.close(); }
        const title = a.dataset.embedTitle || a.getAttribute('aria-label') ||
            (a.querySelector('.w-t, .w-title') || a).textContent.replace(/\s+/g, ' ').trim() || 'Embed';
        const c = cur = { trigger: a, host: newHost() };
        titleEl.textContent = title;
        origLink.href = a.href;
        dlg.dataset.size = p.size || 'post';
        dlg.appendChild(c.host);
        lock(true);
        dlg.showModal();
        openedAt = performance.now();
        closeBtn.focus();

        const ctx = {
            id: a.dataset.embedId || '', href: a.href, title, trigger: a,
            theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
        };
        let out;
        try { out = p.mount(c.host, ctx); } catch (err) { return fail(c, err); }
        if (!out || typeof out.then !== 'function') { c.cleanup = out; return; }
        c.timer = setTimeout(() => fail(c, new Error('timed out')), TIMEOUT);
        out.then(fn => {
            if (cur !== c || c.failed) return run(fn); // closed or gave up already: release it now
            clearTimeout(c.timer);
            c.cleanup = fn;
        }, err => fail(c, err));
    }

    function teardown() {
        const c = cur;
        cur = null;
        if (!c) return;
        clearTimeout(c.timer);
        run(c.cleanup);
        c.host.remove(); // removing iframes stops playback and frees memory
        lock(false);
        if (c.trigger.isConnected) c.trigger.focus({ preventScroll: true });
    }

    // Plain left-clicks on [data-embed] open in place; modified/middle clicks and
    // links without a loaded provider fall through to normal navigation.
    document.addEventListener('click', e => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target instanceof Element && e.target.closest('a[data-embed]');
        const p = a && W.providers[a.dataset.embed];
        if (!p || typeof p.mount !== 'function' || typeof HTMLDialogElement !== 'function') return;
        e.preventDefault();
        open(a, p);
    });

    W.open = a => { const p = W.providers[a.dataset.embed]; if (p) open(a, p); };
    W.close = () => { if (dlg && dlg.open) dlg.close(); };
})();

// Work embeds provider: YouTube (privacy-enhanced domain; nothing loads until the click).
(() => {
    const W = window.WorkEmbeds = window.WorkEmbeds || { providers: {} };
    W.providers = W.providers || {};

    W.providers.youtube = {
        size: 'video',
        mount(host, ctx) {
            const id = ctx.id || (ctx.href.match(/[?&]v=([\w-]{11})/) || [])[1];
            if (!/^[\w-]{11}$/.test(id || '')) throw new Error('no YouTube id');

            const f = document.createElement('iframe');
            f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
            f.title = ctx.title || 'YouTube video';
            f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            f.allowFullscreen = true;
            f.referrerPolicy = 'strict-origin-when-cross-origin'; // YouTube refuses to play without a referrer
            f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
            host.appendChild(f);

            // Resolve once the player document loads, so the shell's 10s fallback covers a blocked embed.
            return new Promise(resolve => {
                f.addEventListener('load', () => resolve(() => { f.src = 'about:blank'; f.remove(); }), { once: true });
            });
        }
    };
})();

// Work embeds provider: X posts. Nothing from X loads until mount() runs (the visitor's click).
//
// Renders X's own embed document (platform.twitter.com/embed/Tweet.html) in a single iframe
// instead of loading widgets.js: same post UI and video player, fewer requests, no X script
// running in this page, and the page URL is not handed to X. The frame reports its state via
// postMessage: {"twttr.embed": {method: "twttr.private.<event>", params: [{height, ...}]}}.
// Only messages whose origin is https://platform.twitter.com AND whose source is our own
// iframe are trusted.
//
// mount() returns its cleanup synchronously, so the shell's fixed timeout never cuts off a
// slow-but-working load (on a 40 KB/s link X takes ~10s). Failures are handled here instead,
// with an "Open on X" link:
//   - X answers no_results (deleted, protected, or withheld post)
//   - the frame loads but X never speaks (blocked by an extension/firewall, offline error page).
//     X always posts "initialized" before the frame's load event fires, so silence at load
//     means it isn't coming.
//   - nothing rendered by a hard deadline (connection hangs)
(() => {
    const W = window.WorkEmbeds = window.WorkEmbeds || { providers: {} };
    W.providers = W.providers || {};

    const ORIGIN = 'https://platform.twitter.com';
    const SILENT_AFTER_LOAD_MS = 2500;
    const DEADLINE_MS = 25000;
    let seq = 0;

    const postId = ctx => {
        const id = ctx.id || ((ctx.href || '').match(/\/status(?:es)?\/(\d+)/) || [])[1];
        return /^\d{1,20}$/.test(id || '') ? id : null;
    };

    function note(text, href) {
        const n = document.createElement('div');
        n.className = 'w-embed-x-note';
        const p = document.createElement('p');
        p.textContent = text;
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = 'Open on X <span aria-hidden="true">&#8599;</span>';
        n.append(p, a);
        return n;
    }

    W.providers.x = {
        size: 'post',
        mount(host, ctx) {
            const id = postId(ctx);
            if (!id) throw new Error('no X post id'); // shell shows its own fallback
            const href = ctx.href || 'https://x.com/i/status/' + id;

            const wrap = document.createElement('div');
            wrap.className = 'w-embed-x';
            wrap.dataset.state = 'loading';
            wrap.setAttribute('aria-busy', 'true');

            const loading = document.createElement('div');
            loading.className = 'w-embed-x-loading';
            loading.innerHTML =
                '<div class="w-embed-x-skel" aria-hidden="true"><i></i><b></b><b></b><b></b></div>' +
                '<p class="w-embed-x-label" role="status">Loading post from X</p>';

            const f = document.createElement('iframe');
            f.className = 'w-embed-x-frame';
            f.title = ctx.title ? 'X post: ' + ctx.title : 'X post';
            f.src = ORIGIN + '/embed/Tweet.html?' + new URLSearchParams({
                id, theme: ctx.theme === 'light' ? 'light' : 'dark',
                dnt: 'true', hideThread: 'false', lang: 'en', embedId: 'w-embed-x-' + (++seq)
            });
            f.setAttribute('scrolling', 'no'); // height tracks the content: the host scrolls, never the frame
            f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
            f.allowFullscreen = true;
            f.referrerPolicy = 'strict-origin-when-cross-origin'; // X sees the site origin, not the page URL

            let alive = true, spoke = false, tSilent, tDeadline;

            const stopFrame = () => { f.src = 'about:blank'; f.remove(); };
            const fail = text => {
                if (!alive || wrap.dataset.state !== 'loading') return;
                clearTimeout(tSilent); clearTimeout(tDeadline);
                wrap.dataset.state = 'error';
                wrap.removeAttribute('aria-busy');
                stopFrame();
                loading.replaceWith(note(text, href));
            };

            function onMessage(e) {
                if (e.origin !== ORIGIN || !e.source || e.source !== f.contentWindow) return;
                let d = e.data;
                if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
                const rpc = d && d['twttr.embed'];
                if (!rpc || typeof rpc.method !== 'string') return;
                const p = (Array.isArray(rpc.params) && rpc.params[0]) || {};
                spoke = true;
                clearTimeout(tSilent);
                switch (rpc.method) {
                    case 'twttr.private.resize': {
                        const h = Number(p.height);
                        if (h > 0 && h < 20000) f.style.height = Math.ceil(h) + 'px';
                        break;
                    }
                    case 'twttr.private.rendered':
                        if (wrap.dataset.state !== 'loading') break;
                        clearTimeout(tDeadline);
                        wrap.dataset.state = 'ready';
                        wrap.removeAttribute('aria-busy');
                        loading.remove();
                        break;
                    case 'twttr.private.no_results':
                        fail('X won’t show this post here. It may have been deleted or made private.');
                        break;
                }
            }

            f.addEventListener('load', () => {
                if (!spoke) tSilent = setTimeout(() => fail('Couldn’t load this post from X.'), SILENT_AFTER_LOAD_MS);
            }, { once: true });
            tDeadline = setTimeout(() => fail('Couldn’t load this post from X.'), DEADLINE_MS);
            addEventListener('message', onMessage);

            wrap.append(loading, f);
            host.appendChild(wrap);

            return function cleanup() {
                if (!alive) return;
                alive = false;
                clearTimeout(tSilent); clearTimeout(tDeadline);
                removeEventListener('message', onMessage);
                stopFrame(); // stops video/audio even if the host lingers
                wrap.remove();
            };
        }
    };
})();

// Work embeds provider: PDF reader (see CONTRACT.md).
// pdf.js is fetched on the first click only. Pages render to canvases in one vertical scroll:
// lazily (IntersectionObserver), fit-to-width, devicePixelRatio-aware, with a "3 / 12" counter.
// Close cancels renders, zeroes canvases and destroys the document + its worker.
(() => {
    const W = window.WorkEmbeds = window.WorkEmbeds || { providers: {} };
    W.providers = W.providers || {};

    // Same pdf.js release from two CDNs. cdnjs only hosts the "modern" build, which calls the newest
    // JS built-ins unpolyfilled (Promise.try, Math.sumPrecise, Map#getOrInsertComputed, URL.parse...).
    // Browsers missing any of them get the legacy build (same code + polyfills) from jsDelivr, which is
    // the build pdf.js's published browser-support floor (Chrome 125 / Safari 18) refers to.
    const VERSION = '6.3.289';
    const BUILDS = {
        modern: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + VERSION + '/',
        legacy: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + VERSION + '/legacy/build/'
    };
    const MAX_DPR = 3;            // sharper than this is invisible and costs memory
    const MAX_PAGE_PX = 12e6;     // per-canvas pixel cap (iOS refuses canvases over ~16.7M px)
    const BUDGET_PX = 40e6;       // total live canvas pixels (~160 MB) before far pages are dropped
    const PORTRAIT_MAX = 880;     // CSS px: comfortable reading width for portrait pages

    const hasModern = () => {
        try {
            return typeof Promise.try === 'function' && typeof Promise.withResolvers === 'function' &&
                typeof Math.sumPrecise === 'function' && typeof Map.prototype.getOrInsertComputed === 'function' &&
                typeof Uint8Array.fromBase64 === 'function' && typeof URL.parse === 'function' &&
                typeof AbortSignal.any === 'function';
        } catch (e) { return false; }
    };

    let libPromise = null;
    function loadLib() {
        if (!libPromise) {
            const pick = provider.build === 'modern' || provider.build === 'legacy' ? provider.build
                : (hasModern() ? 'modern' : 'legacy');
            const base = BUILDS[pick];
            libPromise = import(base + 'pdf.min.mjs').then(lib => {
                lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
                provider.loadedBuild = pick;
                return lib;
            });
            libPromise.catch(() => { libPromise = null; }); // let the next open retry
        }
        return libPromise;
    }

    const CHEVRON = d => '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
        '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function freeCanvas(c) {
        if (!c) return;
        c.width = c.height = 0; // releases the backing store now (matters on iOS)
        c.remove();
    }

    function mount(host, ctx) {
        const href = ctx.href;
        const root = document.createElement('div');
        root.className = 'w-embed-pdf';
        root.innerHTML =
            '<div class="w-embed-pdf-scroll" tabindex="0" role="region"><div class="w-embed-pdf-pages"></div></div>' +
            '<div class="w-embed-pdf-state" role="status">' +
                '<span class="w-embed-pdf-label">Loading PDF</span>' +
                '<span class="w-embed-pdf-bar"><span></span></span>' +
            '</div>' +
            '<div class="w-embed-pdf-nav" hidden>' +
                '<button type="button" class="w-embed-pdf-btn" data-go="-1" aria-label="Previous page">' + CHEVRON('M10 3.5 5.5 8l4.5 4.5') + '</button>' +
                '<span class="w-embed-pdf-count">1 / 1</span>' +
                '<button type="button" class="w-embed-pdf-btn" data-go="1" aria-label="Next page">' + CHEVRON('M6 3.5 10.5 8 6 12.5') + '</button>' +
            '</div>';
        const scroller = root.querySelector('.w-embed-pdf-scroll');
        const list = root.querySelector('.w-embed-pdf-pages');
        const state = root.querySelector('.w-embed-pdf-state');
        const label = root.querySelector('.w-embed-pdf-label');
        const bar = root.querySelector('.w-embed-pdf-bar > span');
        const nav = root.querySelector('.w-embed-pdf-nav');
        const count = root.querySelector('.w-embed-pdf-count');
        scroller.setAttribute('aria-label', (ctx.title || 'PDF') + ', pages');
        host.appendChild(root);

        let dead = false, task = null, doc = null, io = null, ro = null, mq = null;
        let pages = [], cur = 1, lastW = 0, lastH = 0, padPx = 0, busy = 0, rafId = 0, resizeTimer = 0;
        const queue = new Set();
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        provider._live++;

        // ---- states -------------------------------------------------------------------------
        function showFailure(msg) {
            root.classList.add('is-failed');
            state.setAttribute('role', 'alert');
            state.innerHTML = '<p class="w-embed-pdf-msg"></p>' +
                '<a class="w-embed-pdf-open" target="_blank" rel="noopener">Open PDF <span aria-hidden="true">&#8599;</span></a>';
            state.querySelector('p').textContent = msg;
            state.querySelector('a').href = href;
            nav.hidden = true;
        }
        // pdf.js couldn't be fetched (offline CDN, blocker): desktop browsers with a built-in
        // PDF viewer still get an inline reader; phones get the link.
        function showNative() {
            const f = document.createElement('iframe');
            f.className = 'w-embed-pdf-native';
            f.title = ctx.title || 'PDF';
            f.src = href + '#view=FitH';
            scroller.replaceWith(f);
            root.classList.add('is-ready');
        }
        const nativeOK = () => navigator.pdfViewerEnabled === true &&
            matchMedia('(hover: hover) and (pointer: fine)').matches;

        // ---- geometry -----------------------------------------------------------------------
        function pad() { return parseFloat(getComputedStyle(list).paddingLeft) || 0; } // set in pdfview.css
        function fitWidth(aspect) {
            const p = padPx; // refreshed by layout() before any sizing
            let w = scroller.clientWidth - p * 2;
            // landscape (slides): the whole page fits on screen, clear of the counter when there's
            // room for that; portrait: fit width, capped at a reading width
            const ch = scroller.clientHeight, navRoom = ch > 520 ? 64 : p;
            w = aspect >= 1 ? Math.min(w, (ch - p - navRoom) * aspect) : Math.min(w, PORTRAIT_MAX);
            w = Math.max(120, Math.floor(w));
            if ((scroller.clientWidth - p * 2 - w) % 2) w--; // centred on a whole pixel: no blurry half-px offset
            return w;
        }
        function size(pg) {
            pg.w = fitWidth(pg.aspect);
            pg.h = Math.round(pg.w / pg.aspect);
            pg.el.style.width = pg.w + 'px';
            pg.el.style.height = pg.h + 'px';
        }
        function layout(force) {
            const cw = scroller.clientWidth, ch = scroller.clientHeight;
            if (!cw || !pages.length || (!force && cw === lastW && ch === lastH)) return;
            lastW = cw; lastH = ch; padPx = pad();
            const a = pages[cur - 1];
            const rel = (scroller.scrollTop - a.el.offsetTop) / (a.h || 1);
            pages.forEach(size);
            scroller.scrollTop = a.el.offsetTop + rel * a.h; // keep the reader on the same spot
            pages.forEach(pg => {
                if (pg.canvas && (pg.rw !== pg.w || force)) { if (pg.near) queue.add(pg); else release(pg); }
            });
            pump();
            track();
        }

        // ---- current page + navigation ------------------------------------------------------
        function track() {
            rafId = 0;
            if (!pages.length) return;
            const top = scroller.scrollTop;
            let n;
            if (top + scroller.clientHeight >= scroller.scrollHeight - 2) n = pages.length;
            else {
                // A page becomes current once its top passes 40% of the view, or half its own
                // height for short pages (phone-width slides), so "Next" always lands on n + 1.
                const view = scroller.clientHeight * 0.4, p = padPx;
                let lo = 0, hi = pages.length - 1;
                while (lo < hi) {
                    const mid = (lo + hi + 1) >> 1;
                    if (pages[mid].el.offsetTop <= top + p + Math.min(view, pages[mid].h / 2)) lo = mid; else hi = mid - 1;
                }
                n = lo + 1;
            }
            cur = n;
            count.textContent = cur + ' / ' + pages.length;
            nav.querySelector('[data-go="-1"]').disabled = cur <= 1;
            nav.querySelector('[data-go="1"]').disabled = cur >= pages.length;
        }
        const onScroll = () => { if (!rafId) rafId = requestAnimationFrame(track); };
        function go(n) {
            n = Math.max(1, Math.min(pages.length, n));
            const pg = pages[n - 1];
            if (!pg) return;
            scroller.scrollTo({ top: pg.el.offsetTop - padPx, behavior: reduced ? 'auto' : 'smooth' });
        }
        nav.addEventListener('click', e => {
            const b = e.target.closest('[data-go]');
            if (b) go(cur + Number(b.dataset.go));
        });
        root.addEventListener('keydown', e => {
            if (e.altKey || e.ctrlKey || e.metaKey || !pages.length) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
        });

        // ---- rendering ----------------------------------------------------------------------
        function getProxy(pg) {
            if (!pg.proxyP) {
                pg.proxyP = doc.getPage(pg.n).then(p => {
                    pg.proxy = p;
                    const vp = p.getViewport({ scale: 1 });
                    const aspect = vp.width / vp.height;
                    if (Math.abs(aspect - pg.aspect) > 0.005) { // page differs from page 1's size
                        const before = pg.h, above = pg.el.offsetTop < scroller.scrollTop;
                        pg.aspect = aspect;
                        size(pg);
                        if (above) scroller.scrollTop += pg.h - before;
                    }
                    pg.baseW = vp.width;
                    return p;
                });
            }
            return pg.proxyP;
        }
        async function render(pg) {
            const p = await getProxy(pg);
            if (dead || !pg.near) return;
            const cssW = pg.w, cssH = pg.h;
            let out = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            if (cssW * cssH * out * out > MAX_PAGE_PX) out = Math.sqrt(MAX_PAGE_PX / (cssW * cssH));
            const vp = p.getViewport({ scale: (cssW / pg.baseW) * out });
            const c = document.createElement('canvas');
            c.className = 'w-embed-pdf-canvas';
            c.width = Math.round(vp.width);
            c.height = Math.round(vp.height);
            pg.task = p.render({ canvas: c, viewport: vp });
            try {
                await pg.task.promise;
            } catch (err) {
                freeCanvas(c);
                if (err && err.name === 'RenderingCancelledException') return;
                throw err;
            } finally {
                pg.task = null;
            }
            if (dead) { freeCanvas(c); return; }
            freeCanvas(pg.canvas); // swap only when the new pixels are ready: no flash on resize
            pg.el.appendChild(c);
            pg.canvas = c;
            pg.rw = cssW;
            pg.el.classList.add('is-rendered');
            if (!root.classList.contains('is-ready')) root.classList.add('is-ready');
        }
        function release(pg) {
            queue.delete(pg);
            if (pg.task) pg.task.cancel();
            freeCanvas(pg.canvas);
            pg.canvas = null;
            pg.rw = 0;
            pg.el.classList.remove('is-rendered');
            if (pg.proxy) pg.proxy.cleanup();
        }
        function enforceBudget() {
            let total = 0;
            pages.forEach(pg => { if (pg.canvas) total += pg.canvas.width * pg.canvas.height; });
            if (total <= BUDGET_PX) return;
            pages.filter(pg => pg.canvas && !pg.near)
                .sort((a, b) => Math.abs(b.n - cur) - Math.abs(a.n - cur))
                .forEach(pg => {
                    if (total <= BUDGET_PX) return;
                    total -= pg.canvas.width * pg.canvas.height;
                    release(pg);
                });
        }
        function pump() {
            while (!dead && busy < 2 && queue.size) {
                let best = null;
                queue.forEach(pg => { if (!best || Math.abs(pg.n - cur) < Math.abs(best.n - cur)) best = pg; });
                queue.delete(best);
                if (!best.near || (best.canvas && best.rw === best.w)) continue;
                busy++;
                render(best).catch(err => {
                    if (dead) return;
                    console.warn('[embeds] pdf page ' + best.n + ' failed', err);
                    best.el.classList.add('is-broken');
                    if (best.n === 1 && !root.classList.contains('is-ready')) showFailure('Couldn’t display this PDF here.');
                }).then(() => { busy--; enforceBudget(); pump(); });
            }
        }

        // ---- load ---------------------------------------------------------------------------
        let libFailed = false;
        loadLib().catch(err => { libFailed = true; throw err; }).then(lib => {
            if (dead) return null;
            task = lib.getDocument({ url: href, isEvalSupported: false });
            task.onProgress = ({ loaded, total }) => {
                if (dead || !total) return;
                const pct = Math.min(100, Math.round(loaded / total * 100));
                bar.style.width = pct + '%';
                label.textContent = 'Loading PDF · ' + pct + '%';
            };
            return task.promise;
        }).then(d => {
            if (dead || !d) return null;
            doc = d;
            return d.getPage(1);
        }).then(p1 => {
            if (dead || !p1) return;
            const vp = p1.getViewport({ scale: 1 });
            const aspect = vp.width / vp.height;
            const frag = document.createDocumentFragment();
            pages = Array.from({ length: doc.numPages }, (_, i) => {
                const el = document.createElement('div');
                el.className = 'w-embed-pdf-page';
                el.setAttribute('role', 'img');
                el.setAttribute('aria-label', 'Page ' + (i + 1) + ' of ' + doc.numPages);
                frag.appendChild(el);
                return { n: i + 1, el, aspect, w: 0, h: 0, rw: 0, near: false, canvas: null, task: null, proxy: null, proxyP: null, baseW: vp.width };
            });
            pages[0].proxy = p1;
            pages[0].proxyP = Promise.resolve(p1);
            root.classList.toggle('is-deck', aspect >= 1);
            list.appendChild(frag);
            label.textContent = 'Rendering';
            bar.style.width = '100%';
            layout(true);
            nav.hidden = pages.length < 2;
            track();

            const byEl = new Map(pages.map(pg => [pg.el, pg]));
            io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    const pg = byEl.get(e.target);
                    pg.near = e.isIntersecting;
                    if (pg.near) queue.add(pg);
                });
                pump();
            }, { root: scroller, rootMargin: '100% 0px' }); // render one screen ahead / behind
            pages.forEach(pg => io.observe(pg.el));

            ro = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => layout(false), 120); });
            ro.observe(scroller);
            const watchDpr = () => {
                mq = matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
                mq.addEventListener('change', onDpr, { once: true });
            };
            const onDpr = () => { if (!dead) { layout(true); watchDpr(); } };
            watchDpr();
            scroller.addEventListener('scroll', onScroll, { passive: true });
        }).catch(err => {
            if (dead) return;
            console.warn('[embeds] pdf failed', href, err);
            if (libFailed && nativeOK()) showNative();
            else if (err && err.name === 'PasswordException') showFailure('This PDF is password-protected.');
            else showFailure('Couldn’t display this PDF here.');
        });

        return function cleanup() {
            if (dead) return;
            dead = true;
            cancelAnimationFrame(rafId);
            clearTimeout(resizeTimer);
            if (io) io.disconnect();
            if (ro) ro.disconnect();
            scroller.removeEventListener('scroll', onScroll);
            queue.clear();
            pages.forEach(pg => { if (pg.task) pg.task.cancel(); freeCanvas(pg.canvas); pg.canvas = null; });
            pages = [];
            // Destroys the document and terminates its dedicated worker.
            const done = task ? task.destroy() : Promise.resolve();
            provider._lastDestroy = done.then(() => { provider._live--; return true; });
            task = doc = null;
            root.remove();
        };
    }

    const provider = W.providers.pdf = {
        size: 'doc',
        build: 'auto',        // 'auto' | 'modern' | 'legacy' (override for testing)
        loadedBuild: null,    // which build actually loaded
        _live: 0,             // open documents not yet destroyed (diagnostics)
        _lastDestroy: null,   // promise resolving true once the last closed document is destroyed
        mount
    };
})();

// Announce the dialog only on links a provider can open (the script is deferred, so the DOM is ready).
document.querySelectorAll('a[data-embed]').forEach(a => {
    if (window.WorkEmbeds.providers[a.dataset.embed]) a.setAttribute('aria-haspopup', 'dialog');
});
