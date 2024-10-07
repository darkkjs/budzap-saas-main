// controllers/productController.js
const Product = require('../models/Product');

exports.renderProductPage = (req, res) => {
    res.render('product-management', { user: req.user });
};

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ user: req.user._id });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, price, description, image, redirectLink } = req.body;
        const product = new Product({
            user: req.user._id,
            name,
            price,
            description,
            image,
            redirectLink
        });
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error creating product', error });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;
        const product = await Product.findOneAndUpdate(
            { _id: id, user: req.user._id },
            update,
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error updating product', error });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findOneAndDelete({ _id: id, user: req.user._id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting product', error });
    }
};