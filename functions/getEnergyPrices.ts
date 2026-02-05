import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz ceny z Open-Meteo (darmowe API) - alternatywnie można użyć ENTSO-E
    // Open-Meteo nie wymaga klucza API
    const response = await fetch(
      'https://api.energy-charts.info/price?country=pl'
    );

    if (!response.ok) {
      // Fallback do przeciętnej ceny w Polsce
      return Response.json({
        current_price: 0.85,
        average_price: 0.85,
        currency: 'PLN',
        unit: 'kWh',
        source: 'fallback',
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    
    // Przetwórz dane - ostatnia dostępna cena
    const prices = data.price || [];
    const currentPrice = prices.length > 0 ? prices[prices.length - 1] / 100 : 0.85;
    const avgPrice = prices.length > 0 
      ? prices.reduce((a, b) => a + b, 0) / prices.length / 100 
      : 0.85;

    return Response.json({
      current_price: parseFloat(currentPrice.toFixed(2)),
      average_price: parseFloat(avgPrice.toFixed(2)),
      currency: 'PLN',
      unit: 'kWh',
      source: 'energy-charts',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Fallback w przypadku błędu
    return Response.json({
      current_price: 0.85,
      average_price: 0.85,
      currency: 'PLN',
      unit: 'kWh',
      source: 'fallback',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});