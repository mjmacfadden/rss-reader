// Local storage functions
function saveFeeds(feeds) {
    localStorage.setItem('rssFeeds', JSON.stringify(feeds));
  }
  
  function loadFeeds() {
    const feeds = localStorage.getItem('rssFeeds');
    return feeds ? JSON.parse(feeds) : [];
  }
  
  // Initialize the form with saved feeds
  function initForm() {
    const feeds = loadFeeds();
    document.getElementById("rssInput").value = feeds.join('\n');
  }
  
  document.getElementById('articleCount').addEventListener('input', (e) => {
    const articleCount = e.target.value;
    localStorage.setItem('articleCount', articleCount); // Save the value immediately when changed
  });

  async function fetchAndParseRSS(url) {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
  
    if (!data.items || data.items.length === 0) {
      throw new Error("No items found in feed");
    }
  
    const articleCount = parseInt(localStorage.getItem('articleCount')) || 3;
  
    return {
      feedTitle: data.feed?.title || "Unknown Feed",
      feedAuthor: data.feed?.author || "Unknown Author",
      feedUrl: url,
      items: data.items.slice(0, articleCount).map(item => ({
        title: item.title,
        author: item.author || data.feed?.author,
        link: item.link,
        pubDate: item.pubDate,
        subtitle: extractSubtitle(item.content || item.description),
        content: cleanHTML(item.content || item.description)
      }))
    };
  }
  
  function extractSubtitle(content) {
    // Create temporary element to parse HTML content
    const temp = document.createElement("div");
    temp.innerHTML = content;
    
    // Try to find first paragraph or div
    const firstP = temp.querySelector("p");
    if (firstP) {
      // Return first 150 characters
      return firstP.textContent.trim().substring(0, 150) + (firstP.textContent.length > 150 ? "..." : "");
    }
    
    // Fallback to raw text
    return temp.textContent.trim().substring(0, 150) + (temp.textContent.length > 150 ? "..." : "");
  }
  
  function cleanHTML(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
  
    // Remove iframes
    temp.querySelectorAll("iframe").forEach(el => el.remove());
  
    // Fix image styling to ensure they span full width and display properly
    temp.querySelectorAll("img").forEach(img => {
      // Save original src if needed
      const originalSrc = img.getAttribute('src');
      
      // Reset any inline styles that might affect width
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.margin = "0.75rem 0";
      img.style.padding = "0";
      img.style.border = "none";
      img.style.display = "block";
      img.style.maxWidth = "100%";
      
      // Remove any width/height attributes that might constrain image
      img.removeAttribute("width");
      img.removeAttribute("height");
      
      // Ensure src attribute is set properly (some feeds use data-src or similar)
      if (!img.src || img.src === '') {
        const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (dataSrc) {
          img.src = dataSrc;
        }
      }
      
      // If image is wrapped in an <a> link, unwrap it to prevent the link from showing in print
      const parentLink = img.closest('a');
      if (parentLink && !parentLink.textContent.trim().replace(img.outerHTML, '').trim()) {
        parentLink.replaceWith(img);
      }
      
      // If image is inside a figure or div, fix the container too
      const figure = img.closest('figure');
      if (figure) {
        figure.style.margin = "0";
        figure.style.padding = "0";
        figure.style.width = "100%";
        figure.style.maxWidth = "100%";
        
        // Remove any figcaption that contains just the image URL
        const figcaption = figure.querySelector('figcaption');
        if (figcaption && figcaption.textContent.includes('http')) {
          figcaption.remove();
        }
      }
      
      const parentDiv = img.parentElement;
      if (parentDiv && parentDiv.tagName === 'DIV') {
        parentDiv.style.margin = "0";
        parentDiv.style.padding = "0";
        parentDiv.style.width = "100%";
        parentDiv.style.maxWidth = "100%";
      }
    });
  
    // Find and remove any standalone links that are just image URLs
    temp.querySelectorAll("a").forEach(link => {
      const linkText = link.textContent.trim();
      // If link looks like an image URL and doesn't contain an image itself
      if ((linkText.match(/\.(jpg|jpeg|png|gif|webp)/i) || linkText.startsWith('http')) && 
          !link.querySelector('img')) {
        // Check if it's immediately after an image
        const prevSibling = link.previousElementSibling;
        if (prevSibling && prevSibling.tagName === 'IMG') {
          link.remove();
          return;
        }
      }
      
      // Normal link processing for remaining links
      const displayText = link.textContent;
      if (displayText === link.href || displayText.length > 40) {
        link.textContent = truncateLink(link.href);
      }
      link.title = link.href; // Add full URL as tooltip
      
      // Add CSS classes for truncation
      link.style.whiteSpace = "nowrap";
      link.style.overflow = "hidden";
      link.style.textOverflow = "ellipsis";
      link.style.maxWidth = "100%";
      link.style.display = "inline-block";
    });
  
    // Remove paragraphs that contain only image URLs
    temp.querySelectorAll("p").forEach(p => {
      const text = p.textContent.trim();
      if (text.startsWith('http') && (text.match(/\.(jpg|jpeg|png|gif|webp)/i) || text.includes('image'))) {
        p.remove();
      }
    });
  
    return temp.innerHTML;
  }
  
  function truncateLink(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      
      // Keep domain and truncate path if too long
      if (path.length > 20) {
        return `${domain}${path.substring(0, 15)}...`;
      }
      return `${domain}${path}`;
    } catch (e) {
      // If URL parsing fails, just truncate the string
      return url.length > 40 ? url.substring(0, 35) + "..." : url;
    }
  }
  
  document.getElementById("rssForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const rssInput = document.getElementById("rssInput");
    const feeds = rssInput.value
      .split("\n")
      .map(url => url.trim())
      .filter(Boolean);
  
    // Save feeds to local storage
    saveFeeds(feeds);
  
    const container = document.getElementById("articleContainer");
    const selectionContainer = document.getElementById("selectionContainer");
    
    selectionContainer.innerHTML = "<h2>Select articles to print</h2><div id='loading'>Loading feeds...</div>";
    container.innerHTML = "";
  
    try {
      const feedResults = await Promise.all(feeds.map(fetchAndParseRSS));
      document.getElementById("loading").remove();
      
      const feedInfoContainer = document.getElementById("feedInfo");
      feedInfoContainer.innerHTML = "<h2>Feed Information</h2>";
      
      feedResults.forEach((feed, feedIndex) => {
        // Add feed info to the feed panel
        const feedInfoItem = document.createElement("div");
        feedInfoItem.className = "feed-info-item";
        feedInfoItem.innerHTML = `
          <div class="feed-info-title">${feed.feedTitle}</div>
          <div class="feed-info-author">by ${feed.feedAuthor}</div>
        `;
        feedInfoContainer.appendChild(feedInfoItem);

        // Create feed section in selection container
        const feedEl = document.createElement("div");
        feedEl.className = "feed-section";
        feedEl.innerHTML = `
          <div class="feed-header">
            <h3 class="feed-title">${feed.feedTitle}</h3>
            <div class="feed-meta">
              <div class="feed-author">${feed.feedAuthor}</div>
            </div>
          </div>`;
        selectionContainer.appendChild(feedEl);
        
        feed.items.forEach((item, itemIndex) => {
          const itemEl = document.createElement("div");
          itemEl.className = "article-preview";
          
          const checkboxId = `article-${feedIndex}-${itemIndex}`;
          
          itemEl.innerHTML = `
            <input type="checkbox" id="${checkboxId}" data-feed="${feedIndex}" data-item="${itemIndex}">
            <label for="${checkboxId}">
              <strong>${item.title}</strong>
              <p class="subtitle">${item.subtitle}</p>
              <small>${new Date(item.pubDate).toLocaleDateString()}</small>
            </label>
          `;
          
          feedEl.appendChild(itemEl);
        });
      });
  
      // Store feed results for later use
      window.feedResults = feedResults;
  
    } catch (err) {
      selectionContainer.innerHTML = `<p style="color:red;">⚠️ Failed to load one or more feeds: ${err.message}</p>`;
    }
  });
  
  // Update the Generate Print View functionality to trigger on checkbox changes
  const selectionContainer = document.getElementById('selectionContainer');
  selectionContainer.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox') {
      generatePrintView(window.feedResults);
    }
  });
  
  // Removed the 'Read original' link from the article content
  function generatePrintView(feedResults) {
    const container = document.getElementById("articleContainer");
    container.innerHTML = "";
    let hasContent = false;
  
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const feedIndex = parseInt(checkbox.dataset.feed);
      const itemIndex = parseInt(checkbox.dataset.item);
      
      if (feedResults && feedResults[feedIndex] && feedResults[feedIndex].items[itemIndex]) {
        hasContent = true;
        const article = feedResults[feedIndex].items[itemIndex];
        const feed = feedResults[feedIndex];
        
        const el = document.createElement("div");
        el.className = "article";
        el.innerHTML = `
          <div class="publication-header">
            <h1 class="publication-title">${feed.feedTitle}</h1>
            <div class="publication-author">by ${feed.feedAuthor}</div>
          </div>
          <h2 class="article-title">${article.title}</h2>
          <div class="article-meta">
            <span class="article-author">By ${article.author || feed.feedAuthor}</span>
          </div>
          <div class="article-content">${article.content}</div>
        `;
        
        container.appendChild(el);
      }
    });
  
    if (!hasContent) {
      container.innerHTML = "<p>No articles selected. Please select at least one article to generate the print view.</p>";
    }
  }
  
  // Initialize form with saved feeds when the page loads
  window.addEventListener('DOMContentLoaded', initForm);

window.addEventListener('DOMContentLoaded', () => {
  const settingsPanel = document.getElementById('settingsPanel');
  const articleContainer = document.getElementById('articleContainer');

  if (!settingsPanel.classList.contains('hidden')) {
    articleContainer.style.marginLeft = `${settingsPanel.offsetWidth}px`;
  }
});

document.getElementById('feedButton').addEventListener('click', () => {
  const feedPanel = document.getElementById('feedPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  const instructionsPanel = document.getElementById('instructionsPanel');

  // Toggle feed panel visibility
  feedPanel.classList.toggle('hidden');

  // Ensure settings and instructions panels are hidden when feed panel is shown
  if (!feedPanel.classList.contains('hidden')) {
    settingsPanel.classList.add('hidden');
    instructionsPanel.classList.add('hidden');
  }
});

document.getElementById('settingsButton').addEventListener('click', () => {
  const settingsPanel = document.getElementById('settingsPanel');
  const feedPanel = document.getElementById('feedPanel');
  const instructionsPanel = document.getElementById('instructionsPanel');

  // Toggle settings panel visibility
  settingsPanel.classList.toggle('hidden');

  // Ensure feed and instructions panels are hidden when settings panel is shown
  if (!settingsPanel.classList.contains('hidden')) {
    feedPanel.classList.add('hidden');
    instructionsPanel.classList.add('hidden');
  }
});

document.getElementById('instructionsButton').addEventListener('click', () => {
  const instructionsPanel = document.getElementById('instructionsPanel');
  const feedPanel = document.getElementById('feedPanel');
  const settingsPanel = document.getElementById('settingsPanel');

  // Toggle instructions panel visibility
  instructionsPanel.classList.toggle('hidden');

  // Hide other panels when instructions panel is shown
  if (!instructionsPanel.classList.contains('hidden')) {
    feedPanel.classList.add('hidden');
    settingsPanel.classList.add('hidden');
  }
});

document.getElementById('printCheckbox').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.print();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const articleCountInput = document.getElementById('articleCount');
  const savedArticleCount = localStorage.getItem('articleCount') || 3;
  articleCountInput.value = savedArticleCount; // Ensure the input value matches the saved value
});

// Ensure the existing textarea in the HTML is used
const directUrlInput = document.getElementById('directUrlInput');

// Update the event listener to save direct URLs to a separate local storage variable
directUrlInput.addEventListener('input', () => {
  const directUrls = directUrlInput.value
    .split('\n')
    .map(url => url.trim())
    .filter(Boolean);

  // Save direct URLs to a separate local storage variable
  localStorage.setItem('directUrls', JSON.stringify(directUrls));
});

// Update the logic to truncate direct URLs after '.com/'
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Keep only the base path (e.g., https://example.com/)
    if (pathParts.length > 1) {
      urlObj.pathname = '/';
    }

    if (!urlObj.pathname.endsWith('/feed')) {
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/feed';
    }

    return urlObj.toString();
  } catch {
    return url; // Return the original URL if it's invalid
  }
}

// Update the form submission to apply truncation to direct URLs
const loadArticlesButton = document.getElementById('rssForm').querySelector('button[type="submit"]');

loadArticlesButton.addEventListener('click', async (e) => {
  e.preventDefault();

  const rssInput = document.getElementById('rssInput');
  const directUrlInput = document.getElementById('directUrlInput');

  const feeds = rssInput.value
    .split("\n")
    .map(url => url.trim())
    .filter(Boolean)
    .map(normalizeUrl);

  const directUrls = directUrlInput.value
    .split("\n")
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => {
      try {
        const urlObj = new URL(url);
        // Truncate after '.com/'
        urlObj.pathname = '/';
        return {
          originalUrl: url,
          feedUrl: normalizeUrl(urlObj.toString())
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const allFeeds = directUrls.concat(feeds.map(feed => ({ feedUrl: feed, originalUrl: null })));

  // Save only RSS feeds (excluding direct URLs) to local storage
  saveFeeds(feeds);

  const container = document.getElementById('articleContainer');
  const selectionContainer = document.getElementById('selectionContainer');

  selectionContainer.innerHTML = "<h2>Select articles to print</h2><div id='loading'>Loading feeds...</div>";
  container.innerHTML = "";

  try {
    const feedResults = await Promise.all(allFeeds.map(async ({ feedUrl, originalUrl }) => {
      const feed = await fetchAndParseRSS(feedUrl);

      if (originalUrl) {
        // Filter the feed items to include only the specific article
        feed.items = feed.items.filter(item => item.link === originalUrl);
      }

      return feed;
    }));

    document.getElementById('loading').remove();

    feedResults.forEach((feed, feedIndex) => {
      const feedEl = document.createElement('div');
      feedEl.className = 'feed-section';
      feedEl.innerHTML = `
        <div class="feed-header">
          <h3 class="feed-title">${feed.feedTitle}</h3>
          <div class="feed-meta">
            <div class="feed-author">${feed.feedAuthor}</div>
          </div>
        </div>`;
      selectionContainer.appendChild(feedEl);

      feed.items.forEach((item, itemIndex) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'article-preview';

        const checkboxId = `article-${feedIndex}-${itemIndex}`;

        itemEl.innerHTML = `
          <input type="checkbox" id="${checkboxId}" data-feed="${feedIndex}" data-item="${itemIndex}">
          <label for="${checkboxId}">
            <strong>${item.title}</strong>
            <p class="subtitle">${item.subtitle}</p>
            <small>${new Date(item.pubDate).toLocaleDateString()}</small>
          </label>
        `;

        feedEl.appendChild(itemEl);
      });
    });

    // Store feed results for later use
    window.feedResults = feedResults;

  } catch (err) {
    selectionContainer.innerHTML = `<p style="color:red;">⚠️ Failed to load one or more feeds: ${err.message}</p>`;
  }
});

// Update the event listener to handle deletions from the text area
const rssInput = document.getElementById('rssInput');
rssInput.addEventListener('input', () => {
  const feeds = rssInput.value
    .split('\n')
    .map(url => url.trim())
    .filter(Boolean);

  // Save updated feeds to local storage
  saveFeeds(feeds);
});

// Initialize the form with saved direct URLs
function initDirectUrls() {
  const directUrls = JSON.parse(localStorage.getItem('directUrls')) || [];
  document.getElementById('directUrlInput').value = directUrls.join('\n');
}

// Call the initialization function for direct URLs
window.addEventListener('DOMContentLoaded', initDirectUrls);

document.querySelector('.close-hello-bar').addEventListener('click', function() {
  const helloBar = document.querySelector('.hello_bar');
  helloBar.style.display = 'none';

  // Remove hb_adjust class from all elements
  document.querySelectorAll('.hb_adjust').forEach(element => {
    element.classList.remove('hb_adjust');
  });
});

// Add event listeners to toolbar buttons to handle active state
const toolbarButtons = document.querySelectorAll('.toolbar-btn');

toolbarButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active state from all buttons
    toolbarButtons.forEach(btn => btn.style.color = '#999');

    // Toggle active state for the clicked button
    if (button.style.color === 'rgb(102, 102, 102)') { // #666 in RGB
      button.style.color = '#999';
    } else {
      button.style.color = '#666';
    }
  });
});

// Modal logic for Substack subscribe form
setTimeout(() => {
  const modal = document.getElementById('substackModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}, 5000);

document.getElementById('closeModalBtn').addEventListener('click', () => {
  document.getElementById('substackModal').classList.add('hidden');
});