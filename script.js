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
  
  async function fetchAndParseRSS(url) {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
  
    if (!data.items || data.items.length === 0) {
      throw new Error("No items found in feed");
    }
  
    // Return the first three items
    return {
      feedTitle: data.feed?.title || "Unknown Feed",
      feedUrl: url,
      items: data.items.slice(0, 3).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        // Extract subtitle or use beginning of content
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
      
      feedResults.forEach((feed, feedIndex) => {
        const feedEl = document.createElement("div");
        feedEl.className = "feed-section";
        feedEl.innerHTML = `<h3>${feed.feedTitle}</h3>`;
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
  
    // Get all checked articles
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const feedIndex = parseInt(checkbox.dataset.feed);
      const itemIndex = parseInt(checkbox.dataset.item);
      
      if (feedResults && feedResults[feedIndex] && feedResults[feedIndex].items[itemIndex]) {
        hasContent = true;
        const article = feedResults[feedIndex].items[itemIndex];
        
        const el = document.createElement("div");
        el.className = "article";
        el.innerHTML = `
          <h2>${article.title}</h2>
          <div>${article.content}</div>
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

document.getElementById('settingsButton').addEventListener('click', () => {
  const settingsPanel = document.getElementById('settingsPanel');
  const articleContainer = document.getElementById('articleContainer');
  settingsPanel.classList.toggle('hidden');

  if (settingsPanel.classList.contains('hidden')) {
    articleContainer.style.marginLeft = '0';
  } else {
    articleContainer.style.marginLeft = `${settingsPanel.offsetWidth}px`;
  }
});

document.getElementById('printCheckbox').addEventListener('change', (event) => {
  if (event.target.checked) {
    window.print();
  }
});