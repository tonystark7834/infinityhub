const API_KEY = "5ce5757f935d78afac8d5761ab7daeae"; // trailing space remove
const READ_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1Y2U1NzU3Zjk1ZDc4YWZhYzhkNTc2MWE2YmRhZWFlIiwibmJmIjoxNzYyODEwNTk1LCJzdWIiOiI2OTEyNWFlM2FlZTIzNWExZGYzMWI5NmUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.mxmMGrrOU1lN3tAbtjNtjXsjuMGtb5uhP801PUZVXYY";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

let allMovies = [];
let watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];

// Fetch movies from TMDB
async function fetchMovies(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${READ_ACCESS_TOKEN}`
            }
        });
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();

        return data.results.map(movie => ({
            id: movie.id,
            title: movie.title || movie.name,
            poster: movie.poster_path
                ? `${IMAGE_BASE_URL}${movie.poster_path}`
                : "https://via.placeholder.com/200x300?text=No+Image",
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : "N/A",
            trailer: `https://www.youtube.com/embed/${movie.id}` // temporary, will replace with real key if needed
        }));
    } catch (err) {
        console.error("Error fetching movies:", err);
        return [];
    }
}

// Render all movies
async function renderMovies() {
    const container = document.getElementById("moviesContainer");
    const loading = document.getElementById("loadingSpinner");
    loading.style.display = "block";

    const categories = [
        { name: "Trending Now", endpoint: "/trending/movie/week" },
        { name: "Action", endpoint: "/discover/movie?with_genres=28" },
        { name: "Comedy", endpoint: "/discover/movie?with_genres=35" },
        { name: "Drama", endpoint: "/discover/movie?with_genres=18" }
    ];

    for (const cat of categories) {
        const movies = await fetchMovies(cat.endpoint);
        allMovies.push(...movies);

        const row = document.createElement("div");
        row.className = "row";
        row.id = `${cat.name.replace(/\s+/g, "")}Row`;

        row.innerHTML = `
            <div class="carousel-nav">
                <h2><i class="fas fa-fire"></i> ${cat.name}</h2>
                <div>
                    <button class="nav-btn" onclick="scrollLeft('${cat.name.replace(/\s+/g, "")}')"><i class="fas fa-chevron-left"></i></button>
                    <button class="nav-btn" onclick="scrollRight('${cat.name.replace(/\s+/g, "")}')"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="movie-list" id="${cat.name.replace(/\s+/g, "")}List"></div>
        `;

        container.appendChild(row);

        const listEl = document.getElementById(`${cat.name.replace(/\s+/g, "")}List`);
        movies.forEach(movie => {
            const card = document.createElement("div");
            card.className = "movie-card";
            card.dataset.id = movie.id;

            card.innerHTML = `
                <img src="${movie.poster}" alt="${movie.title}" loading="lazy">
                <div class="rating"><i class="fas fa-star"></i> ${movie.rating}</div>
                <div class="overlay">
                    <button onclick="playTrailer('${movie.trailer}')"><i class="fas fa-play"></i> Play</button>
                    <button onclick="toggleWatchlist(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-plus"></i> ${watchlist.includes(movie.id) ? "Remove" : "Add"}
                    </button>
                </div>
            `;
            listEl.appendChild(card);
        });
    }

    loading.style.display = "none";
}

// Carousel navigation
function scrollLeft(id) {
    const el = document.getElementById(id + "List");
    if (el) el.scrollBy({ left: -300, behavior: "smooth" });
}
function scrollRight(id) {
    const el = document.getElementById(id + "List");
    if (el) el.scrollBy({ left: 300, behavior: "smooth" });
}

// Trailer modal
function playTrailer(url) {
    document.getElementById("trailerFrame").src = url;
    document.getElementById("trailerModal").style.display = "block";
}
function closeTrailer() {
    document.getElementById("trailerFrame").src = "";
    document.getElementById("trailerModal").style.display = "none";
}

// Watchlist
function toggleWatchlist(movieId, title) {
    if (watchlist.includes(movieId)) {
        watchlist = watchlist.filter(id => id !== movieId);
        alert(`${title} removed from watchlist!`);
    } else {
        watchlist.push(movieId);
        alert(`${title} added to watchlist!`);
    }
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
}

// Show watchlist
function showWatchlist() {
    const movies = allMovies.filter(m => watchlist.includes(m.id));
    if (movies.length === 0) {
        alert("Your watchlist is empty!");
    } else {
        alert("Your Watchlist: " + movies.map(m => m.title).join(", "));
    }
}

// Search filter
let searchTimeout;
function filterMovies() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const q = document.getElementById("searchInput").value.toLowerCase();
        document.querySelectorAll(".row").forEach(row => {
            const cards = row.querySelectorAll(".movie-card");
            let found = false;
            cards.forEach(card => {
                const title = card.querySelector("img").alt.toLowerCase();
                const show = title.includes(q);
                card.style.display = show ? "block" : "none";
                if (show) found = true;
            });
            row.style.display = found ? "block" : "none";
        });
    }, 300);
}

// ESC → close modal
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeTrailer();
});

// INIT
document.addEventListener("DOMContentLoaded", renderMovies);
