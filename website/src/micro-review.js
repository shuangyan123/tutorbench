/* global HTMLButtonElement, HTMLFieldSetElement, HTMLFormElement, HTMLInputElement, HTMLElement, document */

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
    // 阻止原生表单导航，答案不能进入 URL、网络请求或正式评审存储。
    event.preventDefault();
    if (completed) return;
    const selected = form.querySelector('input[name="judgment"]:checked');
    if (
      !(selected instanceof HTMLInputElement) ||
      !["suitable", "problem", "unsure"].includes(selected.value) ||
      !form.reportValidity()
    ) return;

    completed = true;
    fieldset.disabled = true;
    submit.hidden = true;
    status.textContent = message.textContent;
    result.hidden = false;
    heading.focus();
  });

  // 只有事件处理已绑定才开放提交；脚本不可用时保留明确的静态提示。
  form.hidden = false;
  if (unavailable instanceof HTMLElement) unavailable.hidden = true;
})();
