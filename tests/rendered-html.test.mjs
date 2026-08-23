import assert from "node:assert/strict";
import test from "node:test";

test("renders production metadata and an unverified real-data state", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>TQQQ Signal Lab<\/title>/i);
  assert.match(html, /REAL DATA REQUIRED/);
  assert.match(html, /初期画面に合成成績は表示しません/);
  assert.doesNotMatch(html, /codex-preview/);
});
