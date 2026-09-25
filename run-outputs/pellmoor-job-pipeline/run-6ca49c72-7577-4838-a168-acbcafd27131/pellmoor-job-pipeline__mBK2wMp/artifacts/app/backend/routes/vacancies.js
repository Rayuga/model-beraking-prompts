const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../auth');
const { getAllVacancies, getVacancyFullDetails } = require('../vacancyService');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const vacancies = getAllVacancies(db);
  return res.json({ vacancies });
});

router.get('/:code', authMiddleware, (req, res) => {
  const db = getDb();
  const vacancyCode = req.params.code.trim().toUpperCase();
  const details = getVacancyFullDetails(db, vacancyCode);
  if (!details) {
    return res.status(404).json({ error: `Vacancy '${vacancyCode}' not found` });
  }
  return res.json(details);
});

module.exports = router;
