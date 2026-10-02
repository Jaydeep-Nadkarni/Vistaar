import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

const events = [
  { id: 'ctf', file: 'CTF.EXE', title: 'CTF', eyebrow: 'CAPTURE THE FLAG', description: 'Break in. Find the flag. Leave no trace.', team: '1-4 PLAYERS', whatsapp: import.meta.env.VITE_WHATSAPP_CTF },
  { id: 'murder', file: 'CYBER_HEIST.EXE', title: 'Cyber Heist', eyebrow: 'MURDER MYSTERY', description: 'Everyone has a motive. Can your team find the truth?', team: '2-4 PLAYERS', whatsapp: import.meta.env.VITE_WHATSAPP_CYBER_HEIST },
]

const sessions = ['AIML', 'Cybersecurity']
const SESSIONS_WHATSAPP = import.meta.env.VITE_WHATSAPP_SESSIONS

const patrons = [
  ['Dr. Santosh Pattar', 'Computer Society Faculty Advisor'],
  ['Dr. Nalini Karchi', 'IEEE Branch Counselor'],
  ['Dr. Rajashri Khanai', 'HoD CSE'],
  ['Dr. S.F. Patil', 'Principal'],
]

const faqs = [
  ['What is the fee?', 'IEEE members pay ₹100. Non-IEEE members pay ₹150.'],
  ['Can I participate solo?', 'CTF accepts solo players. Cyber Heist (Murder Mystery) needs at least 2 members.'],
  ['Where will it happen?', 'The event will take place at KLE Technological University, Belagavi.'],
  ['What should I bring?', 'Bring your college ID and your laptop is more than enough.'],
  ['Will the lunch be provided?', 'Yes, lunch will be provided for all participants.']
]

const SHEETS_URL = import.meta.env.VITE_SHEETS_URL
const UPI_ID = import.meta.env.VITE_UPI_ID
const UPI_PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME
const CONTACTS = [
  { name: 'Jaydeep Nadkarni', phone: '+91 94817 40517', tel: '+919481740517' },
  { name: 'Karthik Hirenarti', phone: '+91 72044 04872', tel: '+917204404872' },
]
const SOCIETY_MEMBERS = [
  ['IEEE SB Chair', 'Harsh Othy'],
  ['IEEE SB Vice Chair', 'Kushal Itnal'],
  ['Chair', 'Jaydeep Nadkarni'],
  ['Vice Chair', 'Kalash Rao'],
  ['Secretary', 'Sarvadnya Patil'],
  ['Joint-Secretary', 'Parth Kulkarni'],
  ['Treasurer', 'Sayali Gambhir'],
  ['Technical Lead', 'Karthik Hirenarti'],
]
const FEE_IEEE = Number(import.meta.env.VITE_FEE_IEEE || 100)
const FEE_NON_IEEE = Number(import.meta.env.VITE_FEE_NON_IEEE || 150)

// Fee is per person: anyone who enters an IEEE membership ID pays the member rate.
const calculateFee = (fields, memberCount) => Array.from({ length: memberCount }, (_, index) => (index === 0 ? fields.membershipId : fields[`member-${index + 1}-membershipId`]))
  .reduce((total, membershipId) => total + (membershipId?.trim() ? FEE_IEEE : FEE_NON_IEEE), 0)

// Standard UPI deep link: opens any UPI app on phones and is what the QR encodes for desktop users.
const buildUpiUri = (amount, note) => `upi://pay?${new URLSearchParams({ pa: UPI_ID, pn: UPI_PAYEE_NAME, am: String(amount), cu: 'INR', tn: note })}`

// Re-encodes the screenshot as a JPEG of at most 1600px (white background for transparent PNGs) so the
// upload stays small and well under the Apps Script request limit. Resolves to a data: URL.
const compressImage = (file) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(image.src)
    resolve(canvas.toDataURL('image/jpeg', 0.8))
  }
  image.onerror = () => reject(new Error('Unreadable image'))
  image.src = URL.createObjectURL(file)
})

// Retro desktop window used for every panel: mustard title bar with the _ □ × controls from the poster.
// Passing `onClose` turns the × into a real close button.
// In-page links scroll with JS instead of an href, so no #fragment shows in the address bar or hover preview.
function ScrollLink({ to, className, children }) {
  const go = () => document.getElementById(to)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return <a role="button" tabIndex={0} className={className} onClick={go} onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), go())}>{children}</a>
}

function Window({ title, className = '', onClose, children }) {
  return (
    <div className={`window ${className}`}>
      <div className="window-titlebar">
        <span className="window-title">{title}</span>
        <span className="window-controls">
          <i className="ctl-min" aria-hidden="true" />
          <i aria-hidden="true">□</i>
          {onClose ? <button type="button" onClick={onClose} aria-label="Close">×</button> : <i aria-hidden="true">×</i>}
        </span>
      </div>
      <div className="window-body">{children}</div>
    </div>
  )
}

// Sends a registration to the Google Apps Script web app, which appends it to the Google Sheet.
// text/plain body keeps it a "simple" request so the browser skips the CORS preflight Apps Script can't answer.
async function postToSheet(payload) {
  if (!SHEETS_URL) throw new Error('Registration endpoint is not configured. Set VITE_SHEETS_URL in .env.local.')
  const response = await fetch(SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (result.status !== 'success') throw new Error(result.message)
}

// Shown on the success screens so participants land in their event's WhatsApp group; hidden until the link is set.
const WhatsAppButton = ({ link }) => link ? <a className="pixel-button whatsapp" href={link} target="_blank" rel="noopener noreferrer">JOIN WHATSAPP GROUP <span>↗</span></a> : null

const CollegeInput = () => (
  <input type="text" name="college" required placeholder="Your college name" autoComplete="organization" />
)

// Industry sessions are free and individual, so this form skips the team builder and the UPI step entirely.
function SessionRegistration({ onClose, isMobile }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const chosenSessions = formData.getAll('sessions')
    if (!chosenSessions.length) return setError('Pick at least one session.')
    setSubmitting(true)
    setError('')
    try {
      await postToSheet({ ...Object.fromEntries(formData), type: 'session', sessions: chosenSessions.join(', '), whatsapp: SESSIONS_WHATSAPP })
      setSubmitted(true)
    } catch {
      setError('Transmission failed. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={isMobile ? 'register-page' : 'modal-backdrop'} role="presentation" onMouseDown={(event) => !isMobile && event.target === event.currentTarget && onClose()}>
      <div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="session-title">
        <Window title="REGISTER/SESSIONS.EXE" onClose={onClose}>
          {submitted ? (
            <div className="success-state"><div className="success-mark">✓</div><p className="section-number">SEAT RESERVED</p><h2>SEE YOU THERE.</h2><p>Your industry session registration is in. A confirmation email is on its way, and session timings will be shared over email.</p><div className="success-actions"><WhatsAppButton link={SESSIONS_WHATSAPP} /><button className="pixel-button primary" type="button" onClick={onClose}>BACK TO HQ</button></div></div>
          ) : (
            <>
              <p className="section-number">REGISTRATION / INDUSTRY SESSIONS</p>
              <h2 id="session-title">SAVE YOUR SEAT<span>.</span></h2>
              <p className="modal-subtitle">Free to attend. No payment needed.</p>
              <form onSubmit={submit}>
                <label>FULL NAME<input name="name" required placeholder="Your full name" /></label>
                <div className="form-row"><label>EMAIL<input type="email" name="email" required placeholder="you@example.com" /></label><label>CONTACT NUMBER<input type="tel" name="contact" required placeholder="+91" /></label></div>
                <div className="form-row"><label>IEEE MEMBERSHIP ID <span>(OPTIONAL)</span><input name="membershipId" placeholder="If applicable" /></label><label>COLLEGE<CollegeInput /></label></div>
                <fieldset className="session-picks"><legend className="field-label">SESSIONS</legend>{sessions.map((session) => <label className="check" key={session}><input type="checkbox" name="sessions" value={session} defaultChecked />{session}</label>)}</fieldset>
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions"><button className="pixel-button primary" type="submit" disabled={submitting}>{submitting ? 'TRANSMITTING…' : <>REGISTER FOR FREE <span>↗</span></>}</button></div>
              </form>
            </>
          )}
        </Window>
      </div>
    </div>
  )
}

const Trophy = () => (
  <svg className="trophy" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="var(--gold)" d="M4 1h8v6h-1v1h-1v1H6V8H5V7H4zM1 2h3v1H2v2h1v1h1v1H2V6H1zM12 2h3v4h-1v1h-2V6h1V5h1V3h-2zM7 9h2v2H7z" />
    <path fill="var(--gold-dark)" d="M7 3h2v1h1v1H9v1H7V5H6V4h1zM5 11h6v1H5z" />
    <path fill="var(--ink)" d="M4 12h8v3H4z" />
  </svg>
)

// On phones registration is its own page at /register/<event>, so the back button returns to the landing page.
// On larger screens it stays a pop-up dialog and the URL does not change.
const MOBILE_QUERY = '(max-width: 640px)'
const getPath = () => window.location.pathname.replace(/\/+$/, '') || '/'

function App() {
  const [path, setPath] = useState(getPath)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const [dialogId, setDialogId] = useState(null)
  const restoreScroll = useRef(null)
  const [memberCount, setMemberCount] = useState(1)
  const [openFaq, setOpenFaq] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [payment, setPayment] = useState(null)

  useEffect(() => {
    const onPop = (event) => {
      restoreScroll.current = event.state?.scrollY ?? 0
      setPath(getPath())
    }
    const media = window.matchMedia(MOBILE_QUERY)
    const onMedia = (event) => setIsMobile(event.matches)
    window.addEventListener('popstate', onPop)
    media.addEventListener('change', onMedia)
    return () => {
      window.removeEventListener('popstate', onPop)
      media.removeEventListener('change', onMedia)
    }
  }, [])

  // After Back/Forward the matching page has just rendered; put the scroll position back before paint.
  useLayoutEffect(() => {
    if (restoreScroll.current === null) return
    window.scrollTo({ top: restoreScroll.current, behavior: 'instant' })
    restoreScroll.current = null
  }, [path])

  const openRegistration = (id) => {
    if (!isMobile) return setDialogId(id)
    const to = `/register/${id}`
    window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '')
    window.history.pushState({ inApp: true }, '', to)
    setPath(to)
  }
  // Back when we pushed the page ourselves; a directly opened /register/... link falls back to home.
  const closeRegistration = () => {
    if (!isMobile) return setDialogId(null)
    if (window.history.state?.inApp) return window.history.back()
    window.history.replaceState({}, '', '/')
    setPath('/')
  }

  const routeId = isMobile ? (path.startsWith('/register/') ? path.split('/')[2] : null) : dialogId
  const sessionOpen = routeId === 'sessions'
  const activeEvent = events.some((event) => event.id === routeId) ? routeId : null

  // Start every registration page from a clean form.
  useEffect(() => {
    setMemberCount(activeEvent === 'murder' ? 2 : 1)
    setSubmitted(false)
    setSubmitError('')
    setPayment(null)
  }, [activeEvent])

  // Land at the top of the registration page once it has rendered.
  useEffect(() => {
    if (!activeEvent && !sessionOpen) return undefined
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return undefined
    }
    // Pop-up dialog: keep the page behind it from scrolling.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [activeEvent, sessionOpen, isMobile])

  const activeEventData = events.find((event) => event.id === activeEvent)
  const minimumMembers = activeEvent === 'murder' ? 2 : 1

  // Step 1 only computes the fee and reveals the UPI step; nothing is saved until a UTR is submitted.
  // The team details stay mounted (just hidden) so their values are still in the form on step 2.
  const proceedToPayment = (form) => {
    const fields = Object.fromEntries(new FormData(form))
    setPayment({ amount: calculateFee(fields, memberCount), note: `Vistaar ${activeEventData.title} - ${fields.teamName.trim()}`.slice(0, 50) })
    setSubmitError('')
  }

  const submitRegistration = async (event) => {
    event.preventDefault()
    if (!payment) return proceedToPayment(event.currentTarget)
    const { screenshot: screenshotFile, ...fields } = Object.fromEntries(new FormData(event.currentTarget))
    if (!screenshotFile.type.startsWith('image/')) return setSubmitError('The payment screenshot must be an image file.')
    setSubmitting(true)
    setSubmitError('')
    let screenshot
    try {
      screenshot = await compressImage(screenshotFile)
    } catch {
      setSubmitting(false)
      return setSubmitError('Could not read that screenshot. Try a PNG or JPG image.')
    }
    try {
      await postToSheet({ ...fields, screenshot, type: 'team', event: activeEventData.title, teamSize: memberCount, amount: payment.amount, whatsapp: activeEventData.whatsapp })
      setSubmitted(true)
    } catch {
      setSubmitError('Transmission failed. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      {!(isMobile && (activeEvent || sessionOpen)) && <>
      <header className="topbar">
        <nav className="menubar" aria-label="Primary navigation">
          <ScrollLink to="events"><u>E</u>vents</ScrollLink>
          <ScrollLink to="sessions"><u>S</u>essions</ScrollLink>
          <ScrollLink to="details"><u>D</u>etails</ScrollLink>
          <ScrollLink to="faq"><u>H</u>elp</ScrollLink>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="logo-strip"><img src="/logos.png" alt="IEEE Bangalore Section, IEEE NKSS, KLE Technological University, IEEE KLE Tech Student Branch, IEEE Computer Society, ACE Department of CSE" /></div>
        <p className="kicker">KLE TECHNOLOGICAL UNIVERSITY, BELAGAVI<br />IEEE STUDENT BRANCH</p>
        <div className="kicker-rule" />
        <span className="sparkle sparkle-a" aria-hidden="true">✦</span>
        <span className="sparkle sparkle-b" aria-hidden="true">✛</span>
        <h1 className="pixel-title">VISTAAR</h1>
        <div className="hero-tags"><span>TECHNICAL EVENTS</span><span>INDUSTRY SESSIONS</span></div>
        <ScrollLink className="pixel-button primary hero-register" to="events">REGISTER</ScrollLink>
        <div className="hero-windows">
          <Window title="DATE" className="date-window">
            <strong>13<sup>TH</sup></strong>
            <span>OCTOBER<br />2026</span>
          </Window>
          <Window title="PRIZE POOL" className="prize-window">
            <Trophy />
            <div><strong>₹10,000</strong><span>TOTAL PRIZE POOL</span></div>
          </Window>
          <Window title="root@vistaar:~" className="terminal-window">
            <div className="terminal">
              <span className="terminal-cmd">$ organizing_committee.txt</span>
              <dl className="society-members">
                {SOCIETY_MEMBERS.map(([role, name]) => <div key={role}><dt>{role}</dt><dd>{name}</dd></div>)}
              </dl>
            </div>
          </Window>
        </div>
        <ScrollLink className="pixel-button primary" to="events">CHOOSE YOUR EVENT →</ScrollLink>
        <p className="motto">CODE <i /> COLLABORATE <i /> CREATE <i /> BEYOND</p>
      </section>

      <section className="section-shell" id="events">
        <div className="section-heading"><p className="section-number">01 / Participate and win</p><h2>Technical Evnets</h2><p>Pick a side of the screen. Build your team. Enter the story.</p></div>
        <div className="event-grid">
          {events.map((event) => (
            <Window title={`VISTAAR/${event.file}`} className="event-window" key={event.id}>
              <div className="terminal">
                <span className="terminal-dim">&gt; {event.eyebrow}</span>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <ul><li>TEAM: {event.team}</li><li>FEE: ₹{FEE_IEEE} IEEE / ₹{FEE_NON_IEEE} NON&#8209;IEEE, PER HEAD</li><li className="live">● REGISTRATIONS LIVE</li></ul>
                <button className="pixel-button primary" type="button" onClick={() => openRegistration(event.id)}>REGISTER →</button>
              </div>
            </Window>
          ))}
        </div>
      </section>

      <section className="section-shell" id="sessions">
        <div className="section-heading"><p className="section-number">02 / LEVEL UP</p><h2>INDUSTRY SESSIONS</h2><p>Hear from the top industry experts.</p></div>
        <Window title="VISTAAR/SESSIONS.EXE" className="sessions-window">
          <div className="terminal">
            <ul className="session-list">{sessions.map((session) => <li key={session}>{session}</li>)}</ul>
            <strong className="free-tag">(FREE TO REGISTER!)</strong>
            <button className="pixel-button primary" type="button" onClick={() => openRegistration('sessions')}>REGISTER FREE →</button>
          </div>
        </Window>
      </section>

      <section className="section-shell" id="details">
        <div className="section-heading"><p className="section-number">03 / EVENT DAY</p><h2>THE TIMELINE</h2><p>13 October 2026 • KLE Technological University, Belgaum</p></div>
        <Window title="VISTAAR/TIMELINE.EXE" className="timeline-window">
          <div className="timeline">
            <div className="timeline-row"><time>08:30</time><div><strong>REGISTRATION STARTS</strong><span>Check in, assemble your team.</span></div></div>
            <div className="timeline-row"><time>09:30</time><div><strong>CS CHAPTER INAUGURATION</strong><span>The official opening of Vistaar.</span></div></div>
            <div className="timeline-row"><time>10:30—12:30</time><div><strong>KEYNOTE SESSIONS</strong><span>Listen, learn, and get ready for the missions ahead.</span></div></div>
            <div className="timeline-row"><time>12:30—13:30</time><div><strong>LUNCH BREAK</strong><span>Recharge before the technical events begin.</span></div></div>
            <div className="timeline-row"><time>13:30—15:30</time><div><strong>TECHNICAL EVENTS</strong><span>CTF and Cyber Heist (Murder Mystery) go live.</span></div></div>
          </div>
        </Window>
      </section>

      <section className="section-shell" id="faq">
        <div className="section-heading"><p className="section-number">04 / INTEL</p><h2>HELP.TXT</h2><p>Everything you need before you enter the room.</p></div>
        <Window title="HELP — FREQUENTLY ASKED" className="faq-window">
          {faqs.map(([question, answer], index) => (
            <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={question}>
              <button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>0{index + 1}</span>{question}<b>{openFaq === index ? '−' : '+'}</b></button>
              {openFaq === index && <p>{answer}</p>}
            </div>
          ))}
        </Window>
      </section>

      <footer className="footer">
        <div className="patrons-window">
          <div className="patrons-titlebar"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="window-controls" aria-hidden="true"><i className="ctl-min" /><i>×</i></span></div>
          <div className="patrons">{patrons.map(([name, role]) => <div key={name}><strong>{name}</strong><span>{role}</span></div>)}</div>
        </div>
        <div className="footer-bar">
          <span className="pixel-logo">VISTAAR</span>
          <div className="contact"><span>CONTACT</span>{CONTACTS.map(({ name, phone, tel }) => <a className="contact-person" href={`tel:${tel}`} key={tel}><strong>{name}</strong><em>{phone}</em></a>)}</div>
          <span className="footer-end">Email<br />ieee@klescet.ac.in</span>
        </div>
      </footer>

      </>}

      {activeEvent && <div className={isMobile ? 'register-page' : 'modal-backdrop'} role="presentation" onMouseDown={(event) => !isMobile && event.target === event.currentTarget && closeRegistration()}><div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title"><Window title={`REGISTER/${activeEventData.file}`} onClose={() => closeRegistration()}>{submitted ? <div className="success-state"><div className="success-mark">✓</div><p className="section-number">TRANSMISSION RECEIVED</p><h2>YOU'RE ON THE LIST.</h2><p>Your registration has reached the Vistaar control room. A confirmation email has been sent to every team member. Join the WhatsApp group for updates.</p><div className="success-actions"><WhatsAppButton link={activeEventData.whatsapp} /><button className="pixel-button primary" type="button" onClick={() => closeRegistration()}>BACK TO HQ</button></div></div> : <><p className="section-number">REGISTRATION / {activeEventData.title.toUpperCase()}</p><h2 id="registration-title">BUILD YOUR TEAM<span>.</span></h2><p className="modal-subtitle">{payment ? 'Scan the QR or tap Pay, then enter the UTR from your payment app.' : "Fill in the team leader's details. Add teammates below."}</p><form onSubmit={submitRegistration}><div className="form-step" hidden={Boolean(payment)}><label>TEAM NAME<input name="teamName" required placeholder="Your Team Name" /></label><label>LEADER NAME<input name="leaderName" required placeholder="Your full name" /></label><div className="form-row"><label>EMAIL<input type="email" name="email" required placeholder="Your Email" /></label><label>CONTACT NUMBER<input type="tel" name="contact" required placeholder="+91" /></label></div><div className="form-row"><label>IEEE MEMBERSHIP ID <span>(OPTIONAL)</span><input name="membershipId" placeholder="If applicable" /></label><label>COLLEGE<CollegeInput /></label></div><div className="member-count"><div><span className="field-label">TEAM MEMBERS</span><p>{activeEvent === 'murder' ? 'Cyber Heist (Murder Mystery) requires 2-4 members.' : 'CTF allows 1-4 members.'}</p></div><div className="stepper"><button type="button" onClick={() => setMemberCount(Math.max(minimumMembers, memberCount - 1))}>−</button><strong>{memberCount}</strong><button type="button" onClick={() => setMemberCount(Math.min(4, memberCount + 1))}>+</button></div></div>{Array.from({ length: memberCount - 1 }).map((_, index) => <div className="teammate-row" key={index}><span>MEMBER 0{index + 2}</span><input name={`member-${index + 2}-name`} required placeholder="Full name" /><input type="email" name={`member-${index + 2}-email`} required placeholder="Email" /><input name={`member-${index + 2}-membershipId`} placeholder="IEEE ID" title="IEEE membership ID (optional)" /></div>)}</div>{payment && (UPI_ID && UPI_PAYEE_NAME ? <div className="payment-step"><div className="payment-card"><div className="payment-qr"><QRCodeSVG value={buildUpiUri(payment.amount, payment.note)} size={150} level="M" /></div><div className="payment-details"><span className="field-label">AMOUNT DUE</span><strong>₹{payment.amount}</strong><p>Pay to <b>{UPI_PAYEE_NAME}</b><br /><code>{UPI_ID}</code></p><p className="payment-hint">IEEE members ₹{FEE_IEEE} · Others ₹{FEE_NON_IEEE} per person</p><a className="pixel-button" href={buildUpiUri(payment.amount, payment.note)}>PAY VIA UPI APP <span>→</span></a></div></div><label>UTR / REFERENCE NUMBER<input name="utrNumber" required inputMode="numeric" pattern="\d{12}" title="The 12-digit UTR / UPI reference number from your payment app" placeholder="e.g. 302411223344" /></label><label>PAYMENT SCREENSHOT<input type="file" name="screenshot" accept="image/*" required /><span>Shared with the organizers to verify your payment.</span></label></div> : <p className="form-error" role="alert">Payments are not configured yet. Please contact the organizers.</p>)}{submitError && <p className="form-error" role="alert">{submitError}</p>}<div className="form-actions">{payment && <button className="pixel-button" type="button" onClick={() => setPayment(null)} disabled={submitting}>← EDIT TEAM</button>}<button className="pixel-button primary" type="submit" disabled={submitting || (payment && !(UPI_ID && UPI_PAYEE_NAME))}>{submitting ? 'TRANSMITTING…' : payment ? <>SUBMIT REGISTRATION <span>↗</span></> : <>PROCEED TO PAYMENT <span>→</span></>}</button></div></form></>}</Window></div></div>}
      {sessionOpen && <SessionRegistration onClose={closeRegistration} isMobile={isMobile} />}
    </main>
  )
}

export default App
