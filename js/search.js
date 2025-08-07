console.log("search.js loaded");

let recipes = [];

fetch("recipes.json")
    .then(response => response.json())
    .then(data => {
        recipes = data;
        console.log("Recipes loaded", recipes);
    });

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("liveSearchInput");
    const searchResults = document.getElementById("searchResults");

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener("input", function () {
        const query = this.value.toLowerCase();
        searchResults.innerHTML = '';

        if (!query) {
            searchResults.style.display = 'none';
            return;
        }

        const filtered = recipes.filter(r =>
            r.title.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            searchResults.innerHTML = '<div style="padding: 8px;">No results</div>';
        } else {
            filtered.forEach(recipe => {
                const link = document.createElement("a");
                link.href = recipe.url;
                link.textContent = recipe.title;
                searchResults.appendChild(link);
            });
        }

        searchResults.style.display = 'block';
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".live-search")) {
            searchResults.style.display = "none";
        }
    });
});