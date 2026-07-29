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

  /* Contact form → FormSubmit (delivers to info@devstrand.com) */
  const CONTACT_ENDPOINT = "https://formsubmit.co/ajax/info@devstrand.com";
  const forms = document.querySelectorAll("[data-contact-form]");

  forms.forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector("[data-form-status]");
      const submitBtn = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const name = (data.get("name") || "").toString().trim();
      const email = (data.get("email") || "").toString().trim();
      const message = (data.get("message") || "").toString().trim();

      const setStatus = (text, type) => {
        if (!status) return;
        status.textContent = text;
        status.classList.remove("is-error", "is-success");
        if (type) status.classList.add(type);
      };

      if (!name || !email || !message) {
        setStatus("Please fill in name, email, and message.", "is-error");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("Please enter a valid email address.", "is-error");
        return;
      }

      /* Honeypot — silently ignore bot fills */
      if ((data.get("_honey") || "").toString().trim()) {
        setStatus("Thanks — your message has been sent. We'll get back to you soon.", "is-success");
        form.reset();
        return;
      }

      const payload = {
        name,
        email,
        message,
        company: (data.get("company") || "").toString().trim(),
        service: (data.get("service") || "").toString().trim(),
        subject: (data.get("subject") || "").toString().trim(),
        _subject: "New enquiry from DevStrand website",
        _template: "table",
        _captcha: "false",
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
      }
      setStatus("Sending…", null);

      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(result.message || "Unable to send right now.");
        }

        setStatus("Thanks — your message has been sent. We'll get back to you soon.", "is-success");
        form.reset();
      } catch (err) {
        setStatus(
          "Sorry, we couldn't send that. Email us at info@devstrand.com or try again.",
          "is-error"
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
        }
      }
    });
  });

  /* Current year */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
