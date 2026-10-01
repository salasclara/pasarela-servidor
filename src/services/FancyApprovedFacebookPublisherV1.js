'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

function getApprovedProduct(products, id) {
  const product = products.find(p => Number(p.id) === Number(id) && p.active !== false);
  if (!product) throw new Error('Producto Fancy no encontrado o inactivo: ' + id);
  if (!product.cardPath) throw new Error('cardPath faltante para producto ' + id);
  if (!product.approvedCopy) throw new Error('approvedCopy faltante para producto ' + id);
  if (!product.affiliateUrl) throw new Error('affiliateUrl faltante para producto ' + id);
  if (!product.approvedCopy.includes(product.affiliateUrl)) {
    throw new Error('El copy no contiene el affiliateUrl canónico del producto ' + id);
  }
  return product;
}

async function resolvePageToken(pageId, token) {
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`);
    const j = await r.json();
    if (j.access_token) return j.access_token;
  } catch (_) {}
  return token;
}

async function publishApprovedFancyProduct({ products, productId, pageId, pageToken, repoRoot }) {
  if (!pageId || !pageToken) throw new Error('Configuración de Facebook Fancy incompleta');
  const product = getApprovedProduct(products, productId);
  const imagePath = path.resolve(repoRoot || process.cwd(), product.cardPath);
  if (!fs.existsSync(imagePath)) throw new Error('Imagen aprobada no encontrada: ' + product.cardPath);

  const token = await resolvePageToken(pageId, pageToken);
  const form = new FormData();
  form.append('caption', product.approvedCopy);
  form.append('access_token', token);
  form.append('source', fs.createReadStream(imagePath), {
    filename: path.basename(imagePath),
    contentType: 'image/png'
  });

  const result = await new Promise((resolve, reject) => {
    form.submit(`https://graph.facebook.com/v19.0/${pageId}/photos`, (err, res) => {
      if (err) return reject(err);
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
  });

  return {
    ok: true,
    productId: product.id,
    productName: product.name,
    facebookPostId: result.id || null,
    affiliateUrl: product.affiliateUrl
  };
}

module.exports = { getApprovedProduct, publishApprovedFancyProduct };
