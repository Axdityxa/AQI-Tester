require('dotenv').config();
const axios = require('axios');

const WAQI_API_KEY = process.env.WAQI_API_KEY;
const IQAIR_API_KEY = process.env.IQAIR_API_KEY;

async function getWAQIData(lat, lon) {
    try {
        const response = await axios.get(
            `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_API_KEY}`
        );
        
        if (response.data.status === 'ok') {
            const data = response.data.data;
            return {
                aqi: data.aqi,
                distance: data.city.distance || 0,
                station: data.city.name,
                timestamp: data.time.iso
            };
        }
        return null;
    } catch (error) {
        console.error('WAQI API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return null;
    }
}

async function getIQAirData(lat, lon) {
    try {
        const response = await axios.get(
            `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${IQAIR_API_KEY}`
        );
        
        if (response.data.status === 'success') {
            const data = response.data.data;
            return {
                aqi: data.current.pollution.aqius,
                distance: 0,
                station: `${data.city}, ${data.state}`,
                timestamp: new Date().toISOString()
            };
        }
        return null;
    } catch (error) {
        console.error('IQAir API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return null;
    }
}

function calculateWeightedAQI(sources) {
    if (sources.length === 0) return null;

    // Weight factors
    const weights = {
        WAQI: 0.6,
        IQAir: 0.4
    };

    let totalWeight = 0;
    let weightedSum = 0;

    sources.forEach(source => {
        const weight = weights[source.name];
        if (weight) {
            // Adjust weight based on distance
            const distanceAdjustedWeight = weight * Math.max(0.5, 1 - (source.distance / 20));
            weightedSum += source.aqi * distanceAdjustedWeight;
            totalWeight += distanceAdjustedWeight;
        }
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : sources[0].aqi;
}

async function getAQIWithConfidence(lat, lon) {
    try {
        // Get data from both APIs
        const [waqiData, iqairData] = await Promise.allSettled([
            getWAQIData(lat, lon),
            getIQAirData(lat, lon)
        ]);
        
        // Initialize response object
        const aqiInfo = {
            aqi: null,
            confidence: 'low',
            nearestStation: null,
            distance: null,
            recommendations: {},
            sources: []
        };

        // Add WAQI data if available
        if (waqiData.status === 'fulfilled' && waqiData.value) {
            aqiInfo.sources.push({
                name: 'WAQI',
                aqi: waqiData.value.aqi,
                distance: waqiData.value.distance,
                station: waqiData.value.station
            });
        }

        // Add IQAir data if available
        if (iqairData.status === 'fulfilled' && iqairData.value) {
            aqiInfo.sources.push({
                name: 'IQAir',
                aqi: iqairData.value.aqi,
                distance: iqairData.value.distance,
                station: iqairData.value.station
            });
        }

        // Calculate final AQI and confidence if we have any data
        if (aqiInfo.sources.length > 0) {
            aqiInfo.aqi = calculateWeightedAQI(aqiInfo.sources);
            aqiInfo.confidence = calculateConfidence(aqiInfo.sources);
            aqiInfo.recommendations = getActivityRecommendations(aqiInfo.aqi);
            aqiInfo.nearestStation = aqiInfo.sources[0].station;
        }

        return aqiInfo;
    } catch (error) {
        console.error('Error getting AQI data:', error);
        return null;
    }
}

function getActivityRecommendations(aqi) {
    const recommendations = {
        jogging: { suitable: false },
        walking: { suitable: false },
        cycling: { suitable: false },
        bestTime: 'Not recommended',
        alternatives: []
    };

    if (!aqi) return recommendations;

    if (aqi <= 50) {
        // Good AQI
        recommendations.jogging.suitable = true;
        recommendations.walking.suitable = true;
        recommendations.cycling.suitable = true;
        recommendations.bestTime = 'Any time during the day';
    } else if (aqi <= 100) {
        // Moderate
        recommendations.jogging.suitable = true;
        recommendations.walking.suitable = true;
        recommendations.cycling.suitable = true;
        recommendations.bestTime = 'Early morning or evening';
        recommendations.alternatives = ['Indoor gym'];
    } else if (aqi <= 150) {
        // Unhealthy for Sensitive Groups
        recommendations.walking.suitable = true;
        recommendations.bestTime = 'Early morning only';
        recommendations.alternatives = ['Indoor activities'];
    } else {
        // Unhealthy or worse
        recommendations.alternatives = ['Indoor activities', 'Swimming', 'Indoor sports'];
    }

    return recommendations;
}

function calculateConfidence(sources) {
    // Calculate confidence based on:
    // 1. Number of sources
    // 2. Distance to stations
    // 3. Data freshness
    // 4. Agreement between sources
    let confidence = 'low';
    
    if (sources.length > 1 && sources.every(s => s.distance < 5)) {
        confidence = 'high';
    } else if (sources.length > 0 && sources.some(s => s.distance < 10)) {
        confidence = 'medium';
    }

    return confidence;
}

module.exports = {
    getAQIWithConfidence,
    getActivityRecommendations,
    calculateConfidence,
    getWAQIData,
    getIQAirData,
    calculateWeightedAQI
}; 