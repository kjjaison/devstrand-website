/* DEVSTRAND — site interactions */

(function () {
  "use strict";

  const root = document.documentElement;
  const STORAGE_KEY = "devstrand-theme";

  /* Theme */
  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  setTheme(getPreferredTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
    });
  });

  /* Mobile nav */
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");

  if (nav && toggle) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* Header scroll */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Active nav link */
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });

  /* Reveal on scroll */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
  }

  /* Contact form (client-side demo — wire to Formspree / Cloudflare Workers later) */
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = form.querySelector("[data-form-status]");
      const data = new FormData(form);
      const name = (data.get("name") || "").toString().trim();
      const email = (data.get("email") || "").toString().trim();
      const message = (data.get("message") || "").toString().trim();

      if (!name || !email || !message) {
        if (status) status.textContent = "Please fill in name, email, and message.";
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (status) status.textContent = "Please enter a valid email address.";
        return;
      }

      if (status) {
        status.textContent = "Thanks — your message is ready to send. Connect Formspree or your email API to go live.";
      }
      form.reset();
    });
  }

  /* Current year */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
