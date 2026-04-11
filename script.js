    var BASE = 'https://api.jikan.moe/v4';

    var grid = document.getElementById('animeGrid');
    var loader = document.getElementById('loader');
    var errorBox = document.getElementById('errorBox');
    var errorMsg = document.getElementById('errorMsg');
    var resultsLabel = document.getElementById('resultsLabel');
    var resultsCount = document.getElementById('resultsCount');
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    var modalOverlay = document.getElementById('modalOverlay');
    var modalInner = document.getElementById('modalInner');
    var modalClose = document.getElementById('modalClose');
    var stripBtns = document.querySelectorAll('.strip-btn');
    var quickTags = document.querySelectorAll('.quick-tag');

    var lastFetch = null;
    var requestQueue = [];
    var isProcessing = false;

    function sleep(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    function apiRequest(url) {
        return new Promise(function(resolve, reject) {
            requestQueue.push({ url: url, resolve: resolve, reject: reject });
            if (!isProcessing) processQueue();
        });
    }

    async function processQueue() {
        isProcessing = true;

        while (requestQueue.length) {
            var item = requestQueue.shift();

            try {
                var res = await fetch(item.url);
                if (!res.ok) throw new Error('HTTP ' + res.status);

                var data = await res.json();
                item.resolve(data);
            } catch (err) {
                item.reject(err);
            }

            if (requestQueue.length) await sleep(400);
        }

        isProcessing = false;
    }

    async function fetchTop() {
        var data = await apiRequest(BASE + '/top/anime?limit=24');
        return {
            items: data.data,
            label: 'TOP ANIME',
            total: data.pagination?.items?.total || null
        };
    }

    async function fetchSeason() {
        var data = await apiRequest(BASE + '/seasons/now?limit=24');
        return {
            items: data.data,
            label: 'THIS SEASON',
            total: data.pagination?.items?.total || null
        };
    }

    async function fetchUpcoming() {
        var data = await apiRequest(BASE + '/seasons/upcoming?limit=24');
        return {
            items: data.data,
            label: 'UPCOMING',
            total: data.pagination?.items?.total || null
        };
    }

    async function fetchMovies() {
        var data = await apiRequest(BASE + '/top/anime?type=movie&limit=24');
        return {
            items: data.data,
            label: 'MOVIES',
            total: data.pagination?.items?.total || null
        };
    }

    async function fetchSearch(q) {
        var data = await apiRequest(BASE + '/anime?q=' + encodeURIComponent(q) + '&limit=24&sfw=true');
        return {
            items: data.data,
            label: '"' + q.toUpperCase() + '"',
            total: data.pagination?.items?.total || null
        };
    }

    async function fetchAnimeDetail(id) {
        var data = await apiRequest(BASE + '/anime/' + id + '/full');
        return data.data;
    }

    function escHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showLoader() {
        grid.innerHTML = '';
        loader.style.display = 'flex';
        errorBox.style.display = 'none';
    }

    function hideLoader() {
        loader.style.display = 'none';
    }

    function showError(msg) {
        hideLoader();
        errorBox.style.display = 'block';
        errorMsg.textContent = msg;
    }

    function buildCard(anime, rank) {
        var card = document.createElement('div');
        card.className = 'anime-card';
        card.style.animationDelay = (Math.min(rank - 1, 12) * 40) + 'ms';

        var img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
        var score = anime.score ? anime.score.toFixed(1) : null;

        var episodes = anime.episodes
            ? anime.episodes + ' ep'
            : (anime.status === 'Currently Airing' ? 'Airing' : '?');

        var year = anime.year || '';
        if (!year && anime.aired?.from) year = new Date(anime.aired.from).getFullYear();

        var type = anime.type || '';

        var html = '<div class="card-poster">';
        html += '<img src="' + img + '" alt="' + escHtml(anime.title) + '" loading="lazy" onerror="this.src=\'https://placehold.co/200x300/181515/7a7370?text=No+Image\'">';
        if (score) html += '<span class="card-score">&#9733; ' + score + '</span>';
        html += '<span class="card-rank">#' + rank + '</span>';
        if (type) html += '<span class="card-type-badge">' + type + '</span>';
        html += '</div>';

        html += '<div class="card-body">';
        html += '<div class="card-title">' + escHtml(anime.title) + '</div>';
        html += '<div class="card-meta">';
        if (year) html += '<span>' + year + '</span>';
        if (episodes) html += '<span>' + episodes + '</span>';
        html += '</div></div>';

        card.innerHTML = html;

        card.addEventListener('click', function() {
            openModal(anime.mal_id);
        });

        return card;
    }

    function renderGrid(items, label, total) {
        hideLoader();
        grid.innerHTML = '';

        resultsLabel.textContent = label;
        resultsCount.textContent = total ? total.toLocaleString() + ' series' : items.length + ' results';

        if (!items || items.length === 0) {
            grid.innerHTML = '<p style="color:#7a7370;font-size:.85rem;grid-column:1/-1;padding:2rem 0;">No results found.</p>';
            return;
        }

        items.forEach(function(anime, i) {
            grid.appendChild(buildCard(anime, i + 1));
        });
    }

    async function openModal(id) {
        modalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        modalInner.innerHTML =
            '<div style="padding:4rem;text-align:center;color:#7a7370;">' +
            '<div class="loader-ring" style="margin:0 auto 1rem;"></div>' +
            '<span style="font-family:JetBrains Mono,monospace;font-size:.75rem;">Loading...</span>' +
            '</div>';

        try {
            var anime = await fetchAnimeDetail(id);
            renderModal(anime);
        } catch (err) {
            modalInner.innerHTML = '<div style="padding:3rem;text-align:center;color:#7a7370;">Failed to load details.</div>';
        }
    }

    function renderModal(anime) {
        var img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';

        var score = anime.score ? anime.score.toFixed(2) : '-';
        var scoredBy = anime.scored_by ? anime.scored_by.toLocaleString() : '-';
        var rank = anime.rank ? '#' + anime.rank : '-';
        var pop = anime.popularity ? '#' + anime.popularity : '-';
        var eps = anime.episodes || '?';
        var dur = anime.duration || '-';
        var status = anime.status || '-';
        var aired = anime.aired?.string || '-';

        var studio = '-';
        if (anime.studios && anime.studios.length) {
            studio = anime.studios.map(function(s) { return s.name; }).join(', ');
        }

        var genres = anime.genres || [];
        var synopsis = anime.synopsis
            ? anime.synopsis.replace('[Written by MAL Rewrite]', '').trim()
            : 'No synopsis available.';

        var trailer = anime.trailer?.embed_url || null;
        var titleJp = anime.title_japanese || '';

        var html = '<div class="modal-hero">';
        html += '<div class="modal-poster"><img src="' + img + '" alt="' + escHtml(anime.title) + '" onerror="this.src=\'https://placehold.co/200x300/181515/7a7370?text=No+Image\'"></div>';

        html += '<div class="modal-info">';
        html += '<div><div class="modal-title">' + escHtml(anime.title) + '</div>';
        if (titleJp) html += '<div class="modal-title-jp">' + escHtml(titleJp) + '</div>';
        html += '</div>';

        html += '<div class="modal-score-row">';
        html += '<div class="modal-score-big">&#9733; ' + score + '</div>';
        html += '<div class="modal-score-sub">scored by<br><strong>' + scoredBy + '</strong> users</div>';
        html += '</div>';

        html += '<div class="modal-stats">';
        html += '<div class="stat-pill"><strong>' + rank + '</strong>Rank</div>';
        html += '<div class="stat-pill"><strong>' + pop + '</strong>Popularity</div>';
        html += '<div class="stat-pill"><strong>' + eps + '</strong>Episodes</div>';
        html += '<div class="stat-pill"><strong>' + (anime.type || '-') + '</strong>Type</div>';
        html += '<div class="stat-pill"><strong>' + status + '</strong>Status</div>';
        html += '<div class="stat-pill"><strong>' + dur + '</strong>Duration</div>';
        html += '<div class="stat-pill"><strong>' + studio + '</strong>Studio</div>';
        html += '<div class="stat-pill"><strong>' + aired + '</strong>Aired</div>';
        html += '</div>';

        if (genres.length) {
            html += '<div class="modal-genres">';
            genres.forEach(function(g) {
                html += '<span class="genre-tag">' + escHtml(g.name) + '</span>';
            });
            html += '</div>';
        }

        html += '</div></div>';
        html += '<div class="modal-Overview"><h3>OVERVIEW</h3><p>' + escHtml(synopsis) + '</p></div>';

        if (trailer) {
            html += '<div class="modal-trailer"><h3>TRAILER</h3>';
            html += '<div class="trailer-embed"><iframe src="' + trailer + ' encrypted-media"></iframe></div>';
            html += '</div>';
        }

        modalInner.innerHTML = html;
    }

    function closeModal() {
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';

        var frame = modalInner.querySelector('iframe');
        if (frame) frame.src = frame.src;
    }

    async function load(fetchFn) {
        lastFetch = fetchFn;
        showLoader();

        try {
            var result = await fetchFn();
            renderGrid(result.items, result.label, result.total);
        } catch (err) {
            showError('Failed to load. ' + (err.message || ''));
        }
    }

    function retryLast() {
        if (lastFetch) load(lastFetch);
    }

    stripBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            stripBtns.forEach(function(b) {
                b.classList.remove('active');
            });

            btn.classList.add('active');
            searchInput.value = '';

            var action = btn.dataset.action;

            if (action === 'top') load(fetchTop);
            if (action === 'season') load(fetchSeason);
            if (action === 'upcoming') load(fetchUpcoming);
            if (action === 'movie') load(fetchMovies);
        });
    });

    function doSearch() {
        var q = searchInput.value.trim();
        if (!q) return;

        stripBtns.forEach(function(b) {
            b.classList.remove('active');
        });

        load(function() {
            return fetchSearch(q);
        });
    }

    searchBtn.addEventListener('click', doSearch);

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch();
    });

    quickTags.forEach(function(tag) {
        tag.addEventListener('click', function() {
            searchInput.value = tag.dataset.q;
            doSearch();
        });
    });

    modalClose.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    load(fetchTop);