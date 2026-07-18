import type { Metadata } from "next";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import StaticPage, { StaticSection } from "@/components/layout/StaticPage";

// Reuses the page's own eyebrow/title/intro verbatim as SEO copy.
const TITLE = "Escrow & Payments — How your money is protected | Siterifty";
const DESCRIPTION =
  "Every deal on Siterifty is funded through escrow — here's exactly what that means and where your money sits at each stage.";

export function generateMetadata(): Metadata {
  const url = `${getPublicBaseUrl()}/escrow`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESCRIPTION, url, type: "website" },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default function EscrowPage() {
  return (
    <StaticPage
      eyebrow="Escrow & Payments"
      title="How your money is protected"
      intro="Every deal on Siterifty is funded through escrow — here's exactly what that means and where your money sits at each stage."
    >
      <StaticSection heading="What escrow means here">
        <p>
          When a buyer pays for a deal, the money moves into escrow — held by Siterifty, not the
          seller. It only reaches the seller&apos;s wallet once the buyer confirms delivery, or
          once the 72-hour verification window passes without a dispute. At no point can a seller
          pull funds out of an unconfirmed deal.
        </p>
      </StaticSection>

      <StaticSection heading="The wallet">
        <p>
          All payments on Siterifty run through your wallet, not directly card-to-card or
          account-to-account. You top up your wallet (via card or PayPal, from Settings → Payment
          Methods), and that balance is what funds deals and receives payouts. This keeps every
          transaction inside one consistent, logged system instead of scattering payment methods
          across individual deals.
        </p>
      </StaticSection>

      <StaticSection heading="Platform fees">
        <p>
          Siterifty takes a percentage of the sale price when a deal completes — never charged
          up front. The rate depends on the seller&apos;s plan at the time of sale:
        </p>
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--mp-border)" }}>
              <th style={{ textAlign: "left", padding: "8px 4px", color: "var(--mp-text)" }}>Plan</th>
              <th style={{ textAlign: "left", padding: "8px 4px", color: "var(--mp-text)" }}>Platform fee</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Free", "30%"],
              ["Starter", "20%"],
              ["Growth", "10%"],
              ["Pro", "5%"],
            ].map(([plan, fee]) => (
              <tr key={plan} style={{ borderBottom: "1px solid var(--mp-border)" }}>
                <td style={{ padding: "8px 4px" }}>{plan}</td>
                <td style={{ padding: "8px 4px", color: "var(--mp-accent)", fontWeight: 700 }}>{fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </StaticSection>

      <StaticSection heading="Delivery & downloads">
        <p>
          Sellers deliver files, credentials, or transfer details directly inside the deal chat.
          Any files attached to a deal are only accessible to the buyer and seller on that
          specific deal — download links are short-lived and re-generated on request, not
          permanent public URLs.
        </p>
      </StaticSection>

      <StaticSection heading="If it goes wrong">
        <p>
          Either party can raise a dispute before funds release, which freezes the escrow
          immediately — no further action happens on that deal until our team reviews it, which
          we do within 24–48 hours.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
