# Turnstile Custom Captcha UI for Vercel

A polished visible captcha-style UI with an invisible Cloudflare Turnstile verification layer behind it.

## Structure

```txt
public/index.html
api/verify.js
.env.example
.gitignore
package.json
```

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local Vercel URL shown in your terminal.

The project starts with Cloudflare's official always-pass test sitekey and test secret so you can confirm the full flow locally.

## Production setup

1. Create a Cloudflare Turnstile widget.
2. Recommended widget mode: Invisible.
3. Add your production hostname, for example `your-project.vercel.app` or your custom domain.
4. Replace `TURNSTILE_SITE_KEY` inside `public/index.html` with your real public sitekey.
5. Add these Vercel Environment Variables:

```env
TURNSTILE_SECRET_KEY=your-real-secret-key
TURNSTILE_EXPECTED_ACTION=hello_access
TURNSTILE_EXPECTED_HOSTNAME=your-domain.com
```

`TURNSTILE_EXPECTED_HOSTNAME` is optional but recommended for production.

## Security note

The custom visible captcha is a UX layer only because this repo is open source and the frontend is readable. The real security layer is server-side validation of the Cloudflare Turnstile token inside `api/verify.js`.

Do not put your Turnstile secret key in `public/index.html` or any other client-side file.
