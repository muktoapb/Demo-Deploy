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
    const label = button.querySelector("span");
    const originalText = label?.textContent || button.textContent;
    const originalAriaLabel = button.getAttribute("aria-label");
    try {
      await navigator.clipboard.writeText(button.dataset.copyUrl);
      button.dataset.copied = "true";
      button.setAttribute("aria-label", "URL copied");
      if (label) label.textContent = "Copied";
      else button.textContent = "Copied";
      setTimeout(() => {
        delete button.dataset.copied;
        if (originalAriaLabel) button.setAttribute("aria-label", originalAriaLabel);
        if (label) label.textContent = originalText;
        else button.textContent = originalText;
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

document.querySelectorAll("[data-manage-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.querySelector(`[data-manage-dialog="${button.dataset.manageOpen}"]`);
    if (!dialog) return;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }

    dialog.setAttribute("open", "");
  });
});

document.querySelectorAll("[data-manage-dialog]").forEach((dialog) => {
  dialog.querySelector("[data-manage-close]")?.addEventListener("click", () => {
    closeDialog(dialog);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
});

function closeDialog(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
}

document.querySelectorAll("[data-protection-toggle]").forEach((toggle) => {
  const form = toggle.closest("form");
  const field = form?.querySelector("[data-protection-field]");
  const password = form?.querySelector("[data-protection-password]");
  if (!field || !password) return;

  const syncProtectionField = () => {
    const enabled = toggle.checked;
    const hasPassword = password.dataset.hasPassword === "true";
    field.hidden = !enabled;
    password.disabled = !enabled;
    password.required = enabled && !hasPassword;
  };

  toggle.addEventListener("change", syncProtectionField);
  syncProtectionField();
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

const uploadInputs = [...document.querySelectorAll("[data-upload-form] input[type=file]")];
const emptyUploadLabels = new Map(uploadInputs.map((input) => [
  input,
  input.closest(".file-choice")?.querySelector(".file-choice-value")?.textContent
]));
const droppedUploads = new WeakMap();

uploadInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const form = input.closest("form");
    const choice = input.closest(".file-choice, .compact-file");
    const value = choice?.querySelector(".file-choice-value");
    if (!input.files.length) return;

    clearUploadInputs(form, input);
    droppedUploads.delete(form);
    updateDropStatus(form, input.files.length === 1
      ? input.files[0].name
      : `${input.files.length} files selected`);

    choice?.classList.add("has-file");
    if (value) {
      value.textContent = input.files.length === 1
        ? input.files[0].name
        : `${input.files.length} files selected`;
    }
  });
});

document.querySelectorAll("[data-upload-dropzone]").forEach((dropzone) => {
  const form = dropzone.closest("form");
  let dragDepth = 0;

  dropzone.addEventListener("dragenter", (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dropzone.classList.add("is-dragging");
  });

  dropzone.addEventListener("dragover", (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  dropzone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove("is-dragging");
  });

  dropzone.addEventListener("drop", async (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("is-dragging");

    try {
      const files = await filesFromDrop(event.dataTransfer);
      if (!files.length) throw new Error("No files were found in that selection.");

      const isZip = files.length === 1 && files[0].file.name.toLowerCase().endsWith(".zip");
      clearUploadInputs(form);
      droppedUploads.set(form, { type: isZip ? "archive" : "files", files });
      dropzone.classList.add("has-drop");
      updateDropStatus(form, isZip
        ? `${files[0].file.name} ready to upload`
        : `${files.length} files ready to upload`);
    } catch (error) {
      droppedUploads.delete(form);
      dropzone.classList.remove("has-drop");
      updateDropStatus(form, error.message || "This folder could not be read.", true);
    }
  });
});

function clearUploadInputs(form, selectedInput) {
  uploadInputs.forEach((input) => {
    if (!form || input.closest("form") !== form || input === selectedInput) return;
    input.value = "";
    const choice = input.closest(".file-choice, .compact-file");
    choice?.classList.remove("has-file");
    const value = choice?.querySelector(".file-choice-value");
    if (value) value.textContent = emptyUploadLabels.get(input);
  });
  form?.querySelector("[data-upload-dropzone]")?.classList.remove("has-drop");
}

function updateDropStatus(form, message, isError = false) {
  const status = form?.querySelector("[data-drop-status]");
  if (!status) return;
  status.querySelector("span").textContent = message;
  status.classList.toggle("is-error", isError);
}

function hasDraggedFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

async function filesFromDrop(dataTransfer) {
  const items = [...(dataTransfer.items || [])].filter((item) => item.kind === "file");
  const entries = items
    .map((item) => typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null)
    .filter(Boolean);

  if (entries.length) {
    const nested = await Promise.all(entries.map((entry) => filesFromEntry(entry, "")));
    return nested.flat();
  }

  return [...(dataTransfer.files || [])].map((file) => ({ file, path: file.name }));
}

async function filesFromEntry(entry, parentPath) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ file, path: `${parentPath}${file.name}` }];
  }

  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(entry.createReader());
  const nested = await Promise.all(children.map((child) =>
    filesFromEntry(child, `${parentPath}${entry.name}/`)
  ));
  return nested.flat();
}

async function readDirectoryEntries(reader) {
  const entries = [];
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) return entries;
    entries.push(...batch);
  }
}

document.querySelectorAll("[data-upload-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    const dropped = droppedUploads.get(form);
    const button = form.querySelector("[data-upload-button]");
    const originalButtonHtml = button?.innerHTML;
    form.setAttribute("aria-busy", "true");
    if (button) {
      button.disabled = true;
      button.textContent = "Deploying...";
    }

    if (!dropped) return;
    event.preventDefault();

    const body = new FormData(form);
    body.delete("archive");
    body.delete("files");
    dropped.files.forEach(({ file, path }) => {
      body.append(dropped.type, file, dropped.type === "archive" ? file.name : path);
    });

    try {
      const response = await fetch(form.action, {
        method: form.method || "POST",
        body,
        credentials: "same-origin"
      });
      window.location.assign(response.url || form.action);
    } catch {
      form.removeAttribute("aria-busy");
      if (button) {
        button.disabled = false;
        button.innerHTML = originalButtonHtml;
      }
      updateDropStatus(form, "Upload failed. Check your connection and try again.", true);
    }
  });
});
