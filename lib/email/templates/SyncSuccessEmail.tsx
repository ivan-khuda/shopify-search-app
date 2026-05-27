/**
 * SyncSuccessEmail — transactional notification sent after a successful catalog sync.
 *
 * Wired in by Plan 08-11/12 via the EmailService (Plan 08-04). React Email primitives
 * auto-escape text node children (V5 Input Validation — mitigates T-08-EI email-content
 * injection via shop name or product fields). Do NOT use dangerouslySetInnerHTML.
 *
 * D-07 minimal-transactional brief: heading + one-line body + single CTA + footer.
 * No images, no marketing copy, no detailed stats.
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

export interface SyncSuccessEmailProps {
  shop: string;
  productCount: number;
  adminUrl: string;
}

export function SyncSuccessEmail({
  shop,
  productCount,
  adminUrl,
}: SyncSuccessEmailProps) {
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
            }}
          >
            Catalog sync complete
          </Text>
          <Text style={{ fontSize: '14px', color: '#374151' }}>
            SmartDiscovery AI synced {productCount} products from {shop}.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={adminUrl}
              style={{
                backgroundColor: '#008060',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              View in admin
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
