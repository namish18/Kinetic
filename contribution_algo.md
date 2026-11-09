

---

# FINAL ALGORITHM

## Step 0: Inputs


For each PR *i*:

* impactᵢ ∈ [0,1]
* complexityᵢ ∈ [0,1] *(log-scaled)*
* qualityᵢ ∈ [0,1]
* reviewᵢ ∈ [0,1]
* priorityᵢ ∈ [0,1]
* contributor reputation Rᵢ

Global:

* Repository-specific weights for impact, complexity, quality, review, and priority.
* Reputation influence constant: λ = 0.5.
* Maximum PR complexity input: 10,000 changed lines.

---

## Step 1: Anti-Gaming Filters

### 1.1 Minimum Quality Threshold

```
if qualityᵢ < 0.3 OR reviewᵢ < 0.3:
    discard PR (score = 0)
```

### 1.2 Spam / Micro PR Filter

```
if impactᵢ < 0.2 AND complexityᵢ < 0.2:
    discard PR
```

---

## Step 2: Base Score

```
Baseᵢ =
  w₁*impactᵢ +
  w₂*complexityᵢ +
  w₃*qualityᵢ +
  w₄*reviewᵢ +
  w₅*priorityᵢ
```
---

## Step 3: Complexity Anti-Gaming (Already Applied)

Ensure:

```
complexity = min(1, log(additions + deletions + 1) / log(10001))
```

Prevents artificially large PRs

---

## Step 4: Reputation System

### 4.1 Compute Raw Reputation

```
Rᵢ =
  α*(accepted_PRs) +
  β*(avg_review_score) +
  γ*(historical_impact) +
  δ*(consistency)
```
Default reputation weights (configurable through environment variables):

- α (accepted PRs) = 10
- β (average review score) = 25
- γ (historical impact) = 30
- δ (consistency) = 20

The reputation calculation uses these weights unless custom weights are supplied.

### Consistency Score Calculation

- No eligible PRs: consistency = 0.
- One eligible PR: consistency = 0.5.
- Otherwise, consistency is calculated using the number of unique active calendar weeks:

  `consistency = min(1.0, max(0.2, unique_active_weeks / 5))`

The calculation uses PR merge timestamps, falling back to update timestamps when necessary.
---

### 4.2 Normalize Reputation

R_norm = max(0, log(R + 1) / log(501))

---

### 4.3 Reputation Multiplier (Capped)

RepMult = min(1.5, 1 + 0.5 * min(1, R_norm))

The multiplier is capped at 1.5 to limit the influence of historical reputation.

---

## Step 5: PR Metric Calculation

The scoring service extracts five metrics from each pull request:

| Metric | Implementation |
|---|---|
| Impact | `min(1, ((changed_files * 2) + commits) / 50)` |
| Complexity | Logarithmic scaling of additions and deletions, capped at 1 |
| Quality | Starts at 0.8; adds 0.1 if deletions exceed additions and 0.1 if the PR is merged; capped at 1 |
| Review | `min(1, (review_comments / 10) + 0.5)` |
| Priority | 1.0 if a label contains priority, high, critical, or urgent; otherwise 0.4 |


## Step 6: Final Score

```
Final PR Score =
  round(Base Score × Reputation Multiplier × Spam Penalty, 4)
```

### Spam Penalty

When PR timestamp history is provided:

- If there is at most one timestamp, the penalty is 1.0.
- For multiple timestamps, the base penalty is:

  `1 / (1 + 0.1 * (k - 1))`

- If the two most recent PR submissions are less than 10 minutes apart, an additional 20% penalty is applied.
- The penalty is rounded to four decimal places.

If timestamp history is not provided, the scoring function uses a neutral penalty of 1.0.

## Step 7: Organization Contributor Score

The organization scoring service calculates contributor scores using
their eligible merged PRs and repository-specific weights.

- Each PR score is scaled by 20 to calculate contribution points.
- Contributor points are accumulated across eligible PRs.
- The final contributor score is capped at 100.

## Step 8: Payout Calculation

The implementation supports two payout paths:

### 8.1 PR Webhook Payout

- Calculates payout using the individual PR score.
- 1 score point corresponds to 0.1 FLOW.
- Maximum payout is capped at 10 FLOW per PR.

### 8.2 Organization Payout

- Calculates payout using the contributor's organization score.
- Payout = Contributor Total Score × 5 FLOW.
- If the contributor has no linked wallet, the payout is marked as pending.

These scoring-related payout calculations are separate and do not use
proportional distribution of a shared bounty pool.

---

# EXPLANATION (WHY THIS WORKS)

---

## 1. Fairness via Base Score

The base score combines five repository-configurable metrics:

- Impact
- Complexity
- Quality
- Review
- Priority

Each metric contributes according to its configured repository weight.

---

## 2. Anti-Gaming Protection

| Attack | Defense |
|---|---|
| Very large PRs | Logarithmic complexity scaling |
| Spam or micro PRs | Minimum impact and complexity thresholds, plus timestamp-based submission penalties |
| Low-quality PRs | Quality and review score cutoffs |
---

## 3. Reputation (Long-Term Incentive)

- Reputation combines accepted PR count, average review score, historical impact, and consistency.
- Logarithmic normalization limits the influence of high reputation values.
- The reputation multiplier is capped at 1.5.
- Contributors without historical reputation receive no reputation boost.

---

## 4. Stability of System

Because:

```
Final PR Score = Base Score × Reputation Multiplier × Spam Penalty
```

You get:

* Objective fairness (metrics)
* Long-term incentives (reputation)

---

## 5. Payout Calculation

Payouts are calculated using two separate mechanisms:

- PR webhook payouts are based on individual PR scores, with a maximum of 10 FLOW per PR.
- Organization payouts are based on contributor scores, at 5 FLOW per point.

The implementation does not guarantee that total payouts equal a predefined bounty pool.

---

contributors and organizations will login with their github
the contributor will add their repos, they can define the weights for each repos based on it the bounty payout will be calculated/