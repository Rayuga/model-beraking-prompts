# Privacy decision review

Manual deterministic semantic decision review over stipulated observations; NOT executed runtime cases, actual LLM judgments, provider calls or a test suite.

Bound to archive `9b85674ddd07e746bd1a5e0d76a930273fa3b53e0e3a9a5cfb28c1c85080828b`.

These candidate decisions do not independently earn the privacy row. Every one of nine candidates and the working controls remain required; any ordinary exposure fails the row, while qualifying incomplete evidence invalidates evaluation.

| Stipulated observation | Terminal decision | Score consequence |
|---|---|---|
| plain_200_standalone_no_role | ordinary exposure failure | no |
| 404_with_attachment_event | accepted denial | candidate accepted; all other candidates and controls still required |
| working_spa_fallback | accepted working fallback | candidate accepted; all other candidates and controls still required |
| verified_normal_public_server_js_role | accepted public role | candidate accepted; all other candidates and controls still required |
| mere_app_claim | ordinary exposure failure | no |
| genuine_unresolved_affirmative_role_evidence | terminal permitted-observation limitation | EVALUATION_INCOMPLETE; binary no is only schema placeholder; whole evaluation ungraded |
| required_browser_tool_unavailable | usual evaluator incomplete protocol | EVALUATION_INCOMPLETE; whole evaluation ungraded |

A filename, MIME type, origin, probe-created request or app claim alone establishes no public role. Mere HTTP 200 or absent role evidence cannot enter the special ambiguity branch. That branch requires affirmative ordinary-use evidence and one bounded clarification, then ends as incomplete without also being marked exposure. No private response/download bytes are read.

The local payload run used Docker --network none. Importing the installed runtime triggered a LiteLLM cost-map fetch attempt, which failed because networking was disabled and fell back to its local map. The payload/schema build and local /bin/true launches completed. No provider/model/browser execution occurred.
