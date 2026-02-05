import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lat = 52.23, lon = 21.01 } = await req.json(); // Domyślnie Warszawa

    // Open-Meteo - darmowe API bez klucza
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunshine_duration&timezone=Europe/Warsaw&forecast_days=7`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const data = await response.json();
    
    // Przelicz godziny słoneczne na przewidywaną produkcję
    const dailyData = data.daily.time.map((date, index) => {
      const sunHours = data.daily.sunshine_duration[index] / 3600; // sekundy na godziny
      return {
        date,
        sun_hours: parseFloat(sunHours.toFixed(1)),
        production_factor: parseFloat((sunHours / 12 * 100).toFixed(0)) // % z maksymalnej produkcji
      };
    });

    const avgSunHours = dailyData.reduce((sum, day) => sum + day.sun_hours, 0) / dailyData.length;
    const avgProductionFactor = dailyData.reduce((sum, day) => sum + day.production_factor, 0) / dailyData.length;

    return Response.json({
      location: {
        lat,
        lon
      },
      forecast: dailyData,
      summary: {
        avg_sun_hours: parseFloat(avgSunHours.toFixed(1)),
        avg_production_factor: parseFloat(avgProductionFactor.toFixed(0))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});