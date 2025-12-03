import Head from 'next/head'
import { useState, useMemo } from 'react'
import { calculateGematria } from '../utils/gematria'
import { generateHebrewNumbers, getHebrewNumberName } from '../utils/hebrewNumbers'

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
  const gematria = calculateGematria(input)

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

  return (
    <>
      <Head>
        <title>ס.פ.ר</title>
        <meta name="description" content="ס.פ.ר" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="container">
        <h1 className="title">ס.פ.ר</h1>
        
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            מחשבון גימטריה
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
        </div>

        {activeTab === 'calculator' && (
          <div className="calculator">
            <input
              type="text"
              className="text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="הכנס מילה..."
              dir="rtl"
            />
            {input && (
              <div className="result">
                <div className="result-label">גימטריה:</div>
                <div className="result-value">{gematria}</div>
              </div>
            )}
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
              <label htmlFor="number-input">הכנס מספר:</label>
              <input
                id="number-input"
                type="number"
                value={numberInput}
                onChange={(e) => {
                  const val = e.target.value
                  setNumberInput(val)
                }}
                className="number-input"
                dir="ltr"
                placeholder="מספר..."
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
      </main>
    </>
  )
}

