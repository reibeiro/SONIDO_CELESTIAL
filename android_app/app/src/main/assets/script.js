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

    const radioLogo = document.getElementById('radio-logo');

    // Media Session action handlers
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            if (!isPlaying) togglePlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (isPlaying) togglePlay();
        });
    }

    // Set fallback on image load errors
    if (miniArt) {
        miniArt.onerror = function () {
            this.src = 'logo.png';
        };
    }
    if (radioLogo) {
        radioLogo.onerror = function () {
            this.src = 'logo.png';
        };
    }

    function applyAlbumArt(artUrl) {
        playerContainer.style.setProperty('--album-art', `url('${artUrl}')`);
        if (miniArt) miniArt.src = artUrl;
        if (radioLogo) radioLogo.src = artUrl;
        if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: navigator.mediaSession.metadata.title,
                artist: navigator.mediaSession.metadata.artist,
                artwork: [{ src: artUrl, sizes: '600x600', type: 'image/jpeg' }]
            });
        }
    }

    function applyDefaultArt() {
        playerContainer.style.setProperty('--album-art', 'none');
        if (miniArt) miniArt.src = 'logo.png';
        if (radioLogo) radioLogo.src = 'logo.png';
    }

    function cleanTerm(text) {
        if (!text) return '';
        return text
            .replace(/\s*[\(\[].*?[\)\]]/g, '')
            .replace(/ft\..*|feat\..*/i, '')
            .replace(/[-_]/g, ' ')
            .trim();
    }

    function searchItunes(searchTerm) {
        if (!searchTerm) return Promise.resolve(null);
        const query = encodeURIComponent(searchTerm);
        return fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`)
            .then(res => {
                if (!res.ok) throw new Error('iTunes ' + res.status);
                return res.json();
            })
            .then(data => {
                if (data.results && data.results.length > 0) {
                    return data.results[0].artworkUrl100.replace('100x100', '600x600');
                }
                return null;
            });
    }

    function fetchAlbumArt(artist, title, onResolved) {
        if (artist === 'Radio Sonido Celestial' || title === 'En Vivo' || !title) {
            applyDefaultArt();
            if (onResolved) onResolved('logo.png');
            return;
        }

        const cacheKey = artist + '|' + title;
        const cached = albumArtCache.get(cacheKey);
        if (cached) {
            applyAlbumArt(cached);
            if (onResolved) onResolved(cached);
            return;
        }

        const cleanArtist = cleanTerm(artist);
        const cleanTitle = cleanTerm(title);

        // Strategy 1: cleanArtist + cleanTitle
        searchItunes(cleanArtist + ' ' + cleanTitle)
            .then(artUrl => {
                if (artUrl) return artUrl;
                // Strategy 2: cleanTitle only
                if (cleanTitle && cleanTitle !== cleanArtist) {
                    return searchItunes(cleanTitle);
                }
                return null;
            })
            .then(artUrl => {
                if (artUrl) return artUrl;
                // Strategy 3: cleanArtist only
                if (cleanArtist) {
                    return searchItunes(cleanArtist);
                }
                return null;
            })
            .then(artUrl => {
                if (artUrl) {
                    albumArtCache.set(cacheKey, artUrl);
                    applyAlbumArt(artUrl);
                    if (onResolved) onResolved(artUrl);
                } else {
                    console.warn('No album art found for:', artist, '-', title);
                    applyDefaultArt();
                    if (onResolved) onResolved('logo.png');
                }
            })
            .catch(err => {
                console.error('Album art fetch error:', err);
                applyDefaultArt();
                if (onResolved) onResolved('logo.png');
            });
    }

    function triggerVerticalSlideUp(title, artist) {
        if (!songTitleEl || !artistNameEl) return;

        songTitleEl.classList.add('slide-up-exit');
        artistNameEl.classList.add('slide-up-exit');

        setTimeout(() => {
            songTitleEl.textContent = title;
            artistNameEl.textContent = artist;

            songTitleEl.classList.remove('slide-up-exit');
            artistNameEl.classList.remove('slide-up-exit');
            songTitleEl.classList.add('slide-up-enter');
            artistNameEl.classList.add('slide-up-enter');

            void songTitleEl.offsetWidth;

            setTimeout(() => {
                songTitleEl.classList.remove('slide-up-enter');
                artistNameEl.classList.remove('slide-up-enter');
            }, 30);
        }, 220);
    }

    function updateMetadata(data) {
        if (data && data.streamTitle) {
            if (currentStreamTitle === data.streamTitle) return;
            currentStreamTitle = data.streamTitle;

            let artist = 'Radio Sonido Celestial';
            let title = data.streamTitle;

            // Zeno sends "Artist - Title" in streamTitle
            const dashIdx = data.streamTitle.indexOf(' - ');
            if (dashIdx > 0) {
                artist = data.streamTitle.substring(0, dashIdx).trim();
                title = data.streamTitle.substring(dashIdx + 3).trim();
            }

            triggerVerticalSlideUp(title, artist);

            // Set initial Media Session
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: title,
                    artist: artist,
                    artwork: [{ src: 'logo.png', sizes: '300x300', type: 'image/jpeg' }]
                });
            }

            // Callback: save to history + notify Android AFTER art resolves
            const onArtResolved = (artUrl) => {
                addToHistory(artist, title, artUrl);
                try {
                    if (isAndroid()) Android.updateMetadata(title, artist, artUrl === 'logo.png' ? '' : artUrl);
                } catch (e) {}
            };

            // Fetch album art, then save history with real art
            if (data.image) {
                applyAlbumArt(data.image);
                onArtResolved(data.image);
            } else {
                fetchAlbumArt(artist, title, onArtResolved);
            }
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

    function getActiveArtUrl() {
        if (!miniArt || !miniArt.src || miniArt.src.endsWith('logo.png')) {
            return '';
        }
        return miniArt.src.startsWith('http') ? miniArt.src : '';
    }

    function togglePlay() {
        if (!isPlaying) {
            if (isAndroid()) {
                Android.play(streamUrl, songTitleEl.textContent, artistNameEl.textContent, getActiveArtUrl());
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

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('¿Deseas borrar todo el historial de canciones escuchadas?')) {
                localStorage.removeItem(HISTORY_KEY);
                renderHistory();
                showToast('Historial de canciones limpiado 🗑️');
            }
        });
    }

    if (historyBtn) historyBtn.addEventListener('click', () => toggleHistory(true));
    if (bottomHistoryBtn) bottomHistoryBtn.addEventListener('click', () => toggleHistory(true));
    if (historyClose) historyClose.addEventListener('click', () => toggleHistory(false));
    if (historyOverlay) historyOverlay.addEventListener('click', () => toggleHistory(false));

    // --- Prayer Request Modal ---
    const prayerTriggerBtn = document.getElementById('prayer-trigger-btn');
    const infoPrayerBtn = document.getElementById('info-prayer-btn');
    const prayerOverlay = document.getElementById('prayer-overlay');
    const prayerModal = document.getElementById('prayer-modal');
    const prayerClose = document.getElementById('prayer-close');
    const prayerSendBtn = document.getElementById('prayer-send-btn');
    const prayerNameInput = document.getElementById('prayer-name');
    const prayerMsgInput = document.getElementById('prayer-message');

    function togglePrayerModal(open) {
        if (!prayerOverlay || !prayerModal) return;
        const isOpen = open !== undefined ? open : !prayerModal.classList.contains('active');
        prayerOverlay.classList.toggle('active', isOpen);
        prayerModal.classList.toggle('active', isOpen);
        if (isOpen && prayerNameInput) {
            setTimeout(() => prayerNameInput.focus(), 200);
        }
    }

    const quickPrayerBtn = document.getElementById('quick-prayer-btn');
    if (quickPrayerBtn) quickPrayerBtn.addEventListener('click', () => togglePrayerModal(true));

    if (prayerTriggerBtn) prayerTriggerBtn.addEventListener('click', () => togglePrayerModal(true));
    if (infoPrayerBtn) infoPrayerBtn.addEventListener('click', () => togglePrayerModal(true));
    if (prayerClose) prayerClose.addEventListener('click', () => togglePrayerModal(false));
    if (prayerOverlay) prayerOverlay.addEventListener('click', () => togglePrayerModal(false));

    if (prayerSendBtn) {
        prayerSendBtn.addEventListener('click', () => {
            const name = prayerNameInput ? prayerNameInput.value.trim() : '';
            const message = prayerMsgInput ? prayerMsgInput.value.trim() : '';

            if (!message) {
                if (prayerMsgInput) {
                    prayerMsgInput.focus();
                    prayerMsgInput.style.borderColor = 'var(--accent-color)';
                    setTimeout(() => {
                        prayerMsgInput.style.borderColor = '';
                    }, 1500);
                }
                return;
            }

            const senderName = name.length > 0 ? name : 'Anónimo';
            const formattedMsg = `*Petición de Oración - Radio Sonido Celestial* 🙏\n\n*Nombre:* ${senderName}\n*Petición:* ${message}`;
            const waUrl = `https://wa.me/573145377834?text=${encodeURIComponent(formattedMsg)}`;

            window.open(waUrl, '_blank');

            if (prayerMsgInput) prayerMsgInput.value = '';
            if (prayerNameInput) prayerNameInput.value = '';
            togglePrayerModal(false);
        });
    }

    // --- Bottom Nav Tabs ---
    const playerContainerEl = document.querySelector('.player-container');
    const bibleSection = document.getElementById('bible-section');
    const infoSection = document.getElementById('info-section');
    const navItems = document.querySelectorAll('.nav-item');

    function setActiveTab(index) {
        navItems.forEach((item, i) => item.classList.toggle('active', i === index));
        playerContainerEl?.classList.toggle('bible-active', index === 1);
        playerContainerEl?.classList.toggle('info-active', index === 3);
        bibleSection?.classList.toggle('active', index === 1);
        infoSection?.classList.toggle('active', index === 3);
        if (index !== 1 && index !== 3) {
            toggleHistory(false);
        }
    }

    window.openBibleSection = function() {
        setActiveTab(1);
    };

    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            if (index === 2) return;
            setActiveTab(index);
        });
    });

    renderHistory();

    // --- Live Schedule Data & Control ---
    const SCHEDULE_DATA = {
        weekdays: [
            { start: "06:00", end: "08:00", name: "Amanecer con Dios", host: "Devocional & Alabanza Matutina", icon: "fa-sun" },
            { start: "08:00", end: "10:00", name: "Enseñanza Bíblica & Fe", host: "Pastor Juan Pérez", icon: "fa-book-open-reader" },
            { start: "10:00", end: "12:00", name: "Cielos Abiertos", host: "Música Cristiana Variada", icon: "fa-cloud-sun" },
            { start: "12:00", end: "14:00", name: "Intercesión & Oración en Vivo", host: "Peticiones de Oyentes", icon: "fa-hands-praying" },
            { start: "14:00", end: "17:00", name: "Tarde Celestial", host: "Música Juvenil & Testimonios", icon: "fa-radio" },
            { start: "17:00", end: "19:00", name: "Camino a Casa", host: "Reflexión & Palabras de Ánimo", icon: "fa-house" },
            { start: "19:00", end: "22:00", name: "Noche de Gloria & Adoración", host: "Alabanza Profunda", icon: "fa-star" },
            { start: "22:00", end: "06:00", name: "Melodías del Cielo", host: "Música Instrumental Nocturna", icon: "fa-moon" }
        ],
        saturday: [
            { start: "07:00", end: "10:00", name: "Sábado en Familia", host: "Consejos & Alabanza Familiar", icon: "fa-people-roof" },
            { start: "10:00", end: "13:00", name: "Juventud Celestial", host: "Pop & Urbano Cristiano", icon: "fa-bolt" },
            { start: "13:00", end: "17:00", name: "Especiales Misioneros", host: "Historias & Testimonios", icon: "fa-earth-americas" },
            { start: "17:00", end: "21:00", name: "Top 20 Alabanzas", host: "Las canciones más pedidas", icon: "fa-trophy" },
            { start: "21:00", end: "07:00", name: "Noche de Paz Instrumental", host: "Paz para tu Descanso", icon: "fa-bed" }
        ],
        sunday: [
            { start: "07:00", end: "11:00", name: "Culto & Servicio Dominical", host: "Predicación & Transmisión en Vivo", icon: "fa-church" },
            { start: "11:00", end: "14:00", name: "Bendición Familiar", host: "Música & Mensaje Dominical", icon: "fa-heart" },
            { start: "14:00", end: "18:00", name: "Himnos & Coros Clásicos", host: "Tradición y Alabanza", icon: "fa-music" },
            { start: "18:00", end: "21:00", name: "Estudio Bíblico Profundo", host: "Descubriendo la Palabra", icon: "fa-scroll" },
            { start: "21:00", end: "06:00", name: "Melodías del Cielo", host: "Descanso en Su Presencia", icon: "fa-moon" }
        ]
    };

    function isTimeCurrent(startStr, endStr, isTodayCategory) {
        if (!isTodayCategory) return false;
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        const [sH, sM] = startStr.split(':').map(Number);
        const [eH, eM] = endStr.split(':').map(Number);
        const startMins = sH * 60 + sM;
        let endMins = eH * 60 + eM;

        if (endMins < startMins) {
            endMins += 24 * 60; // Overnight show
        }

        return currentMins >= startMins && currentMins < endMins;
    }

    function getCurrentDayCategory() {
        const day = new Date().getDay();
        if (day === 0) return 'sunday';
        if (day === 6) return 'saturday';
        return 'weekdays';
    }

    let activeDayCategory = getCurrentDayCategory();

    let isAdmin = false;

    function renderSchedule(category) {
        const listEl = document.getElementById('schedule-list');
        if (!listEl) return;

        const items = SCHEDULE_DATA[category] || [];
        const isTodayCategory = (category === getCurrentDayCategory());

        listEl.innerHTML = '';
        if (items.length === 0) {
            listEl.innerHTML = '<div class="schedule-empty">No hay programas registrados para este día</div>';
            return;
        }

        items.forEach((item, index) => {
            const isLive = isTimeCurrent(item.start, item.end, isTodayCategory);
            const div = document.createElement('div');
            div.className = `schedule-item ${isLive ? 'live-now' : ''}`;
            div.innerHTML = `
                <div class="schedule-time-box">
                    <span class="schedule-time">${item.start} - ${item.end}</span>
                    <div class="schedule-item-actions">
                        ${isLive ? '<span class="schedule-live-badge"><i class="fas fa-circle"></i> EN VIVO</span>' : ''}
                        ${isAdmin ? `
                            <button class="admin-edit-btn" data-index="${index}" title="Editar programa"><i class="fas fa-pen"></i></button>
                            <button class="admin-delete-btn" data-index="${index}" title="Eliminar programa"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </div>
                <div class="schedule-info">
                    <div class="schedule-title"><i class="fas ${item.icon || 'fa-radio'}"></i> ${item.name}</div>
                    <div class="schedule-host">${item.host || ''}</div>
                </div>
            `;
            listEl.appendChild(div);
        });

        if (isAdmin) {
            listEl.querySelectorAll('.admin-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    openEditProgramModal(idx);
                });
            });
            listEl.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    if (confirm('¿Deseas eliminar este programa de la lista?')) {
                        deleteProgram(idx);
                    }
                });
            });
        }
    }

    // --- Notifications Panel (Avisos Importantes) ---
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsOverlay = document.getElementById('notifications-overlay');
    const notificationsModal = document.getElementById('notifications-modal');
    const notificationsCloseBtn = document.getElementById('notifications-close');
    const notificationsList = document.getElementById('notifications-list');

    function formatTimeAgo(isoString) {
        if (!isoString) return 'Hace poco';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Justo ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Ayer';
        return `Hace ${diffDays} días`;
    }

    function loadRecentNotifications() {
        if (!notificationsList) return;
        notificationsList.innerHTML = `
            <div class="notifications-loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Cargando avisos...</p>
            </div>
        `;

        const clearBtn = document.getElementById('admin-clear-notifications-btn');
        if (clearBtn) {
            clearBtn.style.display = isAdmin ? 'flex' : 'none';
        }

        if (typeof db !== 'undefined' && db) {
            db.collection('notification_requests')
              .orderBy('createdAt', 'desc')
              .limit(10)
              .get()
              .then((querySnapshot) => {
                  notificationsList.innerHTML = '';
                  if (querySnapshot.empty) {
                      notificationsList.innerHTML = '<div class="notifications-empty">No hay avisos recientes por el momento.</div>';
                      return;
                  }

                  querySnapshot.forEach((doc) => {
                      const data = doc.data();
                      const div = document.createElement('div');
                      div.className = 'notification-item';
                      div.innerHTML = `
                          <div class="notification-item-title">${data.title || 'Aviso'}</div>
                          <div class="notification-item-body">${data.body || ''}</div>
                          <div class="notification-item-time"><i class="far fa-clock"></i> ${formatTimeAgo(data.createdAt)}</div>
                      `;
                      notificationsList.appendChild(div);
                  });
              })
              .catch((err) => {
                  notificationsList.innerHTML = `<div class="notifications-empty">Error al cargar avisos: ${err.message}</div>`;
              });
        } else {
            notificationsList.innerHTML = '<div class="notifications-empty">Conexión no disponible.</div>';
        }
    }

    function toggleNotificationsModal(open) {
        if (!notificationsOverlay || !notificationsModal) return;
        const isOpen = open !== undefined ? open : !notificationsModal.classList.contains('active');
        if (isOpen) {
            notificationsOverlay.classList.add('active');
            notificationsModal.classList.add('active');
            loadRecentNotifications();
        } else {
            notificationsOverlay.classList.remove('active');
            notificationsModal.classList.remove('active');
        }
    }

    if (notificationsBtn) notificationsBtn.addEventListener('click', () => toggleNotificationsModal(true));
    if (notificationsCloseBtn) notificationsCloseBtn.addEventListener('click', () => toggleNotificationsModal(false));
    if (notificationsOverlay) notificationsOverlay.addEventListener('click', () => toggleNotificationsModal(false));

    // Botón exclusivo de Administrador para Limpiar Avisos
    const adminClearNotificationsBtn = document.getElementById('admin-clear-notifications-btn');
    if (adminClearNotificationsBtn) {
        adminClearNotificationsBtn.addEventListener('click', () => {
            if (!isAdmin || typeof db === 'undefined' || !db) return;
            if (confirm('⚠️ ¿Estás seguro de que deseas eliminar TODOS los avisos del historial? Esta acción no se puede deshacer.')) {

                adminClearNotificationsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                adminClearNotificationsBtn.disabled = true;

                db.collection('notification_requests').get().then(snapshot => {
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    return batch.commit();
                }).then(() => {
                    showToast('✅ Todos los avisos han sido eliminados.');
                    loadRecentNotifications();
                }).catch(err => {
                    showToast('❌ Error al limpiar: ' + err.message);
                }).finally(() => {
                    adminClearNotificationsBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
                    adminClearNotificationsBtn.disabled = false;
                });
            }
        });
    }

    // --- Side Drawer Navigation Menu ---
    const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const sideDrawer = document.getElementById('side-drawer');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerAdminBtn = document.getElementById('drawer-admin-btn');
    const drawerAdminLabel = document.getElementById('drawer-admin-label');
    const drawerScheduleBtn = document.getElementById('drawer-schedule-btn');

    function toggleSideDrawer(open) {
        if (!drawerOverlay || !sideDrawer) return;
        const isOpen = open !== undefined ? open : !sideDrawer.classList.contains('active');
        drawerOverlay.classList.toggle('active', isOpen);
        sideDrawer.classList.toggle('active', isOpen);
    }

    if (drawerToggleBtn) drawerToggleBtn.addEventListener('click', () => toggleSideDrawer(true));
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', () => toggleSideDrawer(false));
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => toggleSideDrawer(false));

    if (drawerAdminBtn) {
        drawerAdminBtn.addEventListener('click', () => {
            toggleSideDrawer(false);
            toggleAdminLoginModal(true);
        });
    }

    if (drawerScheduleBtn) {
        drawerScheduleBtn.addEventListener('click', () => {
            toggleSideDrawer(false);
            toggleScheduleModal(true);
        });
    }

    // Admin Auth State Listener
    if (typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(user => {
            isAdmin = !!user;
            const adminScheduleBar = document.getElementById('admin-schedule-bar');
            const adminLoggedOutView = document.getElementById('admin-logged-out-view');
            const adminLoggedInView = document.getElementById('admin-logged-in-view');
            const adminProfileEmail = document.getElementById('admin-profile-email');
            const adminBtnLabel = document.getElementById('admin-btn-label');

            if (adminScheduleBar) adminScheduleBar.style.display = isAdmin ? 'flex' : 'none';
            if (adminLoggedOutView) adminLoggedOutView.style.display = isAdmin ? 'none' : 'block';
            if (adminLoggedInView) adminLoggedInView.style.display = isAdmin ? 'block' : 'none';
            if (adminProfileEmail && user) adminProfileEmail.textContent = user.email;
            if (adminBtnLabel) adminBtnLabel.textContent = isAdmin ? 'Admin Activo 🔓' : 'Acceso Administrador';
            if (drawerAdminLabel) drawerAdminLabel.textContent = isAdmin ? 'Admin Activo 🔓' : 'Acceso Administrador';

            renderSchedule(activeDayCategory);
            updateLiveVideoUI();
        });
    }

    // --- Live Video State & Realtime Sync ---
    let liveVideoState = {
        isLive: false,
        platform: 'youtube',
        videoId: '',
        title: 'Transmisión en Vivo'
    };

    function extractYouTubeId(urlOrId) {
        if (!urlOrId) return '';
        const str = urlOrId.trim();
        const match = str.match(/(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (match && match[1]) return match[1];
        if (/^[\w-]{11}$/.test(str)) return str;
        return '';
    }

    function getYouTubeChannelLiveUrl(urlOrHandle) {
        if (!urlOrHandle) return 'https://www.youtube.com';
        const str = urlOrHandle.trim();
        if (str.startsWith('http://') || str.startsWith('https://')) {
            return str;
        }
        if (str.startsWith('@')) {
            return `https://www.youtube.com/${str}/live`;
        }
        if (/^[\w-]{11}$/.test(str)) {
            return `https://www.youtube.com/watch?v=${str}`;
        }
        return `https://www.youtube.com/@${str}/live`;
    }

    function updateLiveVideoUI() {
        const banner = document.getElementById('live-video-banner');
        const titleEl = document.getElementById('live-video-title');
        const toggleInput = document.getElementById('admin-video-toggle');
        const platformInput = document.getElementById('admin-video-platform');
        const idInput = document.getElementById('admin-video-id');
        const titleInput = document.getElementById('admin-video-title');

        if (banner) {
            banner.style.display = liveVideoState.isLive ? 'flex' : 'none';
        }
        if (titleEl) {
            titleEl.textContent = liveVideoState.title || 'Transmisión en Vivo';
        }

        if (toggleInput) toggleInput.value = liveVideoState.isLive ? 'on' : 'off';
        if (platformInput) platformInput.value = liveVideoState.platform || 'youtube';
        if (idInput) idInput.value = liveVideoState.videoId || '';
        if (titleInput) titleInput.value = liveVideoState.title || '';
    }

    const videoOverlay = document.getElementById('video-overlay');
    const videoModal = document.getElementById('video-modal');
    const videoContainer = document.getElementById('video-container');
    const videoTitleDisplay = document.getElementById('video-title-display');
    const watchVideoBtn = document.getElementById('watch-video-btn');
    const videoCloseBtn = document.getElementById('video-close');
    const videoAudioOnlyBtn = document.getElementById('video-audio-only-btn');

    function toggleVideoModal(open) {
        if (!videoOverlay || !videoModal) return;
        const isOpen = open !== undefined ? open : !videoModal.classList.contains('active');

        if (isOpen) {
            if (liveVideoState.platform === 'facebook') {
                // Facebook Live: Open natively in FB App / Browser to avoid login blocks
                const fbUrl = liveVideoState.videoId.startsWith('http') ? liveVideoState.videoId : `https://www.facebook.com/watch/?v=${liveVideoState.videoId}`;
                if (isPlaying) {
                    if (isAndroid()) Android.pause();
                    else audio.pause();
                    isPlaying = false;
                    updateUIState(false);
                }
                window.open(fbUrl, '_blank');
                showToast('Abriendo transmisión en vivo de Facebook 📹');
                return;
            }

            // YouTube Live Embed
            const ytId = extractYouTubeId(liveVideoState.videoId);
            const externalBtn = document.getElementById('video-external-btn');

            const fullYtUrl = getYouTubeChannelLiveUrl(liveVideoState.videoId);
            if (externalBtn) {
                externalBtn.href = fullYtUrl;
            }

            if (videoContainer) {
                if (ytId && ytId.length === 11) {
                    videoContainer.innerHTML = `
                        <iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1"
                                title="YouTube live player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowfullscreen>
                        </iframe>
                    `;
                } else if (liveVideoState.videoId.includes('@') || liveVideoState.videoId.includes('live')) {
                    videoContainer.innerHTML = `
                        <div class="video-fallback-card">
                            <i class="fab fa-youtube fallback-icon"></i>
                            <div class="fallback-title">Canal en Vivo @SonidoCelestialRadio</div>
                            <div class="fallback-text">Haz clic en el botón inferior "Abrir en YouTube App" para ver la transmisión en vivo en el canal.</div>
                        </div>
                    `;
                } else {
                    videoContainer.innerHTML = `
                        <div class="video-fallback-card">
                            <i class="fab fa-youtube fallback-icon"></i>
                            <div class="fallback-title">Transmisión en Vivo de YouTube</div>
                            <div class="fallback-text">Para ver la transmisión incrustada, ingresa la URL de un video (ej. https://youtube.com/watch?v=...) en el panel admin.</div>
                        </div>
                    `;
                }
            }
            if (videoTitleDisplay) {
                videoTitleDisplay.textContent = liveVideoState.title || 'Culto de Adoración en Vivo';
            }

            // Pause audio radio stream
            if (isPlaying) {
                if (isAndroid()) Android.pause();
                else audio.pause();
                isPlaying = false;
                updateUIState(false);
            }

            videoOverlay.classList.add('active');
            videoModal.classList.add('active');
        } else {
            // Destroy iframe memory on close
            if (videoContainer) videoContainer.innerHTML = '';
            videoOverlay.classList.remove('active');
            videoModal.classList.remove('active');
        }
    }

    if (watchVideoBtn) watchVideoBtn.addEventListener('click', () => toggleVideoModal(true));
    if (videoCloseBtn) videoCloseBtn.addEventListener('click', () => toggleVideoModal(false));
    if (videoAudioOnlyBtn) videoAudioOnlyBtn.addEventListener('click', () => toggleVideoModal(false));
    if (videoOverlay) videoOverlay.addEventListener('click', () => toggleVideoModal(false));

    const videoExternalBtn = document.getElementById('video-external-btn');
    if (videoExternalBtn) {
        videoExternalBtn.addEventListener('click', () => {
            if (isPlaying) {
                if (isAndroid()) Android.pause();
                else audio.pause();
                isPlaying = false;
                updateUIState(false);
            }
        });
    }

    // Listen to Firestore for Live Video Settings
    if (typeof db !== 'undefined' && db) {
        db.collection('settings').doc('live_video').onSnapshot(doc => {
            if (doc && doc.exists) {
                const data = doc.data();
                liveVideoState = {
                    isLive: !!data.isLive,
                    platform: data.platform || 'youtube',
                    videoId: data.videoId || '',
                    title: data.title || 'Transmisión en Vivo'
                };
                updateLiveVideoUI();
            }
        }, err => {
            console.warn('Firestore live_video listener warning:', err);
        });
    }

    // Admin Save Video Settings Handler
    const saveVideoSettingsBtn = document.getElementById('save-video-settings-btn');
    if (saveVideoSettingsBtn) {
        saveVideoSettingsBtn.addEventListener('click', () => {
            const isLive = (document.getElementById('admin-video-toggle')?.value === 'on');
            const platform = document.getElementById('admin-video-platform')?.value || 'youtube';
            const videoId = document.getElementById('admin-video-id')?.value.trim() || '';
            const title = document.getElementById('admin-video-title')?.value.trim() || 'Transmisión en Vivo';

            if (isLive && !videoId) {
                showToast('Ingresa el ID de YouTube o URL de Facebook');
                return;
            }

            if (typeof db !== 'undefined' && db && isAdmin) {
                db.collection('settings').doc('live_video').set({
                    isLive,
                    platform,
                    videoId,
                    title,
                    updatedAt: new Date().toISOString()
                }).then(() => {
                    showToast('Estado de video publicado en vivo 📹');
                }).catch(err => {
                    showToast('Error al publicar video: ' + err.message);
                });
            } else {
                showToast('Debes iniciar sesión como Admin');
            }
        });
    }

    function sendFcmPushToAllListeners(title, body, targetTab) {
        if (!firebaseConfig.fcmServerKey || firebaseConfig.fcmServerKey.includes('AQUI')) {
            showToast('📢 Solicitud guardada en Firestore. Pega tu fcmServerKey en firebase-config.js para envío masivo.');
            return;
        }

        const tab = targetTab || (title.includes('Versículo') ? 'bible' : '');

        const payload = {
            to: "/topics/all_listeners",
            priority: "high",
            notification: {
                title: title,
                body: body,
                sound: "default",
                android_channel_id: "radio_events_channel"
            },
            data: {
                title: title,
                body: body,
                target_tab: tab,
                type: tab === 'bible' ? 'verse' : 'event'
            }
        };

        fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + firebaseConfig.fcmServerKey
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            console.log('FCM push response:', data);
            showToast('📢 ¡Notificación push enviada a todos los celulares!');
        })
        .catch(err => {
            console.error('FCM push error:', err);
            showToast('Error al enviar FCM: ' + err.message);
        });
    }

    // Admin In-App Push Notification Sender
    const sendPushBtn = document.getElementById('send-push-btn');
    if (sendPushBtn) {
        sendPushBtn.addEventListener('click', () => {
            const title = document.getElementById('push-title')?.value.trim();
            const body = document.getElementById('push-body')?.value.trim();

            if (!title || !body) {
                showToast('Ingresa un título y mensaje para la notificación');
                return;
            }

            if (typeof db !== 'undefined' && db && isAdmin) {
                // Save to Firestore history
                db.collection('notification_requests').add({
                    title: title,
                    body: body,
                    topic: 'all_listeners',
                    sentBy: auth.currentUser ? auth.currentUser.email : 'admin',
                    createdAt: new Date().toISOString()
                });

                // Send FCM push directly
                sendFcmPushToAllListeners(title, body);

                if (document.getElementById('push-title')) document.getElementById('push-title').value = '';
                if (document.getElementById('push-body')) document.getElementById('push-body').value = '';
            } else {
                showToast('Debes iniciar sesión como Admin');
            }
        });
    }

    // Admin Verse Suggest Handler (30+ Promesas RVR1960)
    const adminVerseSuggestBtn = document.getElementById('admin-verse-suggest-btn');
    if (adminVerseSuggestBtn) {
        adminVerseSuggestBtn.addEventListener('click', () => {
            const refInput = document.getElementById('admin-verse-ref');
            const textInput = document.getElementById('admin-verse-text');

            const bibleBankRVR = [
                { ref: 'Filipenses 4:13', text: 'Todo lo puedo en Cristo que me fortalece.' },
                { ref: 'Juan 3:16', text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree no se pierda, mas tenga vida eterna.' },
                { ref: 'Salmos 23:1', text: 'El Señor es mi pastor; nada me faltará.' },
                { ref: 'Salmos 27:1', text: 'Jehová es mi luz y mi salvación; ¿de quién temeré? Jehová es la fortaleza de mi vida; ¿de quién he de atemorizarme?' },
                { ref: 'Josué 1:9', text: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.' },
                { ref: 'Jeremías 29:11', text: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.' },
                { ref: 'Proverbios 3:5-6', text: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas.' },
                { ref: 'Isaías 40:31', text: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.' },
                { ref: 'Romanos 8:28', text: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.' },
                { ref: 'Salmos 46:1', text: 'Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.' },
                { ref: 'Romanos 12:2', text: 'No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento, para que comprobéis cuál sea la buena voluntad de Dios, agradable y perfecta.' },
                { ref: 'Mateo 11:28', text: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.' },
                { ref: 'Salmos 121:1-2', text: 'Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová, Que hizo los cielos y la tierra.' },
                { ref: 'Isaías 41:10', text: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.' },
                { ref: 'Hebreos 11:1', text: 'Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.' },
                { ref: 'Proverbios 16:3', text: 'Encomienda a Jehová tus obras, y tus pensamientos serán afirmados.' },
                { ref: 'Salmos 91:1-2', text: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente. Diré yo a Jehová: Esperanza mía, y castillo mío; Mi Dios, en quien confiaré.' },
                { ref: '2 Timoteo 1:7', text: 'Porque no nos ha dado Dios espíritu de cobardía, sino de poder, de amor y de dominio propio.' },
                { ref: 'Santiago 1:5', text: 'Y si alguno de vosotros tiene falta de sabiduría, pídala a Dios, el cual da a todos abundantemente y sin reproche, y le será dada.' },
                { ref: 'Filipenses 4:6-7', text: 'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias. Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.' },
                { ref: 'Salmos 119:105', text: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.' },
                { ref: '1 Corintios 13:4-7', text: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece; no hace nada indebido, no busca lo suyo, no se irrita, no guarda rencor.' },
                { ref: 'Efesios 2:8-9', text: 'Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios; no por obras, para que nadie se gloríe.' },
                { ref: 'Mateo 6:33', text: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.' },
                { ref: 'Salmos 34:8', text: 'Gustad, y ved que es bueno Jehová; Dichoso el hombre que confía en él.' }
            ];

            showToast('Buscando versículo inspirador...');

            fetch('https://bible-api.com/?random=verse&translation=rv1960')
                .then(r => r.json())
                .then(data => {
                    if (data && data.text && data.reference) {
                        const cleanText = data.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                        if (refInput) refInput.value = data.reference;
                        if (textInput) textInput.value = cleanText;
                        showToast('🎲 Versículo sugerido cargado');
                    } else {
                        throw new Error('API vacía');
                    }
                })
                .catch(() => {
                    const randomItem = bibleBankRVR[Math.floor(Math.random() * bibleBankRVR.length)];
                    if (refInput) refInput.value = randomItem.ref;
                    if (textInput) textInput.value = randomItem.text;
                    showToast('🎲 Versículo sugerido cargado');
                });
        });
    }

    // Admin Verse Send Handler
    const adminVerseSendBtn = document.getElementById('admin-verse-send-btn');
    if (adminVerseSendBtn) {
        adminVerseSendBtn.addEventListener('click', () => {
            const ref = document.getElementById('admin-verse-ref')?.value.trim();
            const text = document.getElementById('admin-verse-text')?.value.trim();

            if (!ref || !text) {
                showToast('Ingresa la cita y el texto del versículo');
                return;
            }

            if (typeof db !== 'undefined' && db && isAdmin) {
                const title = `📖 Versículo del Día: ${ref}`;
                const body = text;

                // 1. Actualizar el documento unificado settings/daily_verse en Firestore
                db.collection('settings').doc('daily_verse').set({
                    ref: ref,
                    text: text,
                    title: title,
                    updatedAt: new Date().toISOString()
                });

                // 2. Guardar en el historial de solicitudes de aviso
                db.collection('notification_requests').add({
                    title: title,
                    body: body,
                    type: 'verse',
                    topic: 'all_listeners',
                    sentBy: auth.currentUser ? auth.currentUser.email : 'admin',
                    createdAt: new Date().toISOString()
                }).then(() => {
                    showToast('📖 ¡Versículo publicado y enviado a todos!');
                    if (document.getElementById('admin-verse-ref')) document.getElementById('admin-verse-ref').value = '';
                    if (document.getElementById('admin-verse-text')) document.getElementById('admin-verse-text').value = '';
                }).catch(err => {
                    showToast('Error al enviar: ' + err.message);
                });

                // 3. Despachar FCM Push a todos
                sendFcmPushToAllListeners(title, body, 'bible');
            } else {
                showToast('Debes iniciar sesión como Admin');
            }
        });
    }

    // Realtime Firestore Listener for Schedules
    if (typeof db !== 'undefined' && db) {
        db.collection('schedules').onSnapshot(snapshot => {
            snapshot.forEach(doc => {
                const category = doc.id;
                const data = doc.data();
                if (data && Array.isArray(data.programs)) {
                    SCHEDULE_DATA[category] = data.programs;
                }
            });
            renderSchedule(activeDayCategory);
        }, err => {
            console.warn('Firestore schedules listener warning:', err);
        });
    }

    const scheduleOverlay = document.getElementById('schedule-overlay');
    const scheduleModal = document.getElementById('schedule-modal');
    const scheduleTriggerBtn = document.getElementById('schedule-trigger-btn');
    const infoScheduleBtn = document.getElementById('info-schedule-btn');
    const scheduleClose = document.getElementById('schedule-close');
    const dayTabBtns = document.querySelectorAll('.day-tab-btn');

    function toggleScheduleModal(open) {
        if (!scheduleOverlay || !scheduleModal) return;
        const isOpen = open !== undefined ? open : !scheduleModal.classList.contains('active');
        scheduleOverlay.classList.toggle('active', isOpen);
        scheduleModal.classList.toggle('active', isOpen);
        if (isOpen) {
            activeDayCategory = getCurrentDayCategory();
            dayTabBtns.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-day') === activeDayCategory);
            });
            renderSchedule(activeDayCategory);
        }
    }

    const quickScheduleBtn = document.getElementById('quick-schedule-btn');
    if (quickScheduleBtn) quickScheduleBtn.addEventListener('click', () => toggleScheduleModal(true));

    if (scheduleTriggerBtn) scheduleTriggerBtn.addEventListener('click', () => toggleScheduleModal(true));
    if (infoScheduleBtn) infoScheduleBtn.addEventListener('click', () => toggleScheduleModal(true));
    if (scheduleClose) scheduleClose.addEventListener('click', () => toggleScheduleModal(false));
    if (scheduleOverlay) scheduleOverlay.addEventListener('click', () => toggleScheduleModal(false));

    dayTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dayTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeDayCategory = btn.getAttribute('data-day');
            renderSchedule(activeDayCategory);
        });
    });

    // --- Admin Login & Edit Modals Logic ---
    const infoAdminBtn = document.getElementById('info-admin-btn');
    const adminLoginOverlay = document.getElementById('admin-login-overlay');
    const adminLoginModal = document.getElementById('admin-login-modal');
    const adminLoginClose = document.getElementById('admin-login-close');
    const adminLoginSubmitBtn = document.getElementById('admin-login-submit-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const addProgramBtn = document.getElementById('add-program-btn');

    function toggleAdminLoginModal(open) {
        if (!adminLoginOverlay || !adminLoginModal) return;
        const isOpen = open !== undefined ? open : !adminLoginModal.classList.contains('active');
        adminLoginOverlay.classList.toggle('active', isOpen);
        adminLoginModal.classList.toggle('active', isOpen);
    }

    if (infoAdminBtn) infoAdminBtn.addEventListener('click', () => toggleAdminLoginModal(true));
    if (adminLoginClose) adminLoginClose.addEventListener('click', () => toggleAdminLoginModal(false));
    if (adminLoginOverlay) adminLoginOverlay.addEventListener('click', () => toggleAdminLoginModal(false));

    if (adminLoginSubmitBtn) {
        adminLoginSubmitBtn.addEventListener('click', () => {
            const email = document.getElementById('admin-email')?.value.trim();
            const password = document.getElementById('admin-password')?.value.trim();

            if (!email || !password) {
                showToast('Ingresa tu correo y contraseña');
                return;
            }

            if (typeof auth !== 'undefined' && auth) {
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => {
                        showToast('¡Sesión de Administrador iniciada! 🔓');
                        toggleAdminLoginModal(false);
                    })
                    .catch(err => {
                        showToast('Error de autenticación: ' + err.message);
                    });
            } else {
                showToast('Firebase Auth no está disponible. Revisa firebase-config.js');
            }
        });
    }

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            if (typeof auth !== 'undefined' && auth) {
                auth.signOut().then(() => {
                    showToast('Sesión de Administrador cerrada');
                    toggleAdminLoginModal(false);
                });
            }
        });
    }

    // Edit Program Modal Logic
    let editingIndex = -1;

    function openEditProgramModal(index = -1) {
        editingIndex = index;
        const overlay = document.getElementById('edit-program-overlay');
        const modal = document.getElementById('edit-program-modal');
        const titleEl = document.getElementById('edit-program-title');
        const startInput = document.getElementById('prog-start');
        const endInput = document.getElementById('prog-end');
        const nameInput = document.getElementById('prog-name');
        const hostInput = document.getElementById('prog-host');
        const iconSelect = document.getElementById('prog-icon');

        if (index >= 0 && SCHEDULE_DATA[activeDayCategory][index]) {
            const prog = SCHEDULE_DATA[activeDayCategory][index];
            if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen-to-square"></i> Editar Programa';
            if (startInput) startInput.value = prog.start || '';
            if (endInput) endInput.value = prog.end || '';
            if (nameInput) nameInput.value = prog.name || '';
            if (hostInput) hostInput.value = prog.host || '';
            if (iconSelect) iconSelect.value = prog.icon || 'fa-radio';
        } else {
            if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus"></i> Agregar Programa';
            if (startInput) startInput.value = '06:00';
            if (endInput) endInput.value = '08:00';
            if (nameInput) nameInput.value = '';
            if (hostInput) hostInput.value = '';
            if (iconSelect) iconSelect.value = 'fa-radio';
        }

        if (overlay && modal) {
            overlay.classList.add('active');
            modal.classList.add('active');
        }
    }

    function closeEditProgramModal() {
        const overlay = document.getElementById('edit-program-overlay');
        const modal = document.getElementById('edit-program-modal');
        if (overlay && modal) {
            overlay.classList.remove('active');
            modal.classList.remove('active');
        }
    }

    const editProgramClose = document.getElementById('edit-program-close');
    const editProgramOverlay = document.getElementById('edit-program-overlay');
    const saveProgramBtn = document.getElementById('save-program-btn');

    if (addProgramBtn) addProgramBtn.addEventListener('click', () => openEditProgramModal(-1));
    if (editProgramClose) editProgramClose.addEventListener('click', closeEditProgramModal);
    if (editProgramOverlay) editProgramOverlay.addEventListener('click', closeEditProgramModal);

    if (saveProgramBtn) {
        saveProgramBtn.addEventListener('click', () => {
            const start = document.getElementById('prog-start')?.value.trim() || '00:00';
            const end = document.getElementById('prog-end')?.value.trim() || '00:00';
            const name = document.getElementById('prog-name')?.value.trim();
            const host = document.getElementById('prog-host')?.value.trim() || '';
            const icon = document.getElementById('prog-icon')?.value || 'fa-radio';

            if (!name) {
                showToast('Ingresa el nombre del programa');
                return;
            }

            const newProg = { start, end, name, host, icon };
            if (!SCHEDULE_DATA[activeDayCategory]) SCHEDULE_DATA[activeDayCategory] = [];

            if (editingIndex >= 0) {
                SCHEDULE_DATA[activeDayCategory][editingIndex] = newProg;
            } else {
                SCHEDULE_DATA[activeDayCategory].push(newProg);
            }

            renderSchedule(activeDayCategory);

            if (typeof db !== 'undefined' && db && isAdmin) {
                db.collection('schedules').doc(activeDayCategory).set({
                    programs: SCHEDULE_DATA[activeDayCategory]
                }).then(() => {
                    showToast('Programación guardada en Firestore ☁️');
                }).catch(err => {
                    showToast('Error al guardar: ' + err.message);
                });
            } else {
                showToast('Programa actualizado localmente');
            }

            closeEditProgramModal();
        });
    }

    function deleteProgram(index) {
        if (!SCHEDULE_DATA[activeDayCategory] || index < 0) return;
        SCHEDULE_DATA[activeDayCategory].splice(index, 1);
        renderSchedule(activeDayCategory);

        if (typeof db !== 'undefined' && db && isAdmin) {
            db.collection('schedules').doc(activeDayCategory).set({
                programs: SCHEDULE_DATA[activeDayCategory]
            }).then(() => {
                showToast('Programa eliminado de Firestore ☁️');
            }).catch(err => {
                showToast('Error al eliminar: ' + err.message);
            });
        }
    }

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

        update(audioAmplitude = 0) {
            // Stars react to loud bass hits slightly increasing speed
            this.x += this.speedX * (1 + audioAmplitude * 2);
            this.y += this.speedY * (1 + audioAmplitude * 2);

            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;

            this.brightness += (Math.random() - 0.5) * 0.1;
            if (this.brightness > 1) this.brightness = 1;
            if (this.brightness < 0) this.brightness = 0;
        }

        draw(audioAmplitude = 0) {
            // Increase star brightness slightly with audio peaks
            const finalBrightness = Math.min(1.0, this.brightness + audioAmplitude * 0.5);
            ctx.fillStyle = `rgba(255, 255, 255, ${finalBrightness})`;
            ctx.beginPath();
            const finalSize = this.size + (audioAmplitude * 1.5);
            ctx.arc(this.x, this.y, finalSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < numStars; i++) {
            stars.push(new Star());
        }
    }

    // Global audio amplitude state variable shared between visualizers and stars
    let globalAudioAmplitude = 0.0;

    function animateStars() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(star => {
            star.update(globalAudioAmplitude);
            star.draw(globalAudioAmplitude);
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

    // --- Quad-Mode Spectrum Visualizer (Barras 3D, Cápsulas, Onda Polar, Osciloscopio 3D) ---
    const visCanvas = document.getElementById('visualizer-canvas');
    const visCtx = visCanvas ? visCanvas.getContext('2d') : null;
    const visModeBtn = document.getElementById('vis-mode-btn');

    let visMode = 0; // 0: Barras 3D, 1: Cápsulas Simétricas, 2: Onda Polar, 3: Osciloscopio 3D
    const TOTAL_BARS = 32;
    let currentFft = new Array(TOTAL_BARS).fill(0);

    if (visModeBtn) {
        visModeBtn.addEventListener('click', () => {
            visMode = (visMode + 1) % 4;
            if (visMode === 0) {
                visModeBtn.innerHTML = '<i class="fas fa-chart-simple"></i>';
                showToast('Modo: Barras 3D Neón 📊');
            } else if (visMode === 1) {
                visModeBtn.innerHTML = '<i class="fas fa-capsules"></i>';
                showToast('Modo: Cápsulas Simétricas 💊');
            } else if (visMode === 2) {
                visModeBtn.innerHTML = '<i class="fas fa-circle-notch"></i>';
                showToast('Modo: Onda Circular Polar ⭕');
            } else {
                visModeBtn.innerHTML = '<i class="fas fa-wave-square"></i>';
                showToast('Modo: Osciloscopio 3D Holográfico 〰️');
            }
        });
    }

    function fetchRealBands() {
        if (typeof Android !== 'undefined' && Android !== null && Android.getFftData) {
            try {
                const raw = Android.getFftData();
                if (raw && raw.startsWith('[')) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length >= TOTAL_BARS) {
                        return parsed;
                    }
                }
            } catch (e) {}
        }
        return null;
    }

    function drawSpectrum() {
        if (!visCanvas || !visCtx) return;
        requestAnimationFrame(drawSpectrum);

        const width = visCanvas.width;
        const height = visCanvas.height;

        visCtx.clearRect(0, 0, width, height);

        const t = performance.now() * 0.0035;
        const realBands = isPlaying ? fetchRealBands() : null;

        // Calculate global average for starfield reactivity
        if (realBands) {
            globalAudioAmplitude = realBands.reduce((a, b) => a + b, 0) / TOTAL_BARS;
        } else if (isPlaying) {
            globalAudioAmplitude = 0.5 + Math.sin(t * 2) * 0.3;
        } else {
            globalAudioAmplitude = 0;
        }

        for (let i = 0; i < TOTAL_BARS; i++) {
            let target = 0.0;

            if (isPlaying) {
                if (realBands) {
                    // Nativo Android Kotlin ExoPlayer
                    target = Math.min(1.0, (realBands[i] || 0.0) * 1.35);
                } else {
                    // Web Browser / PWA Audio-Reactive Rhythm Wave
                    const kick = Math.pow(Math.sin(t * 2.2), 4) * 0.45;
                    const bassLine = Math.sin(t * 1.8 + i * 0.25) * 0.25;
                    const vocalWave = Math.sin(t * 4.1 - i * 0.35) * 0.22;
                    const voicePresence = Math.cos(t * 2.8 + i * 0.15) * 0.18;
                    const hiHat = Math.sin(t * 6.5 + i * 0.6) * 0.14;
                    const freqWeight = 1.0 - Math.pow((i - 10) / TOTAL_BARS, 2) * 0.45;

                    target = Math.min(0.92, Math.max(0.08, (0.28 + kick + bassLine + vocalWave + voicePresence + hiHat) * freqWeight));
                }
            } else {
                target = 0.0;
            }

            // Lerp de reacción física: subida ágil al golpe de batería (0.50), caída suave con inercia (0.15)
            const factor = target > currentFft[i] ? 0.50 : 0.15;
            currentFft[i] += (target - currentFft[i]) * factor;
        }

        if (visMode === 1) {
            drawSymmetricAudiogramBars(visCtx, width, height, currentFft);
        } else if (visMode === 2) {
            drawPolarCircularWave(visCtx, width, height, currentFft);
        } else if (visMode === 3) {
            drawWaveformOscilloscope(visCtx, width, height, currentFft, t);
        } else {
            drawFrequencyBars3D(visCtx, width, height, currentFft);
        }
    }

    // Modo 0: Barras de Frecuencia Verticales Multicapa 3D Neón
    function drawFrequencyBars3D(ctx, width, height, fft) {
        const barCount = 32;
        const gap = 3;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);
        const radius = Math.min(barWidth / 2, 3);

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(235, 50, 180, 0.5)";

        let xBg = 0;
        for (let i = 0; i < barCount; i++) {
            const val = fft[i] || 0;
            const barHeight = Math.max(2, val * height * 0.72);
            const y = height - barHeight;

            const bgGrad = ctx.createLinearGradient(0, height, 0, y);
            bgGrad.addColorStop(0, "rgba(235, 50, 180, 0.05)");
            bgGrad.addColorStop(1, "rgba(235, 50, 180, 0.55)");

            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(xBg - 1, y, barWidth + 2, barHeight, [radius, radius, 0, 0]);
            } else {
                ctx.rect(xBg - 1, y, barWidth + 2, barHeight);
            }
            ctx.fill();

            xBg += barWidth + gap;
        }
        ctx.restore();

        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(252, 173, 4, 0.85)";

        let xFg = 0;
        for (let i = 0; i < barCount; i++) {
            const val = fft[i] || 0;
            const barHeight = Math.max(3, val * height * 0.88);
            const y = height - barHeight;

            const fgGrad = ctx.createLinearGradient(0, height, 0, y);
            fgGrad.addColorStop(0, "rgba(252, 173, 4, 0.2)");
            fgGrad.addColorStop(0.5, "#FCAD04");
            fgGrad.addColorStop(1, "#FFFFFF");

            ctx.fillStyle = fgGrad;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(xFg, y, barWidth, barHeight, [radius, radius, 0, 0]);
            } else {
                ctx.rect(xFg, y, barWidth, barHeight);
            }
            ctx.fill();

            xFg += barWidth + gap;
        }
        ctx.restore();
    }

    // Modo 1: Barras Tipo Cápsula Simétricas (Arriba y Abajo)
    function drawSymmetricAudiogramBars(ctx, width, height, fft) {
        const numBars = 36;
        const barGap = 4;
        const centralGap = 3;
        const centerY = height / 2;
        const totalBarWidth = Math.max(3, (width - (numBars + 1) * barGap) / numBars);
        const radius = totalBarWidth / 2;
        const minCapHeight = totalBarWidth;

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(252, 173, 4, 0.75)";

        for (let i = 0; i < numBars; i++) {
            const distFromCenter = Math.abs(i - (numBars / 2)) / (numBars / 2);
            const fftIndex = Math.floor(distFromCenter * 31);
            const rawAmp = fft[fftIndex] || 0;

            const edgeDamping = 1 - Math.pow(distFromCenter, 1.6);
            const target = rawAmp * Math.max(0.05, edgeDamping);

            const halfHeight = Math.max(minCapHeight, target * (height * 0.42));
            const x = barGap + i * (totalBarWidth + barGap);

            const totalTop = centerY - centralGap - halfHeight;
            const totalBottom = centerY + centralGap + halfHeight;

            const gradient = ctx.createLinearGradient(0, totalTop, 0, totalBottom);
            gradient.addColorStop(0.0, "#00f2fe");
            gradient.addColorStop(0.35, "#FCAD04");
            gradient.addColorStop(0.65, "#e024c3");
            gradient.addColorStop(1.0, "#00f2fe");

            ctx.fillStyle = gradient;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, centerY - centralGap - halfHeight, totalBarWidth, halfHeight, radius);
            } else {
                ctx.rect(x, centerY - centralGap - halfHeight, totalBarWidth, halfHeight);
            }
            ctx.fill();

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, centerY + centralGap, totalBarWidth, halfHeight, radius);
            } else {
                ctx.rect(x, centerY + centralGap, totalBarWidth, halfHeight);
            }
            ctx.fill();
        }

        ctx.restore();
    }

    // Modo B: Onda Circular Polar (Halo Reactivo)
    function drawPolarCircularWave(ctx, width, height, fft) {
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.28;
        const pointCount = fft.length;
        const angleStep = (Math.PI * 2) / pointCount;

        const avgVol = fft.reduce((a, b) => a + b, 0) / pointCount;

        // Glow central pulsante
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * (1.0 + avgVol * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(252, 173, 4, ${0.12 + avgVol * 0.25})`;
        ctx.fill();
        ctx.restore();

        // Trazo polar reactivo
        ctx.beginPath();
        for (let i = 0; i <= pointCount; i++) {
            const idx = i % pointCount;
            const angle = i * angleStep - (Math.PI / 2);
            const amp = fft[idx] || 0;
            const r = baseRadius + (amp * baseRadius * 0.75);

            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius * 1.8);
        grad.addColorStop(0, "#FCAD04");
        grad.addColorStop(1, "#FFFFFF");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(252, 173, 4, 0.6)";
        ctx.shadowBlur = 10;
        ctx.stroke();
    }

    // Modo C: Osciloscopio Multicapa 3D Holográfico (Smoothstep + Bézier)
    function drawWaveformOscilloscope(ctx, width, height, fft, t) {
        const centerY = height / 2;
        const bufferLength = 100;
        const sliceWidth = width / bufferLength;
        const avgVol = fft.reduce((a, b) => a + b, 0) / fft.length;

        // Definición de las 3 Capas 3D de Onda (Fondo -> Medio -> Frente)
        const layers = [
            {
                color: "rgba(255, 140, 20, 0.75)", // Capa Trasera: Naranja / Ámbar Cálido
                glowColor: "rgba(255, 110, 0, 0.4)",
                glowBlur: 8,
                lineWidth: 2.2,
                ampScale: 0.65,
                speed: -1.8,
                phaseOffset: 1.2,
                freqScale: 0.8
            },
            {
                color: "rgba(235, 50, 180, 0.85)", // Capa Media: Magenta / Púrpura Neón
                glowColor: "rgba(220, 30, 170, 0.5)",
                glowBlur: 10,
                lineWidth: 2.8,
                ampScale: 0.85,
                speed: 2.6,
                phaseOffset: 2.4,
                freqScale: 1.1
            },
            {
                color: "#FCAD04", // Capa Frontal: Dorado Oficial Sonido Celestial
                glowColor: "rgba(252, 173, 4, 0.9)",
                glowBlur: 16,
                lineWidth: 3.5,
                ampScale: 1.0,
                speed: 3.8,
                phaseOffset: 0.0,
                freqScale: 1.0
            }
        ];

        layers.forEach(layer => {
            ctx.save();
            ctx.lineWidth = layer.lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.strokeStyle = layer.color;
            ctx.shadowColor = layer.glowColor;
            ctx.shadowBlur = layer.glowBlur;

            const points = [];

            for (let i = 0; i <= bufferLength; i++) {
                const x = i * sliceWidth;
                let y = centerY;

                if (isPlaying && avgVol > 0.01) {
                    // Distancia normalizada al centro (0.0 en centro, 1.0 en extremos)
                    const d = Math.abs(i - bufferLength / 2) / (bufferLength / 2);

                    // Ventana Hermite Smoothstep para anclar suavemente a cero en los bordes
                    const edgeDamping = 1.0 - (d * d * (3.0 - 2.0 * d));

                    // Mapeo espectral a las 32 bandas reales del FFT
                    const fftIndex = Math.floor(d * 31);
                    const amp = fft[fftIndex] || 0;

                    // Portadora modulada con parámetros específicos de cada capa
                    const carrier1 = Math.sin((i * 0.35 * layer.freqScale) + (t * layer.speed) + layer.phaseOffset);
                    const carrier2 = Math.cos((i * 0.18 * layer.freqScale) - (t * 1.5) + layer.phaseOffset);
                    const wave = (carrier1 * 0.7 + carrier2 * 0.3) * amp * 1.5;

                    y = centerY + (wave * (height * 0.42) * layer.ampScale * edgeDamping);
                }

                points.push({ x, y });
            }

            // Trazado de curva fluida Bézier Cuadrática por cada capa
            ctx.beginPath();
            if (points.length > 0) {
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 0; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            }

            ctx.stroke();
            ctx.restore();
        });
    }

    function resizeVisCanvas() {
        if (!visCanvas) return;
        visCanvas.width = visCanvas.clientWidth || 300;
        visCanvas.height = visCanvas.clientHeight || 135;
    }

    if (visCanvas) {
        window.addEventListener('resize', resizeVisCanvas);
        resizeVisCanvas();
        drawSpectrum();
    }

    // --- Share App Button Handler (Google Play Store Direct Link) ---
    const shareAppBtn = document.getElementById('share-app-btn');
    if (shareAppBtn) {
        shareAppBtn.addEventListener('click', () => {
            const shareTitle = 'Radio Sonido Celestial 📻✨';
            const shareText = '¡Descarga e instala la app oficial de Radio Sonido Celestial en Google Play Store!';
            const shareUrl = 'https://play.google.com/store/apps/details?id=com.sonidocelestial.radio';

            if (navigator.share) {
                navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl
                }).then(() => {
                    showToast('¡Gracias por compartir nuestra app de Google Play! 🙏');
                }).catch(() => {});
            } else {
                const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
                window.open(waUrl, '_blank');
            }
        });
    }

    // --- Toast Notification Feedback ---
    const toastEl = document.getElementById('toast-notification');
    let toastTimer = null;

    function showToast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('active');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('active');
        }, 2800);
    }

    // --- Mute / Unmute Quick Toggle ---
    const volumeIcon = document.querySelector('.volume-row i:first-child');
    let previousVolume = 0.8;

    if (volumeIcon) {
        volumeIcon.style.cursor = 'pointer';
        volumeIcon.addEventListener('click', () => {
            if (audio.volume > 0) {
                previousVolume = audio.volume;
                audio.volume = 0;
                volumeSlider.value = 0;
                debouncedSetVolume(0);
                showToast('Audio silenciado 🔇');
            } else {
                audio.volume = previousVolume > 0 ? previousVolume : 0.8;
                volumeSlider.value = audio.volume;
                debouncedSetVolume(audio.volume);
                showToast('Audio restaurado 🔊');
            }
        });
    }

    // --- Sleep Timer ---
    const sleepBtn = document.getElementById('sleep-btn');
    const sleepBadge = document.getElementById('sleep-badge');
    const sleepOverlay = document.getElementById('sleep-overlay');
    const sleepModal = document.getElementById('sleep-modal');
    const sleepClose = document.getElementById('sleep-close');
    const sleepStatus = document.getElementById('sleep-status');
    const sleepCountdownEl = document.getElementById('sleep-countdown');
    const sleepCancelBtn = document.getElementById('sleep-cancel-btn');
    const sleepOptionBtns = document.querySelectorAll('.sleep-option-card, .sleep-option-btn');

    let sleepTimerInterval = null;
    let sleepTargetTime = null;

    function toggleSleepModal(open) {
        if (!sleepOverlay || !sleepModal) return;
        const isOpen = open !== undefined ? open : !sleepModal.classList.contains('active');
        sleepOverlay.classList.toggle('active', isOpen);
        sleepModal.classList.toggle('active', isOpen);
    }

    function cancelSleepTimer() {
        if (sleepTimerInterval) {
            clearInterval(sleepTimerInterval);
            sleepTimerInterval = null;
        }
        sleepTargetTime = null;
        if (sleepBadge) {
            sleepBadge.style.display = 'none';
            sleepBadge.textContent = '';
        }
        if (sleepBtn) sleepBtn.classList.remove('active');
        if (sleepStatus) sleepStatus.style.display = 'none';
    }

    function startSleepTimer(minutes) {
        cancelSleepTimer();
        const durationMs = minutes * 60 * 1000;
        sleepTargetTime = Date.now() + durationMs;

        if (sleepBtn) sleepBtn.classList.add('active');
        if (sleepStatus) sleepStatus.style.display = 'block';

        function updateCountdown() {
            const remainingMs = sleepTargetTime - Date.now();
            if (remainingMs <= 0) {
                cancelSleepTimer();
                if (isPlaying) {
                    togglePlay();
                }
                showToast('Radio apagada automáticamente por el temporizador 😴');
                toggleSleepModal(false);
                return;
            }

            const totalSecs = Math.ceil(remainingMs / 1000);
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (sleepCountdownEl) sleepCountdownEl.textContent = formatted;
            if (sleepBadge) {
                sleepBadge.style.display = 'flex';
                sleepBadge.textContent = `${mins}m`;
            }
        }

        updateCountdown();
        sleepTimerInterval = setInterval(updateCountdown, 1000);
        showToast(`Temporizador activado: ${minutes} minutos 🌙`);
        toggleSleepModal(false);
    }

    if (sleepBtn) sleepBtn.addEventListener('click', () => toggleSleepModal(true));
    if (sleepClose) sleepClose.addEventListener('click', () => toggleSleepModal(false));
    if (sleepOverlay) sleepOverlay.addEventListener('click', () => toggleSleepModal(false));
    if (sleepCancelBtn) {
        sleepCancelBtn.addEventListener('click', () => {
            cancelSleepTimer();
            showToast('Temporizador desactivado');
            toggleSleepModal(false);
        });
    }

    sleepOptionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mins = parseInt(btn.getAttribute('data-minutes'), 10);
            if (mins > 0) startSleepTimer(mins);
        });
    });

    // --- Versículo del Día (API externa + fallback local) + Acciones ---
    const copyVerseBtn = document.getElementById('copy-verse-btn');
    const shareVerseBtn = document.getElementById('share-verse-btn');

    if (copyVerseBtn) {
        copyVerseBtn.addEventListener('click', () => {
            const verseText = document.querySelector('.bible-verse-text')?.textContent || '';
            const verseRef = document.querySelector('.bible-verse-ref')?.textContent || '';
            const fullText = `${verseText} — ${verseRef}\n\nEscucha Radio Sonido Celestial: https://reibeiro.github.io/SONIDO_CELESTIAL/`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(fullText).then(() => {
                    showToast('¡Versículo copiado al portapapeles! 📋');
                }).catch(() => {
                    showToast('¡Versículo copiado! 📋');
                });
            } else {
                showToast('¡Versículo listo! 📋');
            }
        });
    }

    if (shareVerseBtn) {
        shareVerseBtn.addEventListener('click', () => {
            const verseText = document.querySelector('.bible-verse-text')?.textContent || '';
            const verseRef = document.querySelector('.bible-verse-ref')?.textContent || '';
            const shareMsg = `*Versículo del Día - Radio Sonido Celestial* 📖✨\n\n${verseText}\n— *${verseRef}*\n\nEscucha la radio en vivo aquí: https://reibeiro.github.io/SONIDO_CELESTIAL/`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMsg)}`;
            window.open(waUrl, '_blank');
        });
    }

    // --- Versículo del Día Sincronizado (Firestore Realtime + API RVR1960) ---
    (function() {
        var elText = document.querySelector('.bible-verse-text');
        var elRef = document.querySelector('.bible-verse-ref');
        if (!elText || !elRef) return;

        // 1. Escuchar Firestore para mantener la pestaña Biblia 100% sincronizada con las notificaciones
        if (typeof db !== 'undefined' && db) {
            db.collection('settings').doc('daily_verse').onSnapshot(function(doc) {
                if (doc && doc.exists) {
                    var data = doc.data();
                    if (data && data.text && data.ref) {
                        elText.textContent = '\u201C' + data.text + '\u201D';
                        elRef.textContent = data.ref;
                    }
                }
            }, function(err) {
                console.warn('Daily verse listener notice:', err);
            });
        }

        // 2. Carga inicial por defecto si Firestore aún no tiene documento
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

        // 3. Consulta a la API pública RVR1960 en vivo
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
