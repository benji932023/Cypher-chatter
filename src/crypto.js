import nacl from 'tweetnacl';
import { encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

export function getOrCreateKeypair() {
  const stored = localStorage.getItem('cipher_keypair');
  if (stored) {
    const { publicKey, secretKey } = JSON.parse(stored);
    return { publicKey: decodeBase64(publicKey), secretKey: decodeBase64(secretKey) };
  }
  const kp = nacl.box.keyPair();
  localStorage.setItem('cipher_keypair', JSON.stringify({
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey)
  }));
  return kp;
}

export function exportPublicKey(keypair) {
  return encodeBase64(keypair.publicKey);
}

export function encryptGroupMessage(message, roomKey) {
  const keyBytes = deriveRoomKey(roomKey);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = encodeUTF8(message);
  const encrypted = nacl.secretbox(messageBytes, nonce, keyBytes);
  const full = new Uint8Array(nonce.length + encrypted.length);
  full.set(nonce);
  full.set(encrypted, nonce.length);
  return encodeBase64(full);
}

export function decryptGroupMessage(payload, roomKey) {
  try {
    const keyBytes = deriveRoomKey(roomKey);
    const full = decodeBase64(payload);
    const nonce = full.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = full.slice(nacl.secretbox.nonceLength);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, keyBytes);
    if (!decrypted) return null;
    return new TextDecoder().decode(decrypted);
  } catch { return null; }
}

function deriveRoomKey(roomCode) {
  return encodeUTF8(roomCode.padEnd(32, '0').slice(0, 32));
}

export function generateRoomCode() {
  const bytes = nacl.randomBytes(12);
  return encodeBase64(bytes).replace(/[+/=]/g, '').slice(0, 16).toUpperCase();
}
