import Featured from "@/components/Featured";
import Footer from "@/components/Footer";
import Newsletter from "@/components/Newsletter";
import Link from "next/link";

export default function Home() {
  return (
    <div className="page">
      {/* ==================== MAIN CONTENT ==================== */}
      <main className="main" id="main-content">
        {/* ---------- Community marketplace header ---------- */}
        <header className="communityHero" aria-labelledby="hero-heading">
          <div className="communityHeroGrid">
            <div className="communityHeroContent">
              <p className="communityHeroEyebrow">
                <span aria-hidden="true">読</span>
                Community-powered manga marketplace
              </p>
              <h1 className="communityHeroHeading" id="hero-heading">
                <span className="communityHeroHeadingPrimary">
                  Sell the copies you own.{" "}
                </span>
                <span className="communityHeroHeadingSecondary">
                  Buy the exact manga you want.
                </span>
              </h1>
              <p className="communityHeroLede">
                Search by series, volume, edition, ISBN, and condition. Track
                missing volumes, inspect real-copy photos, and bundle listings
                from trusted collectors.
              </p>

              <div className="communityHeroActions">
                <Link className="heroButton heroButtonPrimary" href="/shop">
                  Shop manga
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link className="heroButton heroButtonSecondary" href="/sell">
                  Sell your manga
                </Link>
              </div>

              <ul
                className="communityHeroAssurances"
                aria-label="Marketplace features"
              >
                <li>Real-copy photos</li>
                <li>Edition details</li>
                <li>Singles &amp; sets</li>
              </ul>
            </div>

            <aside
              className="shelfFinder"
              aria-labelledby="shelf-finder-heading"
            >
              <div className="shelfFinderTopline">
                <span>Community find</span>
                <span className="shelfFinderStatus">Match spotted</span>
              </div>
              <h2 id="shelf-finder-heading">The missing-volume moment</h2>
              <p>
                Follow a series and let the community help fill the gap—down to
                volume, language, format, and printing.
              </p>

              <div
                className="volumeRun"
                aria-label="Volumes 1, 2, 4, and 5 owned; volume 3 wanted"
              >
                <span>01</span>
                <span>02</span>
                <span className="volumeRunWanted">03</span>
                <span>04</span>
                <span>05</span>
              </div>

              <dl className="shelfFinderDetails">
                <div>
                  <dt>Wanted</dt>
                  <dd>Volume 03</dd>
                </div>
                <div>
                  <dt>Edition</dt>
                  <dd>English paperback</dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>Good or better</dd>
                </div>
              </dl>
            </aside>
          </div>
          <div
            className="communityHeroPaths"
            aria-label="How the marketplace helps"
          >
            <Link href="/series">
              <span>01</span>
              <strong>Search the whole series</strong>
              <small>Title, volume, language, ISBN</small>
            </Link>
            <Link href="/sell">
              <span>02</span>
              <strong>Show the copy you own</strong>
              <small>Condition notes and seller photos</small>
            </Link>
            <Link href="/community">
              <span>03</span>
              <strong>Grow your collector circle</strong>
              <small>Share shelves, shops, and wish lists</small>
            </Link>
          </div>
        </header>
        {/* ---------- Newsletter CTA ---------- */}
        <Newsletter />
        {/* ---------- Featured marketplace items ---------- */}
        <Featured />
      </main>
      {/* ---------- Footer ---------- */}
      <Footer />
    </div>
  );
}
