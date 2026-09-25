def _collapse_rewards(
    flat: dict[str, float],
    by_name: dict[str, list[Reward]],
    specs: list[dict[str, Any]],
) -> dict[str, float]:
    # Each dimension is weighted by its summed reward_weight, then aggregated
    # with the same modes as per-criterion scoring.
    dim_scores = [
        Score(
            name=name,
            value=flat[name],
            raw=flat[name],
            weight=sum(r.reward_weight for r in by_name[name]),
        )
        for name in flat
    ]
    return {
        spec["name"]: round(
            aggregate_scores(
                dim_scores,
                spec.get("aggregation", "weighted_mean"),
                spec.get("threshold", 0.5),
            ),
            4,
        )
        for spec in specs
    }
