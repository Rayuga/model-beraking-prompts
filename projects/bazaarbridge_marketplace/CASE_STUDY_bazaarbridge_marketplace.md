# Case Study — BazaarBridge Marketplace Operations (Harbor Web Development Evaluation)

**Scores:** Oracle (reference) **100%** · GPT-5.4 mini (high) **58.5%**

---

## 1. What the task is

Build a server-backed, durable multi-vendor marketplace operations application with authenticated Dashboard, Orders, Inventory, and Payouts workspaces; role-scoped writes; live operational metrics; settlement arithmetic; and resilient desktop/mobile interaction.

**Core features asked for**
- Authenticated, server-backed access for Administrator, Operations lead, and Finance manager roles
- Live dashboard metrics, durable order/inventory/payout mutations, and persistent activity history
- Search, filtering, validation, terminal-order handling, and low-stock state transitions
- Per-merchant settlements with commission tiers, processing fees, shipment eligibility, and live recalculation
- Role authority boundaries enforced through the interface and persisted server state
- Light/dark themes, mobile usability, accessible controls, and coherent interaction feedback

---

## 2. What we actually verify

**27 browser criteria carrying 35 weighted points.** Constraints and render are gates; with both passing, reward = 0.6 × functional + 0.4 × polish. Pass counts are unweighted criterion counts.

| Aspect | How it is graded |
|---|---|
| 1 | Four browser-judged segments cover constraints, functional behavior, polish, and rendering. |
| 2 | The 27 criteria carry 35 weighted points; criterion pass counts are unweighted and are not the reward formula. |
| 3 | Constraints and render are gates; when both pass, reward is 60% functional plus 40% polish. |
| 4 | No-op and infrastructure-invalid runs are separated from graded capability failures. |

**Coverage by feature area**

| Feature area | Criteria | Oracle | GPT-5.4 mini (high) |
|---|---:|---:|---:|
| Constraints and application boundary | 2 | 2/2 | 2/2 |
| Core marketplace workflows and policy | 18 | 18/18 | 14/18 |
| Usability, responsiveness, and accessibility | 5 | 5/5 | 2/5 |
| Rendered workspace coverage | 2 | 2/2 | 2/2 |

---

## 3. Where each model landed

### 🥇 Oracle (reference) — 100% (27 / 27)
**Succeeded at:** every listed criterion, with no timeout, unprobed criterion, or judge-infrastructure error.

### 🥈 GPT-5.4 mini (high) — 58.5% (20 / 27)
**Classification:** capability-valid. Graded=true, no_op=false, timeouts=0, unprobed=0, judge infrastructure errors=0.

**Succeeded at:** `authentication_boundary`, `server_backed_local_application`, `authenticated_workspace`, `dashboard_metrics`, `order_status_update`, `inventory_update`, `payout_status_update`, `low_stock_flagging`, `ready_payout_consistency`, `invalid_stock_refusal`, `terminal_returned_status`, `mutation_activity_trail`, `persistence`, `settlement_excludes_unfulfilled`, `payout_authority_boundary`, `operations_authority_boundary`, `interaction_feedback`, `workspace_coherence`, `authenticated_render`, `workspace_rendering`.

**Failed (7 criteria):** `order_search_and_filter`, `settlement_seed_figures`, `settlement_tier_boundary`, `settlement_live_recalculation`, `theme_switching`, `responsive_layout`, `accessible_controls`.

---

## 4. The largest failure cluster

The dominant failure cluster is settlement correctness: three weight-2 criteria failed because displayed merchant amounts were off by roughly two orders of magnitude and did not implement the required tier and live-recalculation arithmetic. This cluster accounts for 6 of the 10 weighted points lost, while search/filter completeness and three polish defects account for the remaining 4.

- **Settlement arithmetic and live recalculation** — Seed figures, the $300 commission boundary, and the shipped-order recalculation all produced materially incorrect merchant amounts.
- **Orders collection controls** — Customer search worked, but the required status-filter control was absent.
- **Theme behavior** — The visible theme control navigated to a 404 route instead of changing presentation.
- **Mobile layout** — Orders and Inventory exceeded the mobile viewport width at approximately 390 px.
- **Accessible control naming** — Landmarks and headings existed, but visible comboboxes and spinbuttons lacked accessible names or labels.

---

## 5. What this tells us

1. GPT-5.4 mini (high) passed 20 of 27 criteria and both gating segments, yielding the recorded 0.585 reward.
2. Settlement correctness is the highest-leverage repair area because its three failures carry 6 weighted points and affect financially material behavior.
3. The remaining failures are discrete UI completeness and polish issues: status filtering, theme switching, mobile overflow, and accessible naming.
4. The criterion definitions and weights match across the two runs, but the recorded task checksums differ; treat the comparison as revision-misaligned descriptive evidence.
5. One rollout per agent is descriptive evidence, not a stable estimate of model capability.
