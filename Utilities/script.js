/* =========================
   Footnote toggles
   ========================= */
   (function () {
    var footnums = document.getElementsByClassName("footnumber");
    for (var i = 0; i < footnums.length; i++) {
      footnums[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (!content) return;
        content.style.display = (content.style.display === "block") ? "none" : "block";
      });
    }
  })();
  
  /* =========================
     Collapsible sections
     ========================= */
  (function () {
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (!content) return;
        content.style.display = (content.style.display === "block") ? "none" : "block";
      });
    }
  
    // Optional "show all" toggle button
    var toggleBtn = document.querySelector(".showall");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var allColl = document.getElementsByClassName("collapsible");
        var anyClosed = false;
  
        // Check if any are closed
        for (var j = 0; j < allColl.length; j++) {
          if (!allColl[j].classList.contains("active")) { anyClosed = true; break; }
        }
  
        // Open all if any are closed; otherwise close all
        for (var k = 0; k < allColl.length; k++) {
          var btn = allColl[k];
          var content = btn.nextElementSibling;
          if (!content) continue;
          if (anyClosed) {
            btn.classList.add("active");
            content.style.display = "block";
          } else {
            btn.classList.remove("active");
            content.style.display = "none";
          }
        }
      });
    }
  })();
  
  /* =========================
     Language column toggles
     ========================= */
  (function () {
    var toggleEn = document.getElementById('toggle-english');
    var toggleLa = document.getElementById('toggle-latin');
  
    if (toggleEn) {
      toggleEn.addEventListener('change', function () {
        toggleColumn('english', this.checked);
      });
    }
    if (toggleLa) {
      toggleLa.addEventListener('change', function () {
        toggleColumn('latin', this.checked);
      });
    }
  
    function toggleColumn(className, show) {
      var cells = document.getElementsByClassName(className);
      for (var i = 0; i < cells.length; i++) {
        if (show) {
          cells[i].classList.remove('hide-column');
          cells[i].classList.remove('hidecolumn'); // back-compat
        } else {
          cells[i].classList.add('hide-column');
        }
      }
    }
  })();
  
  /* =========================
     Global Text Size Slider
     ========================= */
  (function () {
    var slider = document.getElementById('fontSizeSlider');
    var output = document.getElementById('fontSizeOutput');
    if (!slider) return;
  
    var LS_KEY = 'baseFontSizePx';
    var min = parseInt(slider.min || '14', 10);
    var max = parseInt(slider.max || '32', 10);
    var def = parseInt(slider.value || '16', 10);
  
    // Load saved value and clamp to [min, max]
    var savedRaw = localStorage.getItem(LS_KEY);
    var saved = savedRaw != null ? parseInt(savedRaw, 10) : def;
    if (Number.isNaN(saved)) saved = def;
    saved = Math.min(Math.max(saved, min), max);
  
    applyFontSize(saved);
    slider.value = String(saved);
    updateOutput(saved);
  
    var raf;
    slider.addEventListener('input', function (e) {
      var val = parseInt(e.target.value, 10);
      if (Number.isNaN(val)) return;
      val = Math.min(Math.max(val, min), max);
      updateOutput(val);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        applyFontSize(val);
        try { localStorage.setItem(LS_KEY, String(val)); } catch (err) {}
      });
    });
  
    function applyFontSize(px) {
      document.documentElement.style.setProperty('--base-font-size', px + 'px');
    }
  
    function updateOutput(px) {
      if (output) output.textContent = px + 'px';
    }
  })();
  
  /* =========================
     Back to Top (in sticky bar)
     ========================= */
  (function () {
    var topBtn = document.getElementById('backToTopBtn');
    if (!topBtn) return;
    topBtn.addEventListener('click', function () {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    });
  })();
  
  /* =========================
     Simple Title Search (embedded index, no fetch)
     ========================= */
  (function () {
    var form = document.getElementById('siteSearchForm');
    var input = document.getElementById('siteSearchInput');
    var results = document.getElementById('siteSearchResults');
    if (!form || !input || !results) {
      // If search UI is not on this page, do nothing.
      return;
    }
  
    var cache = null;
  
    function normalize(s) { return (s || '').toLowerCase().trim(); }
  
    function render(items, q) {
      var nq = normalize(q);
      if (!nq) {
        results.innerHTML = '<div class="empty"></div>';
        return;
      }
      if (!items || items.length === 0) {
        var safe = q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').trim();
        results.innerHTML = `<div class="empty">No results for &ldquo;${safe}&rdquo;</div>`;
                return;
      }
      results.innerHTML = items.map(function (it) {
        var metaBits = [];
        if (it.author) metaBits.push(it.author);
        if (it.year) metaBits.push(it.year);
        if (it.tags && it.tags.length) metaBits.push(it.tags.join(', '));
        var meta = metaBits.length ? '<div class="meta">' + metaBits.join(' • ') + '</div>' : '';
        return '<div class="result">' +
                 '<a href="' + it.url + '">' + it.title + '</a>' +
                 meta +
               '</div>';
      }).join('');
    }
  
    function search(q) {
      if (!cache) return;
      var nq = normalize(q);
      if (!nq) { render([], ''); return; }
      var items = cache.filter(function (it) {
        var inTitle = normalize(it.title).indexOf(nq) !== -1;
        var inAuthor = it.author ? normalize(it.author).indexOf(nq) !== -1 : false;
        var inTags = Array.isArray(it.tags) ? it.tags.some(function (tag) { return normalize(tag).indexOf(nq) !== -1; }) : false;
        return inTitle || inAuthor || inTags;
      });
      items.sort(function (a, b) {
        var aTitle = normalize(a.title).indexOf(nq);
        var bTitle = normalize(b.title).indexOf(nq);
        if (aTitle !== -1 && bTitle === -1) return -1;
        if (bTitle !== -1 && aTitle === -1) return 1;
        return a.title.localeCompare(b.title);
      });
      render(items, q);
    }
  
    function init() {
      var el = document.getElementById('site-search-index');
      if (!el) {
        results.innerHTML = '<div class="empty">Search unavailable</div>';
        return;
      }
      try {
        var data = JSON.parse(el.textContent);
        cache = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('[search] failed to parse embedded index', e);
        results.innerHTML = '<div class="empty">Search unavailable</div>';
        return;
      }
      render([], '');
    }
  
    // Prevent submit reload and bind input
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      search(input.value);
    });
    input.addEventListener('input', function () {
      search(input.value);
    });
  
    init();
  })();
