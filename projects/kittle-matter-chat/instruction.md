Kittle & Rowe is a small law firm, and our clients keep emailing documents to whoever answered last. We want a secure chat where each client talks to us inside their legal matter, with every conversation kept matter by matter and in proper threads, so a question and its answers stay together.

Two things matter more than anything else. First, ethical walls: when someone here has a conflict on a matter, they must not learn anything about it, from any corner of the app. Second, retention: some matters use disappearing messages so old chat doesn't pile up, but anything a partner has put on legal hold has to survive whatever the timer says, and what has gone must stay gone.

The people, matters and messages we start with are in `/assets/seed_data.json`. The notes in `/instructions` explain how walls, timers, holds and transcripts work for us, how we talk in a matter (replies, edits, formatting, unread messages) and how we run the app. The finished app goes in `/app`, starting from `/app/server.js` and keeping its data in `/app/app.db`.

Until somebody signs in they see only the sign-in page, with no matter titles, names or messages.

Before you hand it over, please try it the way we'll use it, in a browser: sign in as different people, post, reply, edit, search and open a transcript from the pages themselves, and make sure nothing breaks. We only ever use it through the pages, so something that works when you call the server directly but not from the page doesn't work for us.
