// ─── API CONFIG ───
// ⚠️ CHANGE THIS TO YOUR CLOUDFLARE WORKER URL
const API_BASE = 'https://nyxora-worker.your-subdomain.workers.dev';

// ─── FORMAT NUMBERS ───
function fmt(n) {
  if (n === null || n === undefined) return '0';
  n = Number(n);
  if (n >= 10000000) return (n / 10000000).toFixed(1) + 'M';
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function fmtDuration(s) {
  if (!s || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + sec.toString().padStart(2, '0');
}

function getPlatformIcon(p) {
  const icons = {
    youtube: 'fab fa-youtube',
    instagram: 'fab fa-instagram',
    tiktok: 'fab fa-tiktok'
  };
  return icons[p] || 'fas fa-video';
}

function getPlatformClass(p) {
  const classes = {
    youtube: 'youtube',
    instagram: 'instagram',
    tiktok: 'tiktok'
  };
  return classes[p] || '';
}

// ─── FETCH API ───
async function fetchAPI(endpoint) {
  try {
    const url = API_BASE + endpoint;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      console.warn(`API ${res.status}: ${endpoint}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('API Error:', endpoint, e.message);
    return null;
  }
}

// ─── VIDEO CARD HTML ───
function createVideoCardHTML(v, index) {
  const thumb = v.thumbnail || '';
  const thumbProxy = thumb ? API_BASE + '/proxy/image?url=' + encodeURIComponent(thumb) : '';
  const delay = (index || 0) * 0.03;
  
  return `<div class="video-card" onclick='openPlayer(${JSON.stringify({...v, platform: 'youtube'}).replace(/'/g, "&#39;")})' style="animation-delay:${delay}s">
    <div class="thumbnail-wrap">
      <img src="${thumbProxy}" alt="${v.title || 'Video'}" loading="lazy" onerror="this.style.display='none'">
      ${v.lengthSeconds ? `<span class="duration-badge">${fmtDuration(v.lengthSeconds)}</span>` : ''}
      <div class="platform-badge youtube"><i class="fab fa-youtube"></i></div>
    </div>
    <div class="card-info">
      <div class="card-title">${v.title || 'Untitled'}</div>
      <div class="card-author"><i class="fas fa-user-circle"></i> ${v.author || 'Unknown'}</div>
      <div class="card-meta">
        <span><i class="fas fa-eye"></i> ${fmt(v.viewCount)}</span>
        <span class="dot"></span>
        <span><i class="fas fa-thumbs-up"></i> ${fmt(v.likeCount)}</span>
        ${v.publishedText ? `<span class="dot"></span><span>${v.publishedText}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function createShortCardHTML(v, index) {
  const thumb = v.thumbnail || v.cover || v.thumb || '';
  const thumbProxy = thumb ? API_BASE + '/proxy/image?url=' + encodeURIComponent(thumb) : '';
  const plat = v.platform || 'instagram';
  const delay = (index || 0) * 0.03;
  
  return `<div class="shorts-card" onclick='openPlayer(${JSON.stringify(v).replace(/'/g, "&#39;")})' style="animation-delay:${delay}s">
    <div class="thumbnail-wrap">
      <img src="${thumbProxy}" alt="${v.title || 'Short'}" loading="lazy" onerror="this.style.display='none'">
      <div class="platform-badge ${plat}"><i class="${getPlatformIcon(plat)}"></i></div>
    </div>
    <div class="card-info">
      <div class="card-title">${v.title || 'Untitled'}</div>
      <div class="card-author"><i class="fas fa-user-circle"></i> ${v.author || v.username || 'Unknown'}</div>
      <div class="card-meta">
        <span><i class="fas fa-eye"></i> ${fmt(v.viewCount || v.playCount)}</span>
        <span class="dot"></span>
        <span><i class="fas fa-thumbs-up"></i> ${fmt(v.likeCount)}</span>
      </div>
    </div>
  </div>`;
                                                              }
