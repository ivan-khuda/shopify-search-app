'use client';

import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  List,
} from '@shopify/polaris';
import { useState } from 'react';

export default function OnboardingPage() {
  const [syncing, setSyncing] = useState(false);

  async function handleStartSync() {
    setSyncing(true);
    try {
      await fetch('/api/shopify/sync', { method: 'POST' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Page title="Welcome to SmartDiscovery AI">
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">How it works</Text>
              <List>
                <List.Item>We sync your product catalog automatically</List.Item>
                <List.Item>Our AI uses it to answer customer search queries</List.Item>
                <List.Item>You'll receive an email when the first sync completes</List.Item>
              </List>
              <Button variant="primary" onClick={handleStartSync} loading={syncing}>
                Start sync
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">What&apos;s synced</Text>
                <List>
                  <List.Item>Product titles, descriptions, tags</List.Item>
                  <List.Item>Variants and pricing</List.Item>
                  <List.Item>Images</List.Item>
                </List>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">What&apos;s next</Text>
                <List>
                  <List.Item>After sync: use the Search tab to test queries</List.Item>
                  <List.Item>Billing will be introduced in a future update</List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
