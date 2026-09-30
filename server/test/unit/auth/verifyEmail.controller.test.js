/**
 * Unit tests for src/api/v1/authentication/controllers/verifyEmail.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (OTP verification business logic)
 */

const mockVerifyEmailOtp = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  verifyEmailOtp: mockVerifyEmailOtp,
}));

const verifyEmailController = require("../../../src/api/v1/authentication/controllers/verifyEmail");
const { createMockResponse } = require("../helpers/mockExpress");

describe("verifyEmail controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockVerifyEmailOtp.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (email, otp) => ({
    body: { email, otp },
  });

  it("should reject when the email or code is missing", async () => {
    await verifyEmailController(buildRequest(undefined, "123456"), res, next);

    expect(mockVerifyEmailOtp).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Invalid or expired OTP",
      }),
    );
  });

  it("should propagate the error when the OTP verification fails", async () => {
    const otpError = Object.assign(new Error("Invalid or expired OTP"), {
      statusCode: 400,
    });
    mockVerifyEmailOtp.mockRejectedValue(otpError);

    await verifyEmailController(
      buildRequest("jane@test.com", "123456"),
      res,
      next,
    );

    expect(mockVerifyEmailOtp).toHaveBeenCalledWith({
      email: "jane@test.com",
      code: "123456",
    });
    expect(next).toHaveBeenCalledWith(otpError);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should verify the OTP and return a success response", async () => {
    mockVerifyEmailOtp.mockResolvedValue(undefined);

    await verifyEmailController(
      buildRequest("jane@test.com", "123456"),
      res,
      next,
    );

    expect(mockVerifyEmailOtp).toHaveBeenCalledWith({
      email: "jane@test.com",
      code: "123456",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Email verified successfully.",
      links: {
        "sign-in": "/api/v1/auth/sign-in",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
