const express = require('express');
const router = express.Router();
const { createOrder, getOrderStatus } = require('../controllers/paymentController');
const { ensureAuthenticated } = require('../middleware/auth');

router.post('/create-order', createOrder);
router.get('/order-status/:orderId', getOrderStatus);

router.get('/upgrade', ensureAuthenticated, (req, res) => {
    res.render('payment', { user: req.user, userId: req.user.id });
  });

module.exports = router;