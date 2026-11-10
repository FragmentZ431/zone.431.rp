
/* =========================================================
   ZONE-431 — ANNUAIRE DU PERSONNEL
   Fichier : personnel.js

   Chargement public :
   - Membres autorisés uniquement
   - Profils explicitement publiés uniquement
   - Aucune donnée privée (email, Discord, Roblox)
   ========================================================= */


/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const PERSONNEL_RPC = "get_public_personnel_directory";

let supabaseClient = null;
let personnelData = [];
let filteredPersonnel = [];
let selectedPersonnel = null;


/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    personnelCount: document.getElementById("personnelCount"),
    departmentCount: document.getElementById("departmentCount"),
    lastUpdate: document.getElementById("lastUpdate"),

    search: document.getElementById("personnelSearch"),
    department: document.getElementById("departmentFilter"),
    sort: document.getElementById("sortFilter"),

    resultsCount: document.getElementById("resultsCount"),
    resetFilters: document.getElementById("resetFilters"),

    grid: document.getElementById("personnelGrid"),
    empty: document.getElementById("directoryEmpty"),
    error: document.getElementById("directoryError"),
    retry: document.getElementById("retryPersonnel"),

    modal: document.getElementById("personnelModal"),
    closeModal: document.getElementById("closePersonnelModal"),

    profileInitials: document.getElementById("profileInitials"),
    profileName: document.getElementById("profileName"),
    profileId: document.getElementById("profileId"),
    profileDepartment: document.getElementById("profileDepartment"),
    profileGrade: document.getElementById("profileGrade"),
    profileFunction: document.getElementById("profileFunction"),
    profileDate: document.getElementById("profileDate")
};


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", initializePersonnelPage);

async function initializePersonnelPage() {
    registerEvents();

    try {
        await initializeSupabase();
        await loadPersonnel();
    } catch (error) {
        console.error("[ZONE-431] Erreur d'initialisation :", error);
        showDirectoryError();
    }
}


/* =========================================================
   INITIALISATION SUPABASE
========================================================= */

async function initializeSupabase() {
    if (window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        return;
    }

    await loadSupabaseLibrary();

    if (!window.supabase?.createClient) {
        throw new Error("La bibliothèque Supabase n'a pas pu être chargée.");
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}


function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
            'script[data-supabase-library="true"]'
        );

        if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", reject, { once: true });

            if (window.supabase?.createClient) {
                resolve();
            }

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

        script.dataset.supabaseLibrary = "true";
        script.async = true;

        script.onload = resolve;

        script.onerror = () => {
            reject(new Error("Impossible de charger Supabase."));
        };

        document.head.appendChild(script);
    });
}


/* =========================================================
   EVENEMENTS
========================================================= */

function registerEvents() {
    elements.search?.addEventListener("input", applyFilters);

    elements.department?.addEventListener("change", applyFilters);

    elements.sort?.addEventListener("change", applyFilters);

    elements.resetFilters?.addEventListener("click", resetFilters);

    elements.retry?.addEventListener("click", loadPersonnel);

    elements.closeModal?.addEventListener("click", closeProfile);

    elements.modal?.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
            closeProfile();
        }
    });

    elements.modal?.addEventListener("cancel", () => {
        selectedPersonnel = null;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.modal?.open) {
            closeProfile();
        }
    });
}


/* =========================================================
   CHARGEMENT DES DONNEES
========================================================= */

async function loadPersonnel() {
    if (!supabaseClient) {
        showDirectoryError();
        return;
    }

    setLoadingState();

    try {
        /*
         * Cette RPC doit être créée dans Supabase.
         *
         * Elle doit retourner exclusivement :
         * - Les profils autorisés
         * - Les profils publiés
         * - Les champs publics nécessaires
         *
         * Elle ne doit jamais retourner email,
         * discord_username ou roblox_username.
         */

        const { data, error } = await supabaseClient.rpc(
            PERSONNEL_RPC
        );

        if (error) {
            throw error;
        }

        if (!Array.isArray(data)) {
            throw new Error("Format de réponse Supabase invalide.");
        }

        personnelData = data
            .map(normalizePersonnel)
            .filter(isValidPersonnel);

        updateStatistics();
        applyFilters();
        updateLastUpdate();

        elements.error.hidden = true;

    } catch (error) {
        console.error(
            "[ZONE-431] Impossible de charger le personnel :",
            error
        );

        showDirectoryError();
    }
}


/* =========================================================
   NORMALISATION DES PROFILS
========================================================= */

function normalizePersonnel(profile) {
    return {
        name: safeString(profile.display_name),
        identifier: safeString(profile.personnel_id),
        department: safeString(profile.department),
        grade: safeString(profile.grade),
        function: safeString(profile.function),
        integrationDate: profile.integration_date || null
    };
}


function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function isValidPersonnel(profile) {
    return Boolean(
        profile.name &&
        profile.identifier &&
        profile.department
    );
}


/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    if (elements.personnelCount) {
        elements.personnelCount.textContent =
            personnelData.length.toLocaleString("fr-FR");
    }

    if (elements.departmentCount) {
        const departments = new Set(
            personnelData
                .map(profile => profile.department)
                .filter(Boolean)
        );

        elements.departmentCount.textContent =
            departments.size.toLocaleString("fr-FR");
    }
}


function updateLastUpdate() {
    if (!elements.lastUpdate) return;

    const now = new Date();

    elements.lastUpdate.textContent =
        now.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
}


/* =========================================================
   RECHERCHE, FILTRES ET TRI
========================================================= */

function applyFilters() {
    const searchValue = normalizeText(
        elements.search?.value || ""
    );

    const departmentValue =
        elements.department?.value || "all";

    const sortValue =
        elements.sort?.value || "name-asc";

    filteredPersonnel = personnelData.filter(profile => {
        const searchableContent = normalizeText([
            profile.name,
            profile.identifier,
            profile.department,
            profile.grade,
            profile.function
        ].join(" "));

        const matchesSearch =
            !searchValue ||
            searchableContent.includes(searchValue);

        const matchesDepartment =
            departmentValue === "all" ||
            profile.department.toLowerCase() ===
            departmentValue.toLowerCase();

        return matchesSearch && matchesDepartment;
    });

    sortPersonnel(filteredPersonnel, sortValue);

    renderPersonnel();

    updateResultsCount();
}


function normalizeText(value) {
    return String(value)
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function sortPersonnel(data, sortValue) {
    data.sort((a, b) => {
        switch (sortValue) {
            case "name-desc":
                return b.name.localeCompare(
                    a.name,
                    "fr",
                    { sensitivity: "base" }
                );

            case "department":
                return (
                    a.department.localeCompare(b.department, "fr") ||
                    a.name.localeCompare(b.name, "fr")
                );

            case "date-desc":
                return getDateValue(b.integrationDate) -
                    getDateValue(a.integrationDate);

            case "name-asc":
            default:
                return a.name.localeCompare(
                    b.name,
                    "fr",
                    { sensitivity: "base" }
                );
        }
    });
}

/* =========================================================
   ZONE-431 — ANNUAIRE DU PERSONNEL
   Fichier : personnel.js

   Chargement public :
   - Membres autorisés uniquement
   - Profils explicitement publiés uniquement
   - Aucune donnée privée (email, Discord, Roblox)
   ========================================================= */


/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const PERSONNEL_RPC = "get_public_personnel_directory";

let supabaseClient = null;
let personnelData = [];
let filteredPersonnel = [];
let selectedPersonnel = null;


/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    personnelCount: document.getElementById("personnelCount"),
    departmentCount: document.getElementById("departmentCount"),
    lastUpdate: document.getElementById("lastUpdate"),

    search: document.getElementById("personnelSearch"),
    department: document.getElementById("departmentFilter"),
    sort: document.getElementById("sortFilter"),

    resultsCount: document.getElementById("resultsCount"),
    resetFilters: document.getElementById("resetFilters"),

    grid: document.getElementById("personnelGrid"),
    empty: document.getElementById("directoryEmpty"),
    error: document.getElementById("directoryError"),
    retry: document.getElementById("retryPersonnel"),

    modal: document.getElementById("personnelModal"),
    closeModal: document.getElementById("closePersonnelModal"),

    profileInitials: document.getElementById("profileInitials"),
    profileName: document.getElementById("profileName"),
    profileId: document.getElementById("profileId"),
    profileDepartment: document.getElementById("profileDepartment"),
    profileGrade: document.getElementById("profileGrade"),
    profileFunction: document.getElementById("profileFunction"),
    profileDate: document.getElementById("profileDate")
};


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", initializePersonnelPage);

async function initializePersonnelPage() {
    registerEvents();

    try {
        await initializeSupabase();
        await loadPersonnel();
    } catch (error) {
        console.error("[ZONE-431] Erreur d'initialisation :", error);
        showDirectoryError();
    }
}


/* =========================================================
   INITIALISATION SUPABASE
========================================================= */

async function initializeSupabase() {
    if (window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        return;
    }

    await loadSupabaseLibrary();

    if (!window.supabase?.createClient) {
        throw new Error("La bibliothèque Supabase n'a pas pu être chargée.");
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}


function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
            'script[data-supabase-library="true"]'
        );

        if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", reject, { once: true });

            if (window.supabase?.createClient) {
                resolve();
            }

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

        script.dataset.supabaseLibrary = "true";
        script.async = true;

        script.onload = resolve;

        script.onerror = () => {
            reject(new Error("Impossible de charger Supabase."));
        };

        document.head.appendChild(script);
    });
}


/* =========================================================
   EVENEMENTS
========================================================= */

function registerEvents() {
    elements.search?.addEventListener("input", applyFilters);

    elements.department?.addEventListener("change", applyFilters);

    elements.sort?.addEventListener("change", applyFilters);

    elements.resetFilters?.addEventListener("click", resetFilters);

    elements.retry?.addEventListener("click", loadPersonnel);

    elements.closeModal?.addEventListener("click", closeProfile);

    elements.modal?.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
            closeProfile();
        }
    });

    elements.modal?.addEventListener("cancel", () => {
        selectedPersonnel = null;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.modal?.open) {
            closeProfile();
        }
    });
}


/* =========================================================
   CHARGEMENT DES DONNEES
========================================================= */

async function loadPersonnel() {
    if (!supabaseClient) {
        showDirectoryError();
        return;
    }

    setLoadingState();

    try {
        /*
         * Cette RPC doit être créée dans Supabase.
         *
         * Elle doit retourner exclusivement :
         * - Les profils autorisés
         * - Les profils publiés
         * - Les champs publics nécessaires
         *
         * Elle ne doit jamais retourner email,
         * discord_username ou roblox_username.
         */

        const { data, error } = await supabaseClient.rpc(
            PERSONNEL_RPC
        );

        if (error) {
            throw error;
        }

        if (!Array.isArray(data)) {
            throw new Error("Format de réponse Supabase invalide.");
        }

        personnelData = data
            .map(normalizePersonnel)
            .filter(isValidPersonnel);

        updateStatistics();
        applyFilters();
        updateLastUpdate();

        elements.error.hidden = true;

    } catch (error) {
        console.error(
            "[ZONE-431] Impossible de charger le personnel :",
            error
        );

        showDirectoryError();
    }
}


/* =========================================================
   NORMALISATION DES PROFILS
========================================================= */

function normalizePersonnel(profile) {
    return {
        name: safeString(profile.display_name),
        identifier: safeString(profile.personnel_id),
        department: safeString(profile.department),
        grade: safeString(profile.grade),
        function: safeString(profile.function),
        integrationDate: profile.integration_date || null
    };
}


function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function isValidPersonnel(profile) {
    return Boolean(
        profile.name &&
        profile.identifier &&
        profile.department
    );
}


/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    if (elements.personnelCount) {
        elements.personnelCount.textContent =
            personnelData.length.toLocaleString("fr-FR");
    }

    if (elements.departmentCount) {
        const departments = new Set(
            personnelData
                .map(profile => profile.department)
                .filter(Boolean)
        );

        elements.departmentCount.textContent =
            departments.size.toLocaleString("fr-FR");
    }
}


function updateLastUpdate() {
    if (!elements.lastUpdate) return;

    const now = new Date();

    elements.lastUpdate.textContent =
        now.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
}


/* =========================================================
   RECHERCHE, FILTRES ET TRI
========================================================= */

function applyFilters() {
    const searchValue = normalizeText(
        elements.search?.value || ""
    );

    const departmentValue =
        elements.department?.value || "all";

    const sortValue =
        elements.sort?.value || "name-asc";

    filteredPersonnel = personnelData.filter(profile => {
        const searchableContent = normalizeText([
            profile.name,
            profile.identifier,
            profile.department,
            profile.grade,
            profile.function
        ].join(" "));

        const matchesSearch =
            !searchValue ||
            searchableContent.includes(searchValue);

        const matchesDepartment =
            departmentValue === "all" ||
            profile.department.toLowerCase() ===
            departmentValue.toLowerCase();

        return matchesSearch && matchesDepartment;
    });

    sortPersonnel(filteredPersonnel, sortValue);

    renderPersonnel();

    updateResultsCount();
}


function normalizeText(value) {
    return String(value)
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function sortPersonnel(data, sortValue) {
    data.sort((a, b) => {
        switch (sortValue) {
            case "name-desc":
                return b.name.localeCompare(
                    a.name,
                    "fr",
                    { sensitivity: "base" }
                );

            case "department":
                return (
                    a.department.localeCompare(b.department, "fr") ||
                    a.name.localeCompare(b.name, "fr")
                );

            case "date-desc":
                return getDateValue(b.integrationDate) -
                    getDateValue(a.integrationDate);

            case "name-asc":
            default:
                return a.name.localeCompare(
                    b.name,
                    "fr",
                    { sensitivity: "base" }
                );
        }
    });
}


function getDateValue(value) {
    if (!value) return 0;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
}


function resetFilters() {
    if (elements.search) {
        elements.search.value = "";
    }

    if (elements.department) {
        elements.department.value = "all";
    }

    if (elements.sort) {
        elements.sort.value = "name-asc";
    }

    applyFilters();
}


function updateResultsCount() {
    if (!elements.resultsCount) return;

    const count = filteredPersonnel.length;

    elements.resultsCount.textContent =
        `${count} membre${count > 1 ? "s" : ""} trouvé${count > 1 ? "s" : ""}`;
}


/* =========================================================
   AFFICHAGE DES CARTES
========================================================= */

function renderPersonnel() {
    if (!elements.grid) return;

    elements.grid.replaceChildren();

    if (filteredPersonnel.length === 0) {
        elements.empty.hidden = false;
        return;
    }

    elements.empty.hidden = true;

    const fragment = document.createDocumentFragment();

    filteredPersonnel.forEach(profile => {
        fragment.appendChild(createPersonnelCard(profile));
    });

    elements.grid.appendChild(fragment);
}


function createPersonnelCard(profile) {
    const card = document.createElement("article");

    card.className = "personnel-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    card.setAttribute(
        "aria-label",
        `Consulter le profil de ${profile.name}`
    );

    const topLine = document.createElement("div");
    topLine.className = "card-topline";

    const category = document.createElement("span");
    category.className = "card-category";
    category.textContent = profile.department;

    const indicator = document.createElement("span");
    indicator.className = "card-indicator";
    indicator.setAttribute("aria-hidden", "true");

    topLine.append(category, indicator);

    const name = document.createElement("h3");
    name.className = "card-name";
    name.textContent = profile.name;

    const identifier = document.createElement("p");
    identifier.className = "card-identifier";
    identifier.textContent = profile.identifier;

    const separator = document.createElement("div");
    separator.className = "card-separator";

    const details = document.createElement("div");
    details.className = "card-details";

    details.appendChild(
        createCardDetail("GRADE", profile.grade || "Non renseigné")
    );

    details.appendChild(
        createCardDetail("FONCTION", profile.function || "Non renseignée")
    );

    const action = document.createElement("div");
    action.className = "card-action";

    const actionText = document.createElement("span");
    actionText.textContent = "CONSULTER LA FICHE";

    const actionArrow = document.createElement("span");
    actionArrow.textContent = "→";
    actionArrow.setAttribute("aria-hidden", "true");

    action.append(actionText, actionArrow);

    card.append(
        topLine,
        name,
        identifier,
        separator,
        details,
        action
    );

    card.addEventListener("click", () => {
        openProfile(profile);
    });

    card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfile(profile);
        }
    });

    return card;
}


function createCardDetail(label, value) {
    const detail = document.createElement("div");
    detail.className = "card-detail";

    const title = document.createElement("span");
    title.textContent = label;

    const content = document.createElement("strong");
    content.textContent = value;

    detail.append(title, content);

    return detail;
}


/* =========================================================
   PROFIL INDIVIDUEL
========================================================= */

function openProfile(profile) {
    if (!elements.modal) return;

    selectedPersonnel = profile;

    setText(elements.profileName, profile.name);
    setText(elements.profileId, profile.identifier);
    setText(elements.profileDepartment, profile.department);
    setText(elements.profileGrade, profile.grade || "Non renseigné");
    setText(elements.profileFunction, profile.function || "Non renseignée");

    setText(
        elements.profileDate,
        formatIntegrationDate(profile.integrationDate)
    );

    setText(
        elements.profileInitials,
        getInitials(profile.name)
    );

    if (typeof elements.modal.showModal === "function") {
        if (!elements.modal.open) {
            elements.modal.showModal();
        }
    } else {
        elements.modal.setAttribute("open", "");
    }
}


function closeProfile() {
    if (!elements.modal) return;

    if (typeof elements.modal.close === "function") {
        if (elements.modal.open) {
            elements.modal.close();
        }
    } else {
        elements.modal.removeAttribute("open");
    }

    selectedPersonnel = null;
}


function setText(element, value) {
    if (!element) return;

    element.textContent = value || "Non renseigné";
}


function getInitials(name) {
    const parts = safeString(name)
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "Z431";

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

/* =========================================================
   ZONE-431 — ANNUAIRE DU PERSONNEL
   Fichier : personnel.js

   Chargement public :
   - Membres autorisés uniquement
   - Profils explicitement publiés uniquement
   - Aucune donnée privée (email, Discord, Roblox)
   ========================================================= */


/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const PERSONNEL_RPC = "get_public_personnel_directory";

let supabaseClient = null;
let personnelData = [];
let filteredPersonnel = [];
let selectedPersonnel = null;


/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    personnelCount: document.getElementById("personnelCount"),
    departmentCount: document.getElementById("departmentCount"),
    lastUpdate: document.getElementById("lastUpdate"),

    search: document.getElementById("personnelSearch"),
    department: document.getElementById("departmentFilter"),
    sort: document.getElementById("sortFilter"),

    resultsCount: document.getElementById("resultsCount"),
    resetFilters: document.getElementById("resetFilters"),

    grid: document.getElementById("personnelGrid"),
    empty: document.getElementById("directoryEmpty"),
    error: document.getElementById("directoryError"),
    retry: document.getElementById("retryPersonnel"),

    modal: document.getElementById("personnelModal"),
    closeModal: document.getElementById("closePersonnelModal"),

    profileInitials: document.getElementById("profileInitials"),
    profileName: document.getElementById("profileName"),
    profileId: document.getElementById("profileId"),
    profileDepartment: document.getElementById("profileDepartment"),
    profileGrade: document.getElementById("profileGrade"),
    profileFunction: document.getElementById("profileFunction"),
    profileDate: document.getElementById("profileDate")
};


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", initializePersonnelPage);

async function initializePersonnelPage() {
    registerEvents();

    try {
        await initializeSupabase();
        await loadPersonnel();
    } catch (error) {
        console.error("[ZONE-431] Erreur d'initialisation :", error);
        showDirectoryError();
    }
}


/* =========================================================
   INITIALISATION SUPABASE
========================================================= */

async function initializeSupabase() {
    if (window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        return;
    }

    await loadSupabaseLibrary();

    if (!window.supabase?.createClient) {
        throw new Error("La bibliothèque Supabase n'a pas pu être chargée.");
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}


function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
            'script[data-supabase-library="true"]'
        );

        if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", reject, { once: true });

            if (window.supabase?.createClient) {
                resolve();
            }

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

        script.dataset.supabaseLibrary = "true";
        script.async = true;

        script.onload = resolve;

        script.onerror = () => {
            reject(new Error("Impossible de charger Supabase."));
        };

        document.head.appendChild(script);
    });
}


/* =========================================================
   EVENEMENTS
========================================================= */

function registerEvents() {
    elements.search?.addEventListener("input", applyFilters);

    elements.department?.addEventListener("change", applyFilters);

    elements.sort?.addEventListener("change", applyFilters);

    elements.resetFilters?.addEventListener("click", resetFilters);

    elements.retry?.addEventListener("click", loadPersonnel);

    elements.closeModal?.addEventListener("click", closeProfile);

    elements.modal?.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
            closeProfile();
        }
    });

    elements.modal?.addEventListener("cancel", () => {
        selectedPersonnel = null;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.modal?.open) {
            closeProfile();
        }
    });
}


/* =========================================================
   CHARGEMENT DES DONNEES
========================================================= */

async function loadPersonnel() {
    if (!supabaseClient) {
        showDirectoryError();
        return;
    }

    setLoadingState();

    try {
        /*
         * Cette RPC doit être créée dans Supabase.
         *
         * Elle doit retourner exclusivement :
         * - Les profils autorisés
         * - Les profils publiés
         * - Les champs publics nécessaires
         *
         * Elle ne doit jamais retourner email,
         * discord_username ou roblox_username.
         */

        const { data, error } = await supabaseClient.rpc(
            PERSONNEL_RPC
        );

        if (error) {
            throw error;
        }

        if (!Array.isArray(data)) {
            throw new Error("Format de réponse Supabase invalide.");
        }

        personnelData = data
            .map(normalizePersonnel)
            .filter(isValidPersonnel);

        updateStatistics();
        applyFilters();
        updateLastUpdate();

        elements.error.hidden = true;

    } catch (error) {
        console.error(
            "[ZONE-431] Impossible de charger le personnel :",
            error
        );

        showDirectoryError();
    }
}


/* =========================================================
   NORMALISATION DES PROFILS
========================================================= */

function normalizePersonnel(profile) {
    return {
        name: safeString(profile.display_name),
        identifier: safeString(profile.personnel_id),
        department: safeString(profile.department),
        grade: safeString(profile.grade),
        function: safeString(profile.function),
        integrationDate: profile.integration_date || null
    };
}


function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function isValidPersonnel(profile) {
    return Boolean(
        profile.name &&
        profile.identifier &&
        profile.department
    );
}


/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    if (elements.personnelCount) {
        elements.personnelCount.textContent =
            personnelData.length.toLocaleString("fr-FR");
    }

    if (elements.departmentCount) {
        const departments = new Set(
            personnelData
                .map(profile => profile.department)
                .filter(Boolean)
        );

        elements.departmentCount.textContent =
            departments.size.toLocaleString("fr-FR");
    }
}


function updateLastUpdate() {
    if (!elements.lastUpdate) return;

    const now = new Date();

    elements.lastUpdate.textContent =
        now.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
}


/* =========================================================
   RECHERCHE, FILTRES ET TRI
========================================================= */

function applyFilters() {
    const searchValue = normalizeText(
        elements.search?.value || ""
    );

    const departmentValue =
        elements.department?.value || "all";

    const sortValue =
        elements.sort?.value || "name-asc";

    filteredPersonnel = personnelData.filter(profile => {
        const searchableContent = normalizeText([
            profile.name,
            profile.identifier,
            profile.department,
            profile.grade,
            profile.function
        ].join(" "));

        const matchesSearch =
            !searchValue ||
            searchableContent.includes(searchValue);

        const matchesDepartment =
            departmentValue === "all" ||
            profile.department.toLowerCase() ===
            departmentValue.toLowerCase();

        return matchesSearch && matchesDepartment;
    });

    sortPersonnel(filteredPersonnel, sortValue);

    renderPersonnel();

    updateResultsCount();
}


function normalizeText(value) {
    return String(value)
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function sortPersonnel(data, sortValue) {
    data.sort((a, b) => {
        switch (sortValue) {
            case "name-desc":
                return b.name.localeCompare(
                    a.name,
                    "fr",
                    { sensitivity: "base" }
                );

            case "department":
                return (
                    a.department.localeCompare(b.department, "fr") ||
                    a.name.localeCompare(b.name, "fr")
                );

            case "date-desc":
                return getDateValue(b.integrationDate) -
                    getDateValue(a.integrationDate);

            case "name-asc":
            default:
                return a.name.localeCompare(
                    b.name,
                    "fr",
                    { sensitivity: "base" }
                );
        }
    });
}

/* =========================================================
   ZONE-431 — ANNUAIRE DU PERSONNEL
   Fichier : personnel.js

   Chargement public :
   - Membres autorisés uniquement
   - Profils explicitement publiés uniquement
   - Aucune donnée privée (email, Discord, Roblox)
   ========================================================= */


/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const PERSONNEL_RPC = "get_public_personnel_directory";

let supabaseClient = null;
let personnelData = [];
let filteredPersonnel = [];
let selectedPersonnel = null;


/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    personnelCount: document.getElementById("personnelCount"),
    departmentCount: document.getElementById("departmentCount"),
    lastUpdate: document.getElementById("lastUpdate"),

    search: document.getElementById("personnelSearch"),
    department: document.getElementById("departmentFilter"),
    sort: document.getElementById("sortFilter"),

    resultsCount: document.getElementById("resultsCount"),
    resetFilters: document.getElementById("resetFilters"),

    grid: document.getElementById("personnelGrid"),
    empty: document.getElementById("directoryEmpty"),
    error: document.getElementById("directoryError"),
    retry: document.getElementById("retryPersonnel"),

    modal: document.getElementById("personnelModal"),
    closeModal: document.getElementById("closePersonnelModal"),

    profileInitials: document.getElementById("profileInitials"),
    profileName: document.getElementById("profileName"),
    profileId: document.getElementById("profileId"),
    profileDepartment: document.getElementById("profileDepartment"),
    profileGrade: document.getElementById("profileGrade"),
    profileFunction: document.getElementById("profileFunction"),
    profileDate: document.getElementById("profileDate")
};


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", initializePersonnelPage);

async function initializePersonnelPage() {
    registerEvents();

    try {
        await initializeSupabase();
        await loadPersonnel();
    } catch (error) {
        console.error("[ZONE-431] Erreur d'initialisation :", error);
        showDirectoryError();
    }
}


/* =========================================================
   INITIALISATION SUPABASE
========================================================= */

async function initializeSupabase() {
    if (window.supabase?.createClient) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        return;
    }

    await loadSupabaseLibrary();

    if (!window.supabase?.createClient) {
        throw new Error("La bibliothèque Supabase n'a pas pu être chargée.");
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
}


function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
            'script[data-supabase-library="true"]'
        );

        if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", reject, { once: true });

            if (window.supabase?.createClient) {
                resolve();
            }

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

        script.dataset.supabaseLibrary = "true";
        script.async = true;

        script.onload = resolve;

        script.onerror = () => {
            reject(new Error("Impossible de charger Supabase."));
        };

        document.head.appendChild(script);
    });
}


/* =========================================================
   EVENEMENTS
========================================================= */

function registerEvents() {
    elements.search?.addEventListener("input", applyFilters);

    elements.department?.addEventListener("change", applyFilters);

    elements.sort?.addEventListener("change", applyFilters);

    elements.resetFilters?.addEventListener("click", resetFilters);

    elements.retry?.addEventListener("click", loadPersonnel);

    elements.closeModal?.addEventListener("click", closeProfile);

    elements.modal?.addEventListener("click", (event) => {
        if (event.target === elements.modal) {
            closeProfile();
        }
    });

    elements.modal?.addEventListener("cancel", () => {
        selectedPersonnel = null;
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.modal?.open) {
            closeProfile();
        }
    });
}


/* =========================================================
   CHARGEMENT DES DONNEES
========================================================= */

async function loadPersonnel() {
    if (!supabaseClient) {
        showDirectoryError();
        return;
    }

    setLoadingState();

    try {
        /*
         * Cette RPC doit être créée dans Supabase.
         *
         * Elle doit retourner exclusivement :
         * - Les profils autorisés
         * - Les profils publiés
         * - Les champs publics nécessaires
         *
         * Elle ne doit jamais retourner email,
         * discord_username ou roblox_username.
         */

        const { data, error } = await supabaseClient.rpc(
            PERSONNEL_RPC
        );

        if (error) {
            throw error;
        }

        if (!Array.isArray(data)) {
            throw new Error("Format de réponse Supabase invalide.");
        }

        personnelData = data
            .map(normalizePersonnel)
            .filter(isValidPersonnel);

        updateStatistics();
        applyFilters();
        updateLastUpdate();

        elements.error.hidden = true;

    } catch (error) {
        console.error(
            "[ZONE-431] Impossible de charger le personnel :",
            error
        );

        showDirectoryError();
    }
}


/* =========================================================
   NORMALISATION DES PROFILS
========================================================= */

function normalizePersonnel(profile) {
    return {
        name: safeString(profile.display_name),
        identifier: safeString(profile.personnel_id),
        department: safeString(profile.department),
        grade: safeString(profile.grade),
        function: safeString(profile.function),
        integrationDate: profile.integration_date || null
    };
}


function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function isValidPersonnel(profile) {
    return Boolean(
        profile.name &&
        profile.identifier &&
        profile.department
    );
}


/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    if (elements.personnelCount) {
        elements.personnelCount.textContent =
            personnelData.length.toLocaleString("fr-FR");
    }

    if (elements.departmentCount) {
        const departments = new Set(
            personnelData
                .map(profile => profile.department)
                .filter(Boolean)
        );

        elements.departmentCount.textContent =
            departments.size.toLocaleString("fr-FR");
    }
}


function updateLastUpdate() {
    if (!elements.lastUpdate) return;

    const now = new Date();

    elements.lastUpdate.textContent =
        now.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
}


/* =========================================================
   RECHERCHE, FILTRES ET TRI
========================================================= */

function applyFilters() {
    const searchValue = normalizeText(
        elements.search?.value || ""
    );

    const departmentValue =
        elements.department?.value || "all";

    const sortValue =
        elements.sort?.value || "name-asc";

    filteredPersonnel = personnelData.filter(profile => {
        const searchableContent = normalizeText([
            profile.name,
            profile.identifier,
            profile.department,
            profile.grade,
            profile.function
        ].join(" "));

        const matchesSearch =
            !searchValue ||
            searchableContent.includes(searchValue);

        const matchesDepartment =
            departmentValue === "all" ||
            profile.department.toLowerCase() ===
            departmentValue.toLowerCase();

        return matchesSearch && matchesDepartment;
    });

    sortPersonnel(filteredPersonnel, sortValue);

    renderPersonnel();

    updateResultsCount();
}


function normalizeText(value) {
    return String(value)
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


function sortPersonnel(data, sortValue) {
    data.sort((a, b) => {
        switch (sortValue) {
            case "name-desc":
                return b.name.localeCompare(
                    a.name,
                    "fr",
                    { sensitivity: "base" }
                );

            case "department":
                return (
                    a.department.localeCompare(b.department, "fr") ||
                    a.name.localeCompare(b.name, "fr")
                );

            case "date-desc":
                return getDateValue(b.integrationDate) -
                    getDateValue(a.integrationDate);

            case "name-asc":
            default:
                return a.name.localeCompare(
                    b.name,
                    "fr",
                    { sensitivity: "base" }
                );
        }
    });
}


function getDateValue(value) {
    if (!value) return 0;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
}


function resetFilters() {
    if (elements.search) {
        elements.search.value = "";
    }

    if (elements.department) {
        elements.department.value = "all";
    }

    if (elements.sort) {
        elements.sort.value = "name-asc";
    }

    applyFilters();
}


function updateResultsCount() {
    if (!elements.resultsCount) return;

    const count = filteredPersonnel.length;

    elements.resultsCount.textContent =
        `${count} membre${count > 1 ? "s" : ""} trouvé${count > 1 ? "s" : ""}`;
}


/* =========================================================
   AFFICHAGE DES CARTES
========================================================= */

function renderPersonnel() {
    if (!elements.grid) return;

    elements.grid.replaceChildren();

    if (filteredPersonnel.length === 0) {
        elements.empty.hidden = false;
        return;
    }

    elements.empty.hidden = true;

    const fragment = document.createDocumentFragment();

    filteredPersonnel.forEach(profile => {
        fragment.appendChild(createPersonnelCard(profile));
    });

    elements.grid.appendChild(fragment);
}


function createPersonnelCard(profile) {
    const card = document.createElement("article");

    card.className = "personnel-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    card.setAttribute(
        "aria-label",
        `Consulter le profil de ${profile.name}`
    );

    const topLine = document.createElement("div");
    topLine.className = "card-topline";

    const category = document.createElement("span");
    category.className = "card-category";
    category.textContent = profile.department;

    const indicator = document.createElement("span");
    indicator.className = "card-indicator";
    indicator.setAttribute("aria-hidden", "true");

    topLine.append(category, indicator);

    const name = document.createElement("h3");
    name.className = "card-name";
    name.textContent = profile.name;

    const identifier = document.createElement("p");
    identifier.className = "card-identifier";
    identifier.textContent = profile.identifier;

    const separator = document.createElement("div");
    separator.className = "card-separator";

    const details = document.createElement("div");
    details.className = "card-details";

    details.appendChild(
        createCardDetail("GRADE", profile.grade || "Non renseigné")
    );

    details.appendChild(
        createCardDetail("FONCTION", profile.function || "Non renseignée")
    );

    const action = document.createElement("div");
    action.className = "card-action";

    const actionText = document.createElement("span");
    actionText.textContent = "CONSULTER LA FICHE";

    const actionArrow = document.createElement("span");
    actionArrow.textContent = "→";
    actionArrow.setAttribute("aria-hidden", "true");

    action.append(actionText, actionArrow);

    card.append(
        topLine,
        name,
        identifier,
        separator,
        details,
        action
    );

    card.addEventListener("click", () => {
        openProfile(profile);
    });

    card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfile(profile);
        }
    });

    return card;
}


function createCardDetail(label, value) {
    const detail = document.createElement("div");
    detail.className = "card-detail";

    const title = document.createElement("span");
    title.textContent = label;

    const content = document.createElement("strong");
    content.textContent = value;

    detail.append(title, content);

    return detail;
}


/* =========================================================
   PROFIL INDIVIDUEL
========================================================= */

function openProfile(profile) {
    if (!elements.modal) return;

    selectedPersonnel = profile;

    setText(elements.profileName, profile.name);
    setText(elements.profileId, profile.identifier);
    setText(elements.profileDepartment, profile.department);
    setText(elements.profileGrade, profile.grade || "Non renseigné");
    setText(elements.profileFunction, profile.function || "Non renseignée");

    setText(
        elements.profileDate,
        formatIntegrationDate(profile.integrationDate)
    );

    setText(
        elements.profileInitials,
        getInitials(profile.name)
    );

    if (typeof elements.modal.showModal === "function") {
        if (!elements.modal.open) {
            elements.modal.showModal();
        }
    } else {
        elements.modal.setAttribute("open", "");
    }
}


function closeProfile() {
    if (!elements.modal) return;

    if (typeof elements.modal.close === "function") {
        if (elements.modal.open) {
            elements.modal.close();
        }
    } else {
        elements.modal.removeAttribute("open");
    }

    selectedPersonnel = null;
}


function setText(element, value) {
    if (!element) return;

    element.textContent = value || "Non renseigné";
}


function getInitials(name) {
    const parts = safeString(name)
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "Z431";

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function formatIntegrationDate(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Non renseignée";
    }

    return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}


/* =========================================================
   ETATS DE CHARGEMENT ET D'ERREUR
========================================================= */

function setLoadingState() {
    if (elements.error) {
        elements.error.hidden = true;
    }

    if (elements.empty) {
        elements.empty.hidden = true;
    }

    if (elements.grid) {
        elements.grid.replaceChildren();

        const loading = document.createElement("p");

        loading.className = "directory-loading";
        loading.textContent = "Chargement du registre du personnel...";

        elements.grid.appendChild(loading);
    }

    if (elements.resultsCount) {
        elements.resultsCount.textContent = "Chargement...";
    }
}


function showDirectoryError() {
    if (elements.error) {
        elements.error.hidden = false;
    }

    if (elements.empty) {
        elements.empty.hidden = true;
    }

    if (elements.grid) {
        elements.grid.replaceChildren();
    }

    if (elements.resultsCount) {
        elements.resultsCount.textContent =
            "Registre temporairement indisponible";
    }
}
