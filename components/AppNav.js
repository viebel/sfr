import Link from 'next/link'

/*
 * The application menu. The first entries are panels of the home page, which
 * owns them as in-page tabs and mirrors the current one in ?tab= — from any
 * other route they are plain links back into it. ספר and מקורות are routes of
 * their own. Kept in one place so every page shows the same menu.
 */
export const APP_TABS = [
  { id: 'calculator', label: 'גימטריא' },
  { id: 'atbash', label: 'א״ת ב״ש', nowrap: true },
  { id: 'kuzoo', label: 'כוז״ו' },
  { id: 'numbers', label: 'מספרים' },
  { id: 'letters', label: 'אותיות' },
  { id: 'number', label: 'מספר' },
  { id: 'story', label: 'ספור' }
]

export const APP_ROUTES = [
  { href: '/library', id: 'library', label: 'ספר' },
  { href: '/mekorot', id: 'mekorot', label: 'מקורות' }
]

// `current` is the id of the route being displayed ('library', 'mekorot'), or
// nothing on the home page, which renders its own buttons instead of links.
export default function AppNav({ current, compact = false }) {
  return (
    <div className={`tabs${compact ? ' tabs-compact' : ''}`}>
      {APP_TABS.map(tab => (
        <Link key={tab.id} href={`/?tab=${tab.id}`} className="tab tab-link">
          {tab.nowrap ? <span className="tab-label-nowrap">{tab.label}</span> : tab.label}
        </Link>
      ))}
      {APP_ROUTES.map(route => (
        <Link
          key={route.id}
          href={route.href}
          className={`tab tab-link${current === route.id ? ' active' : ''}`}
          aria-current={current === route.id ? 'page' : undefined}
        >
          {route.label}
        </Link>
      ))}
    </div>
  )
}
