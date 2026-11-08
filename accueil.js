document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // CONFIGURATION SUPABASE
    // ==========================================

    const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

    // ==========================================
    // ÉLÉMENTS HTML
    // ==========================================

    const agentCount = document.getElementById("agentCount");
    const counterStatus = document.getElementById("counterStatus");
    const currentYear = document.getElementById("currentYear");

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const navLinks = document.querySelectorAll(".nav-link");

    // ==========================================
    // ANNÉE AUTOMATIQUE
    // ==========================================

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // ==========================================
    // MENU MOBILE
    // ==========================================

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("open");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Fermer le menu" : "Ouvrir le menu"
            );
        });

        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Ouvrir le menu");
            });
        });

        document.addEventListener("click", event => {
            const clickedInsideMenu = mainNav.contains(event.target);
            const clickedToggle = menuToggle.contains(event.target);

            if (!clickedInsideMenu && !clickedToggle) {
                mainNav.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Ouvrir le menu");
            }
        });
    }

    // ==========================================
    // LIEN ACTIF DANS LA NAVIGATION
    // ==========================================

    const sections = document.querySelectorAll("main section[id]");

    if ("IntersectionObserver" in window) {

        const sectionObserver = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) {
                    return;
                }

                const sectionId = entry.target.id;

                navLinks.forEach(link => {
                    const isActive = link.getAttribute("href") === `#${sectionId}`;
                    link.classList.toggle("active", isActive);
                });

            });

        }, {
            rootMargin: "-30% 0px -60% 0px",
            threshold: 0
        });

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }

    // ==========================================
    // COMPTEUR DES AGENTS RP AUTORISÉS
    // ==========================================

    async function loadAuthorizedAgentCount() {

        if (!agentCount || !counterStatus) {
            return;
        }

        agentCount.textContent = "---";
        counterStatus.textContent = "CONNEXION...";

        try {

            if (!window.supabase || typeof window.supabase.createClient !== "function") {
                throw new Error("La bibliothèque Supabase n'a pas été chargée.");
            }

            const supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

            const { data, error } = await supabaseClient.rpc(
                "get_authorized_rp_agent_count"
            );

            if (error) {
                throw error;
            }

            const count = Number(data);

            if (!Number.isFinite(count) || count < 0) {
                throw new Error("Le compteur a retourné une valeur invalide.");
            }

            agentCount.textContent = count.toLocaleString("fr-FR");
            counterStatus.textContent = "DONNÉES ACTUALISÉES";

        } catch (error) {

            console.error(
                "[ZONE-431] Impossible de récupérer l'effectif RP :",
                error
            );

            agentCount.textContent = "N/D";
            counterStatus.textContent = "DONNÉES INDISPONIBLES";
        }
    }

    loadAuthorizedAgentCount();

});