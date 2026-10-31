// No look-alike characters (0/O, 1/l/I) so that a generated password can be read out or retyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*+-?";

/** Random password from the browser's cryptographic generator. */
export function generatePassword(length = 16): string {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
}