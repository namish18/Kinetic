import test from "node:test";
import assert from "node:assert/strict";
import {
    decryptGitHubToken,
    encryptGitHubToken,
} from "./githubTokenService.js";

const secret = "test-only-github-token-encryption-secret";

test("encrypts OAuth tokens so the plaintext is not stored", () => {
    const token = "gho_test_access_token_value";
    const encrypted = encryptGitHubToken(token, secret);
    assert.notEqual(encrypted, token);
    assert.equal(encrypted.includes(token), false);
    assert.equal(decryptGitHubToken(encrypted, secret), token);
});

test("uses a fresh IV for each encryption", () => {
    const first = encryptGitHubToken("same-token", secret);
    const second = encryptGitHubToken("same-token", secret);
    assert.notEqual(first, second);
    assert.equal(decryptGitHubToken(first, secret), "same-token");
    assert.equal(decryptGitHubToken(second, secret), "same-token");
});

test("rejects decryption with a different key", () => {
    const encrypted = encryptGitHubToken("gho_secret", secret);
    assert.throws(
        () => decryptGitHubToken(encrypted, "a-different-github-token-encryption-secret"),
    );
});

test("rejects tampered authentication tags and malformed payloads", () => {
    const encrypted = encryptGitHubToken("gho_secret", secret);
    const parts = encrypted.split(".");
    parts[2] = parts[2].replace(/^./, parts[2][0] === "0" ? "1" : "0");
    assert.throws(() => decryptGitHubToken(parts.join("."), secret));
    assert.throws(() => decryptGitHubToken("not-an-encrypted-token", secret));
});

test("requires a sufficiently long encryption secret", () => {
    assert.throws(() => encryptGitHubToken("gho_secret", "short"), /at least 32 characters/);
});
