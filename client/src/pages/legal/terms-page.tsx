import { PublicPageLayout } from "@/components/public/public-page-layout";

export function TermsPage(): JSX.Element {
  return (
    <PublicPageLayout
      title="Terms of Use"
      description="These Terms of Use govern your access to and use of the FlowState service."
      maxWidthClassName="max-w-4xl"
    >
      <article className="space-y-6 text-sm leading-7 text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Definitions</h2>
          <p>
            In these Terms of Use, <strong>"FlowState," "we," "us,"</strong> and <strong>"our"</strong> refer to the operators of the FlowState service. <strong>"You"</strong> and <strong>"your"</strong> refer to the individual or entity using the Service. <strong>"Service"</strong> means the hosted FlowState website, application interfaces, collaboration features, and supporting infrastructure.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Eligibility and Authorized Access</h2>
          <p>
            You may use FlowState only if you are authorized to access the Service. Access is limited to approved users, invited participants, and authorized internal or external collaborators. You must not access resources, workspaces, or data beyond the permissions granted to your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your credentials and for all activity performed through your account. You must promptly cease use and notify the appropriate administrator if you believe your account or session has been compromised.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>attempt to access data, routes, or administrative controls that you are not authorized to access;</li>
            <li>interfere with, disrupt, probe, or circumvent FlowState security, permission, or availability controls;</li>
            <li>submit unlawful, malicious, or harmful content into the Service;</li>
            <li>reverse engineer, abuse, scrape, or automate the Service in a manner inconsistent with its intended internal operational use.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Service Availability and Changes</h2>
          <p>
            FlowState may change, improve, restrict, suspend, or remove features at any time for operational, security, maintenance, or product reasons. We may temporarily place the Service into maintenance mode during deployments, updates, or recovery operations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Content and Operational Data</h2>
          <p>
            You retain responsibility for the content you submit to the Service. By using FlowState, you acknowledge that the Service may store operational records, workspace activity, and backup artifacts necessary to provide security, restore capability, and routine service administration.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. External Participants</h2>
          <p>
            Where external collaborators are given access, such access remains limited, revocable, and subject to the same security, confidentiality, and acceptable-use expectations that apply to internal users. Nothing in these Terms expands access beyond the permissions assigned to the relevant account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Disclaimer</h2>
          <p>
            FlowState is provided on an "as is" and "as available" basis to the maximum extent permitted by applicable law. While we take reasonable measures to maintain reliability and security, we do not guarantee uninterrupted availability, error-free operation, or absolute security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Limitation of Use and Termination</h2>
          <p>
            We may restrict, suspend, or terminate access where necessary to protect the Service, enforce these Terms, respond to abuse, or comply with legal or organizational obligations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Contact and Future Support Channels</h2>
          <p>
            Dedicated support and notification channels may evolve over time. Until those channels are expanded, issue handling, operational communications, and product support may be provided through the currently available in-app or administrative workflows.
          </p>
        </section>
      </article>
    </PublicPageLayout>
  );
}
