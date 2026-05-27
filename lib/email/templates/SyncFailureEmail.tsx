/**
 * SyncFailureEmail — transactional notification sent when a catalog sync fails.
 *
 * Wired in by Plan 08-11/12 via the EmailService onFailure branch (Plan 08-04).
 * The errorMessage is rendered as a React Email Text child — auto-escaped by
 * the renderer (V5 Input Validation; mitigates T-08-EI / T-08-05-T1 email-content
 * injection: a thrown Error.message may carry GraphQL fragments, schema text,
 * or merchant-supplied strings).
 *
 * NEVER use dangerouslySetInnerHTML in this file. The grep verification step
 * enforces this rule.
 *
 * D-06: retryUrl is constructed by the Inngest function as
 *   `${process.env.HOST}/onboarding?retry=${syncRunId}`
 * and drilled in via the retryUrl prop — this template does not build it.
 *
 * D-07 minimal-transactional brief: red heading + one-line body + boxed error
 * message + single "Retry sync" CTA + footer.
 */
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from '@react-email/components';

export interface SyncFailureEmailProps {
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string;
}

export function SyncFailureEmail({
  shop,
  errorMessage,
  retryUrl,
}: SyncFailureEmailProps) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f6f9fc',
        }}
      >
        <Container
          style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            maxWidth: '480px',
          }}
        >
          <Text
            style={{
              fontSize: '20px',
              fontWeight: 600,
              margin: '0 0 16px',
              color: '#b91c1c',
            }}
          >
            Catalog sync failed
          </Text>
          <Text style={{ fontSize: '14px', color: '#374151' }}>
            We couldn&apos;t finish syncing products from {shop}.
          </Text>
          <Text
            style={{
              fontSize: '13px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '12px',
              borderRadius: '4px',
            }}
          >
            {errorMessage}
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={retryUrl}
              style={{
                backgroundColor: '#008060',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              Retry sync
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb' }} />
          <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
            SmartDiscovery AI · transactional notification
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
