const express = require('express');

function createApiRouter(storageEngine, wsManager) {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));

  // GET /api/users
  router.get('/users', (req, res) => {
    try {
      const users = storageEngine.getUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workbook (default ops-plan)
  router.get('/workbook', (req, res) => {
    try {
      const wb = storageEngine.getWorkbook('ops-plan');
      if (!wb) return res.status(404).json({ error: 'Workbook not found' });
      res.json(wb);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workbooks/:id
  router.get('/workbooks/:id', (req, res) => {
    try {
      const wb = storageEngine.getWorkbook(req.params.id);
      if (!wb) return res.status(404).json({ error: 'Workbook not found' });
      res.json(wb);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save handler for both PUT /api/workbooks/:id and POST /api/workbooks/:id/save
  const handleSave = (req, res) => {
    try {
      const workbookId = req.params.id;
      const { baseRevision, workbook, userId, userName, description } = req.body;

      if (baseRevision === undefined || baseRevision === null) {
        return res.status(400).json({ error: 'Missing baseRevision in request' });
      }
      if (!workbook) {
        return res.status(400).json({ error: 'Missing workbook snapshot in request' });
      }

      // Check user
      let authorId = userId || 'anonymous';
      let authorName = userName || 'Anonymous';
      if (userId) {
        const user = storageEngine.getUser(userId);
        if (user) {
          authorName = user.name;
        }
      }

      const result = storageEngine.saveWorkbook(
        workbookId,
        baseRevision,
        workbook,
        authorId,
        authorName,
        description || 'Save'
      );

      if (!result.success) {
        return res.status(result.statusCode || 400).json(result);
      }

      // If changes occurred, notify WebSocket clients
      if (!result.noChange && wsManager) {
        wsManager.broadcastRevisionSaved(workbookId, {
          revision: result.revision,
          workbook: result.workbook,
          user: { id: authorId, name: authorName },
          description: description || 'Save',
          merged: !!result.merged
        });
      }

      return res.json(result);
    } catch (err) {
      console.error('Save error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  router.put('/workbooks/:id', handleSave);
  router.post('/workbooks/:id/save', handleSave);

  // GET /api/workbooks/:id/revisions
  router.get('/workbooks/:id/revisions', (req, res) => {
    try {
      const revisions = storageEngine.getRevisions(req.params.id);
      res.json(revisions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workbooks/:id/revisions/:rev
  router.get('/workbooks/:id/revisions/:rev', (req, res) => {
    try {
      const revNum = parseInt(req.params.rev, 10);
      if (isNaN(revNum)) {
        return res.status(400).json({ error: 'Revision must be an integer' });
      }
      const revision = storageEngine.getRevision(req.params.id, revNum);
      if (!revision) {
        return res.status(404).json({ error: `Revision ${revNum} not found` });
      }
      res.json(revision);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workbooks/:id/sheets/:sheetId/cells/:cellRef/history
  router.get('/workbooks/:id/sheets/:sheetId/cells/:cellRef/history', (req, res) => {
    try {
      const history = storageEngine.getCellHistory(
        req.params.id,
        req.params.sheetId,
        req.params.cellRef
      );
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createApiRouter };
