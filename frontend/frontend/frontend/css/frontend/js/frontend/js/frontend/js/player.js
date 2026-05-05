// ─── STANDALONE PLAYER ───
// Complete player logic for player.html
// Supports share, download, like toggle, comments loading

let currentVideo = null;
let isLiked = false;

// Get video data from URL params
const params = new URLSearchParams(window.location.search);
const videoId = params.get('v');
const platform = params.get('p') || 'youtube';
const encodedVideo = params.get('data');

document.addEventListener('DOMContentLoaded', async () => {
  if (encodedVideo) {
    try {
      const videoData = JSON.parse(decodeURIComponent(encodedVideo));
      renderPlayer(videoData);
    } catch (e) {
      console.warn('Failed to parse video data from URL, falling back to API');
      if (videoId) {
        await loadVideoFromAPI(videoId, platform);
      } else {
        document.getElementById('playerTitle').textContent = 'No video specified';
        document.getElementById('videoDescription').textContent = 'Missing video ID. Go back and select a video.';
      }
    }
  } else if (videoId) {
    await loadVideoFromAPI(videoId, platform);
  } else {
    document.getElementById('playerTitle').textContent = 'No video specified';
    document.getElementById('videoDescription').textContent = 'Missing video ID. Go back and select a video.';
    document.getElementById('commentsList').innerHTML = '';
  }
});

// ─── LOAD VIDEO FROM API ───
async function loadVideoFromAPI(id, plat) {
  if (plat === 'youtube' || !plat) {
    const data = await fetchAPI('/yt/video/' + id);
    if (data && data.videoId) {
      renderPlayer(data);
    } else {
      document.getElementById('playerTitle').textContent = 'Video not found';
      document.getElementById('videoDescription').textContent = 'This video could not be loaded. It may have been removed or is unavailable.';
      document.getElementById('commentsList').innerHTML = '';
    }
  } else if (plat === 'instagram' || plat === 'tiktok') {
    // For shorts, the video data should be passed via 'data' param
    document.getElementById('playerTitle').textContent = 'Short video';
    document.getElementById('videoDescription').textContent = 'Pass video data via URL parameter for short-form content.';
    document.getElementById('commentsList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Comments unavailable for this platform.</div>';
  }
}

// ─── RENDER PLAYER ───
function renderPlayer(video) {
  currentVideo = video;
  
  // Title
  document.getElementById('playerTitle').textContent = video.title || 'Untitled';
  
  // Author info
  document.getElementById('authorName').textContent = video.author || 'Unknown';
  document.getElementById('authorSubs').textContent = video.subCountText || (video.platform ? video.platform.charAt(0).toUpperCase() + video.platform.slice(1) + ' Creator' : 'Content Creator');
  
  // Stats
  document.getElementById('statViews').textContent = fmt(video.viewCount);
  document.getElementById('statLikes').textContent = fmt(video.likeCount);
  document.getElementById('statDuration').textContent = video.lengthSeconds ? fmtDuration(video.lengthSeconds) : (video.duration ? fmtDuration(video.duration) : '0:00');
  document.getElementById('statPublished').textContent = video.publishedText || 'Recently';
  document.getElementById('statComments').textContent = fmt(video.commentCount || 0);
  
  // Description
  document.getElementById('videoDescription').textContent = video.description || 'No description available.';
  
  // Set video source
  const playerVideo = document.getElementById('playerVideo');
  let videoSrc = '';
  
  if (video.videoUrl || video.url) {
    // Direct proxied URL (Instagram/TikTok)
    const rawUrl = video.videoUrl || video.url;
    videoSrc = API_BASE + '/proxy/video?url=' + encodeURIComponent(rawUrl);
  } else if (video.videoId) {
    // YouTube via Invidious stream
    videoSrc = API_BASE + '/yt/stream/' + video.videoId;
  }
  
  if (videoSrc) {
    playerVideo.src = videoSrc;
    playerVideo.load();
  } else {
    playerVideo.controls = false;
    playerVideo.poster = '';
    // Show placeholder
  }
  
  // Author avatar
  const avatarContainer = document.getElementById('authorAvatar');
  if (video.authorThumbnails && video.authorThumbnails.length > 0) {
    const avatarUrl = video.authorThumbnails[0].url || video.authorThumbnails[0];
    avatarContainer.innerHTML = `<img src="${API_BASE + '/proxy/image?url=' + encodeURIComponent(avatarUrl)}" alt="Author">`;
  } else {
    avatarContainer.innerHTML = '<i class="fas fa-user"></i>';
  }
  
  // Reset like button
  isLiked = false;
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i> Like';
  }
  
  // Load comments
  loadComments(video);
}

// ─── LOAD COMMENTS ───
async function loadComments(video) {
  const container = document.getElementById('commentsList');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  
  let data = null;
  // Only load comments for YouTube videos
  if (video.videoId && (!video.platform || video.platform === 'youtube')) {
    data = await fetchAPI('/yt/comments/' + video.videoId);
  }
  
  const comments = data?.comments || [];
  const commentCountEl = document.getElementById('commentCount');
  if (commentCountEl) {
    commentCountEl.textContent = `(${fmt(data?.commentCount || comments.length || 0)})`;
  }
  
  if (!comments.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">No comments available for this video.</div>';
    return;
  }
  
  container.innerHTML = comments.slice(0, 25).map((c, i) => `
    <div class="comment-item" style="animation-delay:${i * 0.05}s">
      <div class="comment-avatar">
        ${c.authorThumbnails && c.authorThumbnails.length > 0
          ? `<img src="${API_BASE + '/proxy/image?url=' + encodeURIComponent(c.authorThumbnails[0].url || c.authorThumbnails[0])}" alt="">`
          : '<i class="fas fa-user"></i>'}
      </div>
      <div class="comment-body">
        <div class="comment-author">
          ${c.author || 'User'}
          <span class="comment-time">${c.publishedText || ''}</span>
        </div>
        <div class="comment-text">${c.content || c.contentHtml || ''}</div>
        <div class="comment-actions">
          <span><i class="fas fa-thumbs-up"></i> ${fmt(c.likeCount)}</span>
          <span><i class="fas fa-reply"></i> Reply</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── TOGGLE LIKE ───
function toggleLike() {
  isLiked = !isLiked;
  const btn = document.getElementById('likeBtn');
  if (!btn) return;
  
  if (isLiked) {
    btn.classList.add('liked');
    btn.innerHTML = '<i class="fas fa-thumbs-up"></i> Liked';
    // Optional: visual feedback
    btn.style.transform = 'scale(1.05)';
    setTimeout(() => { btn.style.transform = ''; }, 200);
  } else {
    btn.classList.remove('liked');
    btn.innerHTML = '<i class="fas fa-thumbs-up"></i> Like';
  }
}

// ─── SHARE VIDEO ───
function shareVideo() {
  if (!currentVideo) {
    alert('No video to share.');
    return;
  }
  
  const title = currentVideo.title || 'Nyxora Video';
  const url = window.location.href;
  const text = `Watch "${title}" on Nyxora! 🎬`;
  
  // Use Web Share API if available (mobile)
  if (navigator.share) {
    navigator.share({
      title: 'Nyxora',
      text: text,
      url: url
    }).catch(err => {
      // User cancelled or error - fallback silently
      if (err.name !== 'AbortError') {
        console.warn('Share failed:', err);
        fallbackCopyLink(url);
      }
    });
  } else {
    // Desktop fallback: copy link
    fallbackCopyLink(url);
  }
}

// ─── FALLBACK COPY LINK ───
function fallbackCopyLink(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
    }).catch(() => {
      // Final fallback
      manualCopyFallback(url);
    });
  } else {
    manualCopyFallback(url);
  }
}

// ─── MANUAL COPY FALLBACK ───
function manualCopyFallback(url) {
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('Link copied!');
    } else {
      // If execCommand fails, show the URL directly
      prompt('Copy this link:', url);
    }
  } catch (e) {
    prompt('Copy this link:', url);
  }
  
  document.body.removeChild(textarea);
}

// ─── DOWNLOAD VIDEO ───
function downloadVideo() {
  if (!currentVideo) {
    showToast('No video available to download.');
    return;
  }
  
  // Determine the best video URL to download
  let downloadUrl = null;
  let filename = (currentVideo.title || 'nyxora_video')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50) + '.mp4';
  
  // Priority 1: direct videoUrl (already proxied path)
  if (currentVideo.videoUrl) {
    downloadUrl = API_BASE + '/proxy/video?url=' + encodeURIComponent(currentVideo.videoUrl);
  }
  // Priority 2: video.url
  else if (currentVideo.url) {
    downloadUrl = API_BASE + '/proxy/video?url=' + encodeURIComponent(currentVideo.url);
  }
  // Priority 3: current playing video source
  else {
    const playerVideo = document.getElementById('playerVideo');
    if (playerVideo && playerVideo.src && playerVideo.src.startsWith('http')) {
      downloadUrl = playerVideo.src;
    }
  }
  
  if (downloadUrl) {
    // Create an anchor element and trigger download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    
    // Click the anchor to start download
    try {
      a.click();
      showToast('Download starting...');
    } catch (e) {
      // If direct download fails, open in new tab
      window.open(downloadUrl, '_blank');
    }
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1000);
  } else {
    // Last resort: try to get stream URL from API
    if (currentVideo.videoId && (!currentVideo.platform || currentVideo.platform === 'youtube')) {
      const streamUrl = API_BASE + '/yt/stream/' + currentVideo.videoId;
      const a = document.createElement('a');
      a.href = streamUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Download starting...');
    } else {
      showToast('No downloadable source available for this video.');
    }
  }
}

// ─── TOAST NOTIFICATION ───
function showToast(message) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #fff;
      padding: 12px 24px;
      border-radius: 100px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      border: 1px solid #333;
      z-index: 9999;
      animation: toastIn 0.3s ease;
      backdrop-filter: blur(10px);
    ">${message}</div>
  `;
  
  // Add animation keyframes if not already present
  if (!document.querySelector('#toastStyles')) {
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toastOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Auto remove after 2.5 seconds
  setTimeout(() => {
    const toastEl = document.querySelector('.toast-notification');
    if (toastEl) {
      const inner = toastEl.querySelector('div');
      if (inner) {
        inner.style.animation = 'toastOut 0.3s ease forwards';
      }
      setTimeout(() => toastEl.remove(), 300);
    }
  }, 2500);
}

// ─── KEYBOARD SHORTCUTS ───
document.addEventListener('keydown', (e) => {
  // Escape to go back
  if (e.key === 'Escape') {
    window.history.back();
  }
  
  // 'L' key to toggle like
  if (e.key === 'l' || e.key === 'L') {
    if (!e.ctrlKey && !e.metaKey) {
      toggleLike();
    }
  }
  
  // 'D' key to download
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey) {
      downloadVideo();
    }
  }
  
  // 'S' key to share
  if (e.key === 's' || e.key === 'S') {
    if (!e.ctrlKey && !e.metaKey) {
      shareVideo();
    }
  }
});

// ─── HANDLE VIDEO PLAYER ERRORS ───
document.addEventListener('DOMContentLoaded', () => {
  const playerVideo = document.getElementById('playerVideo');
  if (playerVideo) {
    playerVideo.addEventListener('error', (e) => {
      console.warn('Video playback error:', e);
      // Try alternative source if available
      if (currentVideo && currentVideo.videoId && (!currentVideo.platform || currentVideo.platform === 'youtube')) {
        // Could try different Invidious instance fallback
        console.log('Trying alternative stream method...');
      }
    });
    
    // Track views (optional analytics)
    playerVideo.addEventListener('play', () => {
      console.log('Video playing:', currentVideo?.title || 'Unknown');
    });
  }
});

// ─── PAGE VISIBILITY: Pause video when tab hidden ───
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const playerVideo = document.getElementById('playerVideo');
    if (playerVideo && !playerVideo.paused) {
      playerVideo.pause();
    }
  }
});
