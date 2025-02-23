require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { getAQIWithConfidence } = require('./aqi-service');
const { findOutdoorSpots } = require('./location-service');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Get AQI and recommendations for current location
app.get('/api/aqi/current', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({
                error: 'Missing required parameters: lat and lon'
            });
        }

        const aqiData = await getAQIWithConfidence(lat, lon);
        
        if (!aqiData) {
            return res.status(404).json({
                error: 'Unable to fetch AQI data for this location'
            });
        }

        res.json({
            aqi: aqiData.aqi,
            confidence: aqiData.confidence,
            recommendations: aqiData.recommendations,
            nearestStation: aqiData.nearestStation,
            sources: aqiData.sources
        });
    } catch (error) {
        console.error('Route Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Find suitable spots for activities
app.get('/api/spots', async (req, res) => {
    const { lat, lon, activity } = req.query;
    const spots = await findOutdoorSpots(lat, lon, activity);
    
    res.json({
        spots,
        timestamp: new Date(),
        note: spots.length === 0 ? 
            "No suitable outdoor locations found. Consider indoor activities." : 
            "Listed spots are ordered by suitability."
    });
});

// Add this new route
app.get('/api/test', async (req, res) => {
    try {
        // Test IQAir API
        const iqairResponse = await axios.get(
            `https://api.airvisual.com/v2/nearest_city?lat=12.9716&lon=77.5946&key=${IQAIR_API_KEY}`
        );
        
        // Test WAQI API
        const waqiResponse = await axios.get(
            `https://api.waqi.info/feed/geo:12.9716;77.5946/?token=${WAQI_API_KEY}`
        );

        res.json({
            iqair: {
                status: 'ok',
                data: iqairResponse.data
            },
            waqi: {
                status: 'ok',
                data: waqiResponse.data
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'API Test Failed',
            details: {
                message: error.message,
                response: error.response?.data
            }
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 


// http://localhost:3000/api/aqi/current?lat=12.9716&lon=77.5946
// http://localhost:3000/api/spots?lat=12.9716&lon=77.5946&activity=jogging