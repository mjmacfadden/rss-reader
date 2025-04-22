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
  
    // Add style to images to span full column width
    temp.querySelectorAll("img").forEach(img => {
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.margin = "0.5rem 0";
      img.style.display = "block";
    });
  
    // Truncate long links instead of wrapping
    temp.querySelectorAll("a").forEach(link => {
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
  
      // Add a "Generate Print View" button
      const printBtn = document.createElement("button");
      printBtn.textContent = "Generate Print View";
      printBtn.className = "generate-btn";
      printBtn.addEventListener("click", () => generatePrintView(feedResults));
      selectionContainer.appendChild(printBtn);
  
      // Store feed results for later use
      window.feedResults = feedResults;
  
    } catch (err) {
      selectionContainer.innerHTML = `<p style="color:red;">⚠️ Failed to load one or more feeds: ${err.message}</p>`;
    }
  });
  
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
          <p><a href="${article.link}" target="_blank" title="${article.link}">Read original</a></p>
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