# Concurrent actions and idempotency

Show a nonnegative integer server revision. Every accepted New game, move, undo,
or redo increments it once. The browser sends its expected revision. If another
tab changed it first, reject the stale mutation, make no partial change, return
the authoritative state, and show `Game updated in another tab`. A retry using
that returned state may proceed.

Give every mutation an unpredictable operation identifier and store its result.
Receiving the same identifier again returns the original result without another
revision, move, score, history, or archive change. While a column request is
pending, repeated pointer or keyboard activation must produce at most one move;
focus remains on that column after a nonterminal response.
