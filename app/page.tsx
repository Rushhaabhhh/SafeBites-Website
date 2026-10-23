'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Barcode,
  BellRing,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

type Status = 'safe' | 'caution' | 'danger'
type Product = {
  id: string
  name: string
  brand: string
  category: string
  ingredients: string
  status: Status
  note: string
  scanned: string
  source: string
}

type Analysis = Product & { matches: string[] }

const allergens = [
  { name: 'Capsicum', hint: 'chilli, paprika', enabled: true },
  { name: 'Cumin', hint: 'jeera, cuminaldehyde', enabled: true },
  { name: 'Guava', hint: 'guava leaf', enabled: true },
  { name: 'Yeast', hint: 'brewer\'s yeast', enabled: true },
  { name: 'MSG', hint: 'monosodium glutamate', enabled: true },
  { name: 'Dal chana', hint: 'chickpea, gram', enabled: true },
  { name: 'Besan', hint: 'gram flour', enabled: true },
]

const products: Product[] = [
  {
    id: '8901030895124', name: 'Classic Tomato Ketchup', brand: 'Kissan', category: 'Sauces',
    ingredients: 'Tomato paste, sugar, salt, acidity regulator, spices, permitted class II preservative.',
    status: 'safe', note: 'No allergens detected', scanned: '2 min ago', source: 'Open Food Facts',
  },
  {
    id: '8901725112048', name: 'Magic Masala Noodles', brand: 'Wai Wai', category: 'Instant meals',
    ingredients: 'Wheat flour, palm oil, salt, spices (cumin, capsicum), flavour enhancer (MSG), yeast extract.',
    status: 'danger', note: '3 personal allergens found', scanned: 'Yesterday', source: 'SafeBites local',
  },
  {
    id: '8906000273518', name: 'Roasted Chana Dal', brand: '24 Mantra', category: 'Pulses',
    ingredients: 'Roasted split chickpeas (chana dal), salt, sunflower oil. May contain traces of peanuts.',
    status: 'danger', note: 'Contains Dal chana', scanned: 'Mon, 14 Oct', source: 'Open Food Facts',
  },
  {
    id: '0012345678905', name: 'Garden Herb Crackers', brand: 'Harvest Table', category: 'Snacks',
    ingredients: 'Wheat flour, sunflower oil, dried herbs, salt. Manufactured in a facility that handles capsicum.',
    status: 'caution', note: 'Advisory: shared facility', scanned: 'Fri, 11 Oct', source: 'Manual entry',
  },
]

const statusMeta: Record<Status, { label: string; icon: typeof Check }> = {
  safe: { label: 'Safe to eat', icon: Check },
  caution: { label: 'Check with care', icon: AlertTriangle },
  danger: { label: 'Not safe for you', icon: X },
}

const keywordMap: Record<string, string[]> = {
  Capsicum: ['capsicum', 'chilli', 'chili', 'paprika'],
  Cumin: ['cumin', 'jeera', 'cuminaldehyde'],
  Guava: ['guava'],
  Yeast: ['yeast'],
  MSG: ['msg', 'monosodium glutamate', 'flavour enhancer'],
  'Dal chana': ['chana dal', 'chickpea', 'chick peas', 'gram dal'],
  Besan: ['besan', 'gram flour'],
}

function analyzeProduct(product: Product, activeAllergens: string[]): Analysis {
  const text = `${product.name} ${product.ingredients}`.toLowerCase()
  const matches = activeAllergens.filter((allergen) => keywordMap[allergen].some((keyword) => text.includes(keyword)))
  const hasAdvisory = /may contain|shared facility|shared equipment|traces of/i.test(text)
  const status: Status = matches.length > 0 ? 'danger' : hasAdvisory ? 'caution' : 'safe'
  const note = matches.length > 0 ? `${matches.length} personal allergen${matches.length > 1 ? 's' : ''} found` : hasAdvisory ? 'Advisory: shared facility' : 'No allergens detected'
  return { ...product, status, note, matches }
}

function StatusMark({ status, size = 16 }: { status: Status; size?: number }) {
  const Icon = statusMeta[status].icon
  return <span className={`status-mark ${status}`}><Icon size={size} strokeWidth={3} /></span>
}

export default function Home() {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(products[1].id)
  const [scanMode, setScanMode] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeAllergens, setActiveAllergens] = useState(allergens.filter((item) => item.enabled).map((item) => item.name))

  const selected = products.find((product) => product.id === selectedId) ?? products[1]
  const analysis = useMemo(() => analyzeProduct(selected, activeAllergens), [selected, activeAllergens])
  const filteredProducts = products.filter((product) => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(query.toLowerCase()))
  const currentDateLabel = currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const currentTimeLabel = currentTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function toggleAllergen(name: string) {
    setActiveAllergens((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  function handleScanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const barcode = String(formData.get('barcode') ?? '').trim()
    const match = products.find((product) => product.id === barcode)
    if (match) setSelectedId(match.id)
    setScanMode(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Safe<span>Bites</span></span></div>
        <nav className="main-nav"><button className="nav-link active">Overview</button><button className="nav-link">Scan history <span className="nav-count">12</span></button></nav>
        <div className="header-actions"><button className="icon-button subtle" aria-label="Notifications"><BellRing size={18} /><i /></button><button className="avatar" aria-label="User profile">U</button><button className="mobile-menu" aria-label="Open menu"><Menu size={20} /></button></div>
      </header>

      <section className="welcome-row page-width"><div><p className="eyebrow">{currentDateLabel} <span className="live-time">· {currentTimeLabel}</span></p><h1>Good morning, User.</h1></div><div className="privacy-badge"><LockKeyhole size={14} /> Private on this device</div></section>

      <section className="scan-hero page-width">
        <div className="scan-copy"><div className="tiny-label"><Zap size={13} fill="currentColor" /> QUICK CHECK</div><h2>Is it safe to eat?</h2><p>Scan a barcode or search for a product to get a clear answer in seconds.</p></div>
        <div className="scan-actions"><button className="primary-button" onClick={() => setScanMode(true)}><Barcode size={19} /> Scan barcode</button><button className="secondary-button" onClick={() => document.getElementById('search-box')?.focus()}><Search size={18} /> Search product</button></div>
        <div className="scan-deco"><span /><span /><span /></div>
      </section>

      <section className="page-width content-grid">
        <div className="main-column">
          <div className="section-heading"><div><p className="eyebrow">Latest check</p><h2>Your scan result</h2></div><button className="text-button" onClick={() => setSelectedId(products[1].id)}>View history <ArrowUpRight size={15} /></button></div>
          <article className={`result-card ${analysis.status}`}>
            <div className="result-top"><div className="product-ident"><div className="product-thumb noodles"><div className="thumb-bowl" /></div><div><p className="result-label">{analysis.brand}</p><h3>{analysis.name}</h3><span className="product-meta">{analysis.category} <b>·</b> 75 g</span></div></div><div className="scan-time"><Clock3 size={14} /> {analysis.scanned}</div></div>
            <div className="result-divider" />
            <div className="safety-summary"><div className={`status-orb ${analysis.status}`}><StatusMark status={analysis.status} size={30} /></div><div><div className="safety-title"><h2>{statusMeta[analysis.status].label}</h2>{analysis.status === 'danger' && <span className="severity-pill">HIGH RISK</span>}</div><p>{analysis.status === 'danger' ? `We found ${analysis.matches.length} ingredient${analysis.matches.length > 1 ? 's' : ''} linked to your profile.` : analysis.note}</p></div></div>
            {analysis.matches.length > 0 && <div className="match-list">{analysis.matches.map((match) => <div className="match-row" key={match}><span className="match-dot" /><span><strong>{match}</strong> <em>linked ingredient</em></span><ChevronDown size={16} /></div>)}</div>}
            <button className="outline-button full-width" onClick={() => setProfileOpen(true)}>View ingredient breakdown <ArrowUpRight size={16} /></button>
          </article>

          <div className="section-heading recent-heading"><div><p className="eyebrow">Your activity</p><h2>Recent scans</h2></div><button className="filter-button"><SlidersHorizontal size={15} /> Filter</button></div>
          <div className="recent-list">{filteredProducts.slice(0, 3).map((product) => { const item = analyzeProduct(product, activeAllergens); return <button className={`recent-item ${product.id === selectedId ? 'selected' : ''}`} key={product.id} onClick={() => setSelectedId(product.id)}><div className={`mini-thumb ${product.category === 'Pulses' ? 'beans' : product.category === 'Snacks' ? 'crackers' : 'sauce'}`} /><div className="recent-name"><strong>{product.name}</strong><span>{product.brand} <b>·</b> {product.scanned}</span></div><div className={`recent-status ${item.status}`}><StatusMark status={item.status} size={13} />{statusMeta[item.status].label}</div><ArrowUpRight className="recent-arrow" size={16} /></button> })}</div>
        </div>

        <aside className="side-column">
          <div className="section-heading"><div><p className="eyebrow">Personal profile</p><h2>My sensitivities</h2></div><button className="icon-button" aria-label="Edit sensitivities" onClick={() => setProfileOpen(true)}><SlidersHorizontal size={17} /></button></div>
          <div className="profile-card"><div className="profile-card-top"><div className="profile-icon"><ShieldCheck size={18} /></div><span>7 active alerts</span></div><p>SafeBites checks every product against your personal list.</p><div className="allergen-chips">{activeAllergens.slice(0, 5).map((item) => <span key={item}>{item}</span>)}{activeAllergens.length > 5 && <span className="more-chip">+{activeAllergens.length - 5}</span>}</div><button className="text-button" onClick={() => setProfileOpen(true)}>Manage profile <ArrowUpRight size={15} /></button></div>
          <div className="tip-card"><div className="tip-icon"><Sparkles size={17} /></div><div><strong>Small tip</strong><p>Always check the advisory line, even when ingredients look familiar.</p></div></div>
          <div className="trust-note"><LockKeyhole size={15} /><span>Your profile stays private and never leaves this device.</span></div>
        </aside>
      </section>

      {scanMode && <div className="modal-backdrop" onClick={() => setScanMode(false)}><div className="scan-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setScanMode(false)}><X size={18} /></button><div className="scanner-window"><div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" /><div className="scan-line" /><Barcode size={34} /></div><h2>Scan a product</h2><p>Use your camera in the full app, or enter a barcode to try the v0.</p><form onSubmit={handleScanSubmit}><div className="barcode-input"><Barcode size={18} /><input name="barcode" placeholder="e.g. 8901725112048" autoFocus /><button type="submit"><ArrowUpRight size={18} /></button></div></form><button className="cancel-button" onClick={() => setScanMode(false)}>Cancel</button></div></div>}

      {profileOpen && <div className="modal-backdrop" onClick={() => setProfileOpen(false)}><div className="profile-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Personal profile</p><h2>Your sensitivities</h2></div><button className="modal-close static" onClick={() => setProfileOpen(false)}><X size={18} /></button></div><p className="modal-intro">Choose the ingredients SafeBites should flag for you.</p><div className="allergen-settings">{allergens.map((item) => <button className="allergen-setting" key={item.name} onClick={() => toggleAllergen(item.name)}><span className={`check-control ${activeAllergens.includes(item.name) ? 'checked' : ''}`}>{activeAllergens.includes(item.name) && <Check size={14} />}</span><span><strong>{item.name}</strong><small>{item.hint}</small></span></button>)}</div><button className="primary-button full-width" onClick={() => setProfileOpen(false)}>Save profile</button></div></div>}
    </main>
  )
}
