// Three-step onboarding rail per the 2026-06-10 design handoff:
// Connect (done at install) → Sync products → Enable drawer.
// Pure presentational; jsdom can't run Polaris custom elements, so state is
// also exposed via data-done/data-active for tests.

export type SyncStage = 0 | 1 | 2;

interface Step {
  label: string;
  sub: string;
  done: boolean;
  active: boolean;
}

export function StepRail({ stage }: { stage: SyncStage }) {
  const steps: Step[] = [
    { label: 'Connect', sub: 'Done — shop authorized', done: true, active: false },
    {
      label: 'Sync products',
      sub: 'Pull & embed your catalog',
      done: stage >= 2,
      active: stage === 1,
    },
    {
      label: 'Enable drawer',
      sub: 'Turn on App Embed in theme',
      done: false,
      active: stage === 2,
    },
  ];

  return (
    <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
      {steps.map((step, i) => (
        <s-box
          key={step.label}
          padding="base"
          borderWidth="small"
          borderStyle="solid"
          borderColor={step.active ? 'strong' : 'base'}
          borderRadius="base"
          data-testid={`step-${i + 1}`}
          data-done={step.done ? 'true' : 'false'}
          data-active={step.active ? 'true' : 'false'}
        >
          <s-stack direction="inline" gap="small" alignItems="center">
            {step.done ? (
              <s-badge tone="success">✓</s-badge>
            ) : step.active ? (
              <s-badge tone="info">{String(i + 1)}</s-badge>
            ) : (
              <s-badge>{String(i + 1)}</s-badge>
            )}
            <s-text>{step.label}</s-text>
          </s-stack>
          <s-text tone="subdued">{step.sub}</s-text>
        </s-box>
      ))}
    </s-grid>
  );
}
