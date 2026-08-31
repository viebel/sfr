import { TANAKH_WORDS } from '../../data/tanakhWords'

// The concordance is read into a Set once, the first time the route is asked,
// and kept for the life of the process: the list itself never changes.
let tanakh = null

const tanakhSet = () => {
  if (!tanakh) tanakh = new Set(TANAKH_WORDS.split(/\s+/).filter(Boolean))
  return tanakh
}

// Asked for a batch of words, answers with the ones that are words of the
// תנ״ך. The screen sends the תמורות of a word — most of them are nothing at
// all, and the few that come back are the ones worth showing as such.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const words = Array.isArray(req.body?.words) ? req.body.words : []
  const found = tanakhSet()
  res.status(200).json({
    words: Array.from(new Set(words.filter((word) => typeof word === 'string' && found.has(word))))
  })
}
