'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { AlertTriangle, Barcode, Camera, Check, ChevronDown, Clock3, Moon, Plus, Search, Settings2, ShieldCheck, Sun, Trash2, X } from 'lucide-react'

type Status = 'safe' | 'caution' | 'danger'
type Product = {
  barcode: string
  name: string
  brand: string
  category: string
  ingredients: string
  advisory: string
  image?: string
  source: string
  checkedAt: string
}
type Analysis = Product & { matches: string[]; status: Status; note: string }
type Sensitivity = { name: string; synonyms: string[]; hint: string }

const DEFAULT_SENSITIVITIES: Sensitivity[] = [
  { name: 'Capsicum', synonyms: ['capsicum', 'chili', 'pepper'], hint: 'chili, pepper' },
  { name: 'Cumin', synonyms: ['cumin', 'jeera', 'cuminaldehyde'], hint: 'jeera, cuminaldehyde' },
  { name: 'Guava', synonyms: ['guava'], hint: 'guava leaf' },
  { name: 'Yeast', synonyms: ['yeast'], hint: "brewer's yeast" },
  { name: 'MSG', synonyms: ['msg', 'monosodium glutamate', 'e621', 'flavour enhancer'], hint: 'monosodium glutamate, E621' },
  { name: 'Dal chana', synonyms: ['chana dal', 'chickpea', 'chick peas', 'gram dal'], hint: 'chickpea, gram' },
  { name: 'Besan', synonyms: ['besan', 'gram flour'], hint: 'gram flour' },
]
const HISTORY_KEY = 'safebites-history-v1'
const PROFILE_KEY = 'safebites-profile-v1'

const statusCopy: Record<Status, { label: string; description: string }> = {
  safe: { label: 'Safe to eat', description: 'No selected sensitivities were found in the available product data.' },
  caution: { label: 'Check with care', description: 'The product has an advisory statement that needs your attention.' },
  danger: { label: 'Not safe for you', description: 'One or more selected sensitivities were found in the ingredients.' },
}

function analyze(product: Product, activeAllergens: Sensitivity[]): Analysis {
  const text = `${product.name} ${product.ingredients}`.toLowerCase()
  const matches = activeAllergens.filter((allergen) => allergen.synonyms.some((word) => text.includes(word.toLowerCase()))).map((allergen) => allergen.name)
  const hasAdvisory = /may contain|traces of|shared equipment|shared facility|manufactured in a facility/i.test(product.advisory)
  const status: Status = matches.length ? 'danger' : hasAdvisory ? 'caution' : 'safe'
  return { ...product, matches, status, note: matches.length ? `${matches.length} selected sensitivity${matches.length > 1 ? 'ies' : 'y'} found` : hasAdvisory ? 'Advisory statement found' : 'No selected sensitivities found' }
}

function productFromApi(data: Record<string, unknown>, barcode: string): Product | null {
  const product = (data.product ?? data) as Record<string, unknown>
  const name = String(product.product_name ?? '').trim()
  const ingredients = String(product.ingredients_text ?? '').trim()
  if (!name && !ingredients) return null
  return {
    barcode, name: name || 'Unnamed product', brand: String(product.brands ?? '').split(',')[0].trim() || 'Brand not listed',
    category: String(product.categories ?? '').split(',')[0].trim() || 'Food product', ingredients: ingredients || 'Ingredients not listed',
    advisory: String(product.traces ?? product.allergens_from_ingredients ?? '').trim(), image: typeof product.image_front_url === 'string' ? product.image_front_url : undefined,
    source: 'Open Food Facts', checkedAt: new Date().toISOString(),
  }
}

async function lookupBarcode(barcode: string): Promise<Product> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,ingredients_text,traces,allergens_from_ingredients,image_front_url`)
  if (!response.ok) throw new Error('The product service is unavailable right now.')
  const data = await response.json() as { status?: number; product?: Record<string, unknown> }
  if (data.status !== 1 || !data.product) throw new Error('No product was found for that barcode.')
  const product = productFromApi(data, barcode)
  if (!product) throw new Error('This product does not have enough ingredient data to analyze.')
  return product
}

async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,categories,ingredients_text,traces,allergens_from_ingredients,image_front_url`)
  if (!response.ok) throw new Error('Search is unavailable right now.')
  const data = await response.json() as { products?: Record<string, unknown>[] }
  return (data.products ?? []).map((item) => productFromApi(item, String(item.code ?? ''))).filter((item): item is Product => Boolean(item))
}

function StatusMark({ status }: { status: Status }) {
  return <span className={`status-mark ${status}`}>{status === 'safe' ? <Check size={17} /> : status === 'caution' ? <AlertTriangle size={17} /> : <X size={17} />}</span>
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [dark, setDark] = useState(false)
  const [activeAllergens, setActiveAllergens] = useState<Sensitivity[]>(DEFAULT_SENSITIVITIES)
  const [history, setHistory] = useState<Product[]>([])
  const [selected, setSelected] = useState<Analysis | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [cameraState, setCameraState] = useState('Starting camera…')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    const storedHistory = window.localStorage.getItem(HISTORY_KEY)
    const storedProfile = window.localStorage.getItem(PROFILE_KEY)
    if (storedHistory) setHistory(JSON.parse(storedHistory))
    if (storedProfile) {
      const savedProfile = JSON.parse(storedProfile) as (Sensitivity | string)[]
      setActiveAllergens(savedProfile.map((item) => typeof item === 'string' ? { name: item, synonyms: [item.toLowerCase()], hint: 'custom alias' } : item))
    }
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])

  useEffect(() => {
    if (!scanOpen || !videoRef.current) return
    const reader = new BrowserMultiFormatReader()
    let closed = false
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _, controls) => {
      controlsRef.current = controls
      if (closed || !result) return
      setBarcodeInput(result.getText())
      controls.stop()
      setScanOpen(false)
      void processBarcode(result.getText())
    }).then(() => { if (!closed) setCameraState('Point your camera at a barcode') }).catch(() => setCameraState('Camera access was blocked. Enter a barcode below.'))
    return () => { closed = true; controlsRef.current?.stop(); controlsRef.current = null }
  }, [scanOpen])

  async function processBarcode(barcode: string) {
    const cleanBarcode = barcode.replace(/\s/g, '')
    if (!cleanBarcode) return
    setLoading(true); setError('')
    try {
      const product = await lookupBarcode(cleanBarcode)
      const nextHistory = [product, ...history.filter((item) => item.barcode !== product.barcode)].slice(0, 20)
      setHistory(nextHistory); window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      setSelected(analyze(product, activeAllergens))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to process this barcode.') }
    finally { setLoading(false) }
  }

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault(); if (!query.trim()) return
    setLoading(true); setError('')
    try { setSearchResults(await searchProducts(query.trim())) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to search right now.') } finally { setLoading(false) }
  }

  function chooseProduct(product: Product) { setSelected(analyze(product, activeAllergens)); setSearchResults([]); setQuery('') }
  function deleteSensitivity(name: string) {
    setActiveAllergens((current) => {
      const next = current.filter((item) => item.name !== name)
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      if (selected) setSelected(analyze(selected, next))
      return next
    })
  }

  function addSensitivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const aliases = String(form.get('aliases') ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
    if (!name || !aliases.length || activeAllergens.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    const next = [...activeAllergens, { name, synonyms: [name.toLowerCase(), ...aliases], hint: aliases.join(', ') }]
    setActiveAllergens(next)
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    event.currentTarget.reset()
  }

  function deleteHistoryItem(barcode: string) {
    setHistory((current) => {
      const next = current.filter((item) => item.barcode !== barcode)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      if (selected?.barcode === barcode) setSelected(null)
      return next
    })
  }

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeLabel = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Safe<span>Bites</span></span></div><nav className="main-nav"><a href="#latest">Latest check</a><a href="#history">History</a><a href="#sensitivities">Sensitivities</a></nav><div className="header-actions"><button className="icon-button" aria-label="Toggle day and night mode" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="avatar" aria-label="User profile">U</button></div></header>
    <section className="welcome-row page-width"><div><p className="eyebrow">{dateLabel} <span className="live-time">· {timeLabel}</span></p><h1>Food confidence, at a glance.</h1></div></section>
    <section className="scan-hero page-width"><div className="scan-copy"><div className="tiny-label"><Barcode size={13} /> LIVE PRODUCT CHECK</div><h2>Scan the barcode.</h2><p>We’ll fetch the product, read its ingredients, and compare them with your sensitivities.</p></div><button className="primary-button" onClick={() => { setError(''); setScanOpen(true) }}><Camera size={19} /> Open camera</button></section>
    <section className="page-width search-row"><form onSubmit={submitSearch} className="search-form"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product by name or brand" aria-label="Search a product" /><button type="submit" className="search-submit">Search</button></form>{searchResults.length > 0 && <div className="search-results">{searchResults.map((product) => <button key={product.barcode} onClick={() => chooseProduct(product)}><strong>{product.name}</strong><span>{product.brand} · {product.barcode}</span></button>)}</div>}</section>
    <section className="page-width content-grid"><div className="main-column"><div className="section-heading" id="latest"><div><p className="eyebrow">Latest check</p><h2>{selected ? selected.name : 'No product checked yet'}</h2></div>{selected && <span className="source-label">{selected.source}</span>}</div>{selected ? <ResultCard analysis={selected} onOpenProfile={() => setProfileOpen(true)} /> : <div className="empty-card"><Barcode size={28} /><h3>Your next scan will appear here</h3><p>Use the camera above or search for a packaged product.</p></div>}
      <div className="section-heading history-heading" id="history"><div><p className="eyebrow">Saved on this device</p><h2>Scan history</h2></div><span className="history-count">{history.length} {history.length === 1 ? 'scan' : 'scans'}</span></div>{history.length ? <div className="history-list">{history.map((product) => { const item = analyze(product, activeAllergens); return <div className={`history-item ${selected?.barcode === product.barcode ? 'selected' : ''}`} key={product.barcode} onClick={() => chooseProduct(product)} role="button" tabIndex={0}><div className="history-image">{product.image ? <img src={product.image} alt="" /> : <Barcode size={18} />}</div><span className="history-name"><strong>{product.name}</strong><small>{product.brand} · {product.barcode}</small></span><span className={`history-status ${item.status}`}><StatusMark status={item.status} />{statusCopy[item.status].label}</span><ChevronDown size={16} /><button className="history-delete" onClick={(event) => { event.stopPropagation(); deleteHistoryItem(product.barcode) }} aria-label={`Delete ${product.name} from history`}><Trash2 size={15} /></button></div> })}</div> : <p className="muted-copy">Completed scans will be saved here on this device.</p>}</div>
      <aside className="side-column" id="sensitivities"><div className="section-heading"><div><p className="eyebrow">Your profile</p><h2>Sensitivities</h2></div><button className="icon-button" aria-label="Edit sensitivities" onClick={() => setProfileOpen(true)}><Settings2 size={17} /></button></div><div className="profile-card"><div className="profile-card-top"><div className="profile-icon"><ShieldCheck size={18} /></div><span>{activeAllergens.length} active</span></div><p>Ingredients are matched locally against this list after every scan.</p><div className="allergen-chips">{activeAllergens.map((item) => <span key={item.name}>{item.name}</span>)}</div><button className="outline-button full-width" onClick={() => setProfileOpen(true)}>Edit sensitivities <Settings2 size={15} /></button></div></aside>
    </section>
    {scanOpen && <div className="modal-backdrop"><div className="scan-modal"><button className="modal-close" onClick={() => setScanOpen(false)} aria-label="Close scanner"><X size={18} /></button><div className="camera-frame"><video ref={videoRef} muted playsInline /><div className="scan-brackets" /><span>{cameraState}</span></div><h2>Scan a barcode</h2><p>Allow camera access and hold the barcode inside the frame. The result will be looked up and analyzed automatically.</p><form onSubmit={(event) => { event.preventDefault(); setScanOpen(false); void processBarcode(barcodeInput) }}><div className="barcode-input"><Barcode size={18} /><input value={barcodeInput} onChange={(event) => setBarcodeInput(event.target.value)} placeholder="Or enter a barcode" inputMode="numeric" /><button type="submit" aria-label="Process barcode"><Search size={17} /></button></div></form></div></div>}
    {profileOpen && <div className="modal-backdrop" onClick={() => setProfileOpen(false)}><div className="profile-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Personal profile</p><h2>Sensitivities</h2></div><button className="modal-close static" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={18} /></button></div><p className="modal-intro">Add sensitivities and the ingredient names that should match them.</p><div className="allergen-settings">{activeAllergens.map((item) => <div className="allergen-setting" key={item.name}><span className="check-control checked"><Check size={14} /></span><span><strong>{item.name}</strong><small>{item.hint || 'No alternative names'}</small></span><button className="sensitivity-delete" onClick={() => deleteSensitivity(item.name)} aria-label={`Delete ${item.name}`}><Trash2 size={15} /></button></div>)}</div><form className="add-sensitivity-form" onSubmit={addSensitivity}><input name="name" placeholder="Sensitivity name" required /><input name="aliases" placeholder="Alternative names, comma separated" required /><button className="outline-button" type="submit"><Plus size={15} /> Add</button></form><button className="primary-button full-width" onClick={() => setProfileOpen(false)}>Done</button></div></div>}
    {loading && <div className="loading-bar" aria-label="Loading" />}{error && <div className="error-toast" role="alert"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
  </main>
}

function ResultCard({ analysis, onOpenProfile }: { analysis: Analysis; onOpenProfile: () => void }) {
  return <article className={`result-card ${analysis.status}`}><div className="result-top"><div className="product-ident"><div className="product-thumb">{analysis.image ? <img src={analysis.image} alt="" /> : <Barcode size={22} />}</div><div><p className="result-label">{analysis.brand}</p><h3>{analysis.name}</h3><span className="product-meta">{analysis.category} · {analysis.barcode}</span></div></div><div className="scan-time"><Clock3 size={14} /> {new Date(analysis.checkedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div></div><div className="result-divider" /><div className="safety-summary"><div className={`status-orb ${analysis.status}`}><StatusMark status={analysis.status} /></div><div><div className="safety-title"><h2>{statusCopy[analysis.status].label}</h2>{analysis.status === 'danger' && <span className="severity-pill">HIGH RISK</span>}</div><p>{statusCopy[analysis.status].description}</p></div></div>{analysis.matches.length > 0 && <div className="match-list">{analysis.matches.map((match) => <div className="match-row" key={match}><span className="match-dot" /><span><strong>{match}</strong> <em>matched in ingredients</em></span><ChevronDown size={16} /></div>)}</div>}<div className="ingredients-block"><strong>Ingredients</strong><p>{analysis.ingredients}</p>{analysis.advisory && <><strong>Advisory</strong><p>{analysis.advisory}</p></>}</div><button className="outline-button full-width" onClick={onOpenProfile}>Adjust sensitivities <Settings2 size={15} /></button></article>
}
