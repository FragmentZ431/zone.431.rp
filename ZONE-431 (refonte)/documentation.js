
/* =========================================================
   ZONE-431 — DOCUMENTATION
   documentation.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ÉLÉMENTS
       ===================================================== */

    const searchInput = document.getElementById("documentSearch");
    const filterButtons = document.querySelectorAll(".filter-button");
    const documentCards = document.querySelectorAll(".document-card");
    const documentCounter = document.getElementById("documentCounter");
    const noResults = document.getElementById("noResults");

    const mobileMenuButton = document.getElementById("mobileMenuButton");
    const mainNav = document.querySelector(".main-nav");

    let activeFilter = "all";

    /* =====================================================
       RECHERCHE ET FILTRES
       ===================================================== */

    function filterDocuments() {

        const searchValue = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        let visibleCount = 0;

        documentCards.forEach(card => {

            const category = card.dataset.category || "";
            const searchContent = (
                card.dataset.search +
                " " +
                card.textContent
            ).toLowerCase();

            const matchesCategory =
                activeFilter === "all" ||
                category === activeFilter;

            const matchesSearch =
                searchContent.includes(searchValue);

            const isVisible = matchesCategory && matchesSearch;

            card.hidden = !isVisible;

            if (isVisible) {
                visibleCount++;
            }

        });

        /* Compteur */

        if (documentCounter) {
            documentCounter.textContent =
                `${visibleCount.toString().padStart(2, "0")} DOCUMENT(S)`;
        }

        /* Aucun résultat */

        if (noResults) {
            noResults.hidden = visibleCount !== 0;
        }

    }

    /* =====================================================
       BOUTONS DE CATÉGORIES
       ===================================================== */

    filterButtons.forEach(button => {

        button.addEventListener("click", () => {

            filterButtons.forEach(filter => {
                filter.classList.remove("active");
            });

            button.classList.add("active");

            activeFilter = button.dataset.filter || "all";

            filterDocuments();

        });

    });

    /* =====================================================
       BARRE DE RECHERCHE
       ===================================================== */

    if (searchInput) {

        searchInput.addEventListener("input", () => {
            filterDocuments();
        });

    }

    /* =====================================================
       MENU MOBILE
       ===================================================== */

    if (mobileMenuButton && mainNav) {

        mobileMenuButton.addEventListener("click", () => {

            const isOpen = mainNav.classList.toggle("open");

            mobileMenuButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            mobileMenuButton.innerHTML = isOpen
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-bars"></i>';

        });

        /* Fermeture après sélection d'une page */

        mainNav.querySelectorAll("a").forEach(link => {

            link.addEventListener("click", () => {

                mainNav.classList.remove("open");

                mobileMenuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                mobileMenuButton.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

            });

        });

        /* Fermeture si clic extérieur */

        document.addEventListener("click", event => {

            const clickedInsideMenu =
                mainNav.contains(event.target) ||
                mobileMenuButton.contains(event.target);

            if (!clickedInsideMenu) {

                mainNav.classList.remove("open");

                mobileMenuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                mobileMenuButton.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

            }

        });

    }

    /* =====================================================
       INITIALISATION
       ===================================================== */

    filterDocuments();

});
