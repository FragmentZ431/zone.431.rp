
/* =========================================================
   ZONE-431 — LECTURE DOCUMENTAIRE
   Fichier : membre/document.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const auth = window.Zone431Auth;

    if (!auth) {
        console.error("[ZONE-431] Module d'authentification absent.");
        return;
    }

    const elements = {
        loading: document.getElementById("documentLoading"),
        error: document.getElementById("documentError"),
        errorTitle: document.getElementById("documentErrorTitle"),
        errorMessage: document.getElementById("documentErrorMessage"),
        reader: document.getElementById("documentReader"),

        category: document.getElementById("documentCategory"),
        title: document.getElementById("documentTitle"),
        summary: document.getElementById("documentSummary"),
        date: document.getElementById("documentDate"),
        accreditation: document.getElementById("documentAccreditation"),
        content: document.getElementById("documentContent")
    };

    function showView(view) {
        elements.loading.hidden = true;
        elements.error.hidden = true;
        elements.reader.hidden = true;

        view.hidden = false;
    }

    function formatDate(value) {
        if (!value) return "Date non renseignée";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date non renseignée";
        }

        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function showError(title, message) {
        elements.errorTitle.textContent = title;
        elements.errorMessage.textContent = message;

        showView(elements.error);
    }

    async function loadDocument() {
        showView(elements.loading);

        try {
            // Contrôle d'accès
            const access = await auth.protectPage();

            if (!access) return;

            // Récupération de l'identifiant du document
            const params = new URLSearchParams(window.location.search);
            const documentId = params.get("id");

            if (!documentId) {
                showError(
                    "DOCUMENT NON SÉLECTIONNÉ",
                    "Aucun identifiant documentaire n'a été fourni."
                );
                return;
            }

            // Récupération du document publié
            const { data, error } = await auth.client
                .from("member_documents")
                .select(`
                    id,
                    title,
                    slug,
                    category,
                    summary,
                    content,
                    required_accreditation,
                    created_at,
                    updated_at
                `)
                .eq("id", documentId)
                .eq("is_published", true)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                showError(
                    "DOCUMENT INTROUVABLE",
                    "Ce document n'existe pas, n'est plus publié ou n'est pas accessible."
                );
                return;
            }

            // Affichage sécurisé du contenu
            elements.category.textContent =
                data.category || "DOCUMENT INTERNE";

            elements.title.textContent =
                data.title || "Document sans titre";

            elements.summary.textContent =
                data.summary || "";
            elements.accreditation.textContent =
                `ACCRÉDITATION REQUISE : ${data.required_accreditation || "ACC 0"}`;

            elements.date.innerHTML =
                `<i class="fa-regular fa-calendar"></i> ${formatDate(data.created_at)}`;

            elements.content.textContent =
                data.content || "Ce document ne contient aucun texte.";

            document.title =
                `${data.title || "Document"} | ZONE-431`;

            showView(elements.reader);

        } catch (error) {
            console.error("[ZONE-431] Erreur de lecture :", error);

            showError(
                "LECTURE IMPOSSIBLE",
                "Une erreur est survenue lors de la récupération du document. Réessayez ultérieurement."
            );
        }
    }

    auth.subscribe((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            window.location.replace("accueil.html");
        }
    });

    loadDocument();
});
