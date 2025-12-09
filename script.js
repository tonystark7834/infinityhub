const API_KEY = '5ce5757f935d78afac8d5761ab7daeae'; // Your TMDB API key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

let page = 1;
let isLoading = false;
let allMovies = [];
let filteredMovies = [];
let currentCategory = 'popular'; // Default category
let genres = [];
let isSearching = false; // Flag for search mode
let watchlist = JSON.parse(localStorage.getItem('infinityHubWatchlist')) || [];

const movieContainer = document.getElementById('movie-container');
const searchBar = document.getElementById('search-bar');
const loadingSpinner = document.getElementById('loading-spinner');
const popularBtn = document.getElementById('popular-btn');
const topRatedBtn = document.getElementById('top-rated-btn');
const genreSelect = document.getElementById('genre-select');
const trailerModal = document.getElementById('trailer-modal');
const trailerIframe = document.getElementById('trailer-iframe');
const closeModal = document.getElementById('close-modal');
const watchlistModal = document.getElementById('watchlist-modal');
const watchlistContainer = document.getElementById('watchlist-container');
const closeWatchlist = document.getElementById('close-watchlist');
const homeLink = document.getElementById('home-link');
const watchlistLink = document.getElementById('watchlist-link');

// Fetch genres
async function fetchGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
        const data = await response.json();
        genres = data.genres;
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.id;
            option.textContent = genre.name;
            genreSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching genres:', error);
    }
}

// Fetch movies from TMDB (for browsing)
async function fetchMovies(pageNum, category = 'popular') {
    try {
        const response = await fetch(`${BASE_URL}/movie/${category}?api_key=${API_KEY}&page=${pageNum}`);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching movies:', error);
        return [];
    }
}

// Fetch search results from TMDB (global search)
async function fetchSearchResults(query, pageNum = 1) {
    try {
        const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${pageNum}`);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching search results:', error);
        return [];
    }
}

// Fetch trailer for a movie
async function fetchTrailer(movieId) {
    try {
        const response = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`);
        const data = await response.json();
        const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
        return trailer ? trailer.key : null;
    } catch (error) {
        console.error('Error fetching trailer:', error);
        return null;
    }
}

// Render star rating
function renderStars(rating) {
    const fullStars = Math.floor(rating / 2);
    const halfStar = rating % 2 >= 1 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    return '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
}

// Save watchlist to localStorage
function saveWatchlist() {
    localStorage.setItem('infinityHubWatchlist', JSON.stringify(watchlist));
}

// Toggle movie in watchlist
function toggleWatchlist(movie) {
    const index = watchlist.findIndex(m => m.id === movie.id);
    if (index > -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push(movie);
    }
    saveWatchlist();
}

// Render watchlist
function renderWatchlist() {
    watchlistContainer.innerHTML = '';
    watchlist.forEach(movie => {
        const item = document.createElement('div');
        item.className = 'watchlist-item';
        item.innerHTML = `
            <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}">
            <h4>${movie.title}</h4>
            <button class="trailer-btn" data-trailer="${movie.trailerKey || ''}" data-title="${movie.title}">${movie.trailerKey ? 'Watch Trailer' : 'Search Trailer'}</button>
            <button class="remove-btn" data-id="${movie.id}">Remove</button>
        `;
        watchlistContainer.appendChild(item);
    });
    // Attach event listeners
    document.querySelectorAll('.watchlist-item .trailer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trailerKey = e.target.getAttribute('data-trailer');
            const title = e.target.getAttribute('data-title');
            if (trailerKey) {
                trailerIframe.src = `https://www.youtube.com/embed/${trailerKey}`;
                trailerModal.style.display = 'flex';
            } else {
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`, '_blank');
            }
        });
    });
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            watchlist = watchlist.filter(m => m.id !== id);
            saveWatchlist();
            renderWatchlist();
        });
    });
}

// Render movies
async function renderMovies(movies) {
    for (const movie of movies) {
        const trailerKey = await fetchTrailer(movie.id);
        const isInWatchlist = watchlist.some(m => m.id === movie.id);
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.innerHTML = `
            <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}" class="movie-poster">
            <button class="watchlist-btn ${isInWatchlist ? 'added' : ''}" data-id="${movie.id}">♥</button>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <p class="movie-year">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
                <p class="movie-rating">${renderStars(movie.vote_average)} (${movie.vote_average}/10)</p>
                <button class="trailer-btn" data-trailer="${trailerKey}" data-title="${movie.title}">${trailerKey ? 'Watch Trailer' : 'Search Trailer'}</button>
            </div>
        `;
        movieContainer.appendChild(movieCard);
    }
    // Attach event listeners
    document.querySelectorAll('.watchlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            const movie = allMovies.find(m => m.id === id) || filteredMovies.find(m => m.id === id);
            if (movie) {
                const trailerKey = e.target.nextElementSibling.querySelector('.trailer-btn').getAttribute('data-trailer');
                toggleWatchlist({ ...movie, trailerKey });
                e.target.classList.toggle('added');
            }
        });
    });
    document.querySelectorAll('.trailer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trailerKey = e.target.getAttribute('data-trailer');
            const title = e.target.getAttribute('data-title');
            if (trailerKey) {
                trailerIframe.src = `https://www.youtube.com/embed/${trailerKey}`;
                trailerModal.style.display = 'flex';
            } else {
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`, '_blank');
            }
        });
    });
}

// Load initial movies
async function loadInitialMovies() {
    loadingSpinner.classList.add('show');
    const movies = await fetchMovies(page, currentCategory);
    allMovies = movies;
    filteredMovies = movies;
    await renderMovies(filteredMovies);
    loadingSpinner.classList.remove('show');
    page++;
}

// Infinite scroll (only for browsing, not search)
window.addEventListener('scroll', async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && !isLoading && !isSearching) {
        isLoading = true;
        loadingSpinner.classList.add('show');
        const movies = await fetchMovies(page, currentCategory);
        allMovies = [...allMovies, ...movies];
        filteredMovies = [...filteredMovies, ...movies];
        await renderMovies(movies);
        loadingSpinner.classList.remove('show');
        page++;
        isLoading = false;
    }
});

// Category toggle
popularBtn.addEventListener('click', () => {
    currentCategory = 'popular';
    popularBtn.classList.add('active');
    topRatedBtn.classList.remove('active');
    isSearching = false;
    resetAndLoad();
});

topRatedBtn.addEventListener('click', () => {
    currentCategory = 'top_rated';
    topRatedBtn.classList.add('active');
    popularBtn.classList.remove('active');
    isSearching = false;
    resetAndLoad();
});

// Genre filter (only for browsing)
genreSelect.addEventListener('change', () => {
    if (isSearching) return; // Disable during search
    const selectedGenre = genreSelect.value;
    if (selectedGenre) {
        filteredMovies = allMovies.filter(movie => movie.genre_ids.includes(parseInt(selectedGenre)));
    } else {
        filteredMovies = allMovies;
    }
    movieContainer.innerHTML = '';
    renderMovies(filteredMovies);
});

// Search functionality (global TMDB search)
searchBar.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length > 2) { // Start searching after 3 characters
        isSearching = true;
        loadingSpinner.classList.add('show');
        const results = await fetchSearchResults(query);
        movieContainer.innerHTML = '';
        await renderMovies(results);
        loadingSpinner.classList.remove('show');
    } else if (query === '') {
        isSearching = false;
        movieContainer.innerHTML = '';
        await renderMovies(filteredMovies); // Revert to browsing
    }
});

// Modal close
closeModal.addEventListener('click', () => {
    trailerModal.style.display = 'none';
    trailerIframe.src = ''; // Stop video
});

window.addEventListener('click', (e) => {
    if (e.target === trailerModal) {
        trailerModal.style.display = 'none';
        trailerIframe.src = '';
    }
});

// Navbar links
homeLink.addEventListener('click', () => {
    homeLink.classList.add('active');
    watchlistLink.classList.remove('active');
    watchlistModal.style.display = 'none';
});

watchlistLink.addEventListener('click', () => {
    watchlistLink.classList.add('active');
    homeLink.classList.remove('active');
    renderWatchlist();
    watchlistModal.style.display = 'flex';
});

// Close watchlist modal
closeWatchlist.addEventListener('click', () => {
    watchlistModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === watchlistModal) {
        watchlistModal.style.display = 'none';
    }
});

// Reset and reload
function resetAndLoad() {
    page = 1;
    allMovies = [];
    filteredMovies = [];
    movieContainer.innerHTML = '';
    loadInitialMovies();
}

// Initialize
fetchGenres();
loadInitialMovies();