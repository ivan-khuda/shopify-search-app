import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StepRail } from '../onboarding/step-rail';

describe('StepRail', () => {
  it('renders three steps with labels and sublabels', () => {
    const { container, getByText } = render(<StepRail stage={0} />);
    expect(container.querySelectorAll('[data-testid^="step-"]')).toHaveLength(3);
    expect(getByText('Connect')).toBeInTheDocument();
    expect(getByText('Done — shop authorized')).toBeInTheDocument();
    expect(getByText('Sync products')).toBeInTheDocument();
    expect(getByText('Pull & embed your catalog')).toBeInTheDocument();
    expect(getByText('Enable drawer')).toBeInTheDocument();
    expect(getByText('Turn on App Embed in theme')).toBeInTheDocument();
  });

  it('stage 0 (idle): Connect done, nothing active', () => {
    const { getByTestId } = render(<StepRail stage={0} />);
    expect(getByTestId('step-1').getAttribute('data-done')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('false');
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('false');
  });

  it('stage 1 (syncing): Sync products active', () => {
    const { getByTestId } = render(<StepRail stage={1} />);
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('false');
  });

  it('stage 2 (synced): Sync products done, Enable drawer active', () => {
    const { getByTestId } = render(<StepRail stage={2} />);
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('true');
  });
});
