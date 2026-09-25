# Gambit criterion evidence

Local evidence supports review; it is not a platform verdict. Some scenarios cover representative portions of a criterion and are complemented by source inspection. Visual anchors were retained and reviewed manually, without assigning an Oracle score.

| Dimension | Criterion | Local evidence |
|---|---|---|
| render | `board_renders` | live page, exact seeded ladder, empty states and SVG board |
| render | `cards_render_as_cards` | repeatable practice deal, hidden identities, named seats and illegal order refusal |
| constraints | `server_backed_local_application` | repeatable practice deal, hidden identities, named seats and illegal order refusal; real play unsorted run, count 28 refusal without mutation, thirty-one and last card; manifest contract, twice restarted SQLite state, seed once and legal continuation |
| constraints | `drawn_as_svg_not_images` | live page, exact seeded ladder, empty states and SVG board; repeatable practice deal, hidden identities, named seats and illegal order refusal; no fatal browser errors, same-origin assets and drawn card/board surfaces |
| functional | `seed_ladder_import` | live page, exact seeded ladder, empty states and SVG board |
| functional | `the_twenty_nine_hand` | visible hand/play benches with breakdowns |
| functional | `the_app_agrees_with_the_supplied_fixture` | visible representative hand totals, overlap, ace, nobs and both flush modes; all forty fixture totals and 960 permutations through observed server scorer |
| functional | `a_card_counts_in_every_combination` | visible representative hand totals, overlap, ace, nobs and both flush modes |
| functional | `the_crib_flush_needs_five` | visible representative hand totals, overlap, ace, nobs and both flush modes |
| functional | `a_five_card_flush_counts_in_both` | visible representative hand totals, overlap, ace, nobs and both flush modes |
| functional | `the_ace_is_low_and_does_not_wrap` | visible representative hand totals, overlap, ace, nobs and both flush modes |
| functional | `nobs_needs_the_matching_suit` | visible representative hand totals, overlap, ace, nobs and both flush modes |
| functional | `fifteen_in_the_play_is_two` | real play unsorted run, count 28 refusal without mutation, thirty-one and last card; normal new game has distinct hands; fifteen at zero and wrong B turn refusal |
| functional | `a_run_in_the_play_need_not_be_in_order` | real play unsorted run, count 28 refusal without mutation, thirty-one and last card |
| functional | `the_count_cannot_pass_thirty_one` | real play unsorted run, count 28 refusal without mutation, thirty-one and last card |
| functional | `a_hand_that_is_not_a_hand_is_refused` | invalid scoring refuses without crashing; valid recovery |
| functional | `two_cards_each_go_to_the_crib` | repeatable practice deal, hidden identities, named seats and illegal order refusal |
| functional | `the_crib_is_hidden_until_the_show` | repeatable practice deal, hidden identities, named seats and illegal order refusal; ordered complete show, revealed crib and persistent between state |
| functional | `moves_out_of_order_are_refused` | repeatable practice deal, hidden identities, named seats and illegal order refusal; normal new game has distinct hands; fifteen at zero and wrong B turn refusal |
| functional | `the_show_counts_in_order` | ordered complete show, revealed crib and persistent between state |
| functional | `the_game_stops_at_the_target` | pegging immediate win caps at 121 and rejects further moves |
| functional | `a_game_is_a_sequence_of_hands` | ordered complete show, revealed crib and persistent between state; same game continues, dealer alternates on hands two and three |
| functional | `the_deal_alternates_between_hands` | same game continues, dealer alternates on hands two and three |
| functional | `a_game_survives_a_reload` | reload, clean browser context and saved chooser preserve partial play; manifest contract, twice restarted SQLite state, seed once and legal continuation |
| functional | `the_ladder_updates_when_a_game_ends` | heels immediate score and capped win, ladder increments exactly once |
| functional | `hand_order_invariance` | all forty fixture totals and 960 permutations through observed server scorer |
| functional | `pairs_and_last_card_in_real_play` | real pairs, royal pairs, double royal and last-card plus pair |
| functional | `go_resets_and_other_player_leads` | go awards one point once, resets count, other player leads |
| functional | `heels_immediate_and_capped` | heels immediate score and capped win, ladder increments exactly once |
| functional | `show_wins_stop_at_each_boundary` | show stops immediately at pone, dealer and crib winning boundaries |
| functional | `practice_and_scoring_do_not_corrupt_saved_games` | normal new game has distinct hands; fifteen at zero and wrong B turn refusal; practice validation and scoring cannot mutate saved games or ladder |
| functional | `pegging_scoring_bench` | visible pegging bench independent piles, refusals and recovery; practice validation and scoring cannot mutate saved games or ladder |
| functional | `runtime_manifest_routes` | manifest contract, twice restarted SQLite state, seed once and legal continuation |
| functional | `final_restart_persistence` | manifest contract, twice restarted SQLite state, seed once and legal continuation |
| polish | `keyboard_controls_and_focus` | mobile reachability, reduced motion and labelled keyboard card controls |
| polish | `responsive_controls_and_reachability` | ordered complete show, revealed crib and persistent between state; mobile reachability, reduced motion and labelled keyboard card controls |
| polish | `illegal_move_feedback` | real play unsorted run, count 28 refusal without mutation, thirty-one and last card |
| polish | `pending_action_and_empty_state` | live page, exact seeded ladder, empty states and SVG board; pending save rejects double click while one actual request is held |
| polish | `readable_state_and_reduced_motion` | visible hand/play benches with breakdowns; repeatable practice deal, hidden identities, named seats and illegal order refusal; ordered complete show, revealed crib and persistent between state; mobile reachability, reduced motion and labelled keyboard card controls |
| visual | `visual_typography` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
| visual | `visual_color_and_contrast` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
| visual | `visual_spacing_and_layout` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
| visual | `visual_hierarchy_and_scanability` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
| visual | `visual_overall_craft` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
| visual | `visual_responsive_consistency` | Manual desktop/mobile screenshot review: live table, show, populated benches and ladder; no LLM numeric rating asserted. |
