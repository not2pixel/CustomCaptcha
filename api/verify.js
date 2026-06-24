const TURNSTILE_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(payload);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || undefined;
}

async function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      success: false,
      message: "Method not allowed"
    });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION || "hello_access";
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;

  if (!secretKey) {
    return sendJson(res, 500, {
      success: false,
      message: "Missing TURNSTILE_SECRET_KEY environment variable"
    });
  }

  const body = await getBody(req);
  const token = body.token || body["cf-turnstile-response"];

  // This is only a UX gate. Do not treat customPassed as real security in open-source code.
  // Cloudflare Turnstile server-side validation below is the real protection layer.
  if (body.customPassed !== true) {
    return sendJson(res, 400, {
      success: false,
      message: "Custom captcha step was not completed"
    });
  }

  if (!token || typeof token !== "string") {
    return sendJson(res, 400, {
      success: false,
      message: "Missing Turnstile token"
    });
  }

  const formData = new URLSearchParams();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const clientIp = getClientIp(req);
  if (clientIp) formData.append("remoteip", clientIp);

  let outcome;

  try {
    const verifyResponse = await fetch(TURNSTILE_ENDPOINT, {
      method: "POST",
      body: formData
    });

    outcome = await verifyResponse.json();
  } catch (error) {
    return sendJson(res, 502, {
      success: false,
      message: "Could not reach Cloudflare Siteverify",
      detail: error.message
    });
  }

  if (!outcome.success) {
    return sendJson(res, 403, {
      success: false,
      message: "Turnstile verification failed",
      errors: outcome["error-codes"] || []
    });
  }

  if (expectedAction && outcome.action && outcome.action !== expectedAction) {
    return sendJson(res, 403, {
      success: false,
      message: "Turnstile action mismatch"
    });
  }

  if (expectedHostname && outcome.hostname !== expectedHostname) {
    return sendJson(res, 403, {
      success: false,
      message: "Turnstile hostname mismatch"
    });
  }

  return sendJson(res, 200, {
    success: true,
    message: "Hello",
    hostname: outcome.hostname,
    action: outcome.action,
    challenge_ts: outcome.challenge_ts
  });
};
