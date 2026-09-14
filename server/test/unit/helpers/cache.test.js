const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

const mockGetRedisClient = jest.fn();

jest.doMock("../../../src/utils/logger", () => mockLogger);
jest.doMock("../../../src/config/redis", () => ({
  getRedisClient: mockGetRedisClient,
}));

const {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
} = require("../../../src/utils/cache");

describe("cache utilities", () => {
  let client;

  beforeEach(() => {
    client = {
      isOpen: true,
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      scanIterator: jest.fn(),
    };
    mockGetRedisClient.mockReset().mockReturnValue(client);
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  it("returns null without contacting Redis when the client is unavailable", async () => {
    mockGetRedisClient.mockReturnValue(null);

    await expect(getCache("article:1")).resolves.toBeNull();

    expect(client.get).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("Cache miss", {
      key: "article:1",
      reason: "redis unavailable",
    });
  });

  it("parses cached JSON and returns null for a missing key", async () => {
    client.get.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
    await expect(getCache("article:1")).resolves.toEqual({ id: 1 });

    client.get.mockResolvedValueOnce(null);
    await expect(getCache("article:missing")).resolves.toBeNull();
  });

  it("fails open when cached JSON or Redis reads fail", async () => {
    client.get.mockResolvedValueOnce("not-json");
    await expect(getCache("article:1")).resolves.toBeNull();

    client.get.mockRejectedValueOnce(new Error("READ_FAILED"));
    await expect(getCache("article:2")).resolves.toBeNull();

    expect(mockLogger.error).toHaveBeenCalledTimes(2);
  });

  it("writes values with the requested TTL and swallows write errors", async () => {
    await setCache("article:1", { id: 1 }, 60);
    expect(client.setEx).toHaveBeenCalledWith(
      "article:1",
      60,
      JSON.stringify({ id: 1 }),
    );

    client.setEx.mockRejectedValueOnce(new Error("WRITE_FAILED"));
    await expect(setCache("article:2", { id: 2 }, 30)).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith("Cache set error", {
      key: "article:2",
      message: "WRITE_FAILED",
    });
  });

  it("deletes an exact key and matching keys discovered through SCAN", async () => {
    await deleteCache("article:1");
    expect(client.del).toHaveBeenCalledWith("article:1");

    const steps = [
      { value: ["article:list:1", "article:list:2"], done: false },
      { value: ["article:list:3"], done: false },
      { value: undefined, done: true },
    ];
    client.scanIterator.mockReturnValue({
      next: jest.fn().mockImplementation(() => Promise.resolve(steps.shift())),
    });

    await deleteCachePattern("article:list:*");

    expect(client.scanIterator).toHaveBeenCalledWith({
      MATCH: "article:list:*",
      COUNT: 100,
    });
    expect(client.del).toHaveBeenCalledWith([
      "article:list:1",
      "article:list:2",
      "article:list:3",
    ]);
  });
});
