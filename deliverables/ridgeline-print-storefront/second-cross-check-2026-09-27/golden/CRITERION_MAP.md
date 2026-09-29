# Ridgeline second cross-check: all 37 criteria

All application files match the prior final archive; old evidence is reused explicitly and hashed in `CRITERION_EVIDENCE.json`. New observations are supplemental unless the table identifies the newly strengthened exact route or filter leg. No hosted Oracle run.

| Dimension | Criterion | Prior exact evidence | Fresh supplement |
| --- | --- | --- | --- |
| gates/render | `populated_public_shop_loads` | `gate-address/gate-address-browser-results.json`, `presentation/browser-criteria-results.json` | fresh_gate_order_and_clean_context_lookup |
| gates/constraints | `application_health_and_server_data` | `gate-address/gate-address-browser-results.json` | fresh_gate_order_and_clean_context_lookup |
| scored/functional | `ridgeline_catalogue_cards_and_variant_details` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `ridgeline_catalogue_title_search` | `mcp/catalogue-controls-mcp-results.json` | combined_discovery_empty_reset_and_native_sort |
| scored/functional | `ridgeline_catalogue_size_filter` | `mcp/catalogue-controls-mcp-results.json` | combined_discovery_empty_reset_and_native_sort |
| scored/functional | `ridgeline_catalogue_paper_filter` | `mcp/catalogue-controls-mcp-results.json` | combined_discovery_empty_reset_and_native_sort |
| scored/functional | `ridgeline_catalogue_regular_price_ordering` | `mcp/catalogue-controls-mcp-results.json` | combined_discovery_empty_reset_and_native_sort |
| scored/functional | `ridgeline_catalogue_alphabetical_title_ordering` | `mcp/catalogue-controls-mcp-results.json` | combined_discovery_empty_reset_and_native_sort |
| scored/functional | `variant_stock_and_valid_basket_boundary` | `commerce/results.json`, `commerce/remaining-ui-legs-results.json` | basket_invalid_edit_reload_and_zero_independent_context |
| scored/functional | `ridgeline_unplaced_basket_survives_full_reload` | `mcp/two-context-mcp-results.json` | basket_invalid_edit_reload_and_zero_independent_context |
| scored/functional | `ridgeline_zero_quantity_removal_stays_empty` | `commerce/results.json` | basket_invalid_edit_reload_and_zero_independent_context |
| scored/functional | `trade_threshold_reversal_and_size_isolation` | `commerce/results.json`, `commerce/remaining-ui-legs-results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `postage_inclusive_boundaries_and_collection` | `commerce/results.json` | collection_checkout_multiline_cancel_and_duplicate_cancel_race |
| scored/functional | `historical_receipt_uses_charged_prices` | `commerce/results.json`, `commerce/remaining-ui-legs-results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `ridgeline_unknown_reference_does_not_substitute_receipt` | `commerce/remaining-ui-legs-results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `mixed_trade_prices_survive_order_lookup` | `commerce/results.json`, `commerce/remaining-ui-legs-results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `ridgeline_incomplete_delivery_address_refuses_atomically` | `gate-address/gate-address-browser-results.json` | whitespace_address_refusals_and_valid_recovery |
| scored/functional | `authoritative_prices_on_fresh_checkout` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `combined_quantities_and_invalid_checkout_are_atomic` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `stale_multiline_checkout_leaves_every_stock_unchanged` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `checkout_retry_identity_and_new_purchase` | `commerce/results.json` | lost_last_unit_response_cancelled_elsewhere_then_ui_recovery |
| scored/functional | `cancellation_is_terminal_and_restores_stock_once` | `commerce/results.json` | collection_checkout_multiline_cancel_and_duplicate_cancel_race; lost_last_unit_response_cancelled_elsewhere_then_ui_recovery |
| scored/functional | `simultaneous_last_copy_commits_only_once` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `ridgeline_sold_out_cheapest_variant_keeps_grid_price` | `commerce/results.json`, `conditional/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `last_unit_order_and_fresh_oversell_refusal` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `successive_orders_use_remaining_stock_and_own_tiers` | `commerce/results.json` | Reused unchanged scope; no new identical run |
| scored/functional | `restart_preserves_receipts_stock_and_retry_terminality` | `browser_restart_results.json` | Reused unchanged scope; no new identical run |
| scored/polish | `responsive_layout` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation |
| scored/polish | `labelled_controls_and_focus` | `presentation/browser-criteria-results.json` | exact_keyboard_route_and_focus |
| scored/polish | `interaction_feedback` | `presentation/browser-criteria-results.json` | combined_discovery_empty_reset_and_native_sort; exact_keyboard_route_and_focus |
| scored/polish | `theme_and_navigation` | `presentation/browser-criteria-results.json` | exact_keyboard_route_and_focus; changed_stock_catalogue_and_readonly_presentation |
| scored/visual | `visual_typography` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
| scored/visual | `visual_color_and_contrast` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
| scored/visual | `visual_spacing_and_layout` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
| scored/visual | `visual_hierarchy_and_scanability` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
| scored/visual | `visual_overall_craft` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
| scored/visual | `visual_responsive_consistency` | `presentation/browser-criteria-results.json` | changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review |
