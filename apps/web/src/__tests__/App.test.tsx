import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('WealthNest App Shell', () => {
  it('renders application branding and header elements', async () => {
    render(<App />);

    // Validate brand logo title
    const brandElements = screen.getAllByText(/WealthNest/i);
    expect(brandElements.length).toBeGreaterThan(0);

    // Validate navigation item
    expect(screen.getByText(/System Overview/i)).toBeInTheDocument();
    const portfolioLinks = screen.getAllByText(/Portfolio/i);
    expect(portfolioLinks.length).toBeGreaterThan(0);

    // Validate local domain badge
    const domainBadges = screen.getAllByText(/wealthnest.local/i);
    expect(domainBadges.length).toBeGreaterThan(0);
  });
});
