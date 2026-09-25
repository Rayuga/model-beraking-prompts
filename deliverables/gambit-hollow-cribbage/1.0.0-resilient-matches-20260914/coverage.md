# Requirement and verifier coverage

This is a local authoring review, not the platform rubric verdict. Each listed criterion has an explicit behavior in instruction.md or the supplied club notes. New recovery requirements are in environment/assets/club/recovery.md; exact hands and series rounds are in practice-deals.json.

| Dimension | Criterion | Brief / evidence basis |
|---|---|---|
| render | board_renders | instruction.md working cribbage table; baseline browser inspection and shared gate |
| render | cards_render_as_cards | instruction.md working cribbage table; baseline browser inspection and shared gate |
| constraints | server_backed_local_application | README.md local server and inline SVG; baseline browser inspection |
| constraints | drawn_as_svg_not_images | README.md local server and inline SVG; baseline browser inspection |
| functional | seed_ladder_import | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_twenty_nine_hand | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_app_agrees_with_the_supplied_fixture | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_card_counts_in_every_combination | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_crib_flush_needs_five | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_five_card_flush_counts_in_both | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_ace_is_low_and_does_not_wrap | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | nobs_needs_the_matching_suit | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | fifteen_in_the_play_is_two | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_run_in_the_play_need_not_be_in_order | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_count_cannot_pass_thirty_one | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_hand_that_is_not_a_hand_is_refused | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | two_cards_each_go_to_the_crib | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_crib_is_hidden_until_the_show | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | moves_out_of_order_are_refused | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_show_counts_in_order | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_game_stops_at_the_target | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_game_is_a_sequence_of_hands | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_deal_alternates_between_hands | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | a_game_survives_a_reload | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | the_ladder_updates_when_a_game_ends | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | hand_order_invariance | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | pairs_and_last_card_in_real_play | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | go_resets_and_other_player_leads | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | heels_immediate_and_capped | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | show_wins_stop_at_each_boundary | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | practice_and_scoring_do_not_corrupt_saved_games | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | pegging_scoring_bench | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | runtime_manifest_routes | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | final_restart_persistence | instruction.md; README.md; house-rules.md; scored-hands.js / practice-deals.json; baseline browser/unit groups |
| functional | complete_club_match | recovery.md; new match/recovery browser regressions |
| functional | one_player_exhausted_pegging | recovery.md; new match/recovery browser regressions |
| functional | last_card_thirty_one | recovery.md; new match/recovery browser regressions |
| functional | independent_saved_games | recovery.md; new match/recovery browser regressions |
| functional | stale_tabs_and_revisions | recovery.md; new match/recovery browser regressions |
| functional | durable_creation_identity | recovery.md; new match/recovery browser regressions |
| functional | accepted_action_replay | recovery.md; new match/recovery browser regressions |
| functional | accepted_identifier_binding | recovery.md; new match/recovery browser regressions |
| functional | lost_response_retry_ui | recovery.md; new match/recovery browser regressions |
| functional | recovery_phase_matrix | recovery.md; new match/recovery browser regressions |
| polish | keyboard_controls_and_focus | README.md keyboard, focus, feedback, pending saves and viewport requirements; browser regressions |
| polish | responsive_controls_and_reachability | README.md keyboard, focus, feedback, pending saves and viewport requirements; browser regressions |
| polish | illegal_move_feedback | README.md keyboard, focus, feedback, pending saves and viewport requirements; browser regressions |
| polish | pending_action_and_empty_state | README.md keyboard, focus, feedback, pending saves and viewport requirements; browser regressions |
| polish | readable_state_and_reduced_motion | README.md keyboard, focus, feedback, pending saves and viewport requirements; browser regressions |
| visual | visual_typography | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |
| visual | visual_color_and_contrast | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |
| visual | visual_spacing_and_layout | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |
| visual | visual_hierarchy_and_scanability | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |
| visual | visual_overall_craft | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |
| visual | visual_responsive_consistency | README.md cohesive legible board/bench/ladder/show at both viewports; screenshots, unchanged 0?5 anchors |

Cross-file checks: shared gate text is identical across five dimensions; no hidden API names are prescribed by the rubric; accepted retries are not confused with new invalid actions; only the documented restart helper is used; final_restart_persistence runs last. All preserved configuration/weight/timeouts are compared byte-for-byte or as parsed TOML against the preceding candidate/reference.

Limits: fresh image builds are blocked by network access; no paid judge run, full 53-point platform rubric result, or new model score is available. Behavioral regression coverage does not establish subjective Visual = 1.
