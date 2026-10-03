const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentRole = null;
let allSanctions = [];

/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await checkStaffRole();
});

/* =========================================================
   AUTHENTIFICATION / RÔLE
========================================================= */

async function checkStaffRole() {
    try {
        let { data: sessionData } = await supabaseClient.auth.getSession();

        if (!sessionData.session) {
            const { error } = await supabaseClient.auth.signInAnonymously();

            if (error) {
                console.error("Erreur authentification :", error);
                redirectToStaff();
                return;
            }

            sessionData = await supabaseClient.auth.getSession();
        }

        const { data, error } = await supabaseClient.rpc(
            "current_staff_role"
        );

        if (error) {
            console.error("Erreur récupération rôle :", error);
            redirectToStaff();
            return;
        }

        currentRole = data;

        const allowedRoles = [
            "MODÉRATION",
            "MANAGER MOD",
            "MANAGER ANIM",
            "ADMINISTRATEUR"
        ];

        if (!currentRole || !allowedRoles.includes(currentRole)) {
            redirectToStaff();
            return;
        }

        updateAccessInterface();
        await loadSanctions();

    } catch (error) {
        console.error("Erreur :", error);
        redirectToStaff();
    }
}

function redirectToStaff() {
    window.location.href = "../../zone staff.html";
}

/* =========================================================
   INTERFACE D'ACCÈS
========================================================= */

function updateAccessInterface() {
    const accessStatus = document.getElementById("accessStatus");
    const createButton = document.getElementById("createSanctionButton");

    if (!accessStatus) {
        return;
    }

    if (currentRole === "ADMINISTRATEUR") {
        accessStatus.textContent =
            "ACCÈS ADMINISTRATEUR // GESTION AUTORISÉE";

        if (createButton) {
            createButton.classList.remove("hidden");
        }

        return;
    }

    accessStatus.textContent =
        `ACCÈS ${currentRole} // CONSULTATION UNIQUEMENT`;

    if (createButton) {
        createButton.classList.add("hidden");
    }
}

/* =========================================================
   CHARGEMENT DES SANCTIONS
========================================================= */

async function loadSanctions() {
    const sanctionsList = document.getElementById("sanctionsList");
    const emptyState = document.getElementById("sanctionsEmpty");
    const errorState = document.getElementById("sanctionsError");

    if (sanctionsList) {
        sanctionsList.innerHTML = `
            <div class="sanctions-loading">
                <span class="sanctions-loading-line"></span>
                CHARGEMENT DU REGISTRE...
            </div>
        `;
    }

    if (emptyState) {
        emptyState.classList.add("hidden");
    }

    if (errorState) {
        errorState.classList.add("hidden");
    }

    const { data, error } = await supabaseClient
        .from("sanctions")
        .select("*")
        .order("date_sanction", {
            ascending: false
        });

    if (error) {
        console.error("Erreur chargement sanctions :", error);

        if (sanctionsList) {
            sanctionsList.innerHTML = "";
        }

        if (errorState) {
            errorState.classList.remove("hidden");

            const errorMessage =
                document.getElementById("sanctionsErrorMessage");

            if (errorMessage) {
                errorMessage.textContent =
                    "Impossible de récupérer le registre disciplinaire.";
            }
        }

        updateSanctionCount(0);
        return;
    }

    allSanctions = data || [];

    displaySanctions(allSanctions);
}

/* =========================================================
   AFFICHAGE
========================================================= */

function displaySanctions(sanctions) {
    const sanctionsList = document.getElementById("sanctionsList");
    const emptyState = document.getElementById("sanctionsEmpty");

    if (!sanctionsList) {
        return;
    }

    updateSanctionCount(sanctions.length);

    if (!sanctions.length) {
        sanctionsList.innerHTML = "";

        if (emptyState) {
            emptyState.classList.remove("hidden");
        }

        return;
    }

    if (emptyState) {
        emptyState.classList.add("hidden");
    }

    sanctionsList.innerHTML = sanctions
        .map((sanction) => createSanctionCard(sanction))
        .join("");
}

function createSanctionCard(sanction) {
    const date = sanction.date_sanction
        ? formatDate(sanction.date_sanction)
        : "DATE INCONNUE";

    const pseudoIG = escapeHTML(
        sanction.pseudo_ig || "NON RENSEIGNÉ"
    );

    const pseudoDiscord = escapeHTML(
        sanction.pseudo_discord || "NON RENSEIGNÉ"
    );

    const type = escapeHTML(
        sanction.type || "NON RENSEIGNÉ"
    );

    const motif = escapeHTML(
        sanction.motif || "Aucun motif renseigné."
    );

    const duree = escapeHTML(
        sanction.duree || "NON RENSEIGNÉE"
    );

    const staff = escapeHTML(
        sanction.staff || "NON RENSEIGNÉ"
    );

    const notes = escapeHTML(
        sanction.notes || "Aucune note."
    );

    const adminActions =
        currentRole === "ADMINISTRATEUR"
            ? `
                <div class="sanction-card-actions">

                    <button
                        type="button"
                        onclick="editSanction(${sanction.id})"
                    >
                        MODIFIER
                    </button>

                    <button
                        type="button"
                        class="delete-button"
                        onclick="deleteSanction(${sanction.id})"
                    >
                        SUPPRIMER
                    </button>

                </div>
            `
            : "";

    return `
        <article class="sanction-card">

            <div class="sanction-card-header">

                <div class="sanction-card-type">
                    ${type}
                </div>

                <div class="sanction-card-date">
                    ${date}
                </div>

            </div>

            <div class="sanction-card-body">

                <div class="sanction-card-field">

                    <span class="sanction-card-label">
                        PSEUDO IG
                    </span>

                    <div class="sanction-card-value important">
                        ${pseudoIG}
                    </div>

                </div>

                <div class="sanction-card-field">

                    <span class="sanction-card-label">
                        PSEUDO DISCORD
                    </span>

                    <div class="sanction-card-value">
                        ${pseudoDiscord}
                    </div>

                </div>

                <div class="sanction-card-field">

                    <span class="sanction-card-label">
                        MOTIF
                    </span>

                    <div class="sanction-card-motif">
                        ${motif}
                    </div>

                </div>

                <div class="sanction-card-field">

                    <span class="sanction-card-label">
                        DURÉE
                    </span>

                    <div class="sanction-card-value">
                        ${duree}
                    </div>

                </div>

                <div class="sanction-card-field">

                    <span class="sanction-card-label">
                        NOTES
                    </span>

                    <div class="sanction-card-notes">
                        ${notes}
                    </div>

                </div>

            </div>

            <div class="sanction-card-footer">

                <div class="sanction-card-staff">
                    RÉDACTEUR // ${staff}
                </div>

                ${adminActions}

            </div>

        </article>
    `;
}

/* =========================================================
   RECHERCHE
========================================================= */

function searchSanctions() {
    const input = document.getElementById("searchInput");

    if (!input) {
        return;
    }

    const query = input.value
        .trim()
        .toLowerCase();

    if (!query) {
        displaySanctions(allSanctions);
        return;
    }

    const filteredSanctions = allSanctions.filter((sanction) => {

        const pseudoIG = String(
            sanction.pseudo_ig || ""
        ).toLowerCase();

        const pseudoDiscord = String(
            sanction.pseudo_discord || ""
        ).toLowerCase();

        const type = String(
            sanction.type || ""
        ).toLowerCase();

        const motif = String(
            sanction.motif || ""
        ).toLowerCase();

        const staff = String(
            sanction.staff || ""
        ).toLowerCase();

        const duree = String(
            sanction.duree || ""
        ).toLowerCase();

        const notes = String(
            sanction.notes || ""
        ).toLowerCase();

        return (
            pseudoDiscord.includes(query) ||
            pseudoIG.includes(query) ||
            type.includes(query) ||
            motif.includes(query) ||
            staff.includes(query) ||
            duree.includes(query) ||
            notes.includes(query)
        );
    });

    displaySanctions(filteredSanctions);
}

function clearSanctionSearch() {
    const input = document.getElementById("searchInput");

    if (!input) {
        return;
    }

    input.value = "";
    displaySanctions(allSanctions);
    input.focus();
}

/* =========================================================
   CRÉATION
========================================================= */

function openCreateSanction() {
    if (currentRole !== "ADMINISTRATEUR") {
        return;
    }

    const modal = document.getElementById("sanctionModal");
    const form = document.getElementById("sanctionForm");
    const modalTitle = document.getElementById("sanctionModalTitle");

    if (!modal || !form) {
        return;
    }

    form.reset();

    const sanctionId = document.getElementById("sanctionId");

    if (sanctionId) {
        sanctionId.value = "";
    }

    if (modalTitle) {
        modalTitle.textContent = "NOUVELLE SANCTION";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    const pseudoIG = document.getElementById("pseudoIG");

    if (pseudoIG) {
        setTimeout(() => {
            pseudoIG.focus();
        }, 50);
    }
}

/* =========================================================
   MODIFICATION
========================================================= */

function editSanction(id) {
    if (currentRole !== "ADMINISTRATEUR") {
        return;
    }

    const sanction = allSanctions.find(
        (item) => Number(item.id) === Number(id)
    );

    if (!sanction) {
        return;
    }

    const modal = document.getElementById("sanctionModal");
    const modalTitle = document.getElementById("sanctionModalTitle");

    if (!modal) {
        return;
    }

    document.getElementById("sanctionId").value =
        sanction.id || "";

    document.getElementById("pseudoIG").value =
        sanction.pseudo_ig || "";

    document.getElementById("pseudoDiscord").value =
        sanction.pseudo_discord || "";

    document.getElementById("sanctionType").value =
        sanction.type || "";

    document.getElementById("sanctionMotif").value =
        sanction.motif || "";

    document.getElementById("sanctionDuree").value =
        sanction.duree || "";

    document.getElementById("sanctionStaff").value =
        sanction.staff || "";

    document.getElementById("sanctionNotes").value =
        sanction.notes || "";

    if (modalTitle) {
        modalTitle.textContent = "MODIFIER LA SANCTION";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
}

/* =========================================================
   ENREGISTREMENT
========================================================= */

async function saveSanction(event) {
    event.preventDefault();

    if (currentRole !== "ADMINISTRATEUR") {
        return;
    }

    const id = document.getElementById("sanctionId").value.trim();

    const sanctionData = {
        pseudo_ig: document.getElementById("pseudoIG").value.trim(),
        pseudo_discord: document.getElementById("pseudoDiscord").value.trim(),
        type: document.getElementById("sanctionType").value.trim(),
        motif: document.getElementById("sanctionMotif").value.trim(),
        duree: document.getElementById("sanctionDuree").value.trim(),
        staff: document.getElementById("sanctionStaff").value.trim(),
        notes: document.getElementById("sanctionNotes").value.trim()
    };

    if (
        !sanctionData.pseudo_ig ||
        !sanctionData.pseudo_discord ||
        !sanctionData.type ||
        !sanctionData.motif ||
        !sanctionData.staff
    ) {
        alert("Veuillez remplir tous les champs obligatoires.");
        return;
    }

    const saveButton = document.querySelector(
        ".sanction-save-button"
    );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "ENREGISTREMENT...";
    }

    try {
        let error = null;

        if (id) {
            const result = await supabaseClient
                .from("sanctions")
                .update(sanctionData)
                .eq("id", id);

            error = result.error;

        } else {
            const result = await supabaseClient
                .from("sanctions")
                .insert([sanctionData]);

            error = result.error;
        }

        if (error) {
            console.error("Erreur sauvegarde :", error);

            alert(
                "Impossible d'enregistrer la sanction."
            );

            return;
        }

        closeSanctionModal();
        await loadSanctions();

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "ENREGISTRER";
        }
    }
}

/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteSanction(id) {
    if (currentRole !== "ADMINISTRATEUR") {
        return;
    }

    const sanction = allSanctions.find(
        (item) => Number(item.id) === Number(id)
    );

    if (!sanction) {
        return;
    }

    const confirmed = confirm(
        `Supprimer définitivement la sanction de "${sanction.pseudo_discord || sanction.pseudo_ig}" ?`
    );

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient
        .from("sanctions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erreur suppression :", error);

        alert(
            "Impossible de supprimer cette sanction."
        );

        return;
    }

    await loadSanctions();
}

/* =========================================================
   MODAL
========================================================= */

function closeSanctionModal() {
    const modal = document.getElementById("sanctionModal");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
}

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    const modal = document.getElementById("sanctionModal");

    if (modal && !modal.classList.contains("hidden")) {
        closeSanctionModal();
    }
});

/* =========================================================
   COMPTEUR
========================================================= */

function updateSanctionCount(count) {
    const counter = document.getElementById("sanctionsCount");

    if (counter) {
        counter.textContent = String(count);
    }
}

/* =========================================================
   DATE
========================================================= */

function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "DATE INVALIDE";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

/* =========================================================
   SÉCURITÉ HTML
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}