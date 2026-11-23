const GITHUB_API = "https://api.github.com";
const OWNER_OR_REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;

/**
 * Normalize a GitHub repository URL or owner/repository identifier.
 * Reject additional path segments and non-GitHub hosts rather than silently
 * truncating them to a different repository.
 */
export function normalizeGitHubRepository(input) {
    if (typeof input !== "string" || input.trim().length === 0) {
        throw new TypeError("Repository name is required");
    }

    let candidate = input.trim();
    if (/^https?:\/\//i.test(candidate)) {
        let parsed;
        try {
            parsed = new URL(candidate);
        } catch {
            throw new TypeError("Repository URL is invalid");
        }
        if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" ||
            parsed.username || parsed.password || parsed.search || parsed.hash) {
            throw new TypeError("Repository URL must be an HTTPS github.com URL without query parameters");
        }
        candidate = parsed.pathname.replace(/^\/+|\/+$/g, "");
    } else {
        candidate = candidate.replace(/^github\.com\//i, "");
    }

    candidate = candidate.replace(/\/+$/, "").replace(/\.git$/i, "");
    const parts = candidate.split("/");
    if (parts.length !== 2 || !parts.every(part => OWNER_OR_REPO_PATTERN.test(part)) ||
        parts.some(part => part === "." || part === "..")) {
        throw new TypeError("Repository must be provided as owner/repository or a GitHub repository URL");
    }

    return `${parts[0]}/${parts[1]}`;
}

/**
 * Verify that the currently authenticated GitHub user has admin permission
 * on a repository. The OAuth token must belong to the organization user,
 * not to Kinetic's shared server integration.
 */
export async function verifyRepositoryAdminAccess(repository, accessToken, fetchImpl = fetch) {
    if (typeof accessToken !== "string" || accessToken.length === 0) {
        return {
            authorized: false,
            code: "github_reauthorization_required",
            status: 428,
            message: "Reconnect your GitHub account to grant Kinetic repository access before registering or configuring this repository.",
        };
    }

    let normalized;
    try {
        normalized = normalizeGitHubRepository(repository);
    } catch (error) {
        return {
            authorized: false,
            code: "invalid_repository",
            status: 400,
            message: error.message,
        };
    }

    const [owner, name] = normalized.split("/");
    let response;
    try {
        response = await fetchImpl(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/vnd.github+json",
                    Authorization: `Bearer ${accessToken}`,
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Kinetic-App",
                },
            }
        );
    } catch {
        return {
            authorized: false,
            code: "github_unavailable",
            status: 502,
            message: "GitHub could not be reached to verify repository permissions. Please retry.",
        };
    }

    if (response.status === 401) {
        return {
            authorized: false,
            code: "github_reauthorization_required",
            status: 401,
            message: "Your GitHub authorization has expired or been revoked. Reconnect GitHub and try again.",
        };
    }

    if (response.status === 404) {
        return {
            authorized: false,
            code: "repository_not_found_or_inaccessible",
            status: 404,
            message: "GitHub could not find this repository or your account does not have access to it.",
        };
    }

    if (response.status === 403 || response.status === 429) {
        const remaining = response.headers?.get?.("x-ratelimit-remaining");
        const retryAfter = response.headers?.get?.("retry-after");
        const rateLimited = response.status === 429 || remaining === "0" || Boolean(retryAfter);
        return {
            authorized: false,
            code: rateLimited ? "github_rate_limited" : "github_permission_check_forbidden",
            status: rateLimited ? 429 : 403,
            retryAfter: retryAfter || undefined,
            message: rateLimited
                ? "GitHub rate limit reached while checking repository permissions. Please retry later."
                : "GitHub did not allow Kinetic to inspect this repository's permissions. Reconnect GitHub or review the OAuth repository scope.",
        };
    }

    if (!response.ok) {
        return {
            authorized: false,
            code: "github_api_error",
            status: 502,
            message: `GitHub returned an unexpected response while checking repository permissions (HTTP ${response.status}).`,
        };
    }

    let data;
    try {
        data = await response.json();
    } catch {
        return {
            authorized: false,
            code: "github_invalid_response",
            status: 502,
            message: "GitHub returned an invalid repository response.",
        };
    }

    if (!data || typeof data.full_name !== "string" || !data.permissions ||
        typeof data.permissions.admin !== "boolean") {
        return {
            authorized: false,
            code: "github_permission_data_unavailable",
            status: 502,
            message: "GitHub did not return the permission details required to verify repository administration access.",
        };
    }

    if (data.permissions.admin !== true) {
        return {
            authorized: false,
            code: "repository_admin_required",
            status: 403,
            repository: data.full_name,
            message: "You must have GitHub administrator access to this repository before registering or changing its Kinetic configuration.",
        };
    }

    return {
        authorized: true,
        code: "repository_admin_verified",
        repository: data.full_name,
        permission: "admin",
    };
}
