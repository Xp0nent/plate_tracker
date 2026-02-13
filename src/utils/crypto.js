import CryptoJS from 'crypto-js';

// In a real app, move this to an environment variable (.env)
const SECRET_KEY = 'lto-plate-system-secure-key-2026';

export const encryptData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const ciphertext = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
    
    // Make it URL-safe (replaces +, /, = which break URLs)
    return encodeURIComponent(ciphertext);
  } catch (e) {
    return null;
  }
};

export const decryptData = (safeCiphertext) => {
  try {
    const ciphertext = decodeURIComponent(safeCiphertext);
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
  } catch (e) {
    return null; // Decryption failed (tampered URL)
  }
};