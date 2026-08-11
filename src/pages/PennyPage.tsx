/**
 * /penny-ai used to render the PennyAI component on its own. PennyAI is a floating
 * chat bubble, not a page, so the entire route was a single emoji on a blank white
 * screen: no header, no h1, no navigation, no explanation, and nothing at all for a
 * screen reader to announce beyond "button, speech balloon".
 *
 * This gives the route an actual page. The bubble still does the talking; this tells
 * a person what Penny is, what she can and cannot do today, and how to reach her.
 */
import Header from '@/components/Header';
import SEO from '@/components/SEO';
import PennyAI from '@/components/PennyAI';
import { Link } from 'react-router-dom';

export default function PennyPage() {
  return (
    <>
      <SEO
        title="Penny, the Access Your Place deal assistant"
        description="Penny answers questions about rental arbitrage deals on Access Your Place: what a listing earns, how the acquisition fee is repaid, and how each deal is scored."
      />
      <Header />
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold text-[#1a365d]">Penny</h1>
        <p className="mt-3 text-lg text-gray-700">
          Penny is the assistant built into Access Your Place. Ask her about any deal on
          the marketplace and she will answer from the figures recorded against it.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-[#1a365d]">What she can do today</h2>
        <ul className="mt-3 space-y-2 text-gray-700">
          <li>Explain what a listed deal earns in the peak and the slow season.</li>
          <li>Explain the deal score, and the arithmetic behind it.</li>
          <li>Tell you how long the acquisition fee takes to repay.</li>
          <li>Point you to the deals that match what you are looking for.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-[#1a365d]">What she will not do</h2>
        <p className="mt-3 text-gray-700">
          Penny will not read out a payment destination, and she will not invent a figure
          that is not recorded against a deal. If something has not been worked out yet
          she says so rather than guessing. Property search is not connected yet, so she
          cannot go and find new properties for you.
        </p>

        <p className="mt-10 text-gray-700">
          Open the chat with the button in the bottom corner of the screen, or{' '}
          <Link to="/deals" className="font-semibold text-[#1a365d] underline">
            browse the available deals
          </Link>{' '}
          and ask her about one.
        </p>
      </main>
      <PennyAI />
    </>
  );
}
