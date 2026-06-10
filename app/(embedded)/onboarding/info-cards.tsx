// Two-up info cards per the 2026-06-10 design handoff. Static merchant-facing
// copy; embedding-model details intentionally generic (model is an internal
// pinned constant, not a merchant concern).

const SYNCED_ITEMS = [
  'Title, description, tags, vendor, product type',
  'Variants, options, prices',
  'Featured images',
  'Updates from Shopify in real time via webhooks',
];

const NEXT_ITEMS = [
  'We embed each product for AI-powered search',
  'We build semantic + full-text search indexes',
  "You'll get an email when the first sync completes",
  'Enable the App Embed block in your theme',
];

function InfoCard({
  title,
  items,
  testId,
}: {
  title: string;
  items: string[];
  testId: string;
}) {
  return (
    <s-box
      padding="base"
      borderWidth="small"
      borderStyle="solid"
      borderColor="base"
      borderRadius="base"
      data-testid={testId}
    >
      <s-heading>{title}</s-heading>
      <s-unordered-list>
        {items.map((item) => (
          <s-list-item key={item}>{item}</s-list-item>
        ))}
      </s-unordered-list>
    </s-box>
  );
}

export function InfoCards() {
  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <InfoCard title="What gets synced" items={SYNCED_ITEMS} testId="info-synced" />
      <InfoCard title="What happens next" items={NEXT_ITEMS} testId="info-next" />
    </s-grid>
  );
}
