
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

/* =========================================================
   ÉTAT DU MODULE
   ========================================================= */

const state = {
    user: null,
    profile: null,
    roles: [],
    isAdmin: false,
    canManage: false,
    accessSource: "readonly",
    rosters: [],
    members: [],
    filteredRosters: [],
    editingId: null,
    busy: false
};

const elements = {
    sessionName: document.getElementById("sessionName"),
    sessionRole: document.getElementById("sessionRole"),
    accessBadge: document.getElementById("accessBadge"),
    accessDescription: document.getElementById("accessDescription"),
    permissionNotice: document.getElementById("permissionNotice"),
    noticeTitle: document.getElementById("noticeTitle"),
    noticeMessage: document.getElementById("noticeMessage"),
    createButton: document.getElementById("createRosterButton"),
    searchInput: document.getElementById("searchInput"),
    rosterCount: document.getElementById("rosterCount"),
    rostersList: document.getElementById("rostersList"),
    modal: document.getElementById("rosterModal"),
    modalTitle: document.getElementById("rosterModalTitle"),
    form: document.getElementById("rosterForm"),
    editingId: document.getElementById("editingRosterId"),
    name: document.getElementById("rosterName"),
    department: document.getElementById("rosterDepartment"),
    leader: document.getElementById("rosterLeader"),
    description: document.getElementById("rosterDescription"),
    status: document.getElementById("rosterStatus"),
    memberIG: document.getElementById("memberIG"),
    memberDiscord: document.getElementById("memberDiscord"),
    membersList: document.getElementById("membersList"),
    memberCount: document.getElementById("memberCount"),
    toast: document.getElementById("toast"),
    saveButton: document.getElementById("saveRosterButton"),
    addMemberButton: document.getElementById("addMemberButton")
};

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", initializeRosterModule);

async function initializeRosterModule() {
    bindEvents();

    try {
        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData.session;

        if (!session) {
            redirectToLogin();
            return;
        }

        const {
            data: userData,
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            redirectToLogin();
            return;
        }

        state.user = userData.user;

        await loadAuthorizedProfile();

        if (!state.profile) {
            denyAccess("Aucun profil personnel autorisé n'a été trouvé.");
            return;
        }

        await loadUserPermissions();
        updateSessionInterface();
        await loadRosters();

    } catch (error) {
        console.error("[ROSTER] Initialisation impossible :", error);

        denyAccess(
            "Impossible de vérifier votre session ou vos autorisations. " +
            "Veuillez réessayer ou contacter un administrateur."
        );
    }
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

function bindEvents() {
    elements.createButton.addEventListener("click", openCreateRoster);

    elements.searchInput.addEventListener("input", filterRosters);

    elements.form.addEventListener("submit", saveRoster);

    elements.addMemberButton.addEventListener("click", addMember);

    document.getElementById("closeRosterModal")
        .addEventListener("click", closeRosterModal);

    document.getElementById("cancelRosterButton")
        .addEventListener("click", closeRosterModal);

    elements.modal.addEventListener("click", event => {
        if (event.target.hasAttribute("data-close-modal")) {
            closeRosterModal();
        }
    });

    elements.memberIG.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            addMember();
        }
    });

    elements.memberDiscord.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            addMember();
        }
    });

    elements.membersList.addEventListener("click", event => {
        const button = event.target.closest("[data-remove-member]");

        if (!button) {
            return;
        }

        removeMember(Number(button.dataset.removeMember));
    });

    elements.rostersList.addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-roster]");
        const deleteButton = event.target.closest("[data-delete-roster]");

        if (editButton) {
            editRoster(editButton.dataset.editRoster);
        }

        if (deleteButton) {
            deleteRoster(deleteButton.dataset.deleteRoster);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !elements.modal.classList.contains("hidden")) {
            closeRosterModal();
        }
    });
}

/* =========================================================
   PROFIL AUTORISÉ
   ========================================================= */

async function loadAuthorizedProfile() {
    const {
        data,
        error
    } = await supabaseClient
        .from("rp_member_profiles")
        .select("user_id, display_name, department, status")
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data || data.status !== "authorized") {
        state.profile = null;
        return;
    }

    state.profile = data;
}

/* =========================================================
   CHARGEMENT DES PERMISSIONS
   ========================================================= */

async function loadUserPermissions() {
    const userId = state.user.id;
    const { data: assignments, error: assignmentError } = await supabaseClient
        .from("rp_member_role_assignments")
        .select("role_code, department_code")
        .eq("user_id", userId);
    if (assignmentError) throw assignmentError;
    state.roles = assignments || [];
    const { data: legacyRole, error: legacyRoleError } = await supabaseClient.rpc("current_staff_role");
    state.isAdmin = !legacyRoleError && normalizeRole(legacyRole) === "ADMINISTRATEUR";
    const { data: canWrite, error: permissionError } = await supabaseClient.rpc("has_staff_module_permission", {
        p_module_code: "roster",
        p_action: "write"
    });
    if (permissionError) throw permissionError;
    state.canManage = canWrite === true;
    state.accessSource = state.canManage ? "staff-module" : "readonly";
}

function normalizeRole(value) {
    if (Array.isArray(value)) {
        value = value[0];
    }

    return String(value || "")
        .trim()
        .toUpperCase();
}

/* =========================================================
   INTERFACE DE SESSION
   ========================================================= */

function updateSessionInterface() {
    const name =
        state.profile.display_name ||
        state.user.email ||
        "Membre autorisé";

    elements.sessionName.textContent = name;

    const roleNames = state.roles
        .map(role => role.role_code)
        .filter(Boolean);

    elements.sessionRole.textContent = roleNames.length
        ? roleNames.join(" / ")
        : "Membre autorisé";

    elements.createButton.hidden = !state.canManage;

    if (state.isAdmin) {
        setAccessBadge(
            "ADMINISTRATEUR",
            "manage",
            "Gestion complète du module"
        );
    } else if (state.accessSource === "exception") {
        setAccessBadge(
            "DÉROGATION ACTIVE",
            "manage",
            "Gestion individuelle autorisée"
        );
    } else if (state.accessSource === "inherited") {
        setAccessBadge(
            "GESTION AUTORISÉE",
            "manage",
            "Permission héritée du rôle"
        );
    } else {
        setAccessBadge(
            "LECTURE SEULE",
            "readonly",
            "Consultation des effectifs uniquement"
        );
    }
}

function setAccessBadge(label, className, description) {
    elements.accessBadge.textContent = label;
    elements.accessBadge.className = "access-badge " + className;
    elements.accessDescription.textContent = description;
}

function denyAccess(message) {
    elements.sessionName.textContent = "Accès refusé";
    elements.sessionRole.textContent = "Votre compte ne peut pas accéder à ce module.";

    elements.accessBadge.textContent = "NON AUTORISÉ";
    elements.accessBadge.className = "access-badge readonly";
    elements.accessDescription.textContent = "Accès bloqué";

    elements.rostersList.innerHTML = `
        <div class="error-state">
            <strong>ACCÈS AU MODULE REFUSÉ</strong>
            <p>${escapeHTML(message)}</p>
        </div>
    `;

    elements.createButton.hidden = true;
    showNotice("Accès refusé", message);
}

function redirectToLogin() {
    window.location.href = "../connexion.html";
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

let toastTimer = null;

function showToast(message, type = "success") {
    elements.toast.textContent = message;
    elements.toast.className = "toast visible";

    if (type === "error") {
        elements.toast.classList.add("error");
    }

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 3500);
}

function showNotice(title, message) {
    elements.permissionNotice.hidden = false;
    elements.noticeTitle.textContent = title;
    elements.noticeMessage.textContent = message;
}

/* =========================================================
   CHARGEMENT DES ROSTERS
   ========================================================= */

async function loadRosters() {
    elements.rostersList.innerHTML = `
        <div class="loading-state">
            <span class="loading-spinner"></span>
            <p>CHARGEMENT DU REGISTRE...</p>
        </div>
    `;

    const {
        data,
        error
    } = await supabaseClient
        .from("roster")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[ROSTER] Chargement impossible :", error);

        elements.rostersList.innerHTML = `
            <div class="error-state">
                <strong>IMPOSSIBLE DE CHARGER LES ROSTERS</strong>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

        return;
    }

    const rosters = data || [];

    const rosterResults = await Promise.all(
        rosters.map(async roster => {
            const {
                data: members,
                error: memberError
            } = await supabaseClient
                .from("roster_members")
                .select("*")
                .eq("roster_id", roster.id)
                .order("created_at", { ascending: true });

            if (memberError) {
                console.error(
                    "[ROSTER] Erreur de chargement des membres :",
                    memberError
                );

                return {
                    ...roster,
                    members: [],
                    memberLoadError: true
                };
            }

            return {
                ...roster,
                members: members || [],
                memberLoadError: false
            };
        })
    );

    state.rosters = rosterResults;
    state.filteredRosters = [...rosterResults];

    renderRosters();
}

/* =========================================================
   AFFICHAGE DES ROSTERS
   ========================================================= */

function renderRosters() {
    const rosters = state.filteredRosters;

    elements.rosterCount.textContent = rosters.length;

    if (!rosters.length) {
        elements.rostersList.innerHTML = `
            <div class="empty-state">
                <strong>AUCUN ROSTER TROUVÉ</strong>
                <p>Aucun résultat ne correspond à votre recherche.</p>
            </div>
        `;

        return;
    }

    elements.rostersList.innerHTML = rosters.map(roster => {
        const members = roster.members || [];

        const membersHTML = members.length
            ? members.map(member => `
                <div class="member-row">
                    <div class="member-identity">
                        <strong>${escapeHTML(member.pseudo_ig || "Non renseigné")}</strong>
                        <span>${escapeHTML(member.pseudo_discord || "Discord non renseigné")}</span>
                    </div>
                </div>
            `).join("")
            : `<p class="no-members">Aucun membre enregistré.</p>`;

        const status = String(roster.statut || "ACTIF").toUpperCase();
        const inactive = status === "INACTIF";

        const actions = state.canManage
            ? `
                <div class="roster-actions">
                    <button
                        type="button"
                        class="action-button"
                        data-edit-roster="${escapeHTML(roster.id)}">
                        MODIFIER
                    </button>
                    <button
                        type="button"
                        class="action-button delete"
                        data-delete-roster="${escapeHTML(roster.id)}">
                        SUPPRIMER
                    </button>
                </div>
            `
            : "";

        return `
            <article class="roster-card">
                <div class="roster-card-header">
                    <div>
                        <span class="roster-department">
                            ${escapeHTML(roster.departement || "DÉPARTEMENT NON RENSEIGNÉ")}
                        </span>
                        <h3>${escapeHTML(roster.nom || "ROSTER SANS NOM")}</h3>
                    </div>

                    <span class="roster-status ${inactive ? "inactive" : ""}">
                        ${escapeHTML(status)}
                    </span>
                </div>

                <p class="roster-description">
                    ${escapeHTML(roster.description || "Aucune description renseignée.")}
                </p>

                <div class="roster-meta">
                    <span>RESPONSABLE : <strong>${escapeHTML(roster.responsable || "Non renseigné")}</strong></span>
                    <span>EFFECTIF : <strong>${members.length}</strong></span>
                </div>

                <div class="members-heading">
                    <span>COMPOSITION DU ROSTER</span>
                    <span>${members.length} MEMBRE(S)</span>
                </div>

                <div class="roster-members">
                    ${membersHTML}
                </div>

                ${roster.memberLoadError
                    ? `<p class="no-members">Une erreur est survenue pendant le chargement des membres.</p>`
                    : ""}

                ${actions}
            </article>
        `;
    }).join("");
}

/* =========================================================
   RECHERCHE
   ========================================================= */

function filterRosters() {
    const query = elements.searchInput.value
        .trim()
        .toLocaleLowerCase("fr");

    if (!query) {
        state.filteredRosters = [...state.rosters];
        renderRosters();
        return;
    }

    state.filteredRosters = state.rosters.filter(roster => {
        const mainFields = [
            roster.nom,
            roster.departement,
            roster.responsable,
            roster.description,
            roster.statut
        ];

        const mainMatch = mainFields.some(value =>
            String(value || "")
                .toLocaleLowerCase("fr")
                .includes(query)
        );

        const memberMatch = (roster.members || []).some(member =>
            [
                member.pseudo_ig,
                member.pseudo_discord
            ].some(value =>
                String(value || "")
                    .toLocaleLowerCase("fr")
                    .includes(query)
            )
        );

        return mainMatch || memberMatch;
    });

    renderRosters();
}

/* =========================================================
   OUVERTURE DU FORMULAIRE
   ========================================================= */

function openCreateRoster() {
    if (!state.canManage) {
        showToast("Vous ne disposez pas des droits de gestion.", "error");
        return;
    }

    state.editingId = null;
    state.members = [];

    elements.form.reset();
    elements.editingId.value = "";
    elements.modalTitle.textContent = "CRÉER UN ROSTER";
    elements.saveButton.textContent = "ENREGISTRER";

    renderEditorMembers();
    openRosterModal();
}

function openRosterModal() {
    elements.modal.classList.remove("hidden");
    elements.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    setTimeout(() => elements.name.focus(), 50);
}

function closeRosterModal() {
    elements.modal.classList.add("hidden");
    elements.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/* =========================================================
   GESTION DES MEMBRES DANS LE FORMULAIRE
   ========================================================= */

function addMember() {
    if (!state.canManage) {
        return;
    }

    const pseudoIG = elements.memberIG.value.trim();
    const pseudoDiscord = elements.memberDiscord.value.trim();

    if (!pseudoIG && !pseudoDiscord) {
        showToast("Renseignez au moins un pseudo.", "error");
        return;
    }

    const duplicate = state.members.some(member =>
        member.pseudo_ig.toLowerCase() === pseudoIG.toLowerCase() &&
        member.pseudo_discord.toLowerCase() === pseudoDiscord.toLowerCase()
    );

    if (duplicate) {
        showToast("Ce membre est déjà présent dans le roster.", "error");
        return;
    }

    state.members.push({
        pseudo_ig: pseudoIG,
        pseudo_discord: pseudoDiscord
    });

    elements.memberIG.value = "";
    elements.memberDiscord.value = "";

    renderEditorMembers();
    elements.memberIG.focus();
}

function removeMember(index) {
    if (!state.canManage) {
        return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= state.members.length) {
        return;
    }

    state.members.splice(index, 1);
    renderEditorMembers();
}

function renderEditorMembers() {
    elements.memberCount.textContent =
        `${state.members.length} MEMBRE(S)`;

    if (!state.members.length) {
        elements.membersList.innerHTML = `
            <p class="empty-members">Aucun membre ajouté.</p>
        `;

        return;
    }

    elements.membersList.innerHTML = state.members.map((member, index) => `
        <div class="editor-member">
            <div>
                <strong>${escapeHTML(member.pseudo_ig || "Pseudo IG non renseigné")}</strong>
                <span>${escapeHTML(member.pseudo_discord || "Discord non renseigné")}</span>
            </div>
            <button
                type="button"
                class="remove-member"
                data-remove-member="${index}">
                RETIRER
            </button>
        </div>
    `).join("");
}

/* =========================================================
   MODIFICATION D'UN ROSTER
   ========================================================= */

async function editRoster(id) {
    if (!state.canManage) {
        showToast("Vous ne disposez pas des droits de modification.", "error");
        return;
    }

    const roster = state.rosters.find(item =>
        String(item.id) === String(id)
    );

    if (!roster) {
        showToast("Roster introuvable.", "error");
        return;
    }

    state.editingId = roster.id;
    state.members = (roster.members || []).map(member => ({
        pseudo_ig: member.pseudo_ig || "",
        pseudo_discord: member.pseudo_discord || ""
    }));

    elements.editingId.value = roster.id;
    elements.name.value = roster.nom || "";
    elements.department.value = roster.departement || "";
    elements.leader.value = roster.responsable || "";
    elements.description.value = roster.description || "";
    elements.status.value = roster.statut || "ACTIF";

    elements.modalTitle.textContent = "MODIFIER LE ROSTER";
    elements.saveButton.textContent = "ENREGISTRER LES MODIFICATIONS";

    renderEditorMembers();
    openRosterModal();
}

/* =========================================================
   CRÉATION / MODIFICATION
   ========================================================= */

async function saveRoster(event) {
    event.preventDefault();

    if (!state.canManage || state.busy) {
        showToast("Vous ne disposez pas des droits nécessaires.", "error");
        return;
    }

    const rosterData = {
        nom: elements.name.value.trim(),
        departement: elements.department.value.trim(),
        responsable: elements.leader.value.trim(),
        description: elements.description.value.trim(),
        statut: elements.status.value
    };

    if (!rosterData.nom || !rosterData.departement) {
        showToast("Le nom et le département sont obligatoires.", "error");
        return;
    }

    state.busy = true;
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = "ENREGISTREMENT...";

    try {
        let rosterId = state.editingId;

        if (rosterId) {
            const {
                error: updateError
            } = await supabaseClient
                .from("roster")
                .update(rosterData)
                .eq("id", rosterId);

            if (updateError) {
                throw updateError;
            }

            /*
               Les anciens membres sont remplacés uniquement
               après validation de la mise à jour du roster.
            */

            const {
                error: deleteMembersError
            } = await supabaseClient
                .from("roster_members")
                .delete()
                .eq("roster_id", rosterId);

            if (deleteMembersError) {
                throw deleteMembersError;
            }

        } else {
            const {
                data,
                error: insertError
            } = await supabaseClient
                .from("roster")
                .insert(rosterData)
                .select("id")
                .single();

            if (insertError) {
                throw insertError;
            }

            rosterId = data.id;
        }

        if (state.members.length > 0) {
            const memberRows = state.members.map(member => ({
                roster_id: rosterId,
                pseudo_ig: member.pseudo_ig,
                pseudo_discord: member.pseudo_discord
            }));

            const {
                error: membersError
            } = await supabaseClient
                .from("roster_members")
                .insert(memberRows);

            if (membersError) {
                throw membersError;
            }
        }

        closeRosterModal();

        showToast(
            state.editingId
                ? "Le roster a été modifié."
                : "Le roster a été créé."
        );

        await loadRosters();

    } catch (error) {
        console.error("[ROSTER] Enregistrement impossible :", error);

        showToast(
            "Enregistrement impossible : " + (error.message || "erreur inconnue"),
            "error"
        );

    } finally {
        state.busy = false;
        elements.saveButton.disabled = false;
        elements.saveButton.textContent = "ENREGISTRER";
    }
}

/* =========================================================
   SUPPRESSION
   ========================================================= */

async function deleteRoster(id) {
    if (!state.canManage || state.busy) {
        showToast("Vous ne disposez pas des droits de suppression.", "error");
        return;
    }

    const roster = state.rosters.find(item =>
        String(item.id) === String(id)
    );

    if (!roster) {
        showToast("Roster introuvable.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Confirmer la suppression du roster "${roster.nom}" ?\n\n` +
        "Cette opération supprimera également les membres associés."
    );

    if (!confirmed) {
        return;
    }

    state.busy = true;

    try {
        const {
            error: membersError
        } = await supabaseClient
            .from("roster_members")
            .delete()
            .eq("roster_id", id);

        if (membersError) {
            throw membersError;
        }

        const {
            error: rosterError
        } = await supabaseClient
            .from("roster")
            .delete()
            .eq("id", id);

        if (rosterError) {
            throw rosterError;
        }

        showToast("Le roster a été supprimé.");
        await loadRosters();

    } catch (error) {
        console.error("[ROSTER] Suppression impossible :", error);

        showToast(
            "Suppression impossible : " + (error.message || "erreur inconnue"),
            "error"
        );

    } finally {
        state.busy = false;
    }
}

/* =========================================================
   OUTILS
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}
