import { render } from '@testing-library/react';
import { shade, rgba, ACCENT } from '../tokens';
import { CATALOG } from '../catalog';
import { SDLogo, ShopifyMark } from '../brand';

describe('tokens', () => {
  it('exports indigo accent', () => expect(ACCENT).toBe('#5B4FE9'));
  it('shade darkens toward black for negative percent', () => {
    expect(shade('#ffffff', -50)).toBe('#808080');
  });
  it('shade lightens toward white for positive percent', () => {
    expect(shade('#000000', 50)).toBe('#808080');
  });
  it('rgba converts hex with alpha', () => {
    expect(rgba('#5B4FE9', 0.5)).toBe('rgba(91,79,233,0.5)');
  });
  it('shade handles 3-char hex — darkens #fff by 50%', () => {
    expect(shade('#fff', -50)).toBe('#808080');
  });
  it('rgba handles 3-char hex — #fff at alpha 1', () => {
    expect(rgba('#fff', 1)).toBe('rgba(255,255,255,1)');
  });
});

describe('catalog', () => {
  it('contains all products referenced by the landing page', () => {
    const needed = ['p1', 'p3', 'p8', 'p9', 'p10', 'p11', 'p13', 'p14'];
    for (const id of needed) {
      expect(CATALOG.find((p) => p.id === id), id).toBeTruthy();
    }
  });
  it('every product has image, price, type, description', () => {
    for (const p of CATALOG) {
      expect(p.image).toMatch(/^https:\/\/images\.unsplash\.com\//);
      expect(p.price).toBeGreaterThan(0);
      expect(p.type).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });
});

describe('brand', () => {
  it('SDLogo renders an svg tile', () => {
    const { container } = render(<SDLogo size={28} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
  it('ShopifyMark renders', () => {
    const { container } = render(<ShopifyMark />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
