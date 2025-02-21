require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.IQAIR_API_KEY;

async function getAQI(city, state) {
    try {
        const response = await axios.get(
            `http://api.airvisual.com/v2/city?city=${city}&state=${state}&country=India&key=${API_KEY}`
        );
        
        const data = response.data.data;
        console.log('\nAQI Information:');
        console.log('----------------');
        console.log(`City: ${city}, ${state}`);
        console.log(`AQI: ${data.current.pollution.aqius}`);
        console.log(`Temperature: ${data.current.weather.tp}°C`);
        console.log(`Humidity: ${data.current.weather.hu}%`);
        console.log(`Wind Speed: ${data.current.weather.ws}m/s`);
        
    } catch (error) {
        console.error('Error:', error.response?.data?.message || error.message);
    }
}

// Test some cities
const cities = [
    { city: 'Mumbai', state: 'Maharashtra' },
    { city: 'Delhi', state: 'Delhi' },
    { city: 'Bangalore', state: 'Karnataka' }
];

cities.forEach(location => {
    getAQI(location.city, location.state);
}); 