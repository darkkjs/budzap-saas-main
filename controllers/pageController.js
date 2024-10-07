// controllers/pageController.js
const Page = require('../models/Page');
const shortid = require('shortid');
const Product = require('../models/Product');

exports.renderPageCreationView = (req, res) => {
    res.render('page-builder', { user: req.user, layout: false });
};

exports.createPage = async (req, res) => {
    try {
        const { name, style, sections } = req.body;
        const customLink = shortid.generate();
        const page = new Page({
            user: req.user._id,
            name,
            style,
            sections,
            customLink
        });
        await page.save();
        res.status(201).json(page);
    } catch (error) {
        res.status(500).json({ message: 'Error creating page', error });
    }
};

exports.viewPage = async (req, res) => {
    try {
        const { customLink } = req.params;
        const page = await Page.findOne({ customLink });
        if (!page) {
            return res.status(404).send('Page not found');
        }
        
        // Buscar todos os produtos do usuário
        const products = await Product.find({ user: page.user });
        
        const html = generatePageHTML(page, products);
        res.send(html);
    } catch (error) {
        console.error('Error viewing page:', error);
        res.status(500).send('Error viewing page');
    }
};


exports.listPages = async (req, res) => {
    try {
        console.log('Usuário solicitando páginas:', req.user._id);
        const pages = await Page.find({ user: req.user._id }).select('name customLink');
        console.log('Páginas encontradas:', pages);
        
        if (pages.length === 0) {
            return res.json([]);  // Retorna um array vazio se não houver páginas
        }
        
        res.json(pages);
    } catch (error) {
        console.error('Erro ao listar páginas:', error);
        res.status(500).json({ message: 'Erro ao listar páginas', error: error.message });
    }
};

exports.updatePage = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, style, sections } = req.body;

        const page = await Page.findOne({ _id: id, user: req.user._id });

        if (!page) {
            return res.status(404).json({ message: 'Página não encontrada' });
        }

        page.name = name;
        page.style = style;
        page.sections = sections;

        await page.save();

        res.json({ message: 'Página atualizada com sucesso', page });
    } catch (error) {
        console.error('Erro ao atualizar página:', error);
        res.status(500).json({ message: 'Erro ao atualizar página', error });
    }
};

exports.deletePage = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Page.deleteOne({ _id: id, user: req.user._id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Página não encontrada' });
        }

        res.json({ message: 'Página excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir página:', error);
        res.status(500).json({ message: 'Erro ao excluir página', error });
    
    }
}


function generatePageHTML(page, products) {
    let sectionsHTML = page.sections.map(section => {
        const commonStyles = `
            text-align: ${section.style.textAlign || 'left'};
            padding: ${section.style.padding || 0}px;
            background-color: ${section.style.backgroundColor || 'transparent'};
            color: ${section.style.color || 'black'};
            font-size: ${section.style.fontSize || 16}px;
            font-family: ${section.style.fontFamily || 'Arial, sans-serif'};
        `;

        switch(section.type) {
            case 'header':
                return `<h1 style="${commonStyles}">${section.content}</h1>`;
            case 'text':
                return `<p style="${commonStyles}">${section.content}</p>`;
            case 'image':
                return `<img src="${section.content}" alt="${section.alt || ''}" style="${commonStyles} width: ${section.style.width || 100}%; border-radius: ${section.style.borderRadius || 0}px;">`;
            case 'button':
                return `<a href="${section.link || '#'}" style="${commonStyles} background-color: ${section.style.backgroundColor || '#007bff'}; color: ${section.style.color || 'white'}; padding: ${section.style.padding || 10}px; border-radius: ${section.style.borderRadius || 5}px; text-decoration: none; display: inline-block;">${section.content}</a>`;
            case 'product-list':
                return generateProductList(products, section.style);
            case 'video':
                return `<div style="${commonStyles} width: ${section.style.width || 100}%;">
                    <iframe width="100%" height="315" src="${section.content}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                </div>`;
            case 'divider':
                return `<hr style="${commonStyles} border: none; border-top: ${section.style.borderWidth || 1}px ${section.style.borderStyle || 'solid'} ${section.style.borderColor || 'black'};">`;
            default:
                return '';
        }
    }).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${page.name}</title>
            <style>
                body {
                    background-color: ${page.style?.backgroundColor || 'white'};
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                ${sectionsHTML}
            </div>
        </body>
        </html>
    `;
}

function generateProductList(products, style) {
    const productItems = products.map(product => `
        <div style="margin-bottom: 20px;">
            <img src="${product.image}" alt="${product.name}" style="width: 100%; height: auto; object-fit: cover;">
            <h3>${product.name}</h3>
            ${style.showPrice ? `<p>Price: $${product.price.toFixed(2)}</p>` : ''}
            ${style.showDescription ? `<p>${product.description}</p>` : ''}
            <a href="${product.redirectLink}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; display: inline-block; border-radius: 5px;">Buy Now</a>
        </div>
    `).join('');

    return `
        <div style="display: grid; grid-template-columns: repeat(${style.productsPerRow || 3}, 1fr); gap: 20px;">
            ${productItems}
        </div>
    `;
}

