require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.WAQI_API_KEY;

// Debug API key
console.log('API Key:', API_KEY);
if (!API_KEY) {
    console.error('WAQI API key is missing!');
    process.exit(1);
}

async function getStationData(cityName) {
    try {
        // First get the nearest station data
        const response = await axios.get(
            `https://api.waqi.info/feed/${cityName}/?token=${API_KEY}`
        );

        if (response.data.status === 'ok') {
            const data = response.data.data;
            console.log('\nAQI Information:');
            console.log('----------------');
            console.log(`Location: ${data.city.name}`);
            console.log(`AQI: ${data.aqi}`);
            console.log(`Last Updated: ${data.time.s}`);

            console.log('\nPollutant Details:');
            console.log('-----------------');
            const pollutants = data.iaqi;
            for (const [key, value] of Object.entries(pollutants)) {
                switch(key) {
                    case 'pm25':
                        console.log(`PM2.5: ${value.v} μg/m³`);
                        break;
                    case 'pm10':
                        console.log(`PM10: ${value.v} μg/m³`);
                        break;
                    case 'o3':
                        console.log(`Ozone (O3): ${value.v} μg/m³`);
                        break;
                    case 'no2':
                        console.log(`Nitrogen Dioxide (NO2): ${value.v} μg/m³`);
                        break;
                    case 'so2':
                        console.log(`Sulfur Dioxide (SO2): ${value.v} μg/m³`);
                        break;
                    case 'co':
                        console.log(`Carbon Monoxide (CO): ${value.v} mg/m³`);
                        break;
                    case 't':
                        console.log(`Temperature: ${value.v}°C`);
                        break;
                    case 'h':
                        console.log(`Humidity: ${value.v}%`);
                        break;
                    case 'w':
                        console.log(`Wind Speed: ${value.v} m/s`);
                        break;
                }
            }

            // Display AQI category
            console.log('\nAQI Category:');
            console.log('-------------');
            const aqi = data.aqi;
            if (aqi <= 50) {
                console.log('Good (0-50)');
            } else if (aqi <= 100) {
                console.log('Moderate (51-100)');
            } else if (aqi <= 150) {
                console.log('Unhealthy for Sensitive Groups (101-150)');
            } else if (aqi <= 200) {
                console.log('Unhealthy (151-200)');
            } else if (aqi <= 300) {
                console.log('Very Unhealthy (201-300)');
            } else {
                console.log('Hazardous (301+)');
            }

            // Display attribution (required by WAQI)
            console.log('\nData provided by the World Air Quality Index Project');
            console.log('https://aqicn.org');

        } else {
            console.error('No data available for this location');
        }
    } catch (error) {
        console.error('Error:', error.response?.data?.message || error.message);
    }
}

// Search function to get station by coordinates
async function searchByGeo(lat, lon) {
    try {
        const response = await axios.get(
            `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${API_KEY}`
        );
        
        if (response.data.status === 'ok') {
            return response.data.data;
        }
        return null;
    } catch (error) {
        console.error('Error searching by coordinates:', error.message);
        return null;
    }
}

// Function to search for stations in a city
async function searchStations(keyword) {
    try {
        const response = await axios.get(
            `https://api.waqi.info/search/?token=${API_KEY}&keyword=${keyword}`
        );

        if (response.data.status === 'ok') {
            console.log('\nAvailable Stations:');
            console.log('-----------------');
            response.data.data.forEach(station => {
                console.log(`Station: ${station.station.name}`);
                console.log(`Location: ${station.station.geo[0]}, ${station.station.geo[1]}`);
                console.log(`Current AQI: ${station.aqi}`);
                console.log('---');
            });
        }
    } catch (error) {
        console.error('Error searching stations:', error.message);
    }
}

// Function to get nearest station data by coordinates
async function getNearestStation(lat, lon) {
    try {
        const response = await axios.get(
            `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${API_KEY}`
        );
        
        if (response.data.status === 'ok') {
            const data = response.data.data;
            console.log('\nNearest Station Information:');
            console.log('-------------------------');
            console.log(`Location: ${data.city.name}`);
            console.log(`Distance: ${data.city.distance ? data.city.distance + 'km' : 'Unknown'}`);
            console.log(`AQI: ${data.aqi}`);
            return data;
        }
        return null;
    } catch (error) {
        console.error('Error finding nearest station:', error.message);
        return null;
    }
}

// Function to test multiple cities
async function testMultipleCities() {
    const locations = [
        { name: 'Electronic City', lat: 12.8399, lon: 77.6770 },
        { name: 'Kaggalipura', lat: 12.7989, lon: 77.5470 },
        { name: 'Whitefield', lat: 12.9698, lon: 77.7500 }
    ];

    for (const location of locations) {
        console.log(`\nChecking data for ${location.name}...`);
        await getStationData(location.name);
        // If no direct data, try nearest station
        await getNearestStation(location.lat, location.lon);
        // Also show all stations within 5km
        await getStationsInRadius(location.lat, location.lon, 5);
    }
}

// Function to find all stations within a radius
async function getStationsInRadius(lat, lon, radius = 25) {
    try {
        // First get all stations in Bangalore
        const response = await axios.get(
            `https://api.waqi.info/map/bounds/?token=${API_KEY}&latlng=${lat-0.5},${lon-0.5},${lat+0.5},${lon+0.5}`
        );

        if (response.data.status === 'ok') {
            const stations = response.data.data;
            
            // Calculate distance and filter stations within radius
            const nearbyStations = stations.filter(station => {
                const distance = calculateDistance(lat, lon, station.lat, station.lon);
                return distance <= radius;
            });

            console.log(`\nStations within ${radius}km radius of ${lat}, ${lon}:`);
            console.log('----------------------------------------');
            nearbyStations.forEach(station => {
                const distance = calculateDistance(lat, lon, station.lat, station.lon);
                console.log(`Station: ${station.station.name}`);
                console.log(`Distance: ${distance.toFixed(2)}km`);
                console.log(`AQI: ${station.aqi}`);
                console.log('---');
            });
        }
    } catch (error) {
        console.error('Error searching stations in radius:', error.message);
    }
}

// Helper function to calculate distance between coordinates
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

// Execute tests
console.log('Checking API access...');
checkAPIAccess();

console.log('\nSearching for stations in Bangalore...');
searchStations('Bangalore');

console.log('\nTesting various Bangalore locations...');
testMultipleCities(); 