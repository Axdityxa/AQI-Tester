const { getAQIWithConfidence } = require('./aqi-service');

async function findOutdoorSpots(lat, lon, activityType) {
    const spots = [];
    const radius = 5; // km

    // Get AQI data for surrounding areas
    const aqiGrid = await getAQIGrid(lat, lon, radius);
    
    // Find areas with good AQI
    const goodSpots = aqiGrid.filter(spot => spot.aqi <= 100);

    // Sort by combination of:
    // 1. AQI quality
    // 2. Distance from user
    // 3. Available amenities
    goodSpots.sort((a, b) => {
        const scoreA = calculateSpotScore(a, activityType);
        const scoreB = calculateSpotScore(b, activityType);
        return scoreB - scoreA;
    });

    // Return top 5 spots
    return goodSpots.slice(0, 5).map(spot => ({
        location: spot.location,
        aqi: spot.aqi,
        distance: spot.distance,
        bestTime: getRecommendedTime(spot.aqi),
        confidence: spot.confidence,
        amenities: spot.amenities
    }));
}

async function getAQIGrid(lat, lon, radius) {
    const grid = [];
    const step = 0.01; // approximately 1km
    
    for (let dlat = -radius*step; dlat <= radius*step; dlat += step) {
        for (let dlon = -radius*step; dlon <= radius*step; dlon += step) {
            const spotLat = lat + dlat;
            const spotLon = lon + dlon;
            
            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const aqiData = await getAQIWithConfidence(spotLat, spotLon);
            if (aqiData && aqiData.aqi) {
                grid.push({
                    location: { lat: spotLat, lon: spotLon },
                    aqi: aqiData.aqi,
                    distance: calculateDistance(lat, lon, spotLat, spotLon),
                    confidence: aqiData.confidence,
                    amenities: await getLocalAmenities(spotLat, spotLon)
                });
            }
        }
    }
    return grid;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateSpotScore(spot, activityType) {
    const weights = {
        aqi: 0.4,
        distance: 0.3,
        amenities: 0.3
    };

    const aqiScore = Math.max(0, 1 - (spot.aqi / 150));
    const distanceScore = Math.max(0, 1 - (spot.distance / 5));
    const amenityScore = spot.amenities[activityType] || 0;

    return (
        aqiScore * weights.aqi +
        distanceScore * weights.distance +
        amenityScore * weights.amenities
    );
}

function getRecommendedTime(aqi) {
    if (aqi <= 50) return 'Any time';
    if (aqi <= 100) return 'Early morning or evening';
    if (aqi <= 150) return 'Early morning only';
    return 'Not recommended';
}

async function getLocalAmenities(lat, lon) {
    // Simplified version - in real app, you'd use a places API
    return {
        jogging: 0.8,
        walking: 0.9,
        cycling: 0.7
    };
}

module.exports = {
    findOutdoorSpots,
    getAQIGrid,
    calculateSpotScore,
    getRecommendedTime
}; 