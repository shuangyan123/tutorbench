/* global HTMLAnchorElement, HTMLButtonElement, HTMLFormElement, HTMLInputElement, HTMLSelectElement, HTMLElement, URL, URLSearchParams, document, history, navigator, window */

(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-navigation");

  if (navToggle instanceof HTMLButtonElement && nav instanceof HTMLElement) {
    navToggle.addEventListener("click", () => {
      const isOpen = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!isOpen));
      navToggle.setAttribute("aria-expanded", String(!isOpen));
    });
  }

  const prefetchedRoutes = new Set();
  function prefetchRoute(link) {
    if (!(link instanceof HTMLAnchorElement)) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname || prefetchedRoutes.has(url.href)) return;
    prefetchedRoutes.add(url.href);
    const prefetch = document.createElement("link");
    prefetch.rel = "prefetch";
    prefetch.href = url.href;
    prefetch.as = "document";
    document.head.append(prefetch);
  }

  document.querySelectorAll("#primary-navigation a[href]").forEach((link) => {
    link.addEventListener("pointerenter", () => prefetchRoute(link), { once: true });
    link.addEventListener("focus", () => prefetchRoute(link), { once: true });
    link.addEventListener("touchstart", () => prefetchRoute(link), { once: true, passive: true });
  });

  const localeSwitcher = document.querySelector("[data-locale-switcher]");
  const localeStorageKey = "tutor-benchmark-ui-locale";

  function isSiteLocale(value) {
    return value === "en" || value === "zh-CN";
  }

  function storedLocale() {
    try {
      const value = window.localStorage.getItem(localeStorageKey);
      return isSiteLocale(value) ? value : null;
    } catch {
      return null;
    }
  }

  function applyLocale(locale) {
    if (!isSiteLocale(locale)) {
      return;
    }
    document.documentElement.lang = locale;
    document.documentElement.dataset.uiLocale = locale;
    document.querySelectorAll("[data-ui-text]").forEach((element) => {
      const attribute = locale === "zh-CN" ? "data-ui-text-zh-cn" : "data-ui-text-en";
      const translated = element.getAttribute(attribute);
      if (translated !== null) {
        element.textContent = translated;
      }
    });
    document.querySelectorAll("[data-ui-option-en]").forEach((element) => {
      const attribute = locale === "zh-CN" ? "data-ui-option-zh-cn" : "data-ui-option-en";
      const translated = element.getAttribute(attribute);
      if (translated !== null) {
        element.textContent = translated;
      }
    });
    document.querySelectorAll("[data-ui-aria-en]").forEach((element) => {
      const attribute = locale === "zh-CN" ? "data-ui-aria-zh-cn" : "data-ui-aria-en";
      const translated = element.getAttribute(attribute);
      if (translated !== null) {
        element.setAttribute("aria-label", translated);
      }
    });
    document.querySelectorAll("[data-ui-title-en]").forEach((element) => {
      const attribute = locale === "zh-CN" ? "data-ui-title-zh-cn" : "data-ui-title-en";
      const translated = element.getAttribute(attribute);
      if (translated !== null) {
        element.setAttribute("title", translated);
      }
    });
    document.querySelectorAll("[data-case-count-value]").forEach((element) => {
      const templateAttribute = locale === "zh-CN"
        ? "data-case-count-template-zh-cn"
        : "data-case-count-template-en";
      const template = element.getAttribute(templateAttribute) ?? "Showing {count} cases";
      const count = element.getAttribute("data-case-count-value") ?? "0";
      const start = element.getAttribute("data-case-count-start") ?? "0";
      const end = element.getAttribute("data-case-count-end") ?? count;
      element.textContent = template.replaceAll("{start}", start).replaceAll("{end}", end).replaceAll("{count}", count);
    });
    if (localeSwitcher instanceof HTMLSelectElement) {
      localeSwitcher.value = locale;
      const label = document.querySelector('[data-ui-text="selectLanguage"]');
      if (label instanceof HTMLElement && label.textContent !== null) {
        localeSwitcher.setAttribute("aria-label", label.textContent);
      }
    }
  }

  const initialLocale = storedLocale() ?? document.documentElement.dataset.uiLocale ?? "en";
  applyLocale(initialLocale);
  if (localeSwitcher instanceof HTMLSelectElement) {
    localeSwitcher.addEventListener("change", () => {
      const locale = localeSwitcher.value;
      if (!isSiteLocale(locale)) {
        return;
      }
      try {
        window.localStorage.setItem(localeStorageKey, locale);
      } catch {
        // A private browsing policy may deny storage; the current page still switches.
      }
      document.documentElement.classList.add("locale-transition");
      applyLocale(locale);
      window.setTimeout(() => document.documentElement.classList.remove("locale-transition"), 180);
    });
  }

  const filterForm = document.querySelector("#case-filters");
  if (!(filterForm instanceof HTMLFormElement)) {
    return;
  }

  const filterFields = Array.from(
    filterForm.querySelectorAll("input[data-case-filter]"),
  ).filter((field) => field instanceof HTMLInputElement);
  const cards = Array.from(document.querySelectorAll("[data-case-item]"));
  const searchField = document.querySelector("[data-case-search]");
  const sortField = document.querySelector("[data-case-sort]");
  const results = document.querySelector("[data-case-results]");
  const cardGrid = results?.querySelector(".case-card-grid");
  const pagination = document.querySelector("[data-case-pagination]");
  const viewButtons = Array.from(document.querySelectorAll("[data-case-view]"));
  const filterToggle = document.querySelector("[data-case-filter-toggle]");
  const filterPanel = document.querySelector("[data-case-filter-panel]");
  const activeFilterCount = document.querySelector("[data-case-active-filter-count]");
  const filterSummary = document.querySelector("[data-case-filter-summary]");
  const resultCount = document.querySelector("#case-result-count");
  const emptyState = document.querySelector("#case-filter-empty");
  const pageSize = Number(results?.getAttribute("data-page-size") ?? "12") || 12;
  const filterKeys = ["subject", "learnerLevel", "taskDifficulty", "pedagogicalDifficulty", "capability", "studentState", "locale", "disclosurePolicy"];
  let currentPage = 1;

  function readValues() {
    const values = Object.fromEntries(filterKeys.map((key) => [key, []]));
    filterFields.forEach((field) => {
      const key = field.dataset.caseFilter;
      if (key && field.checked && field.value) values[key].push(field.value);
    });
    return values;
  }

  function selectedSearch() {
    return searchField instanceof HTMLInputElement ? searchField.value.trim().toLowerCase() : "";
  }

  function matches(card, values, search) {
    const capabilities = (card.dataset.caseCapabilities ?? "").split(" ");
    const matchesSearch = !search || (card.dataset.caseSearchText ?? "").toLowerCase().includes(search);
    return matchesSearch &&
      (!values.locale.length || values.locale.includes(card.dataset.caseLocale ?? "")) &&
      (!values.subject.length || values.subject.includes(card.dataset.caseSubject ?? "")) &&
      (!values.learnerLevel.length || values.learnerLevel.includes(card.dataset.caseLearnerLevel ?? "")) &&
      (!values.taskDifficulty.length || values.taskDifficulty.includes(card.dataset.caseTaskDifficulty ?? "")) &&
      (!values.pedagogicalDifficulty.length || values.pedagogicalDifficulty.includes(card.dataset.casePedagogicalDifficulty ?? "")) &&
      (!values.capability.length || values.capability.some((value) => capabilities.includes(value))) &&
      (!values.studentState.length || values.studentState.includes(card.dataset.caseStudentState ?? "")) &&
      (!values.disclosurePolicy.length || values.disclosurePolicy.includes(card.dataset.caseDisclosurePolicy ?? ""));
  }

  function updateUrl(values, search, page) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, selected]) => selected.forEach((value) => params.append(key, value)));
    if (search) params.set("q", search);
    if (sortField instanceof HTMLSelectElement && sortField.value !== "case-id-asc") params.set("sort", sortField.value);
    const activeView = viewButtons.find((button) => button.getAttribute("aria-pressed") === "true");
    if (activeView?.getAttribute("data-case-view") === "compact") params.set("view", "compact");
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function renderCount(start, end, count) {
    if (!(resultCount instanceof HTMLElement)) return;
    const uiLocale = document.documentElement.dataset.uiLocale === "zh-CN" ? "zh-CN" : "en";
    const template = resultCount.getAttribute(uiLocale === "zh-CN" ? "data-case-count-template-zh-cn" : "data-case-count-template-en") ?? "Showing {count} cases";
    resultCount.setAttribute("data-case-count-value", String(count));
    resultCount.setAttribute("data-case-count-start", String(start));
    resultCount.setAttribute("data-case-count-end", String(end));
    resultCount.textContent = template.replaceAll("{start}", String(start)).replaceAll("{end}", String(end)).replaceAll("{count}", String(count));
  }

  function renderPagination(total, page) {
    if (!(pagination instanceof HTMLElement)) return;
    pagination.replaceChildren();
    const pageCount = Math.ceil(total / pageSize);
    if (pageCount <= 1) return;
    const addButton = (label, target, disabled = false, current = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "case-page-button";
      button.textContent = label;
      button.disabled = disabled;
      if (current) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => { currentPage = target; update(); });
      pagination.append(button);
    };
    addButton("Previous", Math.max(1, page - 1), page === 1);
    const pageNumbers = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
    let last = 0;
    [...pageNumbers].sort((a, b) => a - b).forEach((number) => {
      if (last && number - last > 1) {
        const ellipsis = document.createElement("span");
        ellipsis.className = "case-page-ellipsis";
        ellipsis.textContent = "…";
        pagination.append(ellipsis);
      }
      addButton(String(number), number, false, number === page);
      last = number;
    });
    addButton("Next", Math.min(pageCount, page + 1), page === pageCount);
  }

  function sortCards() {
    if (!(cardGrid instanceof HTMLElement)) return;
    const sort = sortField instanceof HTMLSelectElement ? sortField.value : "case-id-asc";
    const ordered = [...cards].sort((left, right) => {
      let comparison = (left.dataset.caseId ?? "").localeCompare(right.dataset.caseId ?? "", "en", { numeric: true });
      if (sort === "case-id-desc") comparison *= -1;
      if (sort === "subject") comparison = (left.dataset.caseSubject ?? "").localeCompare(right.dataset.caseSubject ?? "", "en");
      if (sort === "learner-level") comparison = Number(left.dataset.caseLearnerLevel ?? 0) - Number(right.dataset.caseLearnerLevel ?? 0);
      if (sort === "task-difficulty") comparison = Number(left.dataset.caseTaskDifficulty ?? 0) - Number(right.dataset.caseTaskDifficulty ?? 0);
      return comparison || (left.dataset.caseId ?? "").localeCompare(right.dataset.caseId ?? "", "en", { numeric: true });
    });
    ordered.forEach((card) => cardGrid.append(card));
  }

  function updateFilterSummary(values, search) {
    const count = Object.values(values).reduce((total, selected) => total + selected.length, 0) + (search ? 1 : 0);
    if (activeFilterCount instanceof HTMLElement) activeFilterCount.textContent = String(count);
    if (filterSummary instanceof HTMLElement) filterSummary.textContent = count === 0 ? "All cases" : `${count} active ${count === 1 ? "filter" : "filters"}`;
  }

  function update(syncUrl = true) {
    const values = readValues();
    const search = selectedSearch();
    const matchingCards = cards.filter((card) => matches(card, values, search));
    const pageCount = Math.max(1, Math.ceil(matchingCards.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const first = (currentPage - 1) * pageSize;
    const visibleCards = new Set(matchingCards.slice(first, first + pageSize));
    cards.forEach((card) => {
      const visible = visibleCards.has(card);
      card.hidden = !visible;
      card.setAttribute("aria-hidden", String(!visible));
    });
    const start = matchingCards.length === 0 ? 0 : first + 1;
    const end = matchingCards.length === 0 ? 0 : Math.min(first + pageSize, matchingCards.length);
    renderCount(start, end, matchingCards.length);
    if (emptyState instanceof HTMLElement) emptyState.hidden = matchingCards.length !== 0;
    if (cardGrid instanceof HTMLElement) cardGrid.hidden = matchingCards.length === 0;
    updateFilterSummary(values, search);
    renderPagination(matchingCards.length, currentPage);
    if (syncUrl) updateUrl(values, search, currentPage);
  }

  function clearGroup(key) {
    filterFields.forEach((field) => {
      if (field.dataset.caseFilter !== key) return;
      field.checked = field.dataset.caseFilterAll !== undefined;
    });
  }

  const params = new URLSearchParams(window.location.search);
  filterKeys.forEach((key) => {
    const values = params.getAll(key);
    if (values.length === 0) return;
    filterFields.forEach((field) => {
      if (field.dataset.caseFilter === key) field.checked = field.dataset.caseFilterAll === undefined && values.includes(field.value);
    });
  });
  if (searchField instanceof HTMLInputElement) searchField.value = params.get("q") ?? "";
  if (sortField instanceof HTMLSelectElement && params.get("sort") && Array.from(sortField.options).some((option) => option.value === params.get("sort"))) sortField.value = params.get("sort");
  if (params.get("view") === "compact") {
    const compactButton = viewButtons.find((button) => button.getAttribute("data-case-view") === "compact");
    const cardButton = viewButtons.find((button) => button.getAttribute("data-case-view") === "cards");
    compactButton?.setAttribute("aria-pressed", "true");
    cardButton?.setAttribute("aria-pressed", "false");
    if (results instanceof HTMLElement) results.dataset.view = "compact";
  }
  currentPage = Math.max(1, Number(params.get("page") ?? "1") || 1);

  filterFields.forEach((field) => field.addEventListener("change", () => {
    if (field.dataset.caseFilterAll !== undefined && field.checked) clearGroup(field.dataset.caseFilter ?? "");
    if (field.dataset.caseFilterAll === undefined && field.checked) {
      filterFields.filter((candidate) => candidate.dataset.caseFilter === field.dataset.caseFilter && candidate.dataset.caseFilterAll !== undefined).forEach((candidate) => { candidate.checked = false; });
    }
    if (field.dataset.caseFilterAll === undefined && !field.checked && !filterFields.some((candidate) => candidate.dataset.caseFilter === field.dataset.caseFilter && candidate.dataset.caseFilterAll === undefined && candidate.checked)) {
      filterFields.filter((candidate) => candidate.dataset.caseFilter === field.dataset.caseFilter && candidate.dataset.caseFilterAll !== undefined).forEach((candidate) => { candidate.checked = true; });
    }
    currentPage = 1;
    update();
  }));
  filterForm.querySelectorAll("[data-case-filter-clear]").forEach((button) => button.addEventListener("click", () => {
    clearGroup(button.getAttribute("data-case-filter-clear") ?? "");
    currentPage = 1;
    update();
  }));
  if (searchField instanceof HTMLInputElement) searchField.addEventListener("input", () => { currentPage = 1; update(); });
  if (sortField instanceof HTMLSelectElement) sortField.addEventListener("change", () => { sortCards(); currentPage = 1; update(); });
  filterForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      if (searchField instanceof HTMLInputElement) searchField.value = "";
      if (sortField instanceof HTMLSelectElement) sortField.value = "case-id-asc";
      currentPage = 1;
      sortCards();
      update();
    }, 0);
  });
  viewButtons.forEach((button) => button.addEventListener("click", () => {
    const view = button.getAttribute("data-case-view") === "compact" ? "compact" : "cards";
    viewButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    if (results instanceof HTMLElement) results.dataset.view = view;
    update();
  }));
  if (filterToggle instanceof HTMLButtonElement && filterPanel instanceof HTMLElement) filterToggle.addEventListener("click", () => {
    const open = filterPanel.getAttribute("data-open") === "true";
    filterPanel.setAttribute("data-open", String(!open));
    filterToggle.setAttribute("aria-expanded", String(!open));
  });

  sortCards();
  update(false);
})();

(() => {
  const story = document.querySelector('[data-method-story]');
  if (!(story instanceof HTMLElement)) return;

  const chapters = [...story.querySelectorAll('[data-method-story-chapter]')];
  const visuals = [...story.querySelectorAll('[data-method-story-visual]')];
  const nodes = [...story.querySelectorAll('[data-method-story-node]')];
  const spokes = [...story.querySelectorAll('[data-method-story-spoke]')];
  const currentIndex = story.querySelector('[data-method-story-current]');
  const desktop = window.matchMedia('(min-width: 901px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let activeIndex = -1;
  let tracking = false;

  function setActive(index) {
    if (index === activeIndex) return;
    activeIndex = index;

    chapters.forEach((chapter, chapterIndex) => {
      if (chapterIndex === index) chapter.setAttribute('aria-current', 'step');
      else chapter.removeAttribute('aria-current');
    });
    visuals.forEach((visual) => {
      visual.classList.toggle('is-active', visual.getAttribute('data-method-story-visual') === String(index));
    });
    nodes.forEach((node) => {
      node.classList.toggle('is-active', node.getAttribute('data-method-story-node') === String(index));
    });
    spokes.forEach((spoke) => {
      spoke.classList.toggle('is-active', spoke.getAttribute('data-method-story-spoke') === String(index));
    });
    story.dataset.methodStoryActiveIndex = String(index);
    if (currentIndex instanceof HTMLElement) currentIndex.textContent = String(index + 1).padStart(2, '0');
  }

  function updateActiveChapter() {
    frame = 0;
    const marker = Math.max(40, window.innerHeight * 0.5);
    let nextIndex = 0;

    chapters.forEach((chapter, index) => {
      const heading = chapter.querySelector('h3');
      const anchor = heading instanceof HTMLElement ? heading : chapter;
      if (anchor.getBoundingClientRect().top <= marker) nextIndex = index;
    });
    setActive(nextIndex);
  }

  function scheduleUpdate() {
    if (frame !== 0) return;
    frame = window.requestAnimationFrame(updateActiveChapter);
  }

  function stopTracking() {
    if (tracking) {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      tracking = false;
    }
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
    activeIndex = -1;
    delete story.dataset.methodStoryActiveIndex;
    visuals.forEach((visual) => visual.classList.remove('is-active'));
    chapters.forEach((chapter) => chapter.removeAttribute('aria-current'));
    nodes.forEach((node) => node.classList.remove('is-active'));
    spokes.forEach((spoke) => spoke.classList.remove('is-active'));
    if (currentIndex instanceof HTMLElement) currentIndex.textContent = '';
  }

  function startTracking() {
    if (tracking || !desktop.matches || reducedMotion.matches) return;
    tracking = true;
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
  }

  function syncTracking() {
    if (desktop.matches && !reducedMotion.matches) startTracking();
    else stopTracking();
  }

  desktop.addEventListener('change', syncTracking);
  reducedMotion.addEventListener('change', syncTracking);
  syncTracking();
})();

(() => {
  const themedPage = document.querySelector('.home-page') || document.querySelector('.methodology-page') || document.querySelector('.results-page') || document.querySelector('.about-page') || document.querySelector('.models-page') || document.querySelector('.model-detail-page') || document.querySelector('.cases-page') || document.querySelector('.case-detail-page') || document.querySelector('.blog-page') || document.querySelector('.run-page') || document.querySelector('.docs-page');
  if (!(themedPage instanceof HTMLElement)) return;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let themeChoice = null;
  try { themeChoice = window.localStorage.getItem('tutorbench-home-theme'); } catch { /* Storage is optional. */ }
  const themeButtons = Array.from(document.querySelectorAll('[data-theme-choice]'));
  function applyTheme(value) {
    themedPage.dataset.theme = value;
    themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === value)));
  }
  applyTheme(themeChoice === 'light' || themeChoice === 'dark' ? themeChoice : media.matches ? 'dark' : 'light');
  themeButtons.forEach((button) => button.addEventListener('click', () => {
    themeChoice = button.dataset.themeChoice;
    applyTheme(themeChoice);
    try { window.localStorage.setItem('tutorbench-home-theme', themeChoice); } catch { /* The selected theme still works. */ }
  }));
  media.addEventListener('change', () => {
    if (themeChoice !== 'light' && themeChoice !== 'dark') applyTheme(media.matches ? 'dark' : 'light');
  });

  const walkthrough = document.querySelector('[data-case-walkthrough]');
  if (walkthrough instanceof HTMLElement) {
    const cases = Array.from(walkthrough.querySelectorAll('[data-home-case]'));
    let active = Number(walkthrough.dataset.initialCase ?? 0);
    function selectCase(index) {
      if (cases.length === 0) return;
      active = (index + cases.length) % cases.length;
      cases.forEach((item, itemIndex) => { item.hidden = itemIndex !== active; });
      const announcement = walkthrough.querySelector('[data-case-announcement]');
      if (announcement) announcement.textContent = `Case ${active + 1} of ${cases.length}: ${cases[active].querySelector('h2').textContent}`;
    }
    walkthrough.querySelector('[data-case-prev]')?.addEventListener('click', () => selectCase(active - 1));
    walkthrough.querySelector('[data-case-next]')?.addEventListener('click', () => selectCase(active + 1));
    cases.forEach((item) => {
      const tabs = Array.from(item.querySelectorAll('[role=tab]'));
      const panels = Array.from(item.querySelectorAll('[role=tabpanel]'));
      function selectTab(index, focus = false) {
        tabs.forEach((button, tabIndex) => {
          button.setAttribute('aria-selected', String(tabIndex === index));
          button.tabIndex = tabIndex === index ? 0 : -1;
          panels[tabIndex].hidden = tabIndex !== index;
        });
        if (focus) tabs[index].focus();
      }
      tabs.forEach((button, index) => {
        button.addEventListener('click', () => selectTab(index));
        button.addEventListener('keydown', (event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next !== null) { event.preventDefault(); selectTab(next, true); }
        });
      });
    });
  }

  const story = document.querySelector('[data-home-story]');
  if (story instanceof HTMLElement) {
    const chapters = Array.from(story.querySelectorAll('[data-home-story-chapter]'));
    const visual = story.querySelector('[data-home-story-visual]');
    const currentIndex = story.querySelector('[data-home-story-current]');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let activeIndex = -1;
    let tracking = false;

    if (visual instanceof HTMLElement && chapters.length > 0) {
      function setActive(index) {
        if (index === activeIndex) return;
        activeIndex = index;
        chapters.forEach((chapter, chapterIndex) => {
          if (chapterIndex === index) chapter.setAttribute('aria-current', 'step');
          else chapter.removeAttribute('aria-current');
        });
        visual.dataset.homeStoryActive = String(index);
        story.dataset.homeStoryActiveIndex = String(index);
        if (currentIndex instanceof HTMLElement) currentIndex.textContent = `0${index + 1} / 0${chapters.length}`;
      }

      function updateActiveChapter() {
        frame = 0;
        const marker = Math.max(120, window.innerHeight * 0.5);
        let nextIndex = 0;
        chapters.forEach((chapter, index) => {
          if (chapter.getBoundingClientRect().top <= marker) nextIndex = index;
        });
        setActive(nextIndex);
      }

      function scheduleUpdate() {
        if (frame !== 0) return;
        frame = window.requestAnimationFrame(updateActiveChapter);
      }

      function stopTracking() {
        if (tracking) {
          window.removeEventListener('scroll', scheduleUpdate);
          window.removeEventListener('resize', scheduleUpdate);
          tracking = false;
        }
        if (frame !== 0) window.cancelAnimationFrame(frame);
        frame = 0;
        activeIndex = -1;
        delete story.dataset.homeStoryActiveIndex;
        visual.dataset.homeStoryActive = '0';
        chapters.forEach((chapter) => chapter.removeAttribute('aria-current'));
        if (currentIndex instanceof HTMLElement) currentIndex.textContent = `01 / 0${chapters.length}`;
      }

      function startTracking() {
        if (tracking || !desktop.matches || reducedMotion.matches) return;
        tracking = true;
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);
        scheduleUpdate();
      }

      function syncTracking() {
        // 五个章节始终按普通文档流可读；桌面滚动只同步右侧装饰视觉。
        if (desktop.matches && !reducedMotion.matches) startTracking();
        else stopTracking();
      }

      desktop.addEventListener('change', syncTracking);
      reducedMotion.addEventListener('change', syncTracking);
      syncTracking();
    }
  }

  const nav = document.querySelector('#primary-navigation');
  const toggle = document.querySelector('.nav-toggle');
  themedPage.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.getAttribute('data-open') === 'true') {
      nav.setAttribute('data-open', 'false');
      toggle?.setAttribute('aria-expanded', 'false');
      if (toggle instanceof HTMLElement) toggle.focus();
    }
  });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    themedPage.querySelectorAll('.home-data').forEach((section) => {
      section.classList.add('reveal-ready'); observer.observe(section);
    });
  }
})();

(() => {
  const docsPage = document.querySelector('.docs-page');
  if (!(docsPage instanceof HTMLElement)) return;

  const searchField = docsPage.querySelector('[data-doc-search]');
  const clearButton = docsPage.querySelector('[data-doc-search-clear]');
  const filterButtons = Array.from(docsPage.querySelectorAll('[data-doc-category]')).filter((element) => element instanceof HTMLButtonElement);
  const entries = Array.from(docsPage.querySelectorAll('[data-doc-entry]')).filter((element) => element instanceof HTMLElement);
  const status = docsPage.querySelector('[data-doc-status]');
  const emptyState = docsPage.querySelector('[data-doc-empty]');
  if (!(searchField instanceof HTMLInputElement)) return;

  let activeCategory = 'all';

  function update() {
    const query = searchField.value.trim().toLowerCase();
    let visibleCount = 0;
    entries.forEach((entry) => {
      const matchesCategory = activeCategory === 'all' || entry.getAttribute('data-doc-category') === activeCategory;
      const matchesSearch = query.length === 0 || (entry.getAttribute('data-doc-search') ?? '').toLowerCase().includes(query);
      const visible = matchesCategory && matchesSearch;
      entry.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    if (status instanceof HTMLElement) {
      status.textContent = visibleCount === entries.length && activeCategory === 'all' && query.length === 0
        ? `Showing ${entries.length} references`
        : `Showing ${visibleCount} of ${entries.length} references`;
    }
    if (emptyState instanceof HTMLElement) emptyState.hidden = visibleCount !== 0;
    if (clearButton instanceof HTMLButtonElement) clearButton.hidden = query.length === 0;
  }

  filterButtons.forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.getAttribute('data-doc-category') ?? 'all';
    filterButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
    update();
  }));
  searchField.addEventListener('input', update);
  if (clearButton instanceof HTMLButtonElement) clearButton.addEventListener('click', () => {
    searchField.value = '';
    update();
    searchField.focus();
  });
  update();
})();

(() => {
  const runConsole = document.querySelector('.run-console');
  if (!(runConsole instanceof HTMLElement)) return;

  const tabs = Array.from(runConsole.querySelectorAll('[data-run-tab]')).filter((element) => element instanceof HTMLButtonElement);
  const panels = Array.from(runConsole.querySelectorAll('[data-run-panel]')).filter((element) => element instanceof HTMLElement);

  function selectTab(id, focus = false) {
    tabs.forEach((tab) => {
      const active = tab.dataset.runTab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.runPanel !== id; });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.runTab ?? 'quickstart'));
    tab.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) {
        event.preventDefault();
        selectTab(tabs[next].dataset.runTab ?? 'quickstart', true);
      }
    });
  });

  async function copyPanelCommand(button) {
    const panel = button.closest('[data-run-panel]');
    const code = panel?.querySelector('code');
    if (!(code instanceof HTMLElement)) return;
    const value = code.textContent ?? '';
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      selection?.removeAllRanges();
    }
    const label = button.querySelector('[data-copy-label]');
    if (label instanceof HTMLElement) label.textContent = copied ? 'Copied' : 'Copy failed';
    button.setAttribute('aria-label', copied ? 'Command copied' : 'Copy failed');
    window.setTimeout(() => {
      if (label instanceof HTMLElement) label.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy active command');
    }, 1800);
  }

  runConsole.querySelectorAll('[data-copy-run]').forEach((element) => {
    if (element instanceof HTMLButtonElement) element.addEventListener('click', () => { void copyPanelCommand(element); });
  });
})();
