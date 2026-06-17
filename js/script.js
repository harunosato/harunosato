  // Header
  const hdr = document.getElementById('site-header');
  const btt = document.getElementById('btt');
  window.addEventListener('scroll', () => {
    hdr.classList.toggle('scrolled', window.scrollY > 20);
    btt.classList.toggle('visible', window.scrollY > 300);
  });

  // Hamburger
  const hbtn = document.getElementById('hamburger-btn');
  const mnav = document.getElementById('mobile-nav');
  hbtn.addEventListener('click', () => {
    hbtn.classList.toggle('open');
    mnav.classList.toggle('open');
    document.body.style.overflow = mnav.classList.contains('open') ? 'hidden' : '';
  });
  function closeMNav() {
    hbtn.classList.remove('open'); mnav.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.addEventListener('click', e => {
    if (!hdr.contains(e.target) && !mnav.contains(e.target)) closeMNav();
  });

  // Nav highlight
  const navLinks = document.querySelectorAll('.global-nav a');
  new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) navLinks.forEach(l => {
        l.style.color = l.getAttribute('href')?.replace('#','') === en.target.id ? 'var(--primary)' : '';
      });
    });
  }, { rootMargin:'-30% 0px -60% 0px' }).observe;
  document.querySelectorAll('section[id]').forEach(s => {
    new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) navLinks.forEach(l => {
          l.style.color = l.getAttribute('href')?.replace('#','') === en.target.id ? 'var(--primary)' : '';
        });
      });
    }, { rootMargin:'-30% 0px -60% 0px' }).observe(s);
  });

  // Modal
  function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
  }
  function overlayClose(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  });

  // ─── 新着情報：Google Sheets CSV 読み込み ───
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfpvkAt0N1sXK0KMJLB1nsggjy1TF-_lOiF1O3Oh1Wt1BasMlH4HPQYo6XQee3X4wmsco3Q5AYUPz6/pub?output=csv';

  const PROXIES = [
    u => u,                                                        // 直接
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,        // proxy1
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, // proxy2
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, // proxy3
  ];

  const TAG_MAP = {
    'お知らせ'  : 'tag-n',
    '行事'      : 'tag-e',
    'デイサービス': 'tag-ds',
    '訪問介護'  : 'tag-hv',
    '採用情報'  : 'tag-r',
    'イベント'  : 'tag-e',
    'メディア'  : 'tag-n',
    'その他'    : 'tag-ot',
  };

  function parseCSV(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cols = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c==='"') { if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ; }
        else if (c===','&&!inQ) { cols.push(cur); cur=''; }
        else cur+=c;
      }
      cols.push(cur); rows.push(cols);
    }
    return rows;
  }

  function driveImgUrl(url) {
    if (!url) return '';
    // Gyazo ページURL → 直接画像URLに自動変換
    // 例: gyazo.com/abc123 → i.gyazo.com/abc123.png
    if (url.includes('gyazo.com/') && !url.includes('i.gyazo.com')) {
      const hash = url.split('gyazo.com/')[1].split('?')[0];
      return `https://i.gyazo.com/${hash}.png`;
    }
    // i.gyazo.com の直接URLはそのまま
    if (url.includes('i.gyazo.com')) return url;
    // 通常のURL（imgur等）はそのまま使用
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com')) return url;
    // Google Drive → thumbnail形式に変換
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
    return url;
  }

  async function fetchWithFallback() {
    for (const proxy of PROXIES) {
      try {
        const res = await fetch(proxy(SHEET_URL), { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const text = await res.text();
          // CSV らしいか簡易チェック（ヘッダー行に「日付」が含まれるか）
          if (text.includes('日付') || text.includes(',')) return text;
        }
      } catch(e) { /* 次のプロキシへ */ }
    }
    throw new Error('all proxies failed');
  }

  async function loadNews() {
    try {
      const text  = await fetchWithFallback();
      const rows  = parseCSV(text);
      const items = rows
        .filter(r =>
          r[0]?.trim() &&           // 日付あり
          r[2]?.trim() &&           // タイトルあり
          r[0]?.trim() !== '日付' && // ヘッダー行除外
          r[2]?.trim() !== 'タイトル' // ヘッダー行除外
        );

      document.getElementById('news-loading').style.display = 'none';

      if (items.length === 0) {
        document.getElementById('news-error').style.display = 'block';
        document.getElementById('news-error').textContent = '新着情報はまだありません。';
        return;
      }

      window._newsData = items;
      document.getElementById('news-list').innerHTML = items.map((r, i) => {
        const [date, tag, title,,imgRaw] = r;
        const tc = TAG_MAP[tag?.trim()] || 'tag-n';
        const d = date?.trim() || '';
        const parts = d.split('.');
        const year  = parts[0] || '';
        // 「1月30日」形式に整形
        const mon2  = parts[1] ? parseInt(parts[1], 10) + '月' : '';
        const day2  = parts[2] ? parseInt(parts[2], 10) + '日' : '';
        const day   = mon2 + day2 || d;
        const mon   = year;
        const hasImg = imgRaw?.trim();
        return `<div class="news-item" onclick="openNewsModal(${i})" role="button" tabindex="0">
          <div class="news-date-col">
            <span class="news-year">${mon}</span>
            <span class="news-day">${day}</span>
          </div>
          <div class="news-right">
            <span class="news-tag ${tc}">${tag?.trim()||'お知らせ'}</span>
            <p class="news-title">${title?.trim()||''}</p>
            ${hasImg ? '<span class="news-has-img"><svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="4.5" cy="5.5" r="1" fill="currentColor"/><path d="M1 9l3-3 3 3 2-2 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 写真あり</span>' : ''}
          </div>
        </div>`;
      }).join('');

    } catch(e) {
      document.getElementById('news-loading').style.display = 'none';
      document.getElementById('news-error').style.display = 'block';
    }
  }

  function openNewsModal(idx) {
    const r = window._newsData?.[idx]; if(!r) return;
    const [date, tag, title, body, imgRaw] = r;
    const tc = TAG_MAP[tag?.trim()] || 'tag-n';
    document.getElementById('nm-tag').innerHTML = `<span class="news-tag ${tc}">${tag?.trim()||'お知らせ'}</span>`;
    document.getElementById('nm-title').textContent = title?.trim() || '';
    document.getElementById('nm-date').textContent  = date?.trim()  || '';
    document.getElementById('nm-body').textContent  = body?.trim()  || '';

    // 複数画像対応（|区切り）
    const imgs = (imgRaw||'').split('|').map(u => driveImgUrl(u.trim())).filter(Boolean);
    const gallery = document.getElementById('nm-gallery');
    if (imgs.length === 0) {
      gallery.innerHTML = ''; gallery.className = 'nm-gallery';
      gallery.style.display = 'none';
    } else {
      gallery.style.display = '';
      const cls = ['','g1','g2','g3','g4'][Math.min(imgs.length,4)];
      gallery.className = 'nm-gallery ' + cls;
      gallery.innerHTML = imgs.map((url, i) =>
        `<div class="nm-img-wrap ${i===0&&imgs.length>1 ? 'nm-main' : imgs.length===1 ? 'nm-main' : 'nm-sub'}">
          <img src="${url}" alt="${(title||'')+' '+(i+1)}" loading="lazy"
            onclick="window.open('${url}','_blank')">
        </div>`
      ).join('');
    }
    openModal('news-modal');
  }

  loadNews();


  document.querySelectorAll('.check-pill').forEach(label => {
    const cb = label.querySelector('input');
    cb.addEventListener('change', () => label.classList.toggle('checked', cb.checked));
  });

  // Form submit
  const form       = document.getElementById('contact-form');
  const successDiv = document.getElementById('form-success');
  const submitBtn  = document.getElementById('submit-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const privacy = document.getElementById('privacy-check');
    if (!privacy.checked) {
      privacy.closest('div').style.outline = '2px solid var(--primary)';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" style="animation:spin 1s linear infinite"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" stroke-width="2"/><path d="M8 2a6 6 0 016 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> 送信中...';
    try {
      const res = await fetch(form.action, { method:'POST', body:new FormData(form), headers:{'Accept':'application/json'} });
      if (res.ok) {
        form.style.display = 'none';
        successDiv.style.display = 'block';
      } else throw new Error();
    } catch {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 3l5 5-5 5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 送信する';
      alert('送信に失敗しました。お電話（029-229-2623）にてご連絡ください。');
    }
  });
