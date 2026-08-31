import Head from 'next/head'
import { useRouter } from 'next/router'
import AppNav from '../components/AppNav'
import TemurotPolygon from '../components/TemurotPolygon'
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { calculateGematria } from '../utils/gematria'
import { generateHebrewNumbers, getHebrewNumberName } from '../utils/hebrewNumbers'
import { analyzeStory, buildLegend, edgePunctuation } from '../utils/storyAnalysis'

// useLayoutEffect on the client, useEffect on the server (avoids SSR warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// The two letter permutations of the תמורות panel, each a full mapping of the
// alphabet: א״ת ב״ש mirrors it (א↔ת, ב↔ש …), כוז״ו shifts it by one (א→ב).
const HEBREW_ALPHABET = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט',
  'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ',
  'ק', 'ר', 'ש', 'ת'
]

const FINAL_TO_REGULAR = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }

const temurahTable = (to) => HEBREW_ALPHABET.map((from, index) => ({ from, to: to(index) }))

const TEMUROT = [
  {
    id: 'atbash',
    label: 'א״ת ב״ש',
    arrow: '↔',
    table: temurahTable((i) => HEBREW_ALPHABET[HEBREW_ALPHABET.length - 1 - i])
  },
  {
    id: 'kuzoo',
    label: 'כוז״ו',
    arrow: '←',
    table: temurahTable((i) => HEBREW_ALPHABET[(i + 1) % HEBREW_ALPHABET.length])
  }
]

// A final letter is permuted as the regular letter it stands for; anything that
// is not a Hebrew letter — a space, a mark, a digit — is left as it is.
function applyTemurah(temurah, text) {
  const map = new Map(temurah.table.map(({ from, to }) => [from, to]))
  return text
    .split('')
    .map((char) => map.get(FINAL_TO_REGULAR[char] || char) || char)
    .join('')
}

/*
 * The state of the polygon screen, kept in the query string like the rest of
 * the page so that a תמורה of a word can be linked to. The chosen תמורה travels
 * under its own name — C3 for the rotation by three, R7 for the seventh fold —
 * and an empty name means none is chosen.
 */
const POLYGON_DEFAULTS = { n: 22, axis: 0, rotation: 0, word: '', temurah: null, convex: false }

const encodeTemurah = (temurah) => {
  if (!temurah) return ''
  return temurah.kind === 'rotation' ? `C${temurah.value}` : `R${temurah.value + 1}`
}

const decodeTemurah = (name) => {
  const match = /^([CR])(\d+)$/.exec(name || '')
  if (!match) return null
  const value = parseInt(match[2], 10)
  if (match[1] === 'C') return value >= 0 && value < 22 ? { kind: 'rotation', value } : null
  return value >= 1 && value <= 22 ? { kind: 'reflection', value: value - 1 } : null
}

// Hebrew letters with their milouyim (full spellings)
const hebrewLetters = [
  { letter: 'א', milouy: 'אלף' },
  { letter: 'ב', milouy: 'בית' },
  { letter: 'ג', milouy: 'גימל' },
  { letter: 'ד', milouy: 'דלת' },
  { letter: 'ה', milouy: 'הא' },
  { letter: 'ו', milouy: 'ויו' },
  { letter: 'ז', milouy: 'זיין' },
  { letter: 'ח', milouy: 'חית' },
  { letter: 'ט', milouy: 'טית' },
  { letter: 'י', milouy: 'יוד' },
  { letter: 'כ', milouy: 'כף' },
  { letter: 'ל', milouy: 'למד' },
  { letter: 'מ', milouy: 'מים' },
  { letter: 'נ', milouy: 'נון' },
  { letter: 'ס', milouy: 'סמך' },
  { letter: 'ע', milouy: 'עין' },
  { letter: 'פ', milouy: 'פא' },
  { letter: 'צ', milouy: 'צדי' },
  { letter: 'ק', milouy: 'קוף' },
  { letter: 'ר', milouy: 'ריש' },
  { letter: 'ש', milouy: 'שין' },
  { letter: 'ת', milouy: 'תיו' }
].map(item => ({
  ...item,
  gematria: calculateGematria(item.milouy)
}))

// Create a map of letters to their milouyim for easy lookup
const letterToMilouy = {}
hebrewLetters.forEach(item => {
  letterToMilouy[item.letter] = item.milouy
})

export default function Home() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [minNumber, setMinNumber] = useState(1)
  const [maxNumber, setMaxNumber] = useState(10)
  const [calculatedMin, setCalculatedMin] = useState(1)
  const [calculatedMax, setCalculatedMax] = useState(10)
  const [showFixedPoints, setShowFixedPoints] = useState(false)
  const [showMilouyOfMilouy, setShowMilouyOfMilouy] = useState(false)
  const [milouyApplications, setMilouyApplications] = useState(1)
  const [hideMilouyim, setHideMilouyim] = useState(false)
  const [numberInput, setNumberInput] = useState('')
  const [maxSteps, setMaxSteps] = useState(20)
  const [temurotInput, setTemurotInput] = useState('')
  const [polygon, setPolygon] = useState(POLYGON_DEFAULTS)
  const [storyText, setStoryText] = useState('')
  const [storyNumbers, setStoryNumbers] = useState([''])
  const [showStoryEditor, setShowStoryEditor] = useState(true)
  const [showMatches, setShowMatches] = useState(true)
  const [ignorePunctuation, setIgnorePunctuation] = useState(false)
  const [followMode, setFollowMode] = useState(true)
  const [matchesSpacer, setMatchesSpacer] = useState(0)
  const [invalidatedMatches, setInvalidatedMatches] = useState([])
  const [selectionInfo, setSelectionInfo] = useState(null)
  const [hoverTip, setHoverTip] = useState(null)
  const [matchTops, setMatchTops] = useState([])
  const [layoutTick, setLayoutTick] = useState(0)
  const [showGematriaTable, setShowGematriaTable] = useState(false)
  const calculatorInputs = useMemo(() => input.split('\n'), [input])
  const calculatorInputRef = useRef(null)
  const numberInputRef = useRef(null)
  const polygonWordRef = useRef(null)
  const storyInputRef = useRef(null)
  const storyOutputRef = useRef(null)
  const matchesListRef = useRef(null)
  const hoverTipRef = useRef(null)
  const scrollSource = useRef(null)
  const scrollTimer = useRef(null)
  const hasHydratedFromUrl = useRef(false)
  const isSyncingUrl = useRef(false)
  const rowRefs = useRef([])
  const pendingSwapRef = useRef(null)

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeTab])

  // Hide the selection-value badge when a new click/selection starts
  // (but not when clicking the badge itself, e.g. its "add" button)
  useEffect(() => {
    const clear = (e) => {
      if (e.target.closest && e.target.closest('.story-selection-badge')) return
      setSelectionInfo(null)
    }
    document.addEventListener('mousedown', clear)
    return () => document.removeEventListener('mousedown', clear)
  }, [])

  // Hydrate state from URL query for deep links and back/forward nav
  useEffect(() => {
    if (!router.isReady) return
    if (isSyncingUrl.current) {
      isSyncingUrl.current = false
      return
    }

    const getQueryValue = (value) => {
      if (Array.isArray(value)) return value[0]
      return value
    }
    const getString = (key, fallback = '') => {
      const value = getQueryValue(router.query[key])
      return typeof value === 'string' ? value : fallback
    }
    const getInt = (key, fallback) => {
      const value = parseInt(getString(key, ''), 10)
      return Number.isNaN(value) ? fallback : value
    }
    const getBool = (key, fallback = false) => {
      const value = getString(key, '')
      if (value === '1') return true
      if (value === '0') return false
      return fallback
    }

    // א״ת ב״ש and כוז״ו used to be panels of their own, and so did מספרים;
    // links to any of them now land on the panel that took them in.
    const legacyTabs = { atbash: 'temurot', kuzoo: 'temurot', numbers: 'number' }
    const nextActiveTab = legacyTabs[getString('tab', activeTab)] || getString('tab', activeTab)
    const allowedTabs = new Set(['home', 'calculator', 'temurot', 'number', 'letters', 'story'])
    if (allowedTabs.has(nextActiveTab)) setActiveTab(nextActiveTab)

    setInput(getString('input', input))
    setMinNumber(getInt('min', minNumber))
    setMaxNumber(getInt('max', maxNumber))
    setCalculatedMin(getInt('cmin', calculatedMin))
    setCalculatedMax(getInt('cmax', calculatedMax))
    setShowFixedPoints(getBool('fixed', showFixedPoints))
    setShowMilouyOfMilouy(getBool('milouy', showMilouyOfMilouy))
    setMilouyApplications(getInt('milouyApps', milouyApplications))
    setHideMilouyim(getBool('hideMilouyim', hideMilouyim))
    setShowGematriaTable(getBool('gtable', showGematriaTable))
    setNumberInput(getString('numberInput', numberInput))
    setMaxSteps(getInt('maxSteps', maxSteps))
    setTemurotInput(
      getString('temurotInput', getString('atbashInput', getString('kuzooInput', temurotInput)))
    )
    const polygonN = Math.min(22, Math.max(3, getInt('pn', polygon.n)))
    setPolygon({
      n: polygonN,
      axis: Math.min(Math.max(0, getInt('px', polygon.axis)), polygonN - 1),
      rotation: Math.max(1 - polygonN, Math.min(polygonN - 1, getInt('pr', polygon.rotation))),
      word: getString('pw', polygon.word),
      temurah: decodeTemurah(getString('pt', '')),
      convex: getBool('pc', polygon.convex)
    })
    setStoryText(getString('story', storyText))
    const storyNumbersRaw = getString('storyNumbers', '')
    if (storyNumbersRaw) {
      const parsed = storyNumbersRaw.split(',').map((s) => s.trim()).filter(Boolean)
      setStoryNumbers(parsed.length ? parsed : [''])
    }
    setShowStoryEditor(getBool('storyEditor', showStoryEditor))
    setShowMatches(getBool('storyMatches', showMatches))
    setIgnorePunctuation(getBool('storyIgnorePunct', ignorePunctuation))
    setFollowMode(getBool('storyFollow', followMode))
    const storyInvalidRaw = getString('storyInvalid', '')
    if (storyInvalidRaw) setInvalidatedMatches(storyInvalidRaw.split('~').filter(Boolean))

    hasHydratedFromUrl.current = true
  }, [router.isReady, router.query])

  // Focus input when tab changes (also runs on initial mount)
  useEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (activeTab === 'calculator' && calculatorInputRef.current) {
          calculatorInputRef.current.focus({ preventScroll: true })
        } else if (activeTab === 'number' && numberInputRef.current) {
          numberInputRef.current.focus({ preventScroll: true })
        } else if (activeTab === 'temurot' && polygonWordRef.current) {
          polygonWordRef.current.focus({ preventScroll: true })
        } else if (activeTab === 'story' && storyInputRef.current) {
          storyInputRef.current.focus({ preventScroll: true })
        }
      })
    }, 0)

    return () => clearTimeout(timer)
  }, [activeTab])

  // Sync state to URL query for deep linking
  useEffect(() => {
    if (!router.isReady || !hasHydratedFromUrl.current) return

    const nextQuery = {
      tab: activeTab,
      input: input || '',
      min: String(minNumber),
      max: String(maxNumber),
      cmin: String(calculatedMin),
      cmax: String(calculatedMax),
      fixed: showFixedPoints ? '1' : '0',
      milouy: showMilouyOfMilouy ? '1' : '0',
      milouyApps: String(milouyApplications),
      hideMilouyim: hideMilouyim ? '1' : '0',
      gtable: showGematriaTable ? '1' : '0',
      numberInput: numberInput || '',
      maxSteps: String(maxSteps),
      temurotInput: temurotInput || '',
      pn: String(polygon.n),
      px: String(polygon.axis),
      pr: String(polygon.rotation),
      pw: polygon.word || '',
      pt: encodeTemurah(polygon.temurah),
      pc: polygon.convex ? '1' : '0',
      story: storyText || '',
      storyNumbers: storyNumbers.map((s) => String(s).trim()).filter(Boolean).join(','),
      storyEditor: showStoryEditor ? '1' : '0',
      storyMatches: showMatches ? '1' : '0',
      storyIgnorePunct: ignorePunctuation ? '1' : '0',
      storyFollow: followMode ? '1' : '0',
      storyInvalid: invalidatedMatches.join('~')
    }

    const normalize = (value) => {
      if (Array.isArray(value)) return value[0] ?? ''
      return value ?? ''
    }

    const keys = Object.keys(nextQuery)
    const isSame = keys.every((key) => {
      return normalize(router.query[key]) === nextQuery[key]
    })

    if (isSame) return

    isSyncingUrl.current = true
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
  }, [
    router.isReady,
    router.pathname,
    router.query,
    activeTab,
    input,
    minNumber,
    maxNumber,
    calculatedMin,
    calculatedMax,
    showFixedPoints,
    showMilouyOfMilouy,
    milouyApplications,
    hideMilouyim,
    showGematriaTable,
    numberInput,
    maxSteps,
    temurotInput,
    polygon,
    storyText,
    storyNumbers,
    showStoryEditor,
    showMatches,
    ignorePunctuation,
    followMode,
    invalidatedMatches
  ])

  const temurotOutputs = useMemo(
    () => Object.fromEntries(TEMUROT.map((t) => [t.id, applyTemurah(t, temurotInput)])),
    [temurotInput]
  )

  // Gematria correspondence table data
  const gematriaTable = [
    { letter: 'א', value: 1 },
    { letter: 'ב', value: 2 },
    { letter: 'ג', value: 3 },
    { letter: 'ד', value: 4 },
    { letter: 'ה', value: 5 },
    { letter: 'ו', value: 6 },
    { letter: 'ז', value: 7 },
    { letter: 'ח', value: 8 },
    { letter: 'ט', value: 9 },
    { letter: 'י', value: 10 },
    { letter: 'כ', value: 20 },
    { letter: 'ל', value: 30 },
    { letter: 'מ', value: 40 },
    { letter: 'נ', value: 50 },
    { letter: 'ס', value: 60 },
    { letter: 'ע', value: 70 },
    { letter: 'פ', value: 80 },
    { letter: 'צ', value: 90 },
    { letter: 'ק', value: 100 },
    { letter: 'ר', value: 200 },
    { letter: 'ש', value: 300 },
    { letter: 'ת', value: 400 }
  ]

  // Generate recursive number name chain for a specific gender
  const getNumberNameChain = (num, gender = 'masculine', maxSteps = 20) => {
    const chain = []
    let current = parseInt(num)
    const seen = new Set()
    
    if (isNaN(current) || current < 1) {
      return chain
    }
    
    for (let i = 0; i < maxSteps; i++) {
      if (seen.has(current)) {
        // Detected a cycle - only break if we've already added enough steps
        if (chain.length >= maxSteps) {
          break
        }
        // Otherwise continue to show the cycle
      }
      seen.add(current)
      
      const name = getHebrewNumberName(current, gender)
      const nameGematria = calculateGematria(name)
      
      chain.push({
        number: current,
        name: name,
        gematria: nameGematria
      })
      
      // Continue to next step even if it's a fixed point, unless we've reached maxSteps
      if (i >= maxSteps - 1) {
        break
      }
      
      current = nameGematria
    }
    
    return chain
  }

  const masculineChain = useMemo(() => {
    if (!numberInput) return []
    return getNumberNameChain(numberInput, 'masculine', maxSteps)
  }, [numberInput, maxSteps])

  const feminineChain = useMemo(() => {
    if (!numberInput) return []
    return getNumberNameChain(numberInput, 'feminine', maxSteps)
  }, [numberInput, maxSteps])

  // Helper function to find the index where a number first appeared in the chain
  const findFirstOccurrence = (chain, currentIndex, number) => {
    for (let i = 0; i < currentIndex; i++) {
      if (chain[i].number === number) {
        return i + 1 // Return 1-based index (step number)
      }
    }
    return null
  }

  // Map final letters to their non-final counterparts
  const finalToNonFinal = {
    'ך': 'כ',
    'ם': 'מ',
    'ן': 'נ',
    'ף': 'פ',
    'ץ': 'צ'
  }

  // Extract unique letters from a milouy string
  const getLettersFromMilouy = (milouy) => {
    const cleanMilouy = milouy.replace(/\s/g, '')
    const letterSet = new Set()
    
    cleanMilouy.split('').forEach(char => {
      // Convert final letter to non-final for display
      const displayChar = finalToNonFinal[char] || char
      // Only include if it's a Hebrew letter
      if (letterToMilouy[displayChar] || letterToMilouy[char]) {
        letterSet.add(displayChar)
      }
    })
    
    const letters = Array.from(letterSet)
    return letters.sort((a, b) => {
      // Sort by the original letter order in hebrewLetters
      const indexA = hebrewLetters.findIndex(item => item.letter === a)
      const indexB = hebrewLetters.findIndex(item => item.letter === b)
      return indexA - indexB
    })
  }

  // Replace final letters with non-final ones in text (preserves spaces)
  const replaceFinalLetters = (text) => {
    return text.split('').map(char => {
      // Keep spaces as-is, replace final letters
      if (char === ' ') return char
      return finalToNonFinal[char] || char
    }).join('')
  }

  // Calculate milouy of milouy recursively, returning all steps
  const getMilouyOfMilouySteps = (milouy, depth = 1) => {
    const steps = []
    let current = milouy
    
    for (let i = 0; i < depth; i++) {
      // Remove spaces for processing
      const cleanMilouy = current.replace(/\s/g, '')
      
      const result = cleanMilouy.split('').map(char => {
        // Convert final letter to non-final if needed
        const nonFinalChar = finalToNonFinal[char] || char
        return letterToMilouy[nonFinalChar] || char
      }).join(' ')
      
      // Replace final letters in the displayed result
      const displayResult = replaceFinalLetters(result)
      steps.push(displayResult)
      current = result.replace(/\s/g, '')
    }
    
    return steps
  }

  const hebrewNumbers = useMemo(() => {
    const allNumbers = generateHebrewNumbers(calculatedMin, calculatedMax)
    if (showFixedPoints) {
      return allNumbers.filter(item => 
        item.number === item.masculineGematria || item.number === item.feminineGematria
      )
    }
    return allNumbers
  }, [calculatedMin, calculatedMax, showFixedPoints])

  const handleCalculate = () => {
    // Ensure valid range before calculating
    const finalMin = minNumber < maxNumber ? minNumber : maxNumber - 1
    const finalMax = maxNumber > minNumber ? maxNumber : minNumber + 1
    setCalculatedMin(finalMin)
    setCalculatedMax(finalMax)
    // Update input values to match calculated values if they were adjusted
    if (finalMin !== minNumber) setMinNumber(finalMin)
    if (finalMax !== maxNumber) setMaxNumber(finalMax)
  }

  const updateCalculatorInput = (index, value) => {
    const nextInputs = [...calculatorInputs]
    nextInputs[index] = value
    setInput(nextInputs.join('\n'))
  }

  const addCalculatorInput = () => {
    setInput(previousInput => `${previousInput}\n`)
  }

  const removeCalculatorInput = (index) => {
    if (calculatorInputs.length === 1) {
      setInput('')
      return
    }

    setInput(calculatorInputs.filter((_, inputIndex) => inputIndex !== index).join('\n'))
  }

  // Reorder calculator lines: move the line at index one step up (-1) or down (+1)
  const moveCalculatorInput = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= calculatorInputs.length) return
    // Remember which two rows swapped so the layout effect can animate the move
    pendingSwapRef.current = { a: index, b: target }
    setInput(previousInput => {
      const nextInputs = previousInput.split('\n')
      if (target < 0 || target >= nextInputs.length) return previousInput
      const temp = nextInputs[index]
      nextInputs[index] = nextInputs[target]
      nextInputs[target] = temp
      return nextInputs.join('\n')
    })
  }

  // Animate a line swap (FLIP): rows are keyed by index so the DOM nodes stay put
  // and only their content swaps — slide each affected row from its old position.
  useIsomorphicLayoutEffect(() => {
    const pending = pendingSwapRef.current
    if (!pending) return
    pendingSwapRef.current = null

    const rowA = rowRefs.current[pending.a]
    const rowB = rowRefs.current[pending.b]
    if (!rowA || !rowB) return

    const deltaY = rowB.getBoundingClientRect().top - rowA.getBoundingClientRect().top
    if (!deltaY) return

    const options = { duration: 220, easing: 'ease' }
    ;[rowA, rowB].forEach((el) => el.getAnimations().forEach((anim) => anim.cancel()))
    rowA.animate([{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }], options)
    rowB.animate([{ transform: `translateY(${-deltaY}px)` }, { transform: 'translateY(0)' }], options)
  }, [input])

  // --- ספור (story) tab helpers and curation ---
  const updateStoryNumber = (index, value) => {
    setStoryNumbers((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  const addStoryNumber = () => {
    setStoryNumbers((prev) => [...prev, ''])
  }

  const removeStoryNumber = (index) => {
    setStoryNumbers((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  // Toggle a single highlight (match) between valid and invalid
  const toggleMatchValidity = (key) => {
    setInvalidatedMatches((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    ))
  }

  // Show the gematria value of any text the user selects inside the output
  const handleStorySelection = () => {
    const selection = window.getSelection()
    const output = storyOutputRef.current
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !output) {
      setSelectionInfo(null)
      return
    }
    if (!output.contains(selection.anchorNode) || !output.contains(selection.focusNode)) {
      setSelectionInfo(null)
      return
    }
    const text = selection.toString()
    if (!text.trim()) {
      setSelectionInfo(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const value = calculateGematria(text)
    // Reveal every word / word-sequence in the text sharing this gematria
    const spans = storyAnalysis.findSpans(value)
    const tokenSet = new Set()
    spans.forEach((s) => { for (let t = s.tokenStart; t <= s.tokenEnd; t++) tokenSet.add(t) })
    setSelectionInfo({
      value,
      count: spans.length,
      tokenSet,
      top: rect.top,
      left: rect.left + rect.width / 2
    })
  }

  // Add the currently-selected text's gematria value to the highlighted numbers
  const addSelectionValue = () => {
    if (!selectionInfo || !selectionInfo.value) return
    const v = String(selectionInfo.value)
    setStoryNumbers((prev) => {
      const vals = prev.map((s) => String(s).trim())
      if (vals.includes(v)) return prev
      const emptyIdx = vals.indexOf('')
      if (emptyIdx >= 0) {
        const next = [...prev]
        next[emptyIdx] = v
        return next
      }
      return [...prev, v]
    })
    setSelectionInfo(null)
    const sel = window.getSelection()
    if (sel) sel.removeAllRanges()
  }

  // Follow mode: scrolling the text scrolls the matches list in lockstep (and back)
  const syncPanelScroll = (self, other) => {
    if (!followMode || !self || !other) return
    if (scrollSource.current && scrollSource.current !== self) return
    scrollSource.current = self
    other.scrollTop = self.scrollTop
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => { scrollSource.current = null }, 120)
  }

  // Export just the highlighted text (no title bar) as a PNG or PDF
  const exportStory = async (format) => {
    const output = storyOutputRef.current
    if (!output) return
    // Temporarily reveal the full (unscrolled) text so nothing is clipped
    const prevOverflow = output.style.overflow
    const prevHeight = output.style.height
    output.style.overflow = 'visible'
    output.style.height = 'auto'
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(output, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: true
      })
      if (format === 'png') {
        const link = document.createElement('a')
        link.download = 'ספר.png'
        link.href = dataUrl
        link.click()
      } else {
        const { jsPDF } = await import('jspdf')
        const img = new Image()
        img.src = dataUrl
        await new Promise((resolve) => { img.onload = resolve })
        const orientation = img.width >= img.height ? 'landscape' : 'portrait'
        const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] })
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height)
        pdf.save('ספר.pdf')
      }
    } finally {
      output.style.overflow = prevOverflow
      output.style.height = prevHeight
    }
  }

  // Hover a highlighted word -> show its detected gematriot in an in-block tooltip
  const handleTokenHover = (e) => {
    const el = e.target.closest && e.target.closest('.story-token-highlighted')
    const block = storyOutputRef.current && storyOutputRef.current.closest('.story-output-block')
    if (!el || !block) { setHoverTip(null); return }
    const idx = Number(el.getAttribute('data-ti'))
    const cov = storyAnalysis.tokenCover[idx]
    if (!cov || !cov.length) { setHoverTip(null); return }
    const chipMap = new Map()
    cov.forEach((m) => { if (!chipMap.has(m.key)) chipMap.set(m.key, m) })
    const rows = Array.from(chipMap.values()).sort((a, b) => a.value - b.value)
    const bRect = block.getBoundingClientRect()
    const tRect = el.getBoundingClientRect()
    setHoverTip({
      rows,
      cx: tRect.left + tRect.width / 2 - bRect.left,
      topY: tRect.top - bRect.top,
      botY: tRect.bottom - bRect.top
    })
  }

  // Clamp the hover tooltip so it always stays inside the output block
  useIsomorphicLayoutEffect(() => {
    const tip = hoverTipRef.current
    const block = storyOutputRef.current && storyOutputRef.current.closest('.story-output-block')
    if (!tip || !hoverTip || !block) return
    const bw = block.clientWidth
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    let left = Math.max(6, Math.min(hoverTip.cx - tw / 2, bw - tw - 6))
    let top = hoverTip.topY - th - 8
    if (top < 4) top = hoverTip.botY + 8
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }, [hoverTip])

  // Map each valid, distinct chosen number to a color (first occurrence wins)
  const storyLegend = useMemo(() => buildLegend(storyNumbers), [storyNumbers])

  // Tokenize the text, find every word / successive-word sequence whose gematria
  // matches one of the chosen numbers, and assign stacking lanes for overlaps.
  const storyAnalysis = useMemo(
    () => analyzeStory(storyText, storyLegend, invalidatedMatches, ignorePunctuation),
    [storyText, storyLegend, invalidatedMatches, ignorePunctuation]
  )

  // Re-measure the layout on resize (matches-row alignment depends on wrapping)
  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Place each התאמות row roughly at the vertical position of its own
  // occurrence in the highlighted text (approximate; ignores independent scroll).
  useIsomorphicLayoutEffect(() => {
    const output = storyOutputRef.current
    // Only align rows to text lines in follow mode; otherwise show a compact list
    if (!output || !showMatches || !followMode) { setMatchTops([]); setMatchesSpacer(0); return }
    const outTop = output.getBoundingClientRect().top - output.scrollTop
    const ROW_H = 44
    let cursor = 0
    const tops = storyAnalysis.matchList.map((m) => {
      const el = output.querySelector(`[data-ti="${m.tokenStart}"]`)
      const y = el ? el.getBoundingClientRect().top - outTop : cursor
      const target = Math.max(y, cursor)
      const margin = target - cursor
      cursor = target + ROW_H
      return margin
    })
    setMatchTops(tops)
    // Pad the list so it can scroll the full text height in follow mode
    setMatchesSpacer(followMode ? Math.max(0, output.scrollHeight - cursor) : 0)
  }, [storyText, storyAnalysis, showMatches, followMode, layoutTick])

  return (
    <>
      <Head>
        <title>ס.פ.ר</title>
        <meta name="description" content="ס.פ.ר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppNav current={activeTab} onSelectTab={setActiveTab} />
      <main className={`container${activeTab === 'story' ? ' container-fill' : ''}`}>
        {/* The verse the app is named after has a screen of its own; the
            working screens start straight in on their own matter. */}
        {activeTab === 'home' && (
          <div className="home">
            <h1 className="subtitle">
              <div>בשלשה ספרים</div>
              <div>בסֵפֶר וסְפָר וסִפֻּר</div>
            </h1>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="calculator">
            <div className="gematria-correspondence-table">
              <button
                type="button"
                className="gematria-table-toggle"
                onClick={() => setShowGematriaTable(!showGematriaTable)}
                aria-expanded={showGematriaTable}
              >
                <span className="gematria-table-toggle-label">ערכים</span>
                <svg
                  className={`gematria-table-toggle-chevron ${showGematriaTable ? 'open' : ''}`}
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={`gematria-table-wrapper ${showGematriaTable ? 'open' : ''}`}>
                <div className="gematria-table-inner">
                  <div className="gematria-table">
                    {gematriaTable.map((item, index) => (
                      <div key={index} className="gematria-table-row">
                        <div className="gematria-table-letter">{item.letter}</div>
                        <div className="gematria-table-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="calculator-inputs">
              {calculatorInputs.map((calculatorInput, index) => {
                const canReorder = calculatorInputs.length > 1
                return (
                  <div
                    className="calculator-input-row"
                    key={index}
                    ref={(el) => { rowRefs.current[index] = el }}
                  >
                    {canReorder && (
                      <div className="reorder-controls">
                        <button
                          type="button"
                          className="reorder-button"
                          onClick={() => moveCalculatorInput(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move gematria input ${index + 1} up`}
                        >
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="reorder-button"
                          onClick={() => moveCalculatorInput(index, 1)}
                          disabled={index === calculatorInputs.length - 1}
                          aria-label={`Move gematria input ${index + 1} down`}
                        >
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <input
                      ref={index === 0 ? calculatorInputRef : null}
                      type="text"
                      className="text-input"
                      value={calculatorInput}
                      onChange={(e) => updateCalculatorInput(index, e.target.value)}
                      dir="rtl"
                      autoFocus={index === 0}
                      aria-label={`Gematria input ${index + 1}`}
                    />
                    <div className="inline-result" aria-label={`Gematria result ${index + 1}`}>
                      {calculatorInput.trim() ? calculateGematria(calculatorInput) : ''}
                    </div>
                    <button
                      type="button"
                      className="remove-input-button"
                      onClick={() => removeCalculatorInput(index)}
                      aria-label={`Remove gematria input ${index + 1}`}
                    >
                      −
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className="add-input-button"
                onClick={addCalculatorInput}
                aria-label="Add gematria input"
              >
                +
              </button>
            </div>
          </div>
        )}

        {activeTab === 'letters' && (
          <div className="letters-section">
            <div className="letters-controls">
              <button 
                onClick={() => setShowMilouyOfMilouy(!showMilouyOfMilouy)} 
                className={`milouy-of-milouy-button ${showMilouyOfMilouy ? 'active' : ''}`}
              >
                מילויים של מילויים
              </button>
              {showMilouyOfMilouy && (
                <>
                  <div className="milouy-applications-control">
                    <label htmlFor="milouy-applications">מספר יישומים:</label>
                    <div className="milouy-applications-input-wrapper">
                      <button
                        type="button"
                        className="milouy-applications-arrow milouy-applications-decrement"
                        onClick={() => setMilouyApplications(Math.max(1, milouyApplications - 1))}
                        disabled={milouyApplications <= 1}
                        aria-label="Decrease"
                      >
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <input
                        id="milouy-applications"
                        type="number"
                        min="1"
                        max="10"
                        value={milouyApplications}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          if (!isNaN(val) && val >= 1) {
                            setMilouyApplications(Math.min(val, 10))
                          }
                        }}
                        className="milouy-applications-input"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        className="milouy-applications-arrow milouy-applications-increment"
                        onClick={() => setMilouyApplications(Math.min(10, milouyApplications + 1))}
                        disabled={milouyApplications >= 10}
                        aria-label="Increase"
                      >
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="hide-milouyim-control">
                    <label htmlFor="hide-milouyim" className="hide-milouyim-label">
                      <input
                        id="hide-milouyim"
                        type="checkbox"
                        checked={hideMilouyim}
                        onChange={(e) => setHideMilouyim(e.target.checked)}
                        className="hide-milouyim-checkbox"
                      />
                      הסתר מילויים
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="letters-list">
              {hebrewLetters.map((item) => {
                const milouySteps = showMilouyOfMilouy ? getMilouyOfMilouySteps(item.milouy, milouyApplications) : []
                
                return (
                  <div 
                    key={item.letter} 
                    className="letter-item"
                  >
                    <div className="letter-row">
                      <div className="letter-char">{item.letter}</div>
                      <div className="letter-milouy">{item.milouy}</div>
                      <div className="letter-gematria">{item.gematria}</div>
                    </div>
                    {showMilouyOfMilouy && milouySteps.length > 0 && (
                      <div className="milouy-of-milouy-steps">
                        {milouySteps.map((step, index) => {
                          const stepGematria = calculateGematria(step.replace(/\s/g, ''))
                          const stepLetters = getLettersFromMilouy(step)
                          const distinctLetterCount = stepLetters.length
                          return (
                            <div key={index} className="milouy-step">
                              <div className="milouy-step-number">{index + 1}</div>
                              <div className="milouy-step-content">
                                {!hideMilouyim && (
                                  <div className="milouy-of-milouy-text">{step}</div>
                                )}
                                <div className="milouy-stats">
                                  <div className="milouy-of-milouy-gematria">{stepGematria}</div>
                                  <div className="milouy-letter-count">{distinctLetterCount} אותיות שונות</div>
                                </div>
                                {stepLetters.length > 0 && (
                                  <div className="milouy-letters-list">
                                    {stepLetters.map((letter, letterIndex) => (
                                      <span key={letterIndex} className="milouy-letter-badge">
                                        {letter}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'number' && (
          <div className="number-section">
            <div className="number-input-control">
              <input
                ref={numberInputRef}
                id="number-input"
                type="number"
                value={numberInput}
                onChange={(e) => {
                  const val = e.target.value
                  setNumberInput(val)
                }}
                className="number-input"
                dir="ltr"
              />
            </div>
            <div className="number-steps-control">
              <label htmlFor="max-steps">מספר שלבים מקסימלי:</label>
              <div className="number-steps-input-wrapper">
                <button
                  type="button"
                  className="number-steps-arrow number-steps-decrement"
                  onClick={() => setMaxSteps(Math.max(1, maxSteps - 1))}
                  disabled={maxSteps <= 1}
                  aria-label="Decrease"
                >
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <input
                  id="max-steps"
                  type="number"
                  min="1"
                  max="100"
                  value={maxSteps}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val) && val >= 1) {
                      setMaxSteps(Math.min(val, 100))
                    }
                  }}
                  className="number-steps-input"
                  dir="ltr"
                />
                <button
                  type="button"
                  className="number-steps-arrow number-steps-increment"
                  onClick={() => setMaxSteps(Math.min(100, maxSteps + 1))}
                  disabled={maxSteps >= 100}
                  aria-label="Increase"
                >
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="number-halves">
              <div className="number-half">
                {(masculineChain.length > 0 || feminineChain.length > 0) && (
                  <div className="number-chain-columns">
                    <div className="number-chain-column">
                      <div className="number-chain-column-header">זכר</div>
                      <div className="number-chain">
                        {masculineChain.map((step, index) => {
                          const firstOccurrenceIndex = findFirstOccurrence(masculineChain, index, step.number)
                          const isRepeated = firstOccurrenceIndex !== null
                          return (
                            <div 
                              key={index} 
                              className={`number-chain-step ${isRepeated ? 'repeated-value' : ''}`}
                            >
                              <div className="number-chain-step-number">
                                {index + 1}
                                {isRepeated && (
                                  <span className="number-chain-step-original"> ({firstOccurrenceIndex})</span>
                                )}
                              </div>
                              <div className="number-chain-number">{step.number}</div>
                              <div className="number-chain-name">{step.name}</div>
                              <div className="number-chain-gematria">{step.gematria}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="number-chain-column">
                      <div className="number-chain-column-header">נקבה</div>
                      <div className="number-chain">
                        {feminineChain.map((step, index) => {
                          const firstOccurrenceIndex = findFirstOccurrence(feminineChain, index, step.number)
                          const isRepeated = firstOccurrenceIndex !== null
                          return (
                            <div 
                              key={index} 
                              className={`number-chain-step ${isRepeated ? 'repeated-value' : ''}`}
                            >
                              <div className="number-chain-step-number">
                                {index + 1}
                                {isRepeated && (
                                  <span className="number-chain-step-original"> ({firstOccurrenceIndex})</span>
                                )}
                              </div>
                              <div className="number-chain-number">{step.number}</div>
                              <div className="number-chain-name">{step.name}</div>
                              <div className="number-chain-gematria">{step.gematria}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="number-half">
                <div className="range-controls">
                  <div className="range-input-group">
                    <label htmlFor="min-number">מ:</label>
                    <input
                      id="min-number"
                      type="number"
                      value={minNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) {
                          setMinNumber(val)
                        } else if (e.target.value === '' || e.target.value === '-') {
                          // Allow empty or minus sign while typing
                          return
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val >= maxNumber) {
                          setMinNumber(maxNumber - 1)
                        }
                      }}
                      className="range-input"
                      dir="ltr"
                    />
                  </div>
                  <div className="range-input-group">
                    <label htmlFor="max-number">עד:</label>
                    <input
                      id="max-number"
                      type="number"
                      value={maxNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) {
                          setMaxNumber(val)
                        } else if (e.target.value === '' || e.target.value === '-') {
                          // Allow empty or minus sign while typing
                          return
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val <= minNumber) {
                          setMaxNumber(minNumber + 1)
                        }
                      }}
                      className="range-input"
                      dir="ltr"
                    />
                  </div>
                  <button onClick={handleCalculate} className="calculate-button">
                    חשב
                  </button>
                  <button 
                    onClick={() => setShowFixedPoints(!showFixedPoints)} 
                    className={`fixed-point-button ${showFixedPoints ? 'active' : ''}`}
                  >
                    נקודת שבת
                  </button>
                </div>
                <div className="numbers-list">
                  {hebrewNumbers.map((item) => {
                    const matchesGematria = item.number === item.masculineGematria || item.number === item.feminineGematria
                    return (
                      <div 
                        key={item.number} 
                        className={`number-item ${matchesGematria ? 'matches-gematria' : ''}`}
                      >
                        <div className="number-value">{item.number}</div>
                        <div className="number-row">
                          <div className="number-name">
                            {item.masculine}
                          </div>
                          <div className="number-gematria">{item.masculineGematria}</div>
                        </div>
                        <div className="number-row">
                          <div className="number-name feminine">
                            {item.feminine}
                          </div>
                          <div className="number-gematria">{item.feminineGematria}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'temurot' && (
          <div className="temurot-section">
            <TemurotPolygon
              inputRef={polygonWordRef}
              value={polygon}
              onChange={(patch) => setPolygon((current) => ({ ...current, ...patch }))}
            />

            <div className="atbash-input-control">
              <input
                id="temurot-input"
                type="text"
                value={temurotInput}
                onChange={(e) => setTemurotInput(e.target.value)}
                className="atbash-input"
                dir="rtl"
              />
            </div>

            <div className="temurot-grid">
              {TEMUROT.map((temurah) => (
                <section className="temurot-card" key={temurah.id}>
                  <h2 className="temurot-card-title">{temurah.label}</h2>

                  {temurotInput && (
                    <div className="atbash-result">
                      <div className="atbash-result-value">{temurotOutputs[temurah.id]}</div>
                    </div>
                  )}

                  <div className="atbash-correspondence-table">
                    <div className="atbash-table">
                      {temurah.table.map((item, index) => (
                        <div key={index} className="atbash-table-row">
                          <div className="atbash-table-letter">{item.from}</div>
                          <div className="atbash-table-arrow">{temurah.arrow}</div>
                          <div className="atbash-table-letter">{item.to}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'story' && (
          <div className="story-section">
            <div className="story-numbers">
              {storyNumbers.map((num, index) => {
                const value = parseInt(num, 10)
                const color = (!Number.isNaN(value) && value > 0) ? storyLegend.get(value) : null
                return (
                  <div className="story-number-row" key={index}>
                    <span
                      className="story-swatch"
                      style={{ background: color || 'transparent', borderColor: color || '#ddd' }}
                      aria-hidden="true"
                    />
                    <input
                      type="number"
                      className="story-number-input"
                      value={num}
                      onChange={(e) => updateStoryNumber(index, e.target.value)}
                      dir="ltr"
                      placeholder="0"
                      aria-label={`מספר ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="remove-input-button"
                      onClick={() => removeStoryNumber(index)}
                      aria-label={`הסר מספר ${index + 1}`}
                    >
                      −
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className="add-input-button"
                onClick={addStoryNumber}
                aria-label="הוסף מספר"
              >
                +
              </button>
              <label className="story-punct-toggle">
                <input
                  type="checkbox"
                  checked={ignorePunctuation}
                  onChange={(e) => setIgnorePunctuation(e.target.checked)}
                />
                התעלם מסימני פיסוק
              </label>
              <label className="story-punct-toggle">
                <input
                  type="checkbox"
                  checked={followMode}
                  onChange={(e) => setFollowMode(e.target.checked)}
                />
                מעקב גלילה
              </label>
            </div>

            <div className="story-editor">
              <button
                type="button"
                className="story-editor-toggle"
                onClick={() => setShowStoryEditor(!showStoryEditor)}
                aria-expanded={showStoryEditor}
              >
                <svg className="story-block-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="טקסט">
                  <path d="M4 7h16M4 12h16M4 17h10" />
                </svg>
                <svg
                  className={`story-editor-toggle-chevron ${showStoryEditor ? 'open' : ''}`}
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={`story-editor-wrapper ${showStoryEditor ? 'open' : ''}`}>
                <div className="story-editor-inner">
                  <div className="story-editor-content">
                    <textarea
                      ref={storyInputRef}
                      className="story-textarea"
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                      dir="rtl"
                      rows={4}
                      placeholder="הדביקו או הקלידו כאן טקסט..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {storyText && (
              <div className="story-panels">
              <div className="story-output-block">
                <div className="story-output-header">
                  <div className="story-output-legend">
                    {Array.from(storyLegend.entries()).map(([value, color]) => (
                      <div className="story-legend-item" key={value}>
                        <span className="story-swatch" style={{ background: color, borderColor: color }} aria-hidden="true" />
                        <span className="story-legend-value">{value}</span>
                        <span className="story-legend-count">{storyAnalysis.counts.get(value) || 0}</span>
                      </div>
                    ))}
                  </div>
                  <div className="story-output-actions">
                    <button type="button" className="story-export-btn" onClick={() => exportStory('png')} aria-label="ייצוא PNG">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </button>
                    <button type="button" className="story-export-btn" onClick={() => exportStory('pdf')} aria-label="ייצוא PDF">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </button>
                  </div>
                </div>
              <div
                ref={storyOutputRef}
                className="story-output"
                onMouseUp={handleStorySelection}
                onMouseOver={handleTokenHover}
                onMouseLeave={() => setHoverTip(null)}
                onScroll={() => syncPanelScroll(storyOutputRef.current, matchesListRef.current)}
                style={{ lineHeight: storyAnalysis.laneCount > 0 ? 1.3 + storyAnalysis.laneCount * 0.35 : 1.4 }}
              >
                {storyAnalysis.tokens.map((tok, i) => {
                  const cov = storyAnalysis.tokenCover[i]
                  const inSeq = selectionInfo && selectionInfo.tokenSet && selectionInfo.tokenSet.has(i)
                  const tint = 'linear-gradient(rgba(150, 150, 150, 0.38), rgba(150, 150, 150, 0.38))'
                  const highlighted = cov && cov.length > 0
                  if (!highlighted && !inSeq) {
                    return <span key={i} className="story-token">{tok.display}</span>
                  }
                  // A rule, or the tint of a revealed sequence, runs under the
                  // word and stops before the punctuation at its edges.
                  const { lead, trail } = edgePunctuation(tok.display)
                  const end = tok.display.length - trail.length
                  const from = end > lead.length ? lead.length : 0
                  const to = end > lead.length ? end : tok.display.length
                  const layers = (cov || []).map(
                    (m) => `linear-gradient(${m.color}, ${m.color}) left 0 bottom ${m.lane * 5}px / 100% 3px no-repeat`
                  )
                  if (inSeq) layers.push(tint)
                  const bottomPad = storyAnalysis.laneCount * 5 + 3
                  return (
                    <span
                      key={i}
                      data-ti={highlighted ? i : undefined}
                      className={`story-token${highlighted ? ' story-token-highlighted' : ''}${inSeq ? ' story-token-seqmatch' : ''}`}
                    >
                      {tok.display.slice(0, from)}
                      <span
                        className="story-token-ink"
                        style={{ background: layers.join(', '), paddingBottom: highlighted ? `${bottomPad}px` : undefined }}
                      >
                        {tok.display.slice(from, to)}
                      </span>
                      {tok.display.slice(to)}
                    </span>
                  )
                })}
              </div>
              {hoverTip && (
                <div ref={hoverTipRef} className="story-tip">
                  <div className="story-tip-card">
                    {hoverTip.rows.map((m) => (
                      <div className="story-tooltip-row" key={m.key}>
                        <span className="story-tooltip-dot" style={{ background: m.color }} aria-hidden="true" />
                        <span className="story-tooltip-val">{m.value}</span>
                        <span className="story-tooltip-phrase">{m.phrase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>

              {storyAnalysis.matchList.length > 0 && (
                <div className="story-matches">
                  <button
                    type="button"
                    className="story-matches-toggle"
                    onClick={() => setShowMatches(!showMatches)}
                    aria-expanded={showMatches}
                  >
                    <svg className="story-block-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="התאמות">
                      <path d="M9 6h11M9 12h11M9 18h11" />
                      <path d="M4 6l1.3 1.3L7 4.8" />
                      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
                      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <svg
                      className={`story-editor-toggle-chevron ${showMatches ? 'open' : ''}`}
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className={`story-matches-wrapper ${showMatches ? 'open' : ''}`}>
                    <div className="story-matches-inner">
                      <div
                        className="story-matches-list"
                        ref={matchesListRef}
                        onScroll={() => syncPanelScroll(matchesListRef.current, storyOutputRef.current)}
                      >
                        {storyAnalysis.matchList.map((m, index) => (
                          <label
                            className={`story-match-row ${m.invalid ? 'excluded' : ''}`}
                            key={m.key}
                            style={{ marginTop: matchTops[index] ? `${matchTops[index]}px` : undefined }}
                          >
                            <input
                              type="checkbox"
                              className="story-match-check"
                              checked={!m.invalid}
                              onChange={() => toggleMatchValidity(m.key)}
                              style={{ '--check-color': m.color }}
                            />
                            <span className="story-match-dot" style={{ background: m.color }} aria-hidden="true" />
                            <span className="story-match-value">{m.value}</span>
                            <span className="story-match-phrase">{m.phrase}</span>
                          </label>
                        ))}
                        {matchesSpacer > 0 && <div style={{ height: `${matchesSpacer}px`, flexShrink: 0 }} aria-hidden="true" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}

            {selectionInfo && (
              <div
                className="story-selection-badge"
                style={{ top: `${selectionInfo.top}px`, left: `${selectionInfo.left}px` }}
              >
                <span className="story-selection-value">{selectionInfo.value}</span>
                <button
                  type="button"
                  className="story-selection-add"
                  onClick={addSelectionValue}
                  aria-label="הוסף לרשימת המספרים"
                  title="הוסף למספרים"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}


