# Brickfall Game - Quick Start Guide

## Starting the Server

From the `/app` directory, run:

```bash
node server.js
```

The server will start on **http://localhost:3000**

## What to Expect

1. **Sign-in Page**: You'll see a login form
2. **Demo Accounts Available**:
   - Email: `mira@brickfall.test` (Password: `password123`)
   - Email: `dev@brickfall.test` (Password: `password123`)
   - Email: `polly@brickfall.test` (Password: `password123`)

3. **Game Menu**: After signing in, you'll see:
   - Level selection (1-10)
   - Top 10 leaderboard scores
   - Your best score
   - Run history

4. **Gameplay**:
   - Select a level
   - Click "Launch" or press Space to start
   - Use arrow keys or mouse to move paddle
   - Break all bricks to complete the level
   - Avoid losing all balls (3 lives)

## Key Features Implemented

✓ Secure authentication with bearer tokens
✓ Persistent game state (auto-saves every 5 seconds)
✓ 10 fully-designed levels with 445+ bricks
✓ Physics engine with proper collision detection
✓ Power-ups: Wide, Slow, Multiball, Sticky
✓ Combo scoring system (up to x5 multiplier)
✓ Extra lives at 20,000 point intervals
✓ Global leaderboard (top 10)
✓ Run history with 10 recent runs per user
✓ Multi-tab safe with revision tracking
✓ Idempotent operations prevent duplicates

## Technical Stack

- **Server**: Express.js (Node.js)
- **Database**: SQLite (auto-initialized)
- **Frontend**: Vanilla JavaScript + Canvas API
- **Storage**: localStorage for tokens, SQLite for everything else

## File Structure

```
/app/
├── server.js           Main server application
├── db.js              Database layer
├── brickfall.db       SQLite database (auto-created)
├── package.json       Dependencies
├── public/
│   ├── index.html     Game UI
│   ├── css/style.css  Styling
│   └── js/
│       ├── api.js     API client
│       ├── game.js    Game engine
│       └── ui.js      UI management
└── README.md          Full documentation
```

## Gameplay Tips

- **Build Combo**: Hit bricks in sequence to build multiplier
- **Paddle Angle**: Hit the edges for extreme angles
- **Power-ups**: Use Wide and Slow strategically
- **Multiball**: Extra balls help but don't increase score
- **Sticky**: Catch and hold the ball for precision placement

## Testing the Server

After starting the server, you can test the API:

```bash
# Sign in
curl -X POST http://localhost:3000/api/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"mira@brickfall.test","password":"password123"}'

# Get game state (use token from sign-in response)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/game-state
```

## Troubleshooting

1. **Port 3000 already in use**: Change PORT in server.js
2. **Database locked**: Delete `brickfall.db*` files and restart
3. **Game not loading**: Check browser console (F12) for errors
4. **State not saving**: Check localStorage is enabled

Enjoy playing Brickfall! 🎮
