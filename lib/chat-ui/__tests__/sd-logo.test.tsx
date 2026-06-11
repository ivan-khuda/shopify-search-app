import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SDLogo } from '../components/sd-logo';

describe('SDLogo', () => {
  it('renders the compass-spark mark at the requested size', () => {
    const { container } = render(<SDLogo size={28} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('28px');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
