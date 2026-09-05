(() => {
  "use strict";

  const BOOK_ORDER = [
    "Anointing",
    "Baptism",
    "Confirmation",
    "Funerals",
    "Matrimony",
    "OCIA",
    "Ordination",
    "Outside",
    "Penance",
    "Pontifical"
  ];

  const manifest = window.BOOKSCANS_MANIFEST || {};

  const bookSelect = document.getElementById("bookSelect");
  const pageForm = document.getElementById("pageForm");
  const pageInput = document.getElementById("pageInput");
  const pageImage = document.getElementById("pageImage");
  const pageStage = document.getElementById("pageStage");
  const emptyState = document.getElementById("emptyState");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const positionText = document.getElementById("positionText");
  const fileText = document.getElementById("fileText");
  const pageSlider = document.getElementById("pageSlider");
  const sliderBubble = document.getElementById("sliderBubble");

  let currentBook = "";
  let currentIndex = 0;

  function fitImageToStage() {
    if (!pageImage.naturalWidth || !pageImage.naturalHeight) return;

    const styles = getComputedStyle(pageStage);
    const availableWidth =
      pageStage.clientWidth -
      parseFloat(styles.paddingLeft) -
      parseFloat(styles.paddingRight);

    const availableHeight =
      pageStage.clientHeight -
      parseFloat(styles.paddingTop) -
      parseFloat(styles.paddingBottom);

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scale = Math.min(
      availableWidth / pageImage.naturalWidth,
      availableHeight / pageImage.naturalHeight
    );

    pageImage.style.width = `${Math.floor(pageImage.naturalWidth * scale)}px`;
    pageImage.style.height = `${Math.floor(pageImage.naturalHeight * scale)}px`;
  }

  function filesFor(book) {
    return Array.isArray(manifest[book]) ? manifest[book] : [];
  }

  function parseScanName(filename) {
    // Examples:
    // funerals-084.jpg
    // anointing-000a.jpeg
    const m = filename.match(/-(\d{3,})([a-z]*)\.(jpe?g)$/i);
    if (!m) return null;

    return {
      number: Number(m[1]),
      suffix: m[2].toLowerCase()
    };
  }

  function printedPageLabel(filename) {
    const p = parseScanName(filename);
    if (!p) return "";

    if (p.suffix) {
      return `${String(p.number).padStart(3, "0")}${p.suffix}`;
    }

    return `${p.number}–${p.number + 1}`;
  }

  function displayPageLabel(filename) {
    return printedPageLabel(filename);
  }

  function pageNumberForUrl(filename) {
    const p = parseScanName(filename);
    if (!p || p.suffix) return null;
    return p.number;
  }

  function updateUrl() {
    const files = filesFor(currentBook);
    if (!files.length) return;

    const params = new URLSearchParams(window.location.search);
    params.set("book", currentBook);

    const page = pageNumberForUrl(files[currentIndex]);
    if (page !== null) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }

    const newUrl =
      `${window.location.pathname}?${params.toString()}${window.location.hash}`;

    window.history.replaceState(null, "", newUrl);
  }

  function updateSliderBubble(index) {
    const files = filesFor(currentBook);
    if (!files.length) return;

    const safeIndex = Math.max(0, Math.min(index, files.length - 1));
    sliderBubble.textContent = displayPageLabel(files[safeIndex]);

    const max = Math.max(1, files.length - 1);
    const pct = safeIndex / max;

    pageSlider.style.setProperty("--slider-progress", `${pct * 100}%`);

    // Keep the bubble from clipping at either end.
    const inset = 10;
    sliderBubble.style.left =
      `calc(${pct * 100}% + ${inset - (pct * inset * 2)}px)`;
  }

  function indexForPrintedPage(book, rawPage) {
    const wanted = Number(rawPage);
    if (!Number.isInteger(wanted) || wanted < 0) return -1;

    // The scan named -084 contains printed pages 84 and 85.
    const targetEven = wanted % 2 === 0 ? wanted : wanted - 1;
    const files = filesFor(book);

    // Prefer the normal, unsuffixed page.
    let index = files.findIndex(filename => {
      const p = parseScanName(filename);
      return p && p.number === targetEven && p.suffix === "";
    });

    // Fallback if only a suffixed form exists.
    if (index < 0) {
      index = files.findIndex(filename => {
        const p = parseScanName(filename);
        return p && p.number === targetEven;
      });
    }

    return index;
  }

  function populateBooks() {
    bookSelect.innerHTML = "";

    for (const book of BOOK_ORDER) {
      const opt = document.createElement("option");
      opt.value = book;
      opt.textContent = book;
      bookSelect.appendChild(opt);
    }

    const params = new URLSearchParams(window.location.search);
    const requestedBook = params.get("book");
    const savedBook = localStorage.getItem("bookscans-book");

    if (requestedBook && BOOK_ORDER.includes(requestedBook)) {
      currentBook = requestedBook;
    } else if (BOOK_ORDER.includes(savedBook)) {
      currentBook = savedBook;
    } else {
      currentBook = BOOK_ORDER[0];
    }

    bookSelect.value = currentBook;
  }

  function initialIndexForBook(book) {
    const params = new URLSearchParams(window.location.search);
    const requestedPage = params.get("page");

    // A page in the URL takes priority over the remembered position.
    if (requestedPage !== null) {
      const index = indexForPrintedPage(book, requestedPage);
      if (index >= 0) return index;
    }

    const savedIndex = Number(localStorage.getItem(`bookscans-index-${book}`));
    return Number.isFinite(savedIndex) ? savedIndex : 0;
  }

  function render(direction = 0, { updateAddress = true } = {}) {
    const files = filesFor(currentBook);

    if (!files.length) {
      pageImage.removeAttribute("src");
      pageImage.hidden = true;
      emptyState.hidden = false;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      positionText.textContent = "";
      fileText.textContent = `${currentBook}: no files listed in manifest.js`;

      pageSlider.min = "0";
      pageSlider.max = "0";
      pageSlider.value = "0";
      pageSlider.disabled = true;
      return;
    }

    emptyState.hidden = true;
    pageImage.hidden = false;

    currentIndex = Math.max(0, Math.min(currentIndex, files.length - 1));
    const filename = files[currentIndex];

    if (direction) {
      pageImage.classList.remove("turning-left", "turning-right");
      void pageImage.offsetWidth;
      pageImage.classList.add(
        direction < 0 ? "turning-left" : "turning-right"
      );
    }

    const src =
      `${encodeURIComponent(currentBook)}/` +
      filename.split("/").map(encodeURIComponent).join("/");

    const preload = new Image();

    preload.onload = () => {
      pageImage.onload = () => {
        fitImageToStage();
      };

      pageImage.src = src;
      pageImage.alt = `${currentBook}, scan ${printedPageLabel(filename)}`;

      requestAnimationFrame(() => {
        pageImage.classList.remove("turning-left", "turning-right");
      });
    };

    preload.onerror = () => {
      pageImage.removeAttribute("src");
      pageImage.alt = "";
      fileText.textContent = `Could not load ${currentBook}/${filename}`;
    };

    preload.src = src;

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === files.length - 1;

    positionText.textContent = `Pages ${displayPageLabel(filename)}`;
    fileText.textContent =
      `${currentBook}/${filename}  ·  printed pages ${displayPageLabel(filename)}`;

    pageSlider.disabled = false;
    pageSlider.min = "0";
    pageSlider.max = String(Math.max(0, files.length - 1));
    pageSlider.value = String(currentIndex);
    updateSliderBubble(currentIndex);

    localStorage.setItem("bookscans-book", currentBook);
    localStorage.setItem(
      `bookscans-index-${currentBook}`,
      String(currentIndex)
    );

    if (updateAddress) {
      updateUrl();
    }
  }

  function changeBook(book, { useUrlPage = false } = {}) {
    currentBook = book;

    if (useUrlPage) {
      currentIndex = initialIndexForBook(book);
    } else {
      const savedIndex = Number(
        localStorage.getItem(`bookscans-index-${book}`)
      );
      currentIndex = Number.isFinite(savedIndex) ? savedIndex : 0;
    }

    bookSelect.value = currentBook;
    render();
  }

  function go(delta) {
    const files = filesFor(currentBook);
    const next = currentIndex + delta;

    if (next < 0 || next >= files.length) return;

    currentIndex = next;
    render(delta);
  }

  function goToPrintedPage(raw) {
    const wanted = Number(raw);

    if (!Number.isInteger(wanted) || wanted < 0) return;

    const index = indexForPrintedPage(currentBook, wanted);

    if (index >= 0) {
      const direction =
        index < currentIndex ? -1 :
        index > currentIndex ? 1 :
        0;

      currentIndex = index;
      render(direction);
      pageInput.select();
    } else {
      const targetEven = wanted % 2 === 0 ? wanted : wanted - 1;

      pageInput.setCustomValidity(
        `No scan for printed page ${wanted} ` +
        `(expected ${String(targetEven).padStart(3, "0")}).`
      );

      pageInput.reportValidity();

      window.setTimeout(() => {
        pageInput.setCustomValidity("");
      }, 1800);
    }
  }

  bookSelect.addEventListener("change", () => {
    // When the user manually changes books, use that book's remembered place.
    // The current ?page= value should not force the same page in the new book.
    changeBook(bookSelect.value, { useUrlPage: false });
  });

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  pageForm.addEventListener("submit", event => {
    event.preventDefault();
    goToPrintedPage(pageInput.value);
  });

  let sliderEngaged = false;

  function engageSlider() {
    sliderEngaged = true;
    sliderBubble.hidden = false;
    updateSliderBubble(Number(pageSlider.value));
  }

  function disengageSlider() {
    sliderEngaged = false;
    sliderBubble.hidden = true;
  }

  pageSlider.addEventListener("pointerdown", engageSlider);
  pageSlider.addEventListener("mousedown", engageSlider);
  pageSlider.addEventListener("touchstart", engageSlider, { passive: true });

  pageSlider.addEventListener("input", () => {
    const index = Number(pageSlider.value);
    updateSliderBubble(index);

    if (!sliderEngaged) {
      sliderEngaged = true;
      sliderBubble.hidden = false;
    }

    if (index !== currentIndex) {
      const direction = index < currentIndex ? -1 : 1;
      currentIndex = index;
      render(direction);
      sliderBubble.hidden = false;
    }
  });

  pageSlider.addEventListener("change", () => {
    window.setTimeout(disengageSlider, 100);
  });

  window.addEventListener("pointerup", disengageSlider);
  window.addEventListener("mouseup", disengageSlider);
  window.addEventListener("touchend", disengageSlider);

  document.addEventListener("keydown", event => {
    if (document.activeElement === pageInput) return;

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      go(-1);
    } else if (
      event.key === "ArrowRight" ||
      event.key === "PageDown" ||
      event.key === " "
    ) {
      event.preventDefault();
      go(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      currentIndex = 0;
      render(-1);
    } else if (event.key === "End") {
      event.preventDefault();
      const files = filesFor(currentBook);
      currentIndex = Math.max(0, files.length - 1);
      render(1);
    }
  });

  pageStage.addEventListener("click", event => {
    if (event.target !== pageImage) return;

    const rect = pageStage.getBoundingClientRect();
    go(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });

  window.addEventListener("resize", fitImageToStage);

  populateBooks();

  // On first load, honor both ?book= and ?page=.
  changeBook(currentBook, { useUrlPage: true });
})();
