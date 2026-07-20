"use client";

import Link from "next/link";

// Real, always-crawlable footer — plain <Link> elements (not the nav
// drawer's JS-intercepted <a onClick={preventDefault}> pattern), so
// search engines have a stable, prominent, site-wide signal pointing at
// every support/static page. This sits alongside the nav drawer, not
// instead of it — the drawer stays the primary mobile navigation UI,
// this is what search engines actually crawl.
const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Sellers", href: "/sellers" },
      { label: "Leaderboard", href: "/leaderboard" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact Us", href: "/contact" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { label: "Escrow & Payments", href: "/escrow" },
      { label: "Buyer Protection", href: "/buyer-protection" },
      { label: "Terms & Privacy", href: "/terms" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="srf-footer">
      <div className="srf-footer-top" />

      <div className="srf-footer-inner">
        <div className="srf-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.phototourl.com/member/2026-07-19-ffcaa670-d57c-44f6-8415-ab73856860b2.png"
            alt="Siterifty.com"
            className="srf-footer-logo"
          />
          <p className="srf-footer-tagline">
            A marketplace built for independent developers — list, sell, and get paid, every deal
            backed by escrow.
          </p>
        </div>

        <nav className="srf-footer-cols" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div className="srf-footer-col" key={col.heading}>
              <div className="srf-footer-col-heading">{col.heading}</div>
              <ul className="srf-footer-col-list">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="srf-footer-bottom">
        <span>© {year} Siterifty.com</span>
        <span className="srf-footer-bottom-dot" aria-hidden="true" />
        <span>All deals escrow-protected</span>
      </div>
    </footer>
  );
}
