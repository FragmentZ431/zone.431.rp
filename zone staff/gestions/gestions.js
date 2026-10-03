(() => {
    "use strict";

    let supabaseClient = null;
    let currentRole = null;
    let members = [];
    let roles = [];
    let codes = [];

    const MODULES = [
        { key: "gestion", label: "Gestion" },
        { key: "sanctions", label: "Sanctions" },
        { key: "blacklist", label: "Blacklist" },
        { key: "whitelist", label: "Whitelist" },
        { key: "rapports", label: "Rapports événements" },
        { key: "demandes", label: "Demandes événements" },
        { key: "scripts", label: "Scripts" },
        { key: "recensement", label: "Recensement" },
        { key: "rosters", label: "Rosters" }
    ];

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        await waitForSupabase();
    }

    function waitForSupabase() {
        return new Promise(resolve => {
            let attempts = 0;

            const timer = setInterval(async () => {
                attempts++;

                if (window.zone431Supabase) {
                    clearInterval(timer);
                    supabaseClient = window.zone431Supabase;
                    await startGestion();
                    resolve();
                    return;
                }

                if (attempts >= 100) {
                    clearInterval(timer);

                    setSystemStatus(
                        "status-supabase",
                        "ERREUR",
                        false
                    );

                    showGlobalMessage(
                        "Supabase n'est pas chargé. Vérifie le script @supabase et staff-access.js.",
                        "error"
                    );

                    resolve();
                }
            }, 100);
        });
    }

    async function startGestion() {
        try {
            setSystemStatus(
                "status-supabase",
                "CONNECTÉ",
                true
            );

            const {
                data: sessionData,
                error: sessionError
            } = await supabaseClient.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            if (!sessionData?.session) {
                setSystemStatus(
                    "status-auth",
                    "NON AUTHENTIFIÉ",
                    false
                );

                setSystemStatus(
                    "status-session",
                    "ABSENTE",
                    false
                );

                denyAccess(
                    "Aucune session Supabase active."
                );

                return;
            }

            setSystemStatus(
                "status-auth",
                "AUTHENTIFIÉ",
                true
            );

            setSystemStatus(
                "status-session",
                "ACTIVE",
                true
            );

            const {
                data: roleData,
                error: roleError
            } = await supabaseClient.rpc(
                "current_staff_role"
            );

            if (roleError) {
                throw roleError;
            }

            currentRole = roleData || null;

            updateHeader();

            if (currentRole !== "ADMINISTRATEUR") {
                setSystemStatus(
                    "status-permissions",
                    "REFUSÉ",
                    false
                );

                denyAccess(
                    "Cette interface est réservée aux ADMINISTRATEURS."
                );

                return;
            }

            setSystemStatus(
                "status-permissions",
                "ADMINISTRATEUR",
                true
            );

            await reloadData();

            bindInterface();

        } catch (error) {
            console.error(
                "Erreur initialisation Gestion :",
                error
            );

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function reloadData() {
        await Promise.all([
            loadMembers(),
            loadRoles(),
            loadCodes()
        ]);

        renderMembers();
        renderRoles();
        renderCodes();
        updateSystemInformation();
    }

    async function loadMembers() {
        const {
            data,
            error
        } = await supabaseClient.rpc(
            "admin_list_staff"
        );

        if (error) {
            throw error;
        }

        members = Array.isArray(data)
            ? data
            : [];
    }

    async function loadRoles() {
        const {
            data,
            error
        } = await supabaseClient.rpc(
            "admin_list_roles"
        );

        if (error) {
            throw error;
        }

        roles = Array.isArray(data)
            ? data
            : [];
    }

    async function loadCodes() {
        const {
            data,
            error
        } = await supabaseClient.rpc(
            "admin_list_codes"
        );

        if (error) {
            throw error;
        }

        codes = Array.isArray(data)
            ? data
            : [];
    }

    function bindInterface() {
        const addMember =
            document.getElementById(
                "add-staff-member"
            );

        if (addMember) {
            addMember.addEventListener(
                "click",
                () => openMemberModal()
            );
        }

        const addRole =
            document.getElementById(
                "add-staff-role"
            );

        if (addRole) {
            addRole.addEventListener(
                "click",
                () => openRoleModal()
            );
        }

        const addCode =
            document.getElementById(
                "add-staff-code"
            );

        if (addCode) {
            addCode.addEventListener(
                "click",
                () => openCodeCreationModal()
            );
        }

        document
            .querySelectorAll(".gestion-module")
            .forEach(module => {

                module.addEventListener(
                    "click",
                    event => {

                        const href =
                            module.getAttribute(
                                "href"
                            );

                        if (
                            !href ||
                            !href.startsWith("#")
                        ) {
                            return;
                        }

                        event.preventDefault();

                        const target =
                            document.querySelector(
                                href
                            );

                        if (target) {
                            target.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });
                        }
                    }
                );
            });

        updateClock();

        setInterval(
            updateClock,
            1000
        );
    }

    function updateHeader() {
        const elements = [
            document.getElementById(
                "gestion-session-role"
            ),
            document.getElementById(
                "gestion-access-level"
            ),
            document.getElementById(
                "gestion-system-role"
            )
        ];

        elements.forEach(element => {
            if (element) {
                element.textContent =
                    currentRole || "INCONNU";
            }
        });

        const status =
            document.getElementById(
                "gestion-session-status"
            );

        if (status) {
            status.textContent =
                "AUTHENTIFIÉ";
        }
    }

    function updateSystemInformation() {
        const session =
            document.getElementById(
                "gestion-system-session"
            );

        if (session) {
            session.textContent =
                `${members.filter(
                    member => member.active
                ).length} ACTIFS`;
        }

        const role =
            document.getElementById(
                "gestion-system-role"
            );

        if (role) {
            role.textContent =
                `${roles.filter(
                    item => item.active
                ).length} RÔLES`;
        }
    }

    function updateClock() {
        const clock =
            document.getElementById(
                "gestion-system-clock"
            );

        if (!clock) {
            return;
        }

        clock.textContent =
            new Date().toLocaleTimeString(
                "fr-FR",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );
    }

    function renderMembers() {
        const container =
            document.getElementById(
                "staff-members-list"
            );

        if (!container) {
            return;
        }

        if (!members.length) {
            container.innerHTML = emptyState(
                "AUCUN MEMBRE",
                "Aucun membre du staff n'est actuellement enregistré."
            );

            return;
        }

        container.innerHTML =
            members.map(member => `
                <article class="gestion-member-card">

                    <div class="member-card-top">

                        <div class="member-identity">

                            <div class="member-avatar">
                                ${getInitials(
                                    member.pseudo_discord
                                )}
                            </div>

                            <div>
                                <h3>
                                    ${escapeHtml(
                                        member.pseudo_discord ||
                                        "Sans pseudo"
                                    )}
                                </h3>

                                <span>
                                    ID STAFF #${member.id}
                                </span>
                            </div>

                        </div>

                        <span class="gestion-status ${
                            member.active
                                ? "online"
                                : "offline"
                        }">
                            ${
                                member.active
                                    ? "ACTIF"
                                    : "RÉVOQUÉ"
                            }
                        </span>

                    </div>

                    <div class="member-card-info">

                        <div>
                            <span>DISCORD</span>
                            <strong>
                                ${escapeHtml(
                                    member.pseudo_discord ||
                                    "—"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>ROBLOX / IG</span>
                            <strong>
                                ${escapeHtml(
                                    member.pseudo_ig ||
                                    "—"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>RÔLE</span>
                            <strong class="role-value">
                                ${escapeHtml(
                                    member.role ||
                                    "—"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>WARNS</span>
                            <strong>
                                ${Number(
                                    member.warns || 0
                                )}
                            </strong>
                        </div>

                    </div>

                    <div class="member-card-actions">

                        <button
                            type="button"
                            data-member-action="edit"
                            data-id="${member.id}">
                            MODIFIER
                        </button>

                        <button
                            type="button"
                            data-member-action="code"
                            data-id="${member.id}">
                            VOIR LE CODE
                        </button>

                        <button
                            type="button"
                            data-member-action="warn"
                            data-id="${member.id}">
                            WARNS
                        </button>

                        ${
                            member.active
                                ? `
                                    <button
                                        type="button"
                                        class="danger"
                                        data-member-action="revoke"
                                        data-id="${member.id}">
                                        RÉVOQUER
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        data-member-action="restore"
                                        data-id="${member.id}">
                                        RESTAURER
                                    </button>
                                `
                        }

                        <button
                            type="button"
                            class="danger"
                            data-member-action="delete"
                            data-id="${member.id}">
                            SUPPRIMER
                        </button>

                    </div>

                </article>
            `).join("");

        container
            .querySelectorAll(
                "[data-member-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        handleMemberAction(
                            button.dataset.memberAction,
                            Number(
                                button.dataset.id
                            )
                        );
                    }
                );
            });
    }

    function renderRoles() {
        const container =
            document.getElementById(
                "staff-roles-list"
            );

        if (!container) {
            return;
        }

        if (!roles.length) {
            container.innerHTML = emptyState(
                "AUCUN RÔLE",
                "Aucun rôle n'est configuré."
            );

            return;
        }

        container.innerHTML =
            roles.map(role => {

                const permissions =
                    role.permissions || {};

                const assigned =
                    members.filter(
                        member =>
                            member.role === role.name
                    ).length;

                const permissionCount =
                    MODULES.filter(
                        module =>
                            permissions[
                                module.key
                            ] &&
                            permissions[
                                module.key
                            ] !== "none"
                    ).length;

                return `
                    <article class="gestion-role-card">

                        <div class="role-card-header">

                            <div>
                                <span class="role-index">
                                    ROLE #${role.id}
                                </span>

                                <h3>
                                    ${escapeHtml(
                                        role.name
                                    )}
                                </h3>
                            </div>

                            <span class="gestion-status ${
                                role.active
                                    ? "online"
                                    : "offline"
                            }">
                                ${
                                    role.active
                                        ? "ACTIF"
                                        : "INACTIF"
                                }
                            </span>

                        </div>

                        <p class="role-description">
                            ${escapeHtml(
                                role.description ||
                                "Aucune description."
                            )}
                        </p>

                        <div class="role-stats">

                            <div>
                                <strong>
                                    ${assigned}
                                </strong>
                                <span>
                                    MEMBRE${assigned > 1 ? "S" : ""}
                                </span>
                            </div>

                            <div>
                                <strong>
                                    ${permissionCount}
                                </strong>
                                <span>
                                    ACCÈS
                                </span>
                            </div>

                        </div>

                        <div class="role-permissions-preview">
                            ${renderPermissionBadges(
                                permissions
                            )}
                        </div>

                        <div class="role-card-actions">

                            <button
                                type="button"
                                data-role-action="edit"
                                data-id="${role.id}">
                                MODIFIER LE RÔLE
                            </button>

                            ${
                                role.name !==
                                "ADMINISTRATEUR"
                                    ? `
                                        <button
                                            type="button"
                                            class="danger"
                                            data-role-action="delete"
                                            data-id="${role.id}">
                                            SUPPRIMER
                                        </button>
                                    `
                                    : `
                                        <span class="protected-role">
                                            RÔLE PROTÉGÉ
                                        </span>
                                    `
                            }

                        </div>

                    </article>
                `;
            }).join("");

        container
            .querySelectorAll(
                "[data-role-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        handleRoleAction(
                            button.dataset.roleAction,
                            Number(
                                button.dataset.id
                            )
                        );
                    }
                );
            });
    }

    function renderPermissionBadges(
        permissions
    ) {
        return MODULES.map(module => {

            const level =
                permissions[module.key] ||
                "none";

            if (level === "none") {
                return `
                    <span class="permission-badge none">
                        ${escapeHtml(
                            module.label
                        )}
                        <b>NON</b>
                    </span>
                `;
            }

            return `
                <span class="permission-badge ${
                    level === "write"
                        ? "write"
                        : "read"
                }">
                    ${escapeHtml(
                        module.label
                    )}
                    <b>
                        ${
                            level === "write"
                                ? "MODIF"
                                : "LECTURE"
                        }
                    </b>
                </span>
            `;
        }).join("");
    }

    function renderCodes() {
        const container =
            document.getElementById(
                "staff-codes-list"
            );

        if (!container) {
            return;
        }

        if (!codes.length) {
            container.innerHTML = emptyState(
                "AUCUN CODE",
                "Aucun code d'accès n'est enregistré."
            );

            return;
        }

        container.innerHTML =
            codes.map(code => `
                <article class="gestion-code-card">

                    <div class="code-card-main">

                        <div class="code-card-icon">
                            KEY
                        </div>

                        <div>

                            <span class="code-card-owner">
                                ${escapeHtml(
                                    code.pseudo_discord ||
                                    "Membre inconnu"
                                )}
                            </span>

                            <strong class="code-value">
                                ${escapeHtml(
                                    code.code_value ||
                                    "—"
                                )}
                            </strong>

                            <div class="code-card-meta">
                                <span>
                                    ${escapeHtml(
                                        code.role ||
                                        "Aucun rôle"
                                    )}
                                </span>

                                <span>
                                    STAFF #${
                                        code.staff_member_id ??
                                        "—"
                                    }
                                </span>
                            </div>

                        </div>

                    </div>

                    <div class="code-card-state">

                        <span class="gestion-status ${
                            code.active &&
                            code.staff_active
                                ? "online"
                                : "offline"
                        }">
                            ${
                                code.active &&
                                code.staff_active
                                    ? "ACTIF"
                                    : "INACTIF"
                            }
                        </span>

                    </div>

                    <div class="code-card-actions">

                        <button
                            type="button"
                            data-code-action="copy"
                            data-id="${code.id}">
                            COPIER
                        </button>

                        <button
                            type="button"
                            data-code-action="toggle"
                            data-id="${code.id}">
                            ${
                                code.active
                                    ? "DÉSACTIVER"
                                    : "ACTIVER"
                            }
                        </button>

                    </div>

                </article>
            `).join("");

        container
            .querySelectorAll(
                "[data-code-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        handleCodeAction(
                            button.dataset.codeAction,
                            Number(
                                button.dataset.id
                            )
                        );
                    }
                );
            });
    }

    async function handleMemberAction(
        action,
        id
    ) {
        const member =
            members.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );

        if (!member) {
            return;
        }

        if (action === "edit") {
            openMemberModal(member);
        }

        if (action === "code") {
            openCodeModal(member);
        }

        if (action === "warn") {
            openWarnModal(member);
        }

        if (action === "revoke") {
            await revokeMember(member);
        }

        if (action === "restore") {
            await restoreMember(member);
        }

        if (action === "delete") {
            await deleteMember(member);
        }
    }

    async function handleRoleAction(
        action,
        id
    ) {
        const role =
            roles.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );

        if (!role) {
            return;
        }

        if (action === "edit") {
            openRoleModal(role);
        }

        if (action === "delete") {
            await deleteRole(role);
        }
    }

    async function handleCodeAction(
        action,
        id
    ) {
        const code =
            codes.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );

        if (!code) {
            return;
        }

        if (action === "copy") {
            await copyCode(
                code.code_value
            );
        }

        if (action === "toggle") {
            await toggleCode(code);
        }
    }

    function openMemberModal(
        member = null
    ) {
        const editing =
            Boolean(member);

        const options =
            roles
                .filter(
                    role => role.active
                )
                .map(
                    role => `
                        <option
                            value="${escapeAttribute(
                                role.name
                            )}"
                            ${
                                member?.role ===
                                role.name
                                    ? "selected"
                                    : ""
                            }>
                            ${escapeHtml(
                                role.name
                            )}
                        </option>
                    `
                )
                .join("");

        openModal(
            editing
                ? "MODIFIER LE MEMBRE"
                : "NOUVEAU MEMBRE",
            `
                <form id="gestion-member-form">

                    <div class="gestion-form-intro">
                        ${
                            editing
                                ? "Modification du profil et des accès du membre."
                                : "Création d'un nouveau compte staff."
                        }
                    </div>

                    <div class="gestion-form-grid">

                        <div class="gestion-form-group">
                            <label>
                                PSEUDO DISCORD
                            </label>

                            <input
                                id="gestion-member-discord"
                                type="text"
                                maxlength="100"
                                required
                                value="${escapeAttribute(
                                    member?.pseudo_discord ||
                                    ""
                                )}">
                        </div>

                        <div class="gestion-form-group">
                            <label>
                                PSEUDO IG
                            </label>

                            <input
                                id="gestion-member-ig"
                                type="text"
                                maxlength="100"
                                required
                                value="${escapeAttribute(
                                    member?.pseudo_ig ||
                                    ""
                                )}">
                        </div>

                    </div>

                    <div class="gestion-form-group">
                        <label>
                            RÔLE
                        </label>

                        <select
                            id="gestion-member-role"
                            required>

                            <option value="">
                                Sélectionner un rôle
                            </option>

                            ${options}

                        </select>
                    </div>

                    <div class="gestion-form-group">
                        <label>
                            CODE D'ACCÈS
                        </label>

                        <input
                            id="gestion-member-code"
                            type="text"
                            minlength="4"
                            maxlength="100"
                            required
                            value="${escapeAttribute(
                                member?.code_value ||
                                ""
                            )}">
                    </div>

                    ${
                        editing
                            ? `
                                <div class="gestion-form-group">
                                    <label>
                                        WARNS
                                    </label>

                                    <input
                                        id="gestion-member-warns"
                                        type="number"
                                        min="0"
                                        max="999"
                                        value="${Number(
                                            member.warns ||
                                            0
                                        )}">
                                </div>
                            `
                            : ""
                    }

                    <div
                        id="gestion-member-message"
                        class="gestion-form-message">
                    </div>

                    <div class="gestion-modal-actions">

                        <button
                            type="button"
                            class="gestion-modal-cancel"
                            data-close-modal>
                            ANNULER
                        </button>

                        <button
                            type="submit"
                            class="gestion-modal-submit">
                            ${
                                editing
                                    ? "ENREGISTRER"
                                    : "CRÉER LE MEMBRE"
                            }
                        </button>

                    </div>

                </form>
            `
        );

        document
            .getElementById(
                "gestion-member-form"
            )
            .addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await saveMember(
                        member
                    );
                }
            );
    }

    async function saveMember(
        existingMember
    ) {
        const discord =
            document.getElementById(
                "gestion-member-discord"
            ).value.trim();

        const ig =
            document.getElementById(
                "gestion-member-ig"
            ).value.trim();

        const role =
            document.getElementById(
                "gestion-member-role"
            ).value;

        const code =
            document.getElementById(
                "gestion-member-code"
            ).value.trim();

        const message =
            document.getElementById(
                "gestion-member-message"
            );

        if (
            !discord ||
            !ig ||
            !role ||
            code.length < 4
        ) {
            showFormMessage(
                message,
                "Tous les champs sont obligatoires. Le code doit contenir au moins 4 caractères.",
                "error"
            );

            return;
        }

        try {

            if (existingMember) {

                const {
                    error
                } = await supabaseClient.rpc(
                    "admin_update_staff",
                    {
                        p_staff_id:
                            existingMember.id,

                        p_pseudo_discord:
                            discord,

                        p_pseudo_ig:
                            ig,

                        p_role:
                            role,

                        p_code:
                            code
                    }
                );

                if (error) {
                    throw error;
                }

                const warns =
                    document.getElementById(
                        "gestion-member-warns"
                    );

                if (warns) {

                    const value =
                        Math.max(
                            0,
                            Number.parseInt(
                                warns.value,
                                10
                            ) || 0
                        );

                    const {
                        error: warnError
                    } =
                        await supabaseClient.rpc(
                            "admin_set_warns",
                            {
                                p_staff_id:
                                    existingMember.id,

                                p_warns:
                                    value
                            }
                        );

                    if (warnError) {
                        throw warnError;
                    }
                }

            } else {

                const {
                    error
                } = await supabaseClient.rpc(
                    "admin_create_staff",
                    {
                        p_pseudo_discord:
                            discord,

                        p_pseudo_ig:
                            ig,

                        p_role:
                            role,

                        p_code:
                            code
                    }
                );

                if (error) {
                    throw error;
                }
            }

            await reloadData();

            showFormMessage(
                message,
                existingMember
                    ? "Membre modifié avec succès."
                    : "Membre créé avec succès.",
                "success"
            );

            setTimeout(
                closeModal,
                500
            );

        } catch (error) {

            console.error(error);

            showFormMessage(
                message,
                getErrorMessage(error),
                "error"
            );
        }
    }

    function openRoleModal(
        role = null
    ) {
        const editing =
            Boolean(role);

        const permissionRows =
            MODULES.map(module => {

                const current =
                    role?.permissions?.[
                        module.key
                    ] || "none";

                const access =
                    current !== "none";

                const level =
                    current === "write"
                        ? "write"
                        : "read";

                return `
                    <div class="permission-row">

                        <div class="permission-category">
                            <strong>
                                ${escapeHtml(
                                    module.label
                                )}
                            </strong>

                            <span
                                data-permission-state="${escapeAttribute(
                                    module.key
                                )}"
                                class="${
                                    access
                                        ? "has-access"
                                        : "no-access"
                                }">
                                ${
                                    access
                                        ? "ACCÈS OUI"
                                        : "ACCÈS NON"
                                }
                            </span>
                        </div>

                        <label class="permission-switch">

                            <input
                                type="checkbox"
                                data-permission-access="${escapeAttribute(
                                    module.key
                                )}"
                                ${
                                    access
                                        ? "checked"
                                        : ""
                                }>

                            <span></span>

                        </label>

                        <select
                            data-permission-level="${escapeAttribute(
                                module.key
                            )}"
                            ${
                                access
                                    ? ""
                                    : "disabled"
                            }>

                            <option
                                value="read"
                                ${
                                    level ===
                                    "read"
                                        ? "selected"
                                        : ""
                                }>
                                LECTURE
                            </option>

                            <option
                                value="write"
                                ${
                                    level ===
                                    "write"
                                        ? "selected"
                                        : ""
                                }>
                                MODIFICATION
                            </option>

                        </select>

                    </div>
                `;
            }).join("");

        openModal(
            editing
                ? "MODIFIER LE RÔLE"
                : "NOUVEAU RÔLE",
            `
                <form id="gestion-role-form">

                    <div class="gestion-form-intro">
                        Configure précisément les accès accordés à ce rôle.
                    </div>

                    <div class="gestion-form-group">
                        <label>
                            NOM DU RÔLE
                        </label>

                        <input
                            id="gestion-role-name"
                            type="text"
                            maxlength="80"
                            required
                            ${
                                role?.name ===
                                "ADMINISTRATEUR"
                                    ? "readonly"
                                    : ""
                            }
                            value="${escapeAttribute(
                                role?.name ||
                                ""
                            )}">
                    </div>

                    <div class="gestion-form-group">
                        <label>
                            DESCRIPTION
                        </label>

                        <textarea
                            id="gestion-role-description"
                            rows="3"
                            maxlength="500">${escapeHtml(
                                role?.description ||
                                ""
                            )}</textarea>
                    </div>

                    <div class="permission-table">

                        <div class="permission-table-head">
                            <span>CATÉGORIE</span>
                            <span>ACCÈS</span>
                            <span>NIVEAU</span>
                        </div>

                        ${permissionRows}

                    </div>

                    ${
                        editing
                            ? `
                                <label class="role-active-check">

                                    <input
                                        type="checkbox"
                                        id="gestion-role-active"
                                        ${
                                            role.active
                                                ? "checked"
                                                : ""
                                        }
                                        ${
                                            role.name ===
                                            "ADMINISTRATEUR"
                                                ? "disabled"
                                                : ""
                                        }>

                                    <span>
                                        RÔLE ACTIF
                                    </span>

                                </label>
                            `
                            : ""
                    }

                    <div
                        id="gestion-role-message"
                        class="gestion-form-message">
                    </div>

                    <div class="gestion-modal-actions">

                        <button
                            type="button"
                            class="gestion-modal-cancel"
                            data-close-modal>
                            ANNULER
                        </button>

                        <button
                            type="submit"
                            class="gestion-modal-submit">
                            ${
                                editing
                                    ? "ENREGISTRER"
                                    : "CRÉER LE RÔLE"
                            }
                        </button>

                    </div>

                </form>
            `
        );

        document
            .querySelectorAll(
                "[data-permission-access]"
            )
            .forEach(checkbox => {

                checkbox.addEventListener(
                    "change",
                    () => {

                        const key =
                            checkbox.dataset
                                .permissionAccess;

                        const select =
                            document.querySelector(
                                `[data-permission-level="${CSS.escape(
                                    key
                                )}"]`
                            );

                        const state =
                            document.querySelector(
                                `[data-permission-state="${CSS.escape(
                                    key
                                )}"]`
                            );

                        if (
                            !select ||
                            !state
                        ) {
                            return;
                        }

                        select.disabled =
                            !checkbox.checked;

                        if (
                            checkbox.checked
                        ) {

                            state.textContent =
                                "ACCÈS OUI";

                            state.className =
                                "has-access";

                        } else {

                            state.textContent =
                                "ACCÈS NON";

                            state.className =
                                "no-access";
                        }
                    }
                );
            });

        document
            .getElementById(
                "gestion-role-form"
            )
            .addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await saveRole(
                        role
                    );
                }
            );
    }

    async function saveRole(
        existingRole
    ) {
        const name =
            document.getElementById(
                "gestion-role-name"
            ).value.trim();

        const description =
            document.getElementById(
                "gestion-role-description"
            ).value.trim();

        const message =
            document.getElementById(
                "gestion-role-message"
            );

        const permissions = {};

        MODULES.forEach(
            module => {

                const checkbox =
                    document.querySelector(
                        `[data-permission-access="${CSS.escape(
                            module.key
                        )}"]`
                    );

                const select =
                    document.querySelector(
                        `[data-permission-level="${CSS.escape(
                            module.key
                        )}"]`
                    );

                if (
                    !checkbox ||
                    !select
                ) {
                    permissions[
                        module.key
                    ] = "none";

                    return;
                }

                permissions[
                    module.key
                ] = checkbox.checked
                    ? (
                        select.value ===
                        "write"
                            ? "write"
                            : "read"
                    )
                    : "none";
            }
        );

        const activeInput =
            document.getElementById(
                "gestion-role-active"
            );

        const active =
            activeInput
                ? activeInput.checked
                : true;

        if (!name) {
            showFormMessage(
                message,
                "Le nom du rôle est obligatoire.",
                "error"
            );

            return;
        }

        try {

            if (existingRole) {

                const {
                    error
                } = await supabaseClient.rpc(
                    "admin_update_role",
                    {
                        p_role_id:
                            existingRole.id,

                        p_name:
                            name,

                        p_description:
                            description,

                        p_permissions:
                            permissions,

                        p_active:
                            active
                    }
                );

                if (error) {
                    throw error;
                }

            } else {

                const {
                    error
                } = await supabaseClient.rpc(
                    "admin_create_role",
                    {
                        p_name:
                            name,

                        p_description:
                            description,

                        p_permissions:
                            permissions
                    }
                );

                if (error) {
                    throw error;
                }
            }

            await reloadData();

            showFormMessage(
                message,
                existingRole
                    ? "Rôle modifié avec succès."
                    : "Rôle créé avec succès.",
                "success"
            );

            setTimeout(
                closeModal,
                500
            );

        } catch (error) {

            console.error(error);

            showFormMessage(
                message,
                getErrorMessage(error),
                "error"
            );
        }
    }

    function openCodeModal(
        member
    ) {
        openModal(
            "CODE D'ACCÈS",
            `
                <div class="code-view">

                    <span>
                        CODE ASSOCIÉ À
                    </span>

                    <strong>
                        ${escapeHtml(
                            member.pseudo_discord ||
                            "Membre"
                        )}
                    </strong>

                    <div class="large-code">
                        ${escapeHtml(
                            member.code_value ||
                            "—"
                        )}
                    </div>

                    <button
                        type="button"
                        class="gestion-modal-submit"
                        id="copy-member-code">
                        COPIER LE CODE
                    </button>

                </div>
            `
        );

        document
            .getElementById(
                "copy-member-code"
            )
            .addEventListener(
                "click",
                () => copyCode(
                    member.code_value
                )
            );
    }

    function openCodeCreationModal() {
        openModal(
            "NOUVEAU CODE",
            `
                <div class="code-info">

                    <div class="code-info-icon">
                        KEY
                    </div>

                    <h3>
                        Les codes sont liés aux membres.
                    </h3>

                    <p>
                        Pour créer un nouveau code d'accès,
                        crée un membre ou modifie son code.
                    </p>

                    <button
                        type="button"
                        class="gestion-modal-submit"
                        data-open-member>
                        CRÉER UN MEMBRE
                    </button>

                </div>
            `
        );

        document
            .querySelector(
                "[data-open-member]"
            )
            .addEventListener(
                "click",
                () => {

                    closeModal();

                    setTimeout(
                        () => openMemberModal(),
                        250
                    );
                }
            );
    }

    function openWarnModal(
        member
    ) {
        openModal(
            "GESTION DES WARNS",
            `
                <form id="gestion-warn-form">

                    <div class="gestion-form-group">
                        <label>
                            NOMBRE DE WARNS
                        </label>

                        <input
                            id="gestion-warn-value"
                            type="number"
                            min="0"
                            max="999"
                            value="${Number(
                                member.warns ||
                                0
                            )}">
                    </div>

                    <div
                        id="gestion-warn-message"
                        class="gestion-form-message">
                    </div>

                    <div class="gestion-modal-actions">

                        <button
                            type="button"
                            class="gestion-modal-cancel"
                            data-close-modal>
                            ANNULER
                        </button>

                        <button
                            type="submit"
                            class="gestion-modal-submit">
                            ENREGISTRER
                        </button>

                    </div>

                </form>
            `
        );

        document
            .getElementById(
                "gestion-warn-form"
            )
            .addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    const value =
                        Math.max(
                            0,
                            Number.parseInt(
                                document
                                    .getElementById(
                                        "gestion-warn-value"
                                    )
                                    .value,
                                10
                            ) || 0
                        );

                    const message =
                        document.getElementById(
                            "gestion-warn-message"
                        );

                    try {

                        const {
                            error
                        } =
                            await supabaseClient.rpc(
                                "admin_set_warns",
                                {
                                    p_staff_id:
                                        member.id,

                                    p_warns:
                                        value
                                }
                            );

                        if (error) {
                            throw error;
                        }

                        await reloadData();

                        showFormMessage(
                            message,
                            "Warns mis à jour.",
                            "success"
                        );

                        setTimeout(
                            closeModal,
                            400
                        );

                    } catch (error) {

                        showFormMessage(
                            message,
                            getErrorMessage(error),
                            "error"
                        );
                    }
                }
            );
    }

    async function revokeMember(
        member
    ) {
        if (
            !confirm(
                `Révoquer l'accès de ${member.pseudo_discord} ?`
            )
        ) {
            return;
        }

        try {

            const {
                error
            } = await supabaseClient.rpc(
                "admin_revoke_staff",
                {
                    p_staff_id:
                        member.id
                }
            );

            if (error) {
                throw error;
            }

            await reloadData();

            showGlobalMessage(
                "Accès du membre révoqué.",
                "success"
            );

        } catch (error) {

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function restoreMember(
        member
    ) {
        try {

            const {
                error
            } = await supabaseClient.rpc(
                "admin_restore_staff",
                {
                    p_staff_id:
                        member.id
                }
            );

            if (error) {
                throw error;
            }

            await reloadData();

            showGlobalMessage(
                "Accès restauré.",
                "success"
            );

        } catch (error) {

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function deleteMember(
        member
    ) {
        if (
            !confirm(
                `Supprimer définitivement ${member.pseudo_discord} ?`
            )
        ) {
            return;
        }

        try {

            const {
                error
            } = await supabaseClient.rpc(
                "admin_delete_staff",
                {
                    p_staff_id:
                        member.id
                }
            );

            if (error) {
                throw error;
            }

            await reloadData();

            showGlobalMessage(
                "Membre supprimé.",
                "success"
            );

        } catch (error) {

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function deleteRole(
        role
    ) {
        const assigned =
            members.filter(
                member =>
                    member.role ===
                    role.name
            );

        if (assigned.length) {

            showGlobalMessage(
                `Impossible de supprimer ${role.name} : ${assigned.length} membre(s) utilisent encore ce rôle.`,
                "error"
            );

            return;
        }

        if (
            !confirm(
                `Supprimer définitivement le rôle ${role.name} ?`
            )
        ) {
            return;
        }

        try {

            const {
                error
            } = await supabaseClient.rpc(
                "admin_delete_role",
                {
                    p_role_id:
                        role.id
                }
            );

            if (error) {
                throw error;
            }

            await reloadData();

            showGlobalMessage(
                "Rôle supprimé.",
                "success"
            );

        } catch (error) {

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function toggleCode(
        code
    ) {
        try {

            const {
                error
            } = await supabaseClient.rpc(
                "admin_set_code_active",
                {
                    p_code_id:
                        code.id,

                    p_active:
                        !code.active
                }
            );

            if (error) {
                throw error;
            }

            await reloadData();

            showGlobalMessage(
                code.active
                    ? "Code désactivé."
                    : "Code activé.",
                "success"
            );

        } catch (error) {

            showGlobalMessage(
                getErrorMessage(error),
                "error"
            );
        }
    }

    async function copyCode(
        code
    ) {
        if (!code) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                code
            );

            showGlobalMessage(
                "Code copié.",
                "success"
            );

        } catch {

            showGlobalMessage(
                "Impossible de copier automatiquement le code.",
                "error"
            );
        }
    }

    function openModal(
        title,
        content
    ) {
        closeModal();

        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "gestion-modal-overlay";

        overlay.innerHTML = `
            <div
                class="gestion-modal"
                role="dialog"
                aria-modal="true">

                <div class="gestion-modal-header">

                    <div>
                        <span>
                            ZONE-431 // GESTION
                        </span>

                        <h2>
                            ${escapeHtml(
                                title
                            )}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="gestion-modal-close"
                        data-close-modal>
                        ×
                    </button>

                </div>

                <div class="gestion-modal-content">
                    ${content}
                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        overlay
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    closeModal
                );
            });

        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    closeModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            modalEscape
        );
    }

    function modalEscape(
        event
    ) {
        if (
            event.key ===
            "Escape"
        ) {
            closeModal();
        }
    }

    function closeModal() {
        const modal =
            document.querySelector(
                ".gestion-modal-overlay"
            );

        if (modal) {
            modal.remove();
        }

        document.removeEventListener(
            "keydown",
            modalEscape
        );
    }

    function denyAccess(
        message
    ) {
        const interfaceElement =
            document.getElementById(
                "gestion-interface"
            );

        if (!interfaceElement) {
            return;
        }

        interfaceElement.innerHTML = `
            <div class="gestion-access-denied">

                <span>
                    ZONE-431 // ACCESS CONTROL
                </span>

                <h1>
                    ACCÈS REFUSÉ
                </h1>

                <p>
                    ${escapeHtml(
                        message
                    )}
                </p>

                <a
                    href="../zone staff.html"
                    class="gestion-back">
                    ← RETOUR À LA ZONE STAFF
                </a>

            </div>
        `;
    }

    function showGlobalMessage(
        message,
        type
    ) {
        let element =
            document.getElementById(
                "gestion-global-message"
            );

        if (!element) {

            element =
                document.createElement(
                    "div"
                );

            element.id =
                "gestion-global-message";

            element.className =
                "gestion-global-message";

            document.body.appendChild(
                element
            );
        }

        element.textContent =
            message;

        element.dataset.type =
            type;

        element.classList.add(
            "visible"
        );

        clearTimeout(
            element._timer
        );

        element._timer =
            setTimeout(
                () => {
                    element.classList.remove(
                        "visible"
                    );
                },
                3500
            );
    }

    function showFormMessage(
        element,
        message,
        type
    ) {
        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.dataset.type =
            type;
    }

    function setSystemStatus(
        id,
        value,
        success
    ) {
        const element =
            document.getElementById(
                id
            );

        if (!element) {
            return;
        }

        element.textContent =
            value;

        element.classList.toggle(
            "online",
            success
        );

        element.classList.toggle(
            "offline",
            !success
        );
    }

    function emptyState(
        title,
        text
    ) {
        return `
            <div class="gestion-empty">

                <div class="empty-code">
                    //
                </div>

                <strong>
                    ${escapeHtml(
                        title
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        text
                    )}
                </span>

            </div>
        `;
    }

    function getInitials(
        value
    ) {
        if (!value) {
            return "?";
        }

        return value
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(
                word =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )
            .join("");
    }

    function getErrorMessage(
        error
    ) {
        return String(
            error?.message ||
            error?.error_description ||
            error?.details ||
            error?.hint ||
            "Une erreur inconnue est survenue."
        );
    }

    function escapeHtml(
        value
    ) {
        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }

    function escapeAttribute(
        value
    ) {
        return escapeHtml(
            value
        );
    }
})();