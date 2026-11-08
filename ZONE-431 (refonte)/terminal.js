document.addEventListener("DOMContentLoaded", () => {

    const startButton = document.getElementById("startButton");
    const accessSection = document.getElementById("accessSection");
    const terminalPanel = document.getElementById("terminalPanel");

    const progressFill = document.getElementById("progressFill");
    const progressPercent = document.getElementById("progressPercent");
    const progressLabel = document.getElementById("progressLabel");

    const consoleContent = document.getElementById("consoleContent");
    const resultPanel = document.getElementById("resultPanel");
    const continueContainer = document.getElementById("continueContainer");

    const terminalState = document.getElementById("terminalState");
    const continueButton = document.getElementById("continueButton");

    // Page de destination après le contrôle.
    const HOME_PAGE = "accueil.html";

    // Vérification des éléments nécessaires.
    const requiredElements = [
        startButton,
        accessSection,
        terminalPanel,
        progressFill,
        progressPercent,
        progressLabel,
        consoleContent,
        resultPanel,
        continueContainer,
        terminalState,
        continueButton
    ];

    if (requiredElements.some(element => !element)) {
        console.error("ZONE-431 : un ou plusieurs éléments HTML sont introuvables.");
        return;
    }

    let procedureStarted = false;

    const steps = [
        {
            label: "INITIALISATION DU SYSTÈME",
            message: "Initialisation du terminal central..."
        },
        {
            label: "DIAGNOSTIC MATÉRIEL",
            message: "Diagnostic des composants du terminal terminé."
        },
        {
            label: "VÉRIFICATION DU RÉSEAU",
            message: "Liaison avec le réseau interne établie."
        },
        {
            label: "CHARGEMENT DES PROTOCOLES",
            message: "Protocoles de sécurité chargés."
        },
        {
            label: "ANALYSE DE LA SESSION",
            message: "Session de navigation analysée."
        },
        {
            label: "VÉRIFICATION DES AUTORISATIONS",
            message: "Procédure de contrôle simulée terminée."
        },
        {
            label: "VALIDATION FINALE",
            message: "Accès public à l'environnement Zone-431 autorisé."
        }
    ];

    function getTime() {
        return new Date().toLocaleTimeString("fr-FR", {
            hour12: false
        });
    }

    function addLog(message, type = "INFO") {
        const line = document.createElement("div");
        line.className = "log-line";

        const time = document.createElement("span");
        time.className = "log-time";
        time.textContent = `[${getTime()}]`;

        const logType = document.createElement("span");
        logType.className = "log-type";
        logType.textContent = type;

        const logMessage = document.createElement("span");
        logMessage.className = "log-message";
        logMessage.textContent = message;

        line.append(time, logType, logMessage);
        consoleContent.appendChild(line);

        consoleContent.scrollTop = consoleContent.scrollHeight;
    }

    function updateProgress(percent, label) {
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent} %`;
        progressLabel.textContent = label;
    }

    function wait(milliseconds) {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    async function startProcedure() {
        if (procedureStarted) return;

        procedureStarted = true;

        startButton.disabled = true;
        accessSection.classList.add("hidden");
        terminalPanel.classList.remove("hidden");

        terminalState.textContent = "INITIALISATION";

        consoleContent.innerHTML = "";

        addLog("Démarrage de la procédure d'accès.");
        await wait(700);

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            progressLabel.textContent = step.label;
            addLog(step.message);

            const percent = Math.round(((i + 1) / steps.length) * 100);

            updateProgress(percent, step.label);

            await wait(1000);
        }

        await wait(500);

        addLog("Tous les contrôles simulés sont terminés.");
        addLog("Accès public autorisé.", "OK");

        terminalState.textContent = "ACCÈS AUTORISÉ";

        resultPanel.classList.remove("hidden");
        continueContainer.classList.remove("hidden");
    }

    startButton.addEventListener("click", startProcedure);

    continueButton.addEventListener("click", () => {
        window.location.href = HOME_PAGE;
    });

});