/* =========================================================
   ZONE-431 — CENTRE DE NOTIFICATIONS
   Fichier : membre/notifications.js
   ========================================================= */

(() => {
    "use strict";

    const auth = window.Zone431Auth;
    if (!auth || !auth.client) return;

    const client = auth.client;
    let currentUserId = null;
    let channel = null;
    let widget = null;
    let panel = null;
    let list = null;
    let badge = null;
    let loadInProgress = false;

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function formatDate(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function safeHref(value) {
        const href = String(value || "");
        if (/^document\.html\?id=[0-9a-f-]{36}$/i.test(href)) return href;
        if (["formations.html", "documentation.html", "departement.html", "profil.html", "accueil.html"].includes(href)) {
            return href;
        }
        return "accueil.html";
    }

    function setUnreadCount(count) {
        const value = Number(count) || 0;
        badge.textContent = value > 99 ? "99+" : String(value);
        widget.querySelector(".notification-toggle")?.setAttribute(
            "aria-label",
            value > 0 ? `Ouvrir les notifications, ${value} non lue${value > 1 ? "s" : ""}` : "Ouvrir les notifications"
        );
        badge.hidden = value === 0;
        widget.classList.toggle("has-unread", value > 0);
    }

    function renderNotifications(items) {
        list.replaceChildren();

        if (!items.length) {
            const empty = createElement("div", "notification-empty");
            const icon = createElement("i", "fa-regular fa-bell-slash");
            const title = createElement("strong", "", "Aucune notification");
            const text = createElement("span", "", "Les nouvelles informations apparaîtront ici.");
            empty.append(icon, title, text);
            list.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const link = createElement("a", "notification-item");
            link.href = safeHref(item.href);
            link.classList.toggle("is-unread", !item.read_at);

            const iconWrap = createElement("span", "notification-item-icon");
            const iconName = item.notification_type === "training"
                ? "fa-graduation-cap"
                : item.notification_type === "result"
                    ? "fa-award"
                    : item.notification_type === "account"
                        ? "fa-user-check"
                        : item.notification_type === "announcement"
                            ? "fa-bullhorn"
                            : "fa-file-lines";
            iconWrap.appendChild(createElement("i", "fa-solid " + iconName));

            const content = createElement("span", "notification-item-content");
            const title = createElement("strong", "", item.title || "Notification");
            const message = createElement("span", "notification-item-message", item.message || "");
            const date = createElement("time", "notification-item-date", formatDate(item.created_at));

            content.append(title, message, date);
            link.append(iconWrap, content);

            if (!item.read_at) {
                const dot = createElement("span", "notification-unread-dot");
                link.appendChild(dot);
            }

            link.addEventListener("click", async event => {
                if (!item.read_at) {
                    event.preventDefault();
                    await markAsRead(item.id);
                    window.location.href = safeHref(item.href);
                }
            });

            list.appendChild(link);
        });
    }

    async function loadNotifications() {
        if (!currentUserId || loadInProgress) return;
        loadInProgress = true;

        try {
            const [listResult, countResult] = await Promise.all([
                client
                    .from("member_notifications")
                    .select("id,notification_type,title,message,href,read_at,created_at")
                    .eq("user_id", currentUserId)
                    .order("created_at", { ascending: false })
                    .limit(30),
                client
                    .from("member_notifications")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", currentUserId)
                    .is("read_at", null)
            ]);

            if (listResult.error) throw listResult.error;
            if (countResult.error) throw countResult.error;

            renderNotifications(listResult.data || []);
            setUnreadCount(countResult.count || 0);
        } catch (error) {
            console.error("[ZONE-431] Chargement des notifications impossible :", error);
            list.replaceChildren(
                createElement("div", "notification-error", "Impossible de charger les notifications.")
            );
        } finally {
            loadInProgress = false;
        }
    }

    async function markAsRead(notificationId) {
        const { error } = await client
            .from("member_notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", notificationId)
            .eq("user_id", currentUserId);

        if (error) {
            console.error("[ZONE-431] Impossible de marquer la notification comme lue :", error);
        }
        await loadNotifications();
    }

    async function markAllAsRead() {
        if (!currentUserId) return;

        const { error } = await client
            .from("member_notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", currentUserId)
            .is("read_at", null);

        if (error) {
            console.error("[ZONE-431] Impossible de marquer toutes les notifications comme lues :", error);
            return;
        }

        await loadNotifications();
    }

    function closePanel() {
        if (!panel || !widget) return;
        panel.hidden = true;
        widget.querySelector(".notification-toggle")?.setAttribute("aria-expanded", "false");
        widget.querySelector(".notification-toggle")?.setAttribute("aria-label", "Ouvrir les notifications");
    }

    function buildWidget() {
        const header = document.querySelector(
            ".member-header, .results-header, .page-header, .main-header, .topbar"
        );
        if (widget) return;

        widget = createElement("div", "notification-widget");
        if (!header) {
            widget.classList.add("notification-widget-floating");
        }

        const toggle = createElement("button", "notification-toggle");
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Ouvrir les notifications");
        toggle.setAttribute("aria-expanded", "false");

        const icon = createElement("i", "fa-solid fa-bell");
        badge = createElement("span", "notification-count", "0");
        badge.hidden = true;
        toggle.append(icon, badge);

        panel = createElement("section", "notification-panel");
        panel.hidden = true;
        panel.setAttribute("aria-label", "Centre de notifications");

        const heading = createElement("div", "notification-panel-heading");
        const headingText = createElement("div", "");
        headingText.append(
            createElement("span", "notification-eyebrow", "ESPACE PERSONNEL"),
            createElement("strong", "", "NOTIFICATIONS")
        );

        const markAll = createElement("button", "notification-mark-all", "TOUT LIRE");
        markAll.type = "button";
        markAll.addEventListener("click", markAllAsRead);
        heading.append(headingText, markAll);

        list = createElement("div", "notification-list");
        panel.append(heading, list);
        widget.append(toggle, panel);

        toggle.addEventListener("click", () => {
            const opening = panel.hidden;
            panel.hidden = !opening;
            toggle.setAttribute("aria-expanded", String(opening));
            toggle.setAttribute("aria-label", opening ? "Fermer les notifications" : "Ouvrir les notifications");
            if (opening) loadNotifications();
        });

        document.addEventListener("click", event => {
            if (widget && !widget.contains(event.target)) closePanel();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closePanel();
        });

        if (!header) {
            document.body.appendChild(widget);
            return;
        }

        if (header.classList.contains("topbar")) {
            const right = header.querySelector(".topbar-right") || header;
            const avatar = right.querySelector(".user-avatar");
            if (avatar) right.insertBefore(widget, avatar);
            else right.appendChild(widget);
            return;
        }

        const anchor = header.querySelector(
            ".header-back, .member-access, .nav-staff, .header-status"
        );
        if (anchor) header.insertBefore(widget, anchor);
        else header.appendChild(widget);
    }

    async function initialize() {
        try {
            const access = await auth.getAccess();

            if (access.status !== "authorized" || !access.user) {
                removeWidget();
                return;
            }

            if (currentUserId === access.user.id && widget) return;

            removeWidget();
            currentUserId = access.user.id;
            buildWidget();

            if (!widget) return;

            await loadNotifications();

            channel = client
                .channel("member-notifications-" + currentUserId)
                .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "member_notifications",
                    filter: "user_id=eq." + currentUserId
                }, () => loadNotifications())
                .subscribe();
        } catch (error) {
            console.error("[ZONE-431] Initialisation des notifications impossible :", error);
        }
    }

    function removeWidget() {
        if (channel) {
            client.removeChannel(channel);
            channel = null;
        }
        if (widget) widget.remove();
        widget = null;
        panel = null;
        list = null;
        badge = null;
        currentUserId = null;
    }

    auth.subscribe((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            removeWidget();
            return;
        }

        if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
            initialize();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();