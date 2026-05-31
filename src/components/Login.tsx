/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Laptop } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please input both operator identifier and passcode.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Authentication gate rejected the credentials');
      }

      onLoginSuccess(resData.token, resData.user.name);
    } catch (err: any) {
      setError(err?.message || 'Network disruption during handshake. Check endpoint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-6 bg-slate-900 p-6 rounded border border-slate-800 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-blue-605 bg-blue-600 text-white shadow-md">
            <Laptop className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-white font-sans uppercase">
            ApexERP CONTROL GATEWAY
          </h2>
          <p className="mt-1 text-[9px] text-slate-500 font-mono tracking-wider font-bold">
            SECURE HANDSHAKE INTERACTOR
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-2 rounded bg-rose-950/30 p-2.5 text-[11px] font-bold text-rose-300 border border-rose-900/30 font-mono">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label htmlFor="user-id" className="block text-[9px] font-bold tracking-wider text-slate-500 uppercase font-mono mb-1">
                Operator Identifier
              </label>
              <input
                id="user-id"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Enter operator code..."
              />
            </div>

            <div>
              <label htmlFor="passcode" className="block text-[9px] font-bold tracking-wider text-slate-500 uppercase font-mono mb-1">
                Console Passcode
              </label>
              <div className="relative">
                <input
                  id="passcode"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 font-mono uppercase tracking-wider"
          >
            <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white opacity-70" />
            {loading ? 'Opening Handshake...' : 'Authenticate Tunnel'}
          </button>
        </form>

        <div className="border-t border-slate-800 pt-3 mt-4">
          <div className="rounded bg-slate-950 p-3 text-[10px] text-slate-400 leading-normal border border-slate-900 font-mono">
            <span className="text-blue-505 text-blue-500 font-bold uppercase block mb-1">Access Credentials</span>
            Simply click <strong className="text-white">Authenticate</strong> using default pre-filled credentials (<strong className="text-white">admin / admin</strong>), or type any mock operator name.
          </div>
        </div>
      </div>
    </div>
  );
}
