import { calculateGematria } from './gematria'

// Base Hebrew number names
const baseNumbers = {
  1: { masculine: 'אחד', feminine: 'אחת' },
  2: { masculine: 'שנים', feminine: 'שתים' },
  3: { masculine: 'שלשה', feminine: 'שלש' },
  4: { masculine: 'ארבעה', feminine: 'ארבע' },
  5: { masculine: 'חמשה', feminine: 'חמש' },
  6: { masculine: 'ששה', feminine: 'שש' },
  7: { masculine: 'שבעה', feminine: 'שבע' },
  8: { masculine: 'שמונה', feminine: 'שמונה' },
  9: { masculine: 'תשעה', feminine: 'תשע' },
  10: { masculine: 'עשרה', feminine: 'עשר' },
  11: { masculine: 'אחד עשר', feminine: 'אחת עשרה' },
  12: { masculine: 'שנים עשר', feminine: 'שתים עשרה' },
  13: { masculine: 'שלשה עשר', feminine: 'שלש עשרה' },
  14: { masculine: 'ארבעה עשר', feminine: 'ארבע עשרה' },
  15: { masculine: 'חמשה עשר', feminine: 'חמש עשרה' },
  16: { masculine: 'ששה עשר', feminine: 'שש עשרה' },
  17: { masculine: 'שבעה עשר', feminine: 'שבע עשרה' },
  18: { masculine: 'שמונה עשר', feminine: 'שמונה עשרה' },
  19: { masculine: 'תשעה עשר', feminine: 'תשע עשרה' },
  20: { masculine: 'עשרים', feminine: 'עשרים' },
  30: { masculine: 'שלשים', feminine: 'שלשים' },
  40: { masculine: 'ארבעים', feminine: 'ארבעים' },
  50: { masculine: 'חמשים', feminine: 'חמשים' },
  60: { masculine: 'ששים', feminine: 'ששים' },
  70: { masculine: 'שבעים', feminine: 'שבעים' },
  80: { masculine: 'שמונים', feminine: 'שמונים' },
  90: { masculine: 'תשעים', feminine: 'תשעים' },
  100: { masculine: 'מאה', feminine: 'מאה' }
}

export function getHebrewNumberName(num, gender = 'masculine') {
  if (baseNumbers[num]) {
    return baseNumbers[num][gender]
  }

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000)
    const remainder = num % 1000
    let result = ''
    
    if (thousands === 1) {
      result = 'אלף'
    } else if (thousands === 2) {
      result = 'אלפיים'
    } else {
      result = getHebrewNumberName(thousands, gender) + ' אלפים'
    }
    
    if (remainder > 0) {
      result += ' ו' + getHebrewNumberName(remainder, gender)
    }
    
    return result
  }

  if (num > 100) {
    const hundreds = Math.floor(num / 100)
    const remainder = num % 100
    let result = ''
    
    if (hundreds === 1) {
      result = 'מאה'
    } else if (hundreds === 2) {
      result = 'מאתיים'
    } else {
      // Always use feminine form for the number before מאות
      result = getHebrewNumberName(hundreds, 'feminine') + ' מאות'
    }
    
    if (remainder > 0) {
      result += ' ו' + getHebrewNumberName(remainder, gender)
    }
    
    return result
  }

  if (num > 20 && num < 100) {
    const tens = Math.floor(num / 10) * 10
    const ones = num % 10
    
    if (ones === 0) {
      return baseNumbers[tens][gender]
    }
    
    return baseNumbers[tens][gender] + ' ו' + baseNumbers[ones][gender]
  }

  return num.toString()
}

export function generateHebrewNumbers(min, max) {
  const numbers = []
  for (let i = min; i <= max; i++) {
    const masculine = getHebrewNumberName(i, 'masculine')
    const feminine = getHebrewNumberName(i, 'feminine')
    numbers.push({
      number: i,
      masculine,
      feminine,
      masculineGematria: calculateGematria(masculine),
      feminineGematria: calculateGematria(feminine)
    })
  }
  return numbers
}

