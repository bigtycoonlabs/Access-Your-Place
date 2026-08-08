/**
 * Access Your Place — design tokens.
 *
 * WHY THIS FILE EXISTS
 *
 * `#d4a574` appears 1,865 times across the front end as a raw hex value, and `#1a365d`
 * 588 times. That is the reason the dashboards feel scattered: there is no single
 * definition of the brand, so every screen is a slightly different opinion of it, and
 * changing anything means finding two thousand strings.
 *
 * These are the definitions. New work uses them. Existing hex is migrated as screens are
 * touched, not in one sweep — a two-thousand-instance find-and-replace across live staff
 * tooling is exactly the kind of change that breaks something nobody notices for a week.
 *
 * THE SISTER RELATIONSHIP
 *
 * Access Your Place, YP Flow and YP Labs are siblings and should read as siblings: the
 * same structural language — dark navy ground, one warm accent, generous space, plain
 * type — so somebody who has used one recognises the family in another.
 *
 * What makes each its own:
 *   Access Your Place  warm gold on deep navy. Property, keys, a signed lease. It should
 *                      feel like a place, because that is literally the product.
 *   YP Flow            movement and measurement. It reports on money in motion.
 *   YP Labs            an idea taking shape. Lighter, more open.
 *
 * Shared bones, different temperature. Not three coats of the same paint, and not three
 * unrelated products wearing one logo.
 */

export const ayp = {
  /** Deep navy. The ground everything sits on. */
  ink: {
    900: '#0a0f1a',   // deepest — page background
    800: '#1a2332',   // panels, raised surfaces
    700: '#1a365d',   // primary brand navy
    600: '#1e3a5f',
    500: '#2d4a7c',
    400: '#2d5a87',
  },

  /** Warm gold. Used for ONE thing per screen: the action that matters. */
  gold: {
    500: '#d4a574',   // the accent
    600: '#c49464',   // hover / pressed
  },

  /**
   * Status. Deliberately few.
   *
   * Colour is never the only carrier of meaning here — both owners use screen readers, so
   * every state that has a colour also has words. These exist to reinforce a label, never
   * to replace it.
   */
  state: {
    good: '#16a34a',
    warn: '#f59e0b',
    bad: '#dc2626',
    quiet: '#64748b',
  },
} as const;

/**
 * Layout constants.
 *
 * `touch` is 44px because that is the minimum comfortable target, and it is not a
 * suggestion on this platform — the people who run it operate by touch and by voice.
 */
export const layout = {
  touch: '44px',
  maxContent: '1200px',
  radius: '0.5rem',
} as const;

/**
 * How a dashboard should be built here.
 *
 * The current screens grew by accretion: every feature added a card, and nothing was ever
 * removed, so a staff member opens a wall and has to find the one thing that matters. The
 * fix is not prettier cards. It is fewer of them.
 *
 * 1. ONE ANSWER FIRST. Every dashboard opens with the single most important thing right
 *    now, in a sentence. Not a grid of twelve numbers. If nothing is wrong, say that.
 * 2. COUNTS, NOT LISTS. Show how many. Let the person ask for detail, and let Penny give
 *    it — she can reason about a list; a table cannot.
 * 3. AT MOST THREE ACTIONS visible at once. A screen with fifteen buttons has none.
 * 4. NOTHING PURELY DECORATIVE. If a panel does not change a decision, it is noise, and
 *    on a screen reader it is noise you have to listen through.
 * 5. SPEAKABLE ORDER. The DOM order is the order a person hears. Most important first,
 *    every time, regardless of where it sits visually.
 */
export const dashboardPrinciples = [
  'One answer first, in a sentence',
  'Counts, not lists — Penny gives the detail',
  'At most three visible actions',
  'Nothing purely decorative',
  'Speakable order: most important first in the DOM',
] as const;
