/**
 * API Input Validation Middleware and Helpers
 *
 * Enforces strict validation across API inputs (usernames, repository identifiers,
 * wallet addresses, weights, amounts, and request payloads) without leaking
 * internal implementation details or stack traces.
 */

// GitHub username: 1-39 alphanumeric chars or single hyphens; cannot start or end with hyphen; no consecutive hyphens
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// GitHub repository name: 1-100 characters: alphanumeric, dots, hyphens, underscores
const GITHUB_REPO_NAME_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

// Flow blockchain address: '0x' followed by 16 hex characters (8 bytes)
const FLOW_ADDRESS_REGEX = /^0x[0-9a-fA-F]{16}$/;

// Allowed keys for repository scoring weights
const ALLOWED_WEIGHT_KEYS = ['impact', 'complexity', 'quality', 'review', 'priority'];

/**
 * Standardized validation error response.
 * Returns HTTP 400 Bad Request with an array of field errors.
 */
export function sendValidationError(res, details) {
    const errorDetails = Array.isArray(details) ? details : [details];
    return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: errorDetails
    });
}

/**
 * Validates a GitHub username.
 * @param {any} username
 * @returns {boolean}
 */
export function isValidGithubUsername(username) {
    if (typeof username !== 'string') return false;
    const trimmed = username.trim();
    if (trimmed.length === 0 || trimmed.length > 39) return false;
    return GITHUB_USERNAME_REGEX.test(trimmed);
}

/**
 * Normalizes a repository identifier string to "owner/repo".
 * Strips URLs, protocols, domains, trailing .git, and slashes.
 * @param {string} input
 * @returns {string}
 */
export function normalizeRepoName(input) {
    if (typeof input !== 'string') return '';
    let cleaned = input.trim();
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    cleaned = cleaned.replace(/^github\.com\//i, '');
    cleaned = cleaned.replace(/\.git$/i, '');
    cleaned = cleaned.replace(/\/+$/, '');
    cleaned = cleaned.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length !== 2) return cleaned;
    return `${parts[0]}/${parts[1]}`;
}

/**
 * Validates whether an input represents a valid GitHub repository identifier (owner/repo).
 * @param {any} repoInput
 * @returns {boolean}
 */
export function isValidRepoIdentifier(repoInput) {
    if (typeof repoInput !== 'string') return false;
    let cleaned = repoInput.trim();
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    cleaned = cleaned.replace(/^github\.com\//i, '');
    cleaned = cleaned.replace(/\.git$/i, '');
    cleaned = cleaned.replace(/\/+$/, '');
    cleaned = cleaned.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length !== 2) return false;

    const [owner, repo] = parts;
    if (!isValidGithubUsername(owner)) return false;
    if (!GITHUB_REPO_NAME_REGEX.test(repo)) return false;
    if (repo === '.' || repo === '..') return false;

    return true;
}

/**
 * Validates a Flow blockchain wallet address.
 * Flow addresses are 8-byte hexadecimal strings prefixed with 0x (18 chars total).
 * @param {any} address
 * @returns {boolean}
 */
export function isValidFlowAddress(address) {
    if (typeof address !== 'string') return false;
    return FLOW_ADDRESS_REGEX.test(address.trim());
}

/**
 * Validates a Git branch name.
 * @param {any} branch
 * @returns {boolean}
 */
export function isValidBranchName(branch) {
    if (typeof branch !== 'string') return false;
    const trimmed = branch.trim();
    if (trimmed.length === 0 || trimmed.length > 255) return false;
    // Reject illegal Git branch characters and patterns
    if (/[\x00-\x20\x7F~^:?*\[\\]/.test(trimmed)) return false;
    if (trimmed.includes('..') || trimmed.includes('@{')) return false;
    if (trimmed.startsWith('/') || trimmed.endsWith('/') || trimmed.endsWith('.')) return false;
    return true;
}

/**
 * Validates a numeric weight value between 0.0 and 1.0 inclusive.
 * @param {any} weight
 * @returns {boolean}
 */
export function isValidWeightValue(weight) {
    return typeof weight === 'number' && Number.isFinite(weight) && weight >= 0 && weight <= 1;
}

/**
 * Validates a monetary or pool amount.
 * @param {any} amount
 * @param {object} [options]
 * @param {boolean} [options.allowZero=false]
 * @returns {boolean}
 */
export function isValidAmount(amount, { allowZero = false } = {}) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return false;
    return allowZero ? amount >= 0 : amount > 0;
}

// ─────────────────────────────────────────────────────────────
// Express Middleware
// ─────────────────────────────────────────────────────────────

/**
 * Middleware: Validates a GitHub username in req.params.
 * Used on GET /api/auth/did/:username and GET /api/contribution/score/:username
 */
export function validateGithubUsernameParam(paramName = 'username') {
    return (req, res, next) => {
        const username = req.params[paramName];
        if (!username || !isValidGithubUsername(username)) {
            return sendValidationError(res, {
                field: paramName,
                message: `Invalid username '${username}'. GitHub usernames must be 1-39 alphanumeric characters, may contain single hyphens, and cannot start or end with a hyphen.`
            });
        }
        next();
    };
}

/**
 * Middleware: Validates Flow wallet in req.body.
 * Used on PUT /api/auth/wallet
 */
export function validateFlowWallet(req, res, next) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return sendValidationError(res, {
            field: 'body',
            message: 'Request payload must be a JSON object.'
        });
    }

    const { wallet } = req.body;
    if (!wallet) {
        return sendValidationError(res, {
            field: 'wallet',
            message: 'Wallet address is required.'
        });
    }

    if (!isValidFlowAddress(wallet)) {
        return sendValidationError(res, {
            field: 'wallet',
            message: "Invalid Flow wallet address. Expected format: '0x' followed by 16 hexadecimal characters (e.g., 0x01cf0e2f2f715450)."
        });
    }

    const unknownKeys = Object.keys(req.body).filter(k => k !== 'wallet');
    if (unknownKeys.length > 0) {
        return sendValidationError(res, {
            field: 'body',
            message: `Unexpected field(s): ${unknownKeys.join(', ')}. Only 'wallet' is allowed.`
        });
    }

    next();
}

/**
 * Middleware: Validates comma-separated users in req.query.users.
 * Used on GET /api/contribution/compare?users=user1,user2
 */
export function validateCompareUsers(req, res, next) {
    const usersParam = req.query.users;
    if (!usersParam || typeof usersParam !== 'string' || usersParam.trim().length === 0) {
        return sendValidationError(res, {
            field: 'users',
            message: "Query parameter 'users' is required (comma-separated list of GitHub usernames, e.g. ?users=torvalds,gaearon)."
        });
    }

    const rawUsers = usersParam.split(',').map(u => u.trim()).filter(Boolean);
    if (rawUsers.length === 0) {
        return sendValidationError(res, {
            field: 'users',
            message: "Query parameter 'users' must contain at least one valid username."
        });
    }

    if (rawUsers.length > 5) {
        return sendValidationError(res, {
            field: 'users',
            message: 'Cannot compare more than 5 users at once.'
        });
    }

    const invalidUsers = rawUsers.filter(u => !isValidGithubUsername(u));
    if (invalidUsers.length > 0) {
        return sendValidationError(res, {
            field: 'users',
            message: `Invalid GitHub username(s): ${invalidUsers.join(', ')}.`
        });
    }

    req.validatedUsers = rawUsers;
    next();
}

/**
 * Middleware: Validates repository creation payload.
 * Used on POST /api/org/repositories
 */
export function validateAddRepository(req, res, next) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return sendValidationError(res, {
            field: 'body',
            message: 'Request payload must be a JSON object.'
        });
    }

    const { repository } = req.body;

    if (!repository || typeof repository !== 'string' || repository.trim().length === 0) {
        return sendValidationError(res, {
            field: 'repository',
            message: 'Repository identifier is required.'
        });
    }

    if (!isValidRepoIdentifier(repository)) {
        return sendValidationError(res, {
            field: 'repository',
            message: "Invalid repository identifier. Expected 'owner/repo' or a valid GitHub URL."
        });
    }

    const unknownKeys = Object.keys(req.body).filter(k => k !== 'repository');
    if (unknownKeys.length > 0) {
        return sendValidationError(res, {
            field: 'body',
            message: `Unexpected field(s): ${unknownKeys.join(', ')}. Only 'repository' is allowed.`
        });
    }

    req.normalizedRepo = normalizeRepoName(repository);
    next();
}

/**
 * Middleware: Validates repository param in req.params.
 * Used on GET/PUT /api/org/repositories/:repoId/branches and PUT /api/org/repositories/:repoId/config
 */
export function validateRepoIdParam(paramName = 'repoId') {
    return (req, res, next) => {
        const rawRepoId = req.params[paramName];
        if (!rawRepoId || typeof rawRepoId !== 'string') {
            return sendValidationError(res, {
                field: paramName,
                message: 'Repository parameter is required.'
            });
        }

        let decoded;
        try {
            decoded = decodeURIComponent(rawRepoId);
        } catch {
            return sendValidationError(res, {
                field: paramName,
                message: 'Malformed URI encoding in repository parameter.'
            });
        }

        if (!isValidRepoIdentifier(decoded)) {
            return sendValidationError(res, {
                field: paramName,
                message: `Invalid repository parameter '${decoded}'. Expected 'owner/repo'.`
            });
        }

        req.normalizedRepoId = normalizeRepoName(decoded);
        next();
    };
}

/**
 * Middleware: Validates branch update payload.
 * Used on PUT /api/org/repositories/:repoId/branches
 */
export function validateUpdateBranches(req, res, next) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return sendValidationError(res, {
            field: 'body',
            message: 'Request payload must be a JSON object.'
        });
    }

    const { targetBranches } = req.body;

    if (!Array.isArray(targetBranches) || targetBranches.length === 0) {
        return sendValidationError(res, {
            field: 'targetBranches',
            message: "'targetBranches' must be a non-empty array of branch name strings."
        });
    }

    const invalidBranches = targetBranches.filter(b => !isValidBranchName(b));
    if (invalidBranches.length > 0) {
        return sendValidationError(res, {
            field: 'targetBranches',
            message: `Invalid branch name(s): ${invalidBranches.join(', ')}.`
        });
    }

    const unknownKeys = Object.keys(req.body).filter(k => k !== 'targetBranches');
    if (unknownKeys.length > 0) {
        return sendValidationError(res, {
            field: 'body',
            message: `Unexpected field(s): ${unknownKeys.join(', ')}. Only 'targetBranches' is allowed.`
        });
    }

    next();
}

/**
 * Middleware: Validates repository configuration payload.
 * Used on PUT /api/org/repositories/:repoId/config
 */
export function validateRepoConfig(req, res, next) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return sendValidationError(res, {
            field: 'body',
            message: 'Request payload must be a JSON object.'
        });
    }

    const { targetBranches, weights, bountyPool } = req.body;
    const errors = [];

    // Reject completely empty payload
    if (targetBranches === undefined && weights === undefined && bountyPool === undefined) {
        return sendValidationError(res, {
            field: 'body',
            message: "At least one of 'targetBranches', 'weights', or 'bountyPool' must be provided."
        });
    }

    // Reject unknown root fields
    const allowedRootKeys = ['targetBranches', 'weights', 'bountyPool'];
    const unknownKeys = Object.keys(req.body).filter(k => !allowedRootKeys.includes(k));
    if (unknownKeys.length > 0) {
        errors.push({
            field: 'body',
            message: `Unexpected field(s): ${unknownKeys.join(', ')}. Allowed fields are: ${allowedRootKeys.join(', ')}.`
        });
    }

    // Validate targetBranches if provided
    if (targetBranches !== undefined) {
        if (!Array.isArray(targetBranches) || targetBranches.length === 0) {
            errors.push({
                field: 'targetBranches',
                message: "'targetBranches' must be a non-empty array of branch name strings."
            });
        } else {
            const invalidBranches = targetBranches.filter(b => !isValidBranchName(b));
            if (invalidBranches.length > 0) {
                errors.push({
                    field: 'targetBranches',
                    message: `Invalid branch name(s): ${invalidBranches.join(', ')}.`
                });
            }
        }
    }

    // Validate weights if provided
    if (weights !== undefined) {
        if (typeof weights !== 'object' || weights === null || Array.isArray(weights)) {
            errors.push({
                field: 'weights',
                message: "'weights' must be an object with numeric values between 0.0 and 1.0."
            });
        } else {
            const weightKeys = Object.keys(weights);
            if (weightKeys.length === 0) {
                errors.push({
                    field: 'weights',
                    message: "'weights' object cannot be empty if specified."
                });
            }

            const unexpectedWeightKeys = weightKeys.filter(k => !ALLOWED_WEIGHT_KEYS.includes(k));
            if (unexpectedWeightKeys.length > 0) {
                errors.push({
                    field: 'weights',
                    message: `Unexpected weight property: ${unexpectedWeightKeys.join(', ')}. Allowed: ${ALLOWED_WEIGHT_KEYS.join(', ')}.`
                });
            }

            for (const key of weightKeys) {
                if (ALLOWED_WEIGHT_KEYS.includes(key)) {
                    if (!isValidWeightValue(weights[key])) {
                        errors.push({
                            field: `weights.${key}`,
                            message: `Weight '${key}' must be a finite number between 0.0 and 1.0.`
                        });
                    }
                }
            }
        }
    }

    // Validate bountyPool if provided
    if (bountyPool !== undefined) {
        if (!isValidAmount(bountyPool, { allowZero: true })) {
            errors.push({
                field: 'bountyPool',
                message: "'bountyPool' must be a non-negative finite number (>= 0)."
            });
        }
    }

    if (errors.length > 0) {
        return sendValidationError(res, errors);
    }

    next();
}

/**
 * Middleware: Validates proof-of-build query parameters.
 * Used on GET /api/kinetic/proof-of-build?repo=owner/repo&runId=123
 */
export function validateProofOfBuild(req, res, next) {
    const { repo, runId, sha, pr } = req.query;
    const errors = [];

    if (!repo || typeof repo !== 'string' || repo.trim().length === 0) {
        errors.push({
            field: 'repo',
            message: "Query parameter 'repo' (owner/repo) is required."
        });
    } else if (!isValidRepoIdentifier(repo)) {
        errors.push({
            field: 'repo',
            message: "Invalid 'repo' parameter. Expected format: 'owner/repo'."
        });
    }

    if (!runId || typeof runId !== 'string' || runId.trim().length === 0) {
        errors.push({
            field: 'runId',
            message: "Query parameter 'runId' is required."
        });
    } else if (!/^\d+$/.test(runId.trim())) {
        errors.push({
            field: 'runId',
            message: "'runId' must be a positive integer."
        });
    }

    if (sha !== undefined && (typeof sha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(sha.trim()))) {
        errors.push({
            field: 'sha',
            message: "'sha' must be a commit SHA of 7-40 hexadecimal characters."
        });
    }

    if (pr !== undefined && (typeof pr !== 'string' || !/^[1-9]\d*$/.test(pr.trim()))) {
        errors.push({
            field: 'pr',
            message: "'pr' must be a positive integer pull request number."
        });
    }

    if (errors.length > 0) {
        return sendValidationError(res, errors);
    }

    req.normalizedRepo = normalizeRepoName(repo);
    if (sha !== undefined) req.expectedSha = sha.trim().toLowerCase();
    if (pr !== undefined) req.prNumber = Number(pr.trim());
    next();
}

/**
 * Middleware: Validates quadratic funding request payload.
 * Used on POST /api/kinetic/quadratic-funding
 */
export function validateQuadraticFunding(req, res, next) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return sendValidationError(res, {
            field: 'body',
            message: 'Request payload must be a JSON object.'
        });
    }

    const { poolAmount, projects } = req.body;
    const errors = [];

    // Reject unknown root fields
    const allowedRootKeys = ['poolAmount', 'projects'];
    const unknownKeys = Object.keys(req.body).filter(k => !allowedRootKeys.includes(k));
    if (unknownKeys.length > 0) {
        errors.push({
            field: 'body',
            message: `Unexpected field(s): ${unknownKeys.join(', ')}. Allowed fields are: ${allowedRootKeys.join(', ')}.`
        });
    }

    // Validate poolAmount
    if (poolAmount === undefined || poolAmount === null) {
        errors.push({
            field: 'poolAmount',
            message: "Field 'poolAmount' is required."
        });
    } else if (!isValidAmount(poolAmount, { allowZero: false })) {
        errors.push({
            field: 'poolAmount',
            message: "'poolAmount' must be a strictly positive finite number (> 0)."
        });
    }

    // Validate projects
    if (!projects) {
        errors.push({
            field: 'projects',
            message: "Field 'projects' is required."
        });
    } else if (!Array.isArray(projects)) {
        errors.push({
            field: 'projects',
            message: "'projects' must be an array."
        });
    } else if (projects.length === 0) {
        errors.push({
            field: 'projects',
            message: "'projects' array cannot be empty."
        });
    } else {
        projects.forEach((proj, pIdx) => {
            if (!proj || typeof proj !== 'object' || Array.isArray(proj)) {
                errors.push({
                    field: `projects[${pIdx}]`,
                    message: `Project at index ${pIdx} must be an object.`
                });
                return;
            }

            if (!proj.name || typeof proj.name !== 'string' || proj.name.trim().length === 0) {
                errors.push({
                    field: `projects[${pIdx}].name`,
                    message: `Project at index ${pIdx} must have a non-empty string 'name'.`
                });
            }

            if (!proj.voters) {
                errors.push({
                    field: `projects[${pIdx}].voters`,
                    message: `Project at index ${pIdx} must have a 'voters' array.`
                });
            } else if (!Array.isArray(proj.voters)) {
                errors.push({
                    field: `projects[${pIdx}].voters`,
                    message: `'voters' for project at index ${pIdx} must be an array.`
                });
            } else {
                proj.voters.forEach((voter, vIdx) => {
                    if (!voter || typeof voter !== 'object' || Array.isArray(voter)) {
                        errors.push({
                            field: `projects[${pIdx}].voters[${vIdx}]`,
                            message: `Voter at index ${vIdx} of project ${pIdx} must be an object.`
                        });
                        return;
                    }

                    if (voter.mstsScore === undefined || voter.mstsScore === null) {
                        errors.push({
                            field: `projects[${pIdx}].voters[${vIdx}].mstsScore`,
                            message: `Voter at index ${vIdx} of project ${pIdx} requires 'mstsScore'.`
                        });
                    } else if (
                        typeof voter.mstsScore !== 'number' ||
                        !Number.isFinite(voter.mstsScore) ||
                        voter.mstsScore < 0
                    ) {
                        errors.push({
                            field: `projects[${pIdx}].voters[${vIdx}].mstsScore`,
                            message: `'mstsScore' for voter at index ${vIdx} of project ${pIdx} must be a non-negative finite number (>= 0).`
                        });
                    }
                });
            }
        });
    }

    if (errors.length > 0) {
        return sendValidationError(res, errors);
    }

    next();
}

