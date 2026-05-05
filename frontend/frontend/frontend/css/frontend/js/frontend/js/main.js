// ─── STATE ───
let currentCategory = 'trending';

// ─── ON LOAD ───
document.addEventListener('DOMContentLoaded', () => {
  loadHomePage();
});

async function loadHomePage() {
  await Promise.all([
    loadShorts('shortsGrid'),
    loadVideos('videoGrid', 'trending'),
    loadShorts('shortsGrid2'),
    loadVideos('videoGrid2', 'popular')
  ]);
}

async function loadShorts(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  
  const [igData, ttData] = await Promise.all([
    fetchAPI('/ig/trending'),
    fetchAPI('/tt/trending')
  ]);
  
  let all = [];
  if (igData?.videos?.length) {
    all.push(...igData.videos.map(v => ({...v, platform: 'instagram'})));
  }
  if (ttData?.videos?.length) {
    all.push(...ttData.videos.map(v => ({...v, platform: 'tiktok'})));
  }
  
  all.sort(() => Math.random() - 0.5);
  
  if (!all.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-video"></i><p>No shorts available. Try again later.</p></div>';
    return;
  }
  
  container.innerHTML = all.slice(0, 12).map((v, i) => createShortCardHTML(v, i)).join('');
}

async function loadVideos(containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  
  let endpoint;
  if (type === 'popular') {
    endpoint = '/yt/popular';
  } else {
    const catMap = {
      trending: 'default', music: 'music', gaming: 'gaming',
      movies: 'movies', comedy: 'comedy', sports: 'sports',
      education: 'education', news: 'news'
    };
    endpoint = `/yt/trending?type=${catMap[currentCategory] || 'default'}&region=BD`;
  }
  
  const data = await fetchAPI(endpoint);
  const videos = data?.videos || [];
  
  if (!videos.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-play-circle"></i><p>No videos found.</p></div>';
    return;
  }
  
  container.innerHTML = videos.slice(0, 12).map((v, i) => createVideoCardHTML(v, i)).join('');
}

// ─── CATEGORY SWITCH ───
function switchCat(type, btn) {
  if (btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  currentCategory = type;
  loadVideos('videoGrid', type);
}

// ─── SEARCH ───
async function searchVideos() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  
  const data = await fetchAPI('/yt/search?q=' + encodeURIComponent(q));
  const videos = data?.videos || [];
  const grid = document.getElementById('videoGrid');
  
  if (!videos.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No results for "${q}"</p></div>`;
    return;
  }
  grid.innerHTML = videos.slice(0, 18).map((v, i) => createVideoCardHTML(v, i)).join('');
}

// ─── LOAD MORE ───
async function loadAllMore() {
  await Promise.all([
    loadShorts('shortsGrid2'),
    loadVideos('videoGrid2', currentCategory)
  ]);
}

// ─── UI HELPERS ───
function scrollToTop() { window.scrollTo({top: 0, behavior: 'smooth'}); }

function toggleMobileSearch() {
  const bar = document.getElementById('searchBar');
  bar.classList.toggle('mobile-show');
  if (bar.classList.contains('mobile-show')) {
    document.getElementById('searchInput').focus();
  }
}

function refreshFeed() {
  document.getElementById('shortsGrid').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  document.getElementById('videoGrid').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  loadHomePage();
  scrollToTop();
}

// ─── PLAYER (for inline opening from cards) ───
let currentVideo = null;
let isLiked = false;

function openPlayer(video) {
  currentVideo = video;
  
  const overlay = document.getElementById('playerOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  // Set video info
  document.getElementById('playerTitle').textContent = video.title || 'Untitled';
  document.getElementById('authorName').textContent = video.author || video.username || 'Unknown';
  document.getElementById('authorSubs').textContent = (video.platform || 'Video') + ' Creator';
  document.getElementById('statViews').textContent = fmt(video.viewCount || video.playCount);
  document.getElementById('statLikes').textContent = fmt(video.likeCount);
  document.getElementById('statDuration').textContent = video.duration ? fmtDuration(video.duration) : (video.lengthSeconds ? fmtDuration(video.lengthSeconds) : '0:00');
  document.getElementById('statPublished').textContent = video.publishedText || 'Recently';
  document.getElementById('videoDescription').textContent = video.description || 'No description available.';
  document.getElementById('statComments').textContent = fmt(video.commentCount || 0);
  
  // Video URL (proxied)
  let videoUrl = video.videoUrl || video.url || '';
  const playerVideo = document.getElementById('playerVideo');
  
  if (videoUrl) {
    playerVideo.src = API_BASE + '/proxy/video?url=' + encodeURIComponent(videoUrl);
  } else if (video.videoId) {
    playerVideo.src = API_BASE + '/yt/stream/' + video.videoId;
  } else {
    playerVideo.src = '';
  }
  
  // Author avatar
  if (video.authorThumbnails?.length) {
    document.getElementById('authorAvatar').innerHTML = `<img src="${API_BASE + '/proxy/image?url=' + encodeURIComponent(video.authorThumbnails[0].url)}">`;
  } else {
    document.getElementById('authorAvatar').innerHTML = '<i class="fas fa-user"></i>';
  }
  
  // Reset like
  isLiked = false;
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i> Like';
  }
  
  // Load comments
  loadComments(video);
}

function closePlayer() {
  const overlay = document.getElementById('playerOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  const playerVideo = document.getElementById('playerVideo');
  if (playerVideo) {
    playerVideo.pause();
    playerVideo.src = '';
  }
  currentVideo = null;
}

async function loadComments(video) {
  const container = document.getElementById('commentsList');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  
  let data = null;
  if (video.videoId) {
    data = await fetchAPI('/yt/comments/' + video.videoId);
  }
  
  const comments = data?.comments || [];
  document.getElementById('commentCount').textContent = `(${fmt(data?.commentCount || comments.length || 0)})`;
  
  if (!comments.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">No comments available.</div>';
    return;
  }
  
  container.innerHTML = comments.slice(0, 20).map(c => `
    <div class="comment-item">
      <div class="comment-avatar">
        ${c.authorThumbnails?.length ? `<img src="${API_BASE + '/proxy/image?url=' + encodeURIComponent(c.authorThumbnails[0].url)}">` : '<i class="fas fa-user"></i>'}
      </div>
      <div class="comment-body">
        <div class="comment-author">${c.author || 'User'} <span class="comment-time">${c.publishedText || ''}</span></div>
        <div class="comment-text">${c.content || c.contentHtml || ''}</div>
        <div class="comment-actions">
          <span><i class="fas fa-thumbs-up"></i> ${fmt(c.likeCount)}</span>
          <span><i class="fas fa-reply"></i> Reply</span>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleLike() {
  isLiked = !isLiked;
  const btn = document.getElementById('likeBtn');
  if (btn) {
    btn.classList.toggle('liked');
    btn.innerHTML = isLiked ? '<i class="fas fa-thumbs-up"></i> Liked' : '<i class="fas fa-thumbs-up"></i> Like';
  }
}

function shareVideo() {
  if (currentVideo?.title) {
    const text = `Watch "${currentVideo.title}" on Nyxora!`;
    if (navigator.share) {
      navigator.share({ title: 'Nyxora', text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
    }
  }
}

function downloadVideo() {
  const videoUrl = currentVideo?.videoUrl || currentVideo?.url;
  if (videoUrl) {
    const a = document.createElement('a');
    a.href = API_BASE + '/proxy/video?url=' + encodeURIComponent(videoUrl);
    a.download = (currentVideo.title || 'video').replace(/[^a-zA-Z0-9]/g, '_') + '.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    // Try from player
    const playerVideo = document.getElementById('playerVideo');
    if (playerVideo?.src) {
      const a = document.createElement('a');
      a.href = playerVideo.src;
      a.download = (currentVideo?.title || 'video').replace(/[^a-zA-Z0-9]/g, '_') + '.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      alert('No video source to download.');
    }
  }
}

// ─── KEYBOARD ───
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePlayer();
});

// ─── AUTO-REFRESH every 5 min ───
setInterval(() => {
  if (!document.getElementById('playerOverlay')?.classList.contains('active')) {
    loadHomePage();
  }
}, 300000);
