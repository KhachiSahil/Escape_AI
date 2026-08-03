import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn().mockResolvedValue(undefined);
  return {
    mockSendMail,
    mockCreateTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

vi.mock("../config", () => ({
  config: {
    smtp: { host: "", port: 587, user: "", pass: "", from: "no-reply@example.com" },
  },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../config");
  });

  it("no-ops without throwing when SMTP is not configured", async () => {
    const { sendEmail } = await import("./notificationService");
    await expect(sendEmail("a@b.com", "subject", "body")).resolves.toBeUndefined();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("sends via the configured transporter when SMTP is set", async () => {
    vi.doMock("../config", () => ({
      config: {
        smtp: { host: "smtp.test", port: 587, user: "u", pass: "p", from: "no-reply@example.com" },
      },
    }));
    const { sendEmail } = await import("./notificationService");

    await sendEmail("a@b.com", "subject", "body");

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.test",
      port: 587,
      auth: { user: "u", pass: "p" },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "no-reply@example.com",
      to: "a@b.com",
      subject: "subject",
      text: "body",
    });
  });

  it("does not throw when the transporter rejects", async () => {
    vi.doMock("../config", () => ({
      config: {
        smtp: { host: "smtp.test", port: 587, user: "u", pass: "p", from: "no-reply@example.com" },
      },
    }));
    mockSendMail.mockRejectedValueOnce(new Error("smtp down"));
    const { sendEmail } = await import("./notificationService");

    await expect(sendEmail("a@b.com", "subject", "body")).resolves.toBeUndefined();
  });
});
