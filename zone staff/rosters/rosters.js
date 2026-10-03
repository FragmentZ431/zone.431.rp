const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   CATEGORIES
========================================================= */

const DEPARTMENTS = {

    "departement-administratif": {
        name: "Département Administratif",
        code: "D.A"
    },

    "departement-securitaire": {
        name: "Département Sécuritaire",
        code: "D.SE"
    },

    "forces-interventions-mobiles": {
        name: "Forces d'Interventions Mobiles",
        code: "F.I.M"
    },

    "departement-scientifique": {
        name: "Département Scientifique",
        code: "D.SC"
    },

    "departement-medical": {
        name: "Département Médical",
        code: "D.M"
    },

    "departement-ingenierie": {
        name: "Département d'Ingénierie et Services Techniques",
        code: "DI&ST"
    },

    "zone-carcerale": {
        name: "Zone Carcérale",
        code: "Z.C"
    },

    "groupes-interet": {
        name: "Groupes d'Intérêt",
        code: "G.I"
    }

};


let rosters = [];
let rosterMembers = {};
let isAdmin = false;


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    setupEvents();

    await checkStaffRole();

    await loadRosters();

});


/* =========================================================
   EVENEMENTS
========================================================= */

function setupEvents() {

    const search =
        document.getElementById("roster-search");

    const clear =
        document.getElementById("clear-search");

    const filter =
        document.getElementById("department-filter");

    const createButton =
        document.getElementById("create-roster-button");

    const form =
        document.getElementById("roster-admin-form");

    const closeButton =
        document.getElementById("admin-close");

    const cancelButton =
        document.getElementById("admin-cancel");

    const overlay =
        document.querySelector(".admin-overlay");

    const addMemberButton =
        document.getElementById("admin-add-member");


    search?.addEventListener("input", () => {
        renderRosters();
    });


    clear?.addEventListener("click", () => {

        if (search) {
            search.value = "";
        }

        renderRosters();

        search?.focus();

    });


    filter?.addEventListener("change", () => {
        renderRosters();
    });


    createButton?.addEventListener("click", () => {
        openCreateModal();
    });


    closeButton?.addEventListener("click", () => {
        closeModal();
    });


    cancelButton?.addEventListener("click", () => {
        closeModal();
    });


    overlay?.addEventListener("click", () => {
        closeModal();
    });


    addMemberButton?.addEventListener("click", () => {
        addMember();
    });


    form?.addEventListener("submit", async event => {

        event.preventDefault();

        await saveRoster();

    });


    document.addEventListener("click", event => {

        const edit =
            event.target.closest("[data-edit]");

        const deleteButton =
            event.target.closest("[data-delete]");

        const copy =
            event.target.closest("[data-copy]");

        const removeMember =
            event.target.closest("[data-remove-member]");


        if (edit) {

            openEditModal(
                Number(edit.dataset.edit)
            );

            return;
        }


        if (deleteButton) {

            deleteRoster(
                Number(deleteButton.dataset.delete)
            );

            return;
        }


        if (copy) {

            copyRoster(
                Number(copy.dataset.copy)
            );

            return;
        }


        if (removeMember) {

            removeMember.closest(
                ".admin-member-row"
            )?.remove();

        }

    });


    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeModal();
        }

    });

}


/* =========================================================
   ROLE ADMIN
========================================================= */

async function checkStaffRole() {

    try {

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();


        if (sessionError) {

            console.error(
                "Session error:",
                sessionError
            );

            return;

        }


        const session =
            sessionData?.session;


        if (!session?.user) {

            setAdminMode(false);

            return;

        }


        const {
            data,
            error
        } = await supabaseClient.rpc(
            "current_staff_role"
        );


        if (error) {

            console.error(
                "Role error:",
                error
            );

            setAdminMode(false);

            return;

        }


        let role = "";


        if (typeof data === "string") {

            role = data;

        } else if (Array.isArray(data)) {

            role =
                data[0]?.role ||
                data[0] ||
                "";

        } else if (
            data &&
            typeof data === "object"
        ) {

            role = data.role || "";

        }


        role =
            String(role)
                .trim()
                .toUpperCase();


        setAdminMode(
            role === "ADMINISTRATEUR"
        );


    } catch (error) {

        console.error(
            "checkStaffRole:",
            error
        );

        setAdminMode(false);

    }

}


function setAdminMode(value) {

    isAdmin = value;

    const toolbar =
        document.getElementById(
            "roster-admin-toolbar"
        );


    if (!toolbar) {
        return;
    }


    toolbar.hidden = !value;

}


/* =========================================================
   CHARGEMENT SUPABASE
========================================================= */

async function loadRosters() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("roster")
            .select("*")
            .order("nom", {
                ascending: true
            });


        if (error) {

            console.error(
                "Roster loading error:",
                error
            );

            showNotification(
                "Impossible de charger les rosters.",
                "error"
            );

            return;

        }


        rosters = data || [];


        await loadMembers();


        renderRosters();


    } catch (error) {

        console.error(
            "loadRosters:",
            error
        );

        showNotification(
            "Erreur de chargement.",
            "error"
        );

    }

}


/* =========================================================
   MEMBRES
========================================================= */

async function loadMembers() {

    rosterMembers = {};


    if (!rosters.length) {
        return;
    }


    const ids =
        rosters.map(roster => roster.id);


    const {
        data,
        error
    } = await supabaseClient
        .from("roster_members")
        .select("*")
        .in("roster_id", ids)
        .order("id", {
            ascending: true
        });


    if (error) {

        console.error(
            "Members loading error:",
            error
        );

        return;

    }


    for (const member of data || []) {

        if (!rosterMembers[member.roster_id]) {

            rosterMembers[member.roster_id] = [];

        }


        rosterMembers[
            member.roster_id
        ].push(member);

    }

}


/* =========================================================
   NORMALISATION DEPARTEMENT
========================================================= */

function normalizeDepartment(value) {

    if (!value) {
        return "";
    }


    const text =
        String(value)
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            );


    if (
        text.startsWith("D.SE") ||
        text.startsWith("DSE")
    ) {

        return "departement-securitaire";

    }


    if (
        text.startsWith("FIM") ||
        text.startsWith("F.I.M") ||
        text.includes(
            "FORCE D'INTERVENTION MOBILE"
        ) ||
        text.includes(
            "FORCES D'INTERVENTIONS MOBILES"
        )
    ) {

        return "forces-interventions-mobiles";

    }


    if (
        text.startsWith("D.SC") ||
        text.startsWith("DSC")
    ) {

        return "departement-scientifique";

    }


    if (
        text.startsWith("D.M") ||
        text.startsWith("DM")
    ) {

        return "departement-medical";

    }


    if (
        text.startsWith("D.A") ||
        text.startsWith("DA")
    ) {

        return "departement-administratif";

    }


    if (
        text.startsWith("DI&ST") ||
        text.startsWith("D.I.S.T") ||
        text.startsWith("DIST")
    ) {

        return "departement-ingenierie";

    }


    if (
        text.startsWith("Z.C") ||
        text.startsWith("ZC") ||
        text.startsWith("CLASSE-DELTA") ||
        text.startsWith("CLASSE DELTA") ||
        text === "CD" ||
        text.startsWith("CD ")
    ) {

        return "zone-carcerale";

    }


    if (
        text.startsWith("G.I") ||
        text.startsWith("GI") ||
        text.startsWith("GROUPE D'INTERET") ||
        text.startsWith("GROUPES D'INTERET")
    ) {

        return "groupes-interet";

    }


    return "";

}


/* =========================================================
   FILTRAGE
========================================================= */

function getFilteredRosters() {

    const searchInput =
        document.getElementById(
            "roster-search"
        );


    const filter =
        document.getElementById(
            "department-filter"
        );


    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();


    const selected =
        filter?.value || "all";


    return rosters.filter(roster => {

        const category =
            normalizeDepartment(
                roster.departement
            );


        if (
            selected !== "all" &&
            category !== selected
        ) {

            return false;

        }


        if (!search) {
            return true;
        }


        const player =
            String(
                roster.joueur || ""
            ).toLowerCase();


        const members =
            rosterMembers[roster.id] || [];


        const memberMatch =
            members.some(member => {

                const ig =
                    String(
                        member.pseudo_ig || ""
                    ).toLowerCase();


                return ig.includes(search);

            });


        return (
            player.includes(search) ||
            memberMatch
        );

    });

}


/* =========================================================
   RENDU
========================================================= */

function renderRosters() {

    const filtered =
        getFilteredRosters();


    const count =
        document.getElementById(
            "roster-result-count"
        );


    if (count) {
        count.textContent =
            filtered.length;
    }


    for (
        const categoryKey
        of Object.keys(DEPARTMENTS)
    ) {

        const category =
            document.querySelector(
                `.roster-category[data-category="${categoryKey}"]`
            );


        if (!category) {
            continue;
        }


        const list =
            category.querySelector(
                ".roster-list"
            );


        const counter =
            category.querySelector(
                `[data-count="${categoryKey}"]`
            );


        const categoryRosters =
            filtered.filter(roster => {

                return (
                    normalizeDepartment(
                        roster.departement
                    ) === categoryKey
                );

            });


        if (counter) {
            counter.textContent =
                categoryRosters.length;
        }


        if (!categoryRosters.length) {

            category.hidden = true;

            if (list) {
                list.innerHTML = "";
            }

            continue;

        }


        category.hidden = false;


        if (!list) {
            continue;
        }


        list.innerHTML = "";


        categoryRosters.forEach(roster => {

            list.appendChild(
                createRosterCard(roster)
            );

        });

    }


    const empty =
        document.getElementById(
            "roster-search-empty"
        );


    if (empty) {
        empty.hidden =
            filtered.length !== 0;
    }

}


/* =========================================================
   CARTE
========================================================= */

function createRosterCard(roster) {

    const card =
        document.createElement("article");


    card.className =
        "roster-card";


    const category =
        normalizeDepartment(
            roster.departement
        );


    const department =
        DEPARTMENTS[category];


    const members =
        rosterMembers[roster.id] || [];


    const status =
        roster.statut || "Actif";


    const statusClass =
        status
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /\s+/g,
                "-"
            );


    card.innerHTML = `

        <div class="roster-card-header">

            <div class="roster-card-title">

                <h3>
                    ${escapeHtml(
                        roster.nom ||
                        "Roster sans nom"
                    )}
                </h3>

                <span class="roster-status ${escapeHtml(statusClass)}">
                    ${escapeHtml(status)}
                </span>

            </div>


            ${
                isAdmin
                    ? `

                        <div class="roster-card-actions">

                            <button
                                type="button"
                                class="roster-action-button"
                                data-copy="${roster.id}"
                            >
                                COPIER
                            </button>

                            <button
                                type="button"
                                class="roster-action-button"
                                data-edit="${roster.id}"
                            >
                                MODIFIER
                            </button>

                            <button
                                type="button"
                                class="roster-action-button danger"
                                data-delete="${roster.id}"
                            >
                                SUPPRIMER
                            </button>

                        </div>

                    `
                    : ""
            }

        </div>


        <div class="roster-card-body">

            <div class="roster-info-grid">

                <div class="roster-info-item">

                    <span class="roster-info-label">
                        Département
                    </span>

                    <span class="roster-info-value">
                        ${escapeHtml(
                            department?.name ||
                            roster.departement ||
                            "—"
                        )}
                    </span>

                </div>


                <div class="roster-info-item">

                    <span class="roster-info-label">
                        Grade
                    </span>

                    <span class="roster-info-value">
                        ${escapeHtml(
                            roster.grade || "—"
                        )}
                    </span>

                </div>


                <div class="roster-info-item">

                    <span class="roster-info-label">
                        Joueur In Game
                    </span>

                    <span class="roster-info-value">
                        ${escapeHtml(
                            roster.joueur || "—"
                        )}
                    </span>

                </div>


                <div class="roster-info-item">

                    <span class="roster-info-label">
                        Responsable
                    </span>

                    <span class="roster-info-value">
                        ${escapeHtml(
                            roster.responsable || "—"
                        )}
                    </span>

                </div>

            </div>


            ${
                roster.description
                    ? `

                        <div class="roster-description">

                            ${escapeHtml(
                                roster.description
                            )}

                        </div>

                    `
                    : ""
            }


            ${
                members.length
                    ? `

                        <div class="roster-members">

                            <div class="roster-members-title">
                                EFFECTIF // ${members.length}
                            </div>


                            <div class="roster-members-list">

                                ${members.map(member => `

                                    <div class="roster-member">

                                        <span class="roster-member-ig">

                                            ${escapeHtml(
                                                member.pseudo_ig ||
                                                "—"
                                            )}

                                        </span>


                                        ${
                                            member.pseudo_discord
                                                ? `

                                                    <span class="roster-member-discord">

                                                        ${escapeHtml(
                                                            member.pseudo_discord
                                                        )}

                                                    </span>

                                                `
                                                : ""
                                        }

                                    </div>

                                `).join("")}

                            </div>

                        </div>

                    `
                    : ""
            }

        </div>

    `;


    return card;

}


/* =========================================================
   CREATION
========================================================= */

function openCreateModal() {

    if (!isAdmin) {
        return;
    }


    document.getElementById(
        "admin-modal-title"
    ).textContent =
        "CRÉER UN ROSTER";


    document.getElementById(
        "roster-admin-form"
    ).reset();


    document.getElementById(
        "admin-roster-id"
    ).value = "";


    document.getElementById(
        "admin-members-list"
    ).innerHTML = "";


    clearError();


    document.getElementById(
        "roster-admin-modal"
    ).hidden = false;


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   MODIFICATION
========================================================= */

function openEditModal(id) {

    if (!isAdmin) {
        return;
    }


    const roster =
        rosters.find(
            item =>
                Number(item.id) === Number(id)
        );


    if (!roster) {
        return;
    }


    document.getElementById(
        "admin-modal-title"
    ).textContent =
        "MODIFIER UN ROSTER";


    document.getElementById(
        "admin-roster-id"
    ).value =
        roster.id;


    document.getElementById(
        "admin-department"
    ).value =
        getAdminDepartmentValue(
            roster.departement
        );


    document.getElementById(
        "admin-nom"
    ).value =
        roster.nom || "";


    document.getElementById(
        "admin-grade"
    ).value =
        roster.grade || "";


    document.getElementById(
        "admin-joueur"
    ).value =
        roster.joueur || "";


    document.getElementById(
        "admin-statut"
    ).value =
        roster.statut || "Actif";


    document.getElementById(
        "admin-responsable"
    ).value =
        roster.responsable || "";


    document.getElementById(
        "admin-description"
    ).value =
        roster.description || "";


    const membersList =
        document.getElementById(
            "admin-members-list"
        );


    membersList.innerHTML = "";


    const members =
        rosterMembers[roster.id] || [];


    members.forEach(member => {

        addMember(
            member.pseudo_ig || "",
            member.pseudo_discord || ""
        );

    });


    clearError();


    document.getElementById(
        "roster-admin-modal"
    ).hidden = false;


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   VALEUR DEPARTEMENT ADMIN
========================================================= */

function getAdminDepartmentValue(value) {

    const category =
        normalizeDepartment(value);


    const values = {

        "departement-administratif": "D.A",

        "departement-securitaire": "D.SE",

        "forces-interventions-mobiles": "F.I.M",

        "departement-scientifique": "D.SC",

        "departement-medical": "D.M",

        "departement-ingenierie": "DI&ST",

        "zone-carcerale": "Z.C",

        "groupes-interet": "G.I"

    };


    return values[category] || "";

}


/* =========================================================
   FERMETURE MODAL
========================================================= */

function closeModal() {

    const modal =
        document.getElementById(
            "roster-admin-modal"
        );


    if (!modal) {
        return;
    }


    modal.hidden = true;


    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   MEMBRES
========================================================= */

function addMember(
    pseudoIG = "",
    pseudoDiscord = ""
) {

    const list =
        document.getElementById(
            "admin-members-list"
        );


    const row =
        document.createElement("div");


    row.className =
        "admin-member-row";


    row.innerHTML = `

        <input
            type="text"
            class="admin-member-ig"
            placeholder="Pseudo In Game"
            value="${escapeAttribute(
                pseudoIG
            )}"
        >


        <input
            type="text"
            class="admin-member-discord"
            placeholder="Pseudo Discord"
            value="${escapeAttribute(
                pseudoDiscord
            )}"
        >


        <button
            type="button"
            class="admin-member-remove"
            data-remove-member
        >
            RETIRER
        </button>

    `;


    list.appendChild(row);

}


/* =========================================================
   SAUVEGARDE
========================================================= */

async function saveRoster() {

    if (!isAdmin) {
        return;
    }


    const submit =
        document.getElementById(
            "admin-submit"
        );


    submit.disabled = true;


    clearError();


    try {

        const id =
            document.getElementById(
                "admin-roster-id"
            ).value;


        const rosterData = {

            departement:
                document.getElementById(
                    "admin-department"
                ).value,

            nom:
                document.getElementById(
                    "admin-nom"
                ).value.trim(),

            grade:
                document.getElementById(
                    "admin-grade"
                ).value.trim(),

            joueur:
                document.getElementById(
                    "admin-joueur"
                ).value.trim(),

            statut:
                document.getElementById(
                    "admin-statut"
                ).value,

            responsable:
                document.getElementById(
                    "admin-responsable"
                ).value.trim(),

            description:
                document.getElementById(
                    "admin-description"
                ).value.trim()

        };


        if (!rosterData.departement) {
            throw new Error(
                "Sélectionne un département."
            );
        }


        if (!rosterData.nom) {
            throw new Error(
                "Le nom du roster est obligatoire."
            );
        }


        let rosterId;


        if (id) {

            const {
                error
            } = await supabaseClient
                .from("roster")
                .update(rosterData)
                .eq("id", Number(id));


            if (error) {
                throw error;
            }


            rosterId = Number(id);

        } else {

            const {
                data,
                error
            } = await supabaseClient
                .from("roster")
                .insert(rosterData)
                .select()
                .single();


            if (error) {
                throw error;
            }


            rosterId = data.id;

        }


        /* Suppression des anciens membres */

        const {
            error: deleteError
        } = await supabaseClient
            .from("roster_members")
            .delete()
            .eq(
                "roster_id",
                rosterId
            );


        if (deleteError) {
            throw deleteError;
        }


        /* Nouveaux membres */

        const rows =
            getMembersFromForm();


        if (rows.length) {

            const {
                error
            } = await supabaseClient
                .from("roster_members")
                .insert(
                    rows.map(member => ({
                        roster_id: rosterId,
                        pseudo_ig:
                            member.ig,
                        pseudo_discord:
                            member.discord
                    }))
                );


            if (error) {
                throw error;
            }

        }


        closeModal();


        await loadRosters();


        showNotification(
            id
                ? "Roster modifié."
                : "Roster créé.",
            "success"
        );


    } catch (error) {

        console.error(
            "Save roster:",
            error
        );


        showError(
            error?.message ||
            "Impossible d'enregistrer le roster."
        );

    } finally {

        submit.disabled = false;

    }

}


/* =========================================================
   RECUPERATION MEMBRES FORMULAIRE
========================================================= */

function getMembersFromForm() {

    const rows =
        document.querySelectorAll(
            "#admin-members-list .admin-member-row"
        );


    return Array.from(rows)
        .map(row => {

            const ig =
                row.querySelector(
                    ".admin-member-ig"
                );


            const discord =
                row.querySelector(
                    ".admin-member-discord"
                );


            return {

                ig:
                    ig?.value.trim() || "",

                discord:
                    discord?.value.trim() || ""

            };

        })
        .filter(member => {

            return (
                member.ig ||
                member.discord
            );

        });

}


/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteRoster(id) {

    if (!isAdmin) {
        return;
    }


    const roster =
        rosters.find(
            item =>
                Number(item.id) === Number(id)
        );


    if (!roster) {
        return;
    }


    const confirmed =
        window.confirm(
            `Supprimer le roster "${roster.nom}" ?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await supabaseClient
            .from("roster_members")
            .delete()
            .eq(
                "roster_id",
                id
            );


        const {
            error
        } = await supabaseClient
            .from("roster")
            .delete()
            .eq("id", id);


        if (error) {
            throw error;
        }


        await loadRosters();


        showNotification(
            "Roster supprimé.",
            "success"
        );


    } catch (error) {

        console.error(
            "Delete roster:",
            error
        );


        showNotification(
            "Impossible de supprimer le roster.",
            "error"
        );

    }

}


/* =========================================================
   COPIE
========================================================= */

async function copyRoster(id) {

    const roster =
        rosters.find(
            item =>
                Number(item.id) === Number(id)
        );


    if (!roster) {
        return;
    }


    const members =
        rosterMembers[roster.id] || [];


    const text = [

        `ROSTER : ${roster.nom || "—"}`,

        `Département : ${
            roster.departement || "—"
        }`,

        `Grade : ${
            roster.grade || "—"
        }`,

        `Joueur : ${
            roster.joueur || "—"
        }`,

        `Statut : ${
            roster.statut || "—"
        }`,

        `Responsable : ${
            roster.responsable || "—"
        }`,

        roster.description
            ? `Description : ${roster.description}`
            : "",

        members.length
            ? `Membres : ${members
                .map(member =>
                    member.pseudo_ig
                )
                .filter(Boolean)
                .join(", ")}`
            : ""

    ]
        .filter(Boolean)
        .join("\n");


    try {

        await navigator.clipboard.writeText(
            text
        );


        showNotification(
            "Roster copié.",
            "success"
        );


    } catch (error) {

        console.error(
            "Copy:",
            error
        );


        showNotification(
            "Impossible de copier.",
            "error"
        );

    }

}


/* =========================================================
   ERREURS
========================================================= */

function showError(message) {

    const element =
        document.getElementById(
            "admin-error"
        );


    if (!element) {
        return;
    }


    element.textContent = message;

    element.hidden = false;

}


function clearError() {

    const element =
        document.getElementById(
            "admin-error"
        );


    if (!element) {
        return;
    }


    element.textContent = "";

    element.hidden = true;

}


/* =========================================================
   NOTIFICATION
========================================================= */

function showNotification(
    message,
    type = "success"
) {

    const element =
        document.getElementById(
            "roster-notification"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `notification ${type} show`;


    clearTimeout(
        element._timer
    );


    element._timer =
        setTimeout(() => {

            element.classList.remove(
                "show"
            );

        }, 3000);

}


/* =========================================================
   SECURITE HTML
========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHtml(value);

}