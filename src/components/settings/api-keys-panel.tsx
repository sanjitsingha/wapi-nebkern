'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Key,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SettingsPanelHead } from './settings-panel-head';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
}

interface CreatedKey {
  key: string;
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
}

const SCOPE_OPTIONS = [
  { value: 'read:templates', label: 'Read templates' },
  { value: 'send:messages', label: 'Send messages' },
];

export function ApiKeysPanel() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'read:templates',
    'send:messages',
  ]);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [showKey, setShowKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load keys');
      setKeys(json.keys ?? []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function createKey() {
    setCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim() || 'Integration key',
          scopes: selectedScopes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create key');
      setCreatedKey(json);
      setKeys((prev) => [
        {
          id: json.id,
          name: json.name,
          key_prefix: json.key_prefix,
          scopes: json.scopes,
          last_used_at: null,
          created_at: json.created_at,
          revoked_at: null,
          expires_at: null,
        },
        ...prev,
      ]);
      toast.success('API key created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to revoke key');
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('API key revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  }

  async function copyKeyToClipboard(key: string) {
    await navigator.clipboard.writeText(key);
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="API Access"
        description="Generate API keys to connect external software (like your CIMS/HIMS) to wacrm. Keys are scoped by permission and can be revoked at any time."
      />

      {/* Create Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Generate new key
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a new key for server-to-server integrations. The key is
              shown only once — copy it immediately.
            </DialogDescription>
          </DialogHeader>

          {!createdKey ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. CIMS Production"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2">
                  {SCOPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedScopes.includes(opt.value)}
                        onCheckedChange={() => toggleScope(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Key created successfully
                  </span>
                </div>
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Copy this key now — it will not be shown again.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Your API key</Label>
                <div className="relative">
                  <Input
                    readOnly
                    type={showKey ? 'text' : 'password'}
                    value={createdKey.key}
                    className="pr-20 font-mono text-sm"
                  />
                  <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowKey(!showKey)}
                      type="button"
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => copyKeyToClipboard(createdKey.key)}
                      type="button"
                    >
                      {copyState === 'copied' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Name:</span>{' '}
                  {createdKey.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Scopes:</span>{' '}
                  {createdKey.scopes.join(', ')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!createdKey ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createKey}
                  disabled={creating || selectedScopes.length === 0}
                >
                  {creating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Generate key
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setCreatedKey(null);
                  setNewKeyName('');
                  setSelectedScopes(['read:templates', 'send:messages']);
                  setShowKey(false);
                  setDialogOpen(false);
                }}
                type="button"
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Keys Table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Active keys</h3>
          <p className="text-muted-foreground text-xs mt-0.5">
            {activeKeys.length} key{activeKeys.length !== 1 ? 's' : ''} active
          </p>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground">
            <Key className="h-8 w-8 mb-2 opacity-40" />
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {key.key_prefix}••••••••
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-[10px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(key.last_used_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(key.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => revokeKey(key.id)}
                      disabled={revokingId === key.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {revokingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Usage Instructions */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-2">How to use your API key</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Include your API key in the <code className="text-xs bg-muted px-1 py-0.5 rounded">x-api-key</code> header of every request:
          </p>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono">
{`curl -X POST \\
  ${typeof window !== 'undefined' ? window.location.origin : ''}/api/integrations/send-message \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: wak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -d '{
    "to": "+15551234567",
    "template": { "name": "appointment_confirmation", "language": "en_US" },
    "params": ["John Doe", "APT-1234", "Dr. Smith", "2025-07-15", "10:30 AM"]
  }'`}
          </pre>
          <p>
            Available endpoints:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <code className="font-mono">GET /api/integrations/templates</code>
              {' '}— List approved WhatsApp templates (requires <code className="font-mono">read:templates</code>)
            </li>
            <li>
              <code className="font-mono">POST /api/integrations/send-message</code>
              {' '}— Send any template message (requires <code className="font-mono">send:messages</code>)
            </li>
            <li>
              <code className="font-mono">POST /api/integrations/handshake</code>
              {' '}— Discovery handshake (no scope required)
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
