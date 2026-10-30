import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServerConnectionSettings } from '../components/settings/ServerConnectionSettings';
import { connectionManager } from '../lib/services/connection-manager';
import { SERVER_CONFIG_STORAGE_KEY } from '../lib/config/server-config';

describe('Phase 10: ServerConnectionSettings Component UI Tests', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SERVER_CONFIG_STORAGE_KEY);
    connectionManager.resetToDefaults();
    vi.restoreAllMocks();
  });

  it('renders connection modes, host input, and active endpoint preview', () => {
    render(<ServerConnectionSettings />);

    expect(screen.getByText(/Server & Local Network \(LAN\) Connection/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Local Development/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LAN Development \(Wi-Fi\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remote \/ Production/i })).toBeInTheDocument();
    expect(screen.getByText(/Active Supabase API Endpoint:/i)).toBeInTheDocument();
  });

  it('switches to LAN Development mode and allows changing IPv4 address', async () => {
    render(<ServerConnectionSettings />);

    const lanBtn = screen.getByRole('button', { name: /LAN Development \(Wi-Fi\)/i });
    fireEvent.click(lanBtn);

    const ipInput = screen.getByPlaceholderText('192.168.1.105') as HTMLInputElement;
    expect(ipInput).toBeInTheDocument();

    fireEvent.change(ipInput, { target: { value: '192.168.1.115' } });
    expect(ipInput.value).toBe('192.168.1.115');

    expect(screen.getByText('http://192.168.1.115:54321')).toBeInTheDocument();
  });

  it('shows error warning for invalid IPv4 address', () => {
    render(<ServerConnectionSettings />);

    const lanBtn = screen.getByRole('button', { name: /LAN Development \(Wi-Fi\)/i });
    fireEvent.click(lanBtn);

    const ipInput = screen.getByPlaceholderText('192.168.1.105');
    fireEvent.change(ipInput, { target: { value: '192.168.1.999' } });

    expect(screen.getByText(/Must be a valid IPv4 address/i)).toBeInTheDocument();
  });

  it('executes connection test and renders feedback message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 'v2.15.8' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ServerConnectionSettings />);

    const lanBtn = screen.getByRole('button', { name: /LAN Development \(Wi-Fi\)/i });
    fireEvent.click(lanBtn);

    const ipInput = screen.getByPlaceholderText('192.168.1.105');
    fireEvent.change(ipInput, { target: { value: '192.168.1.105' } });

    const testBtn = screen.getByRole('button', { name: /Test Connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Connected successfully to Supabase API/i)).toBeInTheDocument();
    });
  });

  it('saves configuration and updates persistent storage', async () => {
    render(<ServerConnectionSettings />);

    const lanBtn = screen.getByRole('button', { name: /LAN Development \(Wi-Fi\)/i });
    fireEvent.click(lanBtn);

    const ipInput = screen.getByPlaceholderText('192.168.1.105');
    fireEvent.change(ipInput, { target: { value: '192.168.1.108' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Reconnect/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Reconnected successfully to http:\/\/192.168.1.108:54321/i)).toBeInTheDocument();
    });

    expect(connectionManager.getConfig().host).toBe('192.168.1.108');
  });
});

