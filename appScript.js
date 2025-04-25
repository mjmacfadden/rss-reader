// Restore JavaScript for RSS Reader
const rssForm = document.getElementById('rssForm');
const rssInput = document.getElementById('rssInput');
const articleContainer = document.getElementById('articleContainer');

rssForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rssUrl = rssInput.value;

    try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
        const data = await response.json();

        if (data.status === 'ok') {
            articleContainer.innerHTML = data.items.map(item => `
                <div class="article">
                    <h2>${item.title}</h2>
                    <p>${item.content || item.description}</p>
                </div>
            `).join('');

            // Apply Paged.js
            Paged.polyfill();
        } else {
            articleContainer.innerHTML = '<p class="text-danger">Failed to load RSS feed. Please check the URL.</p>';
        }
    } catch (error) {
        articleContainer.innerHTML = '<p class="text-danger">An error occurred while fetching the RSS feed.</p>';
        console.error(error);
    }
});