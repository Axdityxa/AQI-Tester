require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.ACCUWEATHER_API_KEY;

// Debug API key
console.log('API Key:', API_KEY);
if (!API_KEY) {
    console.error('AccuWeather API key is missing!');
    process.exit(1);
}

async function getLocationKey(cityName) {
    try {
        const response = await axios.get(
            `http://dataservice.accuweather.com/locations/v1/cities/IN/search?apikey=${API_KEY}&q=${cityName}`
        );
        
        if (response.data && response.data.length > 0) {
            const cityData = response.data.find(city => 
                city.LocalizedName.toLowerCase().includes(cityName.toLowerCase())
            ) || response.data[0];

            // Check if AQI data is available for this location
            const hasAQI = cityData.DataSets && 
                          cityData.DataSets.includes('AirQualityCurrentConditions');

            return {
                key: cityData.Key,
                name: cityData.LocalizedName,
                state: cityData.AdministrativeArea.LocalizedName,
                type: cityData.Type,
                hasAQI: hasAQI
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting location key:', error.response?.data?.Message || error.message);
        return null;
    }
}

async function getAQIData(cityName) {
    try {
        const location = await getLocationKey(cityName);
        if (!location) {
            console.error(`Could not find location data for ${cityName}`);
            return;
        }

        console.log(`Found location: ${location.name}, ${location.state} (${location.type})`);
        console.log(`AQI data available: ${location.hasAQI}`);

        if (!location.hasAQI) {
            console.log('This location does not support AQI data. Trying nearest major city...');
            // Try to get data for Bangalore instead
            const bangaloreData = await getLocationKey('Bangalore');
            if (bangaloreData) {
                location.key = bangaloreData.key;
                console.log(`Using data from: Bangalore`);
            }
        }

        // Get air quality data first
        try {
            const aqiResponse = await axios.get(
                `http://dataservice.accuweather.com/airquality/v1/current/${location.key}?apikey=${API_KEY}`
            );
            
            const aqiData = aqiResponse.data[0];
            console.log('\nAir Quality Information:');
            console.log('----------------------');
            console.log(`AQI: ${aqiData.AQI}`);
            console.log(`Category: ${aqiData.Category.Name}`);
            
            // Log pollutant details
            const pollutants = {
                'PM2.5': aqiData.ParticulateMatter2_5,
                'PM10': aqiData.ParticulateMatter10,
                'O3': aqiData.Ozone,
                'NO2': aqiData.NitrogenDioxide,
                'CO': aqiData.CarbonMonoxide,
                'SO2': aqiData.SulfurDioxide
            };

            console.log('\nPollutant Details:');
            for (const [name, data] of Object.entries(pollutants)) {
                if (data) {
                    console.log(`${name}: ${data.Value} ${data.Unit}`);
                }
            }

        } catch (aqiError) {
            console.error('Error getting AQI data:', aqiError.message);
        }

        // Get weather data
        const weatherResponse = await axios.get(
            `http://dataservice.accuweather.com/currentconditions/v1/${location.key}?apikey=${API_KEY}&details=true`
        );

        const weatherData = weatherResponse.data[0];
        console.log('\nWeather Information:');
        console.log('-------------------');
        console.log(`Temperature: ${weatherData.Temperature.Metric.Value}°C`);
        console.log(`Humidity: ${weatherData.RelativeHumidity}%`);
        console.log(`Weather: ${weatherData.WeatherText}`);

    } catch (error) {
        console.error('Error:', error.response?.data?.Message || error.message);
        if (error.response?.status === 503) {
            console.error('Service is unavailable. You might have exceeded your API quota.');
        }
    }
}

// Test with specific cities
async function testMultipleCities() {
    const cities = [
        'Bangalore',
        'Electronic City',
        'Whitefield'
    ];

    for (const city of cities) {
        console.log(`\nChecking data for ${city}...`);
        await getAQIData(city);
    }
}

testMultipleCities();

// Add this function to test available cities
async function listCitiesWithAQIData() {
    try {
        const response = await axios.get(
            `http://dataservice.accuweather.com/locations/v1/cities/IN/search?apikey=${API_KEY}&q=Delhi`
        );
        console.log('Available cities:', response.data.map(city => ({
            name: city.EnglishName,
            key: city.Key,
            hasAQI: city.DataSets.includes('AirQualityCurrentConditions')
        })));
    } catch (error) {
        console.error('Error listing cities:', error.message);
    }
}

// Test available cities first
// listCitiesWithAQIData();

// Debug API key and package info
async function checkAPIAccess() {
    try {
        // First test a basic endpoint that should work
        const testResponse = await axios.get(
            `http://dataservice.accuweather.com/locations/v1/cities/IN/search?apikey=${API_KEY}&q=Bangalore`
        );
        console.log('Basic API access: OK');

        // Now test AQI endpoint specifically
        try {
            const locationKey = testResponse.data[0].Key;
            const aqiResponse = await axios.get(
                `http://dataservice.accuweather.com/airquality/v1/current/${locationKey}?apikey=${API_KEY}`
            );
            console.log('AQI API access: OK');
            console.log('Sample AQI data:', aqiResponse.data);
        } catch (aqiError) {
            console.error('AQI API access: FAILED');
            console.error('Error:', aqiError.response?.data?.Message || aqiError.message);
            console.log('\nNOTE: AQI data might require a paid subscription or different package.');
            console.log('Please check your app settings at https://developer.accuweather.com/user/me/apps');
        }
    } catch (error) {
        console.error('Basic API access failed:', error.response?.data?.Message || error.message);
    }
}

checkAPIAccess(); 