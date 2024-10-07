// routes/catalogRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/products', ensureAuthenticated, productController.renderProductPage);
router.get('/products/list', ensureAuthenticated, productController.getProducts);
router.post('/products', ensureAuthenticated, productController.createProduct);
router.put('/products/:id', ensureAuthenticated, productController.updateProduct);
router.delete('/products/:id', ensureAuthenticated, productController.deleteProduct);

module.exports = router;