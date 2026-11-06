import test from "node:test";
import assert from "node:assert/strict";
import {
    normalizeGitHubRepository,
    verifyRepositoryAdminAccess,
} from "./githubRepositoryAccessService.js";

function mockResponse(status, body, headers = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: name => headers[name.toLowerCase()] ?? null },
        json: async () => body,
    };
}

test("normalizes owner/repository identifiers and GitHub URLs", () => {
    assert.equal(normalizeGitHubRepository("octocat/Hello-World"), "octocat/Hello-World");
    assert.equal(normalizeGitHubRepository("https://github.com/octocat/Hello-World.git"), "octocat/Hello-World");
    assert.equal(normalizeGitHubRepository("github.com/octocat/Hello-World/"), "octocat/Hello-World");
});

test("rejects non-GitHub hosts, extra path segments, and malformed identifiers", () => {
    assert.throws(() => normalizeGitHubRepository("https://evil.example/octocat/repo"));
    assert.throws(() => normalizeGitHubRepository("http://github.com/octocat/repo"));
    assert.throws(() => normalizeGitHubRepository("https://github.com/octocat/repo/issues"));
    assert.throws(() => normalizeGitHubRepository("octocat"));
    assert.throws(() => normalizeGitHubRepository("octocat/../repo"));
});

test("allows registration only when the authenticated user has admin permission", async () => {
    let request;
    const result = await verifyRepositoryAdminAccess("octocat/Hello-World", "user-token", async (url, options) => {
        request = { url, options };
        return mockResponse(200, {
            full_name: "octocat/Hello-World",
            permissions: { admin: true, maintain: true, push: true },
        });
    });

    assert.equal(result.authorized, true);
    assert.equal(result.permission, "admin");
    assert.equal(request.url, "https://api.github.com/repos/octocat/Hello-World");
    assert.equal(request.options.headers.Authorization, "Bearer user-token");
    assert.equal(request.options.headers["X-GitHub-Api-Version"], "2022-11-28");
});

test("rejects users without repository admin permission", async () => {
    const result = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () =>
        mockResponse(200, {
            full_name: "octocat/repo",
            permissions: { admin: false, maintain: true, push: true },
        })
    );
    assert.equal(result.authorized, false);
    assert.equal(result.status, 403);
    assert.equal(result.code, "repository_admin_required");
});

test("does not call GitHub without a user-scoped OAuth token", async () => {
    let called = false;
    const result = await verifyRepositoryAdminAccess("octocat/repo", null, async () => {
        called = true;
        return mockResponse(200, {});
    });
    assert.equal(called, false);
    assert.equal(result.status, 428);
    assert.equal(result.code, "github_reauthorization_required");
});

test("treats inaccessible and missing repositories as unverifiable", async () => {
    const result = await verifyRepositoryAdminAccess("octocat/private-repo", "user-token", async () =>
        mockResponse(404, { message: "Not Found" })
    );
    assert.equal(result.authorized, false);
    assert.equal(result.status, 404);
    assert.equal(result.code, "repository_not_found_or_inaccessible");
});

test("requires the user to reauthorize when the OAuth token is expired", async () => {
    const result = await verifyRepositoryAdminAccess("octocat/repo", "expired-token", async () =>
        mockResponse(401, { message: "Bad credentials" })
    );
    assert.equal(result.status, 401);
    assert.equal(result.code, "github_reauthorization_required");
});

test("distinguishes GitHub rate limits from permission failures", async () => {
    const rateLimited = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () =>
        mockResponse(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "retry-after": "60" })
    );
    assert.equal(rateLimited.status, 429);
    assert.equal(rateLimited.code, "github_rate_limited");
    assert.equal(rateLimited.retryAfter, "60");

    const forbidden = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () =>
        mockResponse(403, { message: "Resource not accessible by integration" })
    );
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.code, "github_permission_check_forbidden");
});

test("handles GitHub server failures and network errors without authorizing", async () => {
    const serverError = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () =>
        mockResponse(503, { message: "Service unavailable" })
    );
    assert.equal(serverError.status, 502);
    assert.equal(serverError.authorized, false);

    const networkError = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () => {
        throw new Error("network down");
    });
    assert.equal(networkError.status, 502);
    assert.equal(networkError.code, "github_unavailable");
});

test("rejects GitHub responses that omit permission details", async () => {
    const result = await verifyRepositoryAdminAccess("octocat/repo", "user-token", async () =>
        mockResponse(200, { full_name: "octocat/repo" })
    );
    assert.equal(result.authorized, false);
    assert.equal(result.code, "github_permission_data_unavailable");
});
