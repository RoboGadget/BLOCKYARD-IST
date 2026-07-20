(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const propsPanel = document.getElementById("props-panel");
  const canvasWidthSelect = document.getElementById("canvas-width");
  const exportBtn = document.getElementById("export-btn");
  const exportModal = document.getElementById("export-modal");
  const modalClose = document.getElementById("modal-close");
  const exportOutput = document.getElementById("export-output");
  const copyBtn = document.getElementById("copy-btn");
  const copyConfirm = document.getElementById("copy-confirm");
  const rootStyleTag = document.getElementById("root-vars");
  const themeBtn = document.getElementById("theme-btn");
  const themeModal = document.getElementById("theme-modal");
  const themeModalClose = document.getElementById("theme-modal-close");

  let counters = { generic: 0, photo: 0, banner: 0, text: 0, container: 0 };
  let idCounter = 0;
  let selectedBlock = null;
  const colorVars = {}; // block id -> hex color, mirrored into the :root style tag

  // Page-wide theme: becomes a shared :root block in the exported CSS.
  const theme = {
    pageBg: "#f4f1ea",
    wallpaperUrl: "",
    wallpaperFit: "cover",
    boxOutline: "#26241f",
    scrollbarColor: "#c8922a",
    scrollbarTrack: "#111c2e",
    scrollbarSize: 10,
    headingFontUrl: "",
    headingFontFamily: "",
  };

  function parseGoogleFontFamily(url) {
    const match = url.match(/family=([^:&]+)/);
    if (!match) return "";
    return decodeURIComponent(match[1]).replace(/\+/g, " ");
  }

  function applyTheme() {
    const root = document.documentElement.style;
    root.setProperty("--theme-page-bg", theme.pageBg);
    root.setProperty("--theme-wallpaper-image", theme.wallpaperUrl ? `url("${theme.wallpaperUrl}")` : "none");
    root.setProperty("--theme-wallpaper-size", theme.wallpaperFit === "repeat" ? "auto" : theme.wallpaperFit);
    root.setProperty("--theme-wallpaper-repeat", theme.wallpaperFit === "repeat" ? "repeat" : "no-repeat");
    root.setProperty("--theme-box-outline", theme.boxOutline);
    root.setProperty("--theme-scrollbar-color", theme.scrollbarColor);
    root.setProperty("--theme-scrollbar-track", theme.scrollbarTrack);
    root.setProperty("--theme-scrollbar-size", theme.scrollbarSize + "px");

    if (theme.headingFontUrl) {
      theme.headingFontFamily = parseGoogleFontFamily(theme.headingFontUrl);
      let link = document.getElementById("theme-font-link");
      if (!link) {
        link = document.createElement("link");
        link.id = "theme-font-link";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = theme.headingFontUrl;
      root.setProperty("--theme-heading-font", theme.headingFontFamily ? `"${theme.headingFontFamily}"` : "var(--font-display)");
    } else {
      theme.headingFontFamily = "";
      root.setProperty("--theme-heading-font", "var(--font-display)");
    }
  }

  themeBtn.addEventListener("click", () => themeModal.classList.remove("hidden"));
  themeModalClose.addEventListener("click", () => themeModal.classList.add("hidden"));
  themeModal.addEventListener("click", (e) => {
    if (e.target === themeModal) themeModal.classList.add("hidden");
  });

  document.getElementById("theme-page-bg").addEventListener("input", (e) => {
    theme.pageBg = e.target.value;
    applyTheme();
  });
  document.getElementById("theme-wallpaper-url").addEventListener("input", (e) => {
    theme.wallpaperUrl = e.target.value.trim();
    applyTheme();
  });
  document.getElementById("theme-wallpaper-fit").addEventListener("change", (e) => {
    theme.wallpaperFit = e.target.value;
    applyTheme();
  });
  document.getElementById("theme-box-outline").addEventListener("input", (e) => {
    theme.boxOutline = e.target.value;
    applyTheme();
  });
  document.getElementById("theme-scrollbar-color").addEventListener("input", (e) => {
    theme.scrollbarColor = e.target.value;
    applyTheme();
  });
  document.getElementById("theme-scrollbar-track").addEventListener("input", (e) => {
    theme.scrollbarTrack = e.target.value;
    applyTheme();
  });
  document.getElementById("theme-scrollbar-size").addEventListener("input", (e) => {
    theme.scrollbarSize = Math.max(4, parseInt(e.target.value) || 10);
    applyTheme();
  });
  document.getElementById("theme-heading-font").addEventListener("input", (e) => {
    theme.headingFontUrl = e.target.value.trim();
    applyTheme();
  });

  applyTheme();

  const DEFAULT_SIZE = {
    generic: { w: 200, h: 150 },
    photo: { w: 260, h: 180 },
    banner: { w: 500, h: 90 },
    text: { w: 280, h: 140 },
    container: { w: 480, h: 340 },
  };

  const PLACEHOLDER_TEXT = {
    banner: "Your banner headline",
    text: "Your text goes here. Click to edit this placeholder before exporting.",
  };

  // ---------- Creating blocks ----------

  function addBlock(type) {
    counters[type]++;
    idCounter++;
    const name = `${type}-${counters[type]}`;
    const id = `b${idCounter}`;
    const size = DEFAULT_SIZE[type];

    const block = document.createElement("div");
    block.className = `block block-${type}`;
    block.dataset.type = type;
    block.dataset.name = name;
    block.dataset.id = id;
    block.style.left = "24px";
    block.style.top = "24px";
    block.style.width = size.w + "px";
    block.style.height = size.h + "px";
    block.style.margin = "0px";

    const label = document.createElement("div");
    label.className = "block-label";
    const labelText = document.createElement("span");
    labelText.className = "label-text";
    labelText.textContent = name;
    const delBtn = document.createElement("button");
    delBtn.className = "block-delete";
    delBtn.textContent = "×";
    delBtn.title = "Delete block";
    delBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteBlock(block);
    });
    label.appendChild(labelText);
    label.appendChild(delBtn);
    block.appendChild(label);

    const content = document.createElement("div");
    content.className = "block-content";
    content.style.padding = type === "container" ? "0px" : "10px";
    if (type === "photo") {
      content.innerHTML = "🖼<span>image placeholder</span>";
    } else if (type === "banner" || type === "text") {
      content.contentEditable = "true";
      content.textContent = PLACEHOLDER_TEXT[type];
      content.addEventListener("pointerdown", (e) => {
        selectBlock(block);
        e.stopPropagation();
      });
    } else if (type === "container") {
      // Left empty on purpose: CSS ":empty::before" shows a "drop blocks here" hint
      // until a child block is dragged in.
    } else {
      content.innerHTML = "<span>empty div</span>";
    }
    block.appendChild(content);

    const dim = document.createElement("div");
    dim.className = "block-dim";
    block.appendChild(dim);

    const handle = document.createElement("div");
    handle.className = "resize-handle";
    block.appendChild(handle);

    makeDraggable(block, label);
    makeResizable(block, handle);
    updateDim(block);

    block.addEventListener("pointerdown", () => selectBlock(block));

    canvas.appendChild(block);
    selectBlock(block);
  }

  function deleteBlock(block) {
    // Clean up any color variables this block (or its nested children) owned.
    block.querySelectorAll(".block").forEach((child) => delete colorVars[child.dataset.id]);
    delete colorVars[block.dataset.id];
    updateRootStyleTag();

    if (selectedBlock === block || (selectedBlock && block.contains(selectedBlock))) {
      selectedBlock = null;
      renderProps();
    }
    block.remove();
  }

  function updateDim(block) {
    const dim = block.querySelector(".block-dim");
    dim.textContent = `${Math.round(block.offsetWidth)} × ${Math.round(block.offsetHeight)}`;
  }

  // ---------- Color -> :root variable system ----------

  function getColorTarget(block) {
    // Containers show their fill on the inner content area (the outer shell stays
    // transparent so the dashed "drop zone" styling remains visible around it),
    // every other block type shows its fill on the block itself.
    return block.dataset.type === "container" ? block.querySelector(".block-content") : block;
  }

  function setBlockColor(block, hex) {
    const id = block.dataset.id;
    colorVars[id] = hex;
    getColorTarget(block).style.backgroundColor = `var(--${id}-bg)`;
    updateRootStyleTag();
  }

  function updateRootStyleTag() {
    const lines = Object.entries(colorVars).map(([id, hex]) => `  --${id}-bg: ${hex};`);
    rootStyleTag.textContent = lines.length ? `:root {\n${lines.join("\n")}\n}` : "";
  }

  // ---------- Dragging (with drop-into-container support) ----------

  function clamp(v, min, max) {
    if (max < min) return min;
    return Math.min(Math.max(v, min), max);
  }

  function getDropZones() {
    const zones = [canvas];
    document.querySelectorAll(".block-container").forEach((c) => {
      zones.push(c.querySelector(".block-content"));
    });
    return zones;
  }

  function reparentIfNeeded(block, clientX, clientY) {
    const candidates = getDropZones().filter((zone) => {
      if (block.contains(zone)) return false; // can't drop a block into its own descendant
      const ownerBlock = zone.closest(".block");
      if (ownerBlock === block) return false; // can't drop a block into itself
      const r = zone.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    });
    if (candidates.length === 0) return; // dropped outside any valid zone; leave in place

    // Prefer the smallest (most nested) matching zone.
    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    const target = candidates[0];
    if (target === block.parentElement) return; // already there

    const blockRect = block.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const newLeft = blockRect.left - targetRect.left + target.scrollLeft;
    const newTop = blockRect.top - targetRect.top + target.scrollTop;
    target.appendChild(block);
    block.style.left = clamp(Math.round(newLeft), 0, Math.max(0, target.clientWidth - block.offsetWidth)) + "px";
    block.style.top = clamp(Math.round(newTop), 0, Math.max(0, target.clientHeight - block.offsetHeight)) + "px";
    updateDim(block);
  }

  function makeDraggable(block, handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".block-delete")) return;
      e.preventDefault();
      selectBlock(block);
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = block.offsetLeft;
      const startTop = block.offsetTop;
      const parent = block.parentElement;
      let lastX = e.clientX;
      let lastY = e.clientY;

      function onMove(ev) {
        lastX = ev.clientX;
        lastY = ev.clientY;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxLeft = Math.max(0, parent.clientWidth - block.offsetWidth);
        const maxTop = Math.max(0, parent.clientHeight - block.offsetHeight);
        block.style.left = clamp(startLeft + dx, 0, maxLeft) + "px";
        block.style.top = clamp(startTop + dy, 0, maxTop) + "px";
        if (selectedBlock === block) syncPropsFromBlock();
      }
      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        reparentIfNeeded(block, lastX, lastY);
        if (selectedBlock === block) syncPropsFromBlock();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  // ---------- Resizing ----------

  function makeResizable(block, handle) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectBlock(block);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = block.offsetWidth;
      const startH = block.offsetHeight;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        block.style.width = Math.max(60, startW + dx) + "px";
        block.style.height = Math.max(40, startH + dy) + "px";
        updateDim(block);
        if (selectedBlock === block) syncPropsFromBlock();
      }
      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  // ---------- Selection & properties panel ----------

  function selectBlock(block) {
    if (selectedBlock) selectedBlock.classList.remove("selected");
    selectedBlock = block;
    block.classList.add("selected");
    renderProps();
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.target === canvas) {
      if (selectedBlock) selectedBlock.classList.remove("selected");
      selectedBlock = null;
      renderProps();
    }
  });

  function renderProps() {
    if (!selectedBlock) {
      propsPanel.innerHTML = `
        <h2 class="sidebar-title">Block properties</h2>
        <div class="props-empty"><p>Select a block on the canvas to edit its name, position, size, color, padding, and margin.</p></div>`;
      return;
    }
    const b = selectedBlock;
    const type = b.dataset.type;
    const hasColor = type === "generic" || type === "banner" || type === "text" || type === "container";
    const contentEl = b.querySelector(".block-content");
    const currentPadding = parseInt(contentEl.style.padding) || 0;
    const currentMargin = parseInt(b.style.margin) || 0;
    const currentRadius = parseInt(b.style.borderRadius) || 0;
    const currentOpacity = b.dataset.opacity ? parseInt(b.dataset.opacity) : 100;

    propsPanel.innerHTML = `
      <h2 class="sidebar-title">Block properties</h2>
      <div class="prop-group">
        <label>Type</label>
        <span class="prop-type-badge">${type}</span>
      </div>
      <div class="prop-group">
        <label for="prop-name">Name (used as class name)</label>
        <input type="text" id="prop-name" value="${b.dataset.name}">
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label for="prop-x">X (px)</label>
          <input type="number" id="prop-x" value="${b.offsetLeft}">
        </div>
        <div class="prop-group">
          <label for="prop-y">Y (px)</label>
          <input type="number" id="prop-y" value="${b.offsetTop}">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label for="prop-w">Width (px)</label>
          <input type="number" id="prop-w" value="${b.offsetWidth}">
        </div>
        <div class="prop-group">
          <label for="prop-h">Height (px)</label>
          <input type="number" id="prop-h" value="${b.offsetHeight}">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label for="prop-padding">Padding (px)</label>
          <input type="number" min="0" id="prop-padding" value="${currentPadding}">
        </div>
        <div class="prop-group">
          <label for="prop-margin">Margin (px)</label>
          <input type="number" min="0" id="prop-margin" value="${currentMargin}">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label for="prop-radius">Corner radius (px)</label>
          <input type="number" min="0" id="prop-radius" value="${currentRadius}">
        </div>
        ${type === "photo" ? `
        <div class="prop-group">
          <label for="prop-opacity">Image opacity (%)</label>
          <input type="number" min="0" max="100" id="prop-opacity" value="${currentOpacity}">
        </div>` : ""}
      </div>
      ${hasColor ? `
      <div class="prop-group">
        <label for="prop-color">Background color</label>
        <input type="color" id="prop-color" value="${rgbToHex(getComputedStyle(getColorTarget(b)).backgroundColor)}">
        <small style="display:block;color:var(--text-muted);font-size:11px;margin-top:4px;">Saved as a CSS variable in :root when you export.</small>
      </div>` : ""}
      ${type === "container" ? `<p style="font-size:11px;color:var(--text-muted);">Drag other blocks onto this one to nest them inside.</p>` : ""}
      <button class="props-delete-btn" id="prop-delete">Delete this block</button>
    `;

    document.getElementById("prop-name").addEventListener("input", (e) => {
      const val = slugify(e.target.value) || b.dataset.name;
      b.dataset.name = val;
      b.querySelector(".label-text").textContent = val;
    });
    document.getElementById("prop-x").addEventListener("input", (e) => {
      b.style.left = (parseInt(e.target.value) || 0) + "px";
    });
    document.getElementById("prop-y").addEventListener("input", (e) => {
      b.style.top = (parseInt(e.target.value) || 0) + "px";
    });
    document.getElementById("prop-w").addEventListener("input", (e) => {
      b.style.width = Math.max(60, parseInt(e.target.value) || 60) + "px";
      updateDim(b);
    });
    document.getElementById("prop-h").addEventListener("input", (e) => {
      b.style.height = Math.max(40, parseInt(e.target.value) || 40) + "px";
      updateDim(b);
    });
    document.getElementById("prop-padding").addEventListener("input", (e) => {
      const v = Math.max(0, parseInt(e.target.value) || 0);
      contentEl.style.padding = v + "px";
    });
    document.getElementById("prop-margin").addEventListener("input", (e) => {
      const v = Math.max(0, parseInt(e.target.value) || 0);
      b.style.margin = v + "px";
    });
    if (hasColor) {
      document.getElementById("prop-color").addEventListener("input", (e) => {
        setBlockColor(b, e.target.value);
      });
    }
    document.getElementById("prop-delete").addEventListener("click", () => deleteBlock(b));
  }

  function syncPropsFromBlock() {
    const xEl = document.getElementById("prop-x");
    const yEl = document.getElementById("prop-y");
    const wEl = document.getElementById("prop-w");
    const hEl = document.getElementById("prop-h");
    if (xEl) xEl.value = selectedBlock.offsetLeft;
    if (yEl) yEl.value = selectedBlock.offsetTop;
    if (wEl) wEl.value = selectedBlock.offsetWidth;
    if (hEl) hEl.value = selectedBlock.offsetHeight;
  }

  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function rgbToHex(rgb) {
    const match = rgb.match(/\d+/g);
    if (!match) return "#ffffff";
    return (
      "#" +
      match
        .slice(0, 3)
        .map((n) => parseInt(n).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  // ---------- Add-block buttons ----------

  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => addBlock(btn.dataset.type));
  });

  // ---------- Canvas width ----------

  canvasWidthSelect.addEventListener("change", () => {
    canvas.style.width = canvasWidthSelect.value + "px";
  });

  // ---------- Export ----------

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function indent(str) {
    return str
      .split("\n")
      .map((l) => (l ? "  " + l : l))
      .join("\n");
  }

  function exportBlockRecursive(blockEl, cssRules) {
    const type = blockEl.dataset.type;
    const name = blockEl.dataset.name;
    const id = blockEl.dataset.id;
    const left = blockEl.offsetLeft;
    const top = blockEl.offsetTop;
    const width = blockEl.offsetWidth;
    const height = blockEl.offsetHeight;
    const contentEl = blockEl.querySelector(".block-content");
    const padding = contentEl.style.padding;
    const margin = blockEl.style.margin;

    let inner = "";
    if (type === "container") {
      const childBlocks = Array.from(contentEl.children).filter((c) => c.classList.contains("block"));
      inner = childBlocks.length
        ? childBlocks.map((c) => exportBlockRecursive(c, cssRules)).join("\n\n")
        : "<!-- drag blocks here in the tool, or add your own content -->";
    } else if (type === "photo") {
      inner = `<img src="your-image.jpg" alt="Description of photo" style="width:100%;height:100%;object-fit:cover;">`;
    } else if (type === "banner") {
      inner = `<h2>${escapeHtml(contentEl.textContent.trim())}</h2>`;
    } else if (type === "text") {
      inner = `<p>${escapeHtml(contentEl.textContent.trim())}</p>`;
    } else {
      inner = `<!-- your content here -->`;
    }

    const html = `<div class="${name}">\n${indent(inner)}\n</div>`;

    let rules = `  position: absolute;\n  left: ${left}px;\n  top: ${top}px;\n  width: ${width}px;\n  height: ${height}px;`;
    if (colorVars[id]) {
      rules += `\n  background-color: var(--${id}-bg);`;
    } else if (type === "banner") {
      rules += `\n  background-color: #FFF6E3;`;
    }
    if (padding && parseInt(padding) > 0) rules += `\n  padding: ${padding};`;
    if (margin && parseInt(margin) > 0) rules += `\n  margin: ${margin};`;
    if (type === "banner") {
      rules += `\n  display: flex;\n  align-items: center;\n  font-family: sans-serif;`;
    }
    if (type === "text") {
      rules += `\n  font-family: sans-serif;\n  line-height: 1.5;`;
    }
    if (type === "container") {
      rules += `\n  overflow: hidden;`;
    }
    cssRules.push(`.${name} {\n${rules}\n}`);

    return html;
  }

  function generateCode() {
    const topBlocks = Array.from(canvas.children).filter((c) => c.classList.contains("block"));
    const pageWidth = canvas.offsetWidth;
    const cssRules = [];
    const htmlParts = topBlocks.map((b) => exportBlockRecursive(b, cssRules));

    let maxBottom = 0;
    topBlocks.forEach((b) => {
      maxBottom = Math.max(maxBottom, b.offsetTop + b.offsetHeight);
    });

    const usedIds = new Set();
    canvas.querySelectorAll(".block").forEach((b) => usedIds.add(b.dataset.id));
    const rootVarLines = Object.entries(colorVars)
      .filter(([id]) => usedIds.has(id))
      .map(([id, hex]) => `  --${id}-bg: ${hex};`);
    const rootBlock = rootVarLines.length ? `:root {\n${rootVarLines.join("\n")}\n}\n\n` : "";

    const html = `<div class="page-container">\n${indent(htmlParts.join("\n\n"))}\n</div>`;
    const css = `${rootBlock}.page-container {\n  position: relative;\n  width: ${pageWidth}px;\n  min-height: ${Math.max(maxBottom + 24, 200)}px;\n  margin: 0 auto;\n}\n\n${cssRules.join("\n\n")}`;

    return `<!-- Generated with IronSuit&Tie Layout Builder — plain HTML + CSS only, no JavaScript -->\n${html}\n\n<style>\n${css}\n</style>`;
  }

  exportBtn.addEventListener("click", () => {
    exportOutput.value = canvas.querySelectorAll(".block").length
      ? generateCode()
      : "Add at least one block to the canvas before exporting.";
    exportModal.classList.remove("hidden");
    copyConfirm.textContent = "";
  });

  modalClose.addEventListener("click", () => exportModal.classList.add("hidden"));
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) exportModal.classList.add("hidden");
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportOutput.value);
      copyConfirm.textContent = "Copied!";
    } catch (err) {
      exportOutput.select();
      document.execCommand("copy");
      copyConfirm.textContent = "Copied!";
    }
    setTimeout(() => (copyConfirm.textContent = ""), 2000);
  });

  // ---------- Seed the canvas so it isn't empty on load ----------

  function seedCanvas() {
    addBlock("banner");
    selectedBlock.style.left = "24px";
    selectedBlock.style.top = "24px";
    selectedBlock.style.width = "700px";

    addBlock("container");
    const container = selectedBlock;
    container.style.left = "24px";
    container.style.top = "140px";
    container.style.width = "380px";
    container.style.height = "300px";

    addBlock("photo");
    const photo = selectedBlock;
    const zone = container.querySelector(".block-content");
    zone.appendChild(photo);
    photo.style.left = "20px";
    photo.style.top = "20px";
    photo.style.width = "300px";
    photo.style.height = "200px";

    addBlock("text");
    selectedBlock.style.left = "430px";
    selectedBlock.style.top = "140px";
    selectedBlock.style.width = "294px";

    document.querySelectorAll(".block").forEach((b) => updateDim(b));
    if (selectedBlock) selectedBlock.classList.remove("selected");
    selectedBlock = null;
    renderProps();
  }

  seedCanvas();
})();
