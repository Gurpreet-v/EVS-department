const SHEET_BASE = "https://docs.google.com/spreadsheets/d/1RZ7LsGXl2GQtlp_H_kysMmDldKF4uGv5QD_KAzQHTKg/export?format=csv&gid=";


// NOTE: You will need to slightly adjust your SHEET_URLS construction logic below
// because encoding the URL changes how we append the GID.

const SHEET_URLS = {
    homeGlance: SHEET_BASE + "658317754",
    homeExplore: SHEET_BASE + "212523631",
    homeTestimonials: SHEET_BASE + "202581391",
    introContent: SHEET_BASE + "1693198998",
    programmesMeta: SHEET_BASE + "1668694487",
    programmesCards: SHEET_BASE + "735159063",
    facultyProfiles: SHEET_BASE + "291092648",
    researchMeta: SHEET_BASE + "1228924024", 
    researchAreas: SHEET_BASE + "1158782783", 
    researchProjects: SHEET_BASE + "1493476684",
    newsMeta: SHEET_BASE + "1075587213",
    newsItems: SHEET_BASE + "1667932999",
    galleryMeta: SHEET_BASE + "1687826536",
    galleryItems: SHEET_BASE + "889330208",
    projectsItems: SHEET_BASE + "1105126191",
    projectsMeta: SHEET_BASE + "794340848",
    careerMeta: SHEET_BASE + "1740934720",
    careerLegend: SHEET_BASE + "1381692189",
    careerConnectorCards: SHEET_BASE + "2030664227",
    careerNodes: SHEET_BASE + "556552219",
    careerDetails: SHEET_BASE + "866345003",
    gameCareers: SHEET_BASE + "0",
    gameMissions: SHEET_BASE + "1595079603",
    gameOptions:  SHEET_BASE + "1628210072",
    pageCopy: SHEET_BASE + "1194194423"
};


/*
const SHEET_URLS = {
    homeGlance: "./data/home_glance.csv",
    homeExplore: "./data/home_explore.csv",
    homeTestimonials: "./data/home_testimonials.csv"
};
*/

function parseCSV(text) {
    const rows = text.trim().split(/\r?\n/); // Handle Windows/Unix newlines
    if (rows.length === 0) return [];

    // Helper to split CSV lines correctly handling quotes
    const splitCSVLine = (line) => {
        const values = [];
        let current = '';
        let inQuote = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                // Handle escaped quotes ("") vs end of quote
                if (inQuote && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);
        return values;
    };

    const headers = splitCSVLine(rows[0]).map(h => h.trim());

    return rows.slice(1).map(line => {
        // Skip empty lines
        if (!line.trim()) return null;
        
        const parts = splitCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            // Remove wrapping quotes if they exist from Google's export
            let val = parts[i] || "";
            obj[h] = val.trim();
        });
        return obj;
    }).filter(item => item !== null); // Remove nulls from empty lines
}

function parseScoreString(scoreStr) {
    const result = {};
    if (!scoreStr) return result;
    scoreStr.split(";").forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const [key, val] = trimmed.split(":");
        if (!key) return;
        const score = parseFloat((val || "0").trim());
        if (!isNaN(score) && score !== 0) {
            result[key.trim()] = score;
        }
    });
    return result;
}


// 1 hour in milliseconds (60 minutes * 60 seconds * 1000 ms)
const CACHE_DURATION = 60 * 60 * 1000; 

let pageCopyCache = null;

async function loadSheet(name) {
    const url = SHEET_URLS[name];
    if (!url) return [];

    const cacheKey = "sheet_data_" + name;
    const now = Date.now();

    // --- STEP 1: CHECK CACHE ---
    const cachedStr = localStorage.getItem(cacheKey);
    
    if (cachedStr) {
        try {
            const cachedObj = JSON.parse(cachedStr);
            const age = now - cachedObj.timestamp;

            // If cache is younger than 1 hour, use it
            if (age < CACHE_DURATION) {
                // Optional: Log to console so you know it's working
                // console.log(`Loaded ${name} from cache (Age: ${Math.round(age/1000)}s)`);
                return cachedObj.data;
            }
        } catch (e) {
            // If JSON is corrupted, ignore and fetch fresh
            console.warn("Cache parse error, fetching fresh data.");
        }
    }

    // --- STEP 2: FETCH FRESH DATA ---
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const text = await res.text();
        const data = parseCSV(text);

        // --- STEP 3: SAVE TO CACHE ---
        try {
            const cacheItem = {
                timestamp: now,
                data: data
            };
            // We store the *parsed* data so we don't have to re-parse CSV next time
            localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
        } catch (e) {
            console.warn("LocalStorage full or disabled", e);
        }

        return data;

    } catch (error) {
        console.error(`Failed to load sheet: ${name}`, error);
        return [];
    }
}

async function ensurePageCopyLoaded() {
    if (pageCopyCache !== null) return pageCopyCache;
    let rows = [];
    try {
        rows = await loadSheet("pageCopy");
    } catch (e) {
        rows = [];
    }
    const map = {};
    rows.forEach(row => {
        const page = (row.page || "").trim().toLowerCase();
        const block = (row.block || "").trim().toLowerCase();
        if (!page || !block) return;
        if (!map[page]) map[page] = {};
        map[page][block] = row;
    });
    pageCopyCache = map;
    return map;
}

function applyPageCopy(page, block, targets = {}) {
    if (!pageCopyCache) return;
    const entry = pageCopyCache[page?.toLowerCase()]?.[block?.toLowerCase()];
    if (!entry) return;
    if (targets.title && entry.title) targets.title.textContent = entry.title;
    if (targets.text && entry.text) targets.text.textContent = entry.text;
}

async function populateHomeGlance() {
    const grid = document.querySelector("#glance-grid");
    if (!grid) return;
    const data = await loadSheet("homeGlance");
    grid.innerHTML = "";
    data.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${item.title || ""}</h3>
            <p>${item.text || ""}</p>
        `;
        grid.appendChild(card);
    });
}

async function populateHomeExplore() {
    const grid = document.querySelector("#explore-grid");
    if (!grid) return;
    const data = await loadSheet("homeExplore");
    grid.innerHTML = "";
    data.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        const title = item.title || "";
        const text = item.text || "";
        const btnLabel = item.button_label || "";
        const href = item.button_href || "#";
        card.innerHTML = `
            <h3>${title}</h3>
            <p>${text}</p>
            <div class="btn-row">
                <a class="btn btn-outline" href="${href}">${btnLabel}</a>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function populateHomeTestimonials() {
    const grid = document.querySelector("#testimonial-grid");
    if (!grid) return;
    const data = await loadSheet("homeTestimonials");
    grid.innerHTML = "";
    data.forEach(item => {
        const group = (item.group || "").toLowerCase() || "all";
        const name = item.name || "";
        const text = item.text || "";
        const role = item.role || "";
        const programme = item.programme || "";
        const tags = item.tags || "";

        const article = document.createElement("article");
        article.className = "testimonial-card";
        article.dataset.groups = group;

        article.innerHTML = `
            <div class="testimonial-quote">
                <div class="testimonial-text-inner">
                    ${text}
                </div>
            </div>
            <div class="testimonial-person">
                <div class="testimonial-avatar">${name ? name.charAt(0).toUpperCase() : ""}</div>
                <div>
                    <div class="testimonial-name">${name}</div>
                    <div class="testimonial-meta">${programme}${role ? " · " + role : ""}</div>
                </div>
            </div>
            <div class="testimonial-tags"></div>
        `;

        const tagsContainer = article.querySelector(".testimonial-tags");
        if (tagsContainer && tags) {
            tags.split(";").map(t => t.trim()).filter(Boolean).forEach(t => {
                const span = document.createElement("span");
                span.textContent = t;
                tagsContainer.appendChild(span);
            });
        }

        grid.appendChild(article);
    });

    applyTestimonialFilter("all");
}

function setActiveTestimonialFilter(btn, buttons) {
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

function applyTestimonialFilter(group) {
    const cards = document.querySelectorAll(".testimonial-card");
    cards.forEach(card => {
        const groups = (card.dataset.groups || "").split(" ");
        if (group === "all" || groups.includes(group)) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
}

function setupTestimonialFilters() {
    const buttons = Array.from(document.querySelectorAll(".testimonial-filter-btn"));
    if (!buttons.length) return;
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const group = btn.dataset.group;
            setActiveTestimonialFilter(btn, buttons);
            applyTestimonialFilter(group);
        });
    });
}

function applySavedSidebarState() {
    const saved = localStorage.getItem("sidebarOpen");
    if (saved === "true") {
        document.body.classList.add("sidebar-open");
    } else {
        document.body.classList.remove("sidebar-open");
    }
}

function setupSidebarToggle() {
    const toggleBtn = document.querySelector(".sidebar-toggle");
    if (!toggleBtn) return;
    toggleBtn.addEventListener("click", () => {
        const isOpen = document.body.classList.toggle("sidebar-open");
        localStorage.setItem("sidebarOpen", isOpen ? "true" : "false");
    });
}

async function populateIntroduction() {
    const heroTitleEl = document.querySelector("#intro-hero-title");
    const heroTextEl = document.querySelector("#intro-hero-text");
    const aboutTitleEl = document.querySelector("#intro-about-title");
    const aboutTextEl = document.querySelector("#intro-about-text");
    const degreesGrid = document.querySelector("#intro-degrees-grid");

    // If these are not present, we are not on introduction.html
    if (!heroTitleEl || !heroTextEl || !aboutTitleEl || !aboutTextEl || !degreesGrid) {
        return;
    }

    const data = await loadSheet("introContent");
    const byId = {};
    data.forEach(row => {
        if (row.section_id) {
            byId[row.section_id.trim()] = row;
        }
    });

    if (byId.hero) {
        heroTitleEl.textContent = byId.hero.title || "";
        heroTextEl.textContent = byId.hero.text || "";
    }

    if (byId.about) {
        aboutTitleEl.textContent = byId.about.title || "";
        aboutTextEl.textContent = byId.about.text || "";
    }

    degreesGrid.innerHTML = "";

    const degreeSections = [
        "degree_cores",
        "degree_electives",
        "degree_projects"
    ];

    degreeSections.forEach(id => {
        const item = byId[id];
        if (!item) return;
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${item.title || ""}</h3>
            <p>${item.text || ""}</p>
        `;
        degreesGrid.appendChild(card);
    });
}

async function populateProgrammes() {
    const heroTitleEl = document.querySelector("#programmes-hero-title");
    const heroTextEl = document.querySelector("#programmes-hero-text");
    const sciencesTitleEl = document.querySelector("#programmes-sciences-title");
    const policyTitleEl = document.querySelector("#programmes-policy-title");
    const sciencesGrid = document.querySelector("#programmes-sciences-grid");
    const policyGrid = document.querySelector("#programmes-policy-grid");

    // If these elements are not present, we are not on content.html
    if (!heroTitleEl || !heroTextEl || !sciencesTitleEl || !policyTitleEl || !sciencesGrid || !policyGrid) {
        return;
    }

    // 1) Meta: hero + section titles
    const metaRows = await loadSheet("programmesMeta");
    const metaById = {};
    metaRows.forEach(row => {
        if (row.id) {
            metaById[row.id.trim()] = row;
        }
    });

    if (metaById.hero) {
        heroTitleEl.textContent = metaById.hero.title || "";
        heroTextEl.textContent = metaById.hero.text || "";
    }
    if (metaById.sciences) {
        sciencesTitleEl.textContent = metaById.sciences.title || sciencesTitleEl.textContent;
    }
    if (metaById.policy) {
        policyTitleEl.textContent = metaById.policy.title || policyTitleEl.textContent;
    }

    // 2) Cards: sciences + policy
    const cardRows = await loadSheet("programmesCards");

    sciencesGrid.innerHTML = "";
    policyGrid.innerHTML = "";

    cardRows.forEach(row => {
        const sectionId = (row.section_id || "").toLowerCase();
        if (!sectionId) return;

        const title = row.title || "";
        const text = row.text || "";
        const tags = row.tags || "";

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${title}</h3>
            <p>${text}</p>
            <div class="tag-row"></div>
        `;

        const tagRow = card.querySelector(".tag-row");
        if (tagRow && tags) {
            tags.split(";")
                .map(t => t.trim())
                .filter(Boolean)
                .forEach(t => {
                    const span = document.createElement("span");
                    span.textContent = t;
                    tagRow.appendChild(span);
                });
        } else if (tagRow && !tags) {
            // No tags → remove empty tag row
            tagRow.remove();
        }

        if (sectionId === "sciences") {
            sciencesGrid.appendChild(card);
        } else if (sectionId === "policy") {
            policyGrid.appendChild(card);
        }
    });
}

function splitAreas(raw) {
    if (!raw) return [];
    return raw
        .split(/[;, ]+/)
        .map(a => a.trim().toLowerCase())
        .filter(Boolean);
}

function titleCase(str) {
    return str
        .split(/[\s-]+/)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
}

async function populateFaculty() {
    const grid = document.querySelector("#profile-grid");
    const filterRow = document.querySelector("#profile-filter-row");
    if (!grid || !filterRow) return;  // not on faculty page

    const rows = await loadSheet("facultyProfiles");

    grid.innerHTML = "";
    filterRow.innerHTML = "";

    const allAreasSet = new Set();

    rows.forEach(row => {
        const areas = splitAreas(row.areas || "");
        areas.forEach(a => allAreasSet.add(a));
    });

    const areasList = Array.from(allAreasSet).sort();

    const allBtn = document.createElement("button");
    allBtn.className = "btn btn-outline filter-btn active";
    allBtn.dataset.area = "all";
    allBtn.textContent = "All";
    filterRow.appendChild(allBtn);

    areasList.forEach(area => {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline filter-btn";
        btn.dataset.area = area;
        btn.textContent = titleCase(area);
        filterRow.appendChild(btn);
    });

    rows.forEach(row => {
        const name = row.name || "";
        const role = row.role || "";
        const email = row.email || "";
        const office = row.office || "";
        const areas = splitAreas(row.areas || "");
        const tags = (row.tags || "").split(";").map(t => t.trim()).filter(Boolean);
        const shortBio = row.short_bio || "";
        const about = row.about || "";
        const publicationsRaw = row.publications || "";
        const advice = row.advice || "";
        const website = row.website || "";
        const openForResearch = (row.open_for_student_research || "").trim().toLowerCase();
        const showOpenTag = ["yes", "true", "1"].includes(openForResearch);

        const initials = (name || "")
            .split(" ")
            .filter(Boolean)
            .map(part => part[0].toUpperCase())
            .slice(0, 2)
            .join("");

        const card = document.createElement("article");
        card.className = "profile-card";
        card.dataset.areas = areas.join(" ");

        card.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar placeholder-avatar">
                    <span>${initials}</span>
                </div>
                <div>
                    <h3 class="profile-name">${name}</h3>
                    <p class="profile-role">${role}</p>
                </div>
            </div>
            <p class="profile-bio">
                ${shortBio}
            </p>
            <div class="pill-row">${tags.map(t => `<span>${t}</span>`).join("")}</div>
            ${showOpenTag ? `<div class="research-tag">Open for Student Research</div>` : ""}
            <p class="profile-meta">
                ${email ? `Email: <a href="mailto:${email}">${email}</a><br>` : ""}
                ${office ? `Office: ${office}<br>` : ""}
                ${website ? `Website: <a href="${website}" target="_blank" rel="noopener noreferrer">View profile</a>` : ""}
            </p>
            <div class="profile-detail" hidden></div>
        `;

        const detailEl = card.querySelector(".profile-detail");
        const pubItems = publicationsRaw
            .split("||")
            .map(p => p.trim())
            .filter(Boolean);

        let detailHtml = "";

        if (about) {
            detailHtml += `
                <h4>About</h4>
                <p>${about}</p>
            `;
        }

        if (pubItems.length) {
            detailHtml += `<h4>Selected publications</h4><ul>`;
            pubItems.forEach(p => {
                detailHtml += `<li>${p}</li>`;
            });
            detailHtml += `</ul>`;
        }

        if (advice) {
            detailHtml += `
                <h4>Advice for students</h4>
                <p>${advice}</p>
            `;
        }

        if (email || office || website) {
            detailHtml += `<h4>Contact and links</h4><p>`;
            if (email) {
                detailHtml += `Email: <a href="mailto:${email}">${email}</a><br>`;
            }
            if (office) {
                detailHtml += `Office: ${office}<br>`;
            }
            if (website) {
                detailHtml += `Website: <a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a>`;
            }
            detailHtml += `</p>`;
        }

        detailEl.innerHTML = detailHtml;

        grid.appendChild(card);
    });

    setupFacultyFilters();
    setupProfileModal();
}

function setupFacultyFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    const profileCards = document.querySelectorAll(".profile-card");
    if (!filterButtons.length || !profileCards.length) return;

    function setActiveFilter(btn) {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }

    function applyFilter(area) {
        profileCards.forEach(card => {
            const areas = (card.dataset.areas || "").split(" ");
            if (area === "all" || areas.includes(area)) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const area = btn.dataset.area;
            setActiveFilter(btn);
            applyFilter(area);
        });
    });

    applyFilter("all");
}

function setupProfileModal() {
    const modalBackdrop = document.getElementById("profile-modal-backdrop");
    const modalName = document.getElementById("profile-modal-name");
    const modalRole = document.getElementById("profile-modal-role");
    const modalTags = document.getElementById("profile-modal-tags");
    const modalBody = document.getElementById("profile-modal-body");
    const modalAvatarInitials = document.getElementById("profile-modal-avatar-initials");
    const modalContact = document.getElementById("profile-modal-contact");
    const closeBtn = document.querySelector(".profile-modal-close");

    if (!modalBackdrop || !modalName || !modalRole || !modalTags || !modalBody || !modalAvatarInitials) return;

    const cards = document.querySelectorAll(".profile-card");
    if (!cards.length) return;

    function openModal(card) {
        lastFocusedElement = document.activeElement;
        const nameEl = card.querySelector(".profile-name");
        const roleEl = card.querySelector(".profile-role");
        const tagsRow = card.querySelector(".pill-row");
        const initialsEl = card.querySelector(".profile-avatar span");
        const detailEl = card.querySelector(".profile-detail");
        const metaEl = card.querySelector(".profile-meta");

        modalName.textContent = nameEl ? nameEl.textContent : "";
        modalRole.textContent = roleEl ? roleEl.textContent : "";
        modalAvatarInitials.textContent = initialsEl ? initialsEl.textContent : "";

        modalTags.innerHTML = "";
        if (tagsRow) {
            const spans = tagsRow.querySelectorAll("span");
            spans.forEach(s => {
                const tag = document.createElement("span");
                tag.textContent = s.textContent;
                modalTags.appendChild(tag);
            });
        }

        if (metaEl) {
            modalContact.innerHTML = metaEl.innerHTML;
        } else {
            modalContact.innerHTML = "";
        }

        modalBody.innerHTML = detailEl ? detailEl.innerHTML : "";

        modalBackdrop.classList.add("open");
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        modalBackdrop.classList.remove("open");
        document.body.classList.remove("modal-open");
        if (lastFocusedElement) lastFocusedElement.focus();
    }

    cards.forEach(card => {
        card.addEventListener("click", () => openModal(card));
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }

    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    });
}

async function populateResearch() {
    const heroTitleEl = document.querySelector("#research-hero-title");
    const heroTextEl = document.querySelector("#research-hero-text");
    const areasTitleEl = document.querySelector("#research-areas-title");
    const areasGrid = document.querySelector("#research-areas-grid");
    const projectsTitleEl = document.querySelector("#research-projects-title");
    const projectsIntroEl = document.querySelector("#research-projects-intro");
    const projectsListEl = document.querySelector("#research-projects-list");

    // If these elements are not present, we are not on research.html
    if (!heroTitleEl || !heroTextEl || !areasGrid || !projectsListEl) {
        return;
    }

    // 1) Meta tab: hero + section titles + intro text
    const metaRows = await loadSheet("researchMeta");
    const metaById = {};
    metaRows.forEach(row => {
        if (row.id) {
            metaById[row.id.trim()] = row;
        }
    });

    if (metaById.hero) {
        heroTitleEl.textContent = metaById.hero.title || heroTitleEl.textContent;
        heroTextEl.textContent = metaById.hero.text || heroTextEl.textContent;
    }

    if (metaById.areas) {
        areasTitleEl.textContent = metaById.areas.title || areasTitleEl.textContent;
    }

    if (metaById.projects) {
        projectsTitleEl.textContent = metaById.projects.title || projectsTitleEl.textContent;
        projectsIntroEl.textContent = metaById.projects.text || projectsIntroEl.textContent;
    }

    // 2) Research areas: cards
    const areaRows = await loadSheet("researchAreas");
    areasGrid.innerHTML = "";
    areaRows.forEach(row => {
        if (!row.title && !row.text) return;
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${row.title || ""}</h3>
            <p>${row.text || ""}</p>
        `;
        areasGrid.appendChild(card);
    });

    // 3) Research projects: bullet list
    const projectRows = await loadSheet("researchProjects");
    projectsListEl.innerHTML = "";
    projectRows.forEach(row => {
        const text = (row.text || "").trim();
        if (!text) return;
        const li = document.createElement("li");
        li.textContent = text;
        projectsListEl.appendChild(li);
    });
}


function normalizeCategory(cat) {
    if (!cat) return "";
    return cat.trim().toLowerCase();
}

const NEWS_CATEGORY_LABELS = {
    research: "Research",
    students: "Students",
    events: "Events",
    announcement: "Announcements"
};

const NEWS_CATEGORY_ORDER = ["research", "students", "events", "announcement"];

async function populateNews() {
    const heroTitleEl = document.querySelector("#news-hero-title");
    const heroTextEl = document.querySelector("#news-hero-text");
    const categoryRow = document.querySelector("#news-filter-category-row");
    const yearRow = document.querySelector("#news-filter-year-row");
    const newsGrid = document.querySelector("#news-grid");

    // If not on news.html, bail
    if (!heroTitleEl || !heroTextEl || !categoryRow || !yearRow || !newsGrid) {
        return;
    }

    // 1) Meta (hero title + text)
    const metaRows = await loadSheet("newsMeta");
    const metaById = {};
    metaRows.forEach(row => {
        if (row.id) metaById[row.id.trim()] = row;
    });

    if (metaById.hero) {
        heroTitleEl.textContent = metaById.hero.title || heroTitleEl.textContent;
        heroTextEl.textContent = metaById.hero.text || heroTextEl.textContent;
    }

    // 2) News items
    const items = await loadSheet("newsItems");

    newsGrid.innerHTML = "";

    const yearsSet = new Set();
    const categoriesSet = new Set();

    items.forEach(row => {
        const year = (row.year || "").trim();
        const categoryRaw = row.category || "";
        const category = normalizeCategory(categoryRaw);

        if (year) yearsSet.add(year);
        if (category) categoriesSet.add(category);
    });

    // Build category filter buttons (All + present categories in preferred order)
    categoryRow.innerHTML = "";
    const categoryButtons = [];

    function createCategoryButton(catKey, label, isAll) {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline news-filter-btn";
        if (isAll) {
            btn.classList.add("active");
            btn.dataset.category = "all";
        } else {
            btn.dataset.category = catKey;
        }
        btn.textContent = label;
        categoryRow.appendChild(btn);
        categoryButtons.push(btn);
    }

    createCategoryButton("all", "All", true);

    NEWS_CATEGORY_ORDER.forEach(catKey => {
        if (categoriesSet.has(catKey)) {
            createCategoryButton(catKey, NEWS_CATEGORY_LABELS[catKey] || titleCase(catKey), false);
        }
    });

    categoriesSet.forEach(catKey => {
        if (!NEWS_CATEGORY_ORDER.includes(catKey)) {
            createCategoryButton(catKey, titleCase(catKey), false);
        }
    });

    // Build year filter buttons (All + sorted years)
    yearRow.innerHTML = "";
    const yearButtons = [];

    function createYearButton(yearVal, label, isAll) {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline news-year-btn";
        if (isAll) {
            btn.classList.add("active");
            btn.dataset.year = "all";
        } else {
            btn.dataset.year = yearVal;
        }
        btn.textContent = label;
        yearRow.appendChild(btn);
        yearButtons.push(btn);
    }

    createYearButton("all", "All", true);

    const yearsList = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    yearsList.forEach(y => {
        createYearButton(y, y, false);
    });

    // Build news cards
    newsGrid.innerHTML = "";
    items.forEach(row => {
        const year = (row.year || "").trim();
        const category = normalizeCategory(row.category || "");
        const badgeLabel = row.badge_label || "";
        const badgeType = normalizeCategory(row.badge_type || category);
        const dateDisplay = row.date_display || "";
        const title = row.title || "";
        const summary = row.summary || "";
        const tagsRaw = row.tags || "";
        const footerText = row.footer_text || "";
        const linkUrl = row.link_url || "";

        const article = document.createElement("article");
        article.className = "news-card";
        article.dataset.category = category || "";
        article.dataset.year = year || "";

        const tags = tagsRaw
            .split(";")
            .map(t => t.trim())
            .filter(Boolean);

        article.innerHTML = `
            <div class="news-meta-row">
                ${badgeLabel ? `<span class="news-badge ${badgeType}">${badgeLabel}</span>` : ""}
                ${dateDisplay ? `<span class="news-date">${dateDisplay}</span>` : ""}
            </div>
            <h3 class="news-title">${title}</h3>
            <p class="news-summary">
                ${summary}
            </p>
            <div class="news-tags">
                ${tags.map(t => `<span>${t}</span>`).join("")}
            </div>
            ${footerText ? `<p class="news-footer-text">${footerText}</p>` : ""}
            ${linkUrl ? `<p class="news-footer-link"><a href="${linkUrl}" target="_blank" rel="noopener noreferrer">Read more</a></p>` : ""}
        `;

        newsGrid.appendChild(article);
    });

    setupNewsFilters();
}

function setupNewsFilters() {
    const newsCards = document.querySelectorAll(".news-card");
    const newsFilterBtns = document.querySelectorAll(".news-filter-btn");
    const newsYearBtns = document.querySelectorAll(".news-year-btn");
    if (!newsCards.length || (!newsFilterBtns.length && !newsYearBtns.length)) return;

    let activeCategory = "all";
    let activeYear = "all";

    function setActive(btns, clicked) {
        btns.forEach(b => b.classList.remove("active"));
        clicked.classList.add("active");
    }

    function applyNewsFilters() {
        newsCards.forEach(card => {
            const cat = (card.dataset.category || "").toLowerCase();
            const year = (card.dataset.year || "").trim();

            const matchesCategory = (activeCategory === "all" || cat === activeCategory);
            const matchesYear = (activeYear === "all" || year === activeYear);

            card.style.display = (matchesCategory && matchesYear) ? "" : "none";
        });
    }

    newsFilterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            activeCategory = btn.dataset.category;
            setActive(newsFilterBtns, btn);
            applyNewsFilters();
        });
    });

    newsYearBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            activeYear = btn.dataset.year;
            setActive(newsYearBtns, btn);
            applyNewsFilters();
        });
    });

    applyNewsFilters();
}

async function populateGallery() {
    const heroTitleEl = document.querySelector("#gallery-hero-title");
    const heroTextEl = document.querySelector("#gallery-hero-text");
    const filterRow = document.querySelector("#gallery-filter-row");
    const galleryGrid = document.querySelector("#gallery-grid");

    if (!heroTitleEl || !heroTextEl || !filterRow || !galleryGrid) {
        return; // not on gallery page
    }

    // 1) Hero text from gallery_meta
    let metaRows = [];
    try {
        metaRows = await loadSheet("galleryMeta");
    } catch (e) {
        metaRows = [];
    }

    const metaById = {};
    metaRows.forEach(row => {
        if (row.id) metaById[row.id.trim()] = row;
    });

    if (metaById.hero) {
        heroTitleEl.textContent = metaById.hero.title || heroTitleEl.textContent;
        heroTextEl.textContent = metaById.hero.text || heroTextEl.textContent;
    }

    // 2) Gallery items
    const rows = await loadSheet("galleryItems");
    galleryGrid.innerHTML = "";

    const themesSet = new Set();

    rows.forEach(row => {
        const theme = (row.theme || "").trim().toLowerCase();
        if (theme) themesSet.add(theme);
    });

    // Build filter buttons: All + one per theme
    filterRow.innerHTML = "";
    const filterButtons = [];

    function createFilterButton(themeKey, label, isAll) {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline gallery-filter-btn";
        if (isAll) {
            btn.classList.add("active");
            btn.dataset.theme = "all";
        } else {
            btn.dataset.theme = themeKey;
        }
        btn.textContent = label;
        filterRow.appendChild(btn);
        filterButtons.push(btn);
    }

    createFilterButton("all", "All", true);

    Array.from(themesSet).sort().forEach(themeKey => {
        createFilterButton(themeKey, titleCase(themeKey), false);
    });

    // Create gallery items
    rows.forEach(row => {
        const src = (row.image_src || "").trim();
        if (!src) return; // skip empty
        const alt = row.alt || "";
        const caption = row.caption || "";
        const theme = (row.theme || "").trim().toLowerCase();
        const overlayLabel = row.overlay_label || "";

        const figure = document.createElement("figure");
        figure.className = "gallery-item";
        figure.dataset.theme = theme;

        figure.innerHTML = `
            <div class="gallery-thumb-wrapper">
                <img src="${src}" alt="${alt}" class="gallery-thumb">
                <div class="gallery-thumb-overlay">
                    <span>${overlayLabel || titleCase(theme || "Image")}</span>
                </div>
            </div>
            <figcaption class="gallery-caption">
                ${caption}
            </figcaption>
        `;

        galleryGrid.appendChild(figure);
    });

    setupGalleryFilters();
    setupGalleryLightbox();
}

function setupGalleryFilters() {
    const filterBtns = document.querySelectorAll(".gallery-filter-btn");
    const items = document.querySelectorAll(".gallery-item");
    if (!filterBtns.length || !items.length) return;

    let activeTheme = "all";

    function setActiveGalleryFilter(btn) {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }

    function applyGalleryFilter() {
        items.forEach(item => {
            const theme = (item.dataset.theme || "").toLowerCase();
            if (activeTheme === "all" || theme === activeTheme) {
                item.style.display = "";
            } else {
                item.style.display = "none";
            }
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            activeTheme = btn.dataset.theme;
            setActiveGalleryFilter(btn);
            applyGalleryFilter();
        });
    });

    applyGalleryFilter();
}

function setupGalleryLightbox() {
    const lightbox = document.getElementById("gallery-lightbox");
    if (!lightbox) return;

    const imgEl = lightbox.querySelector(".gallery-lightbox-image");
    const captionEl = lightbox.querySelector(".gallery-lightbox-caption");
    const closeBtn = lightbox.querySelector(".gallery-lightbox-close");
    const items = document.querySelectorAll(".gallery-item");

    if (!imgEl || !captionEl || !closeBtn || !items.length) return;

    function openLightbox(src, alt, caption) {
        imgEl.src = src;
        imgEl.alt = alt || "";
        captionEl.textContent = caption || "";
        lightbox.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
        lightbox.classList.add("hidden");
        imgEl.src = "";
        captionEl.textContent = "";
        document.body.style.overflow = "";
    }

    items.forEach(item => {
        const wrapper = item.querySelector(".gallery-thumb-wrapper");
        const img = item.querySelector(".gallery-thumb");
        const caption = item.querySelector(".gallery-caption");

        if (!wrapper || !img) return;

        const src = img.getAttribute("src");
        const alt = img.getAttribute("alt") || "";
        const captionText = caption ? caption.textContent.trim() : "";

        wrapper.addEventListener("click", () => {
            openLightbox(src, alt, captionText);
        });
    });

    closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lightbox.classList.contains("hidden")) {
            closeLightbox();
        }
    });
}


function cleanKey(value) {
    return (value || "").trim().toLowerCase();
}


function cleanKey(value) {
    return (value || "").trim().toLowerCase();
}

async function populateProjects() {
    const grid = document.querySelector("#projects-grid");
    const levelRow = document.querySelector("#projects-filter-level-row");
    const themeRow = document.querySelector("#projects-filter-theme-row");
    const typeRow = document.querySelector("#projects-filter-type-row");

    if (!grid || !levelRow || !themeRow || !typeRow) {
        return; // not on projects.html
    }

    // --- META + BULLETS FROM projects_meta ---
    let metaRows = [];
    try {
        metaRows = await loadSheet("projectsMeta");
    } catch (e) {
        metaRows = [];
    }

    const metaById = {};
    metaRows.forEach(row => {
        if (row.id) {
            const key = row.id.trim();
            if (!metaById[key]) {
                metaById[key] = [];
            }
            metaById[key].push(row);
        }
    });

    const heroTitleEl = document.querySelector("#projects-hero-title");
    const heroTextEl = document.querySelector("#projects-hero-text");
    const browseTitleEl = document.querySelector("#projects-browse-title");
    const browseTextEl = document.querySelector("#projects-browse-text");
    const getInvTitleEl = document.querySelector("#projects-get-involved-title");
    const getInvTextEl = document.querySelector("#projects-get-involved-text");
    const getInvExtraEl = document.querySelector("#projects-get-involved-extra");
    const getInvListEl = document.querySelector("#projects-get-involved-list");
    const fundingTitleEl = document.querySelector("#projects-funding-title");
    const fundingTextEl = document.querySelector("#projects-funding-text");

    // hero
    if (metaById.hero && metaById.hero[0]) {
        const row = metaById.hero[0];
        if (heroTitleEl && row.title) heroTitleEl.textContent = row.title;
        if (heroTextEl && row.text) heroTextEl.textContent = row.text;
    }

    // browse
    if (metaById.browse && metaById.browse[0]) {
        const row = metaById.browse[0];
        if (browseTitleEl && row.title) browseTitleEl.textContent = row.title;
        if (browseTextEl && row.text) browseTextEl.textContent = row.text;
    }

    // get involved intro
    if (metaById.get_involved_intro && metaById.get_involved_intro[0]) {
        const row = metaById.get_involved_intro[0];
        if (getInvTitleEl && row.title) getInvTitleEl.textContent = row.title;
        if (getInvTextEl && row.text) getInvTextEl.textContent = row.text;
    }

    // get involved extra paragraph
    if (metaById.get_involved_extra && metaById.get_involved_extra[0] && getInvExtraEl) {
        const row = metaById.get_involved_extra[0];
        if (row.text) getInvExtraEl.textContent = row.text;
    }

    // get involved bullet list (all rows with id = get_involved_list and an order)
    if (getInvListEl && metaById.get_involved_list) {
        const bulletRows = metaById.get_involved_list
            .filter(r => (r.order || "").trim() && (r.text || "").trim())
            .sort((a, b) => {
                const ao = parseInt(a.order || "0", 10);
                const bo = parseInt(b.order || "0", 10);
                return ao - bo;
            });

        if (bulletRows.length) {
            getInvListEl.innerHTML = "";
            bulletRows.forEach(row => {
                const li = document.createElement("li");
                li.textContent = row.text.trim();
                getInvListEl.appendChild(li);
            });
        }
    }

    // funding
    if (metaById.funding_intro && metaById.funding_intro[0]) {
        const row = metaById.funding_intro[0];
        if (fundingTitleEl && row.title) fundingTitleEl.textContent = row.title;
        if (fundingTextEl && row.text) fundingTextEl.textContent = row.text;
    }

    // --- PROJECT CARDS FROM projects_items ---
    const rows = await loadSheet("projectsItems");

    grid.innerHTML = "";

    const levels = new Map();
    const themes = new Map();
    const types = new Map();

    rows.forEach(row => {
        const levelKey = cleanKey(row.level_key);
        const themeKey = cleanKey(row.theme_key);
        const typeKey = cleanKey(row.type_key);

        if (levelKey) {
            levels.set(levelKey, row.level_label || titleCase(levelKey));
        }
        if (themeKey) {
            themes.set(themeKey, row.theme_label || titleCase(themeKey));
        }
        if (typeKey) {
            types.set(typeKey, row.type_label || titleCase(typeKey));
        }
    });

    function buildFilterButtons(container, itemsMap, filterType) {
        container.innerHTML = "";
        const buttons = [];

        const allBtn = document.createElement("button");
        allBtn.className = "btn btn-outline proj-filter-btn active";
        allBtn.dataset.filterType = filterType;
        allBtn.dataset.filterValue = "all";
        allBtn.textContent = "All";
        container.appendChild(allBtn);
        buttons.push(allBtn);

        Array.from(itemsMap.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .forEach(([key, label]) => {
                const btn = document.createElement("button");
                btn.className = "btn btn-outline proj-filter-btn";
                btn.dataset.filterType = filterType;
                btn.dataset.filterValue = key;
                btn.textContent = label;
                container.appendChild(btn);
                buttons.push(btn);
            });

        return buttons;
    }

    buildFilterButtons(levelRow, levels, "level");
    buildFilterButtons(themeRow, themes, "theme");
    buildFilterButtons(typeRow, types, "type");

    rows.forEach(row => {
        const title = row.title || "";
        const summary = row.summary || "";
        const levelKey = cleanKey(row.level_key);
        const levelLabel = row.level_label || titleCase(levelKey || "Project");
        const themeKey = cleanKey(row.theme_key);
        const typeKey = cleanKey(row.type_key);
        const typeLabel = row.type_label || titleCase(typeKey || "");
        const year = (row.year || "").trim();
        const student = row.student || "";
        const programme = row.programme || "";
        const supervisors = row.supervisors || "";
        const tagsRaw = row.tags || "";
        const linkUrl = (row.link_url || "").trim();
        const linkLabel = (row.link_label || "").trim() || "View project";

        const tags = tagsRaw
            .split(";")
            .map(t => t.trim())
            .filter(Boolean);

        const article = document.createElement("article");
        article.className = "project-card";
        article.dataset.level = levelKey || "";
        article.dataset.theme = themeKey || "";
        article.dataset.type = typeKey || "";
        article.dataset.year = year || "";

        article.innerHTML = `
            <div class="project-label-row">
                <span class="project-badge level">${levelLabel}${typeLabel ? ` · ${typeLabel}` : ""}</span>
                ${year ? `<span class="project-year">${year}</span>` : ""}
            </div>
            <h3 class="project-title">
                ${title}
            </h3>
            <p class="project-summary">
                ${summary}
            </p>
            <div class="project-meta">
                ${student ? `<span>Student: ${student}${programme ? ` (${programme})` : ""}</span><br>` : ""}
                ${supervisors ? `<span>Supervisor(s): ${supervisors}</span>` : ""}
            </div>
            <div class="project-tags">
                ${tags.map(t => `<span>${t}</span>`).join("")}
            </div>
            ${linkUrl ? `
                <p class="project-link">
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>
                </p>
            ` : ""}
        `;

        grid.appendChild(article);
    });

    setupProjectFilters();
}



function setupProjectFilters() {
    const buttons = document.querySelectorAll(".proj-filter-btn");
    const cards = document.querySelectorAll(".project-card");
    if (!buttons.length || !cards.length) return;

    const activeFilters = {
        level: "all",
        theme: "all",
        type: "all"
    };

    function setActiveProjectFilter(btn) {
        const group = btn.dataset.filterType;
        buttons.forEach(b => {
            if (b.dataset.filterType === group) {
                b.classList.remove("active");
            }
        });
        btn.classList.add("active");
    }

    function applyProjectFilters() {
        cards.forEach(card => {
            const cardLevel = card.dataset.level || "";
            const cardTheme = card.dataset.theme || "";
            const cardType = card.dataset.type || "";

            const levelMatch = (activeFilters.level === "all" || cardLevel === activeFilters.level);
            const themeMatch = (activeFilters.theme === "all" || cardTheme === activeFilters.theme);
            const typeMatch = (activeFilters.type === "all" || cardType === activeFilters.type);

            card.style.display = (levelMatch && themeMatch && typeMatch) ? "" : "none";
        });
    }

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const filterType = btn.dataset.filterType;
            const value = btn.dataset.filterValue;
            activeFilters[filterType] = value;
            setActiveProjectFilter(btn);
            applyProjectFilters();
        });
    });

    applyProjectFilters();
}


function cleanKey(value) {
    return (value || "").trim().toLowerCase();
}

async function populateCareerPathways() {
    const heroTitleEl = document.querySelector("#career-hero-title");
    const heroTextEl = document.querySelector("#career-hero-text");
    const mapTitleEl = document.querySelector("#career-map-title");
    const mapIntroEl = document.querySelector("#career-map-intro");
    const detailsTitleEl = document.querySelector("#career-details-title");
    const detailsIntroEl = document.querySelector("#career-details-intro");

    const mapCanvas = document.querySelector("#pathway-map-canvas");
    const nodeLayer = document.querySelector("#career-node-layer");
    const detailsGrid = document.querySelector("#career-details-grid");
    const mapPanel = document.querySelector("#career-map-panel");
    const listPanel = document.querySelector("#career-list-panel");
    const tabButtons = document.querySelectorAll(".pathway-tab-button");
    const connectorSvg = document.querySelector("#pathway-connector-svg");
    const mapCore = document.querySelector("#pathway-map-core");

    if (!heroTitleEl || !detailsGrid || !mapCanvas || !nodeLayer) {
        return;
    }

    const svgNS = "http://www.w3.org/2000/svg";

    const setActiveTab = (tab) => {
        if (!mapPanel || !listPanel) return;
        if (tab === "map") {
            mapPanel.classList.remove("hidden");
            listPanel.classList.add("hidden");
            requestAnimationFrame(renderConnectorLines);
        } else {
            listPanel.classList.remove("hidden");
            mapPanel.classList.add("hidden");
        }
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    };

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            setActiveTab(tab === "list" ? "list" : "map");
        });
    });

    setActiveTab("map");

    // --- META ---
    let metaRows = [];
    try {
        metaRows = await loadSheet("careerMeta");
    } catch (e) {
        metaRows = [];
    }

    const metaById = {};
    metaRows.forEach(row => {
        if (!row.id) return;
        metaById[row.id.trim()] = row;
    });

    if (metaById.hero) {
        if (metaById.hero.title && heroTitleEl) heroTitleEl.textContent = metaById.hero.title;
        if (metaById.hero.text && heroTextEl) heroTextEl.textContent = metaById.hero.text;
    }
    if (metaById.map_intro) {
        if (metaById.map_intro.title && mapTitleEl) mapTitleEl.textContent = metaById.map_intro.title;
        if (metaById.map_intro.text && mapIntroEl) mapIntroEl.textContent = metaById.map_intro.text;
    }
    if (metaById.details_intro) {
        if (metaById.details_intro.title && detailsTitleEl) {
            detailsTitleEl.textContent = metaById.details_intro.title;
        }
        if (metaById.details_intro.text && detailsIntroEl) {
            detailsIntroEl.textContent = metaById.details_intro.text;
        }
    }

    function renderConnectorLines() {
        if (!connectorSvg || !mapCanvas) return;
        const canvasRect = mapCanvas.getBoundingClientRect();
        connectorSvg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
        connectorSvg.setAttribute("width", String(canvasRect.width));
        connectorSvg.setAttribute("height", String(canvasRect.height));
        connectorSvg.innerHTML = "";

        const createEl = (tag) => document.createElementNS(svgNS, tag);
        let hubX = canvasRect.width / 2;
        let hubY = canvasRect.height / 2;
        if (mapCore) {
            const hubRect = mapCore.getBoundingClientRect();
            hubX = hubRect.left + hubRect.width / 2 - canvasRect.left;
            hubY = hubRect.top + hubRect.height / 2 - canvasRect.top;
        }

        const nodeCards = nodeLayer ? Array.from(nodeLayer.querySelectorAll(".pathway-map-card")) : [];
        nodeCards.forEach(card => {
            const x = parseFloat(card.dataset.x || "0");
            const y = parseFloat(card.dataset.y || "0");
            const path = createEl("path");
            const midY = (hubY + y) / 2;
            path.setAttribute("d", `M ${hubX} ${hubY} Q ${hubX} ${midY} ${x} ${y}`);
            path.setAttribute("stroke", "#C98A37");
            path.setAttribute("stroke-width", "3");
            path.setAttribute("fill", "none");
            path.setAttribute("stroke-linecap", "round");
            connectorSvg.appendChild(path);
        });
    }

    const layoutMapNodes = () => {
        if (!mapCanvas || !nodeLayer) return;
        const nodes = Array.from(nodeLayer.querySelectorAll(".pathway-map-card"));
        const total = nodes.length || 1;
        const baseHeight = Math.max(700, total * 130);
        mapCanvas.style.height = `${baseHeight}px`;
        const canvasWidth = mapCanvas.clientWidth || mapCanvas.getBoundingClientRect().width;

        const centerX = canvasWidth / 2;
        const centerY = baseHeight * 0.35;
        const radius = Math.min(canvasWidth, baseHeight) * 0.33;

        nodes.forEach((card, idx) => {
            const angle = (idx / total) * Math.PI * 1.3 + Math.PI * 0.2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            card.style.left = `${x}px`;
            card.style.top = `${y}px`;
            card.dataset.x = x;
            card.dataset.y = y;
        });
    };

    // --- NODES (LEFT + RIGHT) ---
    let nodeRows = [];
    try {
        nodeRows = await loadSheet("careerNodes");
    } catch (e) {
        nodeRows = [];
    }

    if (nodeLayer) nodeLayer.innerHTML = "";

    nodeRows
        .filter(r => (r.column || "").trim())
        .sort((a, b) => {
            const ao = parseInt(a.order || "0", 10);
            const bo = parseInt(b.order || "0", 10);
            return ao - bo;
        })
        .forEach(row => {
            const branch = cleanKey(row.column);
            const type = cleanKey(row.type);
            const targetId = (row.target_id || "").trim();
            const title = row.title || "";
            const text = row.text || "";

            const node = document.createElement("div");
            node.className = `pathway-node pathway-map-card pathway-node-${type || "field"}`;
            node.dataset.target = targetId;
            node.dataset.branch = branch;

            node.innerHTML = `
                <h4>${title}</h4>
                <p>${text}</p>
            `;

            if (nodeLayer) nodeLayer.appendChild(node);
        });

    const handleLayout = () => {
        layoutMapNodes();
        renderConnectorLines();
    };

    requestAnimationFrame(handleLayout);
    window.addEventListener("resize", () => {
        requestAnimationFrame(handleLayout);
    });

    // --- DETAILS ---
    let detailRows = [];
    try {
        detailRows = await loadSheet("careerDetails");
    } catch (e) {
        detailRows = [];
    }

    detailsGrid.innerHTML = "";

    detailRows.forEach(row => {
        const detailId = (row.detail_id || "").trim();
        if (!detailId) return;
        const title = row.title || "";
        const intro = row.intro || "";
        const listItemsRaw = row.list_items || "";

        const article = document.createElement("article");
        article.className = "pathway-detail";
        article.id = detailId;

        const items = listItemsRaw
            .split(";")
            .map(t => t.trim())
            .filter(Boolean);

        const ulInner = items.map(t => `<li>${t}</li>`).join("");

        article.innerHTML = `
            <div class="pathway-detail-header">
                <h3>${title}</h3>
            </div>
            <p>
                ${intro}
            </p>
            <ul class="pathway-detail-list">
                ${ulInner}
            </ul>
        `;

        detailsGrid.appendChild(article);
    });

    let detailArticles = Array.from(detailsGrid.querySelectorAll(".pathway-detail"));
    if (detailArticles.length) {
        detailArticles[0].classList.add("active");
    }

    const focusDetail = (detailId) => {
        if (!detailId) return;
        if (detailArticles.length === 0) return;
        detailArticles.forEach(article => article.classList.remove("active"));
        const targetArticle = document.getElementById(detailId);
        if (targetArticle) {
            targetArticle.classList.add("active");
            setActiveTab("list");
            targetArticle.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    const attachNodeHandlers = () => {
        const nodes = document.querySelectorAll(".pathway-node");
        nodes.forEach(node => {
            node.addEventListener("click", () => {
                const targetId = node.dataset.target;
                focusDetail(targetId);
            });
        });
    };

    attachNodeHandlers();
}

async function setupCareersGame() {
    const startBtn = document.getElementById("start-btn");
    if (!startBtn) return; // not on game page

    const restartBtn = document.getElementById("restart-btn");
    const missionBox = document.getElementById("mission-box");
    const missionProgress = document.getElementById("mission-progress");
    const missionTitle = document.getElementById("mission-title");
    const missionScene = document.getElementById("mission-scene");
    const choiceList = document.getElementById("choice-list");
    const resultsBox = document.getElementById("results-box");
    const resultIntro = document.getElementById("result-intro");
    const topCareersBox = document.getElementById("top-careers");
    const storySummaryBox = document.getElementById("story-summary");
    const resultsStats = document.getElementById("results-stats");
    const topFieldsChart = document.getElementById("top-fields-chart");
    const scenarioSelect = document.getElementById("scenario-select");

    // ---- Load careers ----
    let careersRows = [];
    try {
        careersRows = await loadSheet("gameCareers");
    } catch (e) {
        careersRows = [];
    }
    const careers = {};
    careersRows.forEach(row => {
        if (!row.id) return;
        const id = row.id.trim();
        careers[id] = {
            name: (row.name || "").trim() || id,
            desc: (row.desc || "").trim(),
            tags: (row.tags || "")
                .split(";")
                .map(t => t.trim())
                .filter(Boolean)
        };
    });

    // ---- Load missions ----
    let missionRows = [];
    try {
        missionRows = await loadSheet("gameMissions");
    } catch (e) {
        missionRows = [];
    }

    // ---- Load options ----
    let optionRows = [];
    try {
        optionRows = await loadSheet("gameOptions");
    } catch (e) {
        optionRows = [];
    }

    const optionsByMission = {};
    optionRows.forEach(row => {
        const mId = (row.mission_id || "").trim();
        if (!mId) return;
        if (!optionsByMission[mId]) optionsByMission[mId] = [];
        optionsByMission[mId].push({
            id: (row.option_id || "").trim(),
            order: parseInt(row.option_order || "0", 10) || 0,
            label: (row.label || "").trim(),
            desc: (row.desc || "").trim(),
            scores: parseScoreString(row.scores || "")
        });
    });

    // ---- Group missions into scenarios ----
    const scenariosMap = {};

    missionRows.forEach(row => {
        const scenarioId = (row.scenario_id || "default").trim() || "default";
        const scenarioTitle = (row.scenario_title || "Main story").trim();
        const scenarioOrder = parseInt(row.scenario_order || "0", 10) || 0;

        if (!scenariosMap[scenarioId]) {
            scenariosMap[scenarioId] = {
                id: scenarioId,
                title: scenarioTitle,
                order: scenarioOrder,
                missions: []
            };
        }

        const missionId = (row.mission_id || "").trim();
        if (!missionId) return;

        const missionOrder = parseInt(row.mission_order || "0", 10) || 0;
        const missionTitle = (row.title || "").trim();
        const missionScene = (row.scene || "").trim();
        const missionOptions = (optionsByMission[missionId] || [])
            .slice()
            .sort((a, b) => a.order - b.order);

        if (!missionOptions.length) return;

        scenariosMap[scenarioId].missions.push({
            id: missionId,
            order: missionOrder,
            title: missionTitle,
            scene: missionScene,
            options: missionOptions
        });
    });

    // Turn into ordered array
    const scenarios = Object.values(scenariosMap)
        .filter(sc => sc.missions.length > 0)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

    if (!scenarios.length) {
        console.warn("No scenarios/missions available for game.");
        return;
    }

    // Sort missions inside each scenario
    scenarios.forEach(sc => {
        sc.missions.sort((a, b) => a.order - b.order);
    });

    // ---- Populate scenario select ----
    let currentScenario = scenarios[0];

    if (scenarioSelect) {
        scenarioSelect.innerHTML = "";
        scenarios.forEach(sc => {
            const opt = document.createElement("option");
            opt.value = sc.id;
            opt.textContent = sc.title || sc.id;
            scenarioSelect.appendChild(opt);
        });
        scenarioSelect.value = currentScenario.id;

        scenarioSelect.addEventListener("change", () => {
            const chosenId = scenarioSelect.value;
            const found = scenarios.find(sc => sc.id === chosenId);
            currentScenario = found || scenarios[0];
            resetGame(); // reset state when scenario changes
        });
    }

    // ---- Game state ----
    let currentMissionIndex = -1;
    let careerScores = {};
    let chosenOptions = [];

    function initScores() {
        careerScores = {};
        Object.keys(careers).forEach(k => {
            careerScores[k] = 0;
        });
    }

    function resetGame() {
        currentMissionIndex = -1;
        chosenOptions = [];
        initScores();
        if (missionBox) missionBox.classList.add("hidden");
        if (resultsBox) resultsBox.classList.add("hidden");
        if (missionTitle) missionTitle.textContent = "";
        if (missionScene) missionScene.textContent = "";
        if (missionProgress) missionProgress.textContent = "";
        if (choiceList) choiceList.innerHTML = "";
        if (topCareersBox) topCareersBox.innerHTML = "";
        if (storySummaryBox) storySummaryBox.innerHTML = "";
        if (resultIntro) resultIntro.textContent = "";
    }

    function renderMission() {
        const missions = currentScenario.missions;
        if (!missions.length) return;
        if (currentMissionIndex < 0 || currentMissionIndex >= missions.length) return;

        const mission = missions[currentMissionIndex];

        missionBox.classList.remove("hidden");
        resultsBox.classList.add("hidden");

        missionProgress.textContent = "Mission " + (currentMissionIndex + 1) + " of " + missions.length;
        missionTitle.textContent = mission.title;
        missionScene.textContent = mission.scene || "";

        choiceList.innerHTML = "";
        mission.options.forEach(option => {
            const btn = document.createElement("button");
            btn.className = "choice-btn";
            btn.dataset.missionId = mission.id;
            btn.dataset.optionId = option.id;

            const labelSpan = document.createElement("span");
            labelSpan.className = "choice-label";
            labelSpan.textContent = option.label;

            const descSpan = document.createElement("span");
            descSpan.className = "choice-desc";
            descSpan.textContent = option.desc;

            btn.appendChild(labelSpan);
            btn.appendChild(descSpan);

            btn.addEventListener("click", () => handleChoice(mission, option));

            choiceList.appendChild(btn);
        });
    }

    function handleChoice(mission, option) {
        chosenOptions.push({
            missionId: mission.id,
            missionTitle: mission.title,
            label: option.label,
            desc: option.desc,
            scores: option.scores
        });

        Object.keys(option.scores || {}).forEach(cKey => {
            if (careerScores[cKey] == null) careerScores[cKey] = 0;
            careerScores[cKey] += option.scores[cKey];
        });

        currentMissionIndex += 1;
        if (currentMissionIndex >= currentScenario.missions.length) {
            showResults();
        } else {
            renderMission();
        }
    }

    function renderCareerCard(cKey, score, rankIndex) {
        const career = careers[cKey];
        if (!career) return;

        const container = document.createElement("div");
        container.className = "game-result";
        container.style.marginTop = "0.6rem";

        const rankSpan = document.createElement("span");
        rankSpan.className = "rank-badge " + (rankIndex === 0 ? "rank-1" : rankIndex === 1 ? "rank-2" : "rank-3");
        rankSpan.textContent =
            rankIndex === 0 ? "Top match" :
            rankIndex === 1 ? "Also a strong fit" :
            "Worth exploring";

        const title = document.createElement("h4");
        title.style.margin = "0.35rem 0 0.15rem 0";
        title.textContent = career.name;

        const desc = document.createElement("p");
        desc.style.fontSize = "0.9rem";
        desc.style.margin = "0.1rem 0 0 0";
        desc.textContent = career.desc;

        const pillRow = document.createElement("div");
        pillRow.className = "pill-row";

        const scoreSpan = document.createElement("span");
        scoreSpan.textContent = "Story score: " + score;
        pillRow.appendChild(scoreSpan);

        if (career.tags && career.tags.length) {
            career.tags.forEach(tag => {
                const span = document.createElement("span");
                span.textContent = tag;
                pillRow.appendChild(span);
            });
        }

        container.appendChild(rankSpan);
        container.appendChild(title);
        container.appendChild(desc);
        container.appendChild(pillRow);

        topCareersBox.appendChild(container);
    }

    function renderTopFieldsChart(entries) {
        if (!topFieldsChart || !resultsStats) return;

        if (!entries || !entries.length) {
            topFieldsChart.innerHTML = "";
            resultsStats.classList.add("hidden");
            return;
        }

        resultsStats.classList.remove("hidden");
        topFieldsChart.innerHTML = "";

        const maxScore = Math.max(...entries.map(([, score]) => score));

        entries.forEach(([cKey, score], idx) => {
            const wrapper = document.createElement("div");
            wrapper.className = "bar-row";

            const label = document.createElement("div");
            label.className = "bar-label";
            label.textContent = (idx + 1) + ". " + ((careers[cKey] && careers[cKey].name) || cKey);

            const track = document.createElement("div");
            track.className = "bar-track";

            const fill = document.createElement("div");
            fill.className = "bar-fill";
            let percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
            if (percent > 0 && percent < 8) percent = 8; // keep visible
            fill.style.width = percent + "%";
            fill.setAttribute("aria-label", "Score " + score);
            track.appendChild(fill);

            const meta = document.createElement("div");
            meta.className = "bar-meta";
            const tags = (careers[cKey] && careers[cKey].tags) ? careers[cKey].tags.slice(0, 2).join(" • ") : "Story alignment score";
            meta.innerHTML = "<span>" + tags + "</span><span>Score " + score + "</span>";

            wrapper.appendChild(label);
            wrapper.appendChild(track);
            wrapper.appendChild(meta);

            topFieldsChart.appendChild(wrapper);
        });
    }

    function showResults() {
        missionBox.classList.add("hidden");
        resultsBox.classList.remove("hidden");

        const sortedCareers = Object.entries(careerScores)
            .filter(([, score]) => score > 0)
            .sort((a, b) => b[1] - a[1]);

        topCareersBox.innerHTML = "";

        if (!sortedCareers.length) {
            resultIntro.textContent =
                "Your choices didn't match any specific pattern strongly, which probably means you are open to many different roles. Here are a few starting points you could still explore:";
            Object.keys(careers).slice(0, 3).forEach((cKey, idx) => {
                renderCareerCard(cKey, 0, idx);
            });
            renderTopFieldsChart([]);
        } else {
            const topScore = sortedCareers[0][1];
            const topGroup = sortedCareers.filter(([, score]) => score === topScore);
            const nextTwo = sortedCareers.slice(topGroup.length, topGroup.length + 2);
            const finalList = topGroup.concat(nextTwo);

            resultIntro.textContent =
                "Based on how you moved through the missions, these roles align most with the strengths and preferences you kept choosing.";

            finalList.forEach(([cKey, score], idx) => {
                renderCareerCard(cKey, score, idx);
            });

            renderTopFieldsChart(sortedCareers.slice(0, 3));
        }

        storySummaryBox.innerHTML = "";
        chosenOptions.forEach((step, idx) => {
            const div = document.createElement("div");
            div.className = "summary-step";
            div.innerHTML =
                "<strong>Mission " + (idx + 1) + " – " + step.missionTitle + "</strong>" +
                "<span>You chose: <em>" + step.label + "</em></span>";
            storySummaryBox.appendChild(div);
        });
    }

    // ---- Wire buttons ----
    initScores();

    startBtn.addEventListener("click", () => {
        resetGame();
        currentMissionIndex = 0;
        renderMission();
    });

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            resetGame();
        });
    }
}



document.addEventListener("DOMContentLoaded", async () => {
    await ensurePageCopyLoaded();
    applyPageCopy("home", "hero", {
        title: document.querySelector("#home-hero-title"),
        text: document.querySelector("#home-hero-text")
    });
    applyPageCopy("faculty", "hero", {
        title: document.querySelector("#faculty-hero-title"),
        text: document.querySelector("#faculty-hero-text")
    });
    applyPageCopy("introduction", "structures", {
        title: document.querySelector("#intro-structures-title")
    });
    applyPageCopy("game", "hero", {
        title: document.querySelector("#game-hero-title"),
        text: document.querySelector("#game-hero-text")
    });
    applyPageCopy("game", "intro", {
        title: document.querySelector("#game-intro-title"),
        text: document.querySelector("#game-intro-text")
    });

    applySavedSidebarState();
    setupSidebarToggle();

    populateHomeGlance();
    populateHomeExplore();
    populateHomeTestimonials();
    setupTestimonialFilters();

    populateIntroduction();
    populateProgrammes();
    populateFaculty();
    populateResearch(); 
    populateNews();
    populateGallery();
    populateProjects();
    populateCareerPathways();
    setupCareersGame();

});
