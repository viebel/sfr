import { Head, Html, Main, NextScript } from 'next/document'

/*
 * The book face is loaded here rather than per page: the application menu sets
 * the three ספרים in it on every screen, and the nikud that tells them apart
 * needs it wherever the menu shows.
 */
export default function Document() {
  return (
    <Html lang="he" dir="rtl">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Frank+Ruhl+Libre:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* The mark of the app, the same tower the menu carries */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
