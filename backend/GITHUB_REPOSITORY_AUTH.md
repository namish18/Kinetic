# GitHub Repository Authorization

Kinetic verifies repository administration using the GitHub OAuth identity of the organization account that is registering or configuring a repository. It does not use the shared `GITHUB_PAT` for this authorization decision.

## Required environment configuration

Set a strong encryption key on the backend:

```bash
GITHUB_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

Use the same key across all backend instances. Keep it in the deployment secret manager; do not commit it to the repository or expose it to the frontend. Changing this key makes previously stored OAuth tokens unreadable, so users must reconnect GitHub.

The default OAuth scopes are:

```text
user:email,public_repo
```

This is suitable for public repositories. If the deployment intentionally supports private repositories, configure the OAuth application to request the `repo` scope as well:

```text
GITHUB_OAUTH_SCOPES=user:email,repo
```

The `repo` scope is broader than `public_repo`; use it only when private-repository support is required. Existing users must reconnect GitHub after changing OAuth scopes so that the new authorization is issued and encrypted for their account.

## Authorization behavior

- A registered repository must be returned by GitHub for the authenticated organization user's OAuth token.
- The GitHub repository response must include `permissions.admin === true`.
- `maintain`, `push`, or read access alone is not sufficient to register or change repository configuration.
- The same check is applied when changing target branches and repository configuration.
- A missing per-user token, expired token, missing scope, inaccessible repository, rate limit, or GitHub outage fails closed. No repository write proceeds when permission cannot be verified.
- OAuth tokens are stored only as versioned AES-256-GCM ciphertext in `githubAccessTokenEncrypted`, a MongoDB field excluded from normal queries by default. Raw tokens are never returned by API responses.

## Existing account migration

Existing accounts do not have a stored per-user OAuth token. They must sign in through GitHub again after deploying this change. The callback refreshes the encrypted token for both new and existing accounts.

## API failure responses

The repository write endpoints return a structured `code` alongside the error:

- `github_reauthorization_required`: reconnect GitHub.
- `repository_not_found_or_inaccessible`: the repository is missing or not accessible to the authenticated account.
- `repository_admin_required`: the account can see the repository but does not have admin permission.
- `github_rate_limited`: retry after GitHub's rate limit window.
- `github_unavailable`: GitHub could not be reached.
- `github_token_encryption_not_configured`: the backend encryption key is missing.

The registration and configuration endpoints are intentionally fail-closed.
