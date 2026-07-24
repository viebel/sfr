import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { calculateGematria } from '../utils/gematria'
import { generateHebrewNumbers, getHebrewNumberName } from '../utils/hebrewNumbers'

// useLayoutEffect on the client, useEffect on the server (avoids SSR warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

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

// Distinct, readable colors assigned to each chosen number in the "ספור" tab
const storyColors = [
  '#e6194B', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#008080', // teal
  '#f032e6', // magenta
  '#9A6324', // brown
  '#808000', // olive
  '#42d4f4'  // cyan
]

export default function Home() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('calculator')
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
  const [atbashInput, setAtbashInput] = useState('')
  const [kuzooInput, setKuzooInput] = useState('')
  const [storyText, setStoryText] = useState('')
  const [storyNumbers, setStoryNumbers] = useState([''])
  const [showStoryEditor, setShowStoryEditor] = useState(true)
  const [showMatches, setShowMatches] = useState(true)
  const [invalidatedMatches, setInvalidatedMatches] = useState([])
  const [selectionInfo, setSelectionInfo] = useState(null)
  const [hoverTip, setHoverTip] = useState(null)
  const [matchTops, setMatchTops] = useState([])
  const [layoutTick, setLayoutTick] = useState(0)
  const [showGematriaTable, setShowGematriaTable] = useState(false)
  const calculatorInputs = useMemo(() => input.split('\n'), [input])
  const calculatorInputRef = useRef(null)
  const numberInputRef = useRef(null)
  const atbashInputRef = useRef(null)
  const kuzooInputRef = useRef(null)
  const storyInputRef = useRef(null)
  const storyOutputRef = useRef(null)
  const hoverTipRef = useRef(null)
  const hasHydratedFromUrl = useRef(false)
  const isSyncingUrl = useRef(false)
  const rowRefs = useRef([])
  const pendingSwapRef = useRef(null)

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeTab])

  // Hide the selection-value badge when a new click/selection starts
  useEffect(() => {
    const clear = () => setSelectionInfo(null)
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

    const nextActiveTab = getString('tab', activeTab)
    const allowedTabs = new Set(['calculator', 'numbers', 'letters', 'number', 'atbash', 'kuzoo', 'story'])
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
    setAtbashInput(getString('atbashInput', atbashInput))
    setKuzooInput(getString('kuzooInput', kuzooInput))
    setStoryText(getString('story', storyText))
    const storyNumbersRaw = getString('storyNumbers', '')
    if (storyNumbersRaw) {
      const parsed = storyNumbersRaw.split(',').map((s) => s.trim()).filter(Boolean)
      setStoryNumbers(parsed.length ? parsed : [''])
    }
    setShowStoryEditor(getBool('storyEditor', showStoryEditor))
    setShowMatches(getBool('storyMatches', showMatches))
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
        } else if (activeTab === 'atbash' && atbashInputRef.current) {
          atbashInputRef.current.focus({ preventScroll: true })
        } else if (activeTab === 'kuzoo' && kuzooInputRef.current) {
          kuzooInputRef.current.focus({ preventScroll: true })
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
      atbashInput: atbashInput || '',
      kuzooInput: kuzooInput || '',
      story: storyText || '',
      storyNumbers: storyNumbers.map((s) => String(s).trim()).filter(Boolean).join(','),
      storyEditor: showStoryEditor ? '1' : '0',
      storyMatches: showMatches ? '1' : '0',
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
    atbashInput,
    kuzooInput,
    storyText,
    storyNumbers,
    showStoryEditor,
    showMatches,
    invalidatedMatches
  ])

  // Atbash conversion function
  const convertAtbash = (text) => {
    // Map final letters to regular letters first
    const finalToRegular = {
      'ך': 'כ',
      'ם': 'מ',
      'ן': 'נ',
      'ף': 'פ',
      'ץ': 'צ'
    }
    
    // Atbash mapping: א↔ת, ב↔ש, ג↔ר, ד↔ק, ה↔צ, ו↔פ, ז↔ע, ח↔ס, ט↔נ, י↔מ, כ↔ל
    const atbashMap = {
      'א': 'ת', 'ב': 'ש', 'ג': 'ר', 'ד': 'ק', 'ה': 'צ', 'ו': 'פ', 'ז': 'ע', 'ח': 'ס', 'ט': 'נ',
      'י': 'מ', 'כ': 'ל', 'ל': 'כ', 'מ': 'י', 'נ': 'ט', 'ס': 'ח', 'ע': 'ז', 'פ': 'ו', 'צ': 'ה',
      'ק': 'ד', 'ר': 'ג', 'ש': 'ב', 'ת': 'א'
    }
    
    return text.split('').map(char => {
      // Convert final letter to regular letter first
      const regularChar = finalToRegular[char] || char
      // Apply Atbash conversion
      return atbashMap[regularChar] || char
    }).join('')
  }

  const atbashOutput = useMemo(() => {
    return convertAtbash(atbashInput)
  }, [atbashInput])

  // Kuzu (shift-by-one) conversion function
  const convertKuzoo = (text) => {
    const hebrewAlphabet = [
      'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט',
      'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ',
      'ק', 'ר', 'ש', 'ת'
    ]
    const finalToRegular = {
      'ך': 'כ',
      'ם': 'מ',
      'ן': 'נ',
      'ף': 'פ',
      'ץ': 'צ'
    }

    return text.split('').map(char => {
      const regularChar = finalToRegular[char] || char
      const index = hebrewAlphabet.indexOf(regularChar)
      if (index === -1) return char
      const nextIndex = (index + 1) % hebrewAlphabet.length
      return hebrewAlphabet[nextIndex]
    }).join('')
  }

  const kuzooOutput = useMemo(() => {
    return convertKuzoo(kuzooInput)
  }, [kuzooInput])

  // Atbash correspondence table data
  const atbashTable = [
    { letter: 'א', atbash: 'ת' },
    { letter: 'ב', atbash: 'ש' },
    { letter: 'ג', atbash: 'ר' },
    { letter: 'ד', atbash: 'ק' },
    { letter: 'ה', atbash: 'צ' },
    { letter: 'ו', atbash: 'פ' },
    { letter: 'ז', atbash: 'ע' },
    { letter: 'ח', atbash: 'ס' },
    { letter: 'ט', atbash: 'נ' },
    { letter: 'י', atbash: 'מ' },
    { letter: 'כ', atbash: 'ל' },
    { letter: 'ל', atbash: 'כ' },
    { letter: 'מ', atbash: 'י' },
    { letter: 'נ', atbash: 'ט' },
    { letter: 'ס', atbash: 'ח' },
    { letter: 'ע', atbash: 'ז' },
    { letter: 'פ', atbash: 'ו' },
    { letter: 'צ', atbash: 'ה' },
    { letter: 'ק', atbash: 'ד' },
    { letter: 'ר', atbash: 'ג' },
    { letter: 'ש', atbash: 'ב' },
    { letter: 'ת', atbash: 'א' }
  ]

  // Kuzu (shift-by-one) correspondence table data
  const kuzooTable = [
    { letter: 'א', kuzu: 'ב' },
    { letter: 'ב', kuzu: 'ג' },
    { letter: 'ג', kuzu: 'ד' },
    { letter: 'ד', kuzu: 'ה' },
    { letter: 'ה', kuzu: 'ו' },
    { letter: 'ו', kuzu: 'ז' },
    { letter: 'ז', kuzu: 'ח' },
    { letter: 'ח', kuzu: 'ט' },
    { letter: 'ט', kuzu: 'י' },
    { letter: 'י', kuzu: 'כ' },
    { letter: 'כ', kuzu: 'ל' },
    { letter: 'ל', kuzu: 'מ' },
    { letter: 'מ', kuzu: 'נ' },
    { letter: 'נ', kuzu: 'ס' },
    { letter: 'ס', kuzu: 'ע' },
    { letter: 'ע', kuzu: 'פ' },
    { letter: 'פ', kuzu: 'צ' },
    { letter: 'צ', kuzu: 'ק' },
    { letter: 'ק', kuzu: 'ר' },
    { letter: 'ר', kuzu: 'ש' },
    { letter: 'ש', kuzu: 'ת' },
    { letter: 'ת', kuzu: 'א' }
  ]

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
  useLayoutEffect(() => {
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
  const storyLegend = useMemo(() => {
    const map = new Map()
    storyNumbers.forEach((raw) => {
      const value = parseInt(raw, 10)
      if (!Number.isNaN(value) && value > 0 && !map.has(value)) {
        map.set(value, storyColors[map.size % storyColors.length])
      }
    })
    return map
  }, [storyNumbers])

  // Tokenize the text, find every word / successive-word sequence whose gematria
  // matches one of the chosen numbers, and assign stacking lanes for overlaps.
  const storyAnalysis = useMemo(() => {
    const tokens = []
    if (storyText) {
      let lineNo = 0
      storyText.split(/(\s+)/).forEach((part) => {
        if (part === '') return
        const isSpace = /^\s+$/.test(part)
        // Displayed text strips only commas (periods, quotes, ... are kept); gematria
        // is unaffected since calculateGematria already ignores non-Hebrew characters.
        const display = isSpace ? part : part.replace(/,/g, '')
        tokens.push({ text: part, display, isSpace, gematria: isSpace ? 0 : calculateGematria(part), line: lineNo })
        if (isSpace) lineNo += (part.match(/\n/g) || []).length
        else if (part.includes('.')) lineNo += 1 // a period ends a sequence, like a line break
      })
    }

    // Positions (into tokens) of the actual words, their gematria values and lines
    const wordPositions = []
    tokens.forEach((tok, i) => { if (!tok.isSpace) wordPositions.push(i) })
    const wordValues = wordPositions.map((i) => tokens[i].gematria)
    const wordLines = wordPositions.map((i) => tokens[i].line)

    // Prefix sums so a span's total is computed in O(1)
    const prefix = [0]
    for (let k = 0; k < wordValues.length; k++) prefix.push(prefix[k] + wordValues[k])

    let maxTarget = 0
    storyLegend.forEach((_color, value) => { if (value > maxTarget) maxTarget = value })

    const invalidatedSet = new Set(invalidatedMatches)

    const matches = []
    if (storyLegend.size > 0) {
      for (let a = 0; a < wordValues.length; a++) {
        if (wordValues[a] === 0) continue // a span must start on a Hebrew word
        for (let b = a; b < wordValues.length; b++) {
          if (wordLines[b] !== wordLines[a]) break // a sequence cannot cross a line break
          const sum = prefix[b + 1] - prefix[a]
          if (sum > maxTarget) break // sums only grow as b grows
          if (wordValues[b] === 0) continue // and must end on a Hebrew word
          if (storyLegend.has(sum)) {
            // Content-based key so an invalidation survives token shifts on edit
            const spanWords = []
            for (let t = wordPositions[a]; t <= wordPositions[b]; t++) {
              if (!tokens[t].isSpace) spanWords.push(tokens[t].display)
            }
            const key = `${sum}|${spanWords.join(' ')}`
            matches.push({
              tokenStart: wordPositions[a],
              tokenEnd: wordPositions[b],
              value: sum,
              color: storyLegend.get(sum),
              wordCount: b - a + 1,
              phrase: spanWords.join(' '),
              key,
              invalid: invalidatedSet.has(key)
            })
          }
        }
      }
    }

    // The text only ever draws valid matches; invalidated ones live in the list below
    const rendered = matches.filter((m) => !m.invalid)

    // Assign each rendered match to a lane (greedy interval partitioning) so
    // overlapping matches get stacked underlines instead of colliding.
    const sorted = [...rendered].sort(
      (m1, m2) => m1.tokenStart - m2.tokenStart || m1.tokenEnd - m2.tokenEnd
    )
    const laneEnds = []
    sorted.forEach((m) => {
      let lane = 0
      while (lane < laneEnds.length && laneEnds[lane] >= m.tokenStart) lane++
      m.lane = lane
      laneEnds[lane] = m.tokenEnd
    })
    const laneCount = laneEnds.length

    // For each token, which matches cover it (used to draw the underlines)
    const tokenCover = tokens.map(() => [])
    sorted.forEach((m) => {
      for (let t = m.tokenStart; t <= m.tokenEnd; t++) tokenCover[t].push(m)
    })

    // Per-number match counts for the legend
    const counts = new Map()
    matches.forEach((m) => counts.set(m.value, (counts.get(m.value) || 0) + 1))

    // Deduped list of distinct matches (by phrase+value) for the curation panel,
    // in reading order, each carrying how many times it occurs in the text.
    const matchListMap = new Map()
    matches.forEach((m) => {
      const existing = matchListMap.get(m.key)
      if (existing) {
        existing.count += 1
      } else {
        matchListMap.set(m.key, {
          key: m.key,
          value: m.value,
          color: m.color,
          phrase: m.phrase,
          invalid: m.invalid,
          count: 1,
          firstStart: m.tokenStart
        })
      }
    })
    const matchList = Array.from(matchListMap.values()).sort((a, b) => a.firstStart - b.firstStart)

    // Find every word / successive-word sequence whose gematria equals `target`
    // (used to reveal all sequences sharing a selected word's value).
    const findSpans = (target) => {
      const spans = []
      if (!target || target <= 0) return spans
      for (let a = 0; a < wordValues.length; a++) {
        if (wordValues[a] === 0) continue
        const lineA = wordLines[a]
        for (let b = a; b < wordValues.length; b++) {
          if (wordLines[b] !== lineA) break
          const sum = prefix[b + 1] - prefix[a]
          if (sum > target) break
          if (wordValues[b] === 0) continue
          if (sum === target) spans.push({ tokenStart: wordPositions[a], tokenEnd: wordPositions[b] })
        }
      }
      return spans
    }

    return { tokens, tokenCover, laneCount, matchCount: matches.length, counts, matchList, findSpans }
  }, [storyText, storyLegend, invalidatedMatches])

  // Re-measure the layout on resize (matches-row alignment depends on wrapping)
  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Place each התאמות row roughly at the vertical position of its first
  // occurrence in the highlighted text (approximate; ignores independent scroll).
  useLayoutEffect(() => {
    const output = storyOutputRef.current
    if (!output || !showMatches) { setMatchTops([]); return }
    const outTop = output.getBoundingClientRect().top - output.scrollTop
    const ROW_H = 44
    let cursor = 0
    const tops = storyAnalysis.matchList.map((m) => {
      const el = output.querySelector(`[data-ti="${m.firstStart}"]`)
      const y = el ? el.getBoundingClientRect().top - outTop : cursor
      const target = Math.max(y, cursor)
      const margin = target - cursor
      cursor = target + ROW_H
      return margin
    })
    setMatchTops(tops)
  }, [storyText, storyAnalysis, showMatches, layoutTick])

  return (
    <>
      <Head>
        <title>ס.פ.ר</title>
        <meta name="description" content="ס.פ.ר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=David+Libre:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`container${activeTab === 'story' ? ' container-fill' : ''}`}>
        <h1 className="title">ס.פ.ר</h1>
        <div className="subtitle">
          <div>בשלשה ספרים</div>
          <div>בספר וספר וספור</div>
        </div>
        
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            גימטריא
          </button>
          <button
            className={`tab ${activeTab === 'atbash' ? 'active' : ''}`}
            onClick={() => setActiveTab('atbash')}
          >
            <span className="tab-label-nowrap">א״ת ב״ש</span>
          </button>
          <button
            className={`tab ${activeTab === 'kuzoo' ? 'active' : ''}`}
            onClick={() => setActiveTab('kuzoo')}
          >
            כוז״ו
          </button>
          <button
            className={`tab ${activeTab === 'numbers' ? 'active' : ''}`}
            onClick={() => setActiveTab('numbers')}
          >
            מספרים
          </button>
          <button
            className={`tab ${activeTab === 'letters' ? 'active' : ''}`}
            onClick={() => setActiveTab('letters')}
          >
            אותיות
          </button>
          <button
            className={`tab ${activeTab === 'number' ? 'active' : ''}`}
            onClick={() => setActiveTab('number')}
          >
            מספר
          </button>
          <button
            className={`tab ${activeTab === 'story' ? 'active' : ''}`}
            onClick={() => setActiveTab('story')}
          >
            ספור
          </button>
        </div>

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

        {activeTab === 'numbers' && (
          <div className="numbers-section">
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
        )}

        {activeTab === 'atbash' && (
          <div className="atbash-section">
            <div className="atbash-correspondence-table">
              <div className="atbash-table">
                {atbashTable.map((item, index) => (
                  <div key={index} className="atbash-table-row">
                    <div className="atbash-table-letter">{item.letter}</div>
                    <div className="atbash-table-arrow">↔</div>
                    <div className="atbash-table-letter">{item.atbash}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="atbash-input-control">
              <input
                ref={atbashInputRef}
                id="atbash-input"
                type="text"
                value={atbashInput}
                onChange={(e) => setAtbashInput(e.target.value)}
                className="atbash-input"
                dir="rtl"
              />
            </div>
            {atbashOutput && (
              <div className="atbash-result">
                <div className="atbash-result-value">{atbashOutput}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'kuzoo' && (
          <div className="atbash-section">
            <div className="atbash-correspondence-table">
              <div className="atbash-table">
                {kuzooTable.map((item, index) => (
                  <div key={index} className="atbash-table-row">
                    <div className="atbash-table-letter">{item.letter}</div>
                    <div className="atbash-table-arrow">←</div>
                    <div className="atbash-table-letter">{item.kuzu}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="atbash-input-control">
              <input
                ref={kuzooInputRef}
                id="kuzoo-input"
                type="text"
                value={kuzooInput}
                onChange={(e) => setKuzooInput(e.target.value)}
                className="atbash-input"
                dir="rtl"
              />
            </div>
            {kuzooOutput && (
              <div className="atbash-result">
                <div className="atbash-result-value">{kuzooOutput}</div>
              </div>
            )}
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
                style={{ lineHeight: storyAnalysis.laneCount > 0 ? 1.9 + storyAnalysis.laneCount * 0.5 : 1.9 }}
              >
                {storyAnalysis.tokens.map((tok, i) => {
                  const cov = storyAnalysis.tokenCover[i]
                  const inSeq = selectionInfo && selectionInfo.tokenSet && selectionInfo.tokenSet.has(i)
                  const tint = 'linear-gradient(rgba(150, 150, 150, 0.38), rgba(150, 150, 150, 0.38))'
                  if (!cov || cov.length === 0) {
                    return (
                      <span
                        key={i}
                        className={`story-token${inSeq ? ' story-token-seqmatch' : ''}`}
                        style={inSeq ? { background: tint } : undefined}
                      >
                        {tok.display}
                      </span>
                    )
                  }
                  const layers = cov.map(
                    (m) => `linear-gradient(${m.color}, ${m.color}) left 0 bottom ${m.lane * 5}px / 100% 3px no-repeat`
                  )
                  if (inSeq) layers.push(tint)
                  const bottomPad = storyAnalysis.laneCount * 5 + 3
                  return (
                    <span
                      key={i}
                      data-ti={i}
                      className={`story-token story-token-highlighted${inSeq ? ' story-token-seqmatch' : ''}`}
                      style={{ background: layers.join(', '), paddingBottom: `${bottomPad}px` }}
                    >
                      {tok.display}
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
                      <div className="story-matches-list">
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
                              style={{ accentColor: m.color }}
                            />
                            <span className="story-match-dot" style={{ background: m.color }} aria-hidden="true" />
                            <span className="story-match-value">{m.value}</span>
                            <span className="story-match-phrase">{m.phrase}</span>
                            {m.count > 1 && <span className="story-match-count">×{m.count}</span>}
                          </label>
                        ))}
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
                {selectionInfo.value}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}


