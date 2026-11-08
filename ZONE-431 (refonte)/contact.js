
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.innerHTML = isOpen
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
    });
}

const copyEmailButton = document.getElementById("copyEmail");
const emailAddress = document.getElementById("emailAddress");
const copyNotification = document.getElementById("copyNotification");

if (copyEmailButton && emailAddress && copyNotification) {
    copyEmailButton.addEventListener("click", async () => {
        const email = emailAddress.textContent.trim();

        try {
            await navigator.clipboard.writeText(email);

            copyNotification.textContent = "Adresse e-mail copiée.";
            copyNotification.classList.add("visible");

            copyEmailButton.innerHTML = '<i class="fa-solid fa-check"></i>';

            setTimeout(() => {
                copyNotification.classList.remove("visible");
                copyEmailButton.innerHTML = '<i class="fa-regular fa-copy"></i>';
            }, 2200);

        } catch (error) {
            copyNotification.textContent = "Copie impossible. Sélectionnez l'adresse manuellement.";
            copyNotification.classList.add("visible");

            setTimeout(() => {
                copyNotification.classList.remove("visible");
            }, 3000);
        }
    });
}
