 const express = require('express');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json({ limit: '50mb' }));

// ═══════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════
const SUPA_URL = process.env.SUPA_URL || 'https://jdztwoaaissvauuyodfb.supabase.co';
const SUPA_SERVICE_KEY = process.env.SUPA_SERVICE_KEY; // Use service role key for backend
const sb = createClient(SUPA_URL, SUPA_SERVICE_KEY);
console.log('[INIT] SUPA_URL:', SUPA_URL);
console.log('[INIT] Service key set:', !!SUPA_SERVICE_KEY);
console.log('[INIT] Chromium path:', process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium');

// ═══════════════════════════════════════════
// TEMPLATE DEFINITIONS (match portal exactly)
// ═══════════════════════════════════════════
const TEMPLATES = {
  blk_custom: { bg: '#FFFFFF', text: '#1a1a1a', accent: '#000', layout: 'blk_custom' },
  bold_dark: { bg: '#111', text: '#fff', accent: '#C8A55C', layout: 'hero_bottom' },
  clean_minimal: { bg: '#FAFAFA', text: '#222', accent: '#999', layout: 'photo_top' },
  luxury_gold: { bg: '#1A1510', text: '#F5ECD7', accent: '#D4AF37', layout: 'split_left' },
  feminine_soft: { bg: '#FDF5F0', text: '#3D2B1F', accent: '#C9A08E', layout: 'framed_center' },
  modern_blue: { bg: '#1B2D4F', text: '#fff', accent: '#4A90D9', layout: 'grid_banner' },
  earthy_natural: { bg: '#2C2A25', text: '#E8E0D4', accent: '#8B9D77', layout: 'organic_cutout' },
  magazine: { bg: '#000', text: '#fff', accent: '#FF4444', layout: 'magazine' },
  polaroid: { bg: '#F5F0E8', text: '#333', accent: '#7B6B4F', layout: 'polaroid' },
};

// ═══════════════════════════════════════════
// HTML TEMPLATE GENERATOR - 1200x1200 graphics
// ═══════════════════════════════════════════
function generateGraphicHTML(listing, template, photos, brokerage, graphicType) {
  const t = TEMPLATES[template] || TEMPLATES.bold_dark;
  const type = (graphicType || 'just_listed').replace(/_/g, ' ').toUpperCase();
  const addr = listing.street || '123 Main St';
  const city = listing.city || 'City';
  const specs = `${listing.beds || '—'} BD  ·  ${listing.baths || '—'} BA  ·  ${(listing.sqft || 0).toLocaleString()} SQFT`;
  const price = `$${(listing.price || 0).toLocaleString()}`;
  const photo1 = photos[0] || '';
  const photo2 = photos[1] || photos[0] || '';
  const photo3 = photos[2] || photos[0] || '';
  const photo4 = photos[3] || photos[1] || photos[0] || '';
  
  const brokerageName = brokerage?.brokerage || '';
  const brokerageLogo = brokerage?.brokerage_logo_url || '';
  const licenseNum = brokerage?.license_number || '';
  const disclaimer = brokerage?.brokerage_disclaimer || 'Equal Housing Opportunity';

  const brokerageBar = `
    <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:#111;display:flex;align-items:center;justify-content:space-between;padding:0 30px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${brokerageLogo ? `<img src="${brokerageLogo}" style="height:28px;max-width:80px;object-fit:contain;">` : ''}
        <span style="font-size:13px;color:#ccc;font-family:'DM Sans',sans-serif;">${brokerageName}${licenseNum ? ` · #${licenseNum}` : ''}</span>
      </div>
      <span style="font-size:10px;color:#888;font-family:'DM Sans',sans-serif;">${disclaimer}</span>
    </div>`;

  const layouts = {
    blk_custom: `
      <div style="width:1200px;height:1200px;background:#fff;position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;">
        <!-- Top specs bar -->
        <div style="display:flex;align-items:center;padding:20px 40px 15px;gap:10px;">
          <div style="display:flex;align-items:center;gap:30px;">
            <div style="text-align:center;"><div style="font-size:11px;letter-spacing:2px;color:#333;font-weight:300;">${listing.beds || '—'} BEDROOMS</div></div>
            <div style="text-align:center;"><div style="font-size:11px;letter-spacing:2px;color:#333;font-weight:300;">${listing.baths || '—'} BATHROOMS</div></div>
            <div style="text-align:center;"><div style="font-size:11px;letter-spacing:2px;color:#333;font-weight:300;">${(listing.sqft || 0).toLocaleString()} SQUARE FEET</div></div>
            <div style="text-align:center;"><div style="font-size:11px;letter-spacing:2px;color:#333;font-weight:300;">$${(listing.price || 0).toLocaleString()} DOLLARS</div></div>
          </div>
          <div style="margin-left:auto;font-family:'Georgia',serif;font-size:42px;font-style:italic;color:#1a1a1a;">${type === 'JUST LISTED' ? 'Just Listed!' : type === 'UNDER CONTRACT' ? 'Under Contract!' : type === 'PRICE CHANGE' ? 'New Price!' : type === 'SOLD' ? 'Sold!' : type}</div>
        </div>
        <!-- Photo grid -->
        <div style="display:grid;grid-template-columns:540px 1fr;gap:8px;padding:0 8px;height:730px;">
          <!-- Left column: 2 stacked photos -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <img src="${photo1}" style="width:100%;height:50%;object-fit:cover;">
            <img src="${photo2}" style="width:100%;height:50%;object-fit:cover;">
          </div>
          <!-- Right column: photo, logo block, photo -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <img src="${photo3}" style="width:100%;height:200px;object-fit:cover;">
            <div style="background:#000;display:flex;align-items:center;justify-content:center;flex:1;padding:20px;">
              <div style="text-align:center;">
                <div style="font-family:'DM Sans',sans-serif;color:#fff;font-size:48px;font-weight:700;letter-spacing:3px;">lpt realty</div>
                <div style="font-family:'DM Sans',sans-serif;color:#fff;font-size:16px;letter-spacing:6px;font-weight:300;">LISTING POWER TOOLS</div>
              </div>
            </div>
            <img src="${photo4}" style="width:100%;height:200px;object-fit:cover;">
          </div>
        </div>
        <!-- Bottom section -->
        <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:20px 40px 15px;">
          <div>
            <div style="font-family:'DM Serif Display',serif;font-size:52px;color:#1a1a1a;font-weight:700;line-height:1.1;"><span style="font-weight:800;">${(addr.match(/^\d+/) || [''])[0]}</span> ${addr.replace(/^\d+\s*/, '')}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:22px;letter-spacing:6px;color:#555;text-transform:uppercase;margin-top:4px;">${city}, ${listing.state || 'AR'}</div>
          </div>
          <div style="text-align:right;">
            <div style="width:120px;height:120px;background:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-size:42px;font-weight:800;font-family:'DM Sans',sans-serif;">BLK</span>
            </div>
          </div>
        </div>
        <div style="text-align:right;padding:0 40px 10px;font-family:'DM Sans',sans-serif;font-size:13px;letter-spacing:3px;color:#333;">MAKEARKANSASHOME.COM</div>
      </div>`,

    hero_bottom: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;">
        <img src="${photo1}" style="width:1200px;height:780px;object-fit:cover;">
        <div style="position:absolute;top:720px;left:0;right:0;bottom:60px;background:${t.bg};padding:40px 50px;">
          <div style="font-size:18px;letter-spacing:4px;color:${t.accent};font-weight:600;">${type}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:64px;margin-top:8px;line-height:1.1;">${addr}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:48px;opacity:.7;">${city}</div>
          <div style="display:flex;gap:30px;margin-top:16px;">
            <span style="font-size:20px;color:${t.accent};">${specs}</span>
            <span style="font-size:20px;color:${t.accent};font-weight:600;">${price}</span>
          </div>
        </div>
        ${brokerageBar}
      </div>`,

    photo_top: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;">
        <div style="padding:30px 30px 0;">
          <img src="${photo1}" style="width:1140px;height:620px;object-fit:cover;border-radius:12px;">
        </div>
        <div style="text-align:center;padding:40px 60px;">
          <div style="font-size:16px;letter-spacing:4px;color:${t.accent};font-weight:600;">${type}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:60px;margin-top:10px;line-height:1.15;">${addr}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:40px;opacity:.6;margin-top:4px;">${city}</div>
          <div style="font-size:18px;color:${t.accent};margin-top:16px;">${specs}  ·  ${price}</div>
          <div style="width:80px;height:1px;background:${t.accent};opacity:.3;margin:20px auto 0;"></div>
        </div>
        ${brokerageBar}
      </div>`,

    split_left: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;">
        <img src="${photo1}" style="width:600px;height:1200px;object-fit:cover;">
        <div style="width:600px;display:flex;flex-direction:column;justify-content:center;padding:60px;">
          <div style="font-size:16px;letter-spacing:4px;color:${t.accent};font-weight:600;">${type}</div>
          <div style="width:100px;height:1px;background:${t.accent};opacity:.4;margin:16px 0;"></div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:52px;line-height:1.15;margin-top:10px;">${addr}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:36px;opacity:.7;margin-top:4px;">${city}</div>
          <div style="font-size:17px;color:${t.accent};opacity:.7;margin-top:20px;">${specs}</div>
          <div style="font-size:28px;color:${t.accent};font-weight:600;margin-top:12px;">${price}</div>
        </div>
        ${brokerageBar}
      </div>`,

    framed_center: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;">
        <div style="background:${t.accent}33;border-radius:30px;padding:8px 24px;margin-top:50px;">
          <span style="font-size:14px;letter-spacing:3px;color:${t.accent};font-weight:600;">${type}</span>
        </div>
        <div style="margin-top:30px;width:700px;height:500px;border-radius:50%/40%;overflow:hidden;border:4px solid ${t.accent}44;">
          <img src="${photo1}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:56px;margin-top:30px;text-align:center;">${addr}</div>
        <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:36px;opacity:.7;margin-top:4px;">${city}</div>
        <div style="font-size:18px;color:${t.accent};opacity:.7;margin-top:16px;">${specs}  ·  ${price}</div>
        ${brokerageBar}
      </div>`,

    grid_banner: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;height:440px;">
          <img src="${photo1}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">
          <img src="${photo2}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">
        </div>
        <div style="background:${t.accent};padding:40px 50px;text-align:center;">
          <div style="font-size:16px;letter-spacing:4px;color:${t.bg};font-weight:600;">${type}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.bg};font-size:50px;margin-top:6px;">${addr}, ${city}</div>
          <div style="font-size:18px;color:${t.bg};opacity:.8;margin-top:6px;">${specs}  ·  ${price}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;flex:1;">
          <img src="${photo3}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">
          <img src="${photo4}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">
        </div>
        ${brokerageBar}
      </div>`,

    organic_cutout: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;align-items:center;">
        <div style="margin-top:60px;width:900px;height:600px;border-radius:50%;overflow:hidden;">
          <img src="${photo1}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="text-align:center;padding:40px 60px;">
          <div style="font-size:16px;letter-spacing:4px;color:${t.accent};font-weight:600;">${type}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:58px;margin-top:10px;">${addr}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:38px;opacity:.7;margin-top:4px;">${city}</div>
          <div style="font-size:18px;color:${t.accent};opacity:.7;margin-top:16px;">${specs}  ·  ${price}</div>
        </div>
        ${brokerageBar}
      </div>`,

    magazine: `
      <div style="width:1200px;height:1200px;position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;">
        <img src="${photo1}" style="width:1200px;height:1200px;object-fit:cover;filter:brightness(.35);">
        <div style="position:absolute;top:0;left:0;right:0;height:70px;background:${t.accent};display:flex;align-items:center;justify-content:space-between;padding:0 40px;">
          <span style="font-family:'DM Serif Display',serif;font-size:28px;color:${t.bg};font-weight:700;">${type}</span>
          <span style="font-size:14px;color:${t.bg};opacity:.8;">SLATE SOCIAL</span>
        </div>
        <div style="position:absolute;bottom:60px;left:0;right:0;padding:50px;">
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:80px;line-height:1.05;">${addr}</div>
          <div style="font-family:'DM Serif Display',serif;color:${t.text};font-size:48px;opacity:.8;margin-top:4px;">${city}</div>
          <div style="width:60px;height:3px;background:${t.accent};margin:16px 0;"></div>
          <div style="font-size:20px;color:${t.text};opacity:.8;">${specs}  ·  ${price}</div>
        </div>
        ${brokerageBar}
      </div>`,

    polaroid: `
      <div style="width:1200px;height:1200px;background:${t.bg};position:relative;overflow:hidden;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(-2deg);background:#fff;padding:20px 20px 80px;box-shadow:0 8px 40px rgba(0,0,0,.2);">
          <img src="${photo1}" style="width:900px;height:700px;object-fit:cover;">
          <div style="margin-top:16px;">
            <div style="font-family:'DM Serif Display',serif;color:#333;font-size:36px;">${addr}, ${city}</div>
            <div style="font-size:18px;color:#888;margin-top:6px;">${specs}  ·  ${price}</div>
          </div>
        </div>
        <div style="position:absolute;top:40px;right:100px;background:${t.accent}33;border-radius:30px;padding:10px 24px;">
          <span style="font-size:16px;letter-spacing:3px;color:${t.accent};font-weight:600;">${type}</span>
        </div>
        ${brokerageBar}
      </div>`,

    blk_custom: `
      <div style="width:1200px;height:1200px;background:#FFFFFF;position:relative;overflow:hidden;font-family:'Outfit',sans-serif;">
        <!-- Graphic type header top-right -->
        <div style="position:absolute;top:30px;right:40px;font-size:28px;font-weight:700;color:#111;letter-spacing:2px;z-index:10;">${type}</div>
        <!-- Specs bar -->
        <div style="position:absolute;top:83px;left:45px;right:45px;display:flex;gap:20px;">
          <span style="font-size:14px;letter-spacing:3px;color:#555;font-weight:300;text-transform:uppercase;">${listing.beds || '—'} BEDROOMS</span>
          <span style="font-size:14px;letter-spacing:3px;color:#555;font-weight:300;text-transform:uppercase;">${listing.baths || '—'} BATHROOMS</span>
          <span style="font-size:14px;letter-spacing:3px;color:#555;font-weight:300;text-transform:uppercase;">${(listing.sqft || 0).toLocaleString()} SQFT</span>
          <span style="font-size:14px;letter-spacing:3px;color:#555;font-weight:300;text-transform:uppercase;">${price}</span>
        </div>
        <!-- Photo grid area y:130 to y:935 -->
        <div style="position:absolute;top:130px;left:0;right:0;height:805px;background:#fff;">
          <!-- Top-left hero: 0,160 670x400 -->
          <img src="${photo1}" style="position:absolute;left:0;top:30px;width:670px;height:400px;object-fit:cover;">
          <!-- Bottom-left: 0,568 670x340 -->
          <img src="${photo2}" style="position:absolute;left:0;top:438px;width:670px;height:340px;object-fit:cover;">
          <!-- Top-right: 710,160 490x245 -->
          <img src="${photo3}" style="position:absolute;left:710px;top:30px;width:490px;height:245px;object-fit:cover;">
          <!-- Bottom-right: 710,690 490x230 -->
          <img src="${photo4}" style="position:absolute;left:710px;top:560px;width:490px;height:230px;object-fit:cover;">
          <!-- White dividers -->
          <div style="position:absolute;left:670px;top:0;width:40px;height:100%;background:#fff;"></div>
          <div style="position:absolute;left:0;top:430px;width:670px;height:8px;background:#fff;"></div>
          <div style="position:absolute;left:710px;top:275px;width:490px;height:285px;background:#fff;display:flex;align-items:center;justify-content:center;">
            <div style="font-size:14px;letter-spacing:2px;color:#888;text-align:center;">LPT REALTY</div>
          </div>
        </div>
        <!-- Address block -->
        <div style="position:absolute;left:45px;top:960px;">
          <div style="font-family:'DM Serif Display',Georgia,serif;font-size:68px;color:#111;font-weight:700;line-height:1.1;">${addr}</div>
        </div>
        <!-- City -->
        <div style="position:absolute;left:0;right:0;top:1050px;text-align:center;">
          <span style="font-size:28px;letter-spacing:4px;color:#555;font-weight:300;text-transform:uppercase;">${city}, ${listing.state || 'AR'}</span>
        </div>
        <!-- Website -->
        <div style="position:absolute;left:0;right:0;bottom:30px;text-align:center;">
          <span style="font-size:16px;letter-spacing:4px;color:#999;font-weight:300;">MAKEARKANSASHOME.COM</span>
        </div>
        ${brokerageBar}
      </div>`,
  };

  const body = layouts[t.layout] || layouts.hero_bottom;

  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>*{margin:0;padding:0;box-sizing:border-box}</style>
  </head><body style="margin:0;padding:0;">${body}</body></html>`;
}

// ═══════════════════════════════════════════
// GRAPHICS ENDPOINT
// ═══════════════════════════════════════════
app.post('/render-graphic', async (req, res) => {
  const { graphic_id } = req.body;
  if (!graphic_id) return res.status(400).json({ error: 'graphic_id required' });

  console.log(`[GRAPHIC] Starting render for ${graphic_id}`);

  try {
    // 1. Get graphic record
    const { data: graphic, error: gErr } = await sb.from('graphics').select('*').eq('id', graphic_id).single();
    if (gErr || !graphic) return res.status(404).json({ error: 'Graphic not found' });

    // 2. Get listing
    const { data: listing } = await sb.from('listings').select('*').eq('id', graphic.listing_id).single();
    console.log(`[GRAPHIC] Listing:`, listing ? `${listing.street}, ${listing.city}` : 'NOT FOUND');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // 3. Get client (for brokerage info and template)
    const { data: client } = await sb.from('clients').select('*').eq('id', graphic.client_id).single();
    console.log(`[GRAPHIC] Client:`, client ? client.first_name : 'NOT FOUND');

    // 4. Get photos
    const { data: photoRows } = await sb.from('listing_photos').select('*').eq('listing_id', listing.id).order('created_at', { ascending: false }).limit(1);
    let photos = [];
    if (photoRows && photoRows.length > 0) {
      const pr = photoRows[0];
      photos = [pr.photo_url_1, pr.photo_url_2, pr.photo_url_3, pr.photo_url_4].filter(Boolean);
    }
    if (photos.length === 0) {
      // Fallback: check listing table for photo URLs
      photos = [listing.photo_url_1, listing.photo_url_2, listing.photo_url_3, listing.photo_url_4].filter(Boolean);
    }

    // 5. Determine template
    const template = client?.template_style || 'bold_dark';
    console.log(`[GRAPHIC] Template style: ${template}`);

    // 6. Check for custom uploaded design with AI-generated template
    const { data: customDesigns } = await sb.from('client_designs').select('*').eq('client_id', graphic.client_id).order('created_at', { ascending: false }).limit(1);
    const customDesign = (customDesigns && customDesigns.length > 0) ? customDesigns[0] : null;
    
    if (customDesign && customDesign.template_html && template !== 'blk_custom') {
      console.log(`[GRAPHIC] Using AI-generated custom template: ${customDesign.name}`);
      try {
        // Replace placeholders in the saved template HTML
        let customHtml = customDesign.template_html;
        customHtml = customHtml.replace(/\{\{PHOTO_1\}\}/g, photos[0] || '');
        customHtml = customHtml.replace(/\{\{PHOTO_2\}\}/g, photos[1] || photos[0] || '');
        customHtml = customHtml.replace(/\{\{PHOTO_3\}\}/g, photos[2] || photos[0] || '');
        customHtml = customHtml.replace(/\{\{PHOTO_4\}\}/g, photos[3] || photos[1] || photos[0] || '');
        customHtml = customHtml.replace(/\{\{STREET\}\}/g, listing.street || '');
        customHtml = customHtml.replace(/\{\{CITY\}\}/g, listing.city || '');
        customHtml = customHtml.replace(/\{\{STATE\}\}/g, listing.state || '');
        customHtml = customHtml.replace(/\{\{BEDS\}\}/g, String(listing.beds || '—'));
        customHtml = customHtml.replace(/\{\{BATHS\}\}/g, String(listing.baths || '—'));
        customHtml = customHtml.replace(/\{\{SQFT\}\}/g, (listing.sqft || 0).toLocaleString());
        customHtml = customHtml.replace(/\{\{PRICE\}\}/g, '$' + (listing.price || 0).toLocaleString());
        customHtml = customHtml.replace(/\{\{GRAPHIC_TYPE\}\}/g, (graphic.graphic_type || 'just_listed').replace(/_/g, ' ').toUpperCase());
        customHtml = customHtml.replace(/\{\{BROKERAGE\}\}/g, client?.brokerage || '');
        customHtml = customHtml.replace(/\{\{BROKERAGE_LOGO\}\}/g, client?.brokerage_logo_url || '');
        customHtml = customHtml.replace(/\{\{LICENSE\}\}/g, client?.license_number || '');
        customHtml = customHtml.replace(/\{\{DISCLAIMER\}\}/g, client?.brokerage_disclaimer || 'Equal Housing Opportunity');
        customHtml = customHtml.replace(/\{\{WEBSITE\}\}/g, client?.website || '');

        // Render with Puppeteer
        console.log(`[GRAPHIC] Launching Puppeteer for custom template...`);
        const browser = await puppeteer.launch({
          headless: 'new',
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1200 });
        await page.setContent(customHtml, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluate(() => Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; }))));
        const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 1200 } });
        await browser.close();

        const optimized = await sharp(screenshot).png({ quality: 90, compressionLevel: 6 }).toBuffer();
        const filename = `${graphic.client_id}/graphics/${graphic_id}.png`;
        const { error: upErr } = await sb.storage.from('listing-photos').upload(filename, optimized, { contentType: 'image/png', upsert: true });
        if (upErr) throw new Error('Upload failed: ' + upErr.message);

        const fileUrl = `${SUPA_URL}/storage/v1/object/public/listing-photos/${filename}`;
        await sb.from('graphics').update({ file_url: fileUrl, status: 'ready' }).eq('id', graphic_id);

        console.log(`[GRAPHIC] Custom template done! ${fileUrl}`);
        return res.json({ success: true, file_url: fileUrl, engine: 'custom_ai_template' });
      } catch (custErr) {
        console.error(`[GRAPHIC] Custom template error:`, custErr.message);
        console.log(`[GRAPHIC] Falling back to preset HTML render`);
      }
    }

    // 7. Generate HTML
    const brokerage = {
      brokerage: client?.brokerage,
      brokerage_logo_url: client?.brokerage_logo_url,
      license_number: client?.license_number,
      brokerage_disclaimer: client?.brokerage_disclaimer,
    };
    const html = generateGraphicHTML(listing, template, photos, brokerage, graphic.graphic_type);

    // 8. Render with Puppeteer
    console.log(`[GRAPHIC] Launching Puppeteer for template: ${template}`);
    console.log(`[GRAPHIC] Photos found: ${photos.length}`, photos);
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    console.log('[GRAPHIC] Browser launched OK');
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1200 });
    console.log('[GRAPHIC] Setting page content...');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('[GRAPHIC] Content loaded, waiting for images...');
    
    // Wait for images to load
    await page.evaluate(() => {
      return Promise.all(Array.from(document.images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));
    });

    const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 1200 } });
    await browser.close();
    console.log(`[GRAPHIC] Screenshot taken: ${screenshot.length} bytes`);

    // 9. Optimize with Sharp
    const optimized = await sharp(screenshot).png({ quality: 90, compressionLevel: 6 }).toBuffer();

    // 10. Upload to Supabase Storage
    const filename = `${graphic.client_id}/graphics/${graphic_id}.png`;
    const { data: uploadData, error: upErr } = await sb.storage
      .from('listing-photos')
      .upload(filename, optimized, { contentType: 'image/png', upsert: true });

    if (upErr) {
      console.error(`[GRAPHIC] Upload error:`, upErr);
      await sb.from('graphics').update({ status: 'error' }).eq('id', graphic_id);
      return res.status(500).json({ error: 'Upload failed', details: upErr });
    }

    const fileUrl = `${SUPA_URL}/storage/v1/object/public/listing-photos/${filename}`;

    // 11. Update graphic record
    await sb.from('graphics').update({ file_url: fileUrl, status: 'ready' }).eq('id', graphic_id);

    console.log(`[GRAPHIC] Done! ${fileUrl}`);
    res.json({ success: true, file_url: fileUrl, engine: 'html_render' });

  } catch (err) {
    console.error(`[GRAPHIC] Error:`, err);
    await sb.from('graphics').update({ status: 'error' }).eq('id', graphic_id).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// VIDEO ENDPOINT - Photo slideshow
// ═══════════════════════════════════════════
app.post('/render-video', async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  console.log(`[VIDEO] Starting render for ${video_id}`);

  try {
    // 1. Get video request
    const { data: video, error: vErr } = await sb.from('video_requests').select('*').eq('id', video_id).single();
    if (vErr || !video) return res.status(404).json({ error: 'Video request not found' });

    // Update status to editing
    await sb.from('video_requests').update({ status: 'editing' }).eq('id', video_id);

    // 2. Get photos (from video_requests.photo_urls or listing)
    let photos = video.photo_urls || [];
    if (photos.length === 0 && video.listing_id) {
      const { data: photoRows } = await sb.from('listing_photos').select('*').eq('listing_id', video.listing_id).order('created_at', { ascending: false }).limit(1);
      if (photoRows && photoRows[0]) {
        photos = [photoRows[0].photo_url_1, photoRows[0].photo_url_2, photoRows[0].photo_url_3, photoRows[0].photo_url_4].filter(Boolean);
      }
    }

    if (photos.length === 0) {
      await sb.from('video_requests').update({ status: 'error', notes: 'No photos found' }).eq('id', video_id);
      return res.status(400).json({ error: 'No photos to create video from' });
    }

    // 3. Get listing info for text overlays
    let listing = null;
    if (video.listing_id) {
      const { data: l } = await sb.from('listings').select('*').eq('id', video.listing_id).single();
      listing = l;
    }

    // 4. Get client for branding
    const { data: client } = await sb.from('clients').select('*').eq('id', video.client_id).single();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slate-video-'));
    const duration = video.duration || 30;
    const durationPerPhoto = Math.max(2, Math.floor(duration / photos.length));

    // 5. Download and prepare photos
    console.log(`[VIDEO] Downloading ${photos.length} photos...`);
    for (let i = 0; i < photos.length; i++) {
      const photoRes = await fetch(photos[i]);
      const buf = await photoRes.buffer();
      // Resize to 1080x1920 (9:16 vertical) or 1080x1080 (square)
      const resized = await sharp(buf)
        .resize(1080, 1080, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      fs.writeFileSync(path.join(tmpDir, `photo_${String(i).padStart(3, '0')}.jpg`), resized);
    }

    // 6. Create FFmpeg concat file
    const concatFile = path.join(tmpDir, 'concat.txt');
    let concatContent = '';
    for (let i = 0; i < photos.length; i++) {
      concatContent += `file 'photo_${String(i).padStart(3, '0')}.jpg'\nduration ${durationPerPhoto}\n`;
    }
    // Add last photo again (FFmpeg concat demuxer quirk)
    concatContent += `file 'photo_${String(photos.length - 1).padStart(3, '0')}.jpg'\n`;
    fs.writeFileSync(concatFile, concatContent);

    // 7. Build FFmpeg command with fade transitions
    const outputFile = path.join(tmpDir, 'output.mp4');
    
    // Build filter for crossfade between images
    const fadeDuration = 0.5;
    let filterComplex = '';
    let inputs = '';
    
    // Simple approach: concat with crossfade using image inputs
    for (let i = 0; i < photos.length; i++) {
      inputs += `-loop 1 -t ${durationPerPhoto} -i ${path.join(tmpDir, `photo_${String(i).padStart(3, '0')}.jpg`)} `;
    }

    if (photos.length === 1) {
      // Single photo - just hold it
      filterComplex = `[0:v]scale=1080:1080,format=yuv420p[v]`;
    } else if (photos.length <= 6) {
      // Crossfade between photos
      let prev = '0:v';
      for (let i = 0; i < photos.length; i++) {
        filterComplex += `[${i}:v]scale=1080:1080,setsar=1,fade=t=in:st=0:d=${fadeDuration}:alpha=0,fade=t=out:st=${durationPerPhoto - fadeDuration}:d=${fadeDuration}:alpha=0[v${i}];`;
      }
      // Overlay them on a black background
      filterComplex += `color=c=black:s=1080x1080:d=${duration}[base];`;
      let current = 'base';
      for (let i = 0; i < photos.length; i++) {
        const offset = i * (durationPerPhoto - fadeDuration);
        const next = i === photos.length - 1 ? 'v' : `tmp${i}`;
        filterComplex += `[${current}][v${i}]overlay=enable='between(t,${offset},${offset + durationPerPhoto})'[${next}];`;
        current = next;
      }
      // Remove trailing semicolon
      filterComplex = filterComplex.replace(/;$/, '');
    } else {
      // Many photos - use simpler concat with fade
      filterComplex = photos.map((_, i) =>
        `[${i}:v]scale=1080:1080,setsar=1[s${i}]`
      ).join(';') + ';' +
        photos.map((_, i) => `[s${i}]`).join('') +
        `concat=n=${photos.length}:v=1:a=0,format=yuv420p[v]`;
    }

    const ffmpegCmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[v]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart ${outputFile}`;

    console.log(`[VIDEO] Running FFmpeg...`);
    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) { console.error('[VIDEO] FFmpeg error:', stderr); reject(err); }
        else resolve();
      });
    });

    // 8. Read output and upload
    const videoBuffer = fs.readFileSync(outputFile);
    const videoFilename = `${video.client_id}/videos/${video_id}.mp4`;

    const { error: upErr } = await sb.storage
      .from('listing-photos')
      .upload(videoFilename, videoBuffer, { contentType: 'video/mp4', upsert: true });

    if (upErr) {
      console.error(`[VIDEO] Upload error:`, upErr);
      await sb.from('video_requests').update({ status: 'error' }).eq('id', video_id);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const fileUrl = `${SUPA_URL}/storage/v1/object/public/listing-photos/${videoFilename}`;

    // 9. Update record
    await sb.from('video_requests').update({ final_video_url: fileUrl, status: 'complete' }).eq('id', video_id);

    // 10. Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log(`[VIDEO] Done! ${fileUrl}`);
    res.json({ success: true, file_url: fileUrl });

  } catch (err) {
    console.error(`[VIDEO] Error:`, err);
    await sb.from('video_requests').update({ status: 'error' }).eq('id', video_id).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// WEBHOOK ENDPOINT - Supabase triggers this
// ═══════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const { type, table, record } = req.body;
  console.log(`[WEBHOOK] ${type} on ${table}: ${record?.id}`);

  if (table === 'graphics' && record?.status === 'generating') {
    // Trigger graphic render
    res.json({ received: true });
    try {
      const selfUrl = `http://localhost:${process.env.PORT || 3000}`;
      await fetch(`${selfUrl}/render-graphic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphic_id: record.id }),
      });
    } catch (e) { console.error('[WEBHOOK] Graphic trigger failed:', e.message); }
    return;
  }

  if (table === 'video_requests' && record?.status === 'pending') {
    // Trigger video render
    res.json({ received: true });
    try {
      const selfUrl = `http://localhost:${process.env.PORT || 3000}`;
      await fetch(`${selfUrl}/render-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: record.id }),
      });
    } catch (e) { console.error('[WEBHOOK] Video trigger failed:', e.message); }
    return;
  }

  res.json({ received: true, action: 'none' });
});

// ═══════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    service: 'Slate Engine',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/render-graphic', '/render-video', '/webhook'],
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Slate Engine running on port ${PORT}`);
  console.log(`  Graphics: POST /render-graphic`);
  console.log(`  Videos:   POST /render-video`);
  console.log(`  Webhook:  POST /webhook`);
});
