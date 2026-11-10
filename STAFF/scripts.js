
"use strict";

/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const ADMIN_ROLE = "ADMINISTRATEUR";

let currentUser = null;
let currentStaff = null;
let currentRole = null;

let scripts = [];
let canManageScripts = false;
let currentDetailsScript = null;

/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    userName: document.getElementById("userName"),

    accessLabel: document.getElementById("accessLabel"),

    newScriptBtn: document.getElementById("newScriptBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    searchInput: document.getElementById("searchInput"),

    scriptsGrid: document.getElementById("scriptsGrid"),
    emptyState: document.getElementById("emptyState"),
    resultsCount: document.getElementById("resultsCount"),

    statTotal: document.getElementById("statTotal"),
    statAuthors: document.getElementById("statAuthors"),
    statLastUpdate: document.getElementById("statLastUpdate"),

    scriptModal: document.getElementById("scriptModal"),
    scriptForm: document.getElementById("scriptForm"),
    modalTitle: document.getElementById("modalTitle"),

    scriptId: document.getElementById("scriptId"),
    scriptTitle: document.getElementById("scriptTitle"),
    scriptAuthor: document.getElementById("scriptAuthor"),
    scriptContent: document.getElementById("scriptContent"),

    saveScriptBtn: document.getElementById("saveScriptBtn"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    cancelModalBtn: document.getElementById("cancelModalBtn"),

    detailsModal: document.getElementById("detailsModal"),
    detailsTitle: document.getElementById("detailsTitle"),
    detailsAuthor: document.getElementById("detailsAuthor"),
    detailsUpdated: document.getElementById("detailsUpdated"),
    detailsReference: document.getElementById("detailsReference"),
    detailsContent: document.getElementById("detailsContent"),

    copyDetailsBtn: document.getElementById("copyDetailsBtn"),
    editDetailsBtn: document.getElementById("editDetailsBtn"),

    closeDetailsBtn: document.getElementById("closeDetailsBtn"),
    closeDetailsFooterBtn: document.getElementById("closeDetailsFooterBtn"),

    toastContainer: document.getElementById("toastContainer")
};

/* =========================================================
   OUTILS
========================================================= */

function showToast(message, type = "success") {
    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 4000);
}

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function formatTimestamp(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Non renseignée";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function formatShortDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function createButton(label, className, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `table-action ${className || ""}`.trim();
    button.textContent = label;

    button.addEventListener("click", callback);

    return button;
}

function setModalVisible(modal, visible) {
    modal.hidden = !visible;
    document.body.style.overflow = visible ? "hidden" : "";
}

function closeAllModals() {
    setModalVisible(elements.scriptModal, false);
    setModalVisible(elements.detailsModal, false);

    document.body.style.overflow = "";
}

function getScriptDate(script) {
    return script.updated_at || script.created_at;
}

/* =========================================================
   AUTHENTIFICATION
========================================================= */

async function initialize() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (!session) {
            window.location.replace("connexion.html");
            return;
        }

        currentUser = session.user;

        const { data: access, error: accessError } = await supabaseClient.rpc(
            "has_staff_module_permission",
            { p_module_code: "scripts", p_action: "access" }
        );

        if (accessError) throw accessError;

        if (access !== true) {
            showAccessDenied();
            return;
        }

        const { data: write, error: writeError } = await supabaseClient.rpc(
            "has_staff_module_permission",
            { p_module_code: "scripts", p_action: "write" }
        );

        if (writeError) throw writeError;

        canManageScripts = write === true;

        const { data: staffData } = await supabaseClient
            .from("staff_members")
            .select("pseudo_discord,pseudo_ig,role,active")
            .eq("auth_user_id", currentUser.id)
            .eq("active", true)
            .maybeSingle();

        currentStaff = staffData || {};

        if (elements.userName) {
            elements.userName.textContent =
                currentStaff.pseudo_discord ||
                currentStaff.pseudo_ig ||
                currentUser.user_metadata?.discord ||
                currentUser.email ||
                "Agent autorisé";
        }

        elements.accessLabel.textContent = canManageScripts
            ? "GESTION AUTORISÉE"
            : "CONSULTATION UNIQUEMENT";

        elements.newScriptBtn.hidden = !canManageScripts;

        setupEvents();
        await loadScripts();

    } catch (error) {
        console.error("Initialisation du module Scripts :", error);

        showToast(
            error.message || "Impossible d'initialiser le module.",
            "error"
        );

        setLoading("Impossible d'initialiser la bibliothèque.");
    }
}

function showAccessDenied() {
    document.body.innerHTML = "";

    const main = document.createElement("main");
    const section = document.createElement("section");
    const title = document.createElement("h1");
    const message = document.createElement("p");
    const link = document.createElement("a");

    main.style.cssText = `
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:30px;
        background:#080e17;
        color:#e5edf5;
        font-family:Arial,sans-serif;
        text-align:center;
    `;

    title.textContent = "ACCÈS REFUSÉ";

    message.textContent =
        "Votre compte ne dispose pas d'un accès STAFF actif.";

    link.href = "staff.html";
    link.textContent = "Retour à l'accueil STAFF";
    link.style.color = "#72b5df";

    section.append(title, message, link);
    main.appendChild(section);
    document.body.appendChild(main);
}

/* =========================================================
   CHARGEMENT DES SCRIPTS
========================================================= */

async function loadScripts() {
    setLoading();

    try {
        const { data, error } = await supabaseClient
            .from("scripts")
            .select("id,created_at,updated_at,titre,redacteur,contenu")
            .order("updated_at", {
                ascending: false
            })
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        scripts = data || [];

        updateStatistics();
        renderScripts();

    } catch (error) {
        console.error("Chargement des scripts :", error);

        setLoading("Erreur lors du chargement du registre.");

        showToast(
            error.message || "Impossible de récupérer les scripts.",
            "error"
        );
    }
}

function setLoading(message) {
    elements.scriptsGrid.replaceChildren();

    const container = document.createElement("div");
    const indicator = document.createElement("span");
    const paragraph = document.createElement("p");

    container.className = "loading-state";
    indicator.className = "loading-indicator";
    paragraph.textContent = message;

    container.append(indicator, paragraph);
    elements.scriptsGrid.appendChild(container);

    elements.resultsCount.textContent = "Chargement...";
    elements.emptyState.hidden = true;
}

/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    elements.statTotal.textContent = scripts.length;

    const authors = new Set(
        scripts
            .map(script => normalizeText(script.redacteur))
            .filter(Boolean)
    );

    elements.statAuthors.textContent = authors.size;

    if (scripts.length === 0) {
        elements.statLastUpdate.textContent = "—";
        return;
    }

    const latestScript = [...scripts].sort((a, b) => {
        return new Date(getScriptDate(b)) - new Date(getScriptDate(a));
    })[0];

    elements.statLastUpdate.textContent =
        formatShortDate(getScriptDate(latestScript));
}

/* =========================================================
   RECHERCHE
========================================================= */

function getFilteredScripts() {
    const search = normalizeText(elements.searchInput.value);

    return scripts.filter(script => {
        const searchableContent = [
            script.id,
            script.titre,
            script.redacteur,
            script.contenu
        ].map(normalizeText).join(" ");

        return !search || searchableContent.includes(search);
    });
}

/* =========================================================
   AFFICHAGE DE LA BIBLIOTHÈQUE
========================================================= */

function renderScripts() {
    const filteredScripts = getFilteredScripts();

    elements.scriptsGrid.replaceChildren();

    elements.emptyState.hidden = filteredScripts.length > 0;

    if (filteredScripts.length === 0) {
        elements.resultsCount.textContent = "0 script affiché";
        return;
    }

    filteredScripts.forEach(script => {
        const card = document.createElement("article");
        card.className = "script-card";

        const header = document.createElement("div");
        header.className = "script-card-header";

        const titleContainer = document.createElement("div");
        titleContainer.className = "script-card-title";

        const title = document.createElement("h3");
        title.textContent = script.titre || "Script sans titre";

        const reference = document.createElement("span");
        reference.className = "script-reference";
        reference.textContent = `RÉFÉRENCE #${script.id}`;

        titleContainer.append(title, reference);

        const date = document.createElement("span");
        date.className = "script-card-date";
        date.textContent = formatShortDate(getScriptDate(script));

        header.append(titleContainer, date);

        const author = document.createElement("div");
        author.className = "script-card-author";
        author.append("Rédacteur : ");

        const authorName = document.createElement("strong");
        authorName.textContent = script.redacteur || "Non renseigné";

        author.appendChild(authorName);

        const preview = document.createElement("pre");
        preview.className = "script-card-preview";

        const content = String(script.contenu || "");

        preview.textContent =
            content.length > 260
                ? `${content.slice(0, 260)}...`
                : content;

        const actions = document.createElement("div");
        actions.className = "script-card-actions";

        actions.appendChild(
            createButton("CONSULTER", "", () => {
                openDetails(script);
            })
        );

        actions.appendChild(
            createButton("COPIER", "", () => {
                copyScriptContent(script.contenu);
            })
        );

        if (canManageScripts) {
            actions.appendChild(
                createButton("MODIFIER", "", () => {
                    openEditModal(script);
                })
            );

            actions.appendChild(
                createButton("SUPPRIMER", "danger", () => {
                    deleteScript(script);
                })
            );
        }

        card.append(header, author, preview, actions);

        elements.scriptsGrid.appendChild(card);
    });

    elements.resultsCount.textContent =
        `${filteredScripts.length} script(s) affiché(s) sur ${scripts.length}`;
}

/* =========================================================
   CONSULTATION D'UN SCRIPT
========================================================= */

function openDetails(script) {
    currentDetailsScript = script;

    elements.detailsTitle.textContent =
        script.titre || "Script sans titre";

    elements.detailsAuthor.textContent =
        script.redacteur || "Non renseigné";

    elements.detailsUpdated.textContent =
        formatTimestamp(getScriptDate(script));

    elements.detailsReference.textContent =
        `SCRIPT #${script.id}`;

    elements.detailsContent.textContent =
        script.contenu || "Aucun contenu.";

    elements.editDetailsBtn.hidden = !canManageScripts;

    setModalVisible(elements.detailsModal, true);
}

/* =========================================================
   COPIE DU CONTENU
========================================================= */

async function copyScriptContent(content) {
    try {
        await navigator.clipboard.writeText(String(content || ""));

        showToast("Le contenu a été copié.", "success");

    } catch (error) {
        console.error("Copie du script :", error);

        showToast(
            "La copie automatique est indisponible sur ce navigateur.",
            "error"
        );
    }
}

/* =========================================================
   CRÉATION D'UN SCRIPT
========================================================= */

function openCreateModal() {
    if (!canManageScripts) return;

    elements.scriptForm.reset();

    elements.scriptId.value = "";

    elements.scriptAuthor.value =
        currentStaff?.pseudo_discord ||
        currentStaff?.pseudo_ig ||
        "";

    elements.modalTitle.textContent = "NOUVEAU SCRIPT";
    elements.saveScriptBtn.textContent = "ENREGISTRER";

    setModalVisible(elements.scriptModal, true);
}

/* =========================================================
   MODIFICATION D'UN SCRIPT
========================================================= */

function openEditModal(script) {
    if (!canManageScripts) return;

    elements.scriptForm.reset();

    elements.scriptId.value = script.id;
    elements.scriptTitle.value = script.titre || "";
    elements.scriptAuthor.value = script.redacteur || "";
    elements.scriptContent.value = script.contenu || "";

    elements.modalTitle.textContent = "MODIFIER LE SCRIPT";
    elements.saveScriptBtn.textContent = "ENREGISTRER LES MODIFICATIONS";

    setModalVisible(elements.detailsModal, false);
    setModalVisible(elements.scriptModal, true);
}

function closeScriptModal() {
    setModalVisible(elements.scriptModal, false);
    elements.scriptForm.reset();
}

/* =========================================================
   ENREGISTREMENT
========================================================= */

async function saveScript(event) {
    event.preventDefault();

    if (!canManageScripts) {
        showToast(
            "Vous ne disposez pas des droits nécessaires.",
            "error"
        );
        return;
    }

    const scriptId = elements.scriptId.value;

    const titre = elements.scriptTitle.value.trim();
    const redacteur = elements.scriptAuthor.value.trim();
    const contenu = elements.scriptContent.value.trim();

    if (!titre || !redacteur || !contenu) {
        showToast(
            "Tous les champs sont obligatoires.",
            "error"
        );
        return;
    }

    const payload = {
        titre,
        redacteur,
        contenu,
        updated_at: new Date().toISOString()
    };

    elements.saveScriptBtn.disabled = true;
    elements.saveScriptBtn.textContent = "ENREGISTREMENT...";

    try {
        let result;

        if (scriptId) {
            result = await supabaseClient
                .from("scripts")
                .update(payload)
                .eq("id", Number(scriptId))
                .select()
                .single();

        } else {
            result = await supabaseClient
                .from("scripts")
                .insert(payload)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        closeScriptModal();

        showToast(
            scriptId
                ? "Le script a été modifié."
                : "Le script a été enregistré.",
            "success"
        );

        await loadScripts();

    } catch (error) {
        console.error("Enregistrement du script :", error);

        showToast(
            error.message || "Impossible d'enregistrer le script.",
            "error"
        );

    } finally {
        elements.saveScriptBtn.disabled = false;

        elements.saveScriptBtn.textContent = scriptId
            ? "ENREGISTRER LES MODIFICATIONS"
            : "ENREGISTRER";
    }
}

/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteScript(script) {
    if (!canManageScripts) return;

    const confirmed = window.confirm(
        `Confirmer la suppression du script "${script.titre}" (#${script.id}) ?\n\nCette action est définitive.`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from("scripts")
            .delete()
            .eq("id", script.id);

        if (error) throw error;

        showToast("Le script a été supprimé.", "success");

        await loadScripts();

    } catch (error) {
        console.error("Suppression du script :", error);

        showToast(
            error.message || "Impossible de supprimer le script.",
            "error"
        );
    }
}

/* =========================================================
   FERMETURE DES MODALES
========================================================= */

function closeDetailsModal() {
    currentDetailsScript = null;

    setModalVisible(elements.detailsModal, false);
}

/* =========================================================
   ÉVÈNEMENTS
========================================================= */

function setupEvents() {
    elements.newScriptBtn.addEventListener(
        "click",
        openCreateModal
    );

    elements.refreshBtn.addEventListener(
        "click",
        loadScripts
    );

    elements.searchInput.addEventListener(
        "input",
        renderScripts
    );

    elements.scriptForm.addEventListener(
        "submit",
        saveScript
    );

    elements.closeModalBtn.addEventListener(
        "click",
        closeScriptModal
    );

    elements.cancelModalBtn.addEventListener(
        "click",
        closeScriptModal
    );

    elements.closeDetailsBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.closeDetailsFooterBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.copyDetailsBtn.addEventListener(
        "click",
        () => {
            if (currentDetailsScript) {
                copyScriptContent(currentDetailsScript.contenu);
            }
        }
    );

    elements.editDetailsBtn.addEventListener(
        "click",
        () => {
            if (currentDetailsScript && canManageScripts) {
                openEditModal(currentDetailsScript);
            }
        }
    );

    elements.scriptModal.addEventListener("click", event => {
        if (event.target === elements.scriptModal) {
            closeScriptModal();
        }
    });

    elements.detailsModal.addEventListener("click", event => {
        if (event.target === elements.detailsModal) {
            closeDetailsModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        if (!elements.scriptModal.hidden) {
            closeScriptModal();
        }

        if (!elements.detailsModal.hidden) {
            closeDetailsModal();
        }
    });
}

/* =========================================================
   SURVEILLANCE DE SESSION
========================================================= */

supabaseClient.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        window.location.replace("connexion.html");
    }
});

/* =========================================================
   DÉMARRAGE
========================================================= */

initialize();
