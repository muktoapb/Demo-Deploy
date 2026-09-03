const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const yauzl = require("yauzl");
const { config } = require("./config");
const { findSite, siteCurrentDir, upsertSite } = require("./storage");

const RESERVED_SLUGS = new Set(["admin", "api", "www"]);
const SKIPPED_NAMES = new Set([".DS_Store"]);
const SKIPPED_PARTS = new Set([".git", ".hg", ".svn", "__MACOSX"]);

function makeSlug(input) {
  const slug = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);

  return slug || `demo-${Date.now()}`;
}

function validateSlug(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)
    && !RESERVED_SLUGS.has(slug);
}

function cleanUploadPath(uploadPath) {
  if (!uploadPath || uploadPath.includes("\0")) return null;
  const normalized = uploadPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) return null;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    return null;
  }
  if (parts.some((part) => SKIPPED_PARTS.has(part))) return null;
  if (SKIPPED_NAMES.has(parts.at(-1))) return null;

  return parts.join("/");
}

async function deploySite({ slug, title, group, files, spaFallback, replaceExisting = false }) {
  if (!validateSlug(slug)) {
    throw new Error("Use a subdomain with letters, numbers, and dashes only.");
  }
  if (!replaceExisting && await findSite(slug)) {
    throw new Error("That subdomain already exists. Use Manage site to redeploy it.");
  }

  const source = selectUploadSource(files);
  const stagingDir = path.join(config.tmpDir, `deploy-${slug}-${Date.now()}`);

  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  try {
    if (source.type === "zip") {
      await extractZip(source.file.path, stagingDir);
    } else {
      await copyFolderUpload(source.files, stagingDir);
    }

    await promoteSingleRootDirectory(stagingDir);
    await requireIndexHtml(stagingDir);

    const currentDir = siteCurrentDir(slug);
    const siteDir = path.dirname(currentDir);
    const oldDir = path.join(siteDir, "previous");

    await fs.mkdir(siteDir, { recursive: true });
    await fs.rm(oldDir, { recursive: true, force: true });

    try {
      await fs.rename(currentDir, oldDir);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    await fs.rename(stagingDir, currentDir);
    await fs.rm(oldDir, { recursive: true, force: true });

    return upsertSite({
      slug,
      title: title || slug,
      group,
      spaFallback: Boolean(spaFallback),
      deployedAt: new Date().toISOString()
    });
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

function selectUploadSource(files) {
  const allFiles = files || [];
  const zipFiles = allFiles.filter((file) => file.fieldname === "archive" && file.size > 0);
  const folderFiles = allFiles.filter((file) => file.fieldname === "files" && file.size > 0);

  if (zipFiles.length > 0 && folderFiles.length > 0) {
    throw new Error("Upload a ZIP or a folder, not both.");
  }
  if (zipFiles.length > 1) {
    throw new Error("Upload only one ZIP file.");
  }
  if (zipFiles.length === 1) {
    if (!zipFiles[0].originalname.toLowerCase().endsWith(".zip")) {
      throw new Error("The archive must be a .zip file.");
    }
    return { type: "zip", file: zipFiles[0] };
  }
  if (folderFiles.length > 0) {
    return { type: "folder", files: folderFiles };
  }

  throw new Error("Upload a ZIP file or select a folder.");
}

async function copyFolderUpload(files, destinationDir) {
  for (const file of files) {
    const relativePath = cleanUploadPath(file.originalname);
    if (!relativePath) {
      throw new Error(`Unsafe upload path: ${file.originalname}`);
    }

    const targetPath = safeJoin(destinationDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(file.path, targetPath);
  }
}

async function extractZip(zipPath, destinationDir) {
  const zipFile = await openZip(zipPath);

  try {
    await new Promise((resolve, reject) => {
      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        const relativePath = cleanUploadPath(entry.fileName);

        if (!relativePath || isZipDirectory(entry)) {
          zipFile.readEntry();
          return;
        }
        if (isZipSymlink(entry)) {
          reject(new Error(`ZIP contains an unsupported symlink: ${entry.fileName}`));
          return;
        }

        const targetPath = safeJoin(destinationDir, relativePath);
        zipFile.openReadStream(entry, async (error, readStream) => {
          if (error) {
            reject(error);
            return;
          }

          try {
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await pipeline(readStream, fsSync.createWriteStream(targetPath, { mode: 0o644 }));
            zipFile.readEntry();
          } catch (streamError) {
            reject(streamError);
          }
        });
      });
      zipFile.once("end", resolve);
      zipFile.once("error", reject);
    });
  } finally {
    zipFile.close();
  }
}

function openZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error) reject(error);
      else resolve(zipFile);
    });
  });
}

async function promoteSingleRootDirectory(directory) {
  if (await fileExists(path.join(directory, "index.html"))) return;

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !SKIPPED_NAMES.has(entry.name));

  if (visibleEntries.length !== 1 || !visibleEntries[0].isDirectory()) return;

  const nestedDir = path.join(directory, visibleEntries[0].name);
  if (!(await fileExists(path.join(nestedDir, "index.html")))) return;

  const promotedDir = `${directory}-promoted`;
  await fs.rm(promotedDir, { recursive: true, force: true });
  await fs.rename(nestedDir, promotedDir);
  await fs.rm(directory, { recursive: true, force: true });
  await fs.rename(promotedDir, directory);
}

async function requireIndexHtml(directory) {
  if (!(await fileExists(path.join(directory, "index.html")))) {
    throw new Error("The uploaded site must contain an index.html file.");
  }
}

function safeJoin(root, relativePath) {
  const target = path.resolve(root, relativePath);
  const safeRoot = path.resolve(root);
  if (target !== safeRoot && !target.startsWith(`${safeRoot}${path.sep}`)) {
    throw new Error(`Unsafe upload path: ${relativePath}`);
  }
  return target;
}

function isZipDirectory(entry) {
  return entry.fileName.endsWith("/");
}

function isZipSymlink(entry) {
  const mode = (entry.externalFileAttributes >> 16) & 0o170000;
  return mode === 0o120000;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

module.exports = {
  cleanUploadPath,
  deploySite,
  makeSlug,
  validateSlug
};
