export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <s-app-nav>
        <s-link href="/chat">Search</s-link>
        <s-link href="/onboarding">Onboarding</s-link>
        <s-link href="/settings">Settings</s-link>
      </s-app-nav>
      {children}
    </>
  );
}
