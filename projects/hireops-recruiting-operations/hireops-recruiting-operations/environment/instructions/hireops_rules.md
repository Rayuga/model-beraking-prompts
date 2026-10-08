# How we run HireOps

These are the working rules our recruiting team follows. Routes, field names, element ids, button
labels and the shape of the pages are up to you; what we care about is that the workspace behaves the
way we describe here.

---

## 1. Who uses it

Everyone signs in with an email and the password `Hireops!2026`. We trust only the session the
server gave out, never anything a request claims about who sent it, and each person has exactly one
role.

| Role | What it's for |
|---|---|
| Recruiter | opens jobs, adds candidates, moves any card on any job, writes notes, talks to candidates |
| Hiring manager | works the late stages of their own jobs, writes notes there, joins those conversations |
| Observer | reads the board, notes, conversations and activity; changes nothing |
| Candidate | sees their own applications and conversations; nothing else |

Someone without a valid session gets nothing back and changes nothing: we answer `401`. Someone
signed in whose role doesn't cover the action gets `403`. When a candidate asks about an application
that isn't theirs, we say it doesn't exist (`404`), so they can't even learn that it's there.

## 2. Jobs and candidates

A job has a title, a team, the recruiter who opened it, one hiring manager and a number of interview
places, a whole number from 1 to 50. Only recruiters open jobs, and the hiring manager is picked from
the hiring-manager accounts.

A recruiter adds a candidate to a job with a name, an email address and a source, and the new card
starts at the bottom of Applied. The email has to look like an email address. We don't want the same
address on the same job twice (we treat upper and lower case as the same), though one person can apply
to several jobs. If we turn a save down because of the email, tell us at that field and keep whatever
was typed, so nobody retypes the form. When the address belongs to one of our candidate accounts, the
application is theirs: they see it and its conversation when they sign in.

The workspace makes up its own identifiers.

## 3. The pipeline board

Each job has a board with six stages, in this order: Applied, Screen, Interview, Offer, Hired, and
Rejected off to the side.

### Moving a card

We move a card one stage at a time, forward or back along Applied, Screen, Interview, Offer, Hired;
skipping a stage is turned down. Any card except a Hired one can be rejected, and we always give a
reason, so a blank reason is turned down. We like to know where a card was when it was rejected,
because reopening takes it back to exactly that stage and nowhere else, and clears its reason. Every
move works with ordinary controls; dragging is a nice extra. Whenever a move is turned down, nothing
about the card changes.

### Order inside a stage

We arrange the cards inside a stage by hand, and everybody sees the same order. A card that arrives in
a stage goes to the bottom unless someone drops it at a particular place. We can move a card up or
down within its stage with ordinary controls, and the order is still there after a reload, a fresh
sign-in or a restart.

### Interview places

Interview never holds more cards than the job's number of interview places, so a move that would
overfill it is turned down. Re-ordering cards that are already in Interview is always fine, and when a
card leaves, its place can be taken straight away.

### Who may move what

- Recruiters can make any allowed move on any job.
- A hiring manager works only on jobs where they are the hiring manager, and only among Interview,
  Offer and Hired, including re-ordering cards in those stages. They can reject from Interview or Offer
  and reopen a card that was rejected from one of those. Everything else is turned down for them.
- Observers and candidates don't move anything.

### Two people at once

Several of us work the same board, so every card carries a version that changes whenever the card
moves. If someone moves a card from a board that hasn't caught up with a colleague's change to that
card, we turn it down (`409`) and change nothing, and the refusal itself says the card was changed and
by whom, so whatever screen or tool sent the move can tell them. Their board then catches up to where
the card really is.

### Shown at once, put back if turned down

When I move a card I want to see it move straight away. If the server then turns the move down, put
the card back in its real place, show me why, and keep my keyboard focus on that card's controls so I
can carry on.

### Moving several together

I often select two or more cards of one job, from any of its stages, and move them to one stage in a
single action. They arrive at the bottom of that stage in board order: by stage in the order listed
above, then by place within the stage. Each card still has to follow every rule above, and Interview
places are counted for the whole set. If any one of them can't go, none of them moves.

### Undo

Each of us can undo our own most recent move, single or several; rejecting or reopening a card counts as a move here too. Undo puts every card of that move
back in the stage and the place it came from, and gives back a rejection reason the move removed. If
any of those cards has been moved, re-ordered, rejected or reopened since, by anyone, or if putting
them back would overfill Interview, the undo is turned down and nothing changes. Adding a note doesn't
count as a change. A move can be undone once; an undo can't itself be undone, and once I make a later
move, my earlier one is no longer undoable.

### Internal notes

Opening a card shows its details and our internal notes. Recruiters write notes on any card, a hiring
manager writes notes on cards of their own jobs, and the observer reads them. If I'm halfway through
typing a note and haven't saved it, keep it for me on that browser until I do; like an unsent reply, it's
mine, and nobody else who signs in on that browser sees it.

## 4. Activity

We keep a record of every job opening, added candidate, move, rejection, reopening, re-ordering and
undo: who did it and what changed, as a readable line such as "Mei Lin moved Priya Nair from Screen to
Interview". A rejection line includes its reason. The Activity view lists them newest first, for all
jobs or one chosen job. Nothing in it is ever edited or removed, and something that was turned down
leaves no line.

## 5. Keeping up with each other

While the workspace is open, what other people do should show up on its own within 15 seconds, with
no reload and nothing clicked: cards move to their new stage and place, new cards appear, unread counts
change, and new messages and seen marks arrive.

We're usually in the middle of something when an update lands, so it leaves alone the text I'm typing
anywhere, the control that has my keyboard focus, the card I have open, the conversation I have open,
and how far I've scrolled. Polling, server-sent events and sockets are all fine.

## 6. Conversations

Each application has one conversation between our side and the candidate.

### Who takes part

- Every recruiter reads and writes in every conversation.
- A hiring manager reads and writes only in conversations of their own jobs; the others are turned
  down.
- The observer reads every conversation and writes in none.
- A candidate reads and writes only in their own.

### Messages

A message is plain text and isn't blank; we keep its line breaks. In the message box, Enter sends and
Shift+Enter starts a new line. After sending, the box is empty and still has the keyboard focus, ready
for the next one. If a message couldn't be sent, leave it in the box and tell me it wasn't sent.

### Long conversations

Some conversations run long, so one opens on its most recent 30 messages, oldest of those first,
scrolled to the newest. I bring in earlier messages 30 at a time, in order, and I can see how many are
still to come. Bringing them in shouldn't move what I was looking at: the message that was at the top
of my view stays where it was.

### Unread

For each person, a conversation's unread count is the number of messages in it, sent by anyone else,
that arrived after that person last had the conversation open at its newest message. My own messages
are never unread for me, and sending a message counts as reading the conversation. We see the unread
count for each conversation and one total for ourselves.

When a message arrives in the conversation I have open:

- if I'm at the newest message, it's shown and counts as read;
- if I've scrolled up to earlier messages, my place stays put, I'm told how many new messages there
  are, and they stay unread until I go to them.

### Seen

My most recent message shows whether it's been seen. A staff message is seen once the candidate has
had the conversation open at or after that message. A candidate's message is seen once a recruiter, or
that job's hiring manager, has. The observer opening a conversation never counts.

### Drafts

A reply I've typed and not sent belongs to me and that conversation on that browser. It's still there
after I look at another conversation or another view, after I reload the page, and after my session
ends mid-reply: as soon as the workspace notices, at the latest on the next action that needs the
server, it asks me to sign in again, and after I sign in as myself the reply is where I left it and I
can send it. Each conversation keeps its own draft. Nobody else who signs in on that browser sees any
of mine. Where drafts are kept is up to you. Sending clears the draft.

## 7. What a candidate sees

A candidate sees a list of their own applications, each with the job title, the team, a status in
the candidate wording below and how many of its messages they haven't read yet, and the conversation
for each, where their own last message shows whether we've seen it. A conversation opens when the candidate
chooses it; signing in doesn't open one for them.

| Stage | Candidate wording |
|---|---|
| Applied | Application received |
| Screen | In review |
| Interview | Interviewing |
| Offer | Offer |
| Hired | Hired |
| Rejected | Not moving forward |

Candidates are outside the company, so nothing their browser receives may contain internal notes, a
rejection reason, the stage a card was rejected from, a card's place on the board, other candidates or
their applications, or the activity record. The board, the Activity view and every staff action are
turned down for candidates.

## 8. Where it runs

Our servers don't always start Node from inside the app folder. They run it as a locked-down user,
sometimes on a writable copy of the folder, so please find your pages and starting data relative to
`server.js` rather than the current directory, and keep the database wherever `DB_PATH` says. The
only settings you can count on are `PATH`, `HOME`, `NODE_PATH`, `PORT` and `DB_PATH`; anything else from
a shell won't be there.

## 9. The starting data

`/assets/seed_data.json` holds the people, three jobs with their cards in order, the messages (one
conversation is long), a few internal notes and read markers. Each read marker says how many messages
of a conversation, counted from its first, that person has already read. Load all of it once. The
candidate wording and the page size of 30 are in the same file.
