# Connecting the registration form to Google Sheets

The form posts each registration to a Google Apps Script Web App, which appends a row to your sheet.
No API key, Google Cloud project, or billing is needed — only the Web App URL.

## 1. Create the sheet
1. Go to https://sheets.google.com and create a blank spreadsheet (e.g. "Vistaar Registrations").

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete the sample code in `Code.gs` and paste the contents of `google-apps-script/Code.gs` from this repo.
3. Click **Save** (disk icon).
4. In the function dropdown at the top (next to **Debug**), pick **authorizeDrive** and click **Run**.
   Allow access when asked. This lets the script save payment screenshots to your Drive and creates
   a **Vistaar Payment Screenshots** folder next to the sheet.

## 3. Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, then **Authorize access** and pick your Google account.
   - If you see "Google hasn't verified this app": **Advanced → Go to (project name) (unsafe)** → **Allow**. This is your own script, so it's fine.
5. Copy the **Web app URL** (ends in `/exec`).

Check it: open the URL in a browser — you should see `{"status":"success","message":"Vistaar registration endpoint is live."}`.

## 4. Plug the URL into the site
1. Open `.env.local` in the project root and replace the placeholder:
   ```
   VITE_SHEETS_URL=https://script.google.com/macros/s/AKfy.../exec
   ```
2. Restart the dev server (`npm run dev`) — Vite only reads env files at startup.
3. Submit a test registration. A tab named **CTF** or **Cyber Heist** appears in the sheet with the row.

## Updating the script later
After editing the script, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
This keeps the same URL. Creating a *New deployment* instead gives you a new URL you'd have to update.

## Hosting (Vercel / Netlify)
`.env.local` is not committed to git. On your host, add an environment variable named
`VITE_SHEETS_URL` with the same URL, then redeploy.

## UPI payment step
Registration is two steps: team details → pay by UPI (QR or "Pay via UPI App" link) → enter the
12-digit UTR and attach the payment screenshot → submit. Nothing reaches the sheet until the UTR is submitted.

Configure in `.env.local` (restart `npm run dev` after editing):
```
VITE_UPI_ID=yourname@okbank
VITE_UPI_PAYEE_NAME=Your Name
VITE_FEE_IEEE=100
VITE_FEE_NON_IEEE=150
```
The fee is per person: each member who enters an IEEE membership ID pays `VITE_FEE_IEEE`, everyone else `VITE_FEE_NON_IEEE`.
The sheet stores `Amount Paid` and `UTR`; match UTRs against your bank/UPI statement to verify payments.
The screenshot is compressed in the browser (JPEG, max 1600px) and saved to the **Vistaar Payment Screenshots**
Drive folder next to the sheet; the row's `Payment Screenshot` column links to it. The files stay private
to the sheet owner — share the folder with other organizers who need to verify payments.

## Industry sessions (free)
The **Register free** button in the Industry Sessions section opens a separate individual form
(name, email, contact, IEEE ID, college, AIML / Cybersecurity) with no payment step. Sign-ups go to an
**Industry Sessions** tab, created automatically on the first one.
