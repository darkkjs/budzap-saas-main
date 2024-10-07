// routes/pageRoutes.js
const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/create', ensureAuthenticated, pageController.renderPageCreationView);
router.post('/create', ensureAuthenticated, pageController.createPage);
router.get('/:customLink', pageController.viewPage);

router.get('/api/list', ensureAuthenticated, pageController.listPages);
router.put('/api/:id', ensureAuthenticated, pageController.updatePage);
router.delete('/api/:id', ensureAuthenticated, pageController.deletePage);

module.exports = router;