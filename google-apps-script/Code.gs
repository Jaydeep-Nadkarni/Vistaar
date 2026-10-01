/**
 * Vistaar registrations -> Google Sheets (+ payment screenshots -> Google Drive).
 * Paste this into Extensions > Apps Script of the target sheet, run `authorizeDrive` once, then Deploy as a Web App.
 * Each event (CTF, Cyber Heist) gets its own tab, created automatically on the first registration.
 * Screenshots go into a "Vistaar Payment Screenshots" folder created next to the sheet.
 * Free industry-session sign-ups (type: 'session') skip payment and land in their own "Industry Sessions" tab.
 */

const HEADERS = [
  'Timestamp', 'Team Name', 'Leader Name', 'Email', 'Contact', 'Leader IEEE ID', 'College', 'Team Size', 'Amount Paid', 'UTR', 'Payment Screenshot',
  'Member 2 Name', 'Member 2 Email', 'Member 2 IEEE ID',
  'Member 3 Name', 'Member 3 Email', 'Member 3 IEEE ID',
  'Member 4 Name', 'Member 4 Email', 'Member 4 IEEE ID',
]
const SESSION_HEADERS = ['Timestamp', 'Name', 'Email', 'Contact', 'IEEE ID', 'College', 'Sessions']
const SESSION_SHEET_NAME = 'Industry Sessions'
const SCREENSHOT_FOLDER_NAME = 'Vistaar Payment Screenshots'

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
    for (let member = 2; member <= 4; member++) {
      row.push(data[`member-${member}-name`] || '', data[`member-${member}-email`] || '', data[`member-${member}-membershipId`] || '')
    }

    appendRow(data.event || 'Registrations', HEADERS, row)
    return json({ status: 'success' })
  } catch (error) {
    return json({ status: 'error', message: String(error) })
  }
}

function registerSession(data) {
  if (!data.name || !data.email || !data.sessions) throw new Error('Name, email and at least one session are required.')
  appendRow(SESSION_SHEET_NAME, SESSION_HEADERS, [new Date(), data.name, data.email, data.contact, data.membershipId || '', data.college, data.sessions])
  return json({ status: 'success' })
}

// Serialize writes so two simultaneous submissions can't land on the same row.
function appendRow(sheetName, headers, row) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    getSheet(sheetName, headers).appendRow(row)
  } finally {
    lock.releaseLock()
  }
}

// Lets you open the web app URL in a browser to confirm the deployment is live.
function doGet() {
  return json({ status: 'success', message: 'Vistaar registration endpoint is live.' })
}

// Run this once from the editor (function dropdown -> authorizeDrive -> Run) to grant Drive access
// and create the screenshots folder before deploying.
function authorizeDrive() {
  Logger.log('Screenshots folder: ' + getScreenshotFolder().getUrl())
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
