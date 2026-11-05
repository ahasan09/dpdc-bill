# DPDC Bill Check

An unofficial, fast, bilingual (English / বাংলা) helper for checking DPDC postpaid electricity bills.
Save your customer numbers once. Next time the default number is already selected, and one tap opens
the official DPDC bill page with everything filled in. You only type the 5-character security code.

## Why it opens the official page instead of showing the bill here

The official page (`dpdc.org.bd/site/service/ebill_gov`) protects bills with a captcha that is tied to a
server session, and the site sends no CORS headers. A static site on GitHub Pages can't read bills from it,
and it shouldn't try to get around the captcha. The official page does fill in bill type, year, month,
customer number and e-mail from the URL, so this app builds that URL for you.

## Features

- **Saved numbers** with nicknames, a default (pre-selected next time), edit, delete with undo, and duplicate detection
- **Bill types**: E-bill, Ledger (payment history) and Misc bill; quick "This month" / "Last month" picks, back to 2008
- **Recent checks**: reopen any earlier check in one tap
- **Login and sync (optional)**: Google or e-mail/password through Firebase Auth. Saved numbers and history sync
  across devices through Firestore, with offline support. Numbers saved before signing in are merged into the
  account and removed from the device. "Delete my saved data" deletes the user's cloud document.
- **Guest mode**: works with no account. Data stays in the browser's `localStorage`.
- Accepts Bangla digits (১২৩৪…) and ignores spaces and dashes
- **Monthly reminder**: downloads an `.ics` file for Google, Apple or Outlook calendars
- Copy link / native share, English and বাংলা, light, dark or system theme, offline banner, installable (web manifest)
- Accessible: keyboard friendly, native `<dialog>`, labelled controls, live-region toasts, reduced-motion support

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build
```

Without Firebase settings the app runs in guest mode only and hides sign-in.

## Enable login (Firebase, free tier is enough)

1. Create a project at <https://console.firebase.google.com> and add a **Web app**.
2. **Authentication → Sign-in method**: turn on **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add `<your-github-user>.github.io`.
4. **Firestore Database**: create a database, then paste [`firestore.rules`](firestore.rules) into the
   **Rules** tab and publish. Each user can only read and write their own `users/{uid}` document.
5. For local development, copy `.env.example` to `.env.local` and fill in the Web app config values.

The Firebase web config is not a secret. Firebase expects it in the browser, and the Firestore rules are what
protect the data. Still, keep it in repository variables and not in the code.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. (Optional, for login) **Settings → Secrets and variables → Actions → Variables**: add
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID`.
4. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests, builds with the
   right base path (`/<repo-name>/`) and publishes. The site will be at `https://<user>.github.io/<repo-name>/`.

## Project layout

```
src/lib/dpdc.ts        Official URL builder, customer number checks, month helpers (tested)
src/lib/userData.ts    Saved numbers / history / merge logic as pure functions (tested)
src/lib/storage.ts     localStorage (guest) and Firestore (signed in) persistence
src/lib/firebase.ts    Lazy, optional Firebase setup
src/lib/i18n.tsx       English and Bangla text, date and number formatting
src/hooks/             useAuth, useUserData, useTheme, useOnline
src/components/        CheckBillCard, AccountsCard, HistoryCard, ReminderCard, AuthDialog, Header, ...
```

## Disclaimer

Not affiliated with Dhaka Power Distribution Company (DPDC). Bills are only ever shown on dpdc.org.bd.
