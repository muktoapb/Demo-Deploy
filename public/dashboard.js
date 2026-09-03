const previewDialog = document.querySelector("[data-preview-dialog]");
const previewFrame = document.querySelector("[data-preview-frame]");
const previewTitle = document.querySelector("[data-preview-title]");
const previewAddress = document.querySelector("[data-preview-address]");
const previewOpen = document.querySelector("[data-preview-open]");
const previewSizeButtons = [...document.querySelectorAll("[data-preview-size]")];

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

previewSizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    previewDialog.dataset.previewViewport = button.dataset.previewSize;
    previewSizeButtons.forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
  });
});

previewDialog?.addEventListener("close", () => {
  previewFrame.src = "about:blank";
});

previewDialog?.addEventListener("click", (event) => {
  if (event.target === previewDialog) previewDialog.close();
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

document.querySelectorAll(".manage-box").forEach((details) => {
  details.addEventListener("toggle", () => {
    if (!details.open) return;
    document.querySelectorAll(".manage-box[open]").forEach((other) => {
      if (other !== details) other.open = false;
    });
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

const uploadInputs = [...document.querySelectorAll(".file-choice input[type=file]")];
const emptyUploadLabels = new Map(uploadInputs.map((input) => [
  input,
  input.closest(".file-choice").querySelector(".file-choice-value").textContent
]));

uploadInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const choice = input.closest(".file-choice");
    const value = choice.querySelector(".file-choice-value");
    if (!input.files.length) return;

    uploadInputs.forEach((other) => {
      if (other === input) return;
      other.value = "";
      other.closest(".file-choice").classList.remove("has-file");
      other.closest(".file-choice").querySelector(".file-choice-value").textContent =
        emptyUploadLabels.get(other);
    });

    choice.classList.add("has-file");
    value.textContent = input.files.length === 1
      ? input.files[0].name
      : `${input.files.length} files selected`;
  });
});

document.querySelectorAll("[data-deploy-form]").forEach((form) => {
  form.addEventListener("submit", () => {
    const button = form.querySelector("[data-deploy-button]");
    form.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.textContent = "Deploying...";
  });
});
