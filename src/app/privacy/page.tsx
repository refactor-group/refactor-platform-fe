import type { Metadata } from "next";

import { LegalPage } from "@/components/ui/legal/legal-page";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Privacy Policy | Refactor Coach",
  description:
    "How the Refactor coaching platform collects, uses, stores, and shares information, including data received from Google APIs.",
};

const LAST_UPDATED = "August 11, 2026";

/** Verbatim disclosure Google requires of apps using sensitive OAuth scopes. */
const LIMITED_USE_STATEMENT =
  "Refactor's use and transfer of information received from Google APIs to any " +
  "other app will adhere to the Google API Services User Data Policy, including " +
  "the Limited Use requirements.";

const GOOGLE_USER_DATA_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

export default function PrivacyPolicyPage() {
  const { entity, contactEmail } = siteConfig.legal;

  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        {entity} (&ldquo;Refactor,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
        operates the Refactor coaching platform at myrefactor.com (the
        &ldquo;Platform&rdquo;). This policy explains what information the
        Platform collects, how we use it, who we share it with, how long we keep
        it, and the choices you have.
      </p>
      <p>
        This policy governs the Platform only. Our marketing websites at
        refactorgroup.com and refactorcoach.com are covered by a separate privacy
        policy.
      </p>

      <h2>Information we collect</h2>

      <h3>Account information</h3>
      <p>
        When an account is created for you, we collect your first and last name,
        email address, and the organization and coaching relationships you belong
        to. Accounts on the Platform are created by invitation from an
        organization administrator or coach; there is no public self-signup. We
        store a salted hash of your password, never the password itself.
      </p>

      <h3>Coaching content</h3>
      <p>
        The Platform exists to hold the working record of a coaching
        relationship. Depending on how you and your coach use it, that includes
        coaching session titles, dates, and topics; collaborative session notes;
        agreements; action items and their due dates and status; and goals and
        their progress. This content is visible to the coach and client in the
        relationship it belongs to, and to administrators of the organization
        that owns the relationship.
      </p>

      <h3>Technical information</h3>
      <p>
        Our servers and network provider record technical information about each
        request: IP address, user agent, the resource requested, and a timestamp.
        We use this to operate the Platform, keep sessions secure, prevent abuse,
        and debug errors.
      </p>

      <h3>Cookies</h3>
      <p>
        We set a first-party session cookie so you stay signed in. We do not run
        third-party analytics, advertising, or cross-site tracking on the
        Platform.
      </p>

      <h2>Google user data</h2>
      <p>
        Connecting a Google account is optional. Nothing in this section applies
        unless you choose to connect one under Settings &rarr; Integrations.
      </p>
      <p>
        When you connect your Google account, you are asked to grant the
        following scopes, and we use the data they return only as described here:
      </p>
      <ul>
        <li>
          <strong>openid</strong>, <strong>userinfo.email</strong>, and{" "}
          <strong>userinfo.profile</strong> &mdash; we receive your Google
          account identifier, email address, and basic profile information. We
          use these to identify which Google account is connected and to display
          it back to you on the integrations screen so you can confirm the right
          account is linked.
        </li>
        <li>
          <strong>meetings.space.created</strong> &mdash; we use this solely to
          create a Google Meet space for a coaching session and to read back that
          space&rsquo;s meeting URI. We store the meeting URI on the coaching
          relationship and display it as a &ldquo;Join Meet&rdquo; link to the
          coach and their client.
        </li>
      </ul>
      <p>
        We only interact with Meet spaces that the Platform itself created. We do
        not read, list, or modify your existing meetings, and we do not request
        or receive access to your Google Calendar, Gmail, Drive, or contacts. We
        do not access meeting recordings, transcripts, or participant data.
      </p>
      <p>
        <strong>Storage.</strong> Google access and refresh tokens are stored
        encrypted on our servers and are used only to perform the actions
        described above on your behalf.
      </p>
      <p>
        <strong>Sharing.</strong> We do not sell Google user data, use it for
        advertising, use it to train generalized artificial intelligence or
        machine learning models, or transfer it to third parties except as
        strictly necessary to provide the features described above, to comply
        with applicable law, or as part of a merger or acquisition in which the
        Platform is transferred. Human beings do not read your Google user data
        except where you have given affirmative consent for a specific support
        request, where it is necessary for security purposes such as
        investigating abuse, or where required by law.
      </p>
      <p>
        <strong>Revoking access.</strong> You can disconnect your Google account
        at any time under Settings &rarr; Integrations. Disconnecting revokes our
        tokens with Google and deletes them from our systems. You can also review
        and revoke access directly from your{" "}
        <a
          href={GOOGLE_PERMISSIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Account permissions page
        </a>
        .
      </p>
      <p>{LIMITED_USE_STATEMENT}</p>
      <p>
        You can read the{" "}
        <a
          href={GOOGLE_USER_DATA_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>{" "}
        in full.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the Platform and the coaching features you use.</li>
        <li>
          To authenticate you, keep your session secure, and protect accounts
          from unauthorized access.
        </li>
        <li>
          To send transactional email &mdash; invitations, password resets, and
          notifications about actions assigned to you.
        </li>
        <li>To operate, secure, debug, and improve the Platform.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>
      <p>
        We do not sell or rent personal information, and we do not use your
        coaching content for advertising.
      </p>

      <h2>Service providers</h2>
      <p>
        We rely on the following categories of service provider to operate the
        Platform. Each receives only the information necessary for its function,
        and none is permitted to use it for its own purposes.
      </p>
      <ul>
        <li>
          <strong>Cloud hosting and database providers</strong>, which run the
          application servers and store the Platform&rsquo;s data.
        </li>
        <li>
          <strong>A content delivery and security provider</strong>, which
          proxies traffic, terminates TLS, and provides denial-of-service and
          bot protection.
        </li>
        <li>
          <strong>A transactional email provider</strong>, which delivers
          invitations, password resets, and notifications.
        </li>
        <li>
          <strong>A collaborative editing provider</strong>, which powers shared
          session notes.
        </li>
        <li>
          <strong>Google</strong>, which provides the optional Google Meet
          integration described above, when you connect a Google account.
        </li>
      </ul>
      <p>
        A current list of the specific providers we use is available on request
        at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
      <p>
        We may also disclose information when required by law, in response to
        valid legal process, or to protect the rights, safety, or property of
        Refactor, our users, or others.
      </p>

      <h2>How long we keep information</h2>
      <p>
        We keep your account information and coaching content for as long as your
        account is active, and afterward for a reasonable period to satisfy
        legal, accounting, or reporting obligations. Google tokens are deleted
        when you disconnect the integration or delete your account. Server logs
        are kept for a short rolling window, typically up to 90 days, for
        security and operational purposes.
      </p>

      <h2>Your rights and choices</h2>
      <p>
        Depending on where you live, you may have the right to request access to
        the personal information we hold about you, to correct it, to ask us to
        delete it, or to object to certain uses. To exercise any of these rights,
        email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. We will
        respond within a reasonable timeframe and will not discriminate against
        you for making a request.
      </p>
      <p>
        Because coaching content is shared between a coach and a client, deleting
        your account does not automatically delete content the other party
        contributed to a shared record. Contact us and we will explain what can
        be removed in your situation.
      </p>
      <p>
        <strong>California residents.</strong> California law gives you specific
        rights regarding your personal information, including the right to know
        what we collect and how we use it, the right to request deletion, and the
        right to opt out of the sale or sharing of personal information. We do
        not sell or share personal information for cross-context behavioral
        advertising. Use the email address above to exercise these rights.
      </p>

      <h2>Security</h2>
      <p>
        We use TLS encryption in transit, encrypt OAuth tokens at rest, hash
        passwords, and restrict access to production systems. No method of
        transmission or storage is fully secure, so we cannot guarantee absolute
        security.
      </p>

      <h2>Children&rsquo;s privacy</h2>
      <p>
        The Platform is intended for adults in a professional coaching
        relationship. We do not knowingly collect personal information from
        children under 13. If you believe a child has provided us with personal
        information, contact us and we will delete it.
      </p>

      <h2>International users</h2>
      <p>
        Refactor is based in the United States and processes information there.
        If you use the Platform from outside the United States, you consent to
        that processing.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The &ldquo;Last
        updated&rdquo; date above reflects the most recent revision, and we will
        highlight material changes on this page.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy or your information? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
