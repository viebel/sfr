import Link from 'next/link'
import TowerMark from './TowerMark'

/*
 * The application menu, in two rows: the three ספרים of the verse the app is
 * named after, and below them the screens of whichever one is open.
 *
 * The three are the same three letters read three ways — סֵפֶר the books, סְפָר
 * the numbers, סִפֻּר the letters — so only the nikud tells them apart, and the
 * menu sets them in David Libre where it shows.
 *
 * A screen is either a route of its own (`href`) or a panel of the home page,
 * which owns it as an in-page tab (`tab`) and mirrors it in ?tab=.
 */
export const SFARIM = [
  {
    id: 'sefer',
    label: 'סֵפֶר',
    screens: [
      { id: 'library', label: 'ספריה', href: '/library' },
      { id: 'story', label: 'כתיבה', tab: 'story' }
    ]
  },
  {
    id: 'sfar',
    label: 'סְפָר',
    screens: [
      { id: 'number', label: 'מספר', tab: 'number' }
    ]
  },
  {
    id: 'sipur',
    label: 'סִפֻּר',
    screens: [
      { id: 'calculator', label: 'גימטריא', tab: 'calculator' },
      { id: 'temurot', label: 'תמורות', tab: 'temurot' },
      { id: 'letters', label: 'אותיות', tab: 'letters' }
    ]
  }
]

// Every screen of the app, and the ספר it belongs to, by screen id. מקורות is
// not one of them: it is a shelf of the ספריה, and reading one leaves ספריה the
// screen you are on.
export const SCREENS = new Map(
  SFARIM.flatMap(sefer => sefer.screens.map(screen => [screen.id, { ...screen, sefer }]))
)

const hrefOf = screen => screen.href || `/?tab=${screen.tab}`

/*
 * `current` is the id of the screen being displayed, or 'home' for the page
 * that only names the three. The home page owns most screens as panels, so it
 * passes `onSelectTab` as well and gets buttons that switch panel in place;
 * every other page gets links.
 */
export default function AppNav({ current, onSelectTab }) {
  const openSefer = SCREENS.get(current)?.sefer

  // A screen the home page owns is a button only while the home page is the one
  // showing the menu; from a route it is a link back into the home page.
  const screenEntry = screen =>
    screen.tab && onSelectTab ? (
      <button
        key={screen.id}
        type="button"
        className={`subtab${current === screen.id ? ' active' : ''}`}
        onClick={() => onSelectTab(screen.tab)}
        aria-current={current === screen.id ? 'page' : undefined}
      >
        {screen.label}
      </button>
    ) : (
      <Link
        key={screen.id}
        href={hrefOf(screen)}
        className={`subtab${current === screen.id ? ' active' : ''}`}
        aria-current={current === screen.id ? 'page' : undefined}
      >
        {screen.label}
      </Link>
    )

  // Choosing a ספר opens the first of its screens.
  const seferEntry = sefer => {
    const first = sefer.screens[0]
    const active = sefer.id === openSefer?.id
    const className = `tab tab-sefer${active ? ' active' : ''}`
    return first.tab && onSelectTab ? (
      <button
        key={sefer.id}
        type="button"
        className={className}
        onClick={() => onSelectTab(first.tab)}
        aria-current={active ? 'page' : undefined}
      >
        {sefer.label}
      </button>
    ) : (
      <Link
        key={sefer.id}
        href={hrefOf(first)}
        className={className}
        aria-current={active ? 'page' : undefined}
      >
        {sefer.label}
      </Link>
    )
  }

  // The app's own mark leads back to the page that holds nothing but its name.
  const homeMark = onSelectTab ? (
    <button
      type="button"
      className={`appnav-mark${current === 'home' ? ' active' : ''}`}
      onClick={() => onSelectTab('home')}
      title="ס.פ.ר"
      aria-label="ס.פ.ר"
    >
      <TowerMark />
    </button>
  ) : (
    <Link href="/" className="appnav-mark" title="ס.פ.ר" aria-label="ס.פ.ר">
      <TowerMark />
    </Link>
  )

  return (
    <div className="appnav">
      <div className="appnav-row appnav-sfarim">
        {homeMark}
        <div className="tabs tabs-compact">{SFARIM.map(seferEntry)}</div>
      </div>
      {openSefer && (
        <div className="appnav-row appnav-screens">
          <div className="subtabs">{openSefer.screens.map(screenEntry)}</div>
        </div>
      )}
    </div>
  )
}
