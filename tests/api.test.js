"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../netlify/functions/api");

test("health reports missing Supabase configuration without exposing secrets", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const result = await handler({
      httpMethod: "GET",
      queryStringParameters: { action: "health" }
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { configured: false });
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  }
});

test("protected API actions require a configured backend", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const result = await handler({
      httpMethod: "GET",
      queryStringParameters: { action: "bootstrap" },
      headers: {}
    });
    assert.equal(result.statusCode, 503);
    assert.match(JSON.parse(result.body).error, /not configured/i);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  }
});

test("malformed JSON is rejected with a client error", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  try {
    const result = await handler({
      httpMethod: "POST",
      queryStringParameters: { action: "auth.login" },
      body: "{",
      headers: {}
    });
    assert.equal(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /valid JSON/i);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
  }
});

test("unsupported API methods are rejected", async () => {
  const result = await handler({ httpMethod: "PUT", queryStringParameters: {} });
  assert.equal(result.statusCode, 405);
});

test("protected API actions reject unsigned requests", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-key";
  try {
    const result = await handler({
      httpMethod: "GET",
      queryStringParameters: { action: "bootstrap" },
      headers: {}
    });
    assert.equal(result.statusCode, 401);
    assert.match(JSON.parse(result.body).error, /sign in/i);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  }
});

test("sign-up validates password length before contacting Supabase", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const previousFetch = global.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-key";
  global.fetch = async () => {
    throw new Error("Supabase should not be called for invalid input.");
  };
  try {
    const result = await handler({
      httpMethod: "POST",
      queryStringParameters: { action: "auth.signup" },
      body: JSON.stringify({
        email: "member@example.com",
        password: "short",
        display_name: "Member"
      }),
      headers: {}
    });
    assert.equal(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /between 10 and 128 characters/i);
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  }
});
