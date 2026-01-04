import Document, { Head, Html, Main, NextScript } from 'next/document'

import DocumentHeadContent from '@/lib/components/layout/DocumentHeadContent'

class RootDocument extends Document {
  render() {
    return (
      <Html lang={'en'}>
        <Head>
          <DocumentHeadContent />
          {/* Privacy-friendly analytics by Plausible (Self-hosted): */}
          <script defer data-domain="classic.pokepc.net" src="https://ua.werkowl.com/js/script.js" />
          <script async src="https://ua.werkowl.com/js/pa-pvoAW5Zy3y8QShCA83d-u.js"></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init();
`.trim(),
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default RootDocument
