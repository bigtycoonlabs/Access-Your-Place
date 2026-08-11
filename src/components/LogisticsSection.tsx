/**
 * The homepage sold the marketplace and said nothing about the thing competitors cannot
 * match: the logistics. A person could read the whole page and never learn that Access
 * Your Place launches properties, runs its own freight, and will do it for a property
 * the visitor already owns.
 *
 * This sits between the deals and the mission so a visitor sees both halves of the
 * business: operations you can buy, and the team that launches them.
 */
import { Link } from 'react-router-dom';

const STEPS: Array<[string, string]> = [
  ['Sourced', 'Wholesale furniture suppliers, not retail.'],
  ['Consolidated', 'Everything lands at our Texas warehouse and is checked against the order.'],
  ['Transported', 'Our own truck runs it to the launch site. No third-party freight window.'],
  ['Installed', 'A YP Pro builds, installs and styles. Junk removal and technology install included.'],
  ['Overseen', 'A setup manager runs the project remotely and keeps inventory and compliance current.'],
  ['Guest ready', 'Walkthrough, photos, and a property somebody can check into.'],
];

export function LogisticsSection() {
  return (
    <section
      aria-labelledby="logistics-heading"
      className="bg-[#1a2332] py-20 text-white"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#d4a574]">
          Setup and logistics
        </p>
        <h2 id="logistics-heading" className="mb-5 text-3xl font-bold leading-tight md:text-4xl">
          Fourteen days from sourcing to a guest checking in.
        </h2>
        <p className="mb-4 max-w-3xl text-lg leading-relaxed text-gray-300">
          We do not just find operations. We launch them. One apartment or every unit in a
          building, across the United States and into Mexico, whether you found the property
          yourself or acquired it through us.
        </p>
        <p className="mb-10 max-w-3xl text-lg leading-relaxed text-gray-400">
          Furniture goes to our secured warehouse in Texas, not to your empty property. We move
          it ourselves. A YP Pro receives and installs it on the ground while a setup manager
          runs the project remotely and holds the chain of custody on every large purchase.
          That is why fourteen days is possible.
        </p>

        <ol className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([step, detail], i) => (
            <li key={step} className="flex gap-3 rounded-lg bg-white/5 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d4a574] text-sm font-bold text-[#1a2332]">
                {i + 1}
              </span>
              <span>
                <strong className="block text-white">{step}</strong>
                <span className="text-sm leading-relaxed text-gray-300">{detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mb-8 max-w-3xl text-lg leading-relaxed text-gray-300">
          We also plan and execute teardowns and portfolio moves, so furniture and equipment
          move between properties instead of being bought twice.
        </p>

        <Link
          to="/setup-services"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#d4a574] px-8 py-4 text-lg font-bold text-[#1a2332] transition-colors hover:bg-[#c49564]"
        >
          See how a launch runs
        </Link>
      </div>
    </section>
  );
}

export default LogisticsSection;
