## Application

Name: Ridgeline Press, a risograph print shop
URL: http://localhost:3000

## Accounts

The shop is public. There are no accounts, credentials or sign-in steps. Each browser keeps its own basket.

## Key screens

The catalogue grid with title search, paper-size and stock-sheet filters, and price/title sorting; a print detail view with its photograph, sizes, stock and trade prices; the basket and checkout with gross subtotal, trade saving, postage and total; delivery-address entry; order confirmation and reference lookup; and cancellation for a placed order. The summary can share the address screen or use a separate review screen.

## Seed and state

There are eight prints and thirteen variants. The historical dispatched order RP-100001 contains two Long Field A3 sheets charged at GBP 35.00 each, with GBP 3.20 postage and a GBP 73.20 total. Current Long Field A3 costs GBP 37.95 before its trade break. The historical order cannot be cancelled. New orders start placed and can be cancelled. All criteria share a single continuing database. The constraints gate places one Kiln A3 order and proves independent browser retrieval before the scored suite can run. Functional reserves the remaining stock as described in its prompt. Render, Polish and Visual must leave durable state unchanged. Browser contexts and newly generated references are not shared between judges; the known historical reference is available for read-only receipt inspection.

## Evaluator failures

Observed missing or broken application behavior earns the applicable failed outcome. An evaluator transport failure, unavailable browser context API, exhausted judge budget, or failed restart tool is not proof of an application defect. Retry a transient tool operation once when safe. If it still prevents the required observation, report a failed/raw-minimum transport value with reasoning beginning EVALUATION_INCOMPLETE: and describe the missing evaluator evidence. The harness rejects that incomplete suite as ungraded; never manufacture partial product credit. This prefix is reserved for actual evaluator failures, never an app message, an ordinary refused request, or a product action that does not work. A legitimate native dialog or alternate route is not a tool failure.
