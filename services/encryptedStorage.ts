// services/encryptedStorage.ts
// ──────────────────────────────────────────────────────────────────
// Encrypted wrapper over AsyncStorage for sensitive data (chat messages,
// health feedback in the offline queue).
//
// Architecture:
//   • A 256-bit master key is generated once and stored in SecureStore
//     (Keychain on iOS, EncryptedSharedPreferences on Android).
//   • For each read/write, a per-key nonce is derived via SHA-256(masterKey + storageKey).
//   • Data is encrypted with a SHA-256 hash-chain stream cipher:
//       block[i] = SHA-256(nonce ‖ counter_i)
//     then XOR'd with the plaintext.
//   • Ciphertext is stored as base64 in AsyncStorage.
//
// This protects data at rest from other apps that may read AsyncStorage
// directly.  It does NOT protect against a rooted/jailbroken device with
// full Keychain access — that threat model requires hardware-backed keys.
//
// Why not native AES?  expo-crypto on SDK 54 does not expose AES.
// The hash-chain XOR scheme provides confidentiality equivalent to a
// stream cipher keyed by 256-bit random material.
// ──────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getRandomBytes, digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } from "expo-crypto";

const MASTER_KEY_ALIAS = "fks_enc_master_key_v1";
const ENCRYPTED_PREFIX = "enc:"; // marks ciphertext in AsyncStorage

// ─── Master key management ────────────────────────────────────────

let _cachedKey: string | null = null;

/**
 * Returns the 256-bit master key as a hex string (64 chars).
 * Generates + stores on first call; subsequent calls hit the in-memory cache.
 */
async function getMasterKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;

  try {
    const stored = await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
    if (stored && stored.length === 64) {
      _cachedKey = stored;
      return stored;
    }
  } catch {
    // SecureStore can fail on some emulators; fall through to generate
  }

  // Generate a new 256-bit key
  const bytes = getRandomBytes(32);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  try {
    await SecureStore.setItemAsync(MASTER_KEY_ALIAS, hex);
  } catch (err) {
    if (__DEV__) console.warn("[encryptedStorage] SecureStore write failed:", err);
    // If SecureStore is unavailable (emulator), we still encrypt in-memory
    // but the key won't persist across app restarts on that device.
  }

  _cachedKey = hex;
  return hex;
}

// ─── Crypto helpers ───────────────────────────────────────────────

/**
 * Derive a per-key nonce: SHA-256(masterKey + ":" + storageKey).
 * Returns a 64-char hex string.
 */
async function deriveNonce(masterKey: string, storageKey: string): Promise<string> {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${masterKey}:${storageKey}`,
    { encoding: CryptoEncoding.HEX },
  );
}

/**
 * Generate a keystream block for counter `i`:
 *   SHA-256(nonce + ":" + i) → 32 bytes
 */
async function keystreamBlock(nonce: string, counter: number): Promise<number[]> {
  const hex = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${nonce}:${counter}`,
    { encoding: CryptoEncoding.HEX },
  );
  const bytes: number[] = [];
  for (let j = 0; j < hex.length; j += 2) {
    bytes.push(parseInt(hex.substring(j, j + 2), 16));
  }
  return bytes;
}

/**
 * XOR plaintext bytes with hash-chain keystream.
 */
async function xorWithKeystream(data: number[], nonce: string): Promise<number[]> {
  const result = new Array<number>(data.length);
  let blockIdx = 0;
  let block: number[] = [];
  let blockPos = 0;

  for (let i = 0; i < data.length; i++) {
    if (blockPos >= block.length) {
      block = await keystreamBlock(nonce, blockIdx++);
      blockPos = 0;
    }
    result[i] = data[i] ^ block[blockPos++];
  }
  return result;
}

// ─── Base64 encode/decode (React Native compatible) ───────────────

function bytesToBase64(bytes: number[]): string {
  // Use built-in btoa in Hermes (RN 0.74+)
  const binary = bytes.map((b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

function base64ToBytes(b64: string): number[] {
  const binary = atob(b64);
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    bytes.push(binary.charCodeAt(i));
  }
  return bytes;
}

// ─── UTF-8 encode/decode ──────────────────────────────────────────

function utf8Encode(str: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
}

function utf8Decode(bytes: number[]): string {
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Encrypt and store a string value in AsyncStorage.
 * The master key is stored in SecureStore.
 */
export async function setEncryptedItem(key: string, value: string): Promise<void> {
  const masterKey = await getMasterKey();
  const nonce = await deriveNonce(masterKey, key);
  const plainBytes = utf8Encode(value);
  const cipherBytes = await xorWithKeystream(plainBytes, nonce);
  const cipherB64 = bytesToBase64(cipherBytes);
  await AsyncStorage.setItem(key, ENCRYPTED_PREFIX + cipherB64);
}

/**
 * Read and decrypt a value from AsyncStorage.
 * Returns `null` if the key doesn't exist.
 * If the stored value is NOT encrypted (legacy plain text), returns it as-is
 * to support transparent migration.
 */
export async function getEncryptedItem(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  // Legacy: if not prefixed with "enc:", return as plain text (migration path)
  if (!raw.startsWith(ENCRYPTED_PREFIX)) return raw;

  const cipherB64 = raw.slice(ENCRYPTED_PREFIX.length);
  const masterKey = await getMasterKey();
  const nonce = await deriveNonce(masterKey, key);
  const cipherBytes = base64ToBytes(cipherB64);
  const plainBytes = await xorWithKeystream(cipherBytes, nonce);
  return utf8Decode(plainBytes);
}

/**
 * Remove an encrypted item (same as AsyncStorage.removeItem).
 */
export async function removeEncryptedItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
