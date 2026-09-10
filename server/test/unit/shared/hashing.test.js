/**
 * Unit tests for src/utils/hashing.js
 *
 * bcryptjs is NOT mocked here: like jsonwebtoken in Phase 2, it is a
 * pure, local, deterministic cryptographic library (no network/db/
 * filesystem I/O), so exercising real hash/compare round-trips is the
 * most meaningful way to verify this wrapper.
 */

process.env.SALT_ROUNDS = "4"; // low cost factor to keep tests fast

const { generateHash, compareHash } = require("../../../src/utils/hashing");

describe("hashing utility (src/utils/hashing)", () => {
  afterAll(() => {
    delete process.env.SALT_ROUNDS;
  });

  it("should generate a bcrypt hash that is different from the plain text", async () => {
    const hash = await generateHash("my-secret-password");

    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("my-secret-password");
  });

  it("should generate a different hash for the same input on each call (random salt)", async () => {
    const [hash1, hash2] = await Promise.all([
      generateHash("my-secret-password"),
      generateHash("my-secret-password"),
    ]);

    expect(hash1).not.toBe(hash2);
  });

  it("should return true when comparing the original plain text to its hash", async () => {
    const hash = await generateHash("my-secret-password");

    await expect(compareHash("my-secret-password", hash)).resolves.toBe(true);
  });

  it("should return false when comparing an incorrect plain text to the hash", async () => {
    const hash = await generateHash("my-secret-password");

    await expect(compareHash("wrong-password", hash)).resolves.toBe(false);
  });
});
