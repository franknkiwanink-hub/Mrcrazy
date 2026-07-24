import type { Metadata } from "next";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import { staticOgImage, SUPPORT_OG_IMAGE } from "@/lib/og/staticOgImage";
import StaticPage, { StaticSection } from "@/components/layout/StaticPage";

// Reuses the page's own eyebrow/title/intro verbatim as SEO copy.
const TITLE = "Terms & Privacy — Terms of Service & Privacy Policy | Siterifty";
const DESCRIPTION =
  "Last updated: these terms describe how buying, selling, and payments actually work on Siterifty.";

export function generateMetadata(): Metadata {
  const url = `${getPublicBaseUrl()}/terms`;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url,
      type: "website",
      images: staticOgImage(SUPPORT_OG_IMAGE, "Siterifty Support").openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: staticOgImage(SUPPORT_OG_IMAGE, "Siterifty Support").twitterImages,
    },
  };
}

export default function TermsPage() {
  return (
    <StaticPage
      eyebrow="Terms & Privacy"
      title="Terms of Service & Privacy Policy"
      intro="Last updated: these terms describe how buying, selling, and payments actually work on Siterifty."
    >
      <StaticSection heading="1. What Siterifty is">
        <p>
          Siterifty is a marketplace connecting buyers and sellers of websites, apps, games, and
          templates. Siterifty facilitates the transaction — including escrow — but is not a
          party to the underlying sale of the listed product itself.
        </p>
      </StaticSection>

      <StaticSection heading="2. Accounts">
        <p>
          You&apos;re responsible for the activity on your account and for keeping your login
          credentials secure. One person or business per account — accounts found to be shared or
          created to evade a restriction may be suspended.
        </p>
      </StaticSection>

      <StaticSection heading="3. Listings">
        <p>
          Sellers are responsible for the accuracy of what they list — description, financials,
          and what&apos;s actually included in the sale. Listing something you don&apos;t have the
          right to sell (stolen code, unlicensed assets, someone else&apos;s product) is grounds
          for removal and account suspension. Weekly listing limits apply based on your plan.
        </p>
      </StaticSection>

      <StaticSection heading="4. Payments, wallet & fees">
        <p>
          All payments flow through your Siterifty wallet. When a deal completes, Siterifty
          deducts a platform fee from the sale price before crediting the seller&apos;s wallet.
          The fee rate depends on the seller&apos;s plan at the time of sale (currently 20% on
          Free, 15% on Starter, 10% on Growth, 5% on Pro) and is disclosed before a deal is
          accepted.
        </p>
      </StaticSection>

      <StaticSection heading="5. Escrow & disputes">
        <p>
          Funds a buyer pays into a deal are held in escrow until the buyer confirms delivery or
          the verification window (72 hours after the seller marks a deal delivered) passes
          without a dispute. Either party may raise a dispute before funds release, which freezes
          the escrow pending review by Siterifty&apos;s team. Siterifty&apos;s decision on a
          dispute is final for the purposes of releasing escrowed funds.
        </p>
      </StaticSection>

      <StaticSection heading="6. Prohibited conduct">
        <p>
          Circumventing escrow (arranging payment outside the platform to avoid fees), harassment,
          fraud, and attempts to manipulate reviews, ratings, or the seller badge system are all
          grounds for suspension.
        </p>
      </StaticSection>

      <StaticSection heading="7. What data we collect">
        <p>
          Account data (email, username, avatar), listing and deal content, wallet transaction
          history, and basic usage data needed to operate the marketplace (session/device info for
          security, push notification subscriptions if you opt in). We don&apos;t sell your data
          to third parties. See our full{" "}
          <a href="/privacy" style={{ color: "var(--mp-accent)", fontWeight: 700 }}>
            Privacy Policy
          </a>{" "}
          for details on data retention, your rights, and how to request access or deletion.
        </p>
      </StaticSection>

      <StaticSection heading="8. Limitation of liability">
        <p>
          Siterifty facilitates transactions in good faith but doesn&apos;t guarantee the quality,
          legality, or performance of any listed product. Our liability for any claim is limited
          to the fees Siterifty actually collected on the deal in question.
        </p>
      </StaticSection>

      <StaticSection heading="9. Changes to these terms">
        <p>
          We may update these terms as the platform evolves. Material changes will be reflected
          here with an updated date; continued use of Siterifty after a change means you accept
          the updated terms.
        </p>
      </StaticSection>

      <StaticSection heading="10. Contact">
        <p>
          Questions about these terms? Reach out at{" "}
          <strong style={{ color: "var(--mp-text)" }}>support@siterifty.com</strong>.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
