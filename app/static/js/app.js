/**
 * LXDEC OS - Interactive D3.js System & Data Topology
 * Supports 4 dynamic layouts: Force-Directed, Concentric (OS Rings), Hierarchical (Stack Tiers), and Clustered (Domain Islands)
 */

const state = {
  topology: null,
  categoryColors: {},
  categoryLabels: {},
  selectedNodeId: "lxdec-core",
  activeCategory: "all",
  activeLayout: "force",
  searchQuery: "",
  simulation: null,
  svg: null,
  gZoom: null,
  guidesGroup: null,
  zoomBehavior: null,
  width: 1200,
  height: 800,
};

async function initApp() {
  const response = await fetch("/api/v1/topology");
  const data = await response.json();
  state.topology = data;

  data.categories.forEach((cat) => {
    state.categoryColors[cat.id] = cat.color;
    state.categoryLabels[cat.id] = cat.label;
  });

  populateHUD(data);
  setupSearch();
  setupLayoutSwitcher();
  setupModal(data.release);
  initGraph();
  selectNodeById("lxdec-core");
}

function populateHUD(data) {
  document.getElementById("distro-tagline").textContent = data.metadata.tagline;
  document.getElementById("meta-base").textContent = "Debian 13 (Trixie)";
  document.getElementById("meta-kernel").textContent = data.release.kernel;
  document.getElementById("meta-arch").textContent = "amd64 / arm64";
  document.getElementById("meta-count").textContent = `${data.nodes.length} Nodos / ${data.links.length} Enlaces`;
  document.getElementById("header-version").textContent = data.release.version;

  const legendList = document.getElementById("legend-list");
  legendList.innerHTML = "";

  const legendItems = [
    {
      id: "all",
      label: "Toda la Topología",
      description: "Vista completa de todas las capas y subsistemas",
      color: "var(--accent-cyan)",
    },
    ...data.categories,
  ];

  legendItems.forEach((cat) => {
    const li = document.createElement("li");
    li.className = "legend-item";

    const link = document.createElement("a");
    link.href = `#categoria-${cat.id}`;
    link.className = `legend-link${cat.id === state.activeCategory ? " active" : ""}`;
    link.dataset.category = cat.id;
    if (cat.id === state.activeCategory) {
      link.setAttribute("aria-current", "true");
    }
    link.innerHTML = `
      <span class="legend-dot" style="background:${cat.color}; box-shadow: 0 0 8px ${cat.color}"></span>
      <span class="legend-content">
        <strong class="legend-title">${cat.label}</strong>
        <span class="legend-desc">${cat.description}</span>
      </span>
    `;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      applyCategoryFilter(cat.id);
    });

    li.appendChild(link);
    legendList.appendChild(li);
  });
}

function setupSearch() {
  const searchInput = document.getElementById("node-search");
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    updateVisualVisibility();
  });
}

function setupLayoutSwitcher() {
  const buttons = document.querySelectorAll(".layout-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const layout = btn.dataset.layout;
      buttons.forEach((b) =>
        b.classList.toggle("active", b.dataset.layout === layout)
      );
      applyLayout(layout);
    });
  });

  // Mobile inspector drawer controls
  const inspector = document.getElementById("inspector-panel");
  const closeBtn = document.getElementById("close-inspector-btn");
  const toggleBtn = document.getElementById("btn-mobile-inspector");
  const sheetHandle = document.getElementById("mobile-sheet-toggle");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      inspector.classList.remove("mobile-open");
    });
  }
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      inspector.classList.toggle("mobile-open");
    });
  }
  if (sheetHandle) {
    sheetHandle.addEventListener("click", () => {
      inspector.classList.toggle("mobile-open");
    });
  }
}

function applyCategoryFilter(categoryId) {
  state.activeCategory = categoryId;
  document.querySelectorAll(".legend-link").forEach((link) => {
    const isActive = link.dataset.category === categoryId;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
  updateVisualVisibility();
}

function getConcentricRing(node) {
  if (node.id === "lxdec-core") return 0;
  if (node.category === "core" || node.id === "ebpf-telemetry") return 1;
  if (node.category === "dba") return 2;
  return 3;
}

function getHierarchicalTier(node) {
  // Tier 0 (top): Backend Runtimes, APIs & Cloud Containers
  // Tier 1: Data Engineering & Streaming
  // Tier 2: Multi-Paradigm PostgreSQL & DBA
  // Tier 3 (bottom foundation): Core Kernel, Storage, APT & eBPF
  if (node.category === "backend" || node.id === "containers-iac") return 0;
  if (node.category === "data_eng") return 1;
  if (node.category === "dba") return 2;
  return 3;
}

function initGraph() {
  const container = document.getElementById("graph-container");
  const width = container.clientWidth;
  const height = container.clientHeight;
  state.width = width;
  state.height = height;

  const nodes = state.topology.nodes.map((d) => ({ ...d }));
  const links = state.topology.links.map((d) => ({ ...d }));

  const svg = d3
    .select("#graph-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", [0, 0, width, height]);

  // Glow filter
  const defs = svg.append("defs");
  const filter = defs.append("filter").attr("id", "glow");
  filter.append("feGaussianBlur").attr("stdDeviation", "3.2").attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  const gZoom = svg.append("g");

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.35, 3.2])
    .on("zoom", (event) => {
      gZoom.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);

  // Architectural background guides layer
  const guidesGroup = gZoom.append("g").attr("class", "layout-guides");

  const linkGroup = gZoom.append("g").attr("class", "links");
  const linkElements = linkGroup
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link-line");

  const linkLabelElements = linkGroup
    .selectAll("text")
    .data(links)
    .join("text")
    .attr("class", "link-label")
    .attr("text-anchor", "middle")
    .text((d) => d.type);

  const nodeGroup = gZoom.append("g").attr("class", "nodes");
  const nodeElements = nodeGroup
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node-group")
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) state.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event) => {
          if (!event.active) state.simulation.alphaTarget(0);
        })
    )
    .on("click", (event, d) => {
      event.stopPropagation();
      selectNodeById(d.id, true);
    })
    .on("mouseenter", (event, d) => showTooltip(event, d))
    .on("mousemove", (event) => moveTooltip(event))
    .on("mouseleave", () => hideTooltip());

  // Outer pulse halo for root kernel node
  nodeElements
    .filter((d) => d.id === "lxdec-core")
    .append("circle")
    .attr("r", (d) => d.radius + 10)
    .attr("fill", "none")
    .attr("stroke", (d) => state.categoryColors[d.category])
    .attr("stroke-opacity", 0.35)
    .attr("stroke-dasharray", "4 4");

  nodeElements
    .append("circle")
    .attr("class", "node-circle")
    .attr("r", (d) => d.radius)
    .attr("fill", (d) => {
      const c = d3.color(state.categoryColors[d.category]);
      c.opacity = 0.22;
      return c.formatRgb();
    })
    .attr("stroke", (d) => state.categoryColors[d.category])
    .attr("filter", "url(#glow)");

  // Inner core dot (or embedded DEC logo on root kernel node)
  nodeElements
    .filter((d) => d.id !== "lxdec-core")
    .append("circle")
    .attr("r", (d) => Math.max(4, d.radius * 0.28))
    .attr("fill", (d) => state.categoryColors[d.category]);

  nodeElements
    .filter((d) => d.id === "lxdec-core")
    .append("image")
    .attr("href", "/static/img/logo.svg")
    .attr("x", -22)
    .attr("y", -22)
    .attr("width", 44)
    .attr("height", 44);

  nodeElements
    .append("text")
    .attr("class", "node-label")
    .attr("dy", (d) => d.radius + 16)
    .attr("text-anchor", "middle")
    .text((d) => d.label);

  const simulation = d3.forceSimulation(nodes).on("tick", () => {
    linkElements
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    linkLabelElements
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4);

    nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  state.svg = svg;
  state.gZoom = gZoom;
  state.guidesGroup = guidesGroup;
  state.zoomBehavior = zoomBehavior;
  state.simulation = simulation;
  state.nodeElements = nodeElements;
  state.linkElements = linkElements;
  state.linkLabelElements = linkLabelElements;
  state.nodesData = nodes;
  state.linksData = links;

  // Close mobile inspector sheet when tapping empty canvas area
  svg.on("click", () => {
    const inspector = document.getElementById("inspector-panel");
    if (inspector) inspector.classList.remove("mobile-open");
  });

  // Initialize with default Force layout
  applyLayout("force");

  // Auto fit zoom on narrow mobile screens so the whole topology fits comfortably
  if (width < 820) {
    const initialScale = Math.max(0.48, Math.min(0.72, width / 920));
    const tx = (width - width * initialScale) / 2;
    const ty = (height - height * initialScale) / 2;
    svg.call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(tx, ty).scale(initialScale)
    );
  }

  const resetZoomFn = () => {
    if (state.width < 820) {
      const s = Math.max(0.48, Math.min(0.72, state.width / 920));
      const tx = (state.width - state.width * s) / 2;
      const ty = (state.height - state.height * s) / 2;
      svg
        .transition()
        .duration(450)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(s));
    } else {
      svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
    }
  };

  document.getElementById("btn-reset-zoom").addEventListener("click", resetZoomFn);
  const mobileCenterBtn = document.getElementById("btn-mobile-center");
  if (mobileCenterBtn) {
    mobileCenterBtn.addEventListener("click", resetZoomFn);
  }

  document.getElementById("btn-unpin").addEventListener("click", () => {
    nodes.forEach((n) => {
      n.fx = null;
      n.fy = null;
    });
    applyLayout(state.activeLayout);
  });
}

function applyLayout(layoutName) {
  state.activeLayout = layoutName;
  const sim = state.simulation;
  const nodes = state.nodesData;
  const links = state.linksData;
  const isMobile = state.width < 820;
  const cx = isMobile ? state.width / 2 : state.width / 2 - 35;
  const cy = state.height / 2;

  // Clear pinned positions and previous guides
  nodes.forEach((n) => {
    n.fx = null;
    n.fy = null;
  });
  state.guidesGroup.selectAll("*").remove();

  // Reset all forces
  sim.force("link", null);
  sim.force("charge", null);
  sim.force("center", null);
  sim.force("x", null);
  sim.force("y", null);
  sim.force("radial", null);
  sim.force(
    "collision",
    d3.forceCollide().radius((d) => d.radius + 24).iterations(2)
  );

  if (layoutName === "force") {
    sim
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => (d.source.id === "lxdec-core" ? 165 : 130))
          .strength((d) => d.strength || 0.7)
      )
      .force("charge", d3.forceManyBody().strength(-650))
      .force("center", d3.forceCenter(cx, cy));
  } else if (layoutName === "concentric") {
    const ringRadii = [0, 115, 225, 335];
    const ringLabels = [
      "",
      "RING 1 // STORAGE, APT & KERNEL eBPF",
      "RING 2 // MULTI-PARADIGM POSTGRESQL & DB ENGINES",
      "RING 3 // DATA ENG, BACKEND RUNTIMES & CONTAINERS",
    ];

    // Draw concentric SVG guide rings
    ringRadii.slice(1).forEach((r, idx) => {
      state.guidesGroup
        .append("circle")
        .attr("class", "layout-guide-ring")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r);

      state.guidesGroup
        .append("text")
        .attr("class", "layout-guide-label")
        .attr("x", cx)
        .attr("y", cy - r - 7)
        .attr("text-anchor", "middle")
        .text(ringLabels[idx + 1]);
    });

    // Distribute angles evenly per ring for clean symmetry
    const ringBuckets = { 0: [], 1: [], 2: [], 3: [] };
    nodes.forEach((n) => {
      ringBuckets[getConcentricRing(n)].push(n);
    });

    const targetCoords = {};
    Object.entries(ringBuckets).forEach(([ringIdx, bucket]) => {
      const r = ringRadii[Number(ringIdx)];
      bucket.forEach((node, i) => {
        if (r === 0) {
          targetCoords[node.id] = { x: cx, y: cy };
        } else {
          const angle = (2 * Math.PI * i) / bucket.length - Math.PI / 2;
          targetCoords[node.id] = {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
          };
        }
      });
    });

    sim
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .strength(0.05)
      )
      .force(
        "x",
        d3.forceX((d) => targetCoords[d.id].x).strength(0.85)
      )
      .force(
        "y",
        d3.forceY((d) => targetCoords[d.id].y).strength(0.85)
      );
  } else if (layoutName === "hierarchical") {
    const tierY = [
      cy - 245,
      cy - 85,
      cy + 85,
      cy + 245,
    ];
    const tierTitles = [
      "LAYER 4 // BACKEND RUNTIMES, APIs & CLOUD CONTAINERS",
      "LAYER 3 // DATA ENGINEERING, OLAP & STREAMING",
      "LAYER 2 // MULTI-PARADIGM POSTGRESQL (ACID / GRAPH / JSONB / VECTOR)",
      "LAYER 1 // DEBIAN 13 TRIXIE CORE KERNEL 6.12, STORAGE, APT & eBPF",
    ];

    // Draw horizontal tier guide lines and labels
    tierY.forEach((yPos, idx) => {
      state.guidesGroup
        .append("line")
        .attr("class", "layout-guide-line")
        .attr("x1", cx - 390)
        .attr("y1", yPos)
        .attr("x2", cx + 390)
        .attr("y2", yPos);

      state.guidesGroup
        .append("text")
        .attr("class", "layout-guide-label")
        .attr("x", cx - 385)
        .attr("y", yPos - 42)
        .text(tierTitles[idx]);
    });

    // Distribute nodes horizontally along their assigned tier
    const tierBuckets = { 0: [], 1: [], 2: [], 3: [] };
    nodes.forEach((n) => {
      tierBuckets[getHierarchicalTier(n)].push(n);
    });

    const targetX = {};
    const targetY = {};
    Object.entries(tierBuckets).forEach(([tierIdx, bucket]) => {
      const y = tierY[Number(tierIdx)];
      const span = Math.min(700, bucket.length * 165);
      const startX = cx - span / 2;
      bucket.forEach((node, i) => {
        targetY[node.id] = y;
        targetX[node.id] =
          bucket.length === 1
            ? cx
            : startX + (span / (bucket.length - 1)) * i;
      });
    });

    sim
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .strength(0.08)
      )
      .force(
        "x",
        d3.forceX((d) => targetX[d.id]).strength(0.85)
      )
      .force(
        "y",
        d3.forceY((d) => targetY[d.id]).strength(0.92)
      );
  } else if (layoutName === "clustered") {
    const clusterFoci = {
      core: { x: cx, y: cy, label: "CORE & KERNEL", r: 120 },
      dba: { x: cx - 265, y: cy - 165, label: "MULTI-PARADIGM POSTGRESQL", r: 135 },
      data_eng: { x: cx + 265, y: cy - 165, label: "DATA ENGINEERING & OLAP", r: 125 },
      backend: { x: cx + 245, y: cy + 185, label: "BACKEND & API STACK", r: 115 },
      observability: { x: cx - 245, y: cy + 185, label: "OBSERVABILITY & CONTAINERS", r: 115 },
    };

    Object.entries(clusterFoci).forEach(([catId, focus]) => {
      const color = state.categoryColors[catId] || "#38bdf8";
      state.guidesGroup
        .append("circle")
        .attr("class", "layout-guide-cluster")
        .attr("cx", focus.x)
        .attr("cy", focus.y)
        .attr("r", focus.r)
        .attr("stroke", color)
        .attr("stroke-opacity", 0.35);

      state.guidesGroup
        .append("text")
        .attr("class", "layout-guide-label")
        .attr("x", focus.x)
        .attr("y", focus.y - focus.r - 10)
        .attr("text-anchor", "middle")
        .style("fill", color)
        .text(focus.label);
    });

    sim
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .strength(0.06)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force(
        "x",
        d3.forceX((d) => (clusterFoci[d.category] || clusterFoci.core).x).strength(0.65)
      )
      .force(
        "y",
        d3.forceY((d) => (clusterFoci[d.category] || clusterFoci.core).y).strength(0.65)
      );
  }

  sim.alpha(0.95).restart();
}

function selectNodeById(nodeId, openMobileDrawer = false) {
  state.selectedNodeId = nodeId;
  const node = state.topology.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  if (openMobileDrawer && window.innerWidth <= 820) {
    const inspector = document.getElementById("inspector-panel");
    if (inspector) inspector.classList.add("mobile-open");
  }

  const catColor = state.categoryColors[node.category] || "#38bdf8";
  const catLabel = state.categoryLabels[node.category] || node.category;

  const catEl = document.getElementById("insp-category");
  catEl.textContent = catLabel;
  catEl.style.color = catColor;

  document.getElementById("insp-title").textContent = node.label;
  document.getElementById("insp-version").textContent = `v${node.version}`;
  document.getElementById("insp-role").textContent = `// ${node.role}`;
  document.getElementById("insp-summary").textContent = node.summary;
  document.getElementById("insp-package").textContent = `sudo apt install -y ${node.package}`;
  document.getElementById("insp-cli").textContent = node.cli_check;

  const specsList = document.getElementById("insp-specs");
  specsList.innerHTML = "";
  node.specs.forEach((spec) => {
    const li = document.createElement("li");
    li.style.borderLeftColor = catColor;
    li.textContent = spec;
    specsList.appendChild(li);
  });

  // Render neighbor connection chips
  const connContainer = document.getElementById("insp-connections");
  connContainer.innerHTML = "";
  const relatedLinks = state.topology.links.filter(
    (l) => l.source === nodeId || l.target === nodeId
  );

  relatedLinks.forEach((l) => {
    const otherId = l.source === nodeId ? l.target : l.source;
    const otherNode = state.topology.nodes.find((n) => n.id === otherId);
    if (!otherNode) return;
    const chip = document.createElement("button");
    chip.className = "conn-chip";
    chip.innerHTML = `${otherNode.label} <span class="rel-type">[${l.type}]</span>`;
    chip.addEventListener("click", () => selectNodeById(otherId));
    connContainer.appendChild(chip);
  });

  // Highlight selected node & connected edges in D3
  if (state.nodeElements) {
    state.nodeElements.classed("selected", (d) => d.id === nodeId);

    state.linkElements.classed(
      "highlighted",
      (d) => d.source.id === nodeId || d.target.id === nodeId
    );
  }
}

function updateVisualVisibility() {
  if (!state.nodeElements) return;

  const isNodeVisible = (d) => {
    const matchesCategory =
      state.activeCategory === "all" ||
      d.category === state.activeCategory ||
      d.id === "lxdec-core";

    const matchesSearch =
      !state.searchQuery ||
      d.label.toLowerCase().includes(state.searchQuery) ||
      d.package.toLowerCase().includes(state.searchQuery) ||
      d.summary.toLowerCase().includes(state.searchQuery);

    return matchesCategory && matchesSearch;
  };

  state.nodeElements
    .transition()
    .duration(220)
    .style("opacity", (d) => (isNodeVisible(d) ? 1 : 0.14));

  state.linkElements
    .transition()
    .duration(220)
    .style("opacity", (d) =>
      isNodeVisible(d.source) && isNodeVisible(d.target) ? 1 : 0.08
    );

  state.linkLabelElements
    .transition()
    .duration(220)
    .style("opacity", (d) =>
      isNodeVisible(d.source) && isNodeVisible(d.target) ? 0.75 : 0.05
    );
}

function showTooltip(event, d) {
  const tooltip = document.getElementById("graph-tooltip");
  tooltip.classList.remove("hidden");
  tooltip.innerHTML = `<strong>${d.label}</strong> <span style="color:#38bdf8">(${d.version})</span><br/><span style="color:#94a3b8">${d.role}</span>`;
  moveTooltip(event);
}

function moveTooltip(event) {
  const tooltip = document.getElementById("graph-tooltip");
  tooltip.style.left = `${event.offsetX + 16}px`;
  tooltip.style.top = `${event.offsetY - 12}px`;
}

function hideTooltip() {
  document.getElementById("graph-tooltip").classList.add("hidden");
}

function setupModal(release) {
  const modal = document.getElementById("iso-modal");
  document.getElementById("open-iso-modal").addEventListener("click", () => {
    modal.classList.remove("hidden");
  });
  document.getElementById("close-iso-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  document.getElementById("modal-version").textContent = release.version;
  document.getElementById("modal-size").textContent = `${release.iso_size_mb} MB`;
  document.getElementById("modal-kernel").textContent = release.kernel;
  document.getElementById("modal-sha256").textContent = release.iso_sha256;
  document.getElementById("modal-curl-cmd").textContent = `curl -fLO ${window.location.origin}/api/v1/download/latest`;

  document.getElementById("copy-pkg-btn").addEventListener("click", (e) => {
    const text = document.getElementById("insp-package").textContent;
    navigator.clipboard.writeText(text);
    e.target.textContent = "OK!";
    setTimeout(() => (e.target.textContent = "COPIAR"), 1200);
  });

  document.getElementById("copy-sha-btn").addEventListener("click", (e) => {
    const text = document.getElementById("modal-sha256").textContent;
    navigator.clipboard.writeText(text);
    e.target.textContent = "OK!";
    setTimeout(() => (e.target.textContent = "COPIAR"), 1200);
  });
}

window.addEventListener("DOMContentLoaded", initApp);
