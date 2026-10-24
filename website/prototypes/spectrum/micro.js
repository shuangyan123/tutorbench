/* global HTMLButtonElement, HTMLFieldSetElement, HTMLFormElement, HTMLInputElement, HTMLElement, document */
// Micro-Review: one choice, then the analysis. A port of the live site's micro-review.js. The answer
// never leaves the page: the form is never submitted, nothing goes into the URL, storage or network.
// One change for the two-language page: the status line carries both languages, so the reader
// hears the one they are reading.

(() => {
  const form = document.querySelector("[data-micro-review-form]");
  const result = document.querySelector("[data-micro-review-result]");
  const status = document.querySelector("[data-micro-review-status]");
  const unavailable = document.querySelector("[data-micro-review-unavailable]");
  const message = document.querySelector("[data-micro-review-complete-message]");
  const heading = result?.querySelector("h2");
  const fieldset = form?.querySelector("fieldset");
  const submit = form?.querySelector('button[type="submit"]');
  if (
    !(form instanceof HTMLFormElement) ||
    !(result instanceof HTMLElement) ||
    !(status instanceof HTMLElement) ||
    !(message instanceof HTMLElement) ||
    !(heading instanceof HTMLElement) ||
    !(fieldset instanceof HTMLFieldSetElement) ||
    !(submit instanceof HTMLButtonElement)
  ) return;

  let completed = false;
  form.addEventListener("submit", (event) => {
    // keep the answer out of the URL, the network and any formal review storage
    event.preventDefault();
    if (completed) return;
    const selected = form.querySelector('input[name="judgment"]:checked');
    if (
      !(selected instanceof HTMLInputElement) ||
      !["suitable", "problem", "unsure"].includes(selected.value) ||
      !form.reportValidity()
    ) return;

    completed = true;
    form.dataset.chosen = selected.value;
    fieldset.disabled = true;
    submit.hidden = true;
    status.innerHTML = message.innerHTML;
    result.hidden = false;
    heading.focus();
  });

  // open the form only once the handler is bound; without script the static notice stays
  form.hidden = false;
  if (unavailable instanceof HTMLElement) unavailable.hidden = true;
})();
