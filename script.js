/* global Android */

document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-pause-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const playerContainer = document.body;
    const miniArt = document.getElementById('mini-art');
    const songTitleEl = document.getElementById('song-title');
    const artistNameEl = document.getElementById('artist-name');

    if (!playBtn || !volumeSlider || !songTitleEl || !artistNameEl) return;

    const playIcon = playBtn.querySelector('i');
    const albumArtWrapper = document.querySelector('.album-art-wrapper');
    const streamUrl = 'https://stream.zeno.fm/malrfbui0fpvv';
    const metadataUrl = 'https://api.zeno.fm/mounts/metadata/subscribe/malrfbui0fpvv';

    const audio = document.getElementById('audioPlayer') || new Audio();
    audio.src = streamUrl;
    audio.preload = 'none';
    let isPlaying = false;

    let currentStreamTitle = '';
    const albumArtCache = new Map();

    // Media Session action handlers
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            if (!isPlaying) togglePlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (isPlaying) togglePlay();
        });
    }

    function fetchAlbumArt(artist, title) {
        if (artist === 'Radio Sonido Celestial' || title === 'En Vivo') {
            playerContainer.style.setProperty('--album-art', 'none');
            if (miniArt) miniArt.src = 'logo.png';
            return;
        }

        const query = encodeURIComponent(artist + ' ' + title);
        const cached = albumArtCache.get(query);
        if (cached) {
                playerContainer.style.setProperty('--album-art', `url('${cached}')`);
                if (miniArt) miniArt.src = cached;
                updateLastHistoryArt(cached);
                if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: navigator.mediaSession.metadata.title,
                        artist: navigator.mediaSession.metadata.artist,
                        artwork: [{ src: cached, sizes: '600x600', type: 'image/png' }]
                    });
                }
                return;
        }

        fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`)
            .then(res => {
                if (!res.ok) throw new Error('iTunes API error: ' + res.status);
                return res.json();
            })
            .then(data => {
                let artUrl;
                if (data.results && data.results.length > 0) {
                    artUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
                    playerContainer.style.setProperty('--album-art', `url('${artUrl}')`);
                } else {
                    playerContainer.style.setProperty('--album-art', 'none');
                    artUrl = 'logo.png';
                }
                if (artUrl !== 'logo.png') albumArtCache.set(query, artUrl);
                if (miniArt) miniArt.src = artUrl;
                updateLastHistoryArt(artUrl);
                if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: navigator.mediaSession.metadata.title,
                        artist: navigator.mediaSession.metadata.artist,
                        artwork: [{ src: artUrl, sizes: '600x600', type: 'image/png' }]
                    });
                }
            })
            .catch(() => {
                playerContainer.style.setProperty('--album-art', 'none');
                if (miniArt) miniArt.src = 'logo.png';
                updateLastHistoryArt('logo.png');
                if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: navigator.mediaSession.metadata.title,
                        artist: navigator.mediaSession.metadata.artist,
                        artwork: [{ src: 'logo.png', sizes: '600x600', type: 'image/png' }]
                    });
                }
            });
    }

    function updateMetadata(data) {
        if (data && data.streamTitle) {
            if (currentStreamTitle === data.streamTitle) return;
            currentStreamTitle = data.streamTitle;

            let artist = 'Radio Sonido Celestial';
            let title = data.streamTitle;

            // Zeno often sends "Artist - Title" in streamTitle
            const parts = data.streamTitle.split('-');
            if (parts.length > 1) {
                artist = parts[0].trim();
                title = parts.slice(1).join('-').trim();
            } else {
                title = data.streamTitle;
            }

            artistNameEl.textContent = artist;
            songTitleEl.textContent = title;

            // Always fetch album art for background
            if (data.image) {
                playerContainer.style.setProperty('--album-art', `url('${data.image}')`);
                if (miniArt) miniArt.src = data.image;
            } else {
                fetchAlbumArt(artist, title);
            }

            // Save to history
            addToHistory(artist, title, data.image || 'logo.png');

            // Update Media Session with real artwork
            const msArtUrl = data.image || (miniArt ? miniArt.src : 'logo.png');
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: title,
                    artist: artist,
                    artwork: [
                        { src: msArtUrl, sizes: '600x600', type: 'image/png' }
                    ]
                });
            }

            // Notify Android native bridge with album art URL
            const artUrlForAndroid = data.image || (miniArt ? miniArt.src : '');
            try {
                if (isAndroid()) Android.updateMetadata(title, artist, artUrlForAndroid);
            } catch (e) {}
        }
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    let retryDelay = 5000;

    function fetchMetadata() {
        const eventSource = new EventSource(metadataUrl);

        eventSource.onmessage = (event) => {
            retryDelay = 5000;
            try {
                const data = JSON.parse(event.data);
                if (data) {
                    updateMetadata(data);
                }
            } catch (e) {
                console.error('Error parsing metadata', e);
            }
        };

        eventSource.onerror = () => {
            const jitter = Math.random() * 3000;
            const delay = Math.min(retryDelay + jitter, 60000);
            eventSource.close();
            setTimeout(fetchMetadata, delay);
            retryDelay = Math.min(retryDelay * 2, 60000);
        };
    }

    // Start fetching metadata immediately
    fetchMetadata();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker not registered', err));
    }

    function isAndroid() {
        return typeof Android !== 'undefined' && Android !== null;
    }

    // Sync volume from ExoPlayer on first load
    if (isAndroid()) syncVolume();

    function togglePlay() {
        if (!isPlaying) {
            if (isAndroid()) {
                Android.play(streamUrl, songTitleEl.textContent, artistNameEl.textContent, miniArt ? miniArt.src : '');
                syncVolume();
            } else {
                audio.src = streamUrl;
                audio.load();
                audio.play().catch(error => {
                    console.error("Error playing audio:", error);
                    alert("No se pudo reproducir la radio. Intenta de nuevo.");
                });
            }
            isPlaying = true;
            updateUIState(true);
        } else {
            if (isAndroid()) {
                Android.pause();
            } else {
                audio.pause();
                audio.src = '';
            }
            isPlaying = false;
            updateUIState(false);
        }
    }

    function updateUIState(playing) {
        if (playing) {
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
            if (albumArtWrapper) albumArtWrapper.classList.add('playing');
            playBtn.classList.add('playing');
            const indicatorOn = document.querySelector('.playing-indicator');
            if (indicatorOn) indicatorOn.style.opacity = '1';
        } else {
            playIcon.classList.remove('fa-pause');
            playIcon.classList.add('fa-play');
            if (albumArtWrapper) albumArtWrapper.classList.remove('playing');
            playBtn.classList.remove('playing');
            const indicatorOff = document.querySelector('.playing-indicator');
            if (indicatorOff) indicatorOff.style.opacity = '0';
        }
    }

    // Volume Control - Bidirectional
    function syncVolume() {
        if (isAndroid()) {
            try {
                const vol = Android.getVolume();
                volumeSlider.value = vol;
                audio.volume = vol;
            } catch (ex) {}
        }
    }

    const debouncedSetVolume = debounce((vol) => {
        if (isAndroid()) {
            try { Android.setVolume(vol); } catch (ex) {}
        }
    }, 120);

    volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        audio.volume = vol;
        debouncedSetVolume(vol);
    });

    // Play Button Listener
    playBtn.addEventListener('click', togglePlay);

    // Handle spacebar to play/pause
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        }
    });

    // --- History Panel ---
    const HISTORY_KEY = 'sonido-celestial-history';
    const MAX_HISTORY = 50;
    const historyList = document.getElementById('history-list');
    const historyBtn = document.getElementById('history-btn');
    const bottomHistoryBtn = document.getElementById('bottom-history-btn');
    const historyPanel = document.getElementById('history-panel');
    const historyOverlay = document.getElementById('history-overlay');
    const historyClose = document.getElementById('history-close');

    function loadHistory() {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function saveHistory(history) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch {}
    }

    function formatTime(isoString) {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Ahora';
        if (mins < 60) return `Hace ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `Hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `Hace ${days}d`;
    }

    function createHistoryItem(artist, title, albumArt, timestamp) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <img class="history-item-art" src="${escapeHtml(albumArt)}" alt="" onerror="this.src='logo.png'">
            <div class="history-item-info">
                <div class="history-item-title">${escapeHtml(title)}</div>
                <div class="history-item-artist">${escapeHtml(artist)}</div>
            </div>
            <span class="history-item-time">${formatTime(timestamp)}</span>
        `;
        return div;
    }

    function renderHistory() {
        if (!historyList) return;
        const history = loadHistory();
        const titleEl = document.getElementById('history-panel-title');
        if (titleEl) {
            titleEl.textContent = history.length > 0 ? `🕒 Historial reciente (${history.length})` : '🕒 Historial reciente';
        }
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">Aún no hay canciones en el historial</div>';
            return;
        }
        historyList.innerHTML = '';
        history.forEach(item => {
            historyList.appendChild(createHistoryItem(item.artist, item.title, item.albumArt, item.timestamp));
        });
    }

    function updateLastHistoryArt(artUrl) {
        const history = loadHistory();
        if (history.length === 0) return;
        history[0].albumArt = artUrl;
        saveHistory(history);
        if (historyPanel && historyPanel.classList.contains('active')) {
            const firstItem = historyList.querySelector('.history-item');
            if (firstItem) {
                const img = firstItem.querySelector('.history-item-art');
                if (img) img.src = artUrl;
            }
        }
    }

    function addToHistory(artist, title, albumArt) {
        if (!title || title === 'En Vivo') return;
        const history = loadHistory();
        if (history.length > 0 && history[0].title === title && history[0].artist === artist) return;
        const timestamp = new Date().toISOString();
        history.unshift({ artist, title, albumArt: albumArt || 'logo.png', timestamp });
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        saveHistory(history);
        if (historyPanel && historyPanel.classList.contains('active')) {
            const isEmpty = historyList.querySelector('.history-empty');
            if (isEmpty) historyList.innerHTML = '';
            historyList.insertBefore(createHistoryItem(artist, title, albumArt, timestamp), historyList.firstChild);
            if (history.length > MAX_HISTORY && historyList.lastChild) {
                historyList.removeChild(historyList.lastChild);
            }
        }
    }

    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function toggleHistory(open) {
        if (!historyPanel || !historyOverlay) return;
        const isOpen = open !== undefined ? open : !historyPanel.classList.contains('active');
        historyPanel.classList.toggle('active', isOpen);
        historyOverlay.classList.toggle('active', isOpen);
        document.querySelector('.player-container')?.classList.toggle('panel-open', isOpen);
        if (isOpen) renderHistory();
    }

    if (historyBtn) historyBtn.addEventListener('click', () => toggleHistory(true));
    if (bottomHistoryBtn) bottomHistoryBtn.addEventListener('click', () => toggleHistory(true));
    if (historyClose) historyClose.addEventListener('click', () => toggleHistory(false));
    if (historyOverlay) historyOverlay.addEventListener('click', () => toggleHistory(false));

    // --- Bottom Nav Tabs ---
    const playerContainerEl = document.querySelector('.player-container');
    const bibleSection = document.getElementById('bible-section');
    const navItems = document.querySelectorAll('.nav-item');

    function setActiveTab(index) {
        navItems.forEach((item, i) => item.classList.toggle('active', i === index));
        playerContainerEl?.classList.toggle('bible-active', index === 1);
        bibleSection?.classList.toggle('active', index === 1);
        if (index !== 1) {
            toggleHistory(false);
        }
    }

    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            if (index === 2) return;
            setActiveTab(index);
        });
    });

    renderHistory();

    // --- Starfield Background ---
    const canvas = document.getElementById('space-canvas');
    const ctx = canvas.getContext('2d');

    let stars = [];
    const numStars = 200;
    let animFrameId = null;
    let resizeTimer = null;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    class Star {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = (Math.random() - 0.5) * 0.2;
            this.brightness = Math.random();
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;

            this.brightness += (Math.random() - 0.5) * 0.1;
            if (this.brightness > 1) this.brightness = 1;
            if (this.brightness < 0) this.brightness = 0;
        }

        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < numStars; i++) {
            stars.push(new Star());
        }
    }

    function animateStars() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(star => {
            star.update();
            star.draw();
        });
        animFrameId = requestAnimationFrame(animateStars);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animFrameId) cancelAnimationFrame(animFrameId);
            animFrameId = null;
        } else {
            animateStars();
        }
    });

    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeCanvas();
            initStars();
        }, 200);
    });

    resizeCanvas();
    initStars();
    animateStars();

    // Build audio visualizer bars
    const vTrack = document.getElementById('visualizer-track');
    if (vTrack) {
        const count = 40;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const bar = document.createElement('span');
            bar.className = 'v-bar';
            bar.style.setProperty('--i', i);
            fragment.appendChild(bar);
        }
        vTrack.appendChild(fragment);
    }

    // --- Versículo del Día (API externa + fallback local) ---
    (function() {
        var elText = document.querySelector('.bible-verse-text');
        var elRef = document.querySelector('.bible-verse-ref');
        if (!elText || !elRef) return;

        var fallback = [
            { text: 'Todo lo puedo en Cristo que me fortalece.', ref: 'Filipenses 4:13' },
            { text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree no se pierda, sino que tenga vida eterna.', ref: 'Juan 3:16' },
            { text: 'El Señor es mi pastor; nada me faltará.', ref: 'Salmos 23:1' },
            { text: 'Jehová es mi luz y mi salvación; ¿de quién temeré?', ref: 'Salmos 27:1' },
            { text: 'No te dejaré, ni te desampararé.', ref: 'Josué 1:5' }
        ];
        var day = new Date().getDate();
        var month = new Date().getMonth();
        var idx = (day + month * 31) % fallback.length;
        elText.textContent = '\u201C' + fallback[idx].text + '\u201D';
        elRef.textContent = fallback[idx].ref;

        fetch('https://bible-api.com/?random=verse&translation=rv1960')
            .then(function(r) {
                if (!r.ok) throw new Error('Bible API error: ' + r.status);
                return r.json();
            })
            .then(function(data) {
                if (data && data.text && data.reference) {
                    var t = data.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                    elText.textContent = '\u201C' + t + '\u201D';
                    elRef.textContent = data.reference;
                }
            })
            .catch(function() {});
    })();
});
