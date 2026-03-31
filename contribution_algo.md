

---

# FINAL ALGORITHM

## Step -1: Verification Gate (Proof-of-Build)

Before any PR is processed by the scoring engine, it must pass the **Proof-of-Build** verification.

1. **Query GitHub Actions API**: Fetch all workflow runs associated with the PR's head commit.
2. **Success Requirement**: At least one CI/CD run must have a `conclusion` of `success`.
3. **Failure Policy**: If no successful build trace is found, `FinalScore = 0`. No further calculations are performed.

---

## Step 0: Inputs


For each PR *i*:

* impactᵢ ∈ [0,1]
* complexityᵢ ∈ [0,1] *(log-scaled)*
* qualityᵢ ∈ [0,1]
* reviewᵢ ∈ [0,1]
* priorityᵢ ∈ [0,1]
* contributor reputation Rᵢ
Global:

* bounty_pool = B
* weights: w₁…w₅
* λ = reputation influence (≤ 0.5)

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
complexityᵢ = log(lines_changed + 1) / log(max_lines + 1)
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

---

### 4.2 Normalize Reputation (Anti-Elitism)

```
R_normᵢ = log(Rᵢ + 1) / log(R_max + 1)
```

---

### 4.3 Reputation Multiplier (Capped)

```
RepMultᵢ = 1 + λ * R_normᵢ

RepMultᵢ = min(1.5, RepMultᵢ)
```

Prevents dominance by top contributors

---

## Step 6: Final Score

```
Finalᵢ =
  Baseᵢ
  × RepMultᵢ
```

---

## Step 7: Anti-Gaming Post Adjustments

### 7.1 Diminishing Returns for Same Contributor

Let contributor has k PRs in period:

```
Penalty_factor = 1 / (1 + 0.1*(k-1))

Finalᵢ = Finalᵢ × Penalty_factor
```

Prevents PR spamming

---

### 7.2 Duplicate / Similar PR Handling

If PR overlaps significantly:

```
split reward among similar PRs
```

---

### 7.3 Revert / Failure Penalty

```
if PR reverted:
    Finalᵢ = 0
    reputation -= penalty
```

---

## Step 8: Normalize Scores

```
Total = Σ Finalᵢ
```

---

## Step 9: Reward Distribution

```
Payoutᵢ = (Finalᵢ / Total) × B
```

---

# EXPLANATION (WHY THIS WORKS)

---

## 1. Fairness via Base Score

The base score ensures:

* High impact > low effort fixes
* Good code > large code
* Maintainer review matters

---

## 2. Anti-Gaming Protection

| Attack          | Defense                         |
| --------------- | ------------------------------- |
| Huge useless PR | log complexity                  |
| Spam PRs        | threshold + diminishing returns |
| Low quality PRs | hard cutoff                     |
| Duplicate work  | reward splitting                |

---

## 3. Reputation (Long-Term Incentive)

* Good contributors earn **up to 1.5× boost**
* Log normalization prevents runaway advantage
* New contributors still competitive

---

---

## 5. Anti-Elitism Guarantees

* Reputation capped
* Log scaling reduces gap
* New contributors not excluded

---

## 6. Stability of System

Because:

```
Final Score = Objective × History
```

You get:

* Objective fairness (metrics)
* Long-term incentives (reputation)

---

## 7. Economic Soundness

```
Σ payouts = bounty_pool
```

Always:

* No overspending
* Fully distributed
* Incentive aligned

---

contributors and organizations will login with their guthub
the contributor will add their repos, they can define the weights for each repos based on it the bounty payout will be calculated/