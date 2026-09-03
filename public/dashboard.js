const previewDialog = document.querySelector("[data-preview-dialog]");
const previewFrame = document.querySelector("[data-preview-frame]");
const previewTitle = document.querySelector("[data-preview-title]");
const previewAddress = document.querySelector("[data-preview-address]");
const previewOpen = document.querySelector("[data-preview-open]");

document.querySelectorAll("[data-preview-url]").forEach((button) => {
  button.addEventListener("click", () => {
    const url = button.dataset.previewUrl;
    previewFrame.src = url;
    previewTitle.textContent = button.dataset.previewName || "Site preview";
    previewAddress.textContent = url;
    previewOpen.href = url;
    previewDialog.showModal();
  });
});

document.querySelector("[data-preview-close]")?.addEventListener("click", () => {
  previewDialog.close();
});

previewDialog?.addEventListener("close", () => {
  previewFrame.src = "about:blank";
});

const searchInput = document.querySelector("[data-site-search]");
const groupFilter = document.querySelector("[data-group-filter]");
const siteCards = [...document.querySelectorAll("[data-site-card]")];
const siteGroups = [...document.querySelectorAll("[data-site-group]")];
const visibleCount = document.querySelector("[data-visible-count]");
const filterEmpty = document.querySelector("[data-filter-empty]");

function filterSites() {
  const query = searchInput?.value.trim().toLowerCase() || "";
  const selectedGroup = groupFilter?.value || "";
  let count = 0;

  siteCards.forEach((card) => {
    const matchesSearch = !query
      || card.dataset.title.includes(query)
      || card.dataset.slug.includes(query);
    const matchesGroup = !selectedGroup || card.dataset.group === selectedGroup;
    const visible = matchesSearch && matchesGroup;
    card.hidden = !visible;
    if (visible) count += 1;
  });

  siteGroups.forEach((group) => {
    group.hidden = !group.querySelector("[data-site-card]:not([hidden])");
  });

  if (visibleCount) visibleCount.textContent = String(count);
  if (filterEmpty) filterEmpty.hidden = count !== 0;
}

searchInput?.addEventListener("input", filterSites);
groupFilter?.addEventListener("change", filterSites);

document.querySelectorAll("[data-copy-url]").forEach((button) => {
  button.addEventListener("click", async () => {
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copyUrl);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    } catch {
      window.prompt("Copy this URL", button.dataset.copyUrl);
    }
  });
});

document.querySelectorAll("[data-delete-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    const confirmed = window.confirm(
      `Delete "${form.dataset.deleteForm}" and all of its uploaded files?`
    );
    if (!confirmed) event.preventDefault();
  });
});

const titleInput = document.querySelector("[data-site-title]");
const slugInput = document.querySelector("[data-site-slug]");
let slugWasEdited = false;

slugInput?.addEventListener("input", () => {
  slugWasEdited = true;
});

titleInput?.addEventListener("input", () => {
  if (!slugInput || slugWasEdited) return;
  slugInput.value = titleInput.value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);
});

document.querySelectorAll(".file-choice input[type=file]").forEach((input) => {
  input.addEventListener("change", () => {
    const value = input.closest(".file-choice").querySelector(".file-choice-value");
    if (!input.files.length) return;
    value.textContent = input.files.length === 1
      ? input.files[0].name
      : `${input.files.length} files selected`;
  });
});
