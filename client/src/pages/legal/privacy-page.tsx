import { PublicPageLayout } from "@/components/public/public-page-layout";

export function PrivacyPage(): JSX.Element {
  return (
    <PublicPageLayout
      title="Privacy Policy"
      description="This Privacy Policy explains how FlowState collects, uses, stores, and protects information when you access or use the FlowState service."
      maxWidthClassName="max-w-4xl"
    >
      <article className="space-y-6 text-sm leading-7 text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Definitions</h2>
          <p>
            In this Privacy Policy, <strong>"FlowState," "we," "us,"</strong> and <strong>"our"</strong> refer to the
            operators of the FlowState service. <strong>"You"</strong> and <strong>"your"</strong> refer to the person or
            organization accessing or using FlowState. <strong>"Service"</strong> means the FlowState website,
            application features, and related operational systems that support access to the hosted product.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Information We Collect</h2>
          <p>We collect information that is reasonably necessary to provide, secure, and operate the Service, including:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>account details such as name, email address, username, and profile information you choose to provide;</li>
            <li>workspace content such as boards, comments, threads, messages, and structured collaboration data;</li>
            <li>security and operational records such as authentication activity, request identifiers, IP data, and user-agent information;</li>
            <li>bug reports and diagnostic details that you intentionally submit through the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. How We Use Information</h2>
          <p>We use collected information to authenticate users, provide collaboration features, maintain account security, investigate misuse, debug failures, and improve service reliability for authorized users of the platform.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Browser Storage and Essential Session Data</h2>
          <p>
            FlowState uses essential browser storage and local session data to keep you signed in, preserve required application state, and support core product behavior. We do not currently use marketing analytics, advertising trackers, or non-essential cross-site tracking technologies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Cookies and Similar Technologies</h2>
          <p>
            To the extent cookies or equivalent browser mechanisms are used by the Service, they are used for essential product and security purposes, including authentication continuity, request integrity, and operational stability. FlowState does not currently rely on a non-essential cookie or tracking consent workflow because the current hosted product does not use marketing or advertising cookies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Logging, Security, and Diagnostics</h2>
          <p>
            We maintain operational and security logs to protect accounts, diagnose application failures, support access control enforcement, and investigate abuse or unexpected behavior. These records may include timestamps, request metadata, route information, IP addresses, and device or browser details.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Data Sharing</h2>
          <p>
            We do not sell personal information. Information may be disclosed only as reasonably necessary to operate the Service, comply with legal obligations, protect the security of the Service, or respond to authorized organizational or administrative requests.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Retention</h2>
          <p>
            We retain account, collaboration, backup, and operational records for as long as reasonably necessary to provide the Service, maintain security and restore capability, comply with legal obligations, and support legitimate internal operational needs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Security Measures</h2>
          <p>
            FlowState uses access controls, structured production logging, validated configuration, encrypted sensitive content paths, and encrypted offsite backups as part of its current security posture. No system can guarantee absolute security, and you remain responsible for protecting your credentials and using the Service only as authorized.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Your Responsibilities</h2>
          <p>
            You are responsible for ensuring that any information you submit to FlowState is appropriate for the intended workspace, that your credentials remain confidential, and that your use of the Service complies with applicable internal policies, confidentiality obligations, and law.
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}
