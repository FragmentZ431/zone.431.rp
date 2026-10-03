const departments = {

    dse: {
        code: "D.SE",
        title: "DÉPARTEMENT DE LA SÉCURITÉ",
        description: `
Le Département de la Sécurité est responsable de la protection
de l'ensemble du personnel et des infrastructures de la Zone-431.

Ses membres assurent la surveillance des différents secteurs,
le contrôle des accès, la gestion des situations dangereuses
ainsi que la protection des zones de confinement.

Le département constitue également l'une des principales forces
chargées du maintien de l'ordre au sein du site.
`
    },

    dsci: {
        code: "D.SCI",
        title: "DÉPARTEMENT SCIENTIFIQUE",
        description: `
Le Département Scientifique est chargé de l'étude des anomalies
contenues ou observées par la Zone-431.

Les chercheurs travaillent notamment sur l'observation,
l'analyse et la compréhension des phénomènes anormaux.

Le département travaille régulièrement avec les autres services
lorsque les connaissances scientifiques sont nécessaires
à la gestion d'une anomalie.
`
    },

    dm: {
        code: "D.M",
        title: "DÉPARTEMENT MÉDICAL",
        description: `
Le Département Médical assure la prise en charge sanitaire
du personnel de la Zone-431.

Ses membres interviennent notamment lors des blessures,
accidents et situations nécessitant une assistance médicale.

Le département dispose également d'un rôle important lors
des opérations et incidents pouvant entraîner des blessés.
`
    },

    da: {
        code: "D.A",
        title: "DÉPARTEMENT ADMINISTRATIF",
        description: `
Le Département Administratif est chargé de la gestion interne
de la Zone-431.

Il participe à l'organisation du personnel, au suivi
administratif et à la gestion des différentes ressources
nécessaires au fonctionnement du site.

Il travaille avec la direction ainsi qu'avec les différents
départements de la Zone-431.
`
    },

    fim: {
        code: "F.I.M",
        title: "FORCES D'INTERVENTION MOBILE",
        description: `
Les Forces d'Intervention Mobile sont des unités spécialisées
opérant principalement en dehors de la Zone-431.

Elles sont déployées lorsque les moyens ordinaires du site
ne sont pas suffisants pour gérer une situation.

L'accès aux F.I.M est soumis à des conditions particulières.
Il faut notamment être PC et avoir au minimum 14 ans.

Une personne appartenant aux F.I.M ne peut pas également
appartenir aux Groupes d'Intérêt sur un autre personnage.
Le choix entre F.I.M et G.D.I doit être respecté.
`
    },

    cd: {
        code: "C.D",
        title: "CLASSE DELTA",
        description: `
La Classe Delta regroupe les individus affectés à des fonctions
spécifiques au sein de la Fondation.

Leur utilisation et leurs conditions d'affectation dépendent
des protocoles et des besoins de la Zone-431.

Leur présence dans le site est strictement encadrée.
`
    },

    gdi: {
        code: "G.D.I",
        title: "GROUPES D'INTÉRÊT",
        description: `
Les Groupes d'Intérêt sont des organisations extérieures
à la Zone-431 et à la Fondation SCP.

Certains de ces groupes entretiennent des relations
hostiles avec la Fondation et peuvent représenter une menace
pour ses installations et son personnel.

Les G.D.I constituent donc une catégorie extérieure au site
et ne font pas partie de l'organisation interne de la Zone-431.

Un personnage appartenant aux G.D.I ne peut pas également
appartenir aux F.I.M sur un autre personnage.
`
    },

    dist: {
        code: "DI&ST",
        title: "DÉPARTEMENT D'INGÉNIERIE ET SERVICES TECHNIQUES",
        description: `
Le Département d'Ingénierie et Services Techniques assure
le fonctionnement technique de la Zone-431.

Ses membres peuvent intervenir sur les infrastructures,
les équipements, les installations électriques, les systèmes
techniques et différents dispositifs nécessaires au
fonctionnement quotidien du site.

Le DI&ST joue donc un rôle essentiel dans la maintenance
et la continuité des opérations de la Zone-431.
`
    }

};


function openDepartment(id) {

    const department = departments[id];

    if (!department) {
        console.error("Département introuvable :", id);
        return;
    }

    document.getElementById("modalCode").textContent =
        department.code;

    document.getElementById("modalTitle").textContent =
        department.title;

    document.getElementById("modalDescription").textContent =
        department.description.trim();

    document.getElementById("departmentModal").classList.add("show");

}


function closeDepartment() {

    document
        .getElementById("departmentModal")
        .classList.remove("show");

}


/* Clic sur le fond */

document
    .getElementById("departmentModal")
    .addEventListener("click", function () {

        closeDepartment();

    });


/* Touche Échap */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeDepartment();

    }

});