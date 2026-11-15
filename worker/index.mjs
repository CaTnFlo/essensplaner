import catalog from '../data/recipes.json' with { type: 'json' };
import { einkaufsliste } from '../js/shopping.js';
import { gesamtEinkauf } from '../js/bring.js';

export function importRecipe(raw) {
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.length || entries.length > 3) throw new Error('Invalid selection');
  const slots = {};
  for (const [i, entry] of entries.entries()) {
    const recipe = catalog.rezepte.find(r => r.id === entry.id);
    if (!recipe) throw new Error('Unknown recipe');
    const variante = entry.variante ?? {};
    const groups = recipe.variantenGruppen ?? [];
    if (Object.keys(variante).some(k => !groups.some(g => g.id === k))) throw new Error('Unknown variant');
    for (const group of groups) if (!group.optionen.some(o => o.id === variante[group.id])) throw new Error('Missing variant');
    slots[['A','B','C'][i]] = {quelle:'rezept',id:recipe.id,variante};
  }
  const list = gesamtEinkauf(einkaufsliste({plan:{slots},recipes:catalog.rezepte,state:{links:[]}}));
  return {'@context':'https://schema.org','@type':'Recipe',name:'Einkauf für die ganze Woche',author:{'@type':'Organization',name:'Essensplaner'},recipeYield:'4 Portionen',recipeIngredient:list.map(p=>[p.menge == null ? '' : String(p.menge).replace('.',','),p.einheit,p.name].filter(Boolean).join(' '))};
}
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed',{status:405});
    if (url.pathname !== '/einkauf') return new Response('Not found',{status:404});
    const raw = url.searchParams.get('gerichte') ?? '';
    if (raw.length > 4096) return new Response('Selection too long',{status:400});
    try {
      const recipe = importRecipe(raw);
      const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${recipe.name}</title><script type="application/ld+json">${JSON.stringify(recipe).replace(/</g,'\\u003c')}</script><body><h1>${recipe.name}</h1><p>Alle hinterlegten Zutaten ohne Vorräte. Mengen für vier Portionen je Gericht.</p><ul>${recipe.recipeIngredient.map(p=>`<li>${escape(p)}</li>`).join('')}</ul><a href="https://catnflo.github.io/essensplaner/">Zum Essensplaner</a></body></html>`;
      return new Response(request.method === 'HEAD' ? null : html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    } catch { return new Response('Invalid recipe selection',{status:400}); }
  }
};
