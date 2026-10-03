const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let scripts = [];
let currentRole = null;
let editingScriptId = null;


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    setupSearch();
    setupClearSearch();
    setupCreateButton();

    await initializeScripts();
});


async function initializeScripts() {
    try {
        await ensureSession();
        await loadCurrentRole();
        updateAdminInterface();
        await loadScripts();
    } catch (error) {
        console.error("Erreur initialisation scripts :", error);

        showError(
            "IMPOSSIBLE D'INITIALISER LE MODULE SCRIPTS."
        );
    }
}


/* =========================================================
   SESSION
   ========================================================= */

async function ensureSession() {
    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();

    if (error) {
        throw error;
    }

    if (session) {
        return session;
    }

    const {
        data,
        error: signInError
    } = await supabaseClient.auth.signInAnonymously();

    if (signInError) {
        throw signInError;
    }

    return data.session;
}


/* =========================================================
   ROLE STAFF
   ========================================================= */

async function loadCurrentRole() {
    const {
        data,
        error
    } = await supabaseClient.rpc("current_staff_role");

    if (error) {
        console.error("Erreur récupération rôle :", error);
        currentRole = null;
        return;
    }

    currentRole = data || null;

    if (currentRole) {
        sessionStorage.setItem(
            "zone431_role",
            currentRole
        );
    }
}


function isAdmin() {
    return currentRole === "ADMINISTRATEUR";
}


function updateAdminInterface() {
    const createButton = document.getElementById(
        "create-script-button"
    );

    if (!createButton) {
        return;
    }

    createButton.hidden = !isAdmin();
}


/* =========================================================
   CHARGEMENT DES SCRIPTS
   ========================================================= */

async function loadScripts() {
    hideError();

    const list = document.getElementById("scripts-list");

    if (list) {
        list.innerHTML = `
            <div class="scripts-loading">
                CHARGEMENT DES SCRIPTS...
            </div>
        `;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("scripts")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Erreur chargement scripts :", error);

        scripts = [];
        renderScripts();

        showError(
            "ERREUR LORS DU CHARGEMENT DES SCRIPTS."
        );

        return;
    }

    scripts = Array.isArray(data) ? data : [];

    renderScripts();
}


/* =========================================================
   AFFICHAGE
   ========================================================= */

function renderScripts() {
    const list = document.getElementById("scripts-list");
    const empty = document.getElementById("scripts-empty");

    if (!list || !empty) {
        return;
    }

    const searchInput = document.getElementById(
        "scripts-search"
    );

    const search = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const filteredScripts = scripts.filter((script) => {
        if (!search) {
            return true;
        }

        return (
            String(script.titre || "")
                .toLowerCase()
                .includes(search) ||
            String(script.redacteur || "")
                .toLowerCase()
                .includes(search) ||
            String(script.contenu || "")
                .toLowerCase()
                .includes(search)
        );
    });

    list.innerHTML = "";

    if (filteredScripts.length === 0) {
        empty.hidden = false;

        if (scripts.length > 0 && search) {
            empty.textContent =
                "AUCUN SCRIPT NE CORRESPOND À LA RECHERCHE.";
        } else {
            empty.textContent =
                "AUCUN SCRIPT ENREGISTRÉ.";
        }

        return;
    }

    empty.hidden = true;

    filteredScripts.forEach((script) => {
        list.appendChild(createScriptCard(script));
    });
}


function createScriptCard(script) {
    const card = document.createElement("article");

    card.className = "script-card";

    const header = document.createElement("div");
    header.className = "script-card-header";

    const title = document.createElement("h2");
    title.className = "script-card-title";
    title.textContent = script.titre || "SCRIPT SANS TITRE";

    header.appendChild(title);

    if (isAdmin()) {
        const actions = document.createElement("div");
        actions.className = "script-card-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "script-action-button";
        editButton.textContent = "MODIFIER";
        editButton.addEventListener("click", () => {
            openScriptModal(script);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className =
            "script-action-button delete";
        deleteButton.textContent = "SUPPRIMER";
        deleteButton.addEventListener("click", () => {
            deleteScript(script.id);
        });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        header.appendChild(actions);
    }

    const meta = document.createElement("div");
    meta.className = "script-card-meta";

    const author = createMetaItem(
        "RÉDACTEUR",
        script.redacteur || "NON RENSEIGNÉ"
    );

    const date = createMetaItem(
        "CRÉÉ LE",
        formatDate(script.created_at)
    );

    meta.appendChild(author);
    meta.appendChild(date);

    if (
        script.updated_at &&
        script.created_at &&
        new Date(script.updated_at).getTime() !==
        new Date(script.created_at).getTime()
    ) {
        const updated = createMetaItem(
            "MODIFIÉ LE",
            formatDate(script.updated_at)
        );

        meta.appendChild(updated);
    }

    const content = document.createElement("div");
    content.className = "script-card-content";
    content.textContent =
        script.contenu || "AUCUN CONTENU.";

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(content);

    return card;
}


function createMetaItem(label, value) {
    const item = document.createElement("div");
    item.className = "script-meta-item";

    const labelElement = document.createElement("span");
    labelElement.className = "script-meta-label";
    labelElement.textContent = `${label} :`;

    const valueElement = document.createElement("span");
    valueElement.className = "script-meta-value";
    valueElement.textContent = value;

    item.appendChild(labelElement);
    item.appendChild(valueElement);

    return item;
}


/* =========================================================
   RECHERCHE
   ========================================================= */

function setupSearch() {
    const input = document.getElementById(
        "scripts-search"
    );

    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        renderScripts();
    });
}


function setupClearSearch() {
    const clearButton = document.getElementById(
        "clear-search"
    );

    const input = document.getElementById(
        "scripts-search"
    );

    if (!clearButton || !input) {
        return;
    }

    clearButton.addEventListener("click", () => {
        input.value = "";
        input.focus();
        renderScripts();
    });
}


/* =========================================================
   CRÉATION / MODIFICATION
   ========================================================= */

function setupCreateButton() {
    const button = document.getElementById(
        "create-script-button"
    );

    if (!button) {
        return;
    }

    button.addEventListener("click", () => {
        if (!isAdmin()) {
            return;
        }

        openScriptModal();
    });
}


function openScriptModal(script = null) {
    if (!isAdmin()) {
        return;
    }

    editingScriptId = script
        ? script.id
        : null;

    const existingModal = document.querySelector(
        ".script-modal-overlay"
    );

    if (existingModal) {
        existingModal.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "script-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "script-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "script-modal-header";

    const modalTitle = document.createElement("div");
    modalTitle.className = "script-modal-title";
    modalTitle.textContent = script
        ? "// MODIFICATION D'UN SCRIPT"
        : "// CRÉATION D'UN SCRIPT";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "script-modal-close";
    closeButton.textContent = "×";
    closeButton.setAttribute(
        "aria-label",
        "Fermer"
    );

    header.appendChild(modalTitle);
    header.appendChild(closeButton);

    const body = document.createElement("div");
    body.className = "script-modal-body";

    const form = document.createElement("form");
    form.className = "script-form";

    const titleGroup = createFormGroup(
        "TITRE",
        "script-title",
        "TITRE DU SCRIPT",
        "text",
        script ? script.titre : ""
    );

    const authorGroup = createFormGroup(
        "RÉDACTEUR",
        "script-author",
        "NOM DU RÉDACTEUR",
        "text",
        script ? script.redacteur : ""
    );

    const contentGroup = createFormGroup(
        "CONTENU",
        "script-content",
        "CONTENU DU SCRIPT...",
        "textarea",
        script ? script.contenu : ""
    );

    const actions = document.createElement("div");
    actions.className = "script-form-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "script-form-cancel";
    cancelButton.textContent = "ANNULER";

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "script-form-submit";
    submitButton.textContent = script
        ? "ENREGISTRER LES MODIFICATIONS"
        : "CRÉER LE SCRIPT";

    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);

    form.appendChild(titleGroup);
    form.appendChild(authorGroup);
    form.appendChild(contentGroup);
    form.appendChild(actions);

    body.appendChild(form);

    modal.appendChild(header);
    modal.appendChild(body);

    overlay.appendChild(modal);

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.remove();
        editingScriptId = null;
    };

    closeButton.addEventListener(
        "click",
        closeModal
    );

    cancelButton.addEventListener(
        "click",
        closeModal
    );

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        await saveScript(form, submitButton);
    });

    const titleInput = titleGroup.querySelector(
        "input"
    );

    if (titleInput) {
        setTimeout(() => {
            titleInput.focus();
        }, 0);
    }
}


function createFormGroup(
    labelText,
    id,
    placeholder,
    type,
    value
) {
    const group = document.createElement("div");
    group.className = "script-form-group";

    const label = document.createElement("label");
    label.className = "script-form-label";
    label.htmlFor = id;
    label.textContent = labelText;

    let input;

    if (type === "textarea") {
        input = document.createElement("textarea");
        input.className = "script-form-textarea";
    } else {
        input = document.createElement("input");
        input.className = "script-form-input";
        input.type = type;
    }

    input.id = id;
    input.name = id;
    input.placeholder = placeholder;
    input.value = value || "";
    input.required = true;

    group.appendChild(label);
    group.appendChild(input);

    return group;
}


/* =========================================================
   SAUVEGARDE
   ========================================================= */

async function saveScript(form, submitButton) {
    if (!isAdmin()) {
        return;
    }

    const titleInput = form.querySelector(
        "#script-title"
    );

    const authorInput = form.querySelector(
        "#script-author"
    );

    const contentInput = form.querySelector(
        "#script-content"
    );

    const titre = titleInput.value.trim();
    const redacteur = authorInput.value.trim();
    const contenu = contentInput.value.trim();

    if (!titre || !redacteur || !contenu) {
        showError(
            "TOUS LES CHAMPS SONT OBLIGATOIRES."
        );

        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = editingScriptId
        ? "ENREGISTREMENT..."
        : "CRÉATION...";

    hideError();

    try {
        if (editingScriptId) {
            await updateScript(
                editingScriptId,
                titre,
                redacteur,
                contenu
            );
        } else {
            await createScript(
                titre,
                redacteur,
                contenu
            );
        }

        const modal = document.querySelector(
            ".script-modal-overlay"
        );

        if (modal) {
            modal.remove();
        }

        editingScriptId = null;

        await loadScripts();

    } catch (error) {
        console.error(
            "Erreur sauvegarde script :",
            error
        );

        showError(
            error.message ||
            "IMPOSSIBLE D'ENREGISTRER LE SCRIPT."
        );

        submitButton.disabled = false;
        submitButton.textContent = editingScriptId
            ? "ENREGISTRER LES MODIFICATIONS"
            : "CRÉER LE SCRIPT";
    }
}


/* =========================================================
   CRÉER
   ========================================================= */

async function createScript(
    titre,
    redacteur,
    contenu
) {
    const {
        error
    } = await supabaseClient
        .from("scripts")
        .insert({
            titre,
            redacteur,
            contenu
        });

    if (error) {
        throw error;
    }
}


/* =========================================================
   MODIFIER
   ========================================================= */

async function updateScript(
    id,
    titre,
    redacteur,
    contenu
) {
    const {
        error
    } = await supabaseClient
        .from("scripts")
        .update({
            titre,
            redacteur,
            contenu,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        throw error;
    }
}


/* =========================================================
   SUPPRIMER
   ========================================================= */

async function deleteScript(id) {
    if (!isAdmin()) {
        return;
    }

    const script = scripts.find(
        (item) => item.id === id
    );

    if (!script) {
        return;
    }

    const confirmed = window.confirm(
        `SUPPRIMER LE SCRIPT "${script.titre}" ?\n\nCette action est définitive.`
    );

    if (!confirmed) {
        return;
    }

    hideError();

    const {
        error
    } = await supabaseClient
        .from("scripts")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(
            "Erreur suppression script :",
            error
        );

        showError(
            "IMPOSSIBLE DE SUPPRIMER LE SCRIPT."
        );

        return;
    }

    await loadScripts();
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateValue) {
    if (!dateValue) {
        return "DATE INCONNUE";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "DATE INVALIDE";
    }

    return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/* =========================================================
   ERREURS
   ========================================================= */

function showError(message) {
    hideError();

    const main = document.querySelector(
        ".scripts-main"
    );

    if (!main) {
        return;
    }

    const errorElement =
        document.createElement("div");

    errorElement.className = "scripts-error";
    errorElement.textContent = message;

    const toolbar = document.querySelector(
        ".scripts-toolbar"
    );

    if (toolbar) {
        toolbar.insertAdjacentElement(
            "afterend",
            errorElement
        );
    } else {
        main.prepend(errorElement);
    }
}


function hideError() {
    document
        .querySelectorAll(".scripts-error")
        .forEach((element) => {
            element.remove();
        });
}


/* =========================================================
   CLAVIER
   ========================================================= */

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    const modal = document.querySelector(
        ".script-modal-overlay"
    );

    if (modal) {
        modal.remove();
        editingScriptId = null;
    }
});