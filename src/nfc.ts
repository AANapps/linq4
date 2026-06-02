import { Capacitor } from '@capacitor/core';
import type { NfcEvent, NdefRecord } from '@capgo/capacitor-nfc';

export type NFCScanResult =
  | { ok: true; storeId: string }
  | { ok: false; error: string; cancelled?: boolean };

// ── NDEF TNF constants ────────────────────────────────────────────────────────

const TNF_WELL_KNOWN = 1;

const URI_PREFIXES = [
  '', 'http://www.', 'https://www.', 'http://', 'https://',
  'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.',
  'ftps://', 'sftp://', 'smb://', 'nfs://', 'ftp://', 'dav://',
  'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:', 'pop:',
  'sip:', 'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://',
  'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:', 'urn:epc:tag:',
  'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:',
];

function isType(type: number[], ascii: string): boolean {
  if (type.length !== ascii.length) return false;
  return ascii.split('').every((c, i) => type[i] === c.charCodeAt(0));
}

function decodeText(payload: number[]): string {
  const statusByte = payload[0];
  const isUtf16 = (statusByte & 0x80) !== 0;
  const langLen = statusByte & 0x3f;
  const bytes = new Uint8Array(payload.slice(1 + langLen));
  return new TextDecoder(isUtf16 ? 'utf-16' : 'utf-8').decode(bytes);
}

function decodeUri(payload: number[]): string {
  const prefix = URI_PREFIXES[payload[0]] ?? '';
  const rest = new TextDecoder('utf-8').decode(new Uint8Array(payload.slice(1)));
  return prefix + rest;
}

function extractStoreId(records: NdefRecord[]): string | null {
  for (const rec of records) {
    const { tnf, type, payload } = rec;
    if (!payload.length) continue;

    if (tnf === TNF_WELL_KNOWN && isType(type, 'T')) {
      const text = decodeText(payload);
      if (text.startsWith('linq4:')) return text.slice(6).trim();
    }

    if (tnf === TNF_WELL_KNOWN && isType(type, 'U')) {
      const uri = decodeUri(payload);
      const m = uri.match(/[?&]stamp=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
  }
  return null;
}

// ── Native NFC (Capacitor — iOS + Android) ────────────────────────────────────

async function nativeScan(alertMessage: string): Promise<NFCScanResult> {
  const { CapacitorNfc } = await import('@capgo/capacitor-nfc');

  return new Promise(async (resolve) => {
    let settled = false;
    const finish = (result: NFCScanResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Listen for any NFC discovery event (covers both 'tag' and 'ndef' types)
    const listener = await CapacitorNfc.addListener('nfcEvent', async (event: NfcEvent) => {
      await listener.remove();
      await CapacitorNfc.stopScanning().catch(() => {});

      const records: NdefRecord[] = event.tag.ndefMessage ?? [];
      const storeId = extractStoreId(records);

      finish(storeId
        ? { ok: true, storeId }
        : { ok: false, error: 'Not a valid Linq store tag.' });
    });

    try {
      await CapacitorNfc.startScanning({
        alertMessage,
        invalidateAfterFirstRead: true,
      });
    } catch (err: any) {
      await listener.remove();
      console.error('[NFC] startScanning error:', err);
      if (!settled) {
        finish({ ok: false, error: err?.message ?? 'Could not start NFC scan.', cancelled: true });
      }
    }
  });
}

// ── Web NFC (Android Chrome NDEFReader) ───────────────────────────────────────

function webNFCScan(signal: AbortSignal): Promise<NFCScanResult> {
  return new Promise(async (resolve) => {
    const reader = new (window as any).NDEFReader();

    reader.onreadingerror = () => {
      resolve({ ok: false, error: 'Could not read NFC tag. Try again.' });
    };

    reader.onreading = (event: any) => {
      let storeId: string | null = null;
      for (const record of event.message.records) {
        if (record.recordType === 'text') {
          const text = new TextDecoder(record.encoding ?? 'utf-8').decode(record.data);
          if (text.startsWith('linq4:')) { storeId = text.slice(6).trim(); break; }
        }
        if (record.recordType === 'url') {
          const url = new TextDecoder().decode(record.data);
          const m = url.match(/[?&]stamp=([^&]+)/);
          if (m) { storeId = decodeURIComponent(m[1]); break; }
        }
      }
      resolve(storeId
        ? { ok: true, storeId }
        : { ok: false, error: 'Not a valid Linq store tag.' });
    };

    try {
      await reader.scan({ signal });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        resolve({ ok: false, error: err?.message ?? 'Could not start NFC scan.' });
      }
    }
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scan an NFC tag and return the store ID encoded in it.
 *
 * - iOS / Android (Capacitor build): invokes the native NFC system sheet.
 *   The OS handles its own scanning UI; no custom popup is needed.
 * - Android Chrome (web): uses the Web NFC NDEFReader API.
 *   Caller should show a "Hold near tag" indicator while awaiting.
 * - Other browsers: immediately returns an error.
 */
export async function scanNFCTag(
  alertMessage = 'Hold near the store NFC tag to collect your stamp',
  abortController?: AbortController,
): Promise<NFCScanResult> {
  const platform = Capacitor.getPlatform();

  if (platform === 'ios' || platform === 'android') {
    return nativeScan(alertMessage);
  }

  if ('NDEFReader' in window) {
    const ctrl = abortController ?? new AbortController();
    return webNFCScan(ctrl.signal);
  }

  return { ok: false, error: 'NFC is not supported on this device.' };
}

/** True when the current platform can scan NFC at all. */
export function nfcAvailable(): boolean {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' || 'NDEFReader' in window;
}
