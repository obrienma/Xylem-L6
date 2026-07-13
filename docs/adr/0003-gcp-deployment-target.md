# ADR 0003 — GCP as Xylem-L6's Deployment Target

**Status:** Proposed
**Date:** 2026-07-13

---

## Context

GCP access was set up recently (a VertexAIDriver for Sentinel-L7, per ADR-0030 there, was the original reason). Two distinct resources are available as a result, and they shouldn't be treated as one bucket:

- **Promotional credits** — temporary, fund anything on GCP while they last, including compute that has no free tier at all.
- **Always Free tier** — permanent, survives after credits run out, but only covers specific services at specific usage ceilings: Pub/Sub (10 GiB/month), Firestore Native mode (1GB storage plus a daily read/write/delete quota), Cloud Run (2M requests/month plus a compute-seconds allowance), one e2-micro Compute Engine instance.

GKE Autopilot sits in neither bucket cleanly. Only the cluster management fee is waived permanently (one cluster per billing account) — the pods themselves are billed continuously for whatever CPU/memory they request, funded by credits until those run out, then real spend.

Every other Rhizome Risk service that's stateless (Sentinel-L7, Synapse-L4, Ledger-L5) is deliberately kept off GKE — Railway/Render already tell that architectural story for a stateless API, and GKE would add nothing. EventHorizon and Rhizome Lens were the two services placed on GKE for a specific reason, decided separately from this ADR: each solves a problem GKE actually addresses — EventHorizon's four independently-scaling worker stages are a textbook case for queue-depth-driven autoscaling (HPA/KEDA), and Rhizome Lens's Prometheus/Loki/Tempo/Grafana stack is one of the most common real-world Helm-chart deployment patterns there is. That decision was explicitly "two, not five" — made on story quality, not on the fact that credits happened to be available to cover more.

Xylem-L6 is a candidate third service, and it needs to clear the same bar those two did, not a lower one earned by "the credits are there." Its case: a single long-running process holding in-memory sliding-window state across events is a shape Cloud Run's scale-to-zero model actively fights, and one a single persistent GKE replica doesn't — the same "does K8s solve a problem this architecture actually has" test EventHorizon and Rhizome Lens passed, applied here on its own terms.

## Decision

Deploy Xylem-L6 to GCP, not Railway, using:

1. **Pub/Sub** as the ingestion transport, replacing or sitting alongside the adapter-level polling described in ADR 0001. This is the architecturally correct choice independent of cost — it's GCP's native streaming primitive and a direct, defensible comparison point to Kafka in an interview context, which a WebSocket or polling loop isn't.
2. **Firestore** for checkpoint state (ADR 0001 Phase 3). Small, cheap, and the right shape for a window checkpoint — no justification for standing up a Postgres instance for this.
3. **GKE**, in the same cluster and namespace pattern already planned for EventHorizon and Rhizome Lens (separate namespace, e.g. `xylem-l6`, sharing the one waived management fee). This makes Xylem-L6 a third deliberate GKE placement, alongside those two — not a default extension of "GKE is already set up" to a service that hasn't independently earned it.

Railway is not used for Xylem-L6. Vertex AI is not used — Xylem-L6 has no LLM step; that stays Sentinel-L7's domain entirely.

## Rationale

The GKE placement decision is worth stating plainly rather than letting it look like scope creep: it's not "GKE is available, so use it everywhere with credits to spare" — it's the same per-service test already applied to EventHorizon and Rhizome Lens, applied a third time. A future reader — or an interviewer looking at the repo — should be able to see that each of the three GKE placements has its own specific justification, not that the cluster became a default destination once it existed.

Pub/Sub over continuing with ad hoc adapter polling is chosen for the same reason SaaS API activity was chosen as the domain in ADR 0001: it's the version of this decision that's actually comparable to a real system a reviewer would recognize, rather than a shortcut that happens to work for a demo.

The credits-vs-free-forever distinction is documented explicitly because it's the kind of thing that's easy to discover the hard way — Pub/Sub and Firestore usage at this project's scale should stay within Always Free indefinitely, but the GKE pod itself does not, and that's a real constraint on what "deployed forever at zero cost" can mean here.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Railway, matching the rest of the suite | Already paid for; one less platform to operate | Doesn't let Amanda say she's deployed to GCP; no reason specific to Xylem-L6 to prefer it over GCP's better-fitting primitives |
| Cloud Run instead of GKE | True Always Free coverage, no credits dependency | Scale-to-zero directly conflicts with holding in-memory window state across requests — the wrong compute model for this specific workload |
| Continue adapter-level polling instead of adopting Pub/Sub | No new service to learn or wire up | Weaker interview comparison than a native pub/sub system; doesn't reuse anything GCP actually offers for this |
| Deploy to both GCP and Railway | Demonstrates portability | No architectural reason to run it twice; adds operational surface for no benefit Xylem-L6 specifically needs |

## Consequences

- Xylem-L6 depends on GCP credits remaining available for GKE pod costs; if credits lapse before this is deployed and demoed, the GKE portion of this decision needs revisiting — Pub/Sub and Firestore usage stays viable under Always Free regardless.
- This is the first Rhizome Risk service placed on GKE for reasons of state rather than infrastructure-sharing convenience. Worth a one-line callout in any deployment write-up so it doesn't read as inconsistent with EventHorizon/Rhizome Lens's shared-cluster rationale.
- No Railway deployment exists for Xylem-L6 unless a specific reason to add one shows up later — matching "wait until it hurts" rather than deploying twice by default.