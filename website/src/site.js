/* global HTMLButtonElement, HTMLFormElement, HTMLSelectElement, HTMLElement, URLSearchParams, document, history, window */

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
    document.querySelectorAll("[data-case-count-value]").forEach((element) => {
      const templateAttribute = locale === "zh-CN"
        ? "data-case-count-template-zh-cn"
        : "data-case-count-template-en";
      const template = element.getAttribute(templateAttribute) ?? "Showing {count} cases";
      const count = element.getAttribute("data-case-count-value") ?? "0";
      element.textContent = template.replace("{count}", count);
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
      applyLocale(locale);
    });
  }

  const filterForm = document.querySelector("#case-filters");
  if (!(filterForm instanceof HTMLFormElement)) {
    return;
  }

  const filterFields = Array.from(
    filterForm.querySelectorAll("[data-case-filter]"),
  ).filter((field) => field instanceof HTMLSelectElement);
  const cards = Array.from(document.querySelectorAll("[data-case-card]"));
  const resultCount = document.querySelector("#case-result-count");
  const emptyState = document.querySelector("#case-filter-empty");
  const parameterByFilter = {
    locale: "locale",
    subject: "subject",
    learnerLevel: "learnerLevel",
    taskDifficulty: "taskDifficulty",
    pedagogicalDifficulty: "pedagogicalDifficulty",
    capability: "capability",
    studentState: "studentState",
    disclosurePolicy: "disclosurePolicy",
  };

  function readValues() {
    return Object.fromEntries(
      filterFields.map((field) => [field.dataset.caseFilter ?? "", field.value]),
    );
  }

  function matches(card, values) {
    const locale = card.dataset.caseLocale ?? "";
    const subject = card.dataset.caseSubject ?? "";
    const learnerLevel = card.dataset.caseLearnerLevel ?? "";
    const taskDifficulty = card.dataset.caseTaskDifficulty ?? "";
    const pedagogicalDifficulty = card.dataset.casePedagogicalDifficulty ?? "";
    const capabilities = (card.dataset.caseCapabilities ?? "").split(" ");
    const studentState = card.dataset.caseStudentState ?? "";
    const disclosurePolicy = card.dataset.caseDisclosurePolicy ?? "";
    return (
      (!values.locale || values.locale === locale) &&
      (!values.subject || values.subject === subject) &&
      (!values.learnerLevel || values.learnerLevel === learnerLevel) &&
      (!values.taskDifficulty || values.taskDifficulty === taskDifficulty) &&
      (!values.pedagogicalDifficulty || values.pedagogicalDifficulty === pedagogicalDifficulty) &&
      (!values.capability || capabilities.includes(values.capability)) &&
      (!values.studentState || values.studentState === studentState) &&
      (!values.disclosurePolicy || values.disclosurePolicy === disclosurePolicy)
    );
  }

  function updateUrl(values) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        params.set(parameterByFilter[key] ?? key, value);
      }
    });
    const query = params.toString();
    history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function update(syncUrl = true) {
    const values = readValues();
    let visibleCount = 0;
    cards.forEach((card) => {
      const visible = matches(card, values);
      card.hidden = !visible;
      card.setAttribute("aria-hidden", String(!visible));
      if (visible) {
        visibleCount += 1;
      }
    });
    if (resultCount instanceof HTMLElement) {
      const uiLocale = document.documentElement.dataset.uiLocale === "zh-CN"
        ? "zh-CN"
        : "en";
      const templateAttribute = uiLocale === "zh-CN"
        ? "data-case-count-template-zh-cn"
        : "data-case-count-template-en";
      const template = resultCount.getAttribute(templateAttribute) ?? "Showing {count} cases";
      resultCount.setAttribute("data-case-count-value", String(visibleCount));
      resultCount.textContent = template.replace("{count}", String(visibleCount));
    }
    if (emptyState instanceof HTMLElement) {
      emptyState.hidden = visibleCount !== 0;
    }
    if (syncUrl) {
      updateUrl(values);
    }
  }

  const params = new URLSearchParams(window.location.search);
  filterFields.forEach((field) => {
    const value = params.get(field.dataset.caseFilter ?? "");
    if (value !== null && Array.from(field.options).some((option) => option.value === value)) {
      field.value = value;
    }
  });

  filterForm.addEventListener("change", () => update());
  filterForm.addEventListener("reset", () => {
    window.setTimeout(() => update(), 0);
  });
  update(false);
})();

(() => {
  const themedPage = document.querySelector('.home-page') || document.querySelector('.methodology-page') || document.querySelector('.results-page');
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

  const explorer = document.querySelector('[data-dimension-explorer]');
  if (explorer instanceof HTMLElement) {
    const nodes = Array.from(explorer.querySelectorAll('[data-dimension]'));
    const details = Array.from(explorer.querySelectorAll('[data-dimension-detail]'));
    let active = 0;
    function selectDimension(index, focus = false) {
      active = (index + nodes.length) % nodes.length;
      nodes.forEach((node, itemIndex) => node.setAttribute('aria-pressed', String(active === itemIndex)));
      details.forEach((detail, itemIndex) => { detail.hidden = active !== itemIndex; });
      if (focus) nodes[active].focus();
      // 仅横向滚动节点容器，避免 hover 或方向按钮让整页跳动。
      const path = explorer.querySelector('.dimension-path');
      if (path instanceof HTMLElement && path.scrollWidth > path.clientWidth) {
        const nodeRect = nodes[active].getBoundingClientRect();
        const pathRect = path.getBoundingClientRect();
        path.scrollLeft += nodeRect.left - pathRect.left - (path.clientWidth - nodeRect.width) / 2;
      }
    }
    nodes.forEach((node, index) => {
      node.addEventListener('click', () => selectDimension(index));
      node.addEventListener('focus', () => selectDimension(index));
      node.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') selectDimension(index); });
      node.addEventListener('keydown', (event) => {
        const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1
          : event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : null;
        if (next !== null) { event.preventDefault(); selectDimension(next, true); }
      });
    });
    explorer.querySelector('[data-dimension-prev]')?.addEventListener('click', () => selectDimension(active - 1));
    explorer.querySelector('[data-dimension-next]')?.addEventListener('click', () => selectDimension(active + 1));
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
    themedPage.querySelectorAll('.home-dimensions, .home-data').forEach((section) => {
      section.classList.add('reveal-ready'); observer.observe(section);
    });
  }
})();
