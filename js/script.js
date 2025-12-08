// ---------- CONFIG ----------
const READ_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1Y2U1NzU3ZjkzNWQ3OGFmYWM4ZDU3NjFhYjdkYWVhZSIsIm5iZiI6MTc2MjgxMDU5NS43NzEwMDAxLCJzdWIiOiI2OTEyNWFlM2FlZTIzNWExZGYzMWI5NmUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.mxmMGrrOU1lN3tAbtjNtjXsjuMGtb5uhP801PUZVXYY";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const MAX_PAGES = 500; // TMDB limit for discover/search

let genresMap = {};       // id -> name
let watchlist = JSON.parse(localStorage.getItem("watchlist")||"[]");
let trailerCache = {};    // movieId -> embed url

// ---------- UTIL ----------
async function tmdbFetch(path){
  const res = await fetch(`${BASE_URL}${path}`, {
    headers:{ Accept:"application/json", Authorization:`Bearer ${READ_ACCESS_TOKEN}` }
  });
  if (!res.ok) throw new Error("TMDB fetch failed: "+res.status);
  return res.json();
}

function createMovieCard(movie){
  const div = document.createElement("div");
  div.className = "movie-card";

  const poster = movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : "https://via.placeholder.com/300x450?text=No+Image";
  const title = movie.title || movie.name || "Untitled";

  div.innerHTML = `
    <img loading="lazy" src="${poster}" alt="${title}" />
    <div class="meta">
      <div class="title">${title}</div>
      <div class="sub">${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</div>
    </div>
    <div class="overlay">
      <button class="play" data-id="${movie.id}"><i class="fas fa-play"></i></button>
      <button class="watchlist" data-id="${movie.id}">${watchlist.includes(movie.id)?"✓":"+"}</button>
    </div>
  `;

  // events
  div.querySelector(".play").addEventListener("click", async (e)=>{
    const id = e.currentTarget.dataset.id;
    const url = await getTrailerForMovie(id);
    if (!url) { alert("Trailer not available"); return; }
    playTrailer(url);
  });

  div.querySelector(".watchlist").addEventListener("click", (e)=>{
    const id = parseInt(e.currentTarget.dataset.id);
    toggleWatchlist(id);
    e.currentTarget.textContent = watchlist.includes(id) ? "✓" : "+";
  });

  return div;
}

// ---------- TRAILER (on demand, cached) ----------
async function getTrailerForMovie(movieId){
  if (trailerCache[movieId] !== undefined) return trailerCache[movieId]; // cached (could be empty string)
  try{
    const data = await tmdbFetch(`/movie/${movieId}/videos`);
    const yt = data.results.find(r => r.site === "YouTube" && (r.type === "Trailer" || r.type === "Teaser"));
    const url = yt ? `https://www.youtube.com/embed/${yt.key}?autoplay=1` : "";
    trailerCache[movieId] = url;
    return url;
  }catch(err){
    console.error(err);
    trailerCache[movieId] = "";
    return "";
  }
}

// ---------- MODAL ----------
function playTrailer(url){
  const modal = document.getElementById("trailerModal");
  const frame = document.getElementById("trailerFrame");
  frame.src = url;
  modal.style.display = "flex";
}
function closeTrailer(){
  const modal = document.getElementById("trailerModal");
  const frame = document.getElementById("trailerFrame");
  frame.src = "";
  modal.style.display = "none";
}
document.addEventListener("keydown",(e)=>{ if (e.key==="Escape") closeTrailer(); });

// ---------- WATCHLIST ----------
function toggleWatchlist(id){
  id = parseInt(id);
  if (watchlist.includes(id)) watchlist = watchlist.filter(x=>x!==id);
  else watchlist.push(id);
  localStorage.setItem("watchlist", JSON.stringify(watchlist));
}
function showWatchlist(){
  // find cached or fetch minimal details using /movie/{id}
  if (!watchlist.length) { alert("Your watchlist is empty"); return; }
  Promise.all(watchlist.map(id => tmdbFetch(`/movie/${id}`)))
    .then(results => {
      alert("Watchlist:\n" + results.map(m => m.title).join(", "));
    }).catch(()=>alert("Unable to fetch watchlist details"));
}

// ---------- GENRES (load once) ----------
async function loadGenres(){
  try{
    const data = await tmdbFetch("/genre/movie/list");
    data.genres.forEach(g => { genresMap[g.id] = g.name; });
    renderGenresDropdown();
  }catch(err){ console.error("genres load failed", err); }
}

function renderGenresDropdown(){
  const container = document.getElementById("genresList");
  container.innerHTML = "";
  Object.entries(genresMap).forEach(([id,name])=>{
    const a = document.createElement("a");
    a.href = `genre.html?id=${id}&name=${encodeURIComponent(name)}`;
    a.textContent = name;
    container.appendChild(a);
  });
  // toggle dropdown
  const btn = document.getElementById("genresBtn");
  btn.addEventListener("click", ()=> {
    container.style.display = container.style.display === "block" ? "none" : "block";
  });
  // click outside to close
  window.addEventListener("click", (e)=> {
    if (!btn.contains(e.target) && !container.contains(e.target)) container.style.display = "none";
  });
}

// ---------- HOME: render sections with incremental load ----------
const HOME_CATEGORIES = [
  { title:"Trending Now", path:"/trending/movie/week" },
  { title:"Popular", path:"/movie/popular" },
  { title:"Top Rated", path:"/movie/top_rated" },
  { title:"Action", path:"/discover/movie?with_genres=28&sort_by=popularity.desc" },
  { title:"Comedy", path:"/discover/movie?with_genres=35&sort_by=popularity.desc" },
  { title:"Horror", path:"/discover/movie?with_genres=27&sort_by=popularity.desc" }
];

async function initHome(){
  const container = document.getElementById("homeSections");
  container.innerHTML = "";
  document.getElementById("loadingHome").style.display = "block";

  for(const cat of HOME_CATEGORIES){
    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `<h2>${cat.title}</h2><div class="carousel" id="${cat.title.replace(/\s+/g,'')}_carousel"></div><div class="loading" id="${cat.title.replace(/\s+/g,'')}_loadmore"></div>`;
    container.appendChild(section);

    // load first page for this category
    loadCategoryPage(cat.path, 1, `${cat.title.replace(/\s+/g,'')}_carousel`, `${cat.title.replace(/\s+/g,'')}_loadmore`);
  }

  document.getElementById("loadingHome").style.display = "none";
}

const categoryPageTracker = {}; // key -> current page

async function loadCategoryPage(path, page, carouselId, loadmoreId){
  try{
    const key = carouselId;
    const carousel = document.getElementById(carouselId);
    const loadmoreEl = document.getElementById(loadmoreId);
    loadmoreEl.textContent = "Loading...";
    const data = await tmdbFetch(`${path}&page=${page}`);
    data.results.forEach(m => carousel.appendChild(createMovieCard(m)));
    categoryPageTracker[key] = page;
    // show load more button if more pages available and under MAX_PAGES
    if (page < Math.min(data.total_pages, MAX_PAGES)) {
      loadmoreEl.innerHTML = `<button class="btn" onclick="loadMoreCategory('${encodeURIComponent(path)}','${carouselId}','${loadmoreId}')">Load more</button>`;
    } else loadmoreEl.textContent = "";
  }catch(err){ console.error(err); }
}

window.loadMoreCategory = function(pathEncoded, carouselId, loadmoreId){
  const path = decodeURIComponent(pathEncoded);
  const nextPage = (categoryPageTracker[carouselId] || 1) + 1;
  loadCategoryPage(path, nextPage, carouselId, loadmoreId);
};

// ---------- SEARCH (global) ----------
let searchState = { query:"", page:0, loading:false, lastTotal:0 };
const searchInput = () => document.getElementById("searchInput");

async function performSearchReset(){
  const q = searchInput().value.trim();
  const listRoot = document.querySelector(".home-sections");
  // if on genre page, genre.js handles search differently (we set handler there)
  if (!q) { // clear search: re-init home
    await initHome();
    return;
  }
  // clear and show search results area
  listRoot.innerHTML = `<section class="section"><h2>Search: ${q}</h2><div id="searchResults" class="carousel"></div><div id="searchLoad" class="loading"></div></section>`;
  searchState = { query:q, page:0, loading:false, lastTotal:0 };
  await loadMoreSearch();
}

async function loadMoreSearch(){
  if (searchState.loading) return;
  searchState.loading = true;
  const nextPage = searchState.page + 1;
  try{
    const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(searchState.query)}&page=${nextPage}`);
    const root = document.getElementById("searchResults");
    data.results.forEach(m => root.appendChild(createMovieCard(m)));
    searchState.page = nextPage;
    searchState.lastTotal = data.total_results;
    const loadEl = document.getElementById("searchLoad");
    if (nextPage < Math.min(data.total_pages, MAX_PAGES)) {
      loadEl.innerHTML = `<button class="btn" onclick="loadMoreSearch()">Load more</button>`;
    } else {
      loadEl.textContent = data.total_results ? "" : "No results";
    }
  }catch(err){ console.error(err); }
  searchState.loading = false;
}

// infinite scroll for search results
window.addEventListener("scroll", ()=>{
  // if search results present and near bottom, load more
  if (document.getElementById("searchResults")) {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) loadMoreSearch();
  }
});

// ---------- GENRE PAGE INIT ----------
async function initGenrePage(genreId, genreName){
  const root = document.getElementById("genreMovies");
  root.innerHTML = "";
  let page = 1;
  const loading = document.getElementById("loading");
  loading.style.display = "block";

  async function loadNext(){
    if (page > MAX_PAGES) return;
    loading.textContent = "Loading...";
    try{
      const data = await tmdbFetch(`/discover/movie?with_genres=${genreId}&page=${page}&sort_by=popularity.desc`);
      data.results.forEach(m => root.appendChild(createMovieCard(m)));
      page++;
      document.getElementById("genreCount").textContent = `Page ${page-1} of ${Math.min(data.total_pages, MAX_PAGES)} (${data.total_results} results)`;
      if (page > Math.min(data.total_pages, MAX_PAGES)) loading.style.display = "none";
      else loading.textContent = "Scroll for more...";
    }catch(err){ console.error(err); loading.textContent = "Error loading"; }
  }

  // initial load
  await loadNext();

  // infinite scroll
  window.addEventListener("scroll", async () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 120) {
      await loadNext();
    }
  });

  // search box on genre page should trigger global search
  const s = document.getElementById("searchInput");
  s.addEventListener("keyup", (e)=> {
    if (e.key === "Enter") performSearchReset();
  });
}

// ---------- INIT PAGE ----------
(async function init(){
  await loadGenres();
  // if on genre page, genre.html will call initGenrePage; so only initialize home if index.html
  if (location.pathname.endsWith("/index.html") || location.pathname.endsWith("/") || location.pathname.endsWith("/infinityhub/")) {
    await initHome();
    // hook search
    const s = document.getElementById("searchInput");
    let debounce;
    s.addEventListener("input", ()=> {
      clearTimeout(debounce);
      debounce = setTimeout(()=>performSearchReset(), 450);
    });
    // hero featured trailer
    document.getElementById("heroPlayBtn").addEventListener("click", async ()=>{
      // try to show trailer for a known movie id (Avengers Endgame)
      const url = await getTrailerForMovie(299534).catch(()=>"");
      if (url) playTrailer(url); else alert("Trailer not found");
    });
  } else {
    // If search input exists on other pages (genre.html), connect Enter to search
    const s = document.getElementById("searchInput");
    if (s) s.addEventListener("keyup", (e)=> { if (e.key==="Enter") performSearchReset(); });
  }

  // expose watchlist function globally
  window.showWatchlist = showWatchlist;
  window.loadMoreSearch = loadMoreSearch;
})();
