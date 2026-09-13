#!/usr/bin/env node
const express = require('express');
const path = require('path');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
db.init();

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    const result = await auth.signin(email, password);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    
    res.json({
      token: result.token,
      user: result.user
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signout', auth.requireAuth, async (req, res) => {
  try {
    await auth.signout(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ GAME STATE ENDPOINTS ============

app.get('/api/user/profile', auth.requireAuth, async (req, res) => {
  try {
    const profile = await db.getUserProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.get('/api/game/state', auth.requireAuth, async (req, res) => {
  try {
    const state = await db.getRunState(req.user.id);
    if (!state) {
      return res.json({ activeRun: null });
    }
    res.json({ activeRun: state });
  } catch (err) {
    console.error('Error loading game state:', err);
    res.status(500).json({ error: 'Failed to load game state' });
  }
});

app.post('/api/game/start', auth.requireAuth, async (req, res) => {
  const { level, revision, operationId } = req.body;
  if (!level || revision === undefined || !operationId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await db.startRun(req.user.id, level, revision, operationId);
    if (!result.success) {
      return res.status(result.status || 400).json({ 
        error: result.error,
        revision: result.revision,
        state: result.state 
      });
    }
    
    res.json({ 
      success: true,
      revision: result.revision,
      run: result.run
    });
  } catch (err) {
    console.error('Error starting run:', err);
    res.status(500).json({ error: 'Failed to start run' });
  }
});

app.post('/api/game/save', auth.requireAuth, async (req, res) => {
  const { state, revision, operationId } = req.body;
  if (!state || revision === undefined || !operationId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await db.saveRun(req.user.id, state, revision, operationId);
    if (!result.success) {
      return res.status(result.status || 400).json({
        error: result.error,
        revision: result.revision,
        state: result.state
      });
    }
    
    res.json({
      success: true,
      revision: result.revision
    });
  } catch (err) {
    console.error('Error saving run:', err);
    res.status(500).json({ error: 'Failed to save run' });
  }
});

app.post('/api/game/finish', auth.requireAuth, async (req, res) => {
  const { outcome, level, score, snapshot, revision, operationId } = req.body;
  if (!outcome || level === undefined || score === undefined || !snapshot || 
      revision === undefined || !operationId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await db.finishRun(req.user.id, {
      outcome, level, score, snapshot
    }, revision, operationId);
    
    if (!result.success) {
      return res.status(result.status || 400).json({
        error: result.error,
        revision: result.revision
      });
    }
    
    res.json({
      success: true,
      leaderboard: result.leaderboard
    });
  } catch (err) {
    console.error('Error finishing run:', err);
    res.status(500).json({ error: 'Failed to finish run' });
  }
});

// ============ LEVELS & PROGRESSION ============

app.get('/api/levels', auth.requireAuth, async (req, res) => {
  try {
    const levels = await db.getLevels();
    const unlockedLevels = await db.getUnlockedLevels(req.user.id);
    res.json({
      all: levels,
      unlocked: unlockedLevels
    });
  } catch (err) {
    console.error('Error loading levels:', err);
    res.status(500).json({ error: 'Failed to load levels' });
  }
});

app.get('/api/levels/:level/bricks', auth.requireAuth, async (req, res) => {
  try {
    const bricks = await db.getLevelBricks(req.params.level);
    res.json({ bricks });
  } catch (err) {
    console.error('Error loading bricks:', err);
    res.status(500).json({ error: 'Failed to load bricks' });
  }
});

// ============ LEADERBOARD ============

app.get('/api/leaderboard', auth.requireAuth, async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

app.get('/api/leaderboard/history', auth.requireAuth, async (req, res) => {
  try {
    const history = await db.getRunHistory(req.user.id);
    res.json({ history });
  } catch (err) {
    console.error('Error loading history:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ============ MECHANICS LAB ============

app.get('/api/lab/drills', auth.requireAuth, async (req, res) => {
  try {
    const drills = await db.getDrills();
    res.json({ drills });
  } catch (err) {
    console.error('Error loading drills:', err);
    res.status(500).json({ error: 'Failed to load drills' });
  }
});

app.get('/api/lab/drill/:id', auth.requireAuth, async (req, res) => {
  try {
    const drill = await db.getDrillState(req.params.id);
    if (!drill) {
      return res.status(404).json({ error: 'Drill not found' });
    }
    res.json({ drill });
  } catch (err) {
    console.error('Error loading drill:', err);
    res.status(500).json({ error: 'Failed to load drill' });
  }
});

app.post('/api/lab/advance', auth.requireAuth, async (req, res) => {
  const { drillId, maxSteps } = req.body;
  if (!drillId || !maxSteps) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await db.advanceDrill(drillId, maxSteps);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error('Error advancing drill:', err);
    res.status(500).json({ error: 'Failed to advance drill' });
  }
});

app.get('/api/lab/constants', auth.requireAuth, async (req, res) => {
  try {
    const constants = await db.getConstants();
    res.json({ constants });
  } catch (err) {
    console.error('Error loading constants:', err);
    res.status(500).json({ error: 'Failed to load constants' });
  }
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`Brickfall server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
