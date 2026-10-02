/**
 * Vistaar registrations -> Google Sheets (+ payment screenshots -> Google Drive).
 * Paste this into Extensions > Apps Script of the target sheet, run `authorize` once, then Deploy as a Web App.
 * Each event (CTF, Cyber Heist) gets its own tab, created automatically on the first registration.
 * Screenshots go into a "Vistaar Payment Screenshots" folder created next to the sheet.
 * Free industry-session sign-ups (type: 'session') skip payment and land in their own "Industry Sessions" tab.
 * Every registration emails a confirmation to all participants, sent from the account that deployed the script.
 */

const HEADERS = [
  'Timestamp', 'Team Name', 'Leader Name', 'Email', 'Contact', 'Leader IEEE ID', 'College', 'Team Size', 'Amount Paid', 'UTR', 'Payment Screenshot',
  'Member 2 Name', 'Member 2 Email', 'Member 2 IEEE ID',
  'Member 3 Name', 'Member 3 Email', 'Member 3 IEEE ID',
  'Member 4 Name', 'Member 4 Email', 'Member 4 IEEE ID', 'Email Status',
]
const SESSION_HEADERS = ['Timestamp', 'Name', 'Email', 'Contact', 'IEEE ID', 'College', 'Sessions', 'Email Status']
const SESSION_SHEET_NAME = 'Industry Sessions'
const SCREENSHOT_FOLDER_NAME = 'Vistaar Payment Screenshots'
const SENDER_NAME = 'Vistaar | IEEE KLE Tech'
// Deployed site, no trailing slash (e.g. https://vistaar.vercel.app). Used for the logo strip at the top of emails; leave empty to hide it.
const SITE_URL = ''
const EVENT_DATE = { day: '13', suffix: 'TH', month: 'OCTOBER', year: '2026' }
const VENUE = 'KLE Technological University, Belgaum'
const CONTACTS = [['Jaydeep Nadkarni', '+91 94817 40517'], ['Karthik Hirenarti', '+91 72044 04872']]
// Only real WhatsApp invite links go into emails, so the open endpoint can't be used to mail arbitrary URLs.
const WHATSAPP_LINK = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)
    if (data.type === 'session') return registerSession(data)
    const utr = String(data.utrNumber || '').trim()
    if (!/^\d{12}$/.test(utr)) throw new Error('A valid 12-digit UTR is required.')
    if (!String(data.screenshot || '').startsWith('data:image/')) throw new Error('A payment screenshot is required.')

    // Drive upload is the slow part, so it happens before taking the lock.
    const screenshotUrl = saveScreenshot(data.screenshot, `${data.event} - ${data.teamName} - ${utr}`)
    const row = [
      new Date(), data.teamName, data.leaderName, data.email, data.contact, data.membershipId || '', data.college, data.teamSize, data.amount,
      "'" + utr, // leading ' keeps Sheets from turning the UTR into a number
      `=HYPERLINK("${screenshotUrl}", "View screenshot")`,
    ]
    const people = [{ name: data.leaderName, email: data.email }]
    for (let member = 2; member <= 4; member++) {
      row.push(data[`member-${member}-name`] || '', data[`member-${member}-email`] || '', data[`member-${member}-membershipId`] || '')
      if (data[`member-${member}-email`]) people.push({ name: data[`member-${member}-name`], email: data[`member-${member}-email`] })
    }

    const sheetName = data.event || 'Registrations'
    const rowNumber = appendRow(sheetName, HEADERS, row)
    const details = [
      ['Event', data.event], ['Team', data.teamName], ['Members', people.map((person) => person.name).join(', ')],
      ['Amount paid', `₹${data.amount}`], ['UTR', utr],
    ]
    const intro = `Team <b>${escapeHtml(data.teamName)}</b> is registered for <b>${escapeHtml(data.event)}</b>.`
    const email = { tag: 'TECHNICAL EVENTS', heading: 'ACCESS GRANTED', intro, details }
    const emailStatus = sendConfirmation(people, `You're registered for ${data.event} at Vistaar`, email, data.whatsapp)
    setEmailStatus(sheetName, HEADERS, rowNumber, emailStatus)
    return json({ status: 'success' })
  } catch (error) {
    return json({ status: 'error', message: String(error) })
  }
}

function registerSession(data) {
  if (!data.name || !data.email || !data.sessions) throw new Error('Name, email and at least one session are required.')
  const rowNumber = appendRow(SESSION_SHEET_NAME, SESSION_HEADERS, [new Date(), data.name, data.email, data.contact, data.membershipId || '', data.college, data.sessions])
  const intro = `Your seat is reserved for the <b>${escapeHtml(data.sessions)}</b> industry session(s).`
  const email = { tag: 'INDUSTRY SESSIONS', heading: 'SEAT RESERVED', intro, details: [['Name', data.name], ['Sessions', data.sessions], ['Fee', 'Free']] }
  const emailStatus = sendConfirmation([{ name: data.name, email: data.email }], 'Your seat is reserved for the Vistaar industry sessions', email, data.whatsapp)
  setEmailStatus(SESSION_SHEET_NAME, SESSION_HEADERS, rowNumber, emailStatus)
  return json({ status: 'success' })
}

// Serialize writes so two simultaneous submissions can't land on the same row. Returns the new row's number.
function appendRow(sheetName, headers, row) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const sheet = getSheet(sheetName, headers)
    sheet.appendRow(row)
    return sheet.getLastRow()
  } finally {
    lock.releaseLock()
  }
}

// Emails every participant in one message. A mail failure never fails the registration: the outcome is
// written to the row's Email Status column instead, so organizers can follow up by hand.
function sendConfirmation(people, subject, email, whatsapp) {
  const recipients = [...new Set(people.map((person) => String(person.email || '').trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))]
  if (!recipients.length) return 'No valid email'
  try {
    if (MailApp.getRemainingDailyQuota() < recipients.length) return 'Not sent: daily quota reached'
    const whatsappLink = WHATSAPP_LINK.test(String(whatsapp || '')) ? whatsapp : ''
    MailApp.sendEmail({ to: recipients.join(','), subject, name: SENDER_NAME, htmlBody: confirmationHtml({ ...email, people, whatsappLink }) })
    return `Sent to ${recipients.length}`
  } catch (error) {
    return `Failed: ${error}`
  }
}

// The email mirrors the poster: cream dotted paper, retro windows with gold title bars, a dark terminal panel.
// Everything is inline-styled tables because Gmail strips <style> blocks and web fonts; Courier New stands in
// for the pixel fonts wherever Silkscreen / Space Mono can't load.
const EMAIL = {
  paper: '#efe8d9', window: '#f6f1e6', gold: '#bf9634', goldDark: '#8f6d1f', ink: '#141311', muted: '#5f5a50',
  shade: '#a39d90', terminal: '#171612', terminalText: '#ece5d2',
  pixel: "'Silkscreen','Courier New',Courier,monospace", mono: "'Space Mono','Courier New',Courier,monospace",
}

function emailWindow(title, body, dark) {
  // Minimize / maximize / close are drawn with borders rather than glyphs so they look the same in every mail client.
  const box = (inner) => `<td style="padding-left:3px"><div style="width:14px;height:14px;border:2px solid ${EMAIL.ink};background:${EMAIL.window};font-size:0;line-height:0">${inner}</div></td>`
  const controls = [
    box(`<div style="margin:9px 3px 0;height:2px;background:${EMAIL.ink}"></div>`),
    box(`<div style="margin:3px;height:4px;border:1px solid ${EMAIL.ink};border-top-width:3px"></div>`),
    box(`<div style="font:700 13px/14px 'Courier New',Courier,monospace;text-align:center;color:${EMAIL.ink}">&times;</div>`),
  ].join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${EMAIL.ink};background:${dark ? EMAIL.terminal : EMAIL.window};box-shadow:5px 5px 0 ${EMAIL.ink};margin:0 0 24px">
    <tr><td style="background:${EMAIL.gold};border-bottom:2px solid ${EMAIL.ink};padding:5px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:700 13px ${EMAIL.pixel};letter-spacing:1px;color:${EMAIL.ink}">${title}</td>
        <td align="right"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${controls}</tr></table></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 20px;color:${dark ? EMAIL.terminalText : EMAIL.ink};font:14px/1.65 ${EMAIL.mono}">${body}</td></tr>
  </table>`
}

function confirmationHtml({ people, tag, heading, intro, details, whatsappLink }) {
  const greeting = people.length > 1 ? 'Hi team' : `Hi ${escapeHtml(people[0].name || 'there')}`
  const logos = SITE_URL ? `<tr><td style="padding:0 0 18px"><div style="background:#fff;border:2px solid ${EMAIL.ink};border-radius:14px;padding:8px 14px"><img src="${SITE_URL}/logos.png" alt="IEEE · KLE Tech · IEEE Computer Society" width="100%" style="display:block;max-width:100%;height:auto"></div></td></tr>` : ''
  const menu = ['File', 'Edit', 'View', 'Help'].map((item) => `<span style="margin-right:16px">${item}</span>`).join('')
  const rows = details.map(([label, value]) => `<tr>
      <td style="padding:3px 14px 3px 0;color:${EMAIL.gold};font:700 13px ${EMAIL.mono};white-space:nowrap;vertical-align:top">${label.toUpperCase()}</td>
      <td style="padding:3px 0;color:${EMAIL.terminalText};font:700 14px ${EMAIL.mono}">${escapeHtml(value)}</td></tr>`).join('')
  const whatsapp = whatsappLink ? emailWindow('COMMS.EXE', `
      <p style="margin:0 0 14px">All further updates (timings, rules, venue) will be shared in the WhatsApp group. Join it now.</p>
      <a href="${whatsappLink}" style="display:inline-block;background:#25d366;color:${EMAIL.ink};border:2px solid ${EMAIL.ink};box-shadow:4px 4px 0 ${EMAIL.ink};padding:12px 20px;font:700 14px ${EMAIL.pixel};letter-spacing:1px;text-decoration:none">JOIN WHATSAPP GROUP &#8599;</a>`) : ''
  const contacts = CONTACTS.map(([name, phone]) => `<td width="50%" align="center" style="padding:4px;font:12px/1.5 ${EMAIL.mono};color:${EMAIL.ink}"><b>${name}</b><br><span style="color:${EMAIL.muted}">${phone}</span></td>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${EMAIL.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL.paper};background-image:radial-gradient(rgba(60,48,25,.12) .7px,transparent .7px);background-size:6px 6px">
<tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
  ${logos}
  <tr><td style="padding:0 0 22px"><div style="background:${EMAIL.window};border:2px solid ${EMAIL.ink};padding:5px 12px;font:700 12px ${EMAIL.mono};color:${EMAIL.ink}">${menu}</div></td></tr>

  <tr><td align="center" style="font:700 12px/1.6 ${EMAIL.pixel};letter-spacing:1px;color:${EMAIL.ink}">KLE TECHNOLOGICAL UNIVERSITY, BELGAUM<br>IEEE STUDENT BRANCH</td></tr>
  <tr><td align="center" style="padding:8px 0 4px"><div style="width:120px;height:2px;background:${EMAIL.gold};font-size:0;line-height:0">&nbsp;</div></td></tr>
  <tr><td align="center" style="padding:6px 0 4px;font:700 64px/1 ${EMAIL.pixel};letter-spacing:6px;color:${EMAIL.ink};text-shadow:4px 4px 0 ${EMAIL.gold}">VISTAAR</td></tr>
  <tr><td align="center" style="padding:14px 0 28px">
    <span style="display:inline-block;background:${EMAIL.window};border:2px solid ${EMAIL.ink};box-shadow:3px 3px 0 ${EMAIL.ink};padding:6px 14px;font:700 12px ${EMAIL.pixel};letter-spacing:2px;color:${EMAIL.ink}">${tag}</span>
  </td></tr>

  <tr><td>${emailWindow('REGISTRATION.EXE', `
      <div style="font:700 22px/1.2 ${EMAIL.pixel};color:${EMAIL.ink};margin:0 0 14px">&#10003; ${heading}<span style="color:${EMAIL.gold}">.</span></div>
      <p style="margin:0 0 8px">${greeting},</p>
      <p style="margin:0">${intro}</p>`)}</td></tr>

  <tr><td>${emailWindow('DETAILS.TXT', `
      <div style="color:${EMAIL.shade};font:13px ${EMAIL.mono};margin:0 0 12px">C:\\VISTAAR&gt; type registration.txt</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>
      <div style="color:${EMAIL.terminalText};font:700 14px ${EMAIL.mono};margin:12px 0 0">C:\\VISTAAR&gt; _</div>`, true)}</td></tr>

  <tr><td>${emailWindow('WHEN_WHERE.EXE', `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="42%" align="center" style="border:2px solid ${EMAIL.ink};background:#fff;padding:12px 6px">
          <div style="font:700 44px/1 ${EMAIL.pixel};color:${EMAIL.ink}">${EVENT_DATE.day}<sup style="font-size:16px">${EVENT_DATE.suffix}</sup></div>
          <div style="height:2px;background:${EMAIL.ink};margin:8px 10px;font-size:0;line-height:0">&nbsp;</div>
          <div style="font:700 14px/1.3 ${EMAIL.pixel};color:${EMAIL.ink}">${EVENT_DATE.month}<br>${EVENT_DATE.year}</div>
        </td>
        <td style="padding-left:18px;font:13px/1.6 ${EMAIL.mono};color:${EMAIL.ink}">
          <b>${VENUE}</b><br><span style="color:${EMAIL.muted}">Bring your college ID. Reporting time will be shared in the group.</span>
        </td>
      </tr></table>`)}</td></tr>

  ${whatsapp ? `<tr><td>${whatsapp}</td></tr>` : ''}

  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${EMAIL.ink};background:${EMAIL.window};box-shadow:5px 5px 0 ${EMAIL.ink}">
      <tr><td style="border-bottom:2px solid ${EMAIL.ink};padding:5px 8px;font-size:12px;line-height:1"><span style="color:#c0504d">&#9679;</span> <span style="color:${EMAIL.gold}">&#9679;</span> <span style="color:${EMAIL.shade}">&#9679;</span></td></tr>
      <tr><td style="padding:10px 8px 4px;font:700 11px ${EMAIL.pixel};letter-spacing:1px;color:${EMAIL.ink}" align="center">CONTACT</td></tr>
      <tr><td style="padding:0 8px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${contacts}</tr></table></td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:24px 0 0;font:12px/1.6 ${EMAIL.mono};color:${EMAIL.muted}">Questions? Just reply to this email.<br>CODE &middot; COLLABORATE &middot; CREATE &middot; BEYOND</td></tr>
</table>
</td></tr></table>
</body></html>`
}

function setEmailStatus(sheetName, headers, rowNumber, status) {
  getSheet(sheetName, headers).getRange(rowNumber, headers.indexOf('Email Status') + 1).setValue(status)
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Lets you open the web app URL in a browser to confirm the deployment is live.
function doGet() {
  return json({ status: 'success', message: 'Vistaar registration endpoint is live.' })
}

// Run this once from the editor (function dropdown -> authorize -> Run) to grant Drive and email access
// and create the screenshots folder before deploying.
function authorize() {
  Logger.log('Screenshots folder: ' + getScreenshotFolder().getUrl())
  Logger.log('Emails left today: ' + MailApp.getRemainingDailyQuota())
}

function saveScreenshot(dataUrl, fileName) {
  const [header, base64] = dataUrl.split(',')
  const mimeType = header.slice('data:'.length, header.indexOf(';'))
  const extension = mimeType.split('/')[1] || 'jpg'
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, `${fileName}.${extension}`)
  return getScreenshotFolder().createFile(blob).getUrl()
}

function getScreenshotFolder() {
  const properties = PropertiesService.getScriptProperties()
  const folderId = properties.getProperty('SCREENSHOT_FOLDER_ID')
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId)
      if (!folder.isTrashed()) return folder
    } catch (error) {
      // Folder was deleted; fall through and create a new one.
    }
  }
  const parents = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getParents()
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder()
  const folder = parent.createFolder(SCREENSHOT_FOLDER_NAME)
  properties.setProperty('SCREENSHOT_FOLDER_ID', folder.getId())
  return folder
}

function getSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name)
  // Rewriting the header row every time keeps it in sync when columns are added.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
  sheet.setFrozenRows(1)
  return sheet
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON)
}
