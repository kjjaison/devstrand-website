# DEVSTRAND Website

Professional marketing site for **devstrand.com** — an Irish software development company.

Static HTML/CSS/JS. Hosting cost: **€0**/month on Cloudflare Pages.

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to Cloudflare Pages

1. Create a GitHub repository named `devstrand-website` and push this project.
2. Sign in to [Cloudflare](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → Connect to Git.
3. Select the repo. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/` (or leave blank / `.`)
4. Deploy. Cloudflare provides a `*.pages.dev` URL immediately.
5. **Custom domains** → add `devstrand.com` and `www.devstrand.com`.
6. At GoDaddy, update DNS to the values Cloudflare shows (usually Cloudflare nameservers, or CNAME/`A` records for Pages).

SSL (HTTPS) is free and automatic once DNS propagates.

## GoDaddy → Cloudflare DNS (summary)

**Option A (recommended):** Change GoDaddy nameservers to Cloudflare’s nameservers, then manage all DNS in Cloudflare.

**Option B:** Keep GoDaddy DNS and add the CNAME / A records Cloudflare Pages lists for your custom domain.

## Customise before launch

Replace placeholders:

| Item | Where |
|------|--------|
| LinkedIn URL | Footer / contact |
| Map embed | `contact.html` — use your real office address |
| Contact form backend | [FormSubmit](https://formsubmit.co) → `info@devstrand.com` (confirm inbox on first submit) |

## Site map

| Page | File |
|------|------|
| Home | `index.html` |
| About Us | `about.html` |
| Services | `services.html` |
| Industries | `industries.html` |
| Portfolio | `portfolio.html` |
| Technologies | `technologies.html` |
| Tools | `tools.html` |
| Contact | `contact.html` |
| Careers (hidden for now) | `careers.html` |
| Blog (hidden for now) | `blog.html` |

## Features

- Responsive layout (desktop, tablet, mobile)
- Dark & light mode (persisted)
- Scroll reveal + hero motion
- SEO meta + Organisation schema on home
- Contact form (FormSubmit → info@devstrand.com)
- LinkedIn links
- Google Maps embed on Contact
- Blog-ready listing page

## Cost

| Item | Cost |
|------|------|
| Domain (GoDaddy) | Already purchased |
| Hosting (Cloudflare Pages) | Free |
| SSL | Free |
| CDN | Free |
| GitHub | Free |
| **Monthly hosting** | **€0** |
