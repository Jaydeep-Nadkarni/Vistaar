import { useState } from 'react'
import './App.css'

const events = [
  { id: 'ctf', number: '01', title: 'CTF', eyebrow: 'CAPTURE THE FLAG', description: 'Break in. Find the flag. Leave no trace.', meta: ['1-4 PLAYERS', '₹100 / ₹150'], accent: 'gold' },
  { id: 'murder', number: '02', title: 'Cyber Heist', eyebrow: 'MURDER MYSTERY', description: 'Everyone has a motive. Can your team find the truth?', meta: ['2-4 PLAYERS', '₹100 / ₹150'], accent: 'red' },
]

const faqs = [
  ['What is the fee?', 'IEEE members pay ₹100. Non-IEEE members pay ₹150.'],
  ['Can I participate solo?', 'CTF accepts solo players. Cyber Heist (Murder Mystery) needs at least 2 members.'],
  ['Where will it happen?', 'The event will take place at KLE Technological University, Belgaum.'],
  ['What should I bring?', 'Bring your college ID and your sharpest problem-solving instincts.'],
]

function App() {
  const [activeEvent, setActiveEvent] = useState(null)
  const [memberCount, setMemberCount] = useState(1)
  const [openFaq, setOpenFaq] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const activeEventData = events.find((event) => event.id === activeEvent)
  const minimumMembers = activeEvent === 'murder' ? 2 : 1

  const openRegistration = (eventId) => {
    setActiveEvent(eventId)
    setMemberCount(eventId === 'murder' ? 2 : 1)
    setSubmitted(false)
  }

  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#home"><span className="brand-mark">✦</span> IEEE KLE TECHNICAL EVENTS</a>
        <div className="nav-links"><a href="#events">EVENTS</a><a href="#details">DETAILS</a><a href="#faq">FAQ</a></div>
        <a className="nav-register" href="#events">REGISTER <span>↗</span></a>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy"><p className="kicker">IEEE COMPUTER SOCIETY PRESENTS <span className="blink">_</span></p><h1>VISTAAR<span className="title-dot">.</span></h1><p className="hero-subtitle">THE ANNUAL TECHNICAL CONCLAVE</p><div className="hero-rule" /><p className="hero-note">One day. Two cases. Zero room for guesswork.</p><a className="primary-button" href="#events">CHOOSE YOUR CASE <span>→</span></a></div>
        <div className="hero-art" aria-hidden="true"><div className="crosshair">+</div><div className="terminal-window"><div className="window-bar"><i /><i /><i /> <span>root@vistaar:~</span></div><div className="terminal-text"><span>$ ./launch_event.sh</span><strong>ACCESS GRANTED</strong><span>mission_date: 13.10.2026</span><span>status: registrations_open</span><b>_</b></div></div><div className="stamp">13<br /><small>OCT<br />2026</small></div></div>
      </section>

      <section className="event-section section-shell" id="events"><div className="section-heading"><p className="section-number">01 / SELECT A MISSION</p><h2>THE CASES</h2><p>Pick a side of the screen. Build your team. Enter the story.</p></div><div className="event-grid">{events.map((event) => <article className={`event-card ${event.accent}`} key={event.id}><div className="card-top"><span>FILE_{event.number}</span><span className="live-dot">● LIVE</span></div><div className="event-icon">{event.id === 'ctf' ? '⌘' : '✣'}</div><p className="event-eyebrow">{event.eyebrow}</p><h3>{event.title}</h3><p className="event-description">{event.description}</p><div className="event-meta">{event.meta.map((item) => <span key={item}>{item}</span>)}</div><button className="card-button" type="button" onClick={() => openRegistration(event.id)}>REGISTER <span>→</span></button></article>)}</div><p className="fee-note"><span>FEE KEY</span> IEEE MEMBER <b>₹100</b> <i /> NON-IEEE MEMBER <b>₹150</b></p></section>

      <section className="prize-section"><div className="section-shell prize-inner"><div><p className="section-number">02 / THE STAKES</p><h2>COME FOR<br /><em>THE CHAOS.</em></h2></div><div className="prize-amount"><span>₹</span>10,000<small>TOTAL PRIZE POOL</small></div></div></section>

      <section className="details-section section-shell" id="details"><div className="section-heading"><p className="section-number">03 / FIELD NOTES</p><h2>THE BRIEFING</h2></div><div className="details-grid"><div className="briefing-card"><span className="briefing-label">MISSION DATE</span><strong>13<span>TH</span> OCTOBER 2026</strong><p>Mark the date. The clock starts at check-in.</p></div><div className="briefing-card"><span className="briefing-label">TEAM PROTOCOL</span><strong>01—04 <span>PLAYERS</span></strong><p>CTF: 1-4 members<br />Cyber Heist (Murder Mystery): 2-4 members</p></div><div className="briefing-card"><span className="briefing-label">LOCATION</span><strong>KLE TECHNOLOGICAL<br />UNIVERSITY</strong><p>Belgaum campus. Venue details will be shared after registration.</p></div></div></section>

      <section className="faq-section section-shell" id="faq"><div className="faq-intro"><p className="section-number">04 / INTEL</p><h2>QUESTIONS?<br /><em>DECRYPTED.</em></h2><p>Everything you need before you enter the room.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>0{index + 1}</span>{question}<b>{openFaq === index ? '−' : '+'}</b></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></section>

      <footer className="footer"><div><span className="brand-mark">✦</span><strong>VISTAAR<span>.</span></strong><p>IEEE KLE • COMPUTER SOCIETY</p></div><div className="contact"><span>CONTACT HQ</span><a href="mailto:ieeecs@kletech.ac.in">ieeecs@kletech.ac.in</a><a href="tel:+919999999999">+91 99999 99999</a></div><div className="footer-end">END OF TRANSMISSION<br /><span>© 2026 IEEE KLE</span></div></footer>

      {activeEvent && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveEvent(null)}><div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title"><button className="close-button" type="button" onClick={() => setActiveEvent(null)} aria-label="Close registration">×</button>{submitted ? <div className="success-state"><div className="success-mark">✓</div><p className="section-number">TRANSMISSION RECEIVED</p><h2>YOU'RE ON THE LIST.</h2><p>Your registration details are ready to be connected to the Vistaar control room.</p><button className="primary-button" type="button" onClick={() => setActiveEvent(null)}>BACK TO HQ</button></div> : <><p className="section-number">REGISTRATION / {activeEventData.title.toUpperCase()}</p><h2 id="registration-title">BUILD YOUR TEAM<span>.</span></h2><p className="modal-subtitle">Fill in the team leader's details. Add teammates below.</p><form onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }}><label>TEAM NAME<input name="teamName" required placeholder="e.g. Byte Bandits" /></label><label>LEADER NAME<input name="leaderName" required placeholder="Your full name" /></label><div className="form-row"><label>EMAIL<input type="email" name="email" required placeholder="you@example.com" /></label><label>CONTACT NUMBER<input type="tel" name="contact" required placeholder="+91" /></label></div><div className="form-row"><label>IEEE MEMBERSHIP ID <span>(OPTIONAL)</span><input name="membershipId" placeholder="If applicable" /></label><label>COLLEGE<select name="college" defaultValue="" required><option value="" disabled>Select your college</option><option>KLE Technological University</option><option>Other college</option><option>Other</option></select></label></div><div className="member-count"><div><span className="briefing-label">TEAM MEMBERS</span><p>{activeEvent === 'murder' ? 'Cyber Heist (Murder Mystery) requires 2-4 members.' : 'CTF allows 1-4 members.'}</p></div><div className="stepper"><button type="button" onClick={() => setMemberCount(Math.max(minimumMembers, memberCount - 1))}>−</button><strong>{memberCount}</strong><button type="button" onClick={() => setMemberCount(Math.min(4, memberCount + 1))}>+</button></div></div>{Array.from({ length: memberCount - 1 }).map((_, index) => <div className="teammate-row" key={index}><span>MEMBER 0{index + 2}</span><input name={`member-${index + 2}-name`} required placeholder="Full name" /><input type="email" name={`member-${index + 2}-email`} required placeholder="Email" /><input name={`member-${index + 2}-membershipId`} placeholder="IEEE ID (optional)" /></div>)}<button className="submit-button" type="submit">SUBMIT REGISTRATION <span>↗</span></button></form></>}</div></div>}
    </main>
  )
}

export default App
