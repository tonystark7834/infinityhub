const API_KEY = "5ce5757f935d78afac8d5761ab7daeae";
const READ_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1Y2U1NzU3ZjkzNWQ3OGFmYWM4ZDU3NjFhYjdkYWVhZSIsIm5iZiI6MTc2MjgxMDU5NS43NzEwMDAxLCJzdWIiOiI2OTEyNWFlM2FlZTIzNWExZGYzMWI5NmUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.mxmMGrrOU1lN3tAbtjNtjXsjuMGtb5uhP801PUZVXYY";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

let allMovies = [];
let watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];


/* -----------------------------------------
   FETCH YOUTUBE TRAILER OF A MOVIE
----------------------------------------- */
async function fetchTrailer(id) {
    try {
        const response = await fetch(`${BASE_URL}/movie/${id}/videos`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${READ_ACCESS_TOKEN}`
            }
        });

        const data = await response.json();
        const yt = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");

        return yt ? `https://www.youtube.com/embed/${yt.key}` : "";
    } catch {
        return "";
    }
}

/* -----------------------------------------
   FETCH MOVIES + REAL TRAILERS
----------------------------------------- */
async function fetchMovies(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${READ_ACCESS_TOKEN}`
            }
        });

        const data = await response.json();

        // Get trailer for each movie
        const movies = await Promise.all(
            data.results.map(async movie => {
                const trailerUrl = await fetchTrailer(movie.id);

                return {
                    id: movie.id,
                    title: movie.title || movie.name,
                    poster: movie.poster_path
                        ? `${IMAGE_BASE_URL}${movie.poster_path}`
                        : "https://via.placeholder.com/200x300?text=No+Image",
                    rating: movie.vote_average ? movie.vote_average.toFixed(1) : "N/A",
                    trailer: trailerUrl
                };
            })
        );

        return movies;
    } catch (error) {
        console.error("Error fetching movies:", error);
        return [];
    }
}


/* -----------------------------------------
   RENDER MOVIE SECTIONS
----------------------------------------- */
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
        row.innerHTML = `
            <div class="carousel-nav">
                <h2>${cat.name}</h2>
                <div>
                    <button class="nav-btn" onclick="scrollLeft('${cat.name}')"><i class="fas fa-chevron-left"></i></button>
                    <button class="nav-btn" onclick="scrollRight('${cat.name}')"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="movie-list" id="${cat.name.replace(/\s+/g, '')}List"></div>
        `;

        container.appendChild(row);

        const list = document.getElementById(`${cat.name.replace(/\s+/g, "")}List`);

        movies.forEach(movie => {
            const card = document.createElement("div");
            card.className = "movie-card";

            card.innerHTML = `
                <img src="${movie.poster}" alt="${movie.title}">
                <div class="rating"><i class="fas fa-star"></i> ${movie.rating}</div>
                <div class="overlay">
                    <button onclick="playTrailer('${movie.trailer}')"><i class="fas fa-play"></i> Play</button>
                    <button onclick="toggleWatchlist(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-plus"></i> ${watchlist.includes(movie.id) ? "Remove" : "Add"}
                    </button>
                </div>
            `;
            list.appendChild(card);
        });
    }

    loading.style.display = "none";
}



/* -----------------------------------------
   MODAL TRAILER PLAYER
----------------------------------------- */
function playTrailer(url) {
    document.getElementById("trailerFrame").src = url;
    document.getElementById("trailerModal").style.display = "block";
}

function closeTrailer() {
    document.getElementById("trailerFrame").src = "";
    document.getElementById("trailerModal").style.display = "none";
}



/* -----------------------------------------
   WATCHLIST
----------------------------------------- */
function toggleWatchlist(id, title) {
    if (watchlist.includes(id)) {
        watchlist = watchlist.filter(x => x !== id);
        alert(`${title} removed from watchlist!`);
    } else {
        watchlist.push(id);
        alert(`${title} added to watchlist!`);
    }

    localStorage.setItem("watchlist", JSON.stringify(watchlist));
}

function showWatchlist() {
    const movies = allMovies.filter(m => watchlist.includes(m.id));

    if (movies.length === 0) {
        alert("Your watchlist is empty!");
    } else {
        alert("Your Watchlist:\n" + movies.map(m => m.title).join(", "));
    }
}


/* -----------------------------------------
   SEARCH FILTER
----------------------------------------- */
let searchTimeout;
function filterMovies() {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        const q = document.getElementById("searchInput").value.toLowerCase();

        document.querySelectorAll(".row").forEach(row => {
            let found = false;
            row.querySelectorAll(".movie-card").forEach(card => {
                const title = card.querySelector("img").alt.toLowerCase();
                const show = title.includes(q);
                card.style.display = show ? "block" : "none";

                if (show) found = true;
            });
            row.style.display = found ? "block" : "none";
        });
    }, 300);
}


/* -----------------------------------------
   ESC CLOSES MODAL
----------------------------------------- */
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeTrailer();
});


/* -----------------------------------------
   INIT
----------------------------------------- */
document.addEventListener("DOMContentLoaded", renderMovies);
