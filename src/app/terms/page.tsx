import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/ui/legal/legal-page";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Terms of Service | Refactor Coach",
  description:
    "The terms governing use of the Refactor coaching platform at myrefactor.com.",
};

const LAST_UPDATED = "August 11, 2026";

export default function TermsOfServicePage() {
  const { entity, contactEmail, governingState } = siteConfig.legal;

  return (
    <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your use of the
        Refactor coaching platform at myrefactor.com (the
        &ldquo;Platform&rdquo;), operated by {entity} (&ldquo;Refactor,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By accessing or using the Platform,
        you agree to these Terms. If you do not agree, do not use the Platform.
      </p>

      <h2>1. Who may use the Platform</h2>
      <p>
        You must be at least 18 years old to use the Platform. Accounts are
        created by invitation from an organization administrator or a coach;
        there is no public self-signup. You may use the Platform only as
        permitted by these Terms and by applicable law.
      </p>

      <h2>2. Accounts and organizations</h2>
      <p>
        You are responsible for keeping your credentials confidential and for all
        activity that occurs under your account. Notify us promptly at{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> if you believe your
        account has been compromised.
      </p>
      <p>
        If you access the Platform through an organization, that organization
        administers your account. It can create and remove coaching
        relationships, add and remove members, and access coaching content
        belonging to relationships it owns. A separate agreement between Refactor
        and that organization may govern fees, service levels, and data handling;
        where that agreement conflicts with these Terms, it controls for that
        organization&rsquo;s users.
      </p>

      <h2>3. Coaching content and confidentiality</h2>
      <p>
        You retain ownership of the content you contribute to the Platform,
        including session notes, agreements, actions, and goals. You grant
        Refactor a limited, non-exclusive license to host, store, transmit, and
        display that content solely to operate and provide the Platform to you
        and to the other participants in your coaching relationship.
      </p>
      <p>
        Coaching content is shared by design. Content in a coaching relationship
        is visible to both the coach and the client in that relationship, and to
        administrators of the organization that owns it. Do not enter information
        into the Platform that you are not willing to share with those parties.
      </p>
      <p>
        Refactor does not sell your coaching content and does not use it for
        advertising. Our handling of personal information is described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Access accounts, organizations, or coaching relationships you have not
          been granted access to.
        </li>
        <li>
          Probe, scan, or test the vulnerability of the Platform, or circumvent
          any authentication or rate-limiting measure.
        </li>
        <li>
          Upload malicious code, or content that is unlawful, harassing, or
          infringes another party&rsquo;s rights.
        </li>
        <li>
          Scrape, resell, or redistribute the Platform or its content, or use it
          to build a competing service.
        </li>
        <li>
          Interfere with the operation of the Platform or the use of it by
          others.
        </li>
      </ul>

      <h2>5. Third-party integrations</h2>
      <p>
        The Platform offers optional integrations with third-party services,
        including Google Meet. Connecting an integration is your choice. Your use
        of a third-party service is governed by that provider&rsquo;s own terms
        and privacy policy, and we are not responsible for its availability,
        behavior, or content. You can disconnect an integration at any time under
        Settings &rarr; Integrations.
      </p>

      <h2>6. Not professional advice</h2>
      <p>
        The Platform is software that supports a professional coaching
        relationship. It does not provide coaching, and Refactor does not provide
        medical, psychological, legal, financial, or other licensed professional
        advice through it. Coaching is not a substitute for therapy or medical
        care. Decisions you make based on coaching conversations or content
        stored in the Platform are your own.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We may modify, suspend, or discontinue any part of the Platform at any
        time. We aim to give reasonable notice of material changes that affect
        you, but we do not guarantee uninterrupted or error-free operation.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the Platform at any time and ask us to close your
        account. We may suspend or terminate your access if you violate these
        Terms, if your organization&rsquo;s agreement with us ends, or if we are
        required to do so by law. Sections that by their nature should survive
        termination &mdash; ownership, disclaimers, limitation of liability,
        indemnification, and governing law &mdash; survive.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Platform is provided &ldquo;as is&rdquo; and &ldquo;as
        available,&rdquo; without warranties of any kind, whether express,
        implied, or statutory, including any implied warranties of
        merchantability, fitness for a particular purpose, title, and
        non-infringement. We do not warrant that the Platform will meet your
        requirements, be uninterrupted, or be free of errors or data loss.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Refactor will not be liable for
        any indirect, incidental, special, consequential, exemplary, or punitive
        damages, or for lost profits, revenue, data, or goodwill, arising out of
        or relating to your use of the Platform. Our total liability for any
        claim relating to the Platform will not exceed the greater of the amounts
        you or your organization paid us for the Platform in the twelve months
        before the claim arose, or one hundred U.S. dollars.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Refactor and its officers,
        directors, employees, and agents from any claim, demand, loss, or expense
        (including reasonable attorneys&rsquo; fees) arising out of your content,
        your use of the Platform, or your violation of these Terms or of
        applicable law.
      </p>

      <h2>12. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of {governingState},
        without regard to its conflict-of-laws rules. You and Refactor agree to
        try in good faith to resolve any dispute informally by contacting{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> first. If that does
        not resolve it, the state and federal courts located in {governingState}{" "}
        will have exclusive jurisdiction, and you consent to venue there.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Last
        updated&rdquo; date above reflects the most recent revision. If a change
        is material, we will make reasonable efforts to notify you. Continuing to
        use the Platform after a change takes effect means you accept the revised
        Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
