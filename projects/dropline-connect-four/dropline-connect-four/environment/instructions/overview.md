# Product overview

DropLine is a local two-player four-in-a-row game. Red and Yellow share the
same browser and use the same visible controls. There are no accounts, remote
players, computer opponents, editable player identities, or tournament modes.

Serve the application with Node.js and Express. Build the game with ordinary
HTML, CSS, and JavaScript. The board must be an accessible DOM grid rather than
a canvas, image map, or third-party game component. Do not use React, a game
framework, or runtime CDN imports.

The initial match uses the title and player identities in the supplied seed
data. Opening the application should show the board, turn or result, running
score, move history, and match controls without a login step.
