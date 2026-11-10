"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =========================================================
   ÉLÉMENTS
========================================================= */

const $ = id => document.getElementById(id);

const el = {
    connectionStatus: $("connectionStatus"),

    statMembers: $("statMembers"),
    statRoles: $("statRoles"),
    statPermissions: $("statPermissions"),
    statOverrides: $("statOverrides"),

    roleSelect: $("roleSelect"),
    roleSearch: $("roleSearch"),
    roleSummary: $("roleSummary"),
    roleName: $("roleName"),
    roleDescription: $("roleDescription"),
    rolePermissionList: $("rolePermissionList"),

    memberSelect: $("memberSelect"),
    memberSearch: $("memberSearch"),
    memberSummary: $("memberSummary"),
    memberAvatar: $("memberAvatar"),
    memberName: $("memberName"),
    memberDetails: $("memberDetails"),
    memberStatus: $("memberStatus"),
    individualPermissionList: $("individualPermissionList"),

    loadingOverlay: $("loadingOverlay"),
    loadingText: $("loadingText"),
    toast: $("toast")
};

/* =========================================================
   ÉTAT
========================================================= */

const state = {
    user: null,
    currentRole: null,

    modules: [],
    accounts: [],
    roles: [],
    roleDefinitions: [],

    rolePermissions: [],
    overrides: [],

    selectedRole: null,
    selectedMember: null,

    activeTab: "roles"
};

/* =========================================================
   UTILITAIRES
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function initials(value) {
    return String(value || "?")
        .trim()
        .split(/[@.\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || "")
        .join("") || "?";
}

function showLoading(message = "Chargement...") {
    el.loadingText.textContent = message;
    el.loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
    el.loadingOverlay.classList.add("hidden");
}

let toastTimer;

function showToast(message, type = "success") {
    clearTimeout(toastTimer);

    el.toast.textContent = message;
    el.toast.className = `toast ${type}`;

    toastTimer = setTimeout(() => {
        el.toast.classList.add("hidden");
    }, 4000);
}

function setConnectionStatus(message, connected = false) {
    el.connectionStatus.textContent = message;

    const dot = document.querySelector(".status-dot");

    if (dot) {
        dot.style.background = connected ? "#39a879" : "#a52c32";
    }
}

function handleError(error) {
    console.error("[ZONE-431 PERMISSIONS]", error);

    showToast(
        error?.message || "Une erreur est survenue.",
        "error"
    );
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

/* =========================================================
   AUTHENTIFICATION
========================================================= */

async function authenticate() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session?.user) {
        window.location.href = "../connexion.html";
        return false;
    }

    state.user = data.session.user;

    const { data: role, error: roleError } =
        await supabaseClient.rpc("current_staff_role");

    if (roleError) throw roleError;

    state.currentRole = role;

    const { data: canManage, error: permissionError } =
        await supabaseClient.rpc("has_staff_module_permission", {
            p_module_code: "permissions",
            p_action: "write"
        });
    if (permissionError) throw permissionError;
    if (canManage !== true) {
        document.body.innerHTML = `<main class="permissions-shell"><section class="panel"><h2>Accès refusé</h2><p>La permission STAFF « permissions.write » est nécessaire.</p></section></main>`;
        return false;
    }

    return true;
}

/* =========================================================
   CHARGEMENT DES MODULES
========================================================= */

async function loadModules() {
    const { data, error } = await supabaseClient
        .from("staff_module_catalog")
        .select("code, label, description, sort_order, is_system")
        .order("sort_order");

    if (error) throw error;

    state.modules = data || [];

    el.statPermissions.textContent = state.modules.length;
}

/* =========================================================
   CHARGEMENT DES COMPTES AUTH
========================================================= */

/*
 * La RPC admin_list_permission_accounts() renvoie :
 *
 * auth_user_id
 * email
 * role
 * staff_member_id
 * pseudo_discord
 * pseudo_ig
 * staff_active
 * account_created_at
 * last_sign_in_at
 *
 * L'e-mail sert de référence visible.
 * L'UUID reste la clé technique interne.
 */

async function loadAccounts() {
    const previousId = state.selectedMember?.auth_user_id || null;

    const { data, error } = await supabaseClient.rpc(
        "admin_list_permission_accounts"
    );

    if (error) throw error;

    state.accounts = (data || []).map(account => ({
        ...account,
        email: account.email || null,
        role: account.role || "MEMBRE"
    }));

    el.statMembers.textContent = state.accounts.length;

    renderMemberSelect();

    if (previousId) {
        const refreshedAccount = state.accounts.find(
            account => account.auth_user_id === previousId
        );

        if (refreshedAccount) {
            state.selectedMember = refreshedAccount;
            renderSelectedMember();
        } else {
            state.selectedMember = null;
            renderMemberSelect();
            renderEmptyIndividualState(
                "Le compte précédemment sélectionné n'est plus disponible."
            );
        }
    }
}

function getAccountLabel(account) {
    return account.email || "Compte sans adresse e-mail";
}

function renderMemberSelect() {
    const query = normalizeEmail(el.memberSearch.value);

    const filtered = state.accounts.filter(account => {
        const content = [
            account.email,
            account.pseudo_discord,
            account.pseudo_ig,
            account.role
        ].join(" ").toLowerCase();

        return content.includes(query);
    });

    el.memberSelect.innerHTML = `
        <option value="">Sélectionnez un compte</option>

        ${filtered.map(account => {
            const email = getAccountLabel(account);
            const role = account.role || "MEMBRE";

            return `
                <option value="${escapeHTML(account.auth_user_id)}">
                    ${escapeHTML(email)} — ${escapeHTML(role)}
                </option>
            `;
        }).join("")}
    `;

    if (state.selectedMember) {
        el.memberSelect.value = state.selectedMember.auth_user_id;
    }

    if (!filtered.length) {
        el.memberSelect.innerHTML = `
            <option value="">Aucun compte correspondant</option>
        `;
    }
}

/* =========================================================
   SÉLECTION DU COMPTE
========================================================= */

function selectMember(userId) {
    state.selectedMember = state.accounts.find(
        account => account.auth_user_id === userId
    ) || null;

    if (!state.selectedMember) {
        el.memberSummary.classList.add("hidden");

        renderEmptyIndividualState(
            "Sélectionnez un compte pour afficher ses permissions."
        );

        return;
    }

    renderSelectedMember();
    renderIndividualPermissions();
}

function renderSelectedMember() {
    const account = state.selectedMember;

    if (!account) return;

    el.memberSummary.classList.remove("hidden");

    el.memberAvatar.textContent = initials(
        account.email || account.pseudo_discord
    );

    el.memberName.textContent = getAccountLabel(account);

    const details = [
        account.pseudo_discord || "Discord non renseigné",
        account.pseudo_ig || "Roblox non renseigné",
        account.role || "MEMBRE"
    ];

    el.memberDetails.textContent = details.join(" • ");

    const isActive = account.staff_active === true;

    el.memberStatus.textContent = isActive
        ? "PERSONNEL ACTIF"
        : "COMPTE NON AFFECTÉ";

    el.memberStatus.classList.toggle("inactive", !isActive);

    renderRoleAssignment();
}


function renderRoleAssignment() {
    const account = state.selectedMember;
    const host = $("roleAssignment");
    if (!account || !host) return;
    host.innerHTML = `
        <div class="section-heading subsection-heading"><div><h3>Rôle STAFF</h3><p class="panel-description">Le rôle définit les permissions par défaut. Les dérogations individuelles restent prioritaires.</p></div></div>
        <div class="form-group"><label for="assignedStaffRole">Rôle à attribuer</label><select class="select" id="assignedStaffRole">
            ${state.roleDefinitions.map(role => `<option value="${escapeHTML(role.name)}" ${role.name === (account.role || "MEMBRE") ? "selected" : ""}>${escapeHTML(role.name)}</option>`).join("")}
        </select></div>
        ${account.staff_member_id ? "" : `
            <div class="form-group"><label for="staffDiscordPseudo">Pseudo Discord</label><input class="search-input" id="staffDiscordPseudo" maxlength="100" placeholder="Pseudo Discord"></div>
            <div class="form-group"><label for="staffRobloxPseudo">Pseudo Roblox</label><input class="search-input" id="staffRobloxPseudo" maxlength="100" placeholder="Pseudo Roblox"></div>
            <p class="form-note">Ce compte n'a pas encore de fiche STAFF. Ces deux informations sont nécessaires pour la créer.</p>
        `}
        <button class="button button-primary" id="saveStaffRole" type="button">Enregistrer le rôle</button>`;
    $("saveStaffRole").addEventListener("click", saveStaffRole);
}

async function saveStaffRole() {
    const account = state.selectedMember;
    if (!account) return;
    const role = $("assignedStaffRole")?.value;
    const discord = $("staffDiscordPseudo")?.value.trim() || null;
    const roblox = $("staffRobloxPseudo")?.value.trim() || null;
    if (!role) { showToast("Sélectionnez un rôle.", "error"); return; }
    showLoading("Mise à jour du rôle STAFF...");
    try {
        const { error } = await supabaseClient.rpc("admin_set_staff_member_role", {
            p_auth_user_id: account.auth_user_id,
            p_role_name: role,
            p_pseudo_discord: discord,
            p_pseudo_ig: roblox
        });
        if (error) throw error;
        await loadAccounts();
        state.selectedMember = state.accounts.find(item => item.auth_user_id === account.auth_user_id) || null;
        if (state.selectedMember) { renderSelectedMember(); renderIndividualPermissions(); }
        showToast("Rôle STAFF enregistré.");
    } catch (error) { handleError(error); }
    finally { hideLoading(); }
}

function renderEmptyIndividualState(message) {
    el.individualPermissionList.innerHTML = `
        <div class="empty-state">
            ${escapeHTML(message)}
        </div>
    `;
}

/* =========================================================
   CHARGEMENT DES RÔLES
========================================================= */

async function loadRoles() {
    const { data, error } = await supabaseClient
        .from("staff_roles")
        .select("name, description, active")
        .eq("active", true)
        .order("name");

    if (error) throw error;

    state.roleDefinitions = data || [];

    state.roles = state.roleDefinitions.map(role => role.name);

    el.statRoles.textContent = state.roles.length;

    renderRoleSelect();
}

async function loadRolePermissions() {
    const { data, error } = await supabaseClient
        .from("staff_role_module_permissions")
        .select("*")
        .order("role_name");

    if (error) throw error;

    state.rolePermissions = data || [];
}

async function loadOverrides() {
    const { data, error } = await supabaseClient
        .from("staff_member_module_overrides")
        .select("*");

    if (error) throw error;

    state.overrides = data || [];

    el.statOverrides.textContent = state.overrides.length;
}

/* =========================================================
   CHARGEMENT GLOBAL
========================================================= */

async function loadAllData() {
    showLoading("Chargement du centre de gestion...");

    try {
        await Promise.all([
            loadModules(),
            loadAccounts(),
            loadRoles(),
            loadRolePermissions(),
            loadOverrides()
        ]);

        setConnectionStatus("Connexion établie", true);

    } finally {
        hideLoading();
    }
}

/* =========================================================
   PERMISSIONS PAR RÔLE
========================================================= */

function renderRoleSelect() {
    const previousRole = state.selectedRole;

    el.roleSelect.innerHTML = `
        <option value="">Sélectionnez un rôle</option>

        ${state.roleDefinitions.map(role => `
            <option value="${escapeHTML(role.name)}">
                ${escapeHTML(role.name)}
            </option>
        `).join("")}
    `;

    if (previousRole && state.roles.includes(previousRole)) {
        el.roleSelect.value = previousRole;
    }
}

function getRoleDefinition(roleName) {
    return state.roleDefinitions.find(
        role => role.name === roleName
    ) || null;
}

function getRolePermission(roleName, moduleCode) {
    return state.rolePermissions.find(permission =>
        permission.role_name === roleName &&
        permission.module_code === moduleCode
    ) || null;
}

function renderRolePermissions() {
    const role = el.roleSelect.value;

    state.selectedRole = role || null;

    if (!role) {
        el.roleSummary.classList.add("hidden");

        el.rolePermissionList.innerHTML = `
            <div class="empty-state">
                Sélectionnez un rôle pour afficher ses autorisations.
            </div>
        `;

        return;
    }

    const definition = getRoleDefinition(role);

    el.roleSummary.classList.remove("hidden");
    el.roleName.textContent = role;

    el.roleDescription.textContent =
        definition?.description ||
        "Configuration générale des autorisations de ce rôle.";

    const query = el.roleSearch.value.trim().toLowerCase();

    const filtered = state.modules.filter(module =>
        [
            module.code,
            module.label,
            module.description
        ].join(" ").toLowerCase().includes(query)
    );

    el.rolePermissionList.innerHTML = "";

    filtered.forEach(module => {
        const permission = getRolePermission(role, module.code);

        const access = permission?.can_access === true;
        const write = permission?.can_write === true;

        const card = document.createElement("article");

        card.className = "module-card";
        card.dataset.module = module.code;

        card.innerHTML = `
            <div class="module-header">
                <div class="module-heading">
                    <strong>${escapeHTML(module.label)}</strong>
                    <small>${escapeHTML(module.description)}</small>
                </div>

                <span class="module-code">${escapeHTML(module.code)}</span>
            </div>

            <div class="permission-list">

                <div class="permission-row">
                    <div class="permission-label">
                        <strong>Accès au module</strong>
                        <small>Autorise la consultation du module.</small>
                    </div>

                    <div class="permission-actions">
                        <select class="select" data-field="access">
                            <option value="true" ${access ? "selected" : ""}>Oui</option>
                            <option value="false" ${!access ? "selected" : ""}>Non</option>
                        </select>
                    </div>
                </div>

                ${
                    module.code === "STAFF_ZONE"
                    ? `
                        <div class="permission-row">
                            <div class="permission-label">
                                <strong>Écriture</strong>
                                <small>Sans objet pour l'accès général.</small>
                            </div>

                            <span class="permission-state">NON APPLICABLE</span>
                        </div>
                    `
                    : `
                        <div class="permission-row">
                            <div class="permission-label">
                                <strong>Autorisation d'écriture</strong>
                                <small>
                                    Autorise les opérations de création et de modification.
                                </small>
                            </div>

                            <div class="permission-actions">
                                <select
                                    class="select"
                                    data-field="write"
                                    ${access ? "" : "disabled"}
                                >
                                    <option value="true" ${write ? "selected" : ""}>Oui</option>
                                    <option value="false" ${!write ? "selected" : ""}>Non</option>
                                </select>
                            </div>
                        </div>
                    `
                }

                <div class="permission-row">
                    <div class="permission-label">
                        <strong>Enregistrement</strong>
                        <small>
                            Enregistre les droits de ce module pour le rôle sélectionné.
                        </small>
                    </div>

                    <button class="button button-secondary" data-action="save">
                        Enregistrer
                    </button>
                </div>

            </div>
        `;

        el.rolePermissionList.appendChild(card);
    });

    if (!filtered.length) {
        el.rolePermissionList.innerHTML = `
            <div class="empty-state">
                Aucun module correspondant à cette recherche.
            </div>
        `;
    }
}

/* =========================================================
   ENREGISTREMENT DES RÔLES
========================================================= */

function collectRoleChange(card) {
    const moduleCode = card.dataset.module;

    const access =
        card.querySelector('[data-field="access"]')?.value === "true";

    const write = moduleCode === "STAFF_ZONE"
        ? false
        : access &&
          card.querySelector('[data-field="write"]')?.value === "true";

    return {
        role_name: state.selectedRole,
        module_code: moduleCode,
        can_access: access,
        can_write: write,
        updated_by: state.user.id,
        updated_at: new Date().toISOString()
    };
}

async function saveOneRolePermission(card) {
    if (!state.selectedRole) {
        showToast("Sélectionnez un rôle.", "error");
        return;
    }

    const payload = collectRoleChange(card);

    showLoading("Enregistrement de l'autorisation...");

    try {
        const { error } = await supabaseClient
            .from("staff_role_module_permissions")
            .upsert(payload, {
                onConflict: "role_name,module_code"
            });

        if (error) throw error;

        await loadRolePermissions();

        renderRolePermissions();

        showToast("Autorisation du rôle enregistrée.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

async function saveAllRolePermissions() {
    if (!state.selectedRole) {
        showToast("Sélectionnez un rôle.", "error");
        return;
    }

    const cards = [
        ...el.rolePermissionList.querySelectorAll("[data-module]")
    ];

    if (!cards.length) {
        showToast("Aucun module à enregistrer.", "error");
        return;
    }

    const payload = cards.map(collectRoleChange);

    showLoading("Enregistrement des permissions...");

    try {
        const { error } = await supabaseClient
            .from("staff_role_module_permissions")
            .upsert(payload, {
                onConflict: "role_name,module_code"
            });

        if (error) throw error;

        await loadRolePermissions();

        renderRolePermissions();

        showToast("Permissions du rôle enregistrées.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

/* =========================================================
   DÉROGATIONS INDIVIDUELLES
========================================================= */

/*
 * Cette interface utilise uniquement les dérogations globales.
 * Les colonnes department_code et service_code restent NULL.
 */

function findOverride(userId, moduleCode) {
    return state.overrides.find(item =>
        item.auth_user_id === userId &&
        item.module_code === moduleCode &&
        item.department_code === null &&
        item.service_code === null
    ) || null;
}

function getEffectiveIndividualPermission(module) {
    const account = state.selectedMember;

    if (!account) {
        return {
            can_access: false,
            can_write: false,
            source: "none",
            override: null
        };
    }

    const rolePermission = getRolePermission(
        account.role || "MEMBRE",
        module.code
    );

    const override = findOverride(
        account.auth_user_id,
        module.code
    );

    if (override) {
        return {
            can_access: override.can_access === true,
            can_write: override.can_write === true,
            source: "individual",
            override
        };
    }

    return {
        can_access: rolePermission?.can_access === true,
        can_write: rolePermission?.can_write === true,
        source: "role",
        override: null
    };
}

/* =========================================================
   AFFICHAGE DES PERMISSIONS INDIVIDUELLES
========================================================= */

function renderIndividualPermissions() {
    const account = state.selectedMember;

    if (!account) {
        renderEmptyIndividualState(
            "Sélectionnez un compte pour afficher ses permissions."
        );
        return;
    }

    el.individualPermissionList.innerHTML = "";

    state.modules.forEach(module => {
        const effective = getEffectiveIndividualPermission(module);

        const card = document.createElement("article");

        card.className = "module-card";
        card.dataset.module = module.code;

        const originLabel = effective.override
            ? "Dérogation individuelle"
            : "Droits hérités du rôle";

        const accessClass = effective.can_access
            ? "allowed"
            : "denied";

        const accessLabel = effective.can_access
            ? "AUTORISÉ"
            : "REFUSÉ";

        card.innerHTML = `
            <div class="module-header">
                <div class="module-heading">
                    <strong>${escapeHTML(module.label)}</strong>
                    <small>${escapeHTML(module.description)}</small>
                </div>

                <span class="module-code">${escapeHTML(module.code)}</span>
            </div>

            <div class="permission-list">

                <div class="permission-row">
                    <div class="permission-label">
                        <strong>Accès au module</strong>
                        <small>Autorise la consultation de ce module.</small>
                    </div>

                    <div class="permission-actions">
                        <select class="select" data-field="access">
                            <option value="true" ${effective.can_access ? "selected" : ""}>Oui</option>
                            <option value="false" ${!effective.can_access ? "selected" : ""}>Non</option>
                        </select>
                    </div>
                </div>

                ${
                    module.code === "STAFF_ZONE"
                    ? `
                        <div class="permission-row">
                            <div class="permission-label">
                                <strong>Écriture</strong>
                                <small>Sans objet pour l'accès général.</small>
                            </div>

                            <span class="permission-state">NON APPLICABLE</span>
                        </div>
                    `
                    : `
                        <div class="permission-row">
                            <div class="permission-label">
                                <strong>Autorisation d'écriture</strong>
                                <small>
                                    Autorise les opérations de création et de modification.
                                </small>
                            </div>

                            <div class="permission-actions">
                                <select
                                    class="select"
                                    data-field="write"
                                    ${effective.can_access ? "" : "disabled"}
                                >
                                    <option value="true" ${effective.can_write ? "selected" : ""}>Oui</option>
                                    <option value="false" ${!effective.can_write ? "selected" : ""}>Non</option>
                                </select>
                            </div>
                        </div>
                    `
                }

                <div class="permission-row">
                    <div class="permission-label">
                        <strong>État effectif</strong>
                        <small class="permission-origin">
                            ${escapeHTML(originLabel)}
                        </small>
                    </div>

                    <div class="permission-actions">
                        <span class="permission-state ${accessClass}">
                            ${accessLabel}
                        </span>

                        <button
                            class="button button-primary"
                            data-action="save"
                        >
                            Enregistrer
                        </button>

                        <button
                            class="button button-secondary"
                            data-action="reset"
                            ${effective.override ? "" : "disabled"}
                        >
                            Réinitialiser
                        </button>
                    </div>
                </div>

            </div>
        `;

        el.individualPermissionList.appendChild(card);
    });

    if (!state.modules.length) {
        renderEmptyIndividualState(
            "Aucun module n'est présent dans le catalogue."
        );
    }
}

/* =========================================================
   ENREGISTREMENT INDIVIDUEL
========================================================= */

async function saveIndividualPermission(card) {
    const account = state.selectedMember;

    if (!account) {
        showToast("Sélectionnez un compte.", "error");
        return;
    }

    const moduleCode = card.dataset.module;

    const canAccess =
        card.querySelector('[data-field="access"]')?.value === "true";

    const canWrite = moduleCode === "STAFF_ZONE"
        ? false
        : canAccess &&
          card.querySelector('[data-field="write"]')?.value === "true";

    const payload = {
        auth_user_id: account.auth_user_id,
        module_code: moduleCode,
        department_code: null,
        service_code: null,
        can_access: canAccess,
        can_write: canWrite,
        reason: "Modification depuis le centre de gestion STAFF.",
        updated_by: state.user.id,
        updated_at: new Date().toISOString()
    };

    showLoading("Enregistrement de la dérogation...");

    try {
        /*
         * La table ne possède pas de contrainte unique sur le couple
         * compte/module/portée. On met donc à jour les lignes globales
         * existantes ; on insère seulement si aucune n'existe.
         */

        const { data: updatedRows, error: updateError } =
            await supabaseClient
                .from("staff_member_module_overrides")
                .update({
                    can_access: payload.can_access,
                    can_write: payload.can_write,
                    reason: payload.reason,
                    updated_by: payload.updated_by,
                    updated_at: payload.updated_at
                })
                .eq("auth_user_id", account.auth_user_id)
                .eq("module_code", moduleCode)
                .is("department_code", null)
                .is("service_code", null)
                .select("id");

        if (updateError) throw updateError;

        if (!updatedRows || updatedRows.length === 0) {
            const { error: insertError } = await supabaseClient
                .from("staff_member_module_overrides")
                .insert(payload);

            if (insertError) throw insertError;
        }

        await loadOverrides();

        renderIndividualPermissions();

        showToast("Dérogation individuelle enregistrée.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

/* =========================================================
   RÉINITIALISATION INDIVIDUELLE
========================================================= */

async function resetIndividualPermission(card) {
    const account = state.selectedMember;

    if (!account) return;

    const moduleCode = card.dataset.module;

    const override = findOverride(
        account.auth_user_id,
        moduleCode
    );

    if (!override) {
        showToast("Aucune dérogation à réinitialiser.", "error");
        return;
    }

    const confirmed = window.confirm(
        "Réinitialiser cette dérogation ?\n\n" +
        "Le compte retrouvera les permissions héritées de son rôle."
    );

    if (!confirmed) return;

    showLoading("Réinitialisation de la permission...");

    try {
        const { error } = await supabaseClient
            .from("staff_member_module_overrides")
            .delete()
            .eq("auth_user_id", account.auth_user_id)
            .eq("module_code", moduleCode)
            .is("department_code", null)
            .is("service_code", null);

        if (error) throw error;

        await loadOverrides();

        renderIndividualPermissions();

        showToast("Les droits hérités sont de nouveau appliqués.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

/* =========================================================
   ACTUALISATION
========================================================= */

async function refreshRoles() {
    showLoading("Actualisation des rôles...");

    try {
        await Promise.all([
            loadRoles(),
            loadRolePermissions(),
            loadModules()
        ]);

        renderRolePermissions();

        showToast("Rôles actualisés.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

async function refreshIndividual() {
    showLoading("Actualisation des comptes et permissions...");

    try {
        await Promise.all([
            loadAccounts(),
            loadOverrides(),
            loadRolePermissions(),
            loadModules()
        ]);

        if (state.selectedMember) {
            renderSelectedMember();
            renderIndividualPermissions();
        }

        showToast("Comptes et permissions actualisés.");

    } catch (error) {
        handleError(error);
    } finally {
        hideLoading();
    }
}

/* =========================================================
   ÉVÉNEMENTS
========================================================= */

function bindEvents() {

    /* Onglets */

    document.querySelectorAll("[data-tab]").forEach(button => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            state.activeTab = tab;

            document.querySelectorAll("[data-tab]").forEach(item => {
                item.classList.toggle(
                    "active",
                    item.dataset.tab === tab
                );
            });

            $("rolesPanel").classList.toggle(
                "hidden",
                tab !== "roles"
            );

            $("individualPanel").classList.toggle(
                "hidden",
                tab !== "individual"
            );
        });
    });

    /* Rôles */

    el.roleSelect.addEventListener("change", renderRolePermissions);

    el.roleSearch.addEventListener("input", renderRolePermissions);

    el.rolePermissionList.addEventListener("click", event => {
        const button = event.target.closest("[data-action='save']");

        if (!button) return;

        const card = button.closest("[data-module]");

        if (card) {
            saveOneRolePermission(card);
        }
    });

    el.rolePermissionList.addEventListener("change", event => {
        const card = event.target.closest("[data-module]");

        if (!card) return;

        const access = card.querySelector('[data-field="access"]');
        const write = card.querySelector('[data-field="write"]');

        if (access && write) {
            write.disabled = access.value !== "true";

            if (access.value !== "true") {
                write.value = "false";
            }
        }
    });

    $("saveRolePermissions").addEventListener(
        "click",
        saveAllRolePermissions
    );

    $("refreshRoles").addEventListener(
        "click",
        refreshRoles
    );

    /* Comptes */

    el.memberSearch.addEventListener("input", () => {
        renderMemberSelect();
    });

    el.memberSelect.addEventListener("change", event => {
        selectMember(event.target.value);
    });

    /* Permissions individuelles */

    el.individualPermissionList.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const card = button.closest("[data-module]");

        if (!card) return;

        if (button.dataset.action === "save") {
            saveIndividualPermission(card);
        }

        if (button.dataset.action === "reset") {
            resetIndividualPermission(card);
        }
    });

    el.individualPermissionList.addEventListener("change", event => {
        const card = event.target.closest("[data-module]");

        if (!card) return;

        const access = card.querySelector('[data-field="access"]');
        const write = card.querySelector('[data-field="write"]');

        if (access && write) {
            write.disabled = access.value !== "true";

            if (access.value !== "true") {
                write.value = "false";
            }
        }
    });

    $("refreshIndividual").addEventListener(
        "click",
        refreshIndividual
    );
}

/* =========================================================
   INITIALISATION
========================================================= */

async function initialize() {
    showLoading("Vérification de la permission permissions.write...");

    try {
        const authorized = await authenticate();

        if (!authorized) return;

        bindEvents();

        await loadAllData();

        renderRolePermissions();

        renderMemberSelect();

        showToast("Centre de gestion initialisé.");

    } catch (error) {
        setConnectionStatus("Erreur de connexion");

        console.error("[ZONE-431]", error);

        showToast(
            `Impossible de charger les permissions : ${error.message}`,
            "error"
        );
    } finally {
        hideLoading();
    }
}

initialize();
