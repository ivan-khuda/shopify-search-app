export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <s-app-nav>
        <s-link href="/chat" rel="home">Search</s-link>
        <s-link href="/onboarding">Onboarding</s-link>
      </s-app-nav>
      {children}
    </>
  );
}
