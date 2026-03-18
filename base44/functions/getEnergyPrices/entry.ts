import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz ceny z PSE (Polskie Sieci Elektroenergetyczne)
    // Dane RCE (Rynkowa Cena Energii) z Raporty PSE
    const response = await fetch(
      'https://www.pse.pl/getcsv/-/export/csv/PL_CENY_RYNKOWE/data_od/2026-02-04/data_do/2026-02-05'
    );

    if (!response.ok) {
      // Fallback - średnia cena netto w taryfie dynamicznej
      return Response.json({
        net_price: 0.60,
        gross_price: 1.50,
        tax_percentage: 60,
        currency: 'PLN',
        unit: 'kWh',
        source: 'fallback (taryfa dynamiczna)',
        timestamp: new Date().toISOString()
      });
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    
    // Pomiń nagłówek i weź ostatnie dostępne ceny
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    if (dataLines.length === 0) {
      throw new Error('Brak danych cenowych');
    }

    // Parsuj ostatnie 24h cen (format CSV: Data, Godzina, Cena)
    const prices = dataLines
      .map(line => {
        const parts = line.split(';');
        return parseFloat(parts[2]?.replace(',', '.'));
      })
      .filter(price => !isNaN(price) && price > 0);

    // Średnia cena RCE (to jest cena hurtowa/netto)
    const avgNetPrice = prices.reduce((a, b) => a + b, 0) / prices.length / 1000; // MWh -> kWh
    const currentNetPrice = prices[prices.length - 1] / 1000;

    // Cena netto w taryfie dynamicznej (RCE + marża operatora ~10%)
    const netPriceWithMargin = currentNetPrice * 1.10;
    
    // Cena brutto (netto + 60% podatków i opłat)
    const grossPrice = netPriceWithMargin * 2.5; // ~1.5 zł/kWh

    return Response.json({
      net_price: parseFloat(netPriceWithMargin.toFixed(3)),
      gross_price: parseFloat(grossPrice.toFixed(2)),
      tax_percentage: 60,
      currency: 'PLN',
      unit: 'kWh',
      source: 'PSE - Raporty (taryfa dynamiczna)',
      timestamp: new Date().toISOString(),
      raw_rce_price: parseFloat(currentNetPrice.toFixed(3))
    });

  } catch (error) {
    // Fallback w przypadku błędu
    return Response.json({
      net_price: 0.60,
      gross_price: 1.50,
      tax_percentage: 60,
      currency: 'PLN',
      unit: 'kWh',
      source: 'fallback (taryfa dynamiczna)',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});