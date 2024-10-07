// controllers/catalogController.js
const Product = require('../models/Product');
const Catalog = require('../models/Catalog');
const shortid = require('shortid');

exports.addProduct = async (req, res) => {
  try {
    const { name, price, description, redirectLink, image } = req.body;
    const product = new Product({
      user: req.user._id,
      name,
      price,
      description,
      redirectLink,
      image
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error adding product', error });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const product = await Product.findOneAndUpdate({ _id: id, user: req.user._id }, update, { new: true });
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

exports.createCatalog = async (req, res) => {
    try {
      const { name, description, sections, products, customCSS, customJS } = req.body;
      const customLink = shortid.generate();
      const catalog = new Catalog({
        user: req.user._id,
        name,
        description,
        sections,
        products,
        customLink,
        customCSS,
        customJS
      });
      await catalog.save();
      res.status(201).json(catalog);
    } catch (error) {
      res.status(500).json({ message: 'Error creating catalog', error });
    }
  };
  
  exports.viewCatalog = async (req, res) => {
    try {
      const { customLink } = req.params;
      const catalog = await Catalog.findOne({ customLink }).populate('products');
      if (!catalog) {
        return res.status(404).json({ message: 'Catalog not found' });
      }
      
      // Gerar o HTML da página
      const html = generateCatalogHTML(catalog);
      
      res.send(html);
    } catch (error) {
      res.status(500).json({ message: 'Error viewing catalog', error });
    }
  };
  
  function generateCatalogHTML(catalog) {
    let sectionsHTML = catalog.sections.map(section => {
      switch(section.type) {
        case 'header':
          return `<header class="${section.style.classes}">${section.content}</header>`;
        case 'product-list':
          return `<div class="product-list ${section.style.classes}">
            ${catalog.products.map(product => `
              <div class="product">
                <img src="${product.image}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p>Price: $${product.price}</p>
                <a href="${product.redirectLink}">Buy Now</a>
              </div>
            `).join('')}
          </div>`;
        case 'text':
          return `<div class="${section.style.classes}">${section.content}</div>`;
        // Adicione mais casos para outros tipos de seções
      }
    }).join('');
  
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${catalog.name}</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>${catalog.customCSS}</style>
      </head>
      <body>
        ${sectionsHTML}
        <script>${catalog.customJS}</script>
      </body>
      </html>
    `;
  }
  
exports.renderCatalogCreationPage = async (req, res) => {
    try {
      const products = await Product.find({ user: req.user._id });
      res.render('catalog-builder', { products: products, user: req.user });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching products', error });
    }
  };

exports.getCatalogs = async (req, res) => {
  try {
    const catalogs = await Catalog.find({ user: req.user._id }).populate('products');
    res.json(catalogs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching catalogs', error });
  }
};

exports.updateCatalog = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const catalog = await Catalog.findOneAndUpdate({ _id: id, user: req.user._id }, update, { new: true });
    if (!catalog) {
      return res.status(404).json({ message: 'Catalog not found' });
    }
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ message: 'Error updating catalog', error });
  }
};

exports.deleteCatalog = async (req, res) => {
  try {
    const { id } = req.params;
    const catalog = await Catalog.findOneAndDelete({ _id: id, user: req.user._id });
    if (!catalog) {
      return res.status(404).json({ message: 'Catalog not found' });
    }
    res.json({ message: 'Catalog deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting catalog', error });
  }
};

exports.viewCatalog = async (req, res) => {
  try {
    const { customLink } = req.params;
    const catalog = await Catalog.findOne({ customLink }).populate('products');
    if (!catalog) {
      return res.status(404).json({ message: 'Catalog not found' });
    }
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ message: 'Error viewing catalog', error });
  }
};