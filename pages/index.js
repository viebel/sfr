import Head from 'next/head'
import { useState, useMemo } from 'react'
import { calculateGematria } from '../utils/gematria'
import { generateHebrewNumbers } from '../utils/hebrewNumbers'

export default function Home() {
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('calculator')
  const [minNumber, setMinNumber] = useState(1)
  const [maxNumber, setMaxNumber] = useState(10)
  const [calculatedMin, setCalculatedMin] = useState(1)
  const [calculatedMax, setCalculatedMax] = useState(10)
  const [showFixedPoints, setShowFixedPoints] = useState(false)
  const gematria = calculateGematria(input)

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
      </main>
    </>
  )
}

