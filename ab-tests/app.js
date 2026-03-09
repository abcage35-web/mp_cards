function renderIcon(name, className = "") {
  const cls = className ? ` class="${className}"` : "";
  switch (name) {
    case "refresh":
      return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;
    case "search":
      return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
    case "info":
      return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7.5h.01"/></svg>`;
    case "externalLink":
      return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v5a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1h5"/></svg>`;
    default:
      return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>`;
  }
}

function formatDateTime(valueRaw) {
  const value = String(valueRaw || "").trim();
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function applyStaticIcons() {
  const refreshBtn = document.getElementById("abTestsRefreshBtn");
  if (!refreshBtn) {
    return;
  }
  const label = String(refreshBtn.textContent || "Обновить данные").trim() || "Обновить данные";
  refreshBtn.innerHTML = `${renderIcon("refresh", "ui-icon")}<span class="btn-label">${label}</span>`;
}

const abCoverHoverPreview = {
  root: null,
  image: null,
  activeLink: null,
};

function ensureAbCoverHoverPreview() {
  if (abCoverHoverPreview.root && abCoverHoverPreview.image) {
    return abCoverHoverPreview;
  }
  const root = document.createElement("div");
  root.className = "ab-cover-hover-preview";
  root.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  root.appendChild(image);
  document.body.appendChild(root);
  abCoverHoverPreview.root = root;
  abCoverHoverPreview.image = image;
  return abCoverHoverPreview;
}

function hideAbCoverHoverPreview() {
  if (!abCoverHoverPreview.root) {
    return;
  }
  abCoverHoverPreview.root.classList.remove("is-visible");
  abCoverHoverPreview.root.style.removeProperty("--preview-left");
  abCoverHoverPreview.root.style.removeProperty("--preview-top");
  abCoverHoverPreview.root.style.removeProperty("--preview-width");
  abCoverHoverPreview.activeLink = null;
}

function positionAbCoverHoverPreview(link) {
  const preview = ensureAbCoverHoverPreview();
  const rect = link.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width * 2.4, 180), 260);
  const estimatedHeight = width * (4 / 3);
  const margin = 16;
  const centerX = Math.min(
    window.innerWidth - margin - width / 2,
    Math.max(margin + width / 2, rect.left + rect.width / 2),
  );
  const centerY = Math.min(
    window.innerHeight - margin - estimatedHeight / 2,
    Math.max(margin + estimatedHeight / 2, rect.top + rect.height / 2),
  );
  preview.root.style.setProperty("--preview-left", `${centerX}px`);
  preview.root.style.setProperty("--preview-top", `${centerY}px`);
  preview.root.style.setProperty("--preview-width", `${width}px`);
}

function showAbCoverHoverPreview(link) {
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }
  const imageNode = link.querySelector("img");
  const imageSrc = imageNode?.currentSrc || imageNode?.src || link.href || "";
  if (!imageSrc) {
    hideAbCoverHoverPreview();
    return;
  }
  const preview = ensureAbCoverHoverPreview();
  preview.image.src = imageSrc;
  preview.activeLink = link;
  positionAbCoverHoverPreview(link);
  preview.root.classList.add("is-visible");
}

function bindAbPageEvents() {
  const refreshBtn = document.getElementById("abTestsRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (typeof refreshAbDashboardData === "function") {
        refreshAbDashboardData();
      }
    });
  }

  document.addEventListener("mouseover", (event) => {
    const link = event.target instanceof Element ? event.target.closest(".ab-cover-link") : null;
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) {
      return;
    }
    showAbCoverHoverPreview(link);
  });

  document.addEventListener("mouseout", (event) => {
    const link = event.target instanceof Element ? event.target.closest(".ab-cover-link") : null;
    if (!(link instanceof HTMLAnchorElement) || link !== abCoverHoverPreview.activeLink) {
      return;
    }
    const nextLink = event.relatedTarget instanceof Element ? event.relatedTarget.closest(".ab-cover-link") : null;
    if (nextLink === link) {
      return;
    }
    hideAbCoverHoverPreview();
  });

  window.addEventListener("scroll", () => {
    if (abCoverHoverPreview.activeLink instanceof HTMLAnchorElement) {
      positionAbCoverHoverPreview(abCoverHoverPreview.activeLink);
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (abCoverHoverPreview.activeLink instanceof HTMLAnchorElement) {
      positionAbCoverHoverPreview(abCoverHoverPreview.activeLink);
    }
  });

  document.addEventListener("ab:content-render", () => {
    hideAbCoverHoverPreview();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyStaticIcons();
  bindAbPageEvents();
  if (typeof ensureAbDashboardLoaded === "function") {
    ensureAbDashboardLoaded();
  }
});
